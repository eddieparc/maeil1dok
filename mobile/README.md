# 매일일독 Mobile App

Expo + React Native WebView 기반의 매일일독 모바일 앱입니다.

## 프로젝트 구조

```
mobile/
├── App.tsx              # 메인 WebView 앱 컴포넌트
├── app.json             # Expo 설정
├── eas.json             # EAS Build 설정
├── assets/              # 앱 아이콘, 스플래시 스크린
└── src/                 # (선택) 추가 컴포넌트
```

## 주요 기능

- **WebView 래핑**: https://maeil1dok.app 웹앱을 네이티브 앱으로 감쌈
- **딥링크**: `maeil1dok://` 스킴 지원
- **OAuth**: 카카오/구글 로그인 WebView 내 처리
- **푸시 알림**: expo-notifications 통합
- **오프라인 에러 처리**: 네트워크 오류 시 재시도 UI

## 개발 시작

### 1. 의존성 설치

```bash
cd mobile
npm install
```

### 2. 개발 서버 실행

```bash
# Expo Go 앱에서 실행 (제한적)
npx expo start

# iOS 시뮬레이터
npx expo run:ios

# Android 에뮬레이터
npx expo run:android
```

> **참고**: WebView와 푸시 알림은 Expo Go에서 제한될 수 있습니다. 
> Development Build 사용을 권장합니다.

### 3. Development Build 생성

```bash
# EAS CLI 설치 (최초 1회)
npm install -g eas-cli

# EAS 로그인
eas login

# iOS Development Build
eas build --profile development --platform ios

# Android Development Build (APK)
eas build --profile development --platform android
```

## 빌드 및 배포

### Preview Build (내부 테스트)

```bash
# iOS
eas build --profile preview --platform ios

# Android (APK)
eas build --profile preview --platform android
```

### Production Build (앱스토어)

```bash
# iOS (App Store)
eas build --profile production --platform ios

# Android (Play Store - AAB)
eas build --profile production --platform android
```

### iOS 빌드 SDK

현재 Expo SDK 54 앱은 기존 AppDelegate 생명주기를 사용합니다.
출하용 iOS 빌드는 `macos-sequoia-15.6-xcode-26.0` 이미지로 고정하며,
`production-sim`도 같은 이미지와 `production` 환경 변수를 상속합니다.

로컬 Xcode 27 SDK로 빌드한 앱은 iOS 27에서 UIScene 생명주기 미지원으로
시작 직후 종료됩니다. iOS 27 검수는 출하 환경과 같은 시뮬레이터 빌드를 사용합니다.
SDK 27로 전환할 때는 먼저 UIScene 생명주기와 소셜 로그인 콜백을 이식해야 합니다.

```bash
eas build --profile production-sim --platform ios
```

### 앱스토어 제출

```bash
# iOS App Store 제출
eas submit --platform ios

# Google Play Store 제출
eas submit --platform android
```

## 설정 변경 필요 항목

### app.json

배포 전 아래 항목들을 실제 값으로 변경해야 합니다:

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "YOUR_ACTUAL_PROJECT_ID"  // EAS 프로젝트 ID
      }
    }
  }
}
```

### eas.json

앱스토어 제출을 위해 아래 정보 필요:

- **iOS**: Apple ID, App Store Connect App ID, Apple Team ID
- **Android**: Google Service Account JSON 파일

## 앱 아이콘 및 스플래시

현재 512x512 아이콘을 임시 사용 중입니다. 
프로덕션 배포 전 1024x1024 고해상도 아이콘으로 교체하세요.

### 권장 아이콘 사이즈

- `icon.png`: 1024x1024 (iOS App Store용)
- `adaptive-icon.png`: 1024x1024 (Android adaptive icon)
- `splash.png`: 1284x2778 (스플래시 스크린)
- `notification-icon.png`: 96x96 (Android 알림 아이콘, 단색)

## WebView ↔ Native 통신

### Native → WebView

```typescript
// 푸시 토큰 전달
webViewRef.current?.injectJavaScript(`
  window.nativePushToken = '${token}';
`);
```

### WebView → Native

```javascript
// 웹앱에서 네이티브로 메시지 전송
window.ReactNativeWebView.postMessage(JSON.stringify({
  type: 'requestPushToken'
}));
```

### 사용 가능한 글로벌 변수/함수

웹앱에서 아래 기능을 사용할 수 있습니다:

```javascript
// 네이티브 앱 환경인지 확인
if (window.isReactNativeWebView) {
  // 네이티브 앱에서만 실행할 코드
}

// 푸시 토큰 요청
window.requestNativePushToken();

// 외부 링크 열기 (기본 브라우저)
window.openExternalLink('https://example.com');

// 푸시 토큰 수신 이벤트
window.addEventListener('nativePushToken', (e) => {
  console.log('Push token:', e.detail);
});
```

## 트러블슈팅

### OAuth 로그인이 안 될 때

1. `app.json`의 `scheme`이 `maeil1dok`으로 설정되어 있는지 확인
2. 카카오/구글 개발자 콘솔에서 redirect URI 등록 확인
3. Development Build를 사용하고 있는지 확인 (Expo Go 제한)

### 푸시 알림이 안 될 때

1. 실제 기기에서 테스트 (시뮬레이터 제한)
2. `eas.json`의 `projectId`가 올바른지 확인
3. iOS의 경우 Apple Push Notification 인증서 설정 확인

### WebView 로딩이 느릴 때

1. 네트워크 상태 확인
2. 웹앱 자체의 로딩 속도 점검
3. 스플래시 스크린 설정으로 UX 개선
