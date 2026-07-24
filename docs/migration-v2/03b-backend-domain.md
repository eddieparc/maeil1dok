# 매일일독 백엔드 도메인 사양서 (Domain Specification)

본 문서는 매일일독(Maeil1Dok) 프로젝트 백엔드 마이그레이션 v2를 위하여 Django 백엔드의 데이터베이스 모델, 시그널(Signals), 어드민(Admin), 설정(Settings), 환경변수, 외부 API 연동 사양을 전수 조사하여 정리한 공식 사양서입니다.

---

## 섹션 A: 모델 전수 (Database Schema)

모든 데이터베이스 모델은 MariaDB/MySQL 8.0을 타겟으로 설계되었습니다. `__str__` 또는 meta 메타데이터와 FK 대상을 명확히 정리합니다.

### 1. `accounts` 앱 모델 사양

| 모델 | 파일:라인 | db_table | 주요 필드 (타입) | FK 대상 | unique/indexed | __str__ 또는 meta |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `User` | `accounts/models.py:8` | `accounts_user` | `nickname` (CharField)<br>`is_social` (BooleanField)<br>`social_provider` (CharField)<br>`social_id` (CharField)<br>`profile_image` (URLField)<br>`email` (EmailField)<br>`has_usable_password_flag` (BooleanField)<br>`email_verified` (BooleanField)<br>`token_version` (PositiveIntegerField)<br>`scheduled_deletion_at` (DateTimeField)<br>`merged_into` (ForeignKey) | `self` (merged_into) | `nickname` (Unique)<br>`username` (Unique) | `USERNAME_FIELD = 'username'`<br>`REQUIRED_FIELDS = ['nickname']` |
| `SocialAccount` | `accounts/models.py:69` | `accounts_socialaccount` | `user` (ForeignKey)<br>`provider` (CharField)<br>`provider_id` (CharField)<br>`email` (EmailField)<br>`profile_image` (URLField)<br>`access_token` (TextField)<br>`refresh_token` (TextField)<br>`token_expires_at` (DateTimeField)<br>`extra_data` (JSONField) | `User` | `provider` + `provider_id` (Unique)<br>`user` + `provider` (Index)<br>`provider` + `provider_id` (Index) | `__str__`: nickname + provider display<br>`ordering = ['-created_at']` |
| `UserProfile` | `accounts/models.py:125` | `accounts_userprofile` | `user` (OneToOneField)<br>`bio` (TextField)<br>`total_completed_days` (IntegerField)<br>`current_streak` (IntegerField)<br>`longest_streak` (IntegerField)<br>`joined_date` (DateTimeField)<br>`is_public` (BooleanField) | `User` | `user` (Unique, OneToOne) | `__str__`: nickname's Profile<br>`ordering = ['-total_completed_days']` |
| `Follow` | `accounts/models.py:146` | `accounts_follow` | `follower` (ForeignKey)<br>`following` (ForeignKey)<br>`created_at` (DateTimeField) | `User` (follower)<br>`User` (following) | `follower` + `following` (Unique)<br>`follower` + `-created_at` (Index)<br>`following` + `-created_at` (Index) | `__str__`: follower follows following<br>`ordering = ['-created_at']` |
| `UserAchievement` | `accounts/models.py:172` | `accounts_userachievement` | `user` (ForeignKey)<br>`achievement_type` (CharField)<br>`achieved_at` (DateTimeField)<br>`milestone_value` (IntegerField)<br>`details` (JSONField) | `User` | `user` + `achievement_type` (Unique) | `__str__`: nickname - achievement display<br>`ordering = ['-achieved_at']` |
| `UserReadingSettings` | `accounts/models.py:208` | `accounts_userreadingsettings` | `user` (OneToOneField)<br>`theme` (CharField)<br>`font_family` (CharField)<br>`font_size` (IntegerField)<br>`font_weight` (CharField)<br>`line_height` (FloatField)<br>`text_align` (CharField)<br>`verse_joining` (BooleanField)<br>`show_verse_numbers` (BooleanField)<br>`show_description` (BooleanField)<br>`show_cross_ref` (BooleanField)<br>`highlight_names` (BooleanField)<br>`show_footnotes` (BooleanField)<br>`tongdok_auto_complete` (BooleanField) | `User` | `user` (Unique, OneToOne) | `__str__`: nickname의 읽기 설정<br>`verbose_name = '읽기 설정'` |
| `EmailVerificationToken` | `accounts/models.py:324` | `accounts_emailverificationtoken` | `user` (ForeignKey)<br>`token` (CharField)<br>`email` (EmailField)<br>`created_at` (DateTimeField)<br>`expires_at` (DateTimeField)<br>`is_used` (BooleanField) | `User` | `token` (Unique, Index)<br>`user` + `-created_at` (Index) | `__str__`: Email verification for email<br>`ordering = ['-created_at']` |
| `PasswordResetToken` | `accounts/models.py:387` | `accounts_passwordresettoken` | `user` (ForeignKey)<br>`token` (CharField)<br>`created_at` (DateTimeField)<br>`expires_at` (DateTimeField)<br>`is_used` (BooleanField) | `User` | `token` (Unique, Index)<br>`user` + `-created_at` (Index) | `__str__`: Password reset for user email<br>`ordering = ['-created_at']` |

### 2. `todos` 앱 모델 사양

| 모델 | 파일:라인 | db_table | 주요 필드 (타입) | FK 대상 | unique/indexed | __str__ 또는 meta |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `BibleReadingPlan` | `todos/models.py:7` | `todos_biblereadingplan` | `name` (CharField)<br>`description` (TextField)<br>`is_default` (BooleanField)<br>`is_active` (BooleanField)<br>`created_by` (ForeignKey) | `User` | `created_by` (Index) | `__str__`: name |
| `PlanSubscription` | `todos/models.py:32` | `todos_plansubscription` | `user` (ForeignKey)<br>`plan` (ForeignKey)<br>`start_date` (DateField)<br>`is_active` (BooleanField) | `User`<br>`BibleReadingPlan` | `user` + `plan` (Unique) | `__str__`: user username's subscription to plan name |
| `DailyBibleSchedule` | `todos/models.py:47` | `todos_dailybibleschedule` | `plan` (ForeignKey)<br>`date` (DateField)<br>`book` (CharField)<br>`start_chapter` (IntegerField)<br>`end_chapter` (IntegerField)<br>`audio_link` (URLField)<br>`guide_link` (URLField) | `BibleReadingPlan` | `plan` + `date` (Index)<br>`plan` + `date` + `book` (Logic Unique) | `__str__`: plan name - date: book start-end장<br>`ordering = ['date']` |
| `UserBibleProgress` | `todos/models.py:85` | `todos_userbibleprogress` | `subscription` (ForeignKey)<br>`schedule` (ForeignKey)<br>`is_completed` (BooleanField)<br>`completed_at` (DateTimeField) | `PlanSubscription`<br>`DailyBibleSchedule` | `subscription` + `is_completed` (Index) | `@property status`: completed / in_progress |
| `VideoBibleIntro` | `todos/models.py:129` | `todos_videobibleintro` | `plan` (ForeignKey)<br>`book` (CharField)<br>`url_link` (URLField)<br>`start_date` (DateField)<br>`end_date` (DateField) | `BibleReadingPlan` | `plan` + `book` (Unique) | `__str__`: plan name - book 개론 (range)<br>`ordering = ['start_date']` |
| `UserVideoIntroProgress` | `todos/models.py:165` | `todos_uservideointroprogress` | `user` (ForeignKey)<br>`video_intro` (ForeignKey)<br>`is_completed` (BooleanField)<br>`completed_at` (DateTimeField) | `User`<br>`VideoBibleIntro` | `user` + `video_intro` (Unique) | `__str__`: username의 book 개론 - status |
| `HasenaRecord` | `todos/models.py:196` | `todos_hasenarecord` | `user` (ForeignKey)<br>`date` (DateField)<br>`is_completed` (BooleanField) | `User` | `user` + `date` (Unique) | `__str__`: username의 하세나 기록 - date<br>`ordering = ['-date']` |
| `HasenaSummary` | `todos/models.py:211` | `todos_hasenasummary` | `video_id` (CharField)<br>`video_date` (DateField)<br>`title` (CharField)<br>`summary` (TextField)<br>`transcript` (TextField)<br>`model_used` (CharField)<br>`is_edited` (BooleanField) | None | `video_id` (Unique, Index) | `__str__`: [video_date] video_id<br>`ordering = ['-video_date', '-created_at']` |
| `VisitorCount` | `todos/models.py:231` | `todos_visitorcount` | `date` (DateField)<br>`daily_count` (PositiveIntegerField) | None | `date` (Unique) | `__str__`: date: count visitors<br>`ordering = ['-date']` |
| `ReadingGroup` | `todos/models.py:265` | `todos_readinggroup` | `name` (CharField)<br>`description` (TextField)<br>`creator` (ForeignKey)<br>`plans` (ManyToManyField)<br>`is_public` (BooleanField)<br>`max_members` (IntegerField) | `User` (creator) | `is_public` (Index)<br>`creator` + `-created_at` (Index) | `__str__`: name (plan_names)<br>`ordering = ['-created_at']` |
| `GroupMembership` | `todos/models.py:306` | `todos_groupmembership` | `group` (ForeignKey)<br>`user` (ForeignKey)<br>`role` (CharField)<br>`joined_at` (DateTimeField)<br>`is_active` (BooleanField)<br>`show_in_profile` (BooleanField) | `ReadingGroup`<br>`User` | `group` + `user` (Unique)<br>`group` + `is_active` (Index)<br>`user` + `is_active` (Index) | `__str__`: nickname in group name as role<br>`ordering = ['-joined_at']` |
| `GroupInvitation` | `todos/models.py:347` | `todos_groupinvitation` | `group` (ForeignKey)<br>`inviter` (ForeignKey)<br>`invitee` (ForeignKey)<br>`status` (CharField)<br>`message` (TextField)<br>`created_at` (DateTimeField)<br>`responded_at` (DateTimeField) | `ReadingGroup`<br>`User` (inviter)<br>`User` (invitee) | `group` + `invitee` (Unique) | `__str__`: Invitation to invitee for group<br>`ordering = ['-created_at']` |
| `UserPlanDisplaySettings` | `todos/models.py:388` | `todos_userplandisplaysettings` | `user` (ForeignKey)<br>`subscription` (OneToOneField)<br>`color` (CharField)<br>`display_order` (IntegerField)<br>`is_visible` (BooleanField) | `User`<br>`PlanSubscription` | `subscription` (Unique, OneToOne)<br>`user` + `is_visible` (Index) | `__str__`: user nickname's settings for subscription plan<br>`ordering = ['display_order', 'created_at']` |
| `UserReadingPosition` | `todos/models.py:428` | `todos_userreadingposition` | `user` (OneToOneField)<br>`book` (CharField)<br>`chapter` (IntegerField)<br>`verse` (IntegerField)<br>`scroll_position` (FloatField)<br>`version` (CharField) | `User` | `user` (Unique, OneToOne) | `__str__`: user nickname - book chapter<br>`verbose_name = "읽기 위치"` |
| `BibleBookmark` | `todos/models.py:450` | `todos_biblebookmark` | `user` (ForeignKey)<br>`bookmark_type` (CharField)<br>`book` (CharField)<br>`chapter` (IntegerField)<br>`start_verse` (IntegerField)<br>`end_verse` (IntegerField)<br>`title` (CharField)<br>`color` (CharField)<br>`memo` (TextField) | `User` | `user` + `book` + `chapter` (Unique conditional for 'chapter')<br>`user` + `book` + `chapter` + `start_verse` + `end_verse` (Unique conditional for 'verse')<br>`user` + `book` + `chapter` (Index)<br>`user` + `bookmark_type` (Index) | `__str__`: book chapter:verse or book chapter<br>`ordering = ['-created_at']` |
| `ReflectionNote` | `todos/models.py:502` | `todos_reflectionnote` | `user` (ForeignKey)<br>`book` (CharField)<br>`chapter` (IntegerField)<br>`start_verse` (IntegerField)<br>`end_verse` (IntegerField)<br>`content` (TextField)<br>`is_private` (BooleanField) | `User` | `user` + `book` + `chapter` (Index)<br>`user` + `-created_at` (Index) | `__str__`: nickname - book chapter<br>`ordering = ['-created_at']` |
| `BibleHighlight` | `todos/models.py:531` | `todos_biblehighlight` | `user` (ForeignKey)<br>`book` (CharField)<br>`chapter` (IntegerField)<br>`start_verse` (IntegerField)<br>`end_verse` (IntegerField)<br>`color` (CharField)<br>`memo` (TextField) | `User` | `user` + `book` + `chapter` (Index)<br>`user` + `-created_at` (Index) | `__str__`: nickname - book chapter:start_verse-end_verse<br>`ordering = ['-created_at']` |
| `PersonalReadingRecord` | `todos/models.py:560` | `todos_personalreadingrecord` | `user` (ForeignKey)<br>`book` (CharField)<br>`chapter` (IntegerField)<br>`read_date` (DateField) | `User` | `user` + `book` + `chapter` (Unique)<br>`user` + `book` (Index)<br>`user` + `read_date` (Index) | `__str__`: nickname - book chapter<br>`unique_together = ['user', 'book', 'chapter']` |
| `CatchupSession` | `todos/models.py:585` | `todos_catchupsession` | `subscription` (ForeignKey)<br>`name` (CharField)<br>`range_start` (DateField)<br>`range_end` (DateField)<br>`strategy` (CharField)<br>`target_rejoin_date` (DateField)<br>`max_daily_readings` (IntegerField)<br>`max_daily_chapters` (IntegerField)<br>`weekend_multiplier` (DecimalField)<br>`status` (CharField)<br>`completed_at` (DateTimeField) | `PlanSubscription` | `subscription` + `status` (Index) | `__str__`: name (subscription plan name)<br>`ordering = ['-created_at']` |
| `CatchupSchedule` | `todos/models.py:693` | `todos_catchupschedule` | `session` (ForeignKey)<br>`original_schedule` (ForeignKey)<br>`scheduled_date` (DateField)<br>`is_completed` (BooleanField)<br>`completed_at` (DateTimeField) | `CatchupSession`<br>`DailyBibleSchedule` | `session` + `original_schedule` (Unique)<br>`session` + `scheduled_date` (Index)<br>`session` + `is_completed` (Index) | `__str__`: session name - book chapters (scheduled_date)<br>`ordering = ['scheduled_date', 'original_schedule__date']` |

### 3. `bible_cache` 앱 모델 사양

| 모델 | 파일:라인 | db_table | 주요 필드 (타입) | FK 대상 | unique/indexed | __str__ 또는 meta |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `BibleContentCache` | `bible_cache/models.py:4` | `bible_cache_biblecontentcache` | `cache_key` (CharField)<br>`version` (CharField)<br>`book` (CharField)<br>`chapter` (IntegerField)<br>`content` (TextField)<br>`content_type` (CharField)<br>`source_url` (URLField)<br>`fetch_success` (BooleanField) | None | `cache_key` (Unique, Index)<br>`version` (Index)<br>`book` (Index)<br>`version` + `book` + `chapter` (Index) | `__str__`: version:book:chapter<br>`ordering = ['version', 'book', 'chapter']` |

---

## 섹션 B: Signals (비즈니스 사이드이펙트)

데이터 생성 및 수정 시 자동으로 트리거되는 시그널 핸들러 목록과 등록 위치입니다.

| 시그널 | 트리거 | 핸들러 파일:라인 | 사이드이펙트 |
| :--- | :--- | :--- | :--- |
| `create_user_profile` | `User` 모델 `post_save` (신규 생성 시) | `accounts/signals.py:11` | 신규 회원가입 시 자동으로 해당 유저의 `UserProfile` 인스턴스를 기본값과 함께 생성 |
| `save_user_profile` | `User` 모델 `post_save` (수정 저장 시) | `accounts/signals.py:28` | 유저 인스턴스가 저장될 때 연결된 `UserProfile`도 함께 자동 동기화 저장 |
| `create_display_settings` | `PlanSubscription` 모델 `post_save` (구독 생성 시) | `todos/signals.py:9` | 신규 성경 읽기 플랜 구독 시 자동으로 캘린더 표시 색상 및 정렬 순서를 생성 (`PLAN_COLORS` 기반 로테이션 지정) |
| `update_stats_and_achievements` | `UserBibleProgress` 모델 `post_save` (`is_completed` 완료 설정 시) | `todos/signals.py:26` | 사용자가 성경 읽기를 완료 처리했을 때 프로필의 누적 통계(`total_completed_days`, streak 등)를 업데이트하고 달성한 업적(`UserAchievement`)을 검증 및 부여 |

### Signals 등록 위치 (apps.py)
- **`accounts` 앱**: `backend/accounts/apps.py:10`의 `ready()` 메소드에서 `import accounts.signals`을 통해 임포트 및 데코레이터 등록
- **`todos` 앱**: `backend/todos/apps.py:9`의 `ready()` 메소드에서 `import todos.signals`을 통해 임포트 및 데코레이터 등록

---

## 섹션 C: Admin (관리자 페이지 설정)

관리자 사이트에서 데이터를 제어하기 위한 커스텀 어드민 클래스 목록입니다.

| 모델 | admin 클래스 | 커스터마이즈 (list_display/actions/inlines 등) |
| :--- | :--- | :--- |
| `User` | `CustomUserAdmin` (in `accounts/admin.py:8`) | - `list_display`: `('email', 'username', 'is_active', 'date_joined')`<br>- `search_fields`: `('email', 'username')`<br>- `ordering`: `('-date_joined',)` |
| `CatchupSession` | `CatchupSessionAdmin` (in `todos/admin.py:12`) | - `list_display`: `['name', 'subscription', 'strategy', 'status', 'progress_percentage', 'created_at']`<br>- `list_filter`: `['status', 'strategy', 'created_at']`<br>- `search_fields`: `['name', 'subscription__user__username', 'subscription__plan__name']`<br>- `readonly_fields`: `['progress_percentage', 'completed_count', 'total_count', 'created_at', 'updated_at']`<br>- `inlines`: `[CatchupScheduleInline]`<br>- `fieldsets` 그룹 구조화 제공 (기본 정보, 범위, 전략, 읽기량, 진행 현황, 타임스탬프) |
| `CatchupSchedule` | `CatchupScheduleAdmin` (in `todos/admin.py:43`) | - `list_display`: `['session', 'original_schedule', 'scheduled_date', 'is_completed', 'completed_at']`<br>- `list_filter`: `['is_completed', 'scheduled_date', 'session__status']`<br>- `search_fields`: `['session__name', 'original_schedule__book']`<br>- `readonly_fields`: `['created_at', 'updated_at']` |
| `HasenaSummary` | `HasenaSummaryAdmin` (in `todos/admin.py:51`) | - `list_display`: `['video_id', 'video_date', 'title', 'is_edited', 'model_used', 'updated_at']`<br>- `list_filter`: `['is_edited', 'model_used', 'video_date']`<br>- `search_fields`: `['video_id', 'title', 'summary']`<br>- `readonly_fields`: `['created_at', 'updated_at']`<br>- `ordering`: `['-video_date', '-created_at']`<br>- `fieldsets`를 통한 텍스트 접기 지원 (`classes: ('collapse',)`)<br>- `actions`: `['regenerate_summary']` (선택한 하세나 영상 AI 요약 재생성 기능 제공) |
| `BibleContentCache` | `BibleContentCacheAdmin` (in `bible_cache/admin.py:5`) | - `list_display`: `['cache_key', 'version', 'book', 'chapter', 'content_type', 'fetch_success', 'updated_at']`<br>- `list_filter`: `['version', 'content_type', 'fetch_success']`<br>- `search_fields`: `['cache_key', 'book']`<br>- `readonly_fields`: `['cache_key', 'created_at', 'updated_at']`<br>- `ordering`: `['version', 'book', 'chapter']`<br>- `fieldsets` 구조화 및 콘텐츠 내용 접기 제공 (`classes: ('collapse',)`)|

---

## 섹션 D: settings.py 핵심 설정

`config/settings.py`에서 추출한 핵심 아키텍처 및 미들웨어 의존성 목록입니다.

### 1. `INSTALLED_APPS` (전체 목록)
```python
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'todos',

    # Local apps
    'accounts.apps.AccountsConfig',
    'bible_cache.apps.BibleCacheConfig',
]
```

### 2. `MIDDLEWARE` (전체 순서대로)
```python
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
```

### 3. `AUTHENTICATION_BACKENDS`
- 명시적으로 settings.py에 정의되어 있지 않아 Django 기본 DB Auth 백엔드가 사용됩니다.
- REST API 수준에서는 쿠키 및 JWT를 검증하는 커스텀 클래스(`accounts.authentication.CookieJWTAuthentication`)가 작동합니다.

### 4. `REST_FRAMEWORK` 설정 키들
- `DEFAULT_AUTHENTICATION_CLASSES` (HttpOnly Cookie 기반 인증용 커스텀 클래스 지정)
- `DEFAULT_PERMISSION_CLASSES`
- `DEFAULT_THROTTLE_CLASSES`
- `DEFAULT_THROTTLE_RATES` (익명 100회/시간, 유저 1000회/시간 제한)
- `DEFAULT_PAGINATION_CLASS`
- `PAGE_SIZE` (기본 50)

### 5. `SIMPLE_JWT` 설정 키들
- `ACCESS_TOKEN_LIFETIME` (1시간)
- `REFRESH_TOKEN_LIFETIME` (30일)
- `ROTATE_REFRESH_TOKENS` (True - 토큰 Refresh 시 새로운 Refresh 토큰 발급)
- `BLACKLIST_AFTER_ROTATION` (True - 이전 토큰 즉시 블랙리스트 처리)
- `AUTH_HEADER_TYPES` ('Bearer')
- `USER_ID_FIELD` ('id')
- `USER_ID_CLAIM` ('user_id')

### 6. `CORS` 설정 키들
- `CORS_ALLOWED_ORIGINS` (프로덕션 도메인 및 환경변수 주입, DEBUG 모드일 때 개발용 로컬 호스트 추가 포함)
- `CORS_ALLOW_METHODS`
- `CORS_ALLOW_HEADERS`
- `CORS_ALLOW_CREDENTIALS` (True - 인증용 쿠키 전달 허용)
- `CORS_EXPOSE_HEADERS` (x-csrftoken)

### 7. 캐시 및 세션 백엔드 종류
- **캐시 백엔드**: Redis 캐시 (`django.core.cache.backends.redis.RedisCache`)
  - Redis 서버 주소: `REDIS_URL` 환경변수 또는 기본값 `redis://redis:6379/1` 사용
- **세션 백엔드**: 별도 커스텀 설정이 없으므로 Django 기본 DB 세션 백엔드가 적용됩니다.

---

## 섹션 E: 환경변수 (Environment Variables)

### 1. `.env.example` 명세 및 용도

| 환경변수 키 | 기본/예시값 | 상세 용도 |
| :--- | :--- | :--- |
| `DB_NAME` | `dailybible` | 백엔드가 접속할 데이터베이스명 (MariaDB/MySQL) |
| `DB_USER` | `dailybible_user` | 데이터베이스 접속 계정명 |
| `DB_PASSWORD` | `your_db_password` | 데이터베이스 접속 비밀번호 |
| `DB_ROOT_PASSWORD` | `your_root_password` | MariaDB 루트 패스워드 (Docker DB 컨테이너용) |
| `DB_HOST` | `db` | 데이터베이스 서버 호스트명 (Docker 서비스명 'db') |
| `DB_PORT` | `3306` | 데이터베이스 포트 주소 |
| `BACKEND_SERVICE_PORT` | `8000` | 외부로 노출할 백엔드 Django 포트 번호 |
| `MYSQL_SERVICE_PORT` | `3306` | 외부로 노출할 MySQL/MariaDB 포트 번호 |
| `PHPMYADMIN_SERVICE_PORT` | `8080` | phpMyAdmin 컨테이너 접속용 포트 번호 |
| `DEBUG` | `True` | Django 디버그 모드 작동 여부 (True/False) |
| `SECRET_KEY` | `your_django_secret_key_here` | Django 세션, 쿠키 서명용 비밀 키 (유출 금지) |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,backend` | Django 접속 허용 호스트 목록 (쉼표 구분) |
| `CORS_ALLOWED_ORIGINS` | `["http://localhost:3000",...]` | CORS 허용 추가 오리진 목록 (JSON 배열 포맷) |
| `KAKAO_CLIENT_ID` | `your_kakao_client_id` | 카카오 OAuth 애플리케이션 REST API 키 |
| `KAKAO_REDIRECT_URI` | `http://localhost:3019/...` | 카카오 OAuth 인증 콜백 Redirect URI |
| `GOOGLE_CLIENT_ID` | `your_google_client_id` | 구글 OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | `your_google_client_secret` | 구글 OAuth 클라이언트 시크릿 키 |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3019/...` | 구글 OAuth 인증 콜백 Redirect URI |
| `RESEND_API_KEY` | `your_resend_api_key` | Resend 이메일 발송용 서비스 API 인증 키 |
| `FROM_EMAIL` | `noreply@yourdomain.com` | 발송 이메일 주소 (Resend 도메인 연동 필요) |
| `GEMINI_API_KEY` | `your_gemini_api_key` | 하세나 자막 요약용 Google Gemini API 키 |
| `YOUTUBE_API_KEY` | `your_youtube_api_key` | 하세나 최신 영상 모니터링용 YouTube Data API v3 키 |
| `CELERY_BROKER_URL` | `redis://redis:6379/0` | 비동기 태스크용 Celery 브로커 Redis URL |
| `CELERY_RESULT_BACKEND` | `redis://redis:6379/0` | Celery 태스크 결과 저장용 Redis URL |
| `FRONTEND_URL` | `http://localhost:3019` | 메일 및 인증 완료 후 리다이렉트할 프론트엔드 도메인 |

### 2. 코드 내 `os.environ`/`os.getenv` 사용처 전수 조사

- `SECRET_KEY`: `config/settings.py` (환경 주입 필수)
- `DEBUG`: `config/settings.py` (환경 주입, 기본값 False)
- `ALLOWED_HOSTS`: `config/settings.py` (환경 주입)
- `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT`: `config/settings.py` (데이터베이스 연결 정보)
- `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS`: `config/settings.py` (보안 오리진 동적 주입)
- `COOKIE_DOMAIN` / `COOKIE_SAMESITE`: `config/settings.py` (HttpOnly 토큰 쿠키 전송 사양 설정)
- `KAKAO_CLIENT_ID` / `KAKAO_REDIRECT_URI`: `config/settings.py` (필수 검증값 포함)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`: `config/settings.py`
- `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY`: `config/settings.py`, `accounts/views.py` (애플 ID 토큰 파싱 및 로그인 기능용)
- `API_BIBLE_KEY` (또는 `API_BIBLE_API_KEY`): `config/settings.py`, `bible_cache/services/api_bible_service.py` (외부 성경 데이터 fetch 키)
- `GEMINI_API_KEY`: `config/settings.py`, `todos/services/hasena_summary_service.py` (Gemini API 텍스트 요약용)
- `YOUTUBE_API_KEY`: `config/settings.py`, `todos/services/hasena_summary_service.py` (최신 하세나 영상 트래킹용)
- `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` / `REDIS_URL`: `config/settings.py` (Redis 캐시 및 태스크 큐)
- `RESEND_API_KEY` / `FROM_EMAIL` / `FROM_NAME` / `FRONTEND_URL`: `config/settings.py` (회원 가입 축하 및 이메일 인증 메일 발송용)
- `DJANGO_SETTINGS_MODULE`: `config/wsgi.py`, `config/asgi.py`, `config/celery.py`, `manage.py` (Django 기본 환경 구성 변수)

---

## 섹션 F: 외부 통합 코드 (Integration Points)

프로젝트 백엔드 내에서 직접적으로 외부 API 서버나 타사 서비스를 호출하는 통합 지점 목록입니다.

| 통합 | 파일:라인 | 호출 대상 | 상세 설명 |
| :--- | :--- | :--- | :--- |
| **API.Bible** | `bible_cache/services/api_bible_service.py:203` | `https://api.scripture.api.bible/v1` | 히브리어(WLC), 헬라어(SBLGNT), 영어(KJV, WEB) 성경 본문을 JSON 데이터로 가져오기 위한 HTTP GET 호출 |
| **대한성서공회** | `bible_cache/services/bible_fetch_service.py:260` | `https://www.bskorea.or.kr` | 개역개정, 새한글성경, 새번역 등 한글 성경의 장별 본문 데이터를 HTML 원본으로 긁어오기 위한 크롤링 호출 |
| **두라노** | `bible_cache/services/bible_fetch_service.py:342` | `https://www.duranno.com/bdictionary` | 우리말성경(WOORI)의 절별 본문 데이터를 가져오기 위해 두라노 성경사전 웹페이지를 긁어오기 위한 HTTP GET 호출 (EUC-KR 인코딩 대응) |
| **Kakao OAuth** | `accounts/views.py:154`<br>`accounts/views.py:195` | `https://auth.kakao.com/oauth/token`<br>`https://kapi.kakao.com/v2/user/me` | 카카오 소셜 로그인 완료를 위해 인증 코드를 액세스 토큰으로 교환하고, 토큰을 기반으로 사용자 닉네임, 프로필 이미지, 고유 ID 정보를 조회하는 연동 호출 |
| **Google OAuth** | `accounts/views.py:216`<br>`accounts/views.py:1149` | `https://oauth2.googleapis.com/token`<br>`https://www.googleapis.com/oauth2/v3/userinfo` | 구글 소셜 로그인 완료를 위해 인증 코드를 토큰으로 교환하고, 구글 사용자 정보 API를 통해 sub(고유 ID), 이메일, 닉네임, 프로필 사진을 연동하는 호출 |
| **Apple Sign-in** | `accounts/views.py:279` | `https://appleid.apple.com/auth/keys` | 애플 소셜 로그인을 위해 앱에서 전달한 `id_token` (JWT) 서명을 직접 검증하고자 애플의 공개 키 목록(JWKS)을 받아오는 호출 |
| **YouTube Data API** | `todos/services/hasena_summary_service.py:35` | `https://www.googleapis.com/youtube/v3/playlistItems` | 매일일독 하세나 영상 최신 업데이트 트래킹을 위해 지정된 재생목록(Playlist ID)의 최신 동영상을 조회하는 YouTube REST API 호출 |
| **YouTube 자막조회** | `todos/services/hasena_summary_service.py:73` | `youtube-transcript-api` 패키지 | 유튜브 영상의 음성 텍스트 자막(Transcript)을 텍스트 요약을 생성하기 위한 입력 데이터로 가져오는 호출 |
| **Google Gemini** | `todos/services/hasena_summary_service.py:131` | `google-genai` 패키지 (`gemini-2.5-flash`) | 수집된 유튜브 자막 텍스트를 기반으로 교역자 해설 및 오늘의 하시조 실천 항목을 AI로 요약 생성하기 위한 대형 언어 모델 호출 |

