import Link from "next/link";
import { clsx } from "clsx";
import type { OrderWithClient } from "@/lib/data";
import { formatDate, formatPct, formatSAR } from "@/lib/format";
import { isLowMargin } from "@/lib/finance";

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  active: "جاري",
  completed: "مكتمل",
  cancelled: "ملغي",
};

function MarginBadge({ marginPct }: { marginPct: number }) {
  const low = isLowMargin(marginPct);
  return (
    <span
      className={clsx(
        "inline-block rounded-md px-2 py-0.5 text-xs font-medium",
        low ? "bg-danger-50 text-danger-700" : "bg-brand-50 text-brand-700",
      )}
    >
      <span className="nums">{formatPct(marginPct)}</span>
    </span>
  );
}

function ReviewBadge() {
  return (
    <span className="inline-block rounded-md bg-warn-50 text-warn-700 px-2 py-0.5 text-xs font-medium">
      يحتاج مراجعة
    </span>
  );
}

export function OrdersList({
  orders,
  showRep = false,
  basePath = "/orders",
}: {
  orders: OrderWithClient[];
  showRep?: boolean;
  basePath?: string;
}) {
  if (orders.length === 0) {
    return <p className="text-sm text-gray-500 py-6 text-center">لا توجد طلبات</p>;
  }

  return (
    <>
      {/* بطاقات على الجوال */}
      <ul className="space-y-3 md:hidden">
        {orders.map((order) => (
          <li key={order.id}>
            <Link
              href={`${basePath}/${order.id}`}
              className="block rounded-xl border p-3 hover:border-brand-500"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{order.client?.name ?? "—"}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    طلب <span className="nums">{order.order_number}</span> ·{" "}
                    <span className="nums">{formatDate(order.order_date)}</span>
                  </p>
                </div>
                <MarginBadge marginPct={order.margin_pct} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-gray-500">سعر العميل</dt>
                <dd className="text-left nums">{formatSAR(order.client_price)}</dd>
                <dt className="text-gray-500">الربح</dt>
                <dd className="text-left nums">{formatSAR(order.profit)}</dd>
                <dt className="text-gray-500">عمولتي</dt>
                <dd className="text-left nums">{formatSAR(order.rep_share)}</dd>
              </dl>
              {order.needs_review ? (
                <div className="mt-2">
                  <ReviewBadge />
                </div>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      {/* جدول على الشاشات الأكبر */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-right border-b">
              <th className="py-2 font-medium">#</th>
              <th className="py-2 font-medium">العميل</th>
              {showRep ? <th className="py-2 font-medium">المندوب</th> : null}
              <th className="py-2 font-medium">التاريخ</th>
              <th className="py-2 font-medium">التكلفة</th>
              <th className="py-2 font-medium">سعر العميل</th>
              <th className="py-2 font-medium">الربح</th>
              <th className="py-2 font-medium">الهامش</th>
              <th className="py-2 font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-2">
                  <Link href={`${basePath}/${order.id}`} className="text-brand-600 hover:underline nums">
                    {order.order_number}
                  </Link>
                </td>
                <td className="py-2">
                  {order.client?.name ?? "—"}
                  {order.needs_review ? (
                    <span className="mr-2 inline-block align-middle">
                      <ReviewBadge />
                    </span>
                  ) : null}
                </td>
                {showRep ? <td className="py-2">{order.rep?.full_name ?? "—"}</td> : null}
                <td className="py-2 nums">{formatDate(order.order_date)}</td>
                <td className="py-2 nums">{formatSAR(order.factory_cost)}</td>
                <td className="py-2 nums">{formatSAR(order.client_price)}</td>
                <td className="py-2 nums">{formatSAR(order.profit)}</td>
                <td className="py-2">
                  <MarginBadge marginPct={order.margin_pct} />
                </td>
                <td className="py-2 text-gray-600">{STATUS_LABELS[order.status] ?? order.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
