import threading
from datetime import datetime, timedelta

from django.utils import timezone


class CacheRefreshCoordinator:
    _lock = threading.Lock()
    _in_flight: set[str] = set()
    _failed_at: dict[str, datetime] = {}

    @classmethod
    def claim(cls, cache_key: str, retry_after_seconds: int) -> bool:
        with cls._lock:
            if cache_key in cls._in_flight:
                return False

            failed_at = cls._failed_at.get(cache_key)
            if failed_at and timezone.now() - failed_at < timedelta(seconds=retry_after_seconds):
                return False

            cls._in_flight.add(cache_key)
            return True

    @classmethod
    def release(cls, cache_key: str, success: bool) -> None:
        with cls._lock:
            cls._in_flight.discard(cache_key)
            if success:
                cls._failed_at.pop(cache_key, None)
            else:
                cls._failed_at[cache_key] = timezone.now()

    @classmethod
    def has_recent_failure(cls, cache_key: str) -> bool:
        with cls._lock:
            return cache_key in cls._failed_at

    @classmethod
    def clear_for_tests(cls) -> None:
        with cls._lock:
            cls._in_flight.clear()
            cls._failed_at.clear()
