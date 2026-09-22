import type { Metadata, Viewport } from "next";
import { Reem_Kufi, Tajawal } from "next/font/google";
import { DEFAULT_LOCALE, LOCALE_COOKIE, dirOf } from "@/lib/i18n";
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
  // شريط المتصفح على الجوّال بلون الصفحة نفسها: الأخضر الغامق السابق كان
  // يضع شريطًا قاتمًا فوق واجهة فاتحة
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8ef" },
    { media: "(prefers-color-scheme: dark)", color: "#14201b" },
  ],
};

/**
 * يضبط اللغة والاتجاه من الكوكي قبل أول رسم.
 *
 * لو تُرك الأمر لـ React لظهرت الصفحة للإنجليزي من اليمين لليسار ثم قفزت —
 * وانزياح التخطيط بعد الرسم أسوأ من تأخير سطر واحد قبله. ويبقى التبديل
 * مقروءًا لقارئات الشاشة لأن الوسمين يُضبطان على العنصر الجذر نفسه.
 */
const SET_DIR = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)/);var l=m&&decodeURIComponent(m[1]);if(l==="en"){document.documentElement.lang="en";document.documentElement.dir="ltr"}}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // العربية ثابتة في HTML المُرسَل من الخادم. قراءة الكوكي هنا كانت تجعل كل
  // صفحة في التطبيق ديناميكية — بما فيها الصفحات العامّة التي لا تخصّ
  // مستخدمًا بعينه — فتسقط كل إمكانية للتخزين على الحافة.
  return (
    <html
      lang={DEFAULT_LOCALE}
      dir={dirOf(DEFAULT_LOCALE)}
      className={`${display.variable} ${body.variable}`}
      // السكربت أدناه يغيّر lang و dir قبل أن يبدأ React، فيرى React وسمين
      // يخالفان ما أرسله الخادم ويحذّر من عدم تطابق. الكتم هنا مقصود ومحصور
      // في هذا العنصر: الاختلاف مقصود، وبدونه يعيد React الاتجاه إلى العربية.
      suppressHydrationWarning
    >
      {/* لا <head> صريح: Netlify يحقن تعليقًا داخل head في كل صفحة، وعنصر
          head يرسم React أبناءه يُطابَق عقدةً عقدة، فيصطدم بالتعليق الغريب
          (خطأ #418) ويرمي HTML الخادم كلّه ليعيد رسم الصفحة في المتصفح. head
          الذي يديره Next وحده يتسامح React مع ما يُحقَن فيه.
          والسكربت في أول body ما زال قبل أي محتوى، فيسبق أول رسم كما كان. */}
      <body>
        <script dangerouslySetInnerHTML={{ __html: SET_DIR }} />
        {children}
      </body>
    </html>
  );
}
