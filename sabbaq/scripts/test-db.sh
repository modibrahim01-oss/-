#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# اختبارات العزل على Postgres حقيقي.
#
# تُنشئ قاعدة مؤقتة، تطبّق ملفات الترحيل بالترتيب فوق محاكاة بيئة Supabase،
# ثم تشغّل اختبارات RLS. الفشل يوقف السكربت بمخرَج غير صفري.
#
# التشغيل:  npm run test:db
# متغيّرات:  PGHOST PGPORT PGUSER (الافتراضي: مقبس محلي)
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

DB="${SABBAQ_TEST_DB:-sabbaq_test}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "▸ إعادة إنشاء قاعدة الاختبار: $DB"
psql -q -tAc "drop database if exists ${DB};" postgres
psql -q -tAc "create database ${DB};" postgres

echo "▸ تطبيق محاكاة Supabase وملفات الترحيل"
for f in \
  "$HERE/supabase/tests/00_supabase_shim.sql" \
  "$HERE/supabase/migrations/0001_schema.sql" \
  "$HERE/supabase/migrations/0002_functions.sql" \
  "$HERE/supabase/migrations/0003_rls.sql" \
  "$HERE/supabase/migrations/0004_seed.sql"
do
  printf '  · %s\n' "$(basename "$f")"
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f"
done

echo "▸ تشغيل اختبارات العزل"
# نرفع مستوى الرسائل لتظهر أسطر PASS، ونعتمد على ON_ERROR_STOP لإيقاف أي فشل
psql -d "$DB" -v ON_ERROR_STOP=1 \
     -c "set client_min_messages='notice';" \
     -f "$HERE/supabase/tests/01_rls_test.sql" 2>&1 \
  | sed -n 's/.*NOTICE:  \(PASS\|FAIL\)  /  \1  /p'

echo ""
echo "▸ تحديث ملف تكافؤ الخوارزمية (SQL ↔ TypeScript)"
mkdir -p "$HERE/tests/fixtures"
psql -d "$DB" -tAF, \
  -c "select n, x, y from generate_series(0, 2999) n, lateral spiral_coord(n);" \
  > "$HERE/tests/fixtures/sql-spiral.csv"
printf '  · %s صف\n' "$(wc -l < "$HERE/tests/fixtures/sql-spiral.csv" | tr -d ' ')"

echo ""
echo "✓ اختبارات قاعدة البيانات نجحت"
