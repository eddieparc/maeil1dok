from calendar import monthrange
from datetime import date
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.db.models import Q, Count
from django.utils import timezone
from accounts.models import User
from accounts.serializers import UserSearchSerializer
from .models import (
    ReadingGroup, GroupMembership, GroupInvitation, BibleReadingPlan,
    DailyBibleSchedule, UserBibleProgress, PlanSubscription
)
from .serializers import BibleReadingPlanSerializer
import logging

logger = logging.getLogger(__name__)


class ReadingGroupSerializer:
    """그룹 시리얼라이저 (간단 구현)"""
    @staticmethod
    def to_dict(group, request=None):
        data = {
            'id': group.id,
            'name': group.name,
            'description': group.description,
            'creator': {
                'id': group.creator.id,
                'nickname': group.creator.nickname,
                'profile_image': group.creator.profile_image
            },
            'plans': BibleReadingPlanSerializer(group.plans.all(), many=True).data,
            'is_public': group.is_public,
            'max_members': group.max_members,
            'member_count': group.member_count,
            'is_full': group.is_full,
            'created_at': group.created_at,
            'updated_at': group.updated_at
        }

        # 로그인한 사용자의 멤버십 상태
        if request and request.user.is_authenticated:
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
        name = request.data.get('name')
        description = request.data.get('description', '')
        plan_ids = request.data.get('plan_ids', [])
        is_public = request.data.get('is_public', False)
        max_members = request.data.get('max_members', 50)

        # 필수 필드 검증
        if not name:
            return Response({
                'success': False,
                'error': '그룹 이름은 필수입니다.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not plan_ids or not isinstance(plan_ids, list) or len(plan_ids) == 0:
            return Response({
                'success': False,
                'error': '최소 1개 이상의 플랜을 선택해야 합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 플랜 확인
        plans = BibleReadingPlan.objects.filter(id__in=plan_ids, is_active=True)
        if plans.count() != len(plan_ids):
            return Response({
                'success': False,
                'error': '유효하지 않은 플랜 ID가 포함되어 있습니다.'
            }, status=status.HTTP_400_BAD_REQUEST)

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
    except Exception as e:
        logger.error(f"Error creating group: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
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
        
        # 기본 쿼리셋
        groups = ReadingGroup.objects.all()
        
        # 검색
        if search:
            groups = groups.filter(
                Q(name__icontains=search) | Q(description__icontains=search)
            )
        
        # 플랜 필터 (plans는 ManyToMany이므로 plans__id로 조회)
        if plan_id:
            groups = groups.filter(plans__id=plan_id)
        
        # 공개 그룹만
        if only_public or not request.user.is_authenticated:
            groups = groups.filter(is_public=True)
        
        # 내 그룹만
        if only_mine and request.user.is_authenticated:
            groups = groups.filter(
                memberships__user=request.user,
                memberships__is_active=True
            ).distinct()

        # 정렬 (distinct 이후에 정렬)
        groups = groups.distinct().order_by('-created_at')[:50]
        
        # 시리얼라이즈
        groups_data = [ReadingGroupSerializer.to_dict(group, request) for group in groups]
        
        return Response({
            'success': True,
            'groups': groups_data,
            'total': len(groups_data)
        })
    except Exception as e:
        logger.error(f"Error getting groups: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_group_detail(request, group_id):
    """그룹 상세 조회"""
    try:
        group = get_object_or_404(ReadingGroup, id=group_id)
        
        # 비공개 그룹이고 멤버가 아닌 경우
        if not group.is_public:
            if not request.user.is_authenticated:
                return Response({
                    'success': False,
                    'error': '비공개 그룹입니다.'
                }, status=status.HTTP_403_FORBIDDEN)
            
            is_member = GroupMembership.objects.filter(
                group=group,
                user=request.user,
                is_active=True
            ).exists()
            
            if not is_member:
                return Response({
                    'success': False,
                    'error': '그룹 멤버만 조회할 수 있습니다.'
                }, status=status.HTTP_403_FORBIDDEN)
        
        return Response({
            'success': True,
            'group': ReadingGroupSerializer.to_dict(group, request)
        })
    except Exception as e:
        logger.error(f"Error getting group detail: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_group(request, group_id):
    """그룹 가입"""
    try:
        group = get_object_or_404(ReadingGroup, id=group_id)
        
        # 이미 멤버인지 확인
        existing_membership = GroupMembership.objects.filter(
            group=group,
            user=request.user
        ).first()
        
        if existing_membership:
            if existing_membership.is_active:
                return Response({
                    'success': False,
                    'error': '이미 그룹 멤버입니다.'
                }, status=status.HTTP_400_BAD_REQUEST)
            else:
                # 비활성 멤버십 재활성화
                existing_membership.is_active = True
                existing_membership.save()
                return Response({
                    'success': True,
                    'message': '그룹에 다시 가입했습니다.'
                })
        
        # 그룹이 가득 찼는지 확인
        if group.is_full:
            return Response({
                'success': False,
                'error': '그룹이 가득 찼습니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 비공개 그룹은 초대가 필요
        if not group.is_public:
            invitation = GroupInvitation.objects.filter(
                group=group,
                invitee=request.user,
                status='pending'
            ).first()
            
            if not invitation:
                return Response({
                    'success': False,
                    'error': '비공개 그룹은 초대가 필요합니다.'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # 초대 수락 처리
            invitation.status = 'accepted'
            invitation.responded_at = timezone.now()
            invitation.save()
        
        # 멤버십 생성
        membership = GroupMembership.objects.create(
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
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def leave_group(request, group_id):
    """그룹 탈퇴"""
    try:
        group = get_object_or_404(ReadingGroup, id=group_id)
        
        membership = GroupMembership.objects.filter(
            group=group,
            user=request.user,
            is_active=True
        ).first()
        
        if not membership:
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
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_group_members(request, group_id):
    """그룹 멤버 목록 조회"""
    try:
        group = get_object_or_404(ReadingGroup, id=group_id)
        
        # 비공개 그룹이고 멤버가 아닌 경우
        if not group.is_public:
            if not request.user.is_authenticated:
                return Response({
                    'success': False,
                    'error': '비공개 그룹입니다.'
                }, status=status.HTTP_403_FORBIDDEN)
            
            is_member = GroupMembership.objects.filter(
                group=group,
                user=request.user,
                is_active=True
            ).exists()
            
            if not is_member:
                return Response({
                    'success': False,
                    'error': '그룹 멤버만 조회할 수 있습니다.'
                }, status=status.HTTP_403_FORBIDDEN)
        
        # 멤버 목록 조회
        memberships = GroupMembership.objects.filter(
            group=group,
            is_active=True
        ).select_related('user').order_by('-joined_at')
        
        members = []
        for membership in memberships:
            members.append({
                'user': UserSearchSerializer(membership.user, context={'request': request}).data,
                'role': membership.get_role_display(),
                'joined_at': membership.joined_at
            })
        
        return Response({
            'success': True,
            'members': members,
            'total': len(members)
        })
    except Exception as e:
        logger.error(f"Error getting group members: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invite_to_group(request, group_id):
    """그룹 초대"""
    try:
        group = get_object_or_404(ReadingGroup, id=group_id)
        invitee_id = request.data.get('user_id')
        message = request.data.get('message', '')
        
        if not invitee_id:
            return Response({
                'success': False,
                'error': '초대할 사용자 ID가 필요합니다.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 권한 확인 (관리자만 초대 가능)
        membership = GroupMembership.objects.filter(
            group=group,
            user=request.user,
            is_active=True
        ).first()
        
        if not membership or membership.role != 'admin':
            return Response({
                'success': False,
                'error': '관리자만 초대할 수 있습니다.'
            }, status=status.HTTP_403_FORBIDDEN)
        
        invitee = get_object_or_404(User, id=invitee_id)
        
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
        
        # 초대 생성
        invitation = GroupInvitation.objects.create(
            group=group,
            inviter=request.user,
            invitee=invitee,
            message=message,
            status='pending'
        )
        
        return Response({
            'success': True,
            'message': '초대를 보냈습니다.'
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"Error inviting to group: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_invitations(request):
    """내 초대 목록 조회"""
    try:
        invitations = GroupInvitation.objects.filter(
            invitee=request.user,
            status='pending'
        ).select_related('group', 'inviter').order_by('-created_at')
        
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
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def respond_to_invitation(request, invitation_id):
    """초대 응답"""
    try:
        invitation = get_object_or_404(
            GroupInvitation,
            id=invitation_id,
            invitee=request.user,
            status='pending'
        )
        
        action = request.data.get('action')  # accept or decline
        
        if action not in ['accept', 'decline']:
            return Response({
                'success': False,
                'error': '유효한 액션이 아닙니다. (accept/decline)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        invitation.responded_at = timezone.now()
        
        if action == 'accept':
            # 그룹이 가득 찼는지 확인
            if invitation.group.is_full:
                return Response({
                    'success': False,
                    'error': '그룹이 가득 찼습니다.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 멤버십 생성
            GroupMembership.objects.create(
                group=invitation.group,
                user=request.user,
                role='member',
                is_active=True
            )
            
            invitation.status = 'accepted'
            invitation.save()
            
            return Response({
                'success': True,
                'message': '초대를 수락했습니다.',
                'group': ReadingGroupSerializer.to_dict(invitation.group, request)
            })
        else:
            invitation.status = 'declined'
            invitation.save()

            return Response({
                'success': True,
                'message': '초대를 거절했습니다.'
            })
    except Exception as e:
        logger.error(f"Error responding to invitation: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_user_public_groups(request, user_id):
    """특정 사용자의 프로필에 표시된 그룹 조회"""
    try:
        from accounts.models import UserProfile

        user = get_object_or_404(User, id=user_id)

        # 프로필 공개 여부 확인
        profile = UserProfile.objects.filter(user=user).first()
        if profile and not profile.is_public:
            if not request.user.is_authenticated or request.user != user:
                return Response({
                    'success': False,
                    'error': '비공개 프로필입니다.'
                }, status=status.HTTP_403_FORBIDDEN)

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

        groups = groups.order_by('-created_at')[:50]
        groups_data = [ReadingGroupSerializer.to_dict(g, request) for g in groups]

        return Response({
            'success': True,
            'groups': groups_data,
            'total': len(groups_data)
        })
    except Exception as e:
        logger.error(f"Error getting user public groups: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_group_visibility(request, group_id):
    """프로필에서 그룹 표시 여부 설정"""
    try:
        membership = get_object_or_404(
            GroupMembership,
            group_id=group_id,
            user=request.user,
            is_active=True
        )

        show_in_profile = request.data.get('show_in_profile')
        if show_in_profile is not None:
            membership.show_in_profile = show_in_profile
            membership.save()

        return Response({
            'success': True,
            'show_in_profile': membership.show_in_profile,
            'message': '프로필 표시 설정이 변경되었습니다.'
        })
    except Exception as e:
        logger.error(f"Error updating group visibility: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_group_member_progress(request, group_id):
    """그룹 멤버별 월별 진도 조회 (달력 뷰용)"""
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

        try:
            group = ReadingGroup.objects.prefetch_related('plans').get(id=group_id)
        except ReadingGroup.DoesNotExist:
            return Response({
                'success': False,
                'error': '그룹을 찾을 수 없습니다.'
            }, status=status.HTTP_404_NOT_FOUND)

        # 비공개 그룹 접근 제어
        if not group.is_public:
            if not request.user.is_authenticated:
                return Response({
                    'success': False,
                    'error': '비공개 그룹입니다.'
                }, status=status.HTTP_403_FORBIDDEN)

            is_member = GroupMembership.objects.filter(
                group=group,
                user=request.user,
                is_active=True
            ).exists()

            if not is_member:
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

            selected_plan = group.plans.filter(id=plan_id).first()
            if not selected_plan:
                return Response({
                    'success': False,
                    'error': '그룹에 포함되지 않은 플랜입니다.'
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            selected_plan = group.plans.first()

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

        # 활성 멤버 조회
        memberships = GroupMembership.objects.filter(
            group=group,
            is_active=True
        ).select_related('user').order_by('joined_at')

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
                'total_members': len(member_ids)
            },
            'calendar': calendar_data
        })
    except Exception as e:
        logger.error(f"Error getting group member progress: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
