"""
성경 본문 캐시 테스트
"""

import json
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from unittest.mock import patch, MagicMock

from bible_cache.models import BibleContentCache
from bible_cache.services import BibleFetchService
from bible_cache.services.bible_fetch_service import BibleFetchError
from bible_cache.services.cache_refresh_coordinator import CacheRefreshCoordinator


class BibleContentCacheModelTest(TestCase):
    """BibleContentCache 모델 테스트"""

    def test_generate_cache_key(self):
        """캐시 키 생성 테스트"""
        key = BibleContentCache.generate_cache_key('GAE', 'GEN', 1)
        self.assertEqual(key, 'GAE:gen:1')

    def test_save_and_get_cached_content(self):
        """캐시 저장 및 조회 테스트"""
        # 저장
        obj, created = BibleContentCache.save_to_cache(
            version='GAE',
            book='gen',
            chapter=1,
            content='<html>Test content</html>',
            content_type='html',
            source_url='https://example.com',
            fetch_success=True
        )

        self.assertTrue(created)
        self.assertEqual(obj.cache_key, 'GAE:gen:1')

        # 조회
        cached = BibleContentCache.get_cached_content('GAE', 'gen', 1)
        self.assertIsNotNone(cached)
        self.assertEqual(cached.content, '<html>Test content</html>')

    def test_upsert_existing_cache(self):
        """기존 캐시 업데이트 테스트"""
        # 최초 저장
        BibleContentCache.save_to_cache(
            version='GAE',
            book='gen',
            chapter=1,
            content='Old content',
            content_type='html'
        )

        # 업데이트
        obj, created = BibleContentCache.save_to_cache(
            version='GAE',
            book='gen',
            chapter=1,
            content='New content',
            content_type='html'
        )

        self.assertFalse(created)  # 업데이트이므로 created=False
        self.assertEqual(obj.content, 'New content')

        # DB에 하나만 있어야 함
        self.assertEqual(BibleContentCache.objects.count(), 1)


class BibleFetchServiceTest(TestCase):
    """BibleFetchService 테스트"""

    def setUp(self):
        CacheRefreshCoordinator.clear_for_tests()

    def test_unsupported_version(self):
        """지원하지 않는 번역본 테스트"""
        with self.assertRaises(BibleFetchError) as context:
            BibleFetchService.get_bible_content('INVALID', 'gen', 1)

        self.assertIn('지원하지 않는 번역본', str(context.exception))

    @patch('bible_cache.services.bible_fetch_service.requests.get')
    def test_fetch_standard_version(self, mock_get):
        """표준 번역본 fetch 테스트"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '<html><div id="tdBible1">Bible content Bible content Bible content Bible content Bible content Bible content Bible content</div></html>'
        mock_response.url = 'https://www.bskorea.or.kr/bible/...'
        mock_get.return_value = mock_response

        content, content_type, from_cache = BibleFetchService.get_bible_content(
            'GAE', 'gen', 1
        )

        self.assertEqual(content_type, 'html')
        self.assertFalse(from_cache)
        self.assertIn('Bible content', content)

    @patch('bible_cache.services.knt_bible_service.requests.get')
    def test_fetch_knt_version(self, mock_get):
        """KNT 번역본 fetch 테스트"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'found': True, 'content': 'KNT content'}
        mock_response.text = '{"found": true, "content": "KNT content"}'
        mock_get.return_value = mock_response

        content, content_type, from_cache = BibleFetchService.get_bible_content(
            'KNT', 'gen', 1
        )

        self.assertEqual(content_type, 'json')
        self.assertFalse(from_cache)

    def test_cache_fallback_on_fetch_failure(self):
        """fetch 실패 시 캐시 fallback 테스트"""
        # 미리 캐시에 저장
        BibleContentCache.save_to_cache(
            version='GAE',
            book='gen',
            chapter=1,
            content='Cached content',
            content_type='html',
            fetch_success=True
        )

        # fetch 실패 시뮬레이션
        with patch('bible_cache.services.bible_fetch_service.requests.get') as mock_get:
            mock_get.side_effect = Exception('Network error')

            content, content_type, from_cache = BibleFetchService.get_bible_content(
                'GAE', 'gen', 1, force_refresh=True
            )

            self.assertTrue(from_cache)
            self.assertEqual(content, 'Cached content')

    @patch('bible_cache.services.bible_fetch_service.BibleFetchService._schedule_refresh')
    @patch('bible_cache.services.bible_fetch_service.BibleFetchService._fetch_from_source')
    def test_stale_cache_returns_immediately_and_schedules_refresh(
        self,
        mock_fetch,
        mock_schedule_refresh,
    ):
        cached, _ = BibleContentCache.save_to_cache(
            version='GAE',
            book='gen',
            chapter=1,
            content='Old cached content',
            content_type='html',
            fetch_success=True
        )
        BibleContentCache.objects.filter(pk=cached.pk).update(
            updated_at=timezone.now() - timedelta(days=120)
        )

        content, content_type, from_cache = BibleFetchService.get_bible_content(
            'GAE', 'gen', 1
        )

        self.assertTrue(from_cache)
        self.assertEqual(content_type, 'html')
        self.assertEqual(content, 'Old cached content')
        mock_fetch.assert_not_called()
        mock_schedule_refresh.assert_called_once_with('GAE', 'gen', 1)

    @patch('bible_cache.services.bible_fetch_service.threading.Thread')
    def test_repeated_stale_reads_schedule_one_in_flight_refresh(self, mock_thread):
        cached, _ = BibleContentCache.save_to_cache(
            version='GAE',
            book='gen',
            chapter=1,
            content='Old cached content',
            content_type='html',
            fetch_success=True
        )
        BibleContentCache.objects.filter(pk=cached.pk).update(
            updated_at=timezone.now() - timedelta(days=120)
        )

        first = BibleFetchService.get_bible_content('GAE', 'gen', 1)
        second = BibleFetchService.get_bible_content('GAE', 'gen', 1)

        self.assertTrue(first[2])
        self.assertTrue(second[2])
        self.assertEqual(first[0], 'Old cached content')
        self.assertEqual(second[0], 'Old cached content')
        mock_thread.assert_called_once()
        mock_thread.return_value.start.assert_called_once()

    @patch('bible_cache.services.bible_fetch_service.threading.Thread')
    def test_failed_background_refresh_uses_retry_cooldown(self, mock_thread):
        cache_key = BibleContentCache.generate_cache_key('GAE', 'gen', 1)
        with patch(
            'bible_cache.services.bible_fetch_service.BibleFetchService._refresh_cache_from_source',
            side_effect=Exception('slow source'),
        ):
            BibleFetchService._refresh_cache_safely('GAE', 'gen', 1, cache_key)

        self.assertTrue(CacheRefreshCoordinator.has_recent_failure(cache_key))

        BibleFetchService._schedule_refresh('GAE', 'gen', 1)

        mock_thread.assert_not_called()

    @patch('bible_cache.services.bible_fetch_service.threading.Thread')
    def test_schedule_refresh_releases_claim_when_thread_start_fails(self, mock_thread):
        cache_key = BibleContentCache.generate_cache_key('GAE', 'gen', 1)
        mock_thread.return_value.start.side_effect = RuntimeError('thread unavailable')

        with self.assertRaises(RuntimeError):
            BibleFetchService._schedule_refresh('GAE', 'gen', 1)

        self.assertNotIn(cache_key, CacheRefreshCoordinator._in_flight)
        self.assertTrue(CacheRefreshCoordinator.has_recent_failure(cache_key))

    @patch('bible_cache.services.bible_fetch_service.BibleFetchService._fetch_from_source')
    def test_refresh_cache_from_source_updates_stale_cache(self, mock_fetch):
        cached, _ = BibleContentCache.save_to_cache(
            version='GAE',
            book='gen',
            chapter=1,
            content='Old cached content',
            content_type='html',
            fetch_success=True
        )
        BibleContentCache.objects.filter(pk=cached.pk).update(
            updated_at=timezone.now() - timedelta(days=120)
        )
        mock_fetch.return_value = (
            '<html><div>Fresh Bible content</div></html>',
            'html',
            'https://www.bskorea.or.kr/bible/fresh'
        )

        content, content_type, source_url = BibleFetchService._refresh_cache_from_source(
            'GAE', 'gen', 1
        )

        self.assertEqual(content_type, 'html')
        self.assertIn('Fresh Bible content', content)
        self.assertEqual(source_url, 'https://www.bskorea.or.kr/bible/fresh')
        self.assertEqual(
            BibleContentCache.get_cached_content('GAE', 'gen', 1).content,
            '<html><div>Fresh Bible content</div></html>'
        )


class BibleCacheAPITest(APITestCase):
    """API 엔드포인트 테스트"""

    def test_get_supported_versions(self):
        """지원 번역본 목록 조회"""
        response = self.client.get('/api/v1/bible-cache/versions/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('versions', response.data)
        self.assertTrue(len(response.data['versions']) > 0)

    def test_invalid_version(self):
        """잘못된 번역본 요청"""
        response = self.client.get('/api/v1/bible-cache/INVALID/gen/1/')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_invalid_chapter(self):
        """잘못된 장 번호 요청"""
        response = self.client.get('/api/v1/bible-cache/GAE/gen/0/')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('bible_cache.services.bible_fetch_service.requests.get')
    def test_get_bible_content_success(self, mock_get):
        """성경 본문 조회 성공"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '<html>Bible content Bible content Bible content Bible content Bible content Bible content Bible content Bible content</html>'
        mock_response.url = 'https://www.bskorea.or.kr/bible/...'
        mock_get.return_value = mock_response

        response = self.client.get('/api/v1/bible-cache/GAE/gen/1/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['version'], 'GAE')

    def test_cache_status_not_found(self):
        """캐시 상태 - 캐시 없음"""
        response = self.client.get('/api/v1/bible-cache/GAE/gen/1/status/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['cached'])

    def test_cache_status_found(self):
        """캐시 상태 - 캐시 있음"""
        # 캐시 저장
        BibleContentCache.save_to_cache(
            version='GAE',
            book='gen',
            chapter=1,
            content='Cached',
            content_type='html'
        )

        response = self.client.get('/api/v1/bible-cache/GAE/gen/1/status/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['cached'])

    def test_search_cached_content(self):
        BibleContentCache.save_to_cache(
            version='GAE',
            book='gen',
            chapter=1,
            content='<p><span>1 태초에 하나님이 천지를 창조하시니라</span></p>',
            content_type='html'
        )
        BibleContentCache.save_to_cache(
            version='GAE',
            book='exo',
            chapter=1,
            content='<p><span>1 애굽 왕 바로가 말하였다</span></p>',
            content_type='html'
        )

        response = self.client.get('/api/v1/bible-cache/search/?q=하나님&version=GAE')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['book'], 'gen')
        self.assertIn('하나님', response.data['results'][0]['snippet'])
        self.assertEqual(response.data['results'][0]['verse'], 1)

    def test_search_cached_content_strips_version_filter(self):
        BibleContentCache.save_to_cache(
            version='GAE',
            book='gen',
            chapter=1,
            content='<p><span>1 태초에 하나님이 천지를 창조하시니라</span></p>',
            content_type='html'
        )

        response = self.client.get('/api/v1/bible-cache/search/?q=하나님&version=%20GAE%20')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['count'], 1)

    def test_search_cached_content_handles_json_list_content(self):
        BibleContentCache.save_to_cache(
            version='GAE',
            book='gen',
            chapter=1,
            content='["태초에", "하나님이"]',
            content_type='json'
        )

        response = self.client.get('/api/v1/bible-cache/search/?q=하나님')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['count'], 1)
        self.assertIn('하나님', response.data['results'][0]['snippet'])

    def test_search_cached_content_returns_matching_verse_and_clean_snippet(self):
        BibleContentCache.save_to_cache(
            version='GAE',
            book='1ch',
            chapter=3,
            content=json.dumps({
                'verses': [
                    {'verse': 1, 'text': '다윗 왕의 아들들'},
                    {'verse': 2, 'text': '11&nbsp;&nbsp;&nbsp;직접입력 [역대상 3:1] 하나님이 함께하시니라'},
                ],
            }),
            content_type='json',
        )

        response = self.client.get('/api/v1/bible-cache/search/?q=하나님&version=GAE')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['results'][0]['verse'], 2)
        self.assertNotIn('&nbsp;', response.data['results'][0]['snippet'])
        self.assertNotIn('직접입력', response.data['results'][0]['snippet'])
