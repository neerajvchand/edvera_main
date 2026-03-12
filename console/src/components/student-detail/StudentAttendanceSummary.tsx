import { cn } from "@/lib/utils";
import type { Snapshot } from "@/hooks/useStudentDetail";

export function StudentAttendanceSummary({ snapshot }: { snapshot: Snapshot }) {
  const statRows: { label: string; value: string; highlight?: boolean }[] = [
    { label: "Days Enrolled", value: String(snapshot.days_enrolled) },
    { label: "Days Present", value: String(snapshot.days_present) },
    { label: "Days Absent (Total)", value: String(snapshot.days_absent), highlight: snapshot.days_absent > 15 },
    { label: "Days Excused", value: String(snapshot.days_absent_excused) },
    { label: "Days Unexcused", value: String(snapshot.days_absent_unexcused), highlight: snapshot.days_absent_unexcused > 5 },
    { label: "Days Tardy", value: String(snapshot.days_tardy) },
    { label: "Truancy Count", value: String(snapshot.days_truant ?? 0), highlight: (snapshot.days_truant ?? 0) > 3 },
    { label: "Attendance Rate", value: `${snapshot.attendance_rate.toFixed(1)}%` },
    { label: "Absence Rate", value: snapshot.days_enrolled > 0 ? `${((snapshot.days_absent / snapshot.days_enrolled) * 100).toFixed(1)}%` : "0%" },
    { label: "ADA Eligible Days", value: String(snapshot.days_present) },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-base font-semibold text-slate-900 mb-3">Attendance Summary</h2>
      <div className="divide-y divide-slate-100">
        {statRows.map((row) => (
          <div key={row.label} className="flex justify-between py-2">
            <span className="text-sm text-slate-500">{row.label}</span>
            <span className={cn("text-sm font-medium tabular-nums", row.highlight ? "text-red-600" : "text-slate-900")}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
