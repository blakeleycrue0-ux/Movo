#!/usr/bin/env bash
# Recreates the local test database and applies shim + migrations (storage migration skipped).
set -euo pipefail
PGHOST=${PGHOST:-/tmp}; PGPORT=${PGPORT:-54329}; PGUSER=${PGUSER:-postgres}; DB=${MOVO_TEST_DB:-movo_test}
export PGHOST PGPORT PGUSER
cd "$(dirname "$0")/.."
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/shim.sql
for f in supabase/migrations/*.sql; do
  case "$f" in *storage_realtime*) continue;; esac
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done
echo "Database $DB ready"
