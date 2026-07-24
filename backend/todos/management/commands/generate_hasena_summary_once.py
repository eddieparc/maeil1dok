from __future__ import annotations

from datetime import date, datetime
from typing import Final

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from todos.services.hasena_summary_service import (
    get_hasena_summary as generate_summary,
    get_hasena_video_for_date,
    require_cacheable_hasena_summary_result,
)
from todos.services.hasena_summary_service import get_recent_hasena_videos
from todos.services.hasena_monitoring import capture_hasena_summary_issue

NO_VIDEO_INFO: Final = "no_video_info"
NO_VIDEO_FOR_DATE: Final = "no_video_for_date"


class Command(BaseCommand):
    help = "최신 하세나 영상 AI 요약을 한 번 생성하고 종료합니다."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--video-id", help="특정 YouTube video_id를 생성합니다.")
        parser.add_argument("--video-date", help="영상 날짜를 YYYY-MM-DD로 지정합니다.")
        parser.add_argument("--title", help="영상 제목을 지정합니다.")
        parser.add_argument(
            "--fail-soft",
            action="store_true",
            help="실패를 기록하되 프로세스는 성공으로 종료합니다.",
        )

    def handle(self, *args, **options) -> None:
        fail_soft = bool(options.get("fail_soft"))
        video_id = options.get("video_id")
        title = options.get("title")
        video_date = self._parse_video_date(options.get("video_date"))

        if video_id:
            result = generate_summary(video_id, video_date=video_date, title=title)
            if result.get("success"):
                self.stdout.write(self.style.SUCCESS(f"generated {result.get('video_id')}"))
                return

            reason = result.get("error") or "unknown_error"
            capture_hasena_summary_issue(
                "Hasena summary generation failed for requested video",
                extra={"video_id": video_id, "reason": reason},
            )
            self._fail(reason, fail_soft=fail_soft)
            return

        candidates = get_recent_hasena_videos()
        if not candidates:
            capture_hasena_summary_issue(
                "Hasena summary generation could not find recent videos",
                level="warning",
            )
            self._fail(NO_VIDEO_INFO, fail_soft=fail_soft)
            return

        candidates_with_video = [item for item in candidates if item.get("video_id")]
        if not candidates_with_video:
            capture_hasena_summary_issue(
                "Hasena summary generation candidates had no video IDs",
                level="warning",
                extra={"candidate_count": len(candidates)},
            )
            self._fail(NO_VIDEO_INFO, fail_soft=fail_soft)
            return

        target_date = video_date or self._get_current_local_date()
        candidate = get_hasena_video_for_date(target_date, candidates_with_video)
        if not candidate:
            capture_hasena_summary_issue(
                "Hasena summary generation could not find target-date video",
                level="warning",
                extra={"date": target_date.isoformat()},
            )
            self._fail(NO_VIDEO_FOR_DATE, fail_soft=fail_soft)
            return

        result = generate_summary(
            candidate["video_id"],
            video_date=target_date,
            title=title or candidate.get("title"),
        )
        result = require_cacheable_hasena_summary_result(result)
        if result.get("success"):
            self.stdout.write(self.style.SUCCESS(f"generated {result.get('video_id')}"))
            return

        reason = result.get("error") or "unknown_error"
        self.stdout.write(self.style.WARNING(f"failed {candidate['video_id']} {reason}"))
        capture_hasena_summary_issue(
            "Hasena summary generation failed for target-date video",
            extra={"date": target_date.isoformat(), "video_id": candidate["video_id"], "reason": reason},
        )
        self._fail(reason, fail_soft=fail_soft)

    def _fail(self, reason: str, *, fail_soft: bool) -> None:
        self.stdout.write(self.style.ERROR(f"failed {reason}"))
        if fail_soft:
            self.stdout.write(
                self.style.WARNING("summary generation failed; exiting 0 due to --fail-soft")
            )
            return
        raise CommandError(reason)

    def _parse_video_date(self, value: str | None) -> date | None:
        if not value:
            return None
        return datetime.strptime(value, "%Y-%m-%d").date()

    def _get_current_local_date(self) -> date:
        current_time = timezone.now()
        current_local_time = (
            timezone.localtime(current_time)
            if timezone.is_aware(current_time)
            else current_time
        )
        return current_local_time.date()
