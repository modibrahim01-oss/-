import { defineConfig } from 'vitest/config'

// منفصل عن vite.config.ts لأن Vitest يحمل نسخته الخاصة من Vite،
// ودمج الاثنين في ملف واحد يُنتج تعارض أنواع في المكوّنات الإضافية.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
