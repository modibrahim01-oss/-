"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AttachmentKind } from "@/lib/supabase/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (القسم 7.3)
const ALLOWED_KINDS: AttachmentKind[] = [
  "plate_design",
  "factory_invoice",
  "client_invoice",
  "shipping",
  "other",
];

export interface UploadState {
  error: string | null;
  success?: string | null;
}

export async function uploadAttachmentAction(
  orderId: string,
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await requireUser();

  const file = formData.get("file");
  const kindRaw = String(formData.get("kind") ?? "other");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "اختر ملفًا للرفع" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: "حجم الملف يتجاوز 10 ميجابايت" };
  }
  const kind = (ALLOWED_KINDS as string[]).includes(kindRaw)
    ? (kindRaw as AttachmentKind)
    : "other";

  const supabase = await createClient();

  // المسار <order_id>/<timestamp>-<name> — سياسات Storage تستخرج order_id من
  // الجزء الأول من المسار وتتحقق من ملكية الطلب.
  const safeName = file.name.replace(/[^\p{L}\p{N}._-]/gu, "_");
  const path = `${orderId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload(path, file, { contentType: file.type || undefined });

  if (uploadError) return { error: `تعذّر رفع الملف: ${uploadError.message}` };

  const { error: insertError } = await supabase.from("attachments").insert({
    order_id: orderId,
    file_path: path,
    file_name: file.name,
    kind,
    uploaded_by: user.profile.id,
  });

  if (insertError) {
    await supabase.storage.from("attachments").remove([path]);
    return { error: `تعذّر حفظ بيانات المرفق: ${insertError.message}` };
  }

  revalidatePath(`/orders/${orderId}`);
  return { error: null, success: "تم رفع الملف" };
}

/** رابط موقّع مؤقت للتحميل — الحاوية خاصة ولا يمكن الوصول لها بدون توقيع. */
export async function getAttachmentUrlAction(filePath: string): Promise<string | null> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("attachments")
    .createSignedUrl(filePath, 60 * 10);
  return data?.signedUrl ?? null;
}
