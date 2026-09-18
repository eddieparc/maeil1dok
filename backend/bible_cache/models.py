from django.db import models


class BibleContentCache(models.Model):
    """
    성경 본문 캐시 모델

    bskorea.or.kr에서 가져온 성경 본문을 캐싱하여
    원본 서버 장애 시 failback으로 사용
    """

    CONTENT_TYPE_CHOICES = [
        ('html', 'HTML'),
        ('json', 'JSON'),
    ]

    # 캐시 키 (고유 식별자)
    cache_key = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="캐시 키 (version:book:chapter 형식)"
    )

    # 성경 메타데이터
    version = models.CharField(
        max_length=20,
        db_index=True,
        help_text="번역본 (GAE, KNT, HAN, SAE, SAENEW, COG, COGNEW)"
    )
    book = models.CharField(
        max_length=10,
        db_index=True,
        help_text="성경책 코드 (gen, exo, mat 등)"
    )
    chapter = models.IntegerField(
        help_text="장 번호"
    )

    # 캐시된 콘텐츠
    content = models.TextField(
        help_text="원본 HTML/JSON 콘텐츠"
    )
    search_text = models.TextField(
        blank=True,
        default='',
        help_text="검색용 정규화 평문 (태그·결합문자·공백 정규화 적용)"
    )
    content_type = models.CharField(
        max_length=10,
        choices=CONTENT_TYPE_CHOICES,
        default='html',
        help_text="콘텐츠 타입"
    )

    # 메타 정보
    source_url = models.URLField(
        max_length=500,
        blank=True,
        help_text="원본 URL"
    )
    fetch_success = models.BooleanField(
        default=True,
        help_text="마지막 fetch 성공 여부"
    )

    # 타임스탬프
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['version', 'book', 'chapter']
        indexes = [
            models.Index(fields=['version', 'book', 'chapter']),
        ]
        verbose_name = '성경 본문 캐시'
        verbose_name_plural = '성경 본문 캐시'

    def __str__(self):
        return f"{self.version}:{self.book}:{self.chapter}"

    @classmethod
    def generate_cache_key(cls, version: str, book: str, chapter: int) -> str:
        """캐시 키 생성"""
        return f"{version}:{book.lower()}:{chapter}"

    @classmethod
    def get_cached_content(cls, version: str, book: str, chapter: int):
        """캐시에서 콘텐츠 조회"""
        cache_key = cls.generate_cache_key(version, book, chapter)
        try:
            return cls.objects.get(cache_key=cache_key)
        except cls.DoesNotExist:
            return None

    @classmethod
    def save_to_cache(
        cls,
        version: str,
        book: str,
        chapter: int,
        content: str,
        content_type: str = 'html',
        source_url: str = '',
        fetch_success: bool = True
    ):
        """캐시에 콘텐츠 저장 (upsert)"""
        cache_key = cls.generate_cache_key(version, book, chapter)

        from bible_cache.text_utils import search_text_for_content

        obj, created = cls.objects.update_or_create(
            cache_key=cache_key,
            defaults={
                'version': version,
                'book': book.lower(),
                'chapter': chapter,
                'content': content,
                'search_text': search_text_for_content(content),
                'content_type': content_type,
                'source_url': source_url,
                'fetch_success': fetch_success,
            }
        )
        return obj, created
