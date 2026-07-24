# Google OAuth 설정 가이드

매일일독 앱에서 Google 로그인을 활성화하기 위한 설정 가이드입니다.

## 1. Google Cloud Console에서 프로젝트 생성/선택

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택

## 2. OAuth 동의 화면 설정

1. **API 및 서비스** > **OAuth 동의 화면** 이동
2. **User Type**: 외부(External) 선택
3. 앱 정보 입력:
   - **앱 이름**: 매일일독
   - **사용자 지원 이메일**: 관리자 이메일
   - **개발자 연락처 이메일**: 관리자 이메일
4. **범위(Scopes)** 추가:
   - `email`
   - `profile`
   - `openid`
5. **테스트 사용자** 추가 (개발 중일 경우)

## 3. OAuth 2.0 클라이언트 ID 생성

1. **API 및 서비스** > **사용자 인증 정보** 이동
2. **+ 사용자 인증 정보 만들기** > **OAuth 클라이언트 ID** 클릭
3. 설정:
   - **애플리케이션 유형**: 웹 애플리케이션
   - **이름**: 매일일독 웹
   - **승인된 JavaScript 원본**:
     ```
     https://maeil1dok.app
     http://localhost:3000
     ```
   - **승인된 리디렉션 URI**:
     ```
     https://maeil1dok.app/auth/google/callback
     http://localhost:3000/auth/google/callback
     ```
4. **만들기** 클릭
5. **클라이언트 ID**와 **클라이언트 보안 비밀번호** 복사

## 4. 환경 변수 설정

### Backend (.env)
```env
GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-actual-client-secret
GOOGLE_REDIRECT_URI=https://maeil1dok.app/auth/google/callback
```

### Frontend (VM `.env.frontend.oci`)
```env
GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
GOOGLE_REDIRECT_URI=https://maeil1dok.app/auth/google/callback
```

## 5. 서비스 재시작

VM에서 환경 변수를 변경한 서비스를 재생성합니다.

```bash
docker compose -f docker-compose.oci.yml --env-file .env.oci \
  up -d --force-recreate web frontend
```

## 6. 테스트

1. https://maeil1dok.app/login 접속
2. "구글로 시작하기" 버튼 클릭
3. Google 계정 선택/로그인
4. 권한 동의
5. 매일일독으로 리디렉션 확인

## 문제 해결

### "redirect_uri_mismatch" 오류
- Google Cloud Console의 승인된 리디렉션 URI가 정확히 일치하는지 확인
- 슬래시(/) 포함 여부 확인

### "access_denied" 오류
- OAuth 동의 화면이 "프로덕션"으로 게시되었는지 확인
- 또는 테스트 사용자로 등록되어 있는지 확인

### 토큰 교환 실패
- GOOGLE_CLIENT_SECRET이 백엔드에 올바르게 설정되었는지 확인
- VM의 `.env.oci`를 수정한 뒤 `web` 컨테이너를 재생성했는지 확인
