"""H07 staff-only member API. No personal-settings writes or physical deletion."""
import csv

from django.core.paginator import EmptyPage, Paginator
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts import admin_member_serializers as serializers
from accounts.models import User
from accounts.services.admin_member_reads import (
    activity_queryset, member_data, member_queryset, member_stats, subscription_summaries,
)
from accounts.services.admin_members import perform_actions
from accounts.services.member_activity import last_active_at, member_status


def query_params(request):
    serializer = serializers.MemberQuerySerializer(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


def paginate(queryset, number):
    try:
        page = Paginator(queryset, 50).page(number)
    except EmptyPage as exc:
        raise NotFound('Page not found.') from exc
    return page, {'count': page.paginator.count,
                  'next': page.next_page_number() if page.has_next() else None,
                  'previous': page.previous_page_number() if page.has_previous() else None}


class StaffMemberView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store'
        return response


class MemberListView(StaffMemberView):
    @extend_schema(operation_id='admin_members_list', parameters=[serializers.MemberQuerySerializer],
                   responses=serializers.MemberListSerializer)
    def get(self, request):
        params = query_params(request)
        page, result = paginate(member_queryset(params), params['page'])
        users = list(page.object_list)
        plans = subscription_summaries(users)
        result['results'] = [member_data(user, plans[user.pk]) for user in users]
        return Response(serializers.MemberListSerializer(result).data)


class MemberDetailView(StaffMemberView):
    @extend_schema(responses=serializers.MemberDetailSerializer)
    def get(self, request, user_id):
        user = get_object_or_404(member_queryset(query_params(request)), pk=user_id)
        plans = subscription_summaries([user])
        return Response(serializers.MemberDetailSerializer(member_data(user, plans[user.pk], detail=True)).data)


class MemberActivityView(StaffMemberView):
    @extend_schema(parameters=[serializers.MemberQuerySerializer], responses=serializers.MemberActivitySerializer)
    def get(self, request, user_id):
        get_object_or_404(User.objects.only('pk'), pk=user_id)
        params = query_params(request)
        page, result = paginate(activity_queryset(user_id), params['page'])
        result['results'] = list(page.object_list)
        return Response(serializers.MemberActivitySerializer(result).data)


class MemberActionView(StaffMemberView):
    @extend_schema(request=serializers.MemberActionSerializer,
                   responses={200: serializers.MemberActionResultSerializer, 400: serializers.MemberActionResultSerializer})
    def post(self, request, user_id):
        serializer = serializers.MemberActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result = perform_actions(request.user.pk, [user_id], data['action'], data.get('provider'))[0]
        status = 200 if result['success'] else (404 if result['error'] == 'member_not_found' else 400)
        return Response(serializers.MemberActionResultSerializer(result).data, status=status)


class MemberBulkView(StaffMemberView):
    @extend_schema(request=serializers.MemberBulkSerializer, responses=serializers.MemberBulkResultSerializer)
    def post(self, request):
        serializer = serializers.MemberBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        results = perform_actions(request.user.pk, data['ids'], data['action'], bulk=True)
        return Response(serializers.MemberBulkResultSerializer({'results': results}).data)


def safe_csv_cell(value):
    value = '' if value is None else str(value)
    # Control characters must not move a spreadsheet formula past the prefix guard.
    value = ''.join(' ' if ord(char) < 32 or ord(char) == 127 else char for char in value)
    return "'" + value if value.lstrip().startswith(('=', '+', '-', '@')) else value


class MemberExportView(StaffMemberView):
    @extend_schema(parameters=[serializers.MemberQuerySerializer], responses={(200, 'text/csv'): OpenApiTypes.STR})
    def get(self, request):
        params = query_params(request)
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="members.csv"'
        response.write('\ufeff')
        writer = csv.writer(response)
        writer.writerow(('id', 'nickname', 'email', 'email_verified', 'is_staff', 'status', 'joined_at', 'last_active_at'))
        queryset = member_queryset(params).select_related(None).prefetch_related(None)
        for user in queryset.iterator(chunk_size=200):
            nickname, email = user.nickname, user.email or ''
            if params['masked']:
                nickname = nickname[:1] + '***'
                email = email[:1] + '***@***' if email else ''
            writer.writerow(map(safe_csv_cell, (
                user.pk, nickname, email, user.email_verified, user.is_staff, member_status(user),
                user.date_joined.isoformat(), last_active_at(user).isoformat() if last_active_at(user) else '',
            )))
        return response


class MemberStatsView(StaffMemberView):
    @extend_schema(responses=serializers.MemberStatsSerializer)
    def get(self, request):
        return Response(serializers.MemberStatsSerializer(member_stats()).data)
