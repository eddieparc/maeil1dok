from rest_framework import serializers


class BibleContentDataSerializer(serializers.Serializer):
    version = serializers.CharField()
    book = serializers.CharField()
    chapter = serializers.IntegerField()
    content = serializers.CharField()
    content_type = serializers.CharField()
    from_cache = serializers.BooleanField()


class BibleContentResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    data = BibleContentDataSerializer()


class BibleCacheStatusResponseSerializer(serializers.Serializer):
    cached = serializers.BooleanField()
    updated_at = serializers.DateTimeField(required=False)
    fetch_success = serializers.BooleanField(required=False)
    content_type = serializers.CharField(required=False)


class SupportedVersionSerializer(serializers.Serializer):
    code = serializers.CharField()
    name = serializers.CharField()


class SupportedVersionsResponseSerializer(serializers.Serializer):
    versions = SupportedVersionSerializer(many=True)


class BibleCacheSearchResultSerializer(serializers.Serializer):
    version = serializers.CharField()
    book = serializers.CharField()
    chapter = serializers.IntegerField()
    verse = serializers.IntegerField()
    snippet = serializers.CharField()
    updated_at = serializers.DateTimeField()


class BibleCacheSearchResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    query = serializers.CharField()
    count = serializers.IntegerField()
    results = BibleCacheSearchResultSerializer(many=True)


class BibleCacheErrorResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    error = serializers.CharField()
    supported_versions = serializers.ListField(
        child=serializers.CharField(),
        required=False,
    )
    fallback_url = serializers.URLField(required=False)
