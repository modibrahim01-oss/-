/**
 * يحوّل مخرجات vite.config.artifact.ts إلى قصاصة HTML واحدة صالحة للنشر
 * كـ Artifact: بلا <!doctype> ولا <html> ولا <head> ولا <body> — المضيف
 * يضع هذا الغلاف بنفسه.
 *
 *   npm run build:artifact
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'dist-single')
const assets = join(out, 'assets')

const files = readdirSync(assets)
const jsFile = files.find((f) => f.endsWith('.js'))
const cssFile = files.find((f) => f.endsWith('.css'))
if (!jsFile || !cssFile) throw new Error('لم أجد ملف JS أو CSS في dist-single/assets')

const js = readFileSync(join(assets, jsFile), 'utf8')
const css = readFileSync(join(assets, cssFile), 'utf8')

// خط الواجهة يُجلب بـ @import لأن الغلاف لا يسمح لنا بوضع <link> في الرأس.
// يجب أن يسبق أي قاعدة أخرى في ورقة الأنماط.
const fontImport =
  "@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');\n"

// الاتجاه واللغة كانا على وسم <html> في index.html، ولا نملكه هنا.
const rtlBase = `
html { direction: rtl; color-scheme: dark; }
body { margin: 0; }
`

// بيئة Artifact تمنع الصفحة من تنزيل الملفات بنفسها، فنُركّب دالة الحفظ
// التي يوفّرها المضيف عبر قدرة `downloads`. التطبيق يبحث عن هذا المَنفذ
// ويفضّله على رابط التنزيل المعتاد.
const hostSaveShim = `
window.__saveFile = function (content, fileName) {
  (async function () {
    try {
      var downloads = window.claude && window.claude.use ? await window.claude.use('downloads') : null
      if (!downloads) {
        alert('حفظ الملفات غير متاح في هذه النسخة من التطبيق.')
        return
      }
      await downloads.save({ filename: fileName, data: content })
    } catch (error) {
      if (error && error.code === 'declined') return
      alert('تعذّر حفظ الملف: ' + ((error && error.message) || 'سبب غير معروف'))
    }
  })()
}
`

const page = `<title>دفتر التداول</title>
<style>
${fontImport}${rtlBase}${css}
</style>
<div id="root"></div>
<script>
document.documentElement.setAttribute('lang', 'ar')
document.documentElement.setAttribute('dir', 'rtl')
${hostSaveShim}
</script>
<script type="module">
${js}
</script>
`

const target = join(out, 'daftar-tadawul.html')
writeFileSync(target, page)
console.log(`كُتب ${target} — ${(Buffer.byteLength(page) / 1024).toFixed(0)} كيلوبايت`)
