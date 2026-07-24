from calendar import monthrange
from datetime import date
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.http import Http404
from django.db.models import Q, Count, Prefetch
from django.utils import timezone
from accounts.models import User, UserProfile, Follow
from accounts.serializers import UserSearchSerializer
from accounts.visibility import is_live_user, live_user_filter
from .models import (
    ReadingGroup, GroupMembership, GroupInvitation, BibleReadingPlan,
    DailyBibleSchedule, UserBibleProgress, PlanSubscription
)
from .serializers import BibleReadingPlanSerializer
import logging

logger = logging.getLogger(__name__)


def _visible_groups_for_user(user):
    if not user.is_authenticated:
        return ReadingGroup.objects.filter(is_public=True)

    return ReadingGroup.objects.filter(
        Q(is_public=True) |
        Q(memberships__user=user, memberships__is_active=True)
    ).distinct()


def _pending_group_invitation(group, user):
    return GroupInvitation.objects.filter(
        group=group,
        invitee=user,
        status='pending'
    ).first()


def _deny_private_group_without_invitation():
    return Response({
        'success': False,
        'error': '비공개 그룹은 초대가 필요합니다.'
    }, status=status.HTTP_403_FORBIDDEN)


def _deny_full_group():
    return Response({
        'success': False,
        'error': '그룹이 가득 찼습니다.'
    }, status=status.HTTP_400_BAD_REQUEST)


def _group_not_found_response():
    return Response({
        'success': False,
        'error': '그룹을 찾을 수 없습니다.'
    }, status=status.HTTP_404_NOT_FOUND)


def _group_mutation_error_response():
    return Response({
        'success': False,
        'error': '그룹 요청 처리 중 오류가 발생했습니다.'
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _group_bad_request_response(message):
    return Response({
        'success': False,
        'error': message
    }, status=status.HTTP_400_BAD_REQUEST)


def _group_read_error_response():
    return Response({
        'success': False,
        'error': '그룹 조회 중 오류가 발생했습니다.'
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _user_groups_not_found_response():
    return Response({
        'success': False,
        'error': '사용자를 찾을 수 없습니다.'
    }, status=status.HTTP_404_NOT_FOUND)


def _user_for_public_groups_read(user_id, request_user):
    user = User.objects.filter(id=user_id).first()
    if user is None or not is_live_user(user):
        return None, _user_groups_not_found_response()

    profile = UserProfile.objects.filter(user=user).first()
    is_owner = request_user.is_authenticated and request_user == user
    if profile and not profile.is_public and not is_owner:
        return None, _user_groups_not_found_response()

    return user, None


def _group_visible_to_request(group, user):
    if group.is_public:
        return True
    return _user_is_active_group_member(group, user)


def _visible_group_for_read(group_id, user):
    group = ReadingGroup.objects.filter(id=group_id).first()
    if group is None or not _group_visible_to_request(group, user):
        return None
    return group


def _accept_invitation(invitation):
    invitation.status = 'accepted'
    invitation.responded_at = timezone.now()
    invitation.save(update_fields=['status', 'responded_at'])


def _reactivate_membership(membership):
    membership.is_active = True
    membership.role = 'member'
    membership.save(update_fields=['is_active', 'role'])


def _user_is_active_group_member(group, user):
    if not user.is_authenticated:
        return False

    return GroupMembership.objects.filter(
        group=group,
        user=user,
        is_active=True
    ).exists()

def _profile_visible_membership_q(request_user):
    q = Q(user__profile__is_public=True)
    if request_user.is_authenticated:
        q |= Q(user_id=request_user.id)
    return q


def _hide_private_group_mutation(group, membership, pending_invitation=None):
    return (
        not group.is_public
        and membership is None
        and pending_invitation is None
    )


def _parse_optional_bool(data, field_name):
    if field_name not in data:
        return None, None

    value = data.get(field_name)
    if isinstance(value, bool):
        return value, None
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {'true', '1'}:
            return True, None
        if normalized in {'false', '0'}:
            return False, None

    return None, f'{field_name}는 boolean 값이어야 합니다.'


def _parse_required_bool(data, field_name, default=False):
    if field_name not in data:
        return default, None

    value, error = _parse_optional_bool(data, field_name)
    if error:
        return None, error
    return value, None


def _parse_group_max_members(value):
    if isinstance(value, bool) or not isinstance(value, int):
        return None, '최대 멤버 수는 1에서 10000 사이의 정수여야 합니다.'
    if value < 1 or value > 10000:
        return None, '최대 멤버 수는 1에서 10000 사이의 정수여야 합니다.'
    return value, None


def _parse_invitee_id(value):
    """Validate a group invitation target user id from client input.

    Returns (user_id, error_message). Booleans, non-numeric objects/strings,
    and non-positive integers are rejected before any ORM lookup so malformed
    payloads never reach the generic 500 handler or accidentally target id 1.
    """
    if value is None or value == '':
        return None, '초대할 사용자 ID가 필요합니다.'
    if isinstance(value, bool):
        return None, '유효한 사용자 ID가 필요합니다.'
    if isinstance(value, int):
        parsed = value
    elif isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None, '초대할 사용자 ID가 필요합니다.'
        try:
            parsed = int(stripped)
        except (TypeError, ValueError):
            return None, '유효한 사용자 ID가 필요합니다.'
    else:
        return None, '유효한 사용자 ID가 필요합니다.'
    if parsed < 1:
        return None, '유효한 사용자 ID가 필요합니다.'
    return parsed, None


def _group_creation_error(message):
    return Response({
        'success': False,
        'error': message
    }, status=status.HTTP_400_BAD_REQUEST)


def _group_creator_data(creator, request_user):
    if not is_live_user(creator):
        return {
            'id': None,
            'nickname': None,
            'profile_image': None
        }

    if creator == request_user:
        return {
            'id': creator.id,
            'nickname': creator.nickname,
            'profile_image': creator.profile_image
        }

    try:
        profile = creator.profile
    except UserProfile.DoesNotExist:
        return {
            'id': None,
            'nickname': None,
            'profile_image': None
        }

    if not profile.is_public:
        return {
            'id': None,
            'nickname': None,
            'profile_image': None
        }

    return {
        'id': creator.id,
        'nickname': creator.nickname,
        'profile_image': creator.profile_image
    }


def _active_group_plan_queryset():
    """Active plans for group cards with subscriber_count annotated to avoid N+1.

    Inactive (`is_active=False`) plans are excluded so group representations never
    leak deactivated plan metadata to non-admin/public callers.
    """
    return BibleReadingPlan.objects.filter(is_active=True).select_related('created_by').annotate(
        subscriber_count=Count(
            'plansubscription',
            filter=Q(plansubscription__is_active=True),
        )
    )


def _visible_group_plans(group):
    """Active plans for a group, using the prefetched `visible_plans` when available."""
    visible = getattr(group, 'visible_plans', None)
    if visible is not None:
        return visible
    return _active_group_plan_queryset().filter(reading_groups=group)


def _materialize_group_cards(groups):
    """Materialize a bounded group queryset with plan prefetch for card serialization."""
    return list(
        groups.select_related('creator__profile')
        .prefetch_related(
            Prefetch('plans', queryset=_active_group_plan_queryset(), to_attr='visible_plans')
        )
        .distinct()
        .order_by('-created_at')[:50]
    )


def _member_count_by_group_id(group_ids):
    """Active-member counts for the given group ids in a single query."""
    if not group_ids:
        return {}
    rows = (
        GroupMembership.objects.filter(group_id__in=group_ids, is_active=True)
        .values('group_id')
        .annotate(count=Count('id'))
    )
    return {row['group_id']: row['count'] for row in rows}


def _membership_by_group_id(group_ids, user):
    """Current-user active memberships keyed by group id in a single query."""
    if not group_ids or not user.is_authenticated:
        return {}
    memberships = GroupMembership.objects.filter(
        group_id__in=group_ids,
        user=user,
        is_active=True,
    )
    return {m.group_id: m for m in memberships}


class ReadingGroupSerializer:
    """그룹 시리얼라이저 (간단 구현)"""
    @staticmethod
    def to_dict(group, request=None, member_count_by_group_id=None,
                membership_by_group_id=None):
        request_user = request.user if request else None

        if member_count_by_group_id is not None:
            member_count = member_count_by_group_id.get(group.id, 0)
        else:
            member_count = group.member_count

        data = {
            'id': group.id,
            'name': group.name,
            'description': group.description,
            'creator': _group_creator_data(group.creator, request_user),
            'plans': BibleReadingPlanSerializer(_visible_group_plans(group), many=True).data,
            'is_public': group.is_public,
            'max_members': group.max_members,
            'member_count': member_count,
            'is_full': member_count >= group.max_members,
            'created_at': group.created_at,
            'updated_at': group.updated_at
        }

        # 로그인한 사용자의 멤버십 상태
        if request and request.user.is_authenticated:
            if membership_by_group_id is not None:
                membership = membership_by_group_id.get(group.id)
            else:
                membership = GroupMembership.objects.filter(
                    group=group,
                    user=request.user,
                    is_active=True
                ).first()
            data['is_member'] = membership is not None
            data['my_role'] = membership.get_role_display() if membership else None
            data['show_in_profile'] = membership.show_in_profile if membership else True
        else:
            data['is_member'] = False
            data['my_role'] = None
            data['show_in_profile'] = True

        return data


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_group(request):
    """그룹 생성"""
    try:
        name = (request.data.get('name') or '').strip()
        description = request.data.get('description', '')
        plan_ids = request.data.get('plan_ids', [])
        is_public, bool_error = _parse_required_bool(request.data, 'is_public')
        if bool_error:
            return _group_creation_error(bool_error)

        max_members, max_members_error = _parse_group_max_members(
            request.data.get('max_members', 50)
        )
        if max_members_error:
            return _group_creation_error(max_members_error)

        # 필수 필드 검증
        if not name:
            return _group_creation_error('그룹 이름은 필수입니다.')

        if not plan_ids or not isinstance(plan_ids, list) or len(plan_ids) == 0:
            return _group_creation_error('최소 1개 이상의 플랜을 선택해야 합니다.')

        # 플랜 확인
        plans = BibleReadingPlan.objects.filter(id__in=plan_ids, is_active=True)
        if plans.count() != len(plan_ids):
            return _group_creation_error('유효하지 않은 플랜 ID가 포함되어 있습니다.')

        with transaction.atomic():
            # 그룹 생성
            group = ReadingGroup.objects.create(
                name=name,
                description=description,
                creator=request.user,
                is_public=is_public,
                max_members=max_members
            )

            # ManyToMany 관계 설정
            group.plans.set(plans)

            # 생성자를 관리자로 추가
            GroupMembership.objects.create(
                group=group,
                user=request.user,
                role='admin',
                is_active=True
            )

        return Response({
            'success': True,
            'group': ReadingGroupSerializer.to_dict(group, request)
        }, status=status.HTTP_201_CREATED)
    except Exception:
        logger.error("Error creating group")
        return Response({
            'success': False,
            'error': '그룹 생성 중 오류가 발생했습니다.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_groups(request):
    """그룹 목록 조회"""
    try:
        # 쿼리 파라미터
        search = request.query_params.get('search', '')
        plan_id = request.query_params.get('plan_id')
        only_public = request.query_params.get('only_public', 'false').lower() == 'true'
        only_mine = request.query_params.get('only_mine', 'false').lower() == 'true'
        
        # 기본 쿼리셋: 공개 그룹 또는 사용자가 속한 비공개 그룹만 노출
        groups = _visible_groups_for_user(request.user)
        
        # 검색
        if search:
            groups = groups.filter(
                Q(name__icontains=search) | Q(description__icontains=search)
            )
        
        # 플랜 필터 (plans는 ManyToMany이므로 plans__id로 조회, 비활성 플랜은 노출하지 않음)
        if plan_id:
            groups = groups.filter(plans__id=plan_id, plans__is_active=True)
        
        # 공개 그룹만
        if only_public:
            groups = groups.filter(is_public=True)
        
        # 내 그룹만
        if only_mine and request.user.is_authenticated:
            groups = groups.filter(
                memberships__user=request.user,
                memberships__is_active=True
            ).distinct()

        # 정렬 + 카드 직렬화용 배치 프리페치/집계 (그룹당 N+1 제거)
        group_cards = _materialize_group_cards(groups)
        group_ids = [g.id for g in group_cards]
        member_counts = _member_count_by_group_id(group_ids)
        memberships = _membership_by_group_id(group_ids, request.user)

        # 시리얼라이즈
        groups_data = [
            ReadingGroupSerializer.to_dict(
                group,
                request,
                member_count_by_group_id=member_counts,
                membership_by_group_id=memberships,
            )
            for group in group_cards
        ]
        
        return Response({
            'success': True,
            'groups': groups_data,
            'total': len(groups_data)
        })
    except Exception as e:
        logger.error(f"Error getting groups: {str(e)}")
        return _group_read_error_response()


@api_view(['GET'])
@permission_classes([AllowAny])
def get_group_detail(request, group_id):
    """그룹 상세 조회"""
    try:
        group = _visible_group_for_read(group_id, request.user)
        if group is None:
            return _group_not_found_response()
        
        return Response({
            'success': True,
            'group': ReadingGroupSerializer.to_dict(group, request)
        })
    except Exception as e:
        logger.error(f"Error getting group detail: {str(e)}")
        return _group_read_error_response()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_group(request, group_id):
    """그룹 가입"""
    try:
        with transaction.atomic():
            group = ReadingGroup.objects.select_for_update().filter(id=group_id).first()
            if group is None:
                return _group_not_found_response()

            # 이미 멤버인지 확인
            existing_membership = GroupMembership.objects.select_for_update().filter(
                group=group,
                user=request.user
            ).first()

            if existing_membership and existing_membership.is_active:
                return Response({
                    'success': False,
                    'error': '이미 그룹 멤버입니다.'
                }, status=status.HTTP_400_BAD_REQUEST)

            pending_invitation = None
            if not group.is_public:
                pending_invitation = GroupInvitation.objects.select_for_update().filter(
                    group=group,
                    invitee=request.user,
                    status='pending'
                ).first()
                if _hide_private_group_mutation(group, existing_membership, pending_invitation):
                    return _group_not_found_response()
                if not pending_invitation:
                    return _deny_private_group_without_invitation()

            # 그룹이 가득 찼는지 확인
            if group.is_full:
                return _deny_full_group()

            if existing_membership:
                # 비활성 멤버십 재활성화
                if pending_invitation:
                    _accept_invitation(pending_invitation)
                _reactivate_membership(existing_membership)
                return Response({
                    'success': True,
                    'message': '그룹에 다시 가입했습니다.'
                })

            if pending_invitation:
                _accept_invitation(pending_invitation)

            # 멤버십 생성
            GroupMembership.objects.create(
                group=group,
                user=request.user,
                role='member',
                is_active=True
            )

            return Response({
                'success': True,
                'message': '그룹에 가입했습니다.',
                'group': ReadingGroupSerializer.to_dict(group, request)
            }, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"Error joining group: {str(e)}")
        return _group_mutation_error_response()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def leave_group(request, group_id):
    """그룹 탈퇴"""
    try:
        group = ReadingGroup.objects.filter(id=group_id).first()
        if group is None:
            return _group_not_found_response()

        membership = GroupMembership.objects.filter(
            group=group,
            user=request.user,
            is_active=True
        ).first()

        if not membership:
            if not group.is_public:
                return _group_not_found_response()
            return Response({
                'success': False,
                'error': '그룹 멤버가 아닙니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 그룹 생성자는 탈퇴 불가
        if group.creator == request.user:
            return Response({
                'success': False,
                'error': '그룹 생성자는 탈퇴할 수 없습니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 멤버십 비활성화
        membership.is_active = False
        membership.save()
        
        return Response({
            'success': True,
            'message': '그룹을 탈퇴했습니다.'
        })
    except Exception as e:
        logger.error(f"Error leaving group: {str(e)}")
        return _group_mutation_error_response()


@api_view(['GET'])
@permission_classes([AllowAny])
def get_group_members(request, group_id):
    """
    그룹 멤버 목록 조회
    
    최대 100명의 멤버까지 반환합니다. 더 많은 멤버가 있는 경우 offset/limit 파라미터로 페이지네이션하세요.
    
    Query Parameters:
    - offset: 멤버 목록 오프셋 (default: 0)
    - limit: 반환할 멤버 수 (default: 100, max: 100)
    """
    try:
        # 페이지네이션 파라미터 파싱 및 검증
        try:
            offset = int(request.query_params.get('offset', 0))
            limit = int(request.query_params.get('limit', 100))
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'error': 'offset과 limit은 숫자여야 합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 페이지네이션 범위 검증
        MAX_GROUP_MEMBERS_PER_REQUEST = 100
        if offset < 0:
            return Response({
                'success': False,
                'error': 'offset은 0 이상이어야 합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if limit < 1 or limit > MAX_GROUP_MEMBERS_PER_REQUEST:
            return Response({
                'success': False,
                'error': f'limit은 1에서 {MAX_GROUP_MEMBERS_PER_REQUEST} 사이여야 합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        group = _visible_group_for_read(group_id, request.user)
        if group is None:
            return _group_not_found_response()
        
        # 멤버 목록 조회 (페이지네이션 적용)
        all_memberships = GroupMembership.objects.filter(
            group=group,
            is_active=True,
            user__is_active=True,
            user__scheduled_deletion_at__isnull=True,
        ).filter(
            _profile_visible_membership_q(request.user)
        ).select_related('user', 'user__profile').order_by('-joined_at')

        total_members = all_memberships.count()
        memberships = list(all_memberships[offset:offset + limit])

        member_ids = [membership.user_id for membership in memberships]
        following_ids = set()
        if request.user.is_authenticated and member_ids:
            following_ids = set(
                Follow.objects.filter(
                    follower=request.user,
                    following_id__in=member_ids,
                ).values_list('following_id', flat=True)
            )

        members = []
        for membership in memberships:
            members.append({
                'user': UserSearchSerializer(
                    membership.user,
                    context={'request': request, 'following_ids': following_ids}
                ).data,
                'role': membership.get_role_display(),
                'joined_at': membership.joined_at
            })
        
        return Response({
            'success': True,
            'members': members,
            'meta': {
                'total_members': total_members,
                'offset': offset,
                'limit': limit,
                'returned_members': len(members),
                'has_more': offset + len(members) < total_members
            }
        })
    except Exception as e:
        logger.error(f"Error getting group members: {str(e)}")
        return _group_read_error_response()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invite_to_group(request, group_id):
    """그룹 초대"""
    try:
        group = ReadingGroup.objects.filter(id=group_id).first()
        if group is None:
            return _group_not_found_response()

        # 권한 확인 (관리자만 초대 가능)
        membership = GroupMembership.objects.filter(
            group=group,
            user=request.user,
            is_active=True
        ).first()

        if not membership or membership.role != 'admin':
            if not group.is_public:
                return _group_not_found_response()
            return Response({
                'success': False,
                'error': '관리자만 초대할 수 있습니다.'
            }, status=status.HTTP_403_FORBIDDEN)

        message = request.data.get('message', '')

        invitee_id, invitee_error = _parse_invitee_id(request.data.get('user_id'))
        if invitee_error:
            return _group_bad_request_response(invitee_error)

        invitee = User.objects.filter(id=invitee_id).first()
        if invitee is None or not is_live_user(invitee):
            raise Http404
        
        # 이미 멤버인지 확인
        if GroupMembership.objects.filter(group=group, user=invitee, is_active=True).exists():
            return Response({
                'success': False,
                'error': '이미 그룹 멤버입니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 이미 초대했는지 확인
        existing_invitation = GroupInvitation.objects.filter(
            group=group,
            invitee=invitee,
            status='pending'
        ).first()
        
        if existing_invitation:
            return Response({
                'success': False,
                'error': '이미 초대를 보냈습니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        invitation, created = GroupInvitation.objects.get_or_create(
            group=group,
            invitee=invitee,
            defaults={
                'inviter': request.user,
                'message': message,
                'status': 'pending'
            }
        )

        if not created:
            invitation.inviter = request.user
            invitation.message = message
            invitation.status = 'pending'
            invitation.responded_at = None
            invitation.save(update_fields=['inviter', 'message', 'status', 'responded_at'])
        
        return Response({
            'success': True,
            'message': '초대를 보냈습니다.'
        }, status=status.HTTP_201_CREATED)
    except Http404:
        return _group_not_found_response()
    except Exception as e:
        logger.error(f"Error inviting to group: {str(e)}")
        return _group_mutation_error_response()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_invitations(request):
    """내 초대 목록 조회"""
    try:
        invitations = GroupInvitation.objects.filter(
            invitee=request.user,
            status='pending'
        ).select_related('group__creator__profile', 'inviter').order_by('-created_at')
        
        invitations_data = []
        for invitation in invitations:
            invitations_data.append({
                'id': invitation.id,
                'group': ReadingGroupSerializer.to_dict(invitation.group, request),
                'inviter': UserSearchSerializer(invitation.inviter, context={'request': request}).data,
                'message': invitation.message,
                'created_at': invitation.created_at
            })
        
        return Response({
            'success': True,
            'invitations': invitations_data
        })
    except Exception as e:
        logger.error(f"Error getting invitations: {str(e)}")
        return _group_read_error_response()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def respond_to_invitation(request, invitation_id):
    """초대 응답"""
    try:
        action = request.data.get('action')  # accept or decline

        if action not in ['accept', 'decline']:
            return Response({
                'success': False,
                'error': '유효한 액션이 아닙니다. (accept/decline)'
            }, status=status.HTTP_400_BAD_REQUEST)

        invitation_ref = get_object_or_404(
            GroupInvitation.objects.only('id', 'group_id'),
            id=invitation_id,
            invitee=request.user,
            status='pending'
        )

        with transaction.atomic():
            group = ReadingGroup.objects.select_for_update().get(id=invitation_ref.group_id)
            membership = None
            if action == 'accept':
                membership = GroupMembership.objects.select_for_update().filter(
                    group=group,
                    user=request.user
                ).first()

            invitation = get_object_or_404(
                GroupInvitation.objects.select_for_update(),
                id=invitation_id,
                invitee=request.user,
                group=group,
                status='pending'
            )
            invitation.responded_at = timezone.now()

            if action == 'accept':
                already_active = membership and membership.is_active
                if group.is_full and not already_active:
                    return _deny_full_group()

                if membership:
                    _reactivate_membership(membership)
                else:
                    GroupMembership.objects.create(
                        group=group,
                        user=request.user,
                        role='member',
                        is_active=True
                    )

                invitation.status = 'accepted'
                invitation.save()

                return Response({
                    'success': True,
                    'message': '초대를 수락했습니다.',
                    'group': ReadingGroupSerializer.to_dict(group, request)
                })

            invitation.status = 'declined'
            invitation.save()

            return Response({
                'success': True,
                'message': '초대를 거절했습니다.'
            })
    except Http404:
        return _group_not_found_response()
    except Exception as e:
        logger.error(f"Error responding to invitation: {str(e)}")
        return _group_mutation_error_response()


@api_view(['GET'])
@permission_classes([AllowAny])
def get_user_public_groups(request, user_id):
    """특정 사용자의 프로필에 표시된 그룹 조회"""
    try:
        user, hidden_response = _user_for_public_groups_read(user_id, request.user)
        if hidden_response is not None:
            return hidden_response

        # 본인인 경우 모든 그룹 표시, 타인인 경우 공개 그룹만
        is_own_profile = request.user.is_authenticated and request.user == user

        if is_own_profile:
            # 본인: 모든 그룹 (show_in_profile 상관없이)
            groups = ReadingGroup.objects.filter(
                memberships__user=user,
                memberships__is_active=True
            ).distinct()
        else:
            # 타인: 공개 그룹 + 프로필에 표시 설정된 그룹만
            groups = ReadingGroup.objects.filter(
                memberships__user=user,
                memberships__is_active=True,
                memberships__show_in_profile=True,
                is_public=True
            ).distinct()

        group_cards = _materialize_group_cards(groups)
        group_ids = [g.id for g in group_cards]
        member_counts = _member_count_by_group_id(group_ids)
        memberships = _membership_by_group_id(group_ids, request.user)
        groups_data = [
            ReadingGroupSerializer.to_dict(
                g,
                request,
                member_count_by_group_id=member_counts,
                membership_by_group_id=memberships,
            )
            for g in group_cards
        ]

        return Response({
            'success': True,
            'groups': groups_data,
            'total': len(groups_data)
        })
    except Exception as e:
        logger.error(f"Error getting user public groups: {str(e)}")
        return _group_read_error_response()


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_group_visibility(request, group_id):
    """프로필에서 그룹 표시 여부 설정"""
    membership = get_object_or_404(
        GroupMembership,
        group_id=group_id,
        user=request.user,
        is_active=True
    )

    show_in_profile, validation_error = _parse_optional_bool(
        request.data,
        'show_in_profile',
    )
    if validation_error:
        return Response({
            'success': False,
            'error': validation_error,
        }, status=status.HTTP_400_BAD_REQUEST)

    if show_in_profile is not None:
        membership.show_in_profile = show_in_profile
        membership.save(update_fields=['show_in_profile'])

    return Response({
        'success': True,
        'show_in_profile': membership.show_in_profile,
        'message': '프로필 표시 설정이 변경되었습니다.'
    })

# Maximum number of members to include in a single response to prevent resource exhaustion
MAX_GROUP_MEMBERS_PER_REQUEST = 100

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_group_member_progress(request, group_id):
    """
    그룹 멤버별 월별 진도 조회 (달력 뷰용)
    
    최대 100명의 멤버까지 반환합니다. 더 많은 멤버가 있는 경우 offset/limit 파라미터로 페이지네이션하세요.
    
    Query Parameters:
    - year: 연도
    - month: 월 (1-12)
    - plan_id: 플랜 ID
    - offset: 멤버 목록 오프셋 (default: 0)
    - limit: 반환할 멤버 수 (default: 100, max: 100)
    """
    try:
        # 쿼리 파라미터
        today = date.today()
        month = request.query_params.get('month', today.month)
        year = request.query_params.get('year', today.year)
        plan_id = request.query_params.get('plan_id')

        try:
            month = int(month)
            year = int(year)
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'error': 'month와 year는 숫자여야 합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if month < 1 or month > 12:
            return Response({
                'success': False,
                'error': 'month는 1부터 12 사이여야 합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        if year < 1 or year > 9999:
            return Response({
                'success': False,
                'error': 'year는 1부터 9999 사이여야 합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            group = ReadingGroup.objects.prefetch_related('plans').get(id=group_id)
        except ReadingGroup.DoesNotExist:
            return Response({
                'success': False,
                'error': '그룹을 찾을 수 없습니다.'
            }, status=status.HTTP_404_NOT_FOUND)

        if not _user_is_active_group_member(group, request.user):
            if not group.is_public:
                return _group_not_found_response()
            return Response({
                'success': False,
                'error': '그룹 멤버만 조회할 수 있습니다.'
            }, status=status.HTTP_403_FORBIDDEN)

        # 조회 플랜 선택
        selected_plan = None
        if plan_id:
            try:
                plan_id = int(plan_id)
            except (TypeError, ValueError):
                return Response({
                    'success': False,
                    'error': 'plan_id는 숫자여야 합니다.'
                }, status=status.HTTP_400_BAD_REQUEST)

            selected_plan = group.plans.filter(id=plan_id, is_active=True).first()
            if not selected_plan:
                return Response({
                    'success': False,
                    'error': '그룹에 포함되지 않은 플랜입니다.'
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            selected_plan = group.plans.filter(is_active=True).first()

        if not selected_plan:
            return Response({
                'success': False,
                'error': '그룹에 설정된 플랜이 없습니다.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 월 범위 계산
        _, last_day = monthrange(year, month)
        start_date = date(year, month, 1)
        end_date = date(year, month, last_day)

        # 해당 월의 스케줄 조회
        schedules = DailyBibleSchedule.objects.filter(
            plan=selected_plan,
            date__range=[start_date, end_date]
        ).order_by('date', 'id')

        # Pagination parameters for members
        offset = 0
        limit = MAX_GROUP_MEMBERS_PER_REQUEST
        
        raw_offset = request.query_params.get('offset')
        if raw_offset is not None:
            try:
                offset = int(raw_offset)
                if offset < 0:
                    return Response({
                        'success': False,
                        'error': 'offset은 0 이상이어야 합니다.'
                    }, status=status.HTTP_400_BAD_REQUEST)
            except (TypeError, ValueError):
                return Response({
                    'success': False,
                    'error': 'offset은 숫자여야 합니다.'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        raw_limit = request.query_params.get('limit')
        if raw_limit is not None:
            try:
                limit = int(raw_limit)
                if limit < 1:
                    return Response({
                        'success': False,
                        'error': 'limit은 1 이상이어야 합니다.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                if limit > MAX_GROUP_MEMBERS_PER_REQUEST:
                    return Response({
                        'success': False,
                        'error': f'limit은 {MAX_GROUP_MEMBERS_PER_REQUEST} 이하여야 합니다.'
                    }, status=status.HTTP_400_BAD_REQUEST)
            except (TypeError, ValueError):
                return Response({
                    'success': False,
                    'error': 'limit은 숫자여야 합니다.'
                }, status=status.HTTP_400_BAD_REQUEST)

        # 활성 멤버 조회 (총 개수와 페이지네이션된 결과)
        all_memberships = GroupMembership.objects.filter(
            live_user_filter('user__'),
            group=group,
            is_active=True,
        ).filter(
            _profile_visible_membership_q(request.user)
        ).select_related('user').order_by('joined_at')
        total_members = all_memberships.count()
        memberships = list(all_memberships[offset:offset + limit])
        member_ids = [membership.user_id for membership in memberships]

        # 멤버의 활성 구독 조회 (해당 플랜)
        subscriptions = PlanSubscription.objects.filter(
            user_id__in=member_ids,
            plan=selected_plan,
            is_active=True
        )

        subscription_map = {subscription.user_id: subscription.id for subscription in subscriptions}
        subscription_ids = list(subscription_map.values())

        schedule_ids = [schedule.id for schedule in schedules]

        # 완료 진도 조회
        completed_progress = set()
        if subscription_ids and schedule_ids:
            progress_rows = UserBibleProgress.objects.filter(
                subscription_id__in=subscription_ids,
                schedule_id__in=schedule_ids,
                is_completed=True
            ).values_list('subscription__user_id', 'schedule_id')
            completed_progress = set(progress_rows)

        # 날짜별 캘린더 데이터 구성
        calendar_data = {}
        for schedule in schedules:
            date_str = schedule.date.isoformat()
            members_data = []
            completed_count = 0

            for membership in memberships:
                user = membership.user
                subscription_id = subscription_map.get(user.id)
                is_completed = False

                if subscription_id:
                    is_completed = (user.id, schedule.id) in completed_progress

                if is_completed:
                    completed_count += 1

                members_data.append({
                    'id': user.id,
                    'nickname': user.nickname,
                    'profile_image': user.profile_image,
                    'is_completed': is_completed
                })

            calendar_data[date_str] = {
                'schedule': {
                    'book': schedule.book,
                    'start_chapter': schedule.start_chapter,
                    'end_chapter': schedule.end_chapter
                },
                'total_members': len(members_data),
                'completed_count': completed_count,
                'members': members_data
            }

        return Response({
            'success': True,
            'plan': {
                'id': selected_plan.id,
                'name': selected_plan.name
            },
            'meta': {
                'year': year,
                'month': month,
                'total_members': total_members,
                'offset': offset,
                'limit': limit,
                'returned_members': len(memberships),
                'has_more': (offset + len(memberships)) < total_members
            },
            'calendar': calendar_data
        })
    except Exception as e:
        logger.error(f"Error getting group member progress: {str(e)}")
        return _group_read_error_response()
