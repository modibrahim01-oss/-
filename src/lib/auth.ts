import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRow } from "@/lib/supabase/types";

export interface CurrentUser {
  authId: string;
  email: string | null;
  profile: UserRow;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single<UserRow>();

  if (!profile) return null;

  return { authId: user.id, email: user.email ?? null, profile };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profile.is_active) redirect("/login?disabled=1");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.profile.role !== "admin") redirect("/");
  return user;
}
