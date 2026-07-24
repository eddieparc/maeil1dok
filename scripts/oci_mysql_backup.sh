#!/usr/bin/env bash
# maeil1dok OCI MySQL 일일 백업 — mysqldump → gzip → 로컬 보존 (+ 선택 OCI Object Storage 업로드).
#
# cron 예 (매일 03:20 KST):
#   20 3 * * * /opt/maeil1dok/scripts/oci_mysql_backup.sh >> /var/log/maeil1dok_mysql_backup.log 2>&1
#
# 필요 env (.env.oci 에서 로드하거나 cron 환경에 지정):
#   DB_NAME, DB_USER, DB_PASSWORD (또는 DB_ROOT_PASSWORD)
#   COMPOSE_FILE(기본 docker-compose.oci.yml), BACKUP_DIR, RETENTION_DAYS(기본 14)
#   OCI_BUCKET / OCI_NAMESPACE (설정 시 oci CLI 로 오프호스트 업로드)
set -euo pipefail

cd "$(dirname "$0")/.."

# .env.oci 에서 필요한 키만 안전하게 추출(특수문자 값 실행 방지)
if [ -f .env.oci ]; then
  while IFS='=' read -r k v; do
    case "$k" in
      OCI_DATA_ROOT|DB_NAME|DB_USER|DB_PASSWORD|DB_ROOT_PASSWORD|OCI_BUCKET|OCI_NAMESPACE|RETENTION_DAYS)
        export "$k=$v" ;;
    esac
  done < <(grep -E '^[A-Z_]+=' .env.oci | sed 's/#.*//')
fi

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.oci.yml}"
DB_NAME="${DB_NAME:-maeil1dok}"
DB_USER="${DB_USER:-root}"
DB_PW="${DB_ROOT_PASSWORD:-${DB_PASSWORD:-}}"
BACKUP_DIR="${BACKUP_DIR:-${OCI_DATA_ROOT:-/mnt/data/maeil1dok}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="${BACKUP_DIR}/${DB_NAME}_${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Is)] mysqldump 시작 → ${OUT}"
# --single-transaction: InnoDB 일관 스냅샷(락 최소). 트리거/루틴/이벤트 포함, utf8mb4.
docker compose -f "$COMPOSE_FILE" exec -T mysql \
  mysqldump -u"${DB_USER}" -p"${DB_PW}" \
    --single-transaction --routines --triggers --events \
    --default-character-set=utf8mb4 --no-tablespaces \
    "$DB_NAME" | gzip -9 > "$OUT"

SIZE="$(du -h "$OUT" | cut -f1)"
echo "[$(date -Is)] 백업 완료 (${SIZE})"

# 무결성 확인 (gzip)
gzip -t "$OUT"
echo "[$(date -Is)] gzip 무결성 OK"

# 오프호스트 업로드 (oci CLI 구성 + OCI_BUCKET 설정 시)
if [ -n "${OCI_BUCKET:-}" ] && command -v oci >/dev/null 2>&1; then
  echo "[$(date -Is)] OCI Object Storage 업로드 → ${OCI_BUCKET}"
  oci os object put --bucket-name "$OCI_BUCKET" ${OCI_NAMESPACE:+--namespace "$OCI_NAMESPACE"} \
    --file "$OUT" --name "maeil1dok/$(basename "$OUT")" --force >/dev/null
  echo "[$(date -Is)] 업로드 완료"
fi

# 로컬 보존 정책
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
echo "[$(date -Is)] ${RETENTION_DAYS}일 초과 백업 정리 완료"
