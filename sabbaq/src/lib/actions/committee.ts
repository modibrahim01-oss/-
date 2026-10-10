"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { TIERS } from "@/lib/tiers";
import type { AwardResult } from "@/lib/types";

/**
 * نقاط إضافية من اللجنة القيمية. كل التحقق (الصلاحية، المستلم، القفل، الكمية،
 * نطاق المجموعات) في دوال 0007؛ هنا تحقّق شكلي وترجمة الرفض لما تعرضه الواجهة.
 */

export type CommitteeResult = { ok: true } | { ok: false; reason: CommitteeReason };
export type CommitteeReason =
  | "forbidden"
  | "invalid"
  | "not_available"
  | "exhausted"
  | "scope"
  | "unavailable"
  | "unknown";

function reasonOf(message: string, code?: string): CommitteeReason {
  if (message.includes("NOT_VALUE_COMMITTEE")) return "forbidden";
  if (message.includes("INVALID_RECIPIENT") || message.includes("GRANT_INVALID")) return "invalid";
  if (message.includes("GRANT_NOT_AVAILABLE")) return "not_available";
  if (message.includes("GRANT_TIER_EXHAUSTED")) return "exhausted";
  if (message.includes("STUDENT_OUT_OF_SCOPE")) return "scope";
  if (code === "PGRST202") return "unavailable";
  return "unknown";
}

const grantId = z.number().int().positive();

export async function sendGrant(formData: FormData): Promise<CommitteeResult> {
  const recipient = z.string().uuid().safeParse(formData.get("recipient"));
  const title = z.string().trim().min(2).max(120).safeParse(formData.get("title"));
  const note = z.string().trim().max(500).safeParse(formData.get("note") ?? "");
  if (!recipient.success || !title.success || !note.success) return { ok: false, reason: "invalid" };

  const items: Record<string, number> = {};
  for (const tier of TIERS) {
    const n = z.coerce.number().int().min(0).max(50).safeParse(formData.get(`tier:${tier}`) ?? 0);
    if (!n.success) return { ok: false, reason: "invalid" };
    if (n.data > 0) items[tier] = n.data;
  }
  if (Object.keys(items).length === 0) return { ok: false, reason: "invalid" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("send_committee_grant", {
    p_recipient: recipient.data,
    p_title: title.data,
    p_note: note.data || null,
    p_items: items,
  });
  if (error) return { ok: false, reason: reasonOf(error.message ?? "", error.code) };
  revalidatePath("/supervisor");
  return { ok: true };
}

export async function unlockGrant(id: number): Promise<CommitteeResult> {
  if (!grantId.safeParse(id).success) return { ok: false, reason: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("unlock_committee_grant", { p_grant: id });
  if (error) return { ok: false, reason: reasonOf(error.message ?? "", error.code) };
  return { ok: true };
}

export async function cancelGrant(id: number): Promise<CommitteeResult> {
  if (!grantId.safeParse(id).success) return { ok: false, reason: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_committee_grant", { p_grant: id });
  if (error) return { ok: false, reason: reasonOf(error.message ?? "", error.code) };
  revalidatePath("/supervisor");
  return { ok: true };
}

export type GrantAwardOutcome = { ok: true; result: AwardResult } | { ok: false; reason: CommitteeReason };

export async function awardFromGrant(id: number, studentId: string, tier: string): Promise<GrantAwardOutcome> {
  const parsed = z
    .tuple([grantId, z.string().uuid(), z.enum(TIERS)])
    .safeParse([id, studentId, tier]);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("award_from_grant", {
    p_grant: id,
    p_student_id: studentId,
    p_tier: tier,
  });
  if (error) return { ok: false, reason: reasonOf(error.message ?? "", error.code) };

  revalidatePath(`/farm/${studentId}`);
  revalidatePath("/tv");
  revalidatePath("/");
  return { ok: true, result: data as AwardResult };
}
