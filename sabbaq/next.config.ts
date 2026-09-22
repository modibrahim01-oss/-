import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // سبّاق تطبيق مستقل داخل مستودع يحتوي مشروعًا آخر بملف قفل خاص به. بدون
  // تثبيت الجذر يختار Next ملف القفل الأعلى ويحذّر من التباس مساحة العمل.
  outputFileTracingRoot: path.join(__dirname),
  transpilePackages: ["three"],

  // مسار قصير يسهل كتابته على جهاز عرض بلا لوحة مفاتيح. معرَّف هنا لا في
  // إعداد المستضيف، فيعمل محليًا وعلى أي مستضيف بنفس الشكل.
  async redirects() {
    return [{ source: "/screen", destination: "/tv", permanent: true }];
  },

  // الترويسات هنا لا في إعداد المستضيف: يطبّقها Next نفسه، فتبقى سارية إن
  // انتقل النشر من مستضيف لآخر بدل أن تُنسى مع الملف القديم.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // SAMEORIGIN لا DENY: وضع العرض قد يُدمَج في صفحة داخلية للشاشات
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
