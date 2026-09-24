"use client";

import { buttonStyle } from "@/components/ui";

export default function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="press" onClick={() => window.print()} style={buttonStyle("primary")}>
      {label}
    </button>
  );
}
