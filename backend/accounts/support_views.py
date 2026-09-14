"""Anonymous/member support creation, with no read or delivery surface."""
import logging

from django.db import DatabaseError
from drf_spectacular.utils import OpenApiResponse, OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.services.support_inquiries import receive_inquiry
from accounts.support_serializers import (
    SupportInquiryErrorSerializer, SupportInquiryReceiptSerializer, SupportInquiryRequestSerializer,
)
from accounts.support_throttles import SupportInquiryPeerThrottle, SupportInquiryThrottle

logger = logging.getLogger(__name__)


class SupportInquiryView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]
    throttle_classes = [SupportInquiryThrottle, SupportInquiryPeerThrottle]
    http_method_names = ['post', 'options']

    @extend_schema(
        operation_id='support_inquiries_create',
        tags=['support'],
        description=(
            'Persist an inquiry from an anonymous visitor or authenticated member. '
            'The receipt acknowledges database storage only, not email delivery or a reply. '
            'Cookie-authenticated requests require the existing CSRF header. '
            'Unknown fields, including caller-supplied user identity, are rejected.'
        ),
        request=SupportInquiryRequestSerializer,
        responses={
            201: SupportInquiryReceiptSerializer,
            400: OpenApiResponse(OpenApiTypes.OBJECT, description='Invalid JSON or field validation errors.'),
            401: SupportInquiryErrorSerializer,
            405: SupportInquiryErrorSerializer,
            415: SupportInquiryErrorSerializer,
            429: OpenApiResponse(SupportInquiryErrorSerializer, description='Intake limit reached; Retry-After header in seconds.'),
            503: OpenApiResponse(SupportInquiryErrorSerializer, description='Storage failed; no receipt was issued.'),
        },
    )
    def post(self, request):
        serializer = SupportInquiryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            inquiry = receive_inquiry(user=request.user, **serializer.validated_data)
        except DatabaseError:
            logger.exception('Support inquiry persistence failed')
            return Response({'detail': 'Unable to store inquiry. Please try again.'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(SupportInquiryReceiptSerializer(inquiry).data,
                        status=status.HTTP_201_CREATED)
