import logging
from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)

SUMMARY_SUCCESS_KEY = 'hasena_summary_success_{date}'


def _build_summary_success_cache(service_date, video_id):
    return {
        'service_date': service_date.isoformat(),
        'video_id': video_id,
    }


def _get_valid_cached_summary_video_id(cache_value, service_date, selected_video_id, summary_model):
    if not isinstance(cache_value, dict):
        return None

    if cache_value.get('service_date') != service_date.isoformat():
        return None

    if cache_value.get('video_id') != selected_video_id:
        return None

    cached_summary = summary_model.objects.filter(
        video_id=selected_video_id,
        video_date=service_date,
    ).first()
    if cached_summary:
        return selected_video_id

    return None


@shared_task(bind=True, max_retries=0)
def generate_hasena_summary_task(self):
    current_time = timezone.now()
    now = timezone.localtime(current_time) if timezone.is_aware(current_time) else current_time
    target_date = now.date()
    target_date_str = target_date.isoformat()
    cache_key = SUMMARY_SUCCESS_KEY.format(date=target_date_str)
    
    if now.hour >= 6:
        logger.info(f"Outside summary generation window (hour={now.hour})")
        return {'status': 'skipped', 'reason': 'outside_window'}
    
    from .services.hasena_summary_service import (
        get_hasena_video_for_date,
        get_hasena_summary,
    )
    from .services.hasena_monitoring import capture_hasena_summary_issue
    from .models import HasenaSummary
    
    try:
        video_info = get_hasena_video_for_date(target_date)
        if not video_info or not video_info.get('video_id'):
            logger.warning(f"Could not find Hasena video for {target_date_str}")
            capture_hasena_summary_issue(
                "Hasena summary task could not find target-date video",
                level="warning",
                extra={"date": target_date_str},
            )
            return {'status': 'pending', 'reason': 'no_video_for_date', 'date': target_date_str}
        
        video_id = video_info['video_id']
        logger.info(f"Hasena video for {target_date_str}: {video_id}")

        cached_video_id = _get_valid_cached_summary_video_id(
            cache.get(cache_key),
            target_date,
            video_id,
            HasenaSummary,
        )
        if cached_video_id:
            logger.info(f"Summary already generated for {target_date_str}, skipping")
            return {
                'status': 'skipped',
                'reason': 'already_generated',
                'video_id': cached_video_id,
            }
        
        existing = HasenaSummary.objects.filter(video_id=video_id).first()
        if existing:
            logger.info(f"Summary already exists for video {video_id}")
            if getattr(existing, 'video_date', None) != target_date:
                capture_hasena_summary_issue(
                    "Hasena summary exists with unexpected video date",
                    level="warning",
                    extra={
                        "date": target_date_str,
                        "video_id": video_id,
                        "summary_date": str(getattr(existing, 'video_date', None)),
                    },
                )
                existing.video_date = target_date
                if not getattr(existing, 'title', None) and video_info.get('title'):
                    existing.title = video_info['title']
                    existing.save(update_fields=['video_date', 'title'])
                else:
                    existing.save(update_fields=['video_date'])
            cache.set(cache_key, _build_summary_success_cache(target_date, video_id), timeout=86400)
            return {'status': 'skipped', 'reason': 'summary_exists', 'video_id': video_id}
        
        result = get_hasena_summary(
            video_id,
            video_date=target_date,
            title=video_info.get('title'),
        )
        
        if result.get('success') and result.get('cacheable'):
            logger.info(f"Successfully generated summary for video {video_id}")
            cache.set(cache_key, _build_summary_success_cache(target_date, video_id), timeout=86400)
            return {'status': 'success', 'video_id': video_id}
        else:
            logger.warning(f"Failed to generate summary: {result.get('error')}")
            capture_hasena_summary_issue(
                "Hasena summary task failed",
                extra={
                    "date": target_date_str,
                    "video_id": video_id,
                    "reason": result.get('error'),
                },
            )
            return {'status': 'failed', 'reason': result.get('error'), 'video_id': video_id}
            
    except Exception as e:
        logger.error(f"Error in generate_hasena_summary_task: {str(e)}", exc_info=True)
        capture_hasena_summary_issue(
            "Hasena summary task raised an exception",
            extra={"date": target_date_str},
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
