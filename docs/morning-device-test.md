# 아침 실기기 테스트 체크리스트 (2026-08-30)

밤사이 준비해 둔 것과, 아침에 하실 일. **순서대로만 하시면 됩니다.**

## 준비된 산출물

| 파일 | 용도 | 상태 |
|---|---|---|
| `dist/maeil1dok-1.2.3.aab` | **Play Store 제출용** | 빌드·검증 완료 |
| `dist/maeil1dok-1.2.3.apk` | **안드로이드 기기 직접 설치용** | 빌드·검증·에뮬레이터 검수 완료 |
| `dist/maeil1dok-1.2.3.ipa` | **App Store 제출용** | (빌드 결과는 아래 "밤사이 결과" 참조) |

전부 **로컬에서 서명**했고 **Expo 클라우드 크레딧을 쓰지 않았습니다**(`eas build --local`).
세 산출물 모두 `expo-channel-name: production` 이 박혀 있어야 하며, 검증 명령은:

```bash
cd mobile && npm run verify:store -- --artifact ../dist/<파일>
```

`OK ... channel "production"` 이 아니면 **제출하지 마십시오.** 그 빌드는 앞으로도
OTA 를 못 받습니다(이번 사고의 원인).

---

## A. 안드로이드 실기기 — 지금 바로 됩니다

`.aab` 는 기기에 설치할 수 없습니다(Play 업로드 전용). **`.apk` 를 쓰십시오.**

```bash
# 기기를 USB 로 연결하고 (개발자 옵션 > USB 디버깅 켜기)
adb devices                       # 기기가 보이는지 확인
adb uninstall app.maeil1dok.mobile   # 스토어판이 깔려 있으면 필수 (서명 불일치로 덮어쓰기 불가)
adb install ~/GitHub/maeil1dok/dist/maeil1dok-1.2.3.apk
```

> **주의**: 스토어에서 받은 앱을 지우면 그 앱의 로그인 상태도 사라집니다.
> 기존 세션이 유지되는지 보려면 지우기 전에 먼저 A-3 대조군을 확인하십시오.

### 확인할 것

1. **앱이 켜지는가** — 예전 빌드는 실행 즉시 죽었습니다
   (`decelerationRate` 문자열 → `ClassCastException`). 이번 빌드에서 고쳤습니다.
2. **계정 설정 맨 아래** 에 `v1.2.3 · embedded` 가 보이는가
   → 보이면 새 셸이 맞습니다. `앱 구버전 — 업데이트 미도달` 이 보이면 옛 빌드입니다.
3. **로그인 유지** — 로그인하고, 앱을 완전 종료했다 다시 켜서 로그인이 살아 있는지.
   이것이 이번 수정의 본체입니다(실패한 세션 복구가 더 이상 유효한 쿠키를 파괴하지 않음).
4. **로그아웃이 붙는가** — 로그아웃 후 완전 종료·재시작 시 로그아웃 상태가 유지되는지.

---

## B. iOS 실기기 — **직접 설치가 불가능합니다. TestFlight 를 거쳐야 합니다.**

이유를 정확히 적습니다. `credentials/ios/profile.mobileprovision` 은 **App Store 배포용**
프로파일이고 `get-task-allow: false` 입니다. 그런 서명의 `.ipa` 는 기기에 사이드로드할 수
없습니다 — 애플이 막습니다. 개발/Ad Hoc 프로파일이 있으면 가능하지만, 그것을 만들려면
Apple Developer 포털 접근이 필요해 제가 할 수 없었습니다.

따라서 iOS 실기기 경로는 하나입니다: **App Store Connect 업로드 → TestFlight 설치.**

### B-1. 업로드 (둘 중 하나)

**(a) Transporter 앱** — 자격증명 설정이 필요 없습니다. 가장 빠릅니다.
Mac App Store 에서 `Transporter` 설치 → 애플 계정 로그인 → `dist/maeil1dok-1.2.3.ipa`
드래그 → Deliver.

**(b) `eas submit`** — `mobile/eas.json` 의 `submit.production.ios.appleId` 가
`FILL_ME_apple_account_email` 로 비어 있습니다. **애플 계정 이메일만 넣으면** 됩니다.
나머지는 채워 뒀습니다(`ascAppId: 6758072829`, `appleTeamId: F42N2AFRM6`).

```bash
cd mobile
npx eas submit --platform ios --profile production --path ../dist/maeil1dok-1.2.3.ipa
```

업로드 후 App Store Connect 에서 처리에 5~15분 걸립니다. TestFlight 탭에 빌드가 뜨면
기기의 TestFlight 앱에서 설치하십시오.

### B-2. 확인할 것
A 의 1~4 와 동일합니다.

---

## C. Play Store 제출 (안드로이드 배포)

```bash
cd mobile
npx eas submit --platform android --profile production --path ../dist/maeil1dok-1.2.3.aab
```
또는 Play Console 에 `.aab` 를 직접 업로드.

**먼저 확인**: Play Console 의 현재 versionCode 가 **20 미만**이어야 합니다.
이 빌드는 `versionCode 20` 입니다. 실기기에서 관측한 값이 17 이라 20 으로 잡았지만,
Play 에 이미 20 이상이 있으면 거부됩니다. 그 경우 `mobile/app.json` 의
`android.versionCode` 를 더 올려 다시 빌드하십시오.

---

## D. 배포가 끝난 뒤 — 웹 강제 안내 승격 (선택)

새 빌드가 **양 스토어에 실제로 반영된 뒤에만** 켜십시오.

```
NUXT_PUBLIC_LEGACY_SHELL_ENFORCEMENT=blocking
```

지금은 `notice`(배너 안내)입니다. 스토어에 새 버전이 없는 상태에서 `blocking` 을 켜면
업데이트할 대상이 없는 사용자를 앱에서 쫓아냅니다.

---

## 밤사이 검수 결과 (에뮬레이터/시뮬레이터)

### Android 에뮬레이터 (`Medium_Phone_API_36.1`) — **전 항목 통과**

| 확인 | 결과 |
|---|---|
| 채널 | `OK android (.apk): channel "production"` |
| 설치 | `Success` |
| 실행 | 프로세스 생존 (pid 3704) |
| **크래시** | **`FATAL EXCEPTION` 0건** — 예전 빌드를 죽이던 결함이 해소됨 |
| 버전 | `versionName=1.2.3 versionCode=20` |
| 번들 신원 | `[BundleIdentity] updateId=2f15b2c7-... embedded=true runtime=1.2.3 channel=production` |
| **구버전 배너** | **뜨지 않음** — 웹앱이 이 빌드를 새 셸로 정확히 인식 |

`embedded=true` 는 정상입니다. 수정이 **번들에 내장돼** 나가므로 OTA 를 받을 필요가 없습니다.

### iOS 시뮬레이터 (`iPhone 17`) — **전 항목 통과**

| 확인 | 결과 |
|---|---|
| 채널 | `OK ios (.app): channel "production"` |
| `Expo.plist` | `expo-channel-name: production` · `EXUpdatesRuntimeVersion: 1.2.3` |
| 설치·실행 | 프로세스 생존 (pid 53764) |
| 크래시 | 없음 |
| **구버전 배너** | **뜨지 않음** — 새 셸로 인식됨 |

iOS 릴리스 빌드는 JS `console.log` 를 시스템 로그로 넘기지 않아 `[BundleIdentity]` 줄이
콘솔에 안 보입니다. 그래서 `Expo.plist` 와 화면으로 판정했습니다. **실기기에서는 계정 설정
하단 표시로 확인하십시오** — 관측 수단을 두 개 둔 이유가 이것입니다.

### 남은 한계 — 정직하게 적습니다

에뮬레이터·시뮬레이터로는 **로그인 유지(A-3)를 증명할 수 없습니다.** 그 결함은 실제
사용 중 refresh 토큰 회전이 일어나야 재현되고, 그것이 이 트랙의 본체입니다.
**아침 실기기 확인에서 그 항목이 가장 중요합니다.**

---

## 문제가 생기면

- **APK 설치가 `INSTALL_FAILED_UPDATE_INCOMPATIBLE`** → 스토어판을 먼저 `adb uninstall`.
- **`앱 구버전` 배너가 새 빌드에서 뜬다** → 웹이 `__shellBundleIdentity` 를 못 읽은 것.
  앱 완전 종료 후 재시작. 그래도 뜨면 옛 빌드가 깔린 것입니다.
- **다시 빌드해야 한다면**:
  ```bash
  cd mobile
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  export PATH="$JAVA_HOME/bin:$PATH:/opt/homebrew/bin"   # homebrew 를 앞에 두면 npx 가 깨진다
  export ANDROID_HOME="$HOME/Library/Android/sdk" EAS_NO_VCS=1
  npx eas build --platform android --profile production-apk --local --non-interactive \
    --output ../dist/maeil1dok-1.2.3.apk
  ```
  전체 절차는 `docs/auth-migration-handoff.md` 의 H8 런북.
