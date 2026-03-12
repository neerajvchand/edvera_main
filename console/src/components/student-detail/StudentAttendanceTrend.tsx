import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { RiskSignal } from "@/hooks/useStudentDetail";
import { MONTH_NAMES } from "@/hooks/useStudentDetail";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface MonthlyPoint {
  month: string;
  rate: number;
  present: number;
  total: number;
}

function rateColor(rate: number): string {
  if (rate >= 95) return "text-emerald-600";
  if (rate >= 90) return "text-amber-600";
  return "text-red-600";
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function StudentAttendanceTrend({
  signal,
  allAttendance,
}: {
  signal: RiskSignal | null;
  allAttendance: { calendar_date: string; canonical_type: string }[];
}) {
  const monthlyData = useMemo<MonthlyPoint[]>(() => {
    if (allAttendance.length === 0) return [];

    const buckets = new Map<string, { present: number; total: number }>();

    for (const rec of allAttendance) {
      const d = new Date(rec.calendar_date + "T00:00:00");
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const bucket = buckets.get(key) ?? { present: 0, total: 0 };
      bucket.total++;
      if (rec.canonical_type === "present") bucket.present++;
      buckets.set(key, bucket);
    }

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        month: MONTH_NAMES[parseInt(key.split("-")[1])],
        rate: val.total > 0 ? Math.round((val.present / val.total) * 1000) / 10 : 0,
        present: val.present,
        total: val.total,
      }));
  }, [allAttendance]);

  const last30 = signal?.last_30_rate ?? null;
  const prev30 = signal?.previous_30_rate ?? null;
  const trendUp = last30 !== null && prev30 !== null ? last30 > prev30 : null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-base font-semibold text-slate-900 mb-3">Attendance Trend</h2>
      {monthlyData.length > 0 ? (
        <>
          <div className="h-[220px] lg:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <defs>
                  <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload as MonthlyPoint;
                    return (
                      <div className="bg-white rounded-lg shadow-lg border border-gray-100 p-2 text-xs">
                        <p className="font-semibold text-slate-900">{d.month}: {d.rate}%</p>
                        <p className="text-slate-500">{d.present}/{d.total} days present</p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={90} stroke="#fca5a5" strokeDasharray="6 3" label={{ value: "90%", position: "right", fill: "#f87171", fontSize: 10 }} />
                <Area type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} fill="url(#rateGradient)" dot={{ r: 3, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {last30 !== null && prev30 !== null && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
              <div className="text-sm">
                <span className="text-slate-500">30-day rate: </span>
                <span className={cn("font-semibold tabular-nums", rateColor(last30))}>{last30.toFixed(1)}%</span>
              </div>
              <div className="text-sm">
                <span className="text-slate-500">Prior 30-day: </span>
                <span className="font-medium tabular-nums text-slate-700">{prev30.toFixed(1)}%</span>
              </div>
              {trendUp !== null && (
                trendUp ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : last30 < prev30 ? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                ) : (
                  <Minus className="h-4 w-4 text-slate-400" />
                )
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-[220px] text-sm text-slate-400">
          No attendance data available for chart
        </div>
      )}
    </div>
  );
}
