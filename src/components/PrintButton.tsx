"use client";

export function PrintButton({ label = "طباعة / حفظ بصيغة PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
    >
      {label}
    </button>
  );
}
