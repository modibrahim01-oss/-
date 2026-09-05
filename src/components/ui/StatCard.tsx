import { clsx } from "clsx";

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const toneClass = {
    neutral: "text-gray-900",
    good: "text-brand-600",
    warn: "text-warn-700",
    bad: "text-danger-700",
  }[tone];

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={clsx("mt-1 text-xl font-bold", toneClass)}>
        <span className="nums">{value}</span>
      </p>
      {hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
    </div>
  );
}
