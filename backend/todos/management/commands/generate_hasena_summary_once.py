from __future__ import annotations

from datetime import date, datetime
from typing import Final

from django.core.management.base import BaseCommand

from todos.services.hasena_summary_service import (
    get_hasena_summary as generate_summary,
)
from todos.services.hasena_summary_service import get_recent_hasena_videos

NO_VIDEO_INFO: Final = "no_video_info"


class Command(BaseCommand):
    help = "최신 하세나 영상 AI 요약을 한 번 생성하고 종료합니다."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--video-id", help="특정 YouTube video_id를 생성합니다.")
        parser.add_argument("--video-date", help="영상 날짜를 YYYY-MM-DD로 지정합니다.")
        parser.add_argument("--title", help="영상 제목을 지정합니다.")

    def handle(self, *args, **options) -> None:
        video_id = options.get("video_id")
        title = options.get("title")
        video_date = self._parse_video_date(options.get("video_date"))

        if video_id:
            result = generate_summary(video_id, video_date=video_date, title=title)
            if result.get("success"):
                self.stdout.write(self.style.SUCCESS(f"generated {result.get('video_id')}"))
                return

            reason = result.get("error") or "unknown_error"
            self.stdout.write(self.style.ERROR(f"failed {reason}"))
            return

        candidates = get_recent_hasena_videos()
        if not candidates:
            self.stdout.write(self.style.ERROR(f"failed {NO_VIDEO_INFO}"))
            return

        last_reason = NO_VIDEO_INFO
        for candidate in candidates:
            candidate_video_id = candidate.get("video_id")
            if not candidate_video_id:
                continue

            candidate_video_date = video_date
            if not candidate_video_date and candidate.get("published_at"):
                candidate_video_date = self._parse_published_at(candidate["published_at"])

            result = generate_summary(
                candidate_video_id,
                video_date=candidate_video_date,
                title=title or candidate.get("title"),
            )
            if result.get("success"):
                self.stdout.write(self.style.SUCCESS(f"generated {result.get('video_id')}"))
                return
            last_reason = result.get("error") or "unknown_error"

        self.stdout.write(self.style.ERROR(f"failed {last_reason}"))

    def _parse_video_date(self, value: str | None) -> date | None:
        if not value:
            return None
        return datetime.strptime(value, "%Y-%m-%d").date()

    def _parse_published_at(self, value: str) -> date | None:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
