#!/bin/sh
set -eu

backup_dir="${BACKUP_DIR:-/backups/maeil1dok}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"
stamp="$(date -u +%Y%m%d-%H%M%S)"
target_dir="${backup_dir}/${stamp}"

required_vars="DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME"
for var_name in $required_vars; do
  eval "value=\${$var_name:-}"
  if [ -z "$value" ]; then
    echo "missing required env: $var_name" >&2
    exit 64
  fi
done

mkdir -p "$target_dir"
chmod 700 "$backup_dir" "$target_dir"

dump_path="${target_dir}/mysql.sql.gz"
checksum_file_name="mysql.sql.gz.sha256"
checksum_path="${target_dir}/${checksum_file_name}"

mysqldump \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --host "$DB_HOST" \
  --port "$DB_PORT" \
  --user "$DB_USER" \
  --password="$DB_PASSWORD" \
  "$DB_NAME" \
  | gzip -9 > "$dump_path"

sha256sum "$dump_path" > "$checksum_path"
sha256sum -c "$checksum_path"

find "$backup_dir" -mindepth 1 -maxdepth 1 -type d -mtime "+$retention_days" -print -exec rm -rf {} \;

bytes="$(wc -c < "$dump_path" | tr -d ' ')"
echo "backup=OK"
echo "path=$dump_path"
echo "bytes=$bytes"
echo "checksum=$checksum_path"
echo "retention_days=$retention_days"
