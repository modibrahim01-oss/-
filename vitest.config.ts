import { defineConfig, configDefaults } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // sabbaq تطبيق مستقل باختباراته وإعداد vitest الخاص به. نمط الشمول
    // الافتراضي يمسح المستودع كلّه، فيسحب اختباراته إلى هنا حيث `@/*` يشير
    // إلى src المختلف — فتفشل بـ "Cannot find module '@/lib/spiral'". نفس
    // الاستثناء المُعلَن لـ tsconfig و eslint و تتبّع ملفات Next.
    exclude: [...configDefaults.exclude, "sabbaq/**"],
  },
});
