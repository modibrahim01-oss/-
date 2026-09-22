"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function signIn(_prev: { error?: string } | null, formData: FormData) {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return { error: "invalid" };

  // مسار العودة يُقبل فقط إن كان مسارًا داخليًا. بدون هذا القيد يصبح
  // ?next=https://... تحويلًا مفتوحًا يُستغل في التصيّد. المحرف الثاني يُفحص
  // لا `//` وحدها: المتصفحات تطبّع `/\evil.com` إلى رابط بروتوكول-نسبي أيضًا.
  const target = parsed.data.next;
  const safe =
    target && /^\/(?![/\\])/.test(target) ? target : "/supervisor";
  redirect(safe);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
