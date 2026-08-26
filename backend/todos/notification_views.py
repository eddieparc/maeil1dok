from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification, NotificationPushSubscription
from .notification_serializers import (
    NotificationPushSubscriptionSerializer,
    PushEndpointOwnershipConflict,
    NotificationSerializer,
    NotificationSettingsSerializer,
)
from .services.notifications import (
    ensure_reminder_notifications,
    get_notification_settings,
    mark_all_read,
)
from .services.push_notifications import is_web_push_configured, web_push_public_key
from . import openapi_serializers as openapi


@extend_schema(
    parameters=[
        OpenApiParameter(
            'unread_only',
            bool,
            required=False,
            default=False,
            description='Return only unread notifications. Only the exact lowercase literal `true` enables the filter; every other value is treated as false.',
        ),
    ],
    responses={200: openapi.NotificationInboxResponseSerializer},
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


@extend_schema(methods=['GET'], responses={200: openapi.NotificationSettingsResponseSerializer})
@extend_schema(methods=['PATCH'], responses={200: openapi.NotificationSettingsResponseSerializer})
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


@extend_schema(responses={200: openapi.NotificationReadResponseSerializer})
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


@extend_schema(responses={200: openapi.SuccessCountResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    updated_count = mark_all_read(request.user)
    return Response({
        'success': True,
        'updated_count': updated_count,
    })


@extend_schema(responses={200: openapi.PushConfigResponseSerializer})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def push_config(request):
    public_key = web_push_public_key()
    return Response({
        'success': True,
        'enabled': is_web_push_configured(),
        'vapid_public_key': public_key,
    })


@extend_schema(responses={200: openapi.PushSubscriptionResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_push_subscription(request):
    serializer = NotificationPushSubscriptionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({
            'success': False,
            'errors': serializer.errors,
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        subscription = serializer.create_or_update(
            user=request.user,
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
        )
    except PushEndpointOwnershipConflict:
        return Response({
            'success': False,
            'errors': {
                'endpoint': ['이미 다른 계정에 등록된 푸시 엔드포인트입니다.'],
            },
        }, status=status.HTTP_409_CONFLICT)

    return Response({
        'success': True,
        'endpoint': subscription.endpoint,
        'enabled': subscription.enabled,
    })


@extend_schema(responses={200: openapi.SuccessCountResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_push_subscription(request):
    endpoint = request.data.get('endpoint')
    if not endpoint:
        return Response({
            'success': False,
            'error': 'endpoint가 필요합니다.',
        }, status=status.HTTP_400_BAD_REQUEST)

    updated_count = NotificationPushSubscription.objects.filter(
        user=request.user,
        endpoint=endpoint,
    ).update(enabled=False)
    return Response({
        'success': True,
        'updated_count': updated_count,
    })
