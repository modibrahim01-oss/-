import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // سبّاق تطبيق مستقل داخل مستودع يحتوي مشروعًا آخر بملف قفل خاص به. بدون
  // تثبيت الجذر يختار Next ملف القفل الأعلى ويحذّر من التباس مساحة العمل.
  outputFileTracingRoot: path.join(__dirname),
  transpilePackages: ["three"],
};

export default nextConfig;
