# 매일일독 모바일 앱 배포 가이드

이 문서는 Expo 기반 매일일독 모바일 앱을 앱스토어(iOS App Store, Google Play Store)에 배포하기 위한 전체 과정을 안내합니다.

## 목차

1. [사전 준비사항](#1-사전-준비사항)
2. [EAS CLI 설정](#2-eas-cli-설정)
3. [앱 아이콘 및 에셋 준비](#3-앱-아이콘-및-에셋-준비)
4. [OAuth Redirect URI 설정](#4-oauth-redirect-uri-설정)
5. [Development Build](#5-development-build)
6. [Production Build](#6-production-build)
7. [앱스토어 제출](#7-앱스토어-제출)
8. [푸시 알림 설정](#8-푸시-알림-설정)
9. [트러블슈팅](#9-트러블슈팅)

---

## 1. 사전 준비사항

### 필수 계정

| 계정 | 용도 | 비용 | 링크 |
|------|------|------|------|
| **Expo 계정** | EAS Build 서비스 | 무료 (기본) | https://expo.dev/signup |
| **Apple Developer** | iOS 앱 배포 | $99/년 | https://developer.apple.com |
| **Google Play Console** | Android 앱 배포 | $25 (일회성) | https://play.google.com/console |

### 필수 도구

```bash
# Node.js 18+ 설치 확인
node --version

# EAS CLI 전역 설치
npm install -g eas-cli

# 버전 확인
eas --version
```

---

## 2. EAS CLI 설정

### 2.1 EAS 로그인

```bash
cd mobile
eas login
# Expo 계정 이메일/비밀번호 입력
```

### 2.2 프로젝트 초기화 (중요!)

```bash
eas init
```

이 명령어 실행 시:
1. Expo 프로젝트가 생성됨
2. 실제 `projectId`가 발급됨
3. `app.json`에 자동으로 반영됨

> **주의**: 현재 `app.json`의 `projectId`가 `YOUR_PROJECT_ID`로 되어 있습니다.
> `eas init` 실행 후 실제 ID로 교체되었는지 확인하세요.

### 2.3 프로젝트 ID 확인

```bash
# app.json에서 projectId 확인
cat app.json | grep projectId
```

`YOUR_PROJECT_ID`가 아닌 실제 UUID 형태여야 합니다:
```json
"projectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

## 3. 앱 아이콘 및 에셋 준비

### 현재 상태 (수정 필요!)

현재 아이콘이 **512x512**로 되어 있어 앱스토어 제출 시 **거부**됩니다.

### 필수 에셋 사이즈

| 파일 | 현재 | 필요 | 용도 |
|------|------|------|------|
| `icon.png` | 512x512 | **1024x1024** | iOS App Store 아이콘 |
| `adaptive-icon.png` | 512x512 | **1024x1024** | Android 적응형 아이콘 |
| `splash.png` | 512x512 | **1284x2778** | 스플래시 스크린 |
| `notification-icon.png` | 192x192 | 96x96 (OK) | Android 알림 아이콘 |

### 아이콘 교체 방법

1. **고해상도 원본이 있는 경우:**
   ```bash
   # assets 폴더에 새 아이콘 복사
   cp /path/to/new-icon-1024.png mobile/assets/icon.png
   cp /path/to/new-icon-1024.png mobile/assets/adaptive-icon.png
   cp /path/to/new-splash-1284x2778.png mobile/assets/splash.png
   ```

2. **AI 업스케일링 사용:**
   - [Topaz Gigapixel AI](https://www.topazlabs.com/gigapixel-ai)
   - [Pixelmator Pro](https://www.pixelmator.com/pro/) (macOS)
   - [upscale.media](https://www.upscale.media/) (온라인, 무료)

3. **새로 제작:**
   - Figma, Sketch, Adobe Illustrator 등으로 1024x1024 제작
   - 심플한 디자인 권장 (작은 사이즈에서도 식별 가능해야 함)

### 아이콘 검증

```bash
# 이미지 사이즈 확인 (macOS)
sips -g pixelWidth -g pixelHeight mobile/assets/icon.png

# 또는 file 명령어
file mobile/assets/*.png
```

---

## 4. OAuth Redirect URI 설정

### 카카오 로그인

1. [카카오 개발자 콘솔](https://developers.kakao.com) 접속
2. 앱 선택 → 플랫폼 → iOS/Android 추가
3. **iOS 설정:**
   - Bundle ID: `app.maeil1dok.mobile`
4. **Android 설정:**
   - 패키지명: `app.maeil1dok.mobile`
   - 키 해시: (아래 명령어로 생성)

```bash
# Android 키 해시 생성 (개발용)
keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore | openssl sha1 -binary | openssl base64
# 비밀번호: android
```

### 구글 로그인

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. API 및 서비스 → 사용자 인증 정보
3. OAuth 2.0 클라이언트 ID 생성:
   - **iOS**: 번들 ID `app.maeil1dok.mobile` 입력
   - **Android**: 패키지명 `app.maeil1dok.mobile` + SHA-1 지문 입력

---

## 5. Development Build

개발 및 테스트용 빌드입니다. Expo Go의 제한(WebView, 푸시알림 등) 없이 테스트할 수 있습니다.

### iOS Development Build

```bash
# 시뮬레이터용
eas build --profile development --platform ios

# 실제 기기용 (Ad Hoc)
eas build --profile development:device --platform ios
```

### Android Development Build

```bash
eas build --profile development --platform android
```

### 빌드 결과물 설치

1. 빌드 완료 후 QR 코드 또는 URL 제공됨
2. iOS: `.app` 파일을 시뮬레이터에 드래그 또는 기기에 설치
3. Android: APK 다운로드 후 설치

---

## 6. Production Build

> **먼저 읽을 것 — 로컬 빌드 경로가 따로 있고, 한 번 사고를 냈다.**
>
> 이 문서는 EAS 경로만 설명하지만 `scripts/build.sh`(= `npm run build`)는 "빌드 환경 선택:
> 1) 클라우드(EAS Build) / 2) 로컬" 을 묻는다. `2` 는 `expo prebuild` → `gradlew` 또는 Xcode
> 로 간다. **prebuild 도 gradlew 도 Xcode 도 업데이트 채널을 심지 않는다 — EAS Build 만 심는다.**
>
> 채널 없는 바이너리는 업데이트 확인마다 `HTTP 400 "channel-name": Required` 를 받아
> **OTA 를 영원히 못 받는다.** 실제로 그렇게 나간 빌드가 몇 달치 OTA 를 통째로 놓쳤다
> (2026-08-29 실측, `docs/auth-migration-metrics.md` 의 `## H1 판정`).
>
> **정확히 말하면 위험한 것은 "로컬 빌드" 가 아니라 "EAS 파이프라인을 거치지 않은 생짜
> 빌드" 다.** `eas build --local` 은 이 맥에서 돌면서도 채널을 심고 `credentials.json` 으로
> 서명하며 클라우드 크레딧을 쓰지 않는다(2026-08-29 빌드 로그로 확인). 이 프로젝트는
> Expo 유료 구독이 없으므로 **`--local` 이 정식 경로다.**
>
> | 경로 | 채널 | 크레딧 |
> |---|---|---|
> | `eas build` (클라우드) | 심긴다 | 소모 |
> | **`eas build --local`** | **심긴다** | **미소모** ← 이 프로젝트 |
> | `expo prebuild` + `gradlew`/Xcode | 안 심긴다 | 미소모 ← 사고 원인 |
>
> `build.sh` 의 세 번째 경로에는 자동 주입·검증을 붙여 뒀지만, Xcode/gradlew 를 직접
> 부르면 우회된다. 그렇게 만들었다면 제출 전에 반드시:
>
> ```bash
> cd mobile && npm run verify:store -- --artifact <경로.ipa>
> ```


### 6.1 iOS Production Build

```bash
eas build --profile production --platform ios
```

**필요한 인증서:**
- Apple Distribution Certificate
- App Store Provisioning Profile

> EAS가 자동으로 생성/관리합니다. 처음 빌드 시 Apple 계정 로그인 필요.

### 6.2 Android Production Build

```bash
eas build --profile production --platform android
```

**결과물:**
- `.aab` 파일 (Android App Bundle) - Play Store 제출용

### 6.3 빌드 상태 확인

```bash
# 빌드 목록 확인
eas build:list

# 특정 빌드 상세 정보
eas build:view
```

---

## 7. 앱스토어 제출

### 7.1 iOS App Store 제출

#### 사전 준비

1. **App Store Connect**에서 앱 생성
   - https://appstoreconnect.apple.com
   - 번들 ID: `app.maeil1dok.mobile`
   - 앱 이름, 설명, 스크린샷 등록

2. **eas.json 설정 확인:**
   ```json
   {
     "submit": {
       "production": {
         "ios": {
           "appleId": "your-apple-id@email.com",
           "ascAppId": "앱스토어커넥트앱ID",
           "appleTeamId": "팀ID"
         }
       }
     }
   }
   ```

#### 제출 명령어

```bash
eas submit --platform ios
```

또는 빌드와 제출을 한번에:
```bash
eas build --profile production --platform ios --auto-submit
```

### 7.2 Google Play Store 제출

#### 사전 준비

1. **Google Play Console**에서 앱 생성
   - https://play.google.com/console
   - 패키지명: `app.maeil1dok.mobile`
   - 앱 정보, 스크린샷, 개인정보처리방침 등록

2. **서비스 계정 JSON 생성:**
   - Google Play Console → 설정 → API 액세스
   - 서비스 계정 생성 → JSON 키 다운로드
   - `mobile/google-service-account.json`으로 저장 (gitignore에 포함됨)

3. **eas.json 설정:**
   ```json
   {
     "submit": {
       "production": {
         "android": {
           "serviceAccountKeyPath": "./google-service-account.json",
           "track": "internal"
         }
       }
     }
   }
   ```

#### 제출 명령어

```bash
eas submit --platform android
```

### 7.3 제출 트랙 옵션 (Android)

| 트랙 | 설명 |
|------|------|
| `internal` | 내부 테스트 (최대 100명) |
| `alpha` | 비공개 테스트 |
| `beta` | 공개 테스트 |
| `production` | 프로덕션 출시 |

---

## 8. 푸시 알림 설정

### iOS (APNs)

EAS Build가 자동으로 Push Notification 인증서를 관리합니다.

수동 설정이 필요한 경우:
```bash
eas credentials
# iOS → Push Notifications → Set up Push Key
```

### Android (FCM)

1. [Firebase Console](https://console.firebase.google.com)에서 프로젝트 생성
2. Android 앱 추가 (패키지명: `app.maeil1dok.mobile`)
3. `google-services.json` 다운로드
4. `mobile/` 폴더에 저장

```bash
# app.json에 Firebase 설정 추가 필요시
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

---

## 9. 트러블슈팅

### "projectId is not configured" 에러

```bash
# 해결: eas init 다시 실행
eas init
```

### iOS 빌드 실패 - 인증서 문제

```bash
# 인증서 초기화
eas credentials
# iOS → Remove existing credentials → Set up new credentials
```

### Android 빌드 실패 - 키스토어 문제

```bash
# 키스토어 재생성
eas credentials
# Android → Keystore → Remove existing → Create new
```

### 앱스토어 제출 거부 사유

| 사유 | 해결방법 |
|------|----------|
| 아이콘 해상도 부족 | 1024x1024 아이콘으로 교체 |
| 개인정보처리방침 없음 | 웹사이트에 개인정보처리방침 페이지 추가 |
| 기능 미작동 | 리뷰어가 테스트할 수 있는 테스트 계정 제공 |
| WebView만 있는 앱 | 네이티브 기능(푸시, 딥링크 등) 강조 |

### 빌드 로그 확인

```bash
# 최근 빌드 로그 보기
eas build:view --platform ios
eas build:view --platform android
```

---

## 체크리스트

배포 전 최종 확인:

- [ ] `eas init` 실행하여 실제 `projectId` 발급
- [ ] `app.json`의 `projectId`가 실제 UUID인지 확인
- [ ] 아이콘이 1024x1024인지 확인
- [ ] 스플래시 이미지가 1284x2778인지 확인
- [ ] 카카오/구글 OAuth redirect URI 등록
- [ ] 개인정보처리방침 URL 준비
- [ ] 앱 스크린샷 준비 (최소 3장)
- [ ] 앱 설명 문구 준비

---

## 빠른 명령어 참조

```bash
# 로그인
eas login

# 프로젝트 초기화
eas init

# Development Build
eas build --profile development --platform all

# Production Build
eas build --profile production --platform all

# 앱스토어 제출
eas submit --platform ios
eas submit --platform android

# 인증서 관리
eas credentials

# 빌드 목록
eas build:list
```

---

## 도움이 필요하면

- [Expo 공식 문서](https://docs.expo.dev)
- [EAS Build 가이드](https://docs.expo.dev/build/introduction/)
- [EAS Submit 가이드](https://docs.expo.dev/submit/introduction/)
