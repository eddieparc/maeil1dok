"""
성경 본문 사전 캐싱 명령어

성서공회 서버에서 성경 본문을 미리 가져와 캐시에 저장합니다.
자연스러운 트래픽 패턴을 위해 랜덤 순서와 랜덤 딜레이를 적용합니다.

지원 버전:
    - 대한성서공회: GAE, HAN, SAE, SAENEW, COG, COGNEW, KNT

사용법:
    python manage.py prefetch_bible GAE
    python manage.py prefetch_bible --all
    python manage.py prefetch_bible GAE --book gen
    python manage.py prefetch_bible KNT --min-delay 3 --max-delay 6
"""

import random
import time
import signal
import sys
from django.core.management.base import BaseCommand, CommandError

from bible_cache.models import BibleContentCache
from bible_cache.services import BibleFetchService
from bible_cache.services.bible_fetch_service import BibleFetchError, SUPPORTED_VERSIONS


# 성경 책 정보 (id, 이름, 장 수)
BIBLE_BOOKS = [
    # 구약
    ('gen', '창세기', 50),
    ('exo', '출애굽기', 40),
    ('lev', '레위기', 27),
    ('num', '민수기', 36),
    ('deu', '신명기', 34),
    ('jos', '여호수아', 24),
    ('jdg', '사사기', 21),
    ('rut', '룻기', 4),
    ('1sa', '사무엘상', 31),
    ('2sa', '사무엘하', 24),
    ('1ki', '열왕기상', 22),
    ('2ki', '열왕기하', 25),
    ('1ch', '역대상', 29),
    ('2ch', '역대하', 36),
    ('ezr', '에스라', 10),
    ('neh', '느헤미야', 13),
    ('est', '에스더', 10),
    ('job', '욥기', 42),
    ('psa', '시편', 150),
    ('pro', '잠언', 31),
    ('ecc', '전도서', 12),
    ('sng', '아가', 8),
    ('isa', '이사야', 66),
    ('jer', '예레미야', 52),
    ('lam', '예레미야애가', 5),
    ('ezk', '에스겔', 48),
    ('dan', '다니엘', 12),
    ('hos', '호세아', 14),
    ('jol', '요엘', 3),
    ('amo', '아모스', 9),
    ('oba', '오바댜', 1),
    ('jnh', '요나', 4),
    ('mic', '미가', 7),
    ('nam', '나훔', 3),
    ('hab', '하박국', 3),
    ('zep', '스바냐', 3),
    ('hag', '학개', 2),
    ('zec', '스가랴', 14),
    ('mal', '말라기', 4),
    # 신약
    ('mat', '마태복음', 28),
    ('mrk', '마가복음', 16),
    ('luk', '누가복음', 24),
    ('jhn', '요한복음', 21),
    ('act', '사도행전', 28),
    ('rom', '로마서', 16),
    ('1co', '고린도전서', 16),
    ('2co', '고린도후서', 13),
    ('gal', '갈라디아서', 6),
    ('eph', '에베소서', 6),
    ('php', '빌립보서', 4),
    ('col', '골로새서', 4),
    ('1th', '데살로니가전서', 5),
    ('2th', '데살로니가후서', 3),
    ('1ti', '디모데전서', 6),
    ('2ti', '디모데후서', 4),
    ('tit', '디도서', 3),
    ('phm', '빌레몬서', 1),
    ('heb', '히브리서', 13),
    ('jas', '야고보서', 5),
    ('1pe', '베드로전서', 5),
    ('2pe', '베드로후서', 3),
    ('1jn', '요한일서', 5),
    ('2jn', '요한이서', 1),
    ('3jn', '요한삼서', 1),
    ('jud', '유다서', 1),
    ('rev', '요한계시록', 22),
]

# 책 이름 매핑
BOOK_NAMES = {book[0]: book[1] for book in BIBLE_BOOKS}
BOOK_CHAPTERS = {book[0]: book[2] for book in BIBLE_BOOKS}


class Command(BaseCommand):
    help = '성경 본문을 미리 캐싱합니다 (랜덤 순서, 랜덤 딜레이)'

    def __init__(self):
        super().__init__()
        self.should_stop = False

    def add_arguments(self, parser):
        parser.add_argument(
            'bible_version',
            nargs='?',
            type=str,
            help=f'번역본 지정 (선택: {", ".join(sorted(SUPPORTED_VERSIONS))})'
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='모든 번역본 캐싱 (bible_version 대신 사용)'
        )
        parser.add_argument(
            '--book',
            type=str,
            help='특정 책만 캐싱 (예: gen, mat)'
        )
        parser.add_argument(
            '--min-delay',
            type=float,
            default=1.0,
            help='최소 딜레이 (초, 기본값: 1.0)'
        )
        parser.add_argument(
            '--max-delay',
            type=float,
            default=4.0,
            help='최대 딜레이 (초, 기본값: 4.0)'
        )
        parser.add_argument(
            '--skip-cached',
            action='store_true',
            default=True,
            help='이미 캐시된 항목 건너뛰기 (기본값: True)'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='캐시 여부와 관계없이 강제로 다시 가져오기'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='실제 fetch 없이 대상 목록만 출력'
        )

    def handle(self, *args, **options):
        # Ctrl+C 핸들링
        signal.signal(signal.SIGINT, self._signal_handler)

        # 옵션 파싱
        versions = self._get_versions(options)
        books = self._get_books(options)
        min_delay = options['min_delay']
        max_delay = options['max_delay']
        skip_cached = not options['force']
        dry_run = options['dry_run']

        # 대상 목록 생성
        targets = self._build_target_list(versions, books)

        # 이미 캐시된 항목 필터링
        if skip_cached:
            targets = self._filter_cached(targets)

        if not targets:
            self.stdout.write(self.style.SUCCESS('모든 항목이 이미 캐시되어 있습니다.'))
            return

        # 랜덤 셔플
        random.shuffle(targets)

        self.stdout.write(f'총 {len(targets)}개 항목을 캐싱합니다.')
        self.stdout.write(f'딜레이: {min_delay}~{max_delay}초 (랜덤)')
        self.stdout.write('Ctrl+C로 중단할 수 있습니다.\n')

        if dry_run:
            self._print_targets(targets)
            return

        # 캐싱 실행
        self._execute_prefetch(targets, min_delay, max_delay)

    def _signal_handler(self, signum, frame):
        """Ctrl+C 핸들러"""
        self.stdout.write('\n\n중단 요청됨. 현재 작업 완료 후 종료합니다...')
        self.should_stop = True

    def _get_versions(self, options):
        """버전 목록 결정"""
        if options['all']:
            return list(SUPPORTED_VERSIONS)
        elif options['bible_version']:
            version = options['bible_version'].upper()
            if version not in SUPPORTED_VERSIONS:
                raise CommandError(
                    f"지원하지 않는 번역본: {version}\n"
                    f"지원 번역본: {', '.join(sorted(SUPPORTED_VERSIONS))}"
                )
            return [version]
        else:
            raise CommandError('번역본을 지정하거나 --all 옵션을 사용하세요.\n예: prefetch_bible GAE')

    def _get_books(self, options):
        """책 목록 결정"""
        if options['book']:
            book = options['book'].lower()
            if book not in BOOK_CHAPTERS:
                raise CommandError(
                    f"알 수 없는 책: {book}\n"
                    f"예시: gen, exo, mat, jhn"
                )
            return [book]
        return list(BOOK_CHAPTERS.keys())

    def _build_target_list(self, versions, books):
        """캐싱 대상 목록 생성"""
        targets = []
        for version in versions:
            for book in books:
                chapters = BOOK_CHAPTERS[book]
                for chapter in range(1, chapters + 1):
                    targets.append((version, book, chapter))
        return targets

    def _filter_cached(self, targets):
        """이미 캐시된 항목 필터링"""
        filtered = []
        for version, book, chapter in targets:
            cached = BibleContentCache.get_cached_content(version, book, chapter)
            if not cached or not cached.fetch_success:
                filtered.append((version, book, chapter))
        return filtered

    def _print_targets(self, targets):
        """대상 목록 출력 (dry-run)"""
        self.stdout.write('\n캐싱 대상 목록:')
        for version, book, chapter in targets[:20]:
            book_name = BOOK_NAMES.get(book, book)
            self.stdout.write(f'  {version} - {book_name} {chapter}장')
        if len(targets) > 20:
            self.stdout.write(f'  ... 외 {len(targets) - 20}개')

    def _execute_prefetch(self, targets, min_delay, max_delay):
        """캐싱 실행"""
        total = len(targets)
        success = 0
        failed = 0
        skipped = 0

        for i, (version, book, chapter) in enumerate(targets, 1):
            if self.should_stop:
                break

            book_name = BOOK_NAMES.get(book, book)

            try:
                # fetch 시도
                BibleFetchService.get_bible_content(
                    version=version,
                    book=book,
                    chapter=chapter,
                    force_refresh=True
                )
                success += 1
                self.stdout.write(
                    f'[{i}/{total}] {self.style.SUCCESS("OK")} '
                    f'{version} {book_name} {chapter}장'
                )

            except BibleFetchError as e:
                failed += 1
                self.stdout.write(
                    f'[{i}/{total}] {self.style.ERROR("FAIL")} '
                    f'{version} {book_name} {chapter}장 - {e}'
                )

            except Exception as e:
                failed += 1
                self.stdout.write(
                    f'[{i}/{total}] {self.style.ERROR("ERROR")} '
                    f'{version} {book_name} {chapter}장 - {e}'
                )

            # 마지막이 아니면 랜덤 딜레이
            if i < total and not self.should_stop:
                delay = random.uniform(min_delay, max_delay)
                time.sleep(delay)

        # 결과 요약
        self.stdout.write('\n' + '=' * 50)
        self.stdout.write(f'완료: {success}개 성공, {failed}개 실패')
        if self.should_stop:
            remaining = total - i
            self.stdout.write(f'중단됨: {remaining}개 남음')
        self.stdout.write('=' * 50)
