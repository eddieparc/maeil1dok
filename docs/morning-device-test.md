# 아침 실기기 테스트 체크리스트 (2026-08-30)

밤사이 준비해 둔 것과, 아침에 하실 일. **순서대로만 하시면 됩니다.**

## 준비된 산출물

| 파일 | 용도 | 상태 |
|---|---|---|
| `dist/maeil1dok-1.2.3.apk` | **안드로이드 기기 직접 설치** | 빌드·검증·에뮬레이터 검수 완료 |
| `dist/maeil1dok-1.2.3.aab` | **Play Store 제출** | 빌드·검증 완료 |
| `dist/devsigned/app.ipa` | **iOS 기기 직접 설치** | 개발 서명(`get-task-allow=true`), 등록기기 2대 |
| `dist/appstore/app.ipa` | **App Store 제출** | 배포 서명(`get-task-allow=false`) |

**네 산출물 모두 채널 검증 통과**(2026-08-30 실측):

```
OK   android (.apk): channel "production"
OK   android (.aab): channel "production"
OK   ios (.ipa): channel "production"     ← devsigned
OK   ios (.ipa): channel "production"     ← appstore
```

버전은 넷 다 `1.2.3` / Android `versionCode 20` / iOS `build 11` 입니다.

> **산출물이 셸 수정보다 먼저 빌드됐습니다 (2026-08-30 오전).** `dist/` 의 네 파일은
> 커밋 `a02d7e9d` 시점 코드입니다. 그 뒤에 셸 CSRF 수정(`7ec253cc`, `4b20f9aa`)이
> 들어갔으므로, **지금 그대로 제출하면 그 수정이 빠집니다.**
>
> - **급하지 않습니다.** refresh 는 서버 수정(이미 배포됨)으로 모든 기기에서 풀렸습니다.
>   빠지는 것은 셸이 CSRF 헤더를 싣는 부분이고, 그건 구 웹 번들이 `requestLogout` 을
>   보낼 때의 로그아웃 경로에만 영향을 줍니다.
> - 포함하고 싶으면 제출 전에 다시 빌드하십시오 — 절차는 아래 "다시 빌드해야 한다면".
>   그때 `app.json` 의 `versionCode` 를 21 이상으로 올려야 합니다(20 은 이 산출물이 씀).

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

## B. iOS 실기기 — 두 경로. 직접 설치가 **가능합니다**

> **정정**: 처음엔 "TestFlight 밖에 없다" 고 적었는데 틀렸습니다. 이 맥의 키체인에
> `Apple Development: JiGeon Park (78872QSM5R)` 인증서가 있고, `iOS Team Provisioning
> Profile: com.maeil1dok.app`(만료 2027-03-12)에 **기기 2대가 이미 등록**돼 있습니다.
> 그래서 개발 서명본을 그 기기에 바로 설치할 수 있습니다.

### B-1. 빠른 길 — 개발 서명본 직접 설치 (권장, TestFlight 대기 없음)

산출물: `dist/devsigned/*.ipa`

```bash
# 아이폰을 USB 로 연결하고 (기기에서 '이 컴퓨터를 신뢰' 승인)
xcrun devicectl list devices                      # 기기 UDID 확인
xcrun devicectl device install app --device <UDID> ~/GitHub/maeil1dok/dist/devsigned/app.ipa
```

Xcode GUI 를 쓰신다면: Xcode → Window → Devices and Simulators → 기기 선택 →
`Installed Apps` 의 `+` → 그 `.ipa` 선택.

**등록된 기기가 아니면 설치가 거부됩니다.** 그때는 B-2 로 가십시오.

> 개발 서명본도 **채널이 심겨 있습니다**(`expo-channel-name: production`).
> prebuild 는 채널을 안 심으므로 `inject-update-channel.mjs` 로 넣고 검증했습니다.

### B-2. 배포 경로 — App Store Connect → TestFlight

산출물: `dist/appstore/*.ipa`

**(a) Transporter 앱** — 자격증명 설정 불필요. Mac App Store 에서 설치 → 애플 계정
로그인 → `.ipa` 드래그 → Deliver.

**(b) `eas submit`** — `mobile/eas.json` 의 `submit.production.ios.appleId` 가
`FILL_ME_apple_account_email` 입니다. **애플 계정 이메일만 넣으면** 됩니다.
나머지는 채워 뒀습니다(`ascAppId: 6758072829`, `appleTeamId: F42N2AFRM6`).

```bash
cd mobile
npx eas submit --platform ios --profile production --path ../dist/appstore/app.ipa
```

업로드 후 App Store Connect 처리에 5~15분. TestFlight 탭에 뜨면 기기에서 설치.

### B-3. 확인할 것
A 의 1~4 와 동일합니다.

### 참고 — iOS 빌드가 `eas build --local` 로는 안 되는 이유 (실측)

두 번 시도해 두 번 다 자격 문제로 막혔고, 원인이 서로 달랐습니다.

1. 리포의 `credentials/ios/profile.mobileprovision` 은 **2026-01-21** 자인데
   Apple 로그인은 **2026-01-27**(`bb40dd73`)에 추가됐습니다. 그래서
   `doesn't include the Sign In with Apple capability` 로 실패했습니다.
   → 맥에 있던 최신 프로파일로 교체했습니다(옛 파일은 `.bak-20260121` 로 보존).
2. 교체한 프로파일은 **Xcode 관리(자동 서명)** 인데 `eas build --local` 은
   **수동 관리** 프로파일을 요구합니다 — `is Xcode managed, but signing settings
   require a manually managed profile`.

그래서 iOS 는 **Xcode 로 직접 아카이브**하고 거기서 두 형태로 export 했습니다.
Android 는 `eas build --local` 이 그대로 됩니다(채널까지 심어 줍니다).

수동 관리 프로파일을 Apple Developer 포털에서 새로 만들면 iOS 도 `eas build --local`
경로로 통일할 수 있습니다. 포털 접근이 필요해 밤사이 하지 못했습니다.

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

### iOS 아카이브 (Xcode 직접) — 통과

| 확인 | 결과 |
|---|---|
| 아카이브 | `BUILD SUCCEEDED`, TeamID `F42N2AFRM6` |
| 버전 | `CFBundleShortVersionString 1.2.3` · `CFBundleVersion 11` |
| 채널 | `OK ios (.app): channel "production"` |
| export | app-store · development 두 형태 모두 성공 |

### 밤사이 잡은 검증기 결함 하나

같은 아카이브에서 나온 `.app` 은 통과하는데 `.ipa` 가 FAIL 이었습니다. Xcode 가
`.ipa` 안의 plist 를 **바이너리(`bplist00`)** 로 넣는데 `.ipa` 분기만 텍스트로 읽고
있었습니다 — 채널은 멀쩡히 들어 있었습니다. **정상 빌드를 거부하는 게이트는 없는
게이트보다 나쁘므로**(플래그로 넘기는 습관이 생기고 진짜 실패도 통과합니다) 결함으로
다뤄 고쳤고, 합성 `.ipa` 왕복 테스트를 붙였습니다. 잘못된 채널은 여전히 거부합니다.

## 1시간 만료 시험 — **가장 중요합니다**

재시작 시험(A-3 / B-3)은 **로그인 후 1시간 안에 하면 아무것도 증명하지 못합니다.**
그 구간은 access 쿠키(`max_age` 1시간)가 살아 있어 refresh 경로가 실행되지 않습니다.
2026-08-30 오전의 Android 3회·iOS 4회 통과가 정확히 그 경우였습니다.

**절차**

1. 앱에서 로그인하고 **로그인 시각을 적어 둡니다.**
2. **1시간 넘게** 앱을 열지 않습니다(백그라운드도 아닌 완전 종료 권장).
3. 앱을 엽니다.
4. 로그인이 유지되면 통과입니다.

**서버 쪽 확증** — 느낌이 아니라 카운터로 판정합니다.

```bash
ssh -i ~/.ssh/oci_a1_deploy ubuntu@168.107.46.120 \
  "cd /opt/maeil1dok && docker compose -f docker-compose.oci.yml --env-file .env.oci \
   exec -T web python manage.py shell" <<'PY'
from datetime import timedelta
from django.db.models import Sum
from authmetrics.models import AuthMetricCounter, EventKind
from authmetrics.recording import aggregate_pending, utc_now_naive
aggregate_pending()
today = utc_now_naive().date()
print(list(AuthMetricCounter.objects
      .filter(day__gte=today - timedelta(days=1))
      .values("event", "method", "outcome", "cause")
      .annotate(t=Sum("count")).order_by("-t")[:15]))
PY
```

- `auth / refresh-redemption / success` 가 있으면 **갱신이 실제로 성립한 것**입니다.
- `refresh_401 cause=csrf` 가 계속 늘면 **수정이 그 기기에 닿지 않은 것**입니다.
- `refresh_401 cause=blacklisted` 는 회전 경합이며 별개 항목입니다.

> 2026-08-30 이전에는 이 값이 **전부 `cause=csrf`** 였습니다. 그것이 결함이었고
> 서버 수정으로 풀렸습니다(근거: `docs/auth-migration-metrics.md`
> `## refresh 상환이 100% CSRF 403`).

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
