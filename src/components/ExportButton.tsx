"use client";

import { useState } from "react";

export function ExportButton({
  rows,
  fileName,
  sheetName,
  label = "تصدير Excel",
}: {
  rows: Record<string, string | number>[];
  fileName: string;
  sheetName: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/export/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, fileName, sheetName }),
      });
      if (!response.ok) throw new Error("فشل التصدير");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("تعذّر التصدير");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-xs text-danger-700">{error}</span> : null}
      <button
        type="button"
        onClick={download}
        disabled={pending || rows.length === 0}
        className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
      >
        {pending ? "جارٍ التصدير..." : label}
      </button>
    </div>
  );
}
