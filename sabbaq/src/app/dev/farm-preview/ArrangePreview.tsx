"use client";

import { useState } from "react";
import FarmScene from "@/components/FarmScene";
import type { Plant } from "@/lib/types";

/** معاينة وضع الترتيب بلا قاعدة بيانات: النقلات تُعرض ولا تُحفظ. */
export default function ArrangePreview({ plants }: { plants: Plant[] }) {
  const [log, setLog] = useState<string[]>([]);
  return (
    <>
      <FarmScene
        plants={plants}
        arrange={{
          onMove: (moves) =>
            setLog((prev) => [...prev, moves.map((m) => `${m.slot}→(${m.x},${m.y})`).join(" ")].slice(-6)),
        }}
      />
      <pre
        data-testid="arrange-log"
        style={{
          position: "absolute",
          bottom: 12,
          insetInlineStart: 12,
          margin: 0,
          background: "rgba(0,0,0,0.6)",
          color: "#f0e4c2",
          padding: "8px 12px",
          borderRadius: 10,
          fontSize: 12,
          zIndex: 5,
        }}
      >
        {log.length ? log.join("\n") : "arrange: drag a plant"}
      </pre>
    </>
  );
}
