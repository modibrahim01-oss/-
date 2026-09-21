import type { Metadata, Viewport } from "next";
import { Reem_Kufi, Tajawal } from "next/font/google";
import "./globals.css";

// خطوط مُستضافة ذاتيًا: لا طلب لجوجل وقت التشغيل ولا انزياح تخطيط عند
// تحميلها — يهمّ على شاشات المدرسة التي تُعيد التحميل باستمرار.
const display = Reem_Kufi({
  subsets: ["arabic", "latin"],
  weight: ["500", "700"],
  variable: "--font-display-loaded",
  display: "swap",
});

const body = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-body-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "سبّاق · Sabbaq",
  description: "نظام تحفيز الطلاب بالنقاط والمزارع الافتراضية",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2f6f4e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
