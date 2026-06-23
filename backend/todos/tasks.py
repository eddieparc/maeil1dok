import logging
from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)

SUMMARY_SUCCESS_KEY = 'hasena_summary_success_{date}'


@shared_task(bind=True, max_retries=0)
def generate_hasena_summary_task(self):
    current_time = timezone.now()
    now = timezone.localtime(current_time) if timezone.is_aware(current_time) else current_time
    today_str = now.strftime('%Y-%m-%d')
    cache_key = SUMMARY_SUCCESS_KEY.format(date=today_str)
    
    if cache.get(cache_key):
        logger.info(f"Summary already generated for {today_str}, skipping")
        return {'status': 'skipped', 'reason': 'already_generated'}
    
    if now.hour >= 6:
        logger.info(f"Outside summary generation window (hour={now.hour})")
        return {'status': 'skipped', 'reason': 'outside_window'}
    
    from .services.hasena_summary_service import (
        get_latest_hasena_video,
        get_hasena_summary,
    )
    from .services.hasena_monitoring import capture_hasena_summary_issue
    from .models import HasenaSummary
    
    try:
        video_info = get_latest_hasena_video()
        if not video_info or not video_info.get('video_id'):
            logger.warning("Could not fetch latest video info")
            capture_hasena_summary_issue(
                "Hasena summary task could not fetch latest video",
                level="warning",
                extra={"date": today_str},
            )
            return {'status': 'failed', 'reason': 'no_video_info'}
        
        video_id = video_info['video_id']
        logger.info(f"Latest video ID: {video_id}")
        
        existing = HasenaSummary.objects.filter(video_id=video_id).first()
        if existing:
            logger.info(f"Summary already exists for video {video_id}")
            cache.set(cache_key, True, timeout=86400)
            return {'status': 'skipped', 'reason': 'summary_exists', 'video_id': video_id}
        
        result = get_hasena_summary(video_id, video_date=now.date())
        
        if result.get('success'):
            logger.info(f"Successfully generated summary for video {video_id}")
            cache.set(cache_key, True, timeout=86400)
            return {'status': 'success', 'video_id': video_id}
        else:
            logger.warning(f"Failed to generate summary: {result.get('error')}")
            capture_hasena_summary_issue(
                "Hasena summary task failed",
                extra={
                    "date": today_str,
                    "video_id": video_id,
                    "reason": result.get('error'),
                },
            )
            return {'status': 'failed', 'reason': result.get('error'), 'video_id': video_id}
            
    except Exception as e:
        logger.error(f"Error in generate_hasena_summary_task: {str(e)}", exc_info=True)
        capture_hasena_summary_issue(
            "Hasena summary task raised an exception",
            extra={"date": today_str},
            exception=e,
        )
        return {'status': 'error', 'reason': str(e)}


@shared_task(bind=True, max_retries=0)
def send_due_notification_reminders_task(self):
    from .services.notifications import send_due_reminder_notifications

    try:
        created_count = send_due_reminder_notifications()
        logger.info('Created %s due notification reminders', created_count)
        return {'status': 'success', 'created_count': created_count}
    except Exception as e:
        logger.error(f"Error in send_due_notification_reminders_task: {str(e)}", exc_info=True)
        return {'status': 'error', 'reason': str(e)}
