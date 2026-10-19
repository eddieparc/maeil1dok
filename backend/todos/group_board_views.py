"""Member-only group board, authorized by the existing reading-group policy."""

from django.core.paginator import EmptyPage, Paginator
from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.utils.urls import replace_query_param

from authz import can, subject_from_request
from authz.policies.reading_group import GroupPostResource, ReadingGroupResource
from . import openapi_serializers as openapi
from .group_views import _authz_denial_response
from .models import GroupMembership, GroupPost
from .serializers import GroupPostPaginationSerializer, GroupPostWriteSerializer


def _post_data(post, subject, membership):
    resource = GroupPostResource(post, membership)
    return openapi.GroupPostResponseSerializer({
        'id': post.id,
        'group_id': post.group_id,
        'title': post.title,
        'content': post.content,
        'author': {'id': post.author_id, 'nickname': post.author.nickname},
        'created_at': post.created_at,
        'updated_at': post.updated_at,
        'can_edit': bool(can(subject, 'update_group_post', resource)),
        'can_delete': bool(can(subject, 'delete_group_post', resource)),
    }).data


def _invalid_input(serializer):
    return Response({
        'success': False, 'error': '입력 내용을 확인해 주세요.',
        'errors': serializer.errors,
    }, status=400)


def _lock_membership(membership):
    # Re-read after locking: a concurrent leave/revocation must win before a write.
    return GroupMembership.objects.select_for_update().filter(pk=membership.pk).first()


@extend_schema(
    methods=['GET'], operation_id='todos_groups_posts_list',
    parameters=[GroupPostPaginationSerializer],
    responses={200: openapi.GroupPostListResponseSerializer, 400: openapi.GroupPostErrorSerializer,
               401: openapi.DetailResponseSerializer, 404: openapi.GroupPostErrorSerializer},
)
@extend_schema(
    methods=['POST'], request=GroupPostWriteSerializer,
    responses={201: openapi.GroupPostEnvelopeSerializer, 400: openapi.GroupPostErrorSerializer,
               401: openapi.DetailResponseSerializer, 404: openapi.GroupPostErrorSerializer},
)
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def group_posts(request, group_id):
    subject = subject_from_request(request)
    action = 'create_group_post' if request.method == 'POST' else 'list_group_posts'
    decision = can(subject, action, ReadingGroupResource(group_id))
    if not decision:
        return _authz_denial_response(decision)
    membership = decision.value

    if request.method == 'POST':
        serializer = GroupPostWriteSerializer(data=request.data)
        if not serializer.is_valid():
            return _invalid_input(serializer)
        post = GroupPost.objects.create(
            group_id=group_id, author=request.user, **serializer.validated_data,
        )
        return Response({
            'success': True, 'post': _post_data(post, subject, membership),
        }, status=201)

    pagination = GroupPostPaginationSerializer(data=request.query_params)
    if not pagination.is_valid():
        return _invalid_input(pagination)
    paginator = Paginator(
        GroupPost.objects.filter(group_id=group_id).select_related('author'),
        pagination.validated_data['page_size'],
    )
    try:
        page = paginator.page(pagination.validated_data['page'])
    except EmptyPage:
        return Response({'success': False, 'error': '페이지를 찾을 수 없어요.'}, status=404)
    url = request.build_absolute_uri()
    return Response({
        'success': True,
        'count': paginator.count,
        'next': replace_query_param(url, 'page', page.next_page_number()) if page.has_next() else None,
        'previous': replace_query_param(url, 'page', page.previous_page_number()) if page.has_previous() else None,
        'posts': [_post_data(post, subject, membership) for post in page.object_list],
    })


@extend_schema(
    methods=['GET'], operation_id='todos_groups_posts_retrieve',
    responses={200: openapi.GroupPostEnvelopeSerializer, 401: openapi.DetailResponseSerializer,
               404: openapi.GroupPostErrorSerializer},
)
@extend_schema(
    methods=['PATCH'], request=GroupPostWriteSerializer,
    responses={200: openapi.GroupPostEnvelopeSerializer, 400: openapi.GroupPostErrorSerializer,
               401: openapi.DetailResponseSerializer, 403: openapi.GroupPostErrorSerializer,
               404: openapi.GroupPostErrorSerializer},
)
@extend_schema(
    methods=['DELETE'], request=None,
    responses={200: openapi.GroupPostEnvelopeSerializer, 401: openapi.DetailResponseSerializer,
               403: openapi.GroupPostErrorSerializer, 404: openapi.GroupPostErrorSerializer},
)
@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def group_post_detail(request, group_id, post_id):
    subject = subject_from_request(request)
    with transaction.atomic():
        decision = can(subject, 'list_group_posts', ReadingGroupResource(group_id))
        if not decision:
            return _authz_denial_response(decision)
        membership = decision.value
        posts = GroupPost.objects.filter(group_id=group_id).select_related('author')
        if request.method != 'GET':
            membership = _lock_membership(membership)
            posts = posts.select_for_update()
        post = posts.filter(pk=post_id).first()
        if post is None:
            return Response({'success': False, 'error': '게시글을 찾을 수 없어요.'}, status=404)
        action = {
            'GET': 'view_group_post', 'PATCH': 'update_group_post', 'DELETE': 'delete_group_post',
        }[request.method]
        decision = can(subject, action, GroupPostResource(post, membership))
        if not decision:
            return _authz_denial_response(decision)
        if request.method == 'PATCH':
            serializer = GroupPostWriteSerializer(data=request.data, partial=True)
            if not serializer.is_valid():
                return _invalid_input(serializer)
            for field, value in serializer.validated_data.items():
                setattr(post, field, value)
            post.save(update_fields=[*serializer.validated_data, 'updated_at'])
        data = _post_data(post, subject, membership)
        if request.method == 'DELETE':
            post.delete()
        return Response({'success': True, 'post': data})
