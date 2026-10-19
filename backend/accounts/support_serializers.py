"""Write-only support intake and a minimal persistence receipt."""
from collections.abc import Mapping

from rest_framework import serializers

from accounts.models import SupportInquiry


class SupportInquiryRequestSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=SupportInquiry.Kind.choices)
    message = serializers.CharField(min_length=1, max_length=2000, trim_whitespace=True)
    email = serializers.EmailField(
        max_length=254, required=False, allow_blank=True, default='', source='reply_email',
    )

    def to_internal_value(self, data):
        if isinstance(data, Mapping):
            unknown = data.keys() - self.fields.keys()
            if unknown:
                raise serializers.ValidationError({field: ['Unknown field.'] for field in sorted(unknown)})
        return super().to_internal_value(data)


class SupportInquiryReceiptSerializer(serializers.Serializer):
    receipt_id = serializers.UUIDField(source='pk', read_only=True)
    status = serializers.ChoiceField(choices=SupportInquiry.Status.choices, read_only=True)


class SupportInquiryErrorSerializer(serializers.Serializer):
    detail = serializers.CharField(read_only=True)
