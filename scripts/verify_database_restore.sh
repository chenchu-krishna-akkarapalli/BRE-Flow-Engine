#!/bin/sh
set -eu

if [ "$#" -ne 1 ] || [ ! -s "$1" ]; then
  echo "usage: $0 /absolute/path/non-empty-flowbre.dump" >&2
  exit 2
fi

backup_path=$1
: "${POSTGRES_MIGRATION_USER:=bre_user}"
: "${POSTGRES_DB:=bre_db}"
: "${RESTORE_VERIFY_DB:=bre_restore_verify}"

case "$RESTORE_VERIFY_DB" in
  *_restore_verify) ;;
  *) echo "RESTORE_VERIFY_DB must end with _restore_verify" >&2; exit 2 ;;
esac
if [ "$RESTORE_VERIFY_DB" = "$POSTGRES_DB" ]; then
  echo "refusing to restore over the source database" >&2
  exit 2
fi

cleanup() {
  docker compose exec -T postgres dropdb \
    --username "$POSTGRES_MIGRATION_USER" \
    --if-exists "$RESTORE_VERIFY_DB" >/dev/null
}
trap cleanup EXIT INT TERM

cleanup
docker compose exec -T postgres createdb \
  --username "$POSTGRES_MIGRATION_USER" "$RESTORE_VERIFY_DB"
docker compose exec -T postgres pg_restore \
  --username "$POSTGRES_MIGRATION_USER" \
  --dbname "$RESTORE_VERIFY_DB" \
  --no-owner \
  --no-privileges < "$backup_path"

revision=$(docker compose exec -T postgres psql \
  --username "$POSTGRES_MIGRATION_USER" \
  --dbname "$RESTORE_VERIFY_DB" \
  --tuples-only --no-align \
  --command "SELECT version_num FROM alembic_version")
tenant_count=$(docker compose exec -T postgres psql \
  --username "$POSTGRES_MIGRATION_USER" \
  --dbname "$RESTORE_VERIFY_DB" \
  --tuples-only --no-align \
  --command "SELECT count(*) FROM tenant")

test "$revision" = "0010"
test "$tenant_count" -gt 0
echo "restore verified: revision=$revision tenants=$tenant_count"
