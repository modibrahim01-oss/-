"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { updateStageAction } from "@/lib/actions/orders";
import { STAGES, type OrderStageRow, type StageName, type StageState } from "@/lib/supabase/types";

const STAGE_LABELS: Record<StageName, string> = {
  plate: "الكليشة",
  mold: "القالب",
  processing: "قيد التنفيذ",
  ordered_from_factory: "طُلب من المصنع",
  carton_ready: "الكرتون جاهز",
  shipped: "تم الشحن",
  received: "تم الاستلام",
};

const STATE_LABELS: Record<StageState, string> = {
  not_yet: "لم يبدأ",
  in_progress: "جاري",
  done: "تم",
};

// تحديث المرحلة بضغطة واحدة: كل ضغطة تنقلها للحالة التالية في الدورة،
// لأن التعبئة اليدوية المرهقة هي سبب بقاء أعمدة الحالة فارغة في الإكسل.
const NEXT_STATE: Record<StageState, StageState> = {
  not_yet: "in_progress",
  in_progress: "done",
  done: "not_yet",
};

export function StageBar({
  orderId,
  stages,
  readOnly = false,
}: {
  orderId: string;
  stages: OrderStageRow[];
  readOnly?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState<Record<string, StageState>>(
    Object.fromEntries(stages.map((s) => [s.stage, s.state])),
  );

  function cycle(stage: StageName) {
    if (readOnly || pending) return;
    const next = NEXT_STATE[local[stage] ?? "not_yet"];
    setLocal((prev) => ({ ...prev, [stage]: next }));
    startTransition(async () => {
      await updateStageAction(orderId, stage, next);
    });
  }

  return (
    <ol className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {STAGES.map((stage) => {
        const state = local[stage] ?? "not_yet";
        return (
          <li key={stage}>
            <button
              type="button"
              onClick={() => cycle(stage)}
              disabled={readOnly || pending}
              className={clsx(
                "w-full rounded-xl border p-3 text-center transition",
                state === "done" && "bg-brand-500 text-white border-brand-600",
                state === "in_progress" && "bg-warn-50 text-warn-700 border-warn-500",
                state === "not_yet" && "bg-white text-gray-500",
                !readOnly && "hover:border-brand-500 active:scale-[0.98]",
              )}
            >
              <span className="block text-xs font-medium">{STAGE_LABELS[stage]}</span>
              <span className="block text-[11px] mt-1 opacity-80">{STATE_LABELS[state]}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
