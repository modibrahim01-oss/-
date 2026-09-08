import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * بناء «صفحة واحدة»: كل شيء داخل ملف HTML واحد بلا ملفات جانبية.
 *
 * يختلف عن البناء الأساسي في ثلاثة أمور فقط: لا PWA (لا عامل خدمة ولا
 * manifest)، ولا تقسيم للحزم (شاشة الرسوم تُدمج بدل تحميلها كسولاً)،
 * وكل الأصول تُضمَّن كـ data URI.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-single',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    // نتخلى عن الحزمة الكسولة عمداً — ملف واحد لا يستطيع تحميل جزء لاحقاً.
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
