#!/bin/bash

# ============================================================
# 매일일독 모바일 빌드 스크립트
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
APP_JSON="$PROJECT_DIR/app.json"

LOW_PRIORITY=false
MAX_WORKERS=4

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================
# 유틸리티 함수
# ============================================================

print_header() {
    echo ""
    echo -e "${CYAN}============================================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}============================================================${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}>>> $1${NC}"
}

print_success() {
    echo -e "${GREEN}[완료] $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[주의] $1${NC}"
}

print_error() {
    echo -e "${RED}[오류] $1${NC}"
}

get_version() {
    grep -o '"version": "[^"]*"' "$APP_JSON" | cut -d'"' -f4
}

get_version_code() {
    grep -o '"versionCode": [0-9]*' "$APP_JSON" | grep -o '[0-9]*'
}

get_build_number() {
    grep -o '"buildNumber": "[^"]*"' "$APP_JSON" | cut -d'"' -f4 || echo "1"
}

bump_version() {
    local type=$1
    local current=$(get_version)
    local IFS='.'
    read -ra parts <<< "$current"
    
    case $type in
        major)
            parts[0]=$((parts[0] + 1))
            parts[1]=0
            parts[2]=0
            ;;
        minor)
            parts[1]=$((parts[1] + 1))
            parts[2]=0
            ;;
        patch)
            parts[2]=$((parts[2] + 1))
            ;;
    esac
    
    echo "${parts[0]}.${parts[1]}.${parts[2]}"
}

update_app_json() {
    local new_version=$1
    local new_version_code=$2
    
    sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$new_version\"/" "$APP_JSON"
    sed -i '' "s/\"versionCode\": [0-9]*/\"versionCode\": $new_version_code/" "$APP_JSON"
    
    if grep -q '"buildNumber"' "$APP_JSON"; then
        sed -i '' "s/\"buildNumber\": \"[^\"]*\"/\"buildNumber\": \"$new_version_code\"/" "$APP_JSON"
    fi
}

clean_build() {
    print_step "빌드 캐시 정리 중..."
    
    cd "$PROJECT_DIR"
    
    [ -d "android" ] && rm -rf android && print_success "android/ 삭제"
    [ -d "ios" ] && rm -rf ios && print_success "ios/ 삭제"
    [ -d ".expo" ] && rm -rf .expo && print_success ".expo/ 삭제"
    [ -d "dist" ] && rm -rf dist && print_success "dist/ 삭제"
    [ -d "node_modules/.cache" ] && rm -rf node_modules/.cache && print_success "node_modules/.cache/ 삭제"
    
    print_success "캐시 정리 완료!"
}

# ============================================================
# 빌드 함수
# ============================================================

run_prebuild() {
    local platform=$1
    print_step "$platform prebuild 실행 중..."
    cd "$PROJECT_DIR"
    npx expo prebuild --platform "$platform" --clean

    # prebuild 는 업데이트 채널을 심지 않는다 — EAS Build 가 하는 일이다.
    # 채널 없는 바이너리는 업데이트 확인마다 HTTP 400 을 받아 OTA 를 영원히 못 받는다.
    # 로컬 빌드로 스토어에 올린 앱이 몇 달 동안 어떤 업데이트도 받지 못한 원인이 이것이다.
    print_step "업데이트 채널 주입 중..."
    node "$SCRIPT_DIR/inject-update-channel.mjs" --channel production
    node "$SCRIPT_DIR/verify-store-artifact.mjs" --native

    print_success "Prebuild 완료!"
}

build_eas() {
    local platform=$1
    local profile=$2
    
    print_step "EAS 클라우드 빌드 시작 ($platform - $profile)..."
    cd "$PROJECT_DIR"
    eas build --platform "$platform" --profile "$profile"
}

build_local() {
    local platform=$1
    local type=$2
    local gradle_cmd="./gradlew"
    local gradle_opts=""
    
    if [ "$LOW_PRIORITY" = true ]; then
        gradle_cmd="nice -n 10 ./gradlew"
        gradle_opts="--max-workers=$MAX_WORKERS"
        print_warning "저우선순위 모드: nice=10, workers=$MAX_WORKERS"
    fi
    
    print_step "로컬 빌드 시작 ($platform - $type)..."
    cd "$PROJECT_DIR"
    
    if [ "$platform" = "android" ]; then
        if [ "$type" = "apk" ]; then
            cd android && $gradle_cmd assembleRelease $gradle_opts
            node "$SCRIPT_DIR/verify-store-artifact.mjs" --artifact "$PROJECT_DIR/android/app/build/outputs/apk/release/app-release.apk"
            print_success "APK 생성 완료: android/app/build/outputs/apk/release/app-release.apk"
        else
            cd android && $gradle_cmd bundleRelease $gradle_opts
            # 제출 직전 마지막 관문. 채널이 없으면 exit 1 로 여기서 멎는다.
            node "$SCRIPT_DIR/verify-store-artifact.mjs" --artifact "$PROJECT_DIR/android/app/build/outputs/bundle/release/app-release.aab"
            print_success "AAB 생성 완료: android/app/build/outputs/bundle/release/app-release.aab"
        fi
    elif [ "$platform" = "ios" ]; then
        print_warning "iOS 로컬 빌드는 Xcode가 필요합니다. 프로젝트를 엽니다..."
        # Xcode 로 Archive 한 .ipa 는 이 스크립트가 볼 수 없다. 프로젝트 쪽 채널만
        # 확인해 주고, 제출 전에 산출물을 직접 검증하도록 안내한다.
        node "$SCRIPT_DIR/verify-store-artifact.mjs" --native
        print_warning "Archive 후 제출 전에 반드시 실행: npm run verify:store -- --artifact <경로.ipa>"
        open ios/*.xcworkspace
    fi
}

# ============================================================
# 메뉴 함수
# ============================================================

show_current_info() {
    echo ""
    echo -e "${YELLOW}현재 버전 정보:${NC}"
    echo "  버전:       $(get_version)"
    echo "  버전 코드:  $(get_version_code)"
    if [ "$LOW_PRIORITY" = true ]; then
        echo -e "  CPU 모드:   ${GREEN}여유 모드 (workers=$MAX_WORKERS)${NC}"
    else
        echo -e "  CPU 모드:   ${RED}전력 모드 (모든 코어 사용)${NC}"
    fi
    echo ""
}

select_platform() {
    echo "" >&2
    echo -e "${CYAN}플랫폼 선택:${NC}" >&2
    echo "  1) Android" >&2
    echo "  2) iOS" >&2
    echo "  3) 둘 다" >&2
    echo "  0) 뒤로" >&2
    echo "" >&2
    read -p "선택: " choice
    echo "$choice"
}

select_build_type() {
    local platform=$1
    echo "" >&2
    echo -e "${CYAN}빌드 유형 선택:${NC}" >&2
    
    if [ "$platform" = "android" ]; then
        echo "  1) APK (테스트/내부 배포)" >&2
        echo "  2) AAB (Play Store 출시)" >&2
    elif [ "$platform" = "ios" ]; then
        echo "  1) 시뮬레이터" >&2
        echo "  2) IPA (App Store 출시)" >&2
    fi
    echo "  0) 뒤로" >&2
    echo "" >&2
    read -p "선택: " choice
    echo "$choice"
}

select_build_env() {
    echo "" >&2
    echo -e "${CYAN}빌드 환경 선택:${NC}" >&2
    echo "  1) 클라우드 (EAS Build)" >&2
    echo "  2) 로컬" >&2
    echo "  0) 뒤로" >&2
    echo "" >&2
    read -p "선택: " choice
    echo "$choice"
}

select_profile() {
    echo "" >&2
    echo -e "${CYAN}프로파일 선택:${NC}" >&2
    echo "  1) Development (개발/디버그)" >&2
    echo "  2) Preview (테스트)" >&2
    echo "  3) Production (출시)" >&2
    echo "  0) 뒤로" >&2
    echo "" >&2
    read -p "선택: " choice
    
    case $choice in
        1) echo "development" ;;
        2) echo "preview" ;;
        3) echo "production" ;;
        *) echo "" ;;
    esac
}

select_version_bump() {
    local current=$(get_version)
    local current_code=$(get_version_code)
    
    echo ""
    echo -e "${CYAN}버전 업데이트:${NC}"
    echo "  현재: $current (코드: $current_code)"
    echo ""
    echo "  1) Patch  $(bump_version patch)  (버그 수정)"
    echo "  2) Minor  $(bump_version minor)  (기능 추가)"
    echo "  3) Major  $(bump_version major)  (대규모 변경)"
    echo "  4) 현재 버전 유지"
    echo "  5) 직접 입력"
    echo "  0) 취소"
    echo ""
    read -p "선택: " choice
    
    case $choice in
        1) 
            new_version=$(bump_version patch)
            new_code=$((current_code + 1))
            ;;
        2)
            new_version=$(bump_version minor)
            new_code=$((current_code + 1))
            ;;
        3)
            new_version=$(bump_version major)
            new_code=$((current_code + 1))
            ;;
        4)
            new_version=$current
            new_code=$current_code
            ;;
        5)
            read -p "버전 입력 (예: 1.2.3): " new_version
            read -p "버전 코드 입력 (정수): " new_code
            ;;
        *)
            return 1
            ;;
    esac
    
    if [ -n "$new_version" ] && [ -n "$new_code" ]; then
        echo ""
        echo -e "${YELLOW}새 버전: $new_version (코드: $new_code)${NC}"
        read -p "확인? (y/n): " confirm
        
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            update_app_json "$new_version" "$new_code"
            print_success "버전 업데이트 완료!"
            return 0
        fi
    fi
    
    return 1
}

# ============================================================
# 빌드 실행
# ============================================================

do_android_build() {
    local build_type=$(select_build_type "android")
    [ "$build_type" = "0" ] && return
    
    local env=$(select_build_env)
    [ "$env" = "0" ] && return
    
    local profile=""
    if [ "$env" = "1" ]; then
        profile=$(select_profile)
        [ -z "$profile" ] && return
    fi
    
    print_header "버전 업데이트"
    select_version_bump || return
    
    echo ""
    print_header "빌드 요약"
    echo "  플랫폼:     Android"
    echo "  유형:       $([ "$build_type" = "1" ] && echo "APK (테스트)" || echo "AAB (출시)")"
    echo "  환경:       $([ "$env" = "1" ] && echo "클라우드 (EAS)" || echo "로컬")"
    [ -n "$profile" ] && echo "  프로파일:   $profile"
    echo "  버전:       $(get_version) (코드: $(get_version_code))"
    echo ""
    read -p "빌드 시작? (y/n): " confirm
    [ "$confirm" != "y" ] && [ "$confirm" != "Y" ] && return
    
    print_header "Android 빌드 중"
    clean_build
    
    if [ "$env" = "1" ]; then
        build_eas "android" "$profile"
    else
        run_prebuild "android"
        if [ "$build_type" = "1" ]; then
            build_local "android" "apk"
        else
            build_local "android" "aab"
        fi
    fi
}

do_ios_build() {
    local build_type=$(select_build_type "ios")
    [ "$build_type" = "0" ] && return
    
    local env=$(select_build_env)
    [ "$env" = "0" ] && return
    
    local profile=""
    if [ "$env" = "1" ]; then
        profile=$(select_profile)
        [ -z "$profile" ] && return
    fi
    
    print_header "버전 업데이트"
    select_version_bump || return
    
    echo ""
    print_header "빌드 요약"
    echo "  플랫폼:     iOS"
    echo "  유형:       $([ "$build_type" = "1" ] && echo "시뮬레이터" || echo "IPA (출시)")"
    echo "  환경:       $([ "$env" = "1" ] && echo "클라우드 (EAS)" || echo "로컬")"
    [ -n "$profile" ] && echo "  프로파일:   $profile"
    echo "  버전:       $(get_version) (코드: $(get_version_code))"
    echo ""
    read -p "빌드 시작? (y/n): " confirm
    [ "$confirm" != "y" ] && [ "$confirm" != "Y" ] && return
    
    print_header "iOS 빌드 중"
    clean_build
    
    if [ "$env" = "1" ]; then
        build_eas "ios" "$profile"
    else
        run_prebuild "ios"
        build_local "ios" ""
    fi
}

# ============================================================
# 빠른 빌드
# ============================================================

quick_build() {
    local platform=$1
    local profile=$2
    local bump=$3
    
    print_header "빠른 빌드: $platform ($profile)"
    
    if [ "$bump" = "bump" ]; then
        local new_version=$(bump_version patch)
        local new_code=$(($(get_version_code) + 1))
        update_app_json "$new_version" "$new_code"
        print_success "버전: $new_version (코드: $new_code)"
    fi
    
    clean_build
    build_eas "$platform" "$profile"
}

# ============================================================
# 메인 메뉴
# ============================================================

main_menu() {
    while true; do
        print_header "매일일독 모바일 빌드 시스템"
        show_current_info
        
        echo -e "${CYAN}메인 메뉴:${NC}"
        echo "  1) Android 빌드"
        echo "  2) iOS 빌드"
        echo "  3) 둘 다 빌드"
        echo ""
        echo "  --- 빠른 빌드 (자동 버전 업) ---"
        echo "  4) Android Preview (APK 테스트용)"
        echo "  5) Android Production (AAB 출시용)"
        echo "  6) iOS Production (출시용)"
        echo ""
        echo "  --- 유틸리티 ---"
        echo "  7) 캐시 정리만"
        echo "  8) 버전 관리"
        if [ "$LOW_PRIORITY" = true ]; then
            echo -e "  9) CPU 모드: ${GREEN}여유 모드${NC} → 전력 모드로 변경"
        else
            echo -e "  9) CPU 모드: ${RED}전력 모드${NC} → 여유 모드로 변경"
        fi
        echo ""
        echo "  0) 종료"
        echo ""
        read -p "선택: " choice
        
        case $choice in
            1) do_android_build ;;
            2) do_ios_build ;;
            3) 
                do_android_build
                do_ios_build
                ;;
            4) quick_build "android" "preview" "bump" ;;
            5) quick_build "android" "production" "bump" ;;
            6) quick_build "ios" "production" "bump" ;;
            7) 
                print_header "빌드 캐시 정리"
                clean_build
                read -p "계속하려면 Enter..."
                ;;
            8)
                print_header "버전 관리"
                select_version_bump
                read -p "계속하려면 Enter..."
                ;;
            9)
                if [ "$LOW_PRIORITY" = true ]; then
                    LOW_PRIORITY=false
                    print_success "전력 모드로 변경 (모든 코어 사용)"
                else
                    LOW_PRIORITY=true
                    print_success "여유 모드로 변경 (workers=$MAX_WORKERS, nice=10)"
                fi
                sleep 1
                ;;
            0) 
                echo ""
                print_success "종료합니다!"
                exit 0
                ;;
            *)
                print_error "잘못된 선택입니다"
                ;;
        esac
    done
}

# ============================================================
# 진입점
# ============================================================

if [ ! -f "$APP_JSON" ]; then
    print_error "app.json을 찾을 수 없습니다. mobile 디렉토리에서 실행하세요."
    exit 1
fi

for arg in "$@"; do
    case "$arg" in
        --low-priority|--slow)
            LOW_PRIORITY=true
            ;;
        --workers=*)
            MAX_WORKERS="${arg#*=}"
            ;;
    esac
done

case "$1" in
    --android-preview)
        quick_build "android" "preview" "bump"
        ;;
    --android-production)
        quick_build "android" "production" "bump"
        ;;
    --ios-production)
        quick_build "ios" "production" "bump"
        ;;
    --clean)
        clean_build
        ;;
    --help|-h)
        echo "사용법: $0 [옵션]"
        echo ""
        echo "옵션:"
        echo "  (없음)               대화형 메뉴"
        echo "  --android-preview    Android APK 빠른 빌드"
        echo "  --android-production Android AAB 빠른 빌드"
        echo "  --ios-production     iOS 빠른 빌드"
        echo "  --clean              캐시 정리만"
        echo ""
        echo "CPU 제한 옵션:"
        echo "  --low-priority       여유 모드 (nice=10, 워커 제한)"
        echo "  --workers=N          워커 수 지정 (기본: 4)"
        echo ""
        echo "예시:"
        echo "  $0 --low-priority              여유 모드로 메뉴 실행"
        echo "  $0 --android-preview --slow    여유 모드로 APK 빌드"
        echo ""
        ;;
    --low-priority|--slow|--workers=*)
        main_menu
        ;;
    *)
        main_menu
        ;;
esac
