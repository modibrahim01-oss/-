"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/format";

export interface MonthPoint {
  label: string;
  sales: number;
  profit: number;
}

export function MonthlyChart({ data }: { data: MonthPoint[] }) {
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            reversed
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            orientation="right"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickFormatter={(v: number) => formatNumber(v, 0)}
            axisLine={false}
            tickLine={false}
            width={70}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${formatNumber(value)} ر.س`,
              name === "sales" ? "المبيعات" : "الربح",
            ]}
            labelFormatter={(label: string) => `الشهر: ${label}`}
            contentStyle={{ direction: "rtl", fontFamily: "inherit", fontSize: 12 }}
          />
          <Bar dataKey="sales" fill="#86efac" radius={[4, 4, 0, 0]} name="sales" />
          <Bar dataKey="profit" fill="#16a34a" radius={[4, 4, 0, 0]} name="profit" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
