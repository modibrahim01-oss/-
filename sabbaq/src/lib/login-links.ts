import "server-only";
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import QRCode from "qrcode";

/**
 * رموز الدخول والمفاتيح: ٣٢ بايتًا عشوائيًا بترميز base64url (٤٣ حرفًا).
 * طولها يجعل التخمين مستحيلًا عمليًا، فلا حاجة لتحديد المحاولات.
 */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** أصل الموقع كما وصل إليه المدير — فالرابط يفتح النطاق نفسه. */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.URL ?? "https://sapeeq.netlify.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#1d1b3a", light: "#ffffff" },
  });
}

/**
 * بريد داخلي لمشرف أُنشئ بلا إيميل. Supabase يربط الحساب ببريد، و
 * `.invalid` نطاق محجوز (RFC 2606) لا يستقبل بريدًا أبدًا.
 */
export function internalEmail(): string {
  return `staff-${randomBytes(8).toString("hex")}@sabbaq.invalid`;
}
