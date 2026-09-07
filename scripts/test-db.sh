#!/usr/bin/env bash
# يشغّل اختبارات العزل (RLS) والحساب المالي على Postgres محلي.
# يحاكي بيئة Supabase (auth.uid، storage، دور authenticated) ثم يطبّق كل
# ملفات الترحيل ثم اختبارات القسم 11.
#
# الاستخدام:
#   PGHOST=/tmp PGPORT=5433 PGUSER=postgres ./scripts/test-db.sh
set -euo pipefail

DB_NAME="${DB_NAME:-itqan_test}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> إعادة إنشاء قاعدة البيانات $DB_NAME"
psql -q -c "drop database if exists $DB_NAME;" postgres
psql -q -c "create database $DB_NAME;" postgres

echo "==> محاكاة بيئة Supabase"
psql -q -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/00_supabase_shim.sql"

echo "==> تطبيق ملفات الترحيل"
for file in "$ROOT"/supabase/migrations/*.sql; do
  echo "    - $(basename "$file")"
  psql -q -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$file" 2>&1 | grep -v '^NOTICE' || true
done

echo "==> تشغيل اختبارات العزل والحساب"
psql -q -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/01_rls_test.sql"

echo "==> تشغيل اختبارات مسارات الكتابة"
psql -q -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/02_write_paths_test.sql"
