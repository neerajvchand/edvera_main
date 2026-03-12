import { DollarSign } from "lucide-react";
import type { Snapshot } from "@/hooks/useStudentDetail";

const DAILY_RATE = 65;

export function StudentFundingImpact({ snapshot }: { snapshot: Snapshot | null }) {
  if (!snapshot || snapshot.days_absent === 0) return null;

  const lostFunding = snapshot.days_absent * DAILY_RATE;

  let recoveryAmount: number | null = null;
  if (snapshot.is_chronic_absent && snapshot.days_enrolled > 0) {
    const targetAbsenceDays = Math.round(snapshot.days_enrolled * 0.05);
    const daysRecoverable = Math.max(0, snapshot.days_absent - targetAbsenceDays);
    recoveryAmount = daysRecoverable * DAILY_RATE;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="h-4 w-4 text-slate-400" />
        <h2 className="text-base font-semibold text-slate-900">Funding Impact</h2>
      </div>
      <p className="text-sm text-slate-600">
        This student's absences represent an estimated{" "}
        <span className="font-semibold text-red-600">${lostFunding.toLocaleString()}</span>{" "}
        in lost ADA funding this year.
      </p>
      {recoveryAmount !== null && recoveryAmount > 0 && (
        <p className="text-sm text-slate-600 mt-1.5">
          Recovering this student to 95% attendance would recover{" "}
          <span className="font-semibold text-emerald-600">${recoveryAmount.toLocaleString()}</span>.
        </p>
      )}
    </div>
  );
}
