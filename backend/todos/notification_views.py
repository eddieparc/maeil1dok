from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer, NotificationSettingsSerializer
from .services.notifications import (
    ensure_reminder_notifications,
    get_notification_settings,
    mark_all_read,
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notification_inbox(request):
    ensure_reminder_notifications(request.user)

    unread_only = request.query_params.get('unread_only') == 'true'
    notifications = Notification.objects.filter(recipient=request.user).select_related('actor')
    if unread_only:
        notifications = notifications.filter(read_at__isnull=True)

    serializer = NotificationSerializer(notifications[:50], many=True)
    unread_count = Notification.objects.filter(
        recipient=request.user,
        read_at__isnull=True,
    ).count()
    return Response({
        'success': True,
        'unread_count': unread_count,
        'notifications': serializer.data,
        'settings': NotificationSettingsSerializer(get_notification_settings(request.user)).data,
    })


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def notification_settings(request):
    settings = get_notification_settings(request.user)

    if request.method == 'GET':
        return Response({
            'success': True,
            'settings': NotificationSettingsSerializer(settings).data,
        })

    serializer = NotificationSettingsSerializer(settings, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response({
            'success': False,
            'errors': serializer.errors,
        }, status=status.HTTP_400_BAD_REQUEST)

    serializer.save()
    return Response({
        'success': True,
        'settings': serializer.data,
    })


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    notification = Notification.objects.filter(
        id=notification_id,
        recipient=request.user,
    ).first()
    if notification is None:
        return Response({
            'success': False,
            'error': '알림을 찾을 수 없습니다.',
        }, status=status.HTTP_404_NOT_FOUND)

    notification.mark_read()
    return Response({
        'success': True,
        'notification': NotificationSerializer(notification).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    updated_count = mark_all_read(request.user)
    return Response({
        'success': True,
        'updated_count': updated_count,
    })
