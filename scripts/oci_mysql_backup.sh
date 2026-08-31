#!/usr/bin/env bash
# maeil1dok OCI MySQL 일일 백업 — mysqldump → gzip → 로컬 보존 (+ 선택 OCI Object Storage 업로드).
#
# cron 예 (매일 03:20 KST):
#   CRON_TZ=Asia/Seoul
#   20 3 * * * /opt/maeil1dok/scripts/oci_mysql_backup.sh >> /var/log/maeil1dok_mysql_backup.log 2>&1
#
# 필요 env (.env.oci 에서 로드하거나 cron 환경에 지정):
#   DB_NAME, DB_ROOT_PASSWORD(권장) 또는 DB_USER+DB_PASSWORD
#   COMPOSE_FILE(기본 docker-compose.oci.yml), BACKUP_DIR, RETENTION_DAYS(기본 14)
#   OCI_BUCKET / OCI_NAMESPACE (설정 시 oci CLI 로 오프호스트 업로드; oci 없으면 실패로 처리)
set -euo pipefail
umask 077   # 민감한 전체 DB 덤프가 world-readable 로 생성되지 않도록

cd "$(dirname "$0")/.."

# .env.oci 에서 필요한 키만 Compose dotenv-호환 방식으로 추출(값 실행 방지).
# 규칙: 따옴표 없는 값은 공백+# 인라인 주석 제거 + 앞뒤 공백 트림; 따옴표 값은 1쌍만 제거.
if [ -f .env.oci ]; then
  while IFS= read -r line; do
    case "$line" in \#*|'') continue ;; esac
    key="${line%%=*}"
    val="${line#*=}"
    case "$key" in
      OCI_DATA_ROOT|DB_NAME|DB_USER|DB_PASSWORD|DB_ROOT_PASSWORD|OCI_BUCKET|OCI_NAMESPACE|RETENTION_DAYS|BACKUP_DIR|COMPOSE_FILE)
        val="${val%$'\r'}"                       # CR 제거
        case "$val" in
          \"*|\'*) : ;;                          # 따옴표로 시작: 인라인 주석/트림 미적용
          *) val="$(printf '%s' "$val" | sed -e 's/[[:space:]]#.*$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')" ;;
        esac
        val="${val#[\"\']}"; val="${val%[\"\']}" # 양끝 따옴표 1쌍 제거
        export "$key=$val" ;;
    esac
  done < .env.oci
fi

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.oci.yml}"
DB_NAME="${DB_NAME:-maeil1dok}"
# 크리덴셜은 반드시 짝으로: root+DB_ROOT_PASSWORD (권장) 또는 DB_USER+DB_PASSWORD.
if [ -n "${DB_ROOT_PASSWORD:-}" ]; then
  DUMP_USER="root"; DUMP_PW="$DB_ROOT_PASSWORD"
elif [ -n "${DB_USER:-}" ] && [ -n "${DB_PASSWORD:-}" ]; then
  DUMP_USER="$DB_USER"; DUMP_PW="$DB_PASSWORD"
else
  echo "[$(date -Is)] ERROR: DB_ROOT_PASSWORD 또는 DB_USER+DB_PASSWORD 가 필요합니다." >&2
  exit 1
fi
BACKUP_DIR="${BACKUP_DIR:-${OCI_DATA_ROOT:-/mnt/data/maeil1dok}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="${BACKUP_DIR}/${DB_NAME}_${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" || true

echo "[$(date -Is)] mysqldump 시작 → ${OUT}"
# --single-transaction: InnoDB 일관 스냅샷(락 최소). 트리거/루틴/이벤트 포함, utf8mb4.
docker compose -f "$COMPOSE_FILE" exec -T -e MYSQL_PWD="$DUMP_PW" mysql \
  mysqldump -u"${DUMP_USER}" \
    --single-transaction --routines --triggers --events \
    --default-character-set=utf8mb4 --no-tablespaces \
    "$DB_NAME" | gzip -9 > "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
echo "[$(date -Is)] 백업 완료 (${SIZE})"

# 무결성 확인 (gzip)
gzip -t "$OUT"
echo "[$(date -Is)] gzip 무결성 OK"

# 오프호스트 업로드 (OCI_BUCKET 설정 시 반드시 수행; oci CLI 없으면 실패로 처리)
if [ -n "${OCI_BUCKET:-}" ]; then
  if ! command -v oci >/dev/null 2>&1; then
    echo "[$(date -Is)] ERROR: OCI_BUCKET 설정됐으나 oci CLI 없음 — 오프호스트 업로드 실패." >&2
    exit 1
  fi
  echo "[$(date -Is)] OCI Object Storage 업로드 → ${OCI_BUCKET}"
  oci os object put --bucket-name "$OCI_BUCKET" ${OCI_NAMESPACE:+--namespace "$OCI_NAMESPACE"} \
    --file "$OUT" --name "maeil1dok/$(basename "$OUT")" --force >/dev/null
  echo "[$(date -Is)] 업로드 완료"
fi

# 로컬 무결성 검사와 설정된 오프호스트 업로드까지 모두 성공한 뒤에만 receipt를 갱신한다.
RECEIPT_TMP="${BACKUP_DIR}/.last-success.json.tmp"
SIZE_BYTES="$(wc -c < "$OUT")"
printf '{"completed_at_epoch":%s,"path":"%s","size_bytes":%s}\n' \
  "$(date +%s)" "$OUT" "$SIZE_BYTES" > "$RECEIPT_TMP"
mv "$RECEIPT_TMP" "${BACKUP_DIR}/last-success.json"

# 로컬 보존 정책
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
echo "[$(date -Is)] ${RETENTION_DAYS}일 초과 백업 정리 완료"
