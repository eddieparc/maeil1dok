"""Owner-only summary of a plan subscription, separate from plan administration."""

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from authz import can, subject_from_request
from authz.policies.plan_subscription import PlanSubscriptionResource
from todos.services.plan_summary_service import get_plan_summary


class PlanSummarySerializer(serializers.Serializer):
    completed_days = serializers.IntegerField(
        min_value=0,
        help_text='Distinct dates where every scheduled row is complete for this subscription.',
    )
    total_days = serializers.IntegerField(
        min_value=0,
        help_text='All distinct scheduled dates in the plan, including past and future dates.',
    )
    percent = serializers.FloatField(
        min_value=0, max_value=100,
        help_text='Completed days / total days * 100, rounded to two decimals; zero if empty.',
    )


@extend_schema(
    operation_id='todos_plan_summary_retrieve',
    description=(
        'Whole-plan summary owned by the authenticated user. The path id is a '
        'PlanSubscription.id (subscriptions[].id from /plans/user/), not a '
        'BibleReadingPlan.id; it is the same resource ID used by /plan/{id}/ '
        'delete and toggle-active. Hidden subscriptions and inactive plans remain readable.'
    ),
    parameters=[OpenApiParameter(
        'id', int, location=OpenApiParameter.PATH, required=True,
        description='Owned PlanSubscription ID, not the reading plan ID.',
    )],
    responses={
        200: PlanSummarySerializer,
        401: OpenApiResponse(description='Authentication required.'),
        404: OpenApiResponse(description='Subscription missing or owned by another user.'),
    },
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def plan_summary(request, pk):
    decision = can(
        subject_from_request(request),
        'view_subscription',
        PlanSubscriptionResource(subscription_id=pk),
    )
    if not decision:
        return Response(decision.denial.body, status=decision.denial.status_code)
    return Response(PlanSummarySerializer(get_plan_summary(decision.value)).data)
