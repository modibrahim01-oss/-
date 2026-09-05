"use client";

import { useActionState, useState, useTransition } from "react";
import {
  getAttachmentUrlAction,
  uploadAttachmentAction,
  type UploadState,
} from "@/lib/actions/attachments";
import { formatDate } from "@/lib/format";
import type { AttachmentKind, AttachmentRow } from "@/lib/supabase/types";

const KIND_LABELS: Record<AttachmentKind, string> = {
  plate_design: "تصميم الكليشة",
  factory_invoice: "فاتورة المصنع",
  client_invoice: "فاتورة العميل",
  shipping: "بوليصة الشحن",
  other: "أخرى",
};

const initialState: UploadState = { error: null };

export function AttachmentsPanel({
  orderId,
  attachments,
}: {
  orderId: string;
  attachments: AttachmentRow[];
}) {
  const boundAction = uploadAttachmentAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const [opening, startOpening] = useTransition();
  const [openError, setOpenError] = useState<string | null>(null);

  function open(filePath: string) {
    setOpenError(null);
    startOpening(async () => {
      const url = await getAttachmentUrlAction(filePath);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        setOpenError("تعذّر فتح الملف");
      }
    });
  }

  return (
    <div className="space-y-4">
      {attachments.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
              <button
                type="button"
                onClick={() => open(a.file_path)}
                disabled={opening}
                className="text-brand-600 hover:underline text-right truncate"
              >
                {a.file_name}
              </button>
              <span className="text-gray-500 shrink-0">{KIND_LABELS[a.kind]}</span>
              <span className="text-gray-400 shrink-0 nums">{formatDate(a.uploaded_at)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">لا توجد مرفقات</p>
      )}

      {openError ? <p className="text-sm text-danger-700">{openError}</p> : null}

      <form action={formAction} className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t pt-3">
        <input
          name="file"
          type="file"
          required
          accept="image/*,application/pdf"
          className="text-sm file:ml-2 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5"
        />
        <select name="kind" className="rounded-lg border px-3 py-2 text-sm bg-white">
          {(Object.keys(KIND_LABELS) as AttachmentKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-gray-900 text-white px-3 py-2 text-sm disabled:opacity-60"
        >
          {pending ? "جارٍ الرفع..." : "رفع مرفق"}
        </button>
        {state.error ? (
          <p className="sm:col-span-3 text-sm text-danger-700">{state.error}</p>
        ) : null}
      </form>
      <p className="text-xs text-gray-400">الحد الأقصى لحجم الملف 10 ميجابايت</p>
    </div>
  );
}
