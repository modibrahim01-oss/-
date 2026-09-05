import type { ReactNode } from "react";
import { clsx } from "clsx";

export function Card({
  children,
  className,
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={clsx("bg-white rounded-2xl border shadow-sm", className)}>
      {title || action ? (
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-800">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}
