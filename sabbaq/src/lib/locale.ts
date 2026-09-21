import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./i18n";

/**
 * اللغة مخزّنة في كوكي لا في المسار. المزارع تُعرض على شاشات مدرسة برابط
 * ثابت، وتغيير اللغة لا يجب أن يبدّل الرابط المحفوظ على الشاشة.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
