import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/login/actions";
import type { UserRole } from "@/lib/supabase/types";

const REP_NAV = [
  { href: "/dashboard", label: "لوحتي" },
  { href: "/orders", label: "طلباتي" },
  { href: "/orders/new", label: "طلب جديد" },
  { href: "/clients", label: "عملائي" },
  { href: "/account", label: "حسابي" },
  { href: "/notifications", label: "التنبيهات" },
];

const ADMIN_NAV = [
  { href: "/admin", label: "لوحة الشركة" },
  { href: "/admin/orders", label: "كل الطلبات" },
  { href: "/admin/reps", label: "أداء المندوبين" },
  { href: "/admin/clients", label: "تحليل العملاء" },
  { href: "/admin/users", label: "المستخدمون" },
  { href: "/admin/withdrawals", label: "المسحوبات" },
  { href: "/admin/reports", label: "التقارير" },
  { href: "/admin/audit", label: "سجل التدقيق" },
  { href: "/admin/import", label: "الاستيراد" },
  { href: "/notifications", label: "التنبيهات" },
];

export function AppShell({
  children,
  role,
  fullName,
}: {
  children: ReactNode;
  role: UserRole;
  fullName: string;
}) {
  const nav = role === "admin" ? ADMIN_NAV : REP_NAV;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="font-bold text-brand-700 shrink-0">
            إتقان المقاس
          </Link>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm text-gray-600 hidden sm:inline">{fullName}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-danger-700 px-2 py-1 rounded"
              >
                خروج
              </button>
            </form>
          </div>
        </div>

        <nav className="max-w-6xl mx-auto px-2 pb-2 flex gap-1 overflow-x-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-sm px-3 py-1.5 rounded-lg text-gray-600 hover:bg-brand-50 hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5">{children}</main>
    </div>
  );
}
