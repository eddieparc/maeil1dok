from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from authz import can, subject_from_request
from authz.policies.notification import (
    NotificationInbox,
    NotificationResource,
    NotificationSettingsCurrent,
    PushConfiguration,
    PushSubscriptionCurrent,
    PushSubscriptionRemoval,
)
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


def _authz_denial_response(decision):
    denial = decision.denial
    if denial.body is None:
        return Response(status=denial.status_code)
    return Response(denial.body, status=denial.status_code)


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
    decision = can(
        subject_from_request(request),
        'view_notifications',
        NotificationInbox(),
    )
    if not decision:
        return _authz_denial_response(decision)

    ensure_reminder_notifications(request.user)

    unread_only = request.query_params.get('unread_only') == 'true'
    notifications = decision.value
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
    action = (
        'view_notification_settings'
        if request.method == 'GET'
        else 'update_notification_settings'
    )
    decision = can(
        subject_from_request(request),
        action,
        NotificationSettingsCurrent(),
    )
    if not decision:
        return _authz_denial_response(decision)
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
    decision = can(
        subject_from_request(request),
        'mark_notification_read',
        NotificationResource(notification_id=notification_id),
    )
    if not decision:
        return _authz_denial_response(decision)
    notification = decision.value

    notification.mark_read()
    return Response({
        'success': True,
        'notification': NotificationSerializer(notification).data,
    })


@extend_schema(responses={200: openapi.SuccessCountResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    decision = can(
        subject_from_request(request),
        'mark_all_notifications_read',
        NotificationInbox(),
    )
    if not decision:
        return _authz_denial_response(decision)
    updated_count = mark_all_read(request.user)
    return Response({
        'success': True,
        'updated_count': updated_count,
    })


@extend_schema(responses={200: openapi.PushConfigResponseSerializer})
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def push_config(request):
    decision = can(
        subject_from_request(request),
        'view_push_config',
        PushConfiguration(),
    )
    if not decision:
        return _authz_denial_response(decision)
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
    decision = can(
        subject_from_request(request),
        'register_push_subscription',
        PushSubscriptionCurrent(),
    )
    if not decision:
        return _authz_denial_response(decision)
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

    decision = can(
        subject_from_request(request),
        'remove_push_subscription',
        PushSubscriptionRemoval(endpoint=endpoint),
    )
    if not decision:
        return _authz_denial_response(decision)
    updated_count = decision.value.update(enabled=False)
    return Response({
        'success': True,
        'updated_count': updated_count,
    })
