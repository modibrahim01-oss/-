import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // مشروع trading/ مستقل بمكدّسه واختباراته — يُشغَّل من مجلده
    exclude: ["node_modules/**", "trading/**"],
  },
});
