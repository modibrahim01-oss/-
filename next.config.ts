import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // المستودع يحتوي تطبيق sabbaq بملف قفل خاص به. بدون تثبيت الجذر يختار
  // Next أحد الملفين بلا تحديد، فيصبح تتبّع ملفات النشر رهنًا بأيّهما وقع
  // عليه الاختيار.
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
