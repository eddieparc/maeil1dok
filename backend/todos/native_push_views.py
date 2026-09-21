from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction

from authz import can, subject_from_request
from authz.policies.notification import NativePushCurrent
from .models import NativePushSubscription, NativePushOptOut
from .notification_serializers import (
    NativePushOwnershipConflict,
    NativePushSubscriptionRegisterSerializer,
    NativePushSubscriptionRemoveSerializer,
    NativePushSubscriptionSerializer,
)
from .openapi_serializers import SuccessCountResponseSerializer


class NativePushResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    enabled = serializers.BooleanField()


class NativePushStatusResponseSerializer(NativePushResponseSerializer):
    registered = serializers.BooleanField()


def _authorized(request):
    decision = can(subject_from_request(request), 'manage_native_push', NativePushCurrent())
    if not decision:
        return Response(decision.denial.body, status=decision.denial.status_code)
    return None


@transaction.atomic
def _remove(request, data):
    request.user.__class__.objects.select_for_update().get(pk=request.user.pk)
    if data['opt_out']:
        NativePushOptOut.objects.get_or_create(
            user=request.user, installation_id=data['installation_id'],
        )
    count = NativePushSubscription.objects.filter(
        user=request.user, token=data['token'],
        installation_id=data['installation_id'],
    ).update(enabled=False)
    return Response({'success': True, 'updated_count': count})


@extend_schema(methods=['POST'], request=NativePushSubscriptionRegisterSerializer,
               responses={200: NativePushResponseSerializer})
@extend_schema(methods=['DELETE'], request=NativePushSubscriptionRemoveSerializer,
               responses={200: SuccessCountResponseSerializer})
@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def native_push_subscription(request):
    denial = _authorized(request)
    if denial is not None:
        return denial
    serializer_type = (NativePushSubscriptionRegisterSerializer
                       if request.method == 'POST' else NativePushSubscriptionRemoveSerializer)
    serializer = serializer_type(data=request.data)
    serializer.is_valid(raise_exception=True)
    if request.method == 'DELETE':
        return _remove(request, serializer.validated_data)
    try:
        subscription = serializer.register(request.user)
    except NativePushOwnershipConflict:
        return Response({'success': False, 'error': '다른 계정에 연결된 기기입니다.'}, status=409)
    return Response({'success': True, 'enabled': subscription.enabled if subscription is not None else False})


@extend_schema(request=NativePushSubscriptionSerializer,
               responses={200: NativePushStatusResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def native_push_status(request):
    denial = _authorized(request)
    if denial is not None:
        return denial
    serializer = NativePushSubscriptionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    by_token = NativePushSubscription.objects.filter(token=data['token']).first()
    if (by_token is not None and by_token.enabled
            and by_token.user_id != request.user.id
            and str(by_token.installation_id) != data['installation_id']):
        return Response({'success': False, 'error': '다른 계정에 연결된 기기입니다.'}, status=409)
    own = NativePushSubscription.objects.filter(
        user=request.user, installation_id=data['installation_id'],
    ).first()
    opted_out = NativePushOptOut.objects.filter(
        user=request.user, installation_id=data['installation_id'],
    ).exists()
    return Response({
        'success': True,
        'registered': opted_out or (own is not None and own.enabled),
        'enabled': own.enabled if own is not None and not opted_out else False,
    })


@extend_schema(request=NativePushSubscriptionRemoveSerializer,
               responses={200: SuccessCountResponseSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remove_native_push(request):
    denial = _authorized(request)
    if denial is not None:
        return denial
    serializer = NativePushSubscriptionRemoveSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return _remove(request, serializer.validated_data)
