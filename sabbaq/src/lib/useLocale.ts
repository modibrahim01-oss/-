"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./i18n";

/**
 * اللغة على الصفحات العامّة تُقرأ في المتصفح لا على الخادم.
 *
 * السبب أداء لا ذوق: قراءة الكوكي على الخادم تجعل Next يعتبر الصفحة
 * ديناميكية ويُلغي أي تخزين — فكانت كل زيارة لصفحة مزرعة أو لشاشة العرض
 * ترحل إلى دالة الخادم في أمريكا وترجع. بقراءتها هنا تبقى الصفحات ساكنة
 * تُخدَم من أقرب خادم للزائر، وتبديل اللغة يحدث فورًا بلا طلب شبكة.
 *
 * الخادم يرسل العربية دائمًا، فالقيمة الأولية هنا العربية كذلك — وإلا
 * اختلف ما يرسمه الخادم عمّا يرسمه المتصفح أول مرة.
 */

const EVENT = "sabbaq:locale";

function read(): Locale {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`),
  );
  const value = match?.[1] ? decodeURIComponent(match[1]) : undefined;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_LOCALE);
}

/** يكتب الاختيار ويُعلم كل مَن يستمع في الصفحة نفسها. */
export function setLocale(next: Locale) {
  // سنة كاملة: شاشة المدرسة تُضبط مرة ولا يُعاد ضبطها كل فصل
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = next;
  document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
  window.dispatchEvent(new Event(EVENT));
}
