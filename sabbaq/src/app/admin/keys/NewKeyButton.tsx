"use client";

import { useTransition } from "react";
import { rotateFarmKey } from "@/lib/actions/admin";

export default function NewKeyButton({ studentId, label, confirm }: { studentId: string; label: string; confirm: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="no-print"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(confirm)) return;
        startTransition(async () => {
          await rotateFarmKey(studentId);
        });
      }}
      style={{
        font: "inherit",
        fontSize: 12,
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: 999,
        border: "2px solid #1d1b3a",
        background: "#fff",
        color: "#1d1b3a",
        cursor: "pointer",
        opacity: pending ? 0.6 : 1,
      }}
    >
      ↻ {label}
    </button>
  );
}
