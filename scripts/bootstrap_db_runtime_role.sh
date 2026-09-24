#!/bin/sh
set -eu

: "${POSTGRES_SERVER:=postgres}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=bre_db}"
: "${POSTGRES_MIGRATION_USER:=bre_user}"
: "${POSTGRES_MIGRATION_PASSWORD:=bre_password}"
: "${POSTGRES_APP_USER:=bre_app}"
: "${POSTGRES_APP_PASSWORD:=bre_app_password}"

export PGPASSWORD="$POSTGRES_MIGRATION_PASSWORD"

psql \
  --host "$POSTGRES_SERVER" \
  --port "$POSTGRES_PORT" \
  --username "$POSTGRES_MIGRATION_USER" \
  --dbname "$POSTGRES_DB" \
  --set ON_ERROR_STOP=1 \
  --set app_user="$POSTGRES_APP_USER" \
  --set app_password="$POSTGRES_APP_PASSWORD" \
  --set database_name="$POSTGRES_DB" \
  --set owner_role="$POSTGRES_MIGRATION_USER" <<'SQL'
SELECT format(
    'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS',
    :'app_user', :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

SELECT format(
    'ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS',
    :'app_user', :'app_password'
)
\gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'database_name', :'app_user')
\gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_user')
\gexec
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', :'app_user')
\gexec
SELECT format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
    :'owner_role', :'app_user'
)
\gexec
SQL
