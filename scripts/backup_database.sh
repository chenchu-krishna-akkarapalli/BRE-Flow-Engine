#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "usage: $0 /absolute/path/flowbre.dump" >&2
  exit 2
fi

output_path=$1
case "$output_path" in
  /*) ;;
  *) echo "backup path must be absolute" >&2; exit 2 ;;
esac

: "${POSTGRES_MIGRATION_USER:=bre_user}"
: "${POSTGRES_DB:=bre_db}"

umask 077
docker compose exec -T postgres pg_dump \
  --username "$POSTGRES_MIGRATION_USER" \
  --dbname "$POSTGRES_DB" \
  --format custom \
  --no-owner \
  --no-privileges > "$output_path"

test -s "$output_path"
echo "$output_path"
