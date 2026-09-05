from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import include, path
from django.utils import timezone
from rest_framework.test import APIClient

from todos.models import BibleReadingPlan, DailyBibleSchedule
from todos.services.chapter_audio_service import (
    get_chapter_audio_url,
    load_chapter_audio_sources,
)

User = get_user_model()

urlpatterns = [
    path("api/v1/todos/", include("todos.urls")),
]


class ChapterAudioSourceLoaderTest(TestCase):
    """@readingjesus 장별 성경읽기 매핑 데이터 로더."""

    def test_loads_every_canonical_book(self):
        sources = load_chapter_audio_sources()
        self.assertEqual(len(sources), 66)

    def test_maps_known_chapter_to_watch_url(self):
        url = get_chapter_audio_url("gen", 1)
        self.assertIsNotNone(url)
        self.assertTrue(url.startswith("https://www.youtube.com/watch?v="))

    def test_returns_none_for_unpublished_chapter(self):
        # 채널에 시편 101편 이후 영상이 없다.
        self.assertIsNone(get_chapter_audio_url("psa", 101))

    def test_returns_none_for_unknown_book_or_chapter(self):
        self.assertIsNone(get_chapter_audio_url("nope", 1))
        self.assertIsNone(get_chapter_audio_url("gen", 999))


@override_settings(ROOT_URLCONF=__name__)
class ChapterDetailFallbackAudioApiTest(TestCase):
    """플랜 audio_link 가 없을 때 장별 폴백 오디오를 응답에 싣는다."""

    def setUp(self):
        self.client = APIClient()
        self.today = timezone.now().date()
        self.owner = User.objects.create_user(
            username="fallback-audio-owner",
            nickname="폴백플랜관리자",
            password="pw-test-1234",
        )
        self.plan = BibleReadingPlan.objects.create(
            name="폴백 오디오 테스트 플랜",
            is_active=True,
            created_by=self.owner,
        )

    def _schedule(self, book, start_chapter, end_chapter, audio_link=None, day_offset=0):
        return DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=self.today + timedelta(days=day_offset),
            book=book,
            start_chapter=start_chapter,
            end_chapter=end_chapter,
            audio_link=audio_link,
        )

    def _detail(self, book, chapter):
        return self.client.get(
            "/api/v1/todos/detail/",
            {"plan_id": self.plan.id, "book": book, "chapter": chapter},
        )

    def test_fills_fallback_for_schedule_without_audio_link(self):
        self._schedule("창세기", 1, 3)

        response = self._detail("gen", 1)

        self.assertEqual(response.status_code, 200)
        fallbacks = response.data["fallback_audio_links"]
        self.assertEqual(
            [(item["book"], item["chapter"]) for item in fallbacks],
            [("gen", 1), ("gen", 2), ("gen", 3)],
        )
        for item in fallbacks:
            self.assertTrue(item["url"].startswith("https://www.youtube.com/watch?v="))

    def test_existing_audio_link_wins_over_fallback(self):
        self._schedule("창세기", 1, 3, audio_link="https://www.youtube.com/watch?v=planaudio1")

        response = self._detail("gen", 1)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["audio_link"], "https://www.youtube.com/watch?v=planaudio1")
        self.assertEqual(response.data["fallback_audio_links"], [])

    def test_unpublished_chapters_are_omitted_from_fallback(self):
        self._schedule("시편", 99, 102)

        response = self._detail("psa", 99)

        self.assertEqual(response.status_code, 200)
        chapters = [item["chapter"] for item in response.data["fallback_audio_links"]]
        self.assertEqual(chapters, [99, 100])

    def test_covers_every_schedule_of_the_same_day(self):
        self._schedule("창세기", 1, 2)
        self._schedule("마태복음", 5, 5)

        response = self._detail("gen", 1)

        self.assertEqual(response.status_code, 200)
        pairs = [(item["book"], item["chapter"]) for item in response.data["fallback_audio_links"]]
        self.assertEqual(pairs, [("gen", 1), ("gen", 2), ("mat", 5)])
