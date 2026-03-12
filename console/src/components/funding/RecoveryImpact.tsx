import type { SimResult } from "@/hooks/useFunding";

/* ------------------------------------------------------------------ */
/* Recovery Projection (big number + bar)                              */
/* ------------------------------------------------------------------ */

export function RecoveryProjection({
  sim,
  totalLoss,
  sliderValue,
}: {
  sim: SimResult;
  totalLoss: number;
  sliderValue: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <p className="text-sm text-slate-500">Projected Revenue Recovery</p>
      <p className="text-3xl font-bold text-emerald-600 mt-1 tabular-nums">
        ${sim.totalRecovery.toLocaleString()}
      </p>
      <p className="text-sm text-slate-500 mt-1">
        {sliderValue === sim.totalChronic
          ? "100% of projected loss recovered"
          : sliderValue === 0
            ? "Move the slider to model recovery"
            : `Recovers ${sim.recoveryPct.toFixed(0)}% of total projected ADA loss`}
      </p>

      {/* Visual recovery bar */}
      <div className="mt-4">
        <div className="relative h-8 rounded-full overflow-hidden bg-red-100">
          {sim.totalRecovery > 0 && totalLoss > 0 && (
            <div
              className="absolute inset-y-0 left-0 bg-emerald-500 rounded-l-full transition-all duration-300 ease-out flex items-center justify-center"
              style={{
                width: `${Math.min(100, sim.recoveryPct)}%`,
                minWidth: sim.recoveryPct > 0 ? "60px" : "0px",
              }}
            >
              {sim.recoveryPct >= 15 && (
                <span className="text-[11px] font-semibold text-white px-2 truncate">
                  Recovered
                </span>
              )}
            </div>
          )}
          {sim.recoveryPct < 85 && totalLoss > 0 && (
            <div className="absolute inset-y-0 right-0 flex items-center justify-center pr-3">
              <span className="text-[11px] font-semibold text-red-600">
                Remaining loss
              </span>
            </div>
          )}
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-slate-400 tabular-nums">
          <span>$0</span>
          <span>${totalLoss.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Before / After Comparison                                           */
/* ------------------------------------------------------------------ */

export function BeforeAfterComparison({
  sim,
  totalLoss,
}: {
  sim: SimResult;
  totalLoss: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Current state */}
      <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
        <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">
          Current State
        </p>
        <div className="space-y-1.5">
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-red-600 tabular-nums">
              {sim.totalChronic}
            </span>{" "}
            chronically absent
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-red-600 tabular-nums">
              ${totalLoss.toLocaleString()}
            </span>{" "}
            projected loss
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-red-600 tabular-nums">
              {sim.currentChronicRate.toFixed(1)}%
            </span>{" "}
            chronic rate
          </p>
        </div>
      </div>

      {/* After recovery */}
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">
          After Recovery
        </p>
        <div className="space-y-1.5">
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-emerald-600 tabular-nums transition-all duration-200">
              {sim.newChronicCount}
            </span>{" "}
            chronically absent
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-emerald-600 tabular-nums transition-all duration-200">
              ${sim.remainingLoss.toLocaleString()}
            </span>{" "}
            projected loss
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-emerald-600 tabular-nums transition-all duration-200">
              {sim.newChronicRate.toFixed(1)}%
            </span>{" "}
            chronic rate
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Board Presentation Summary                                          */
/* ------------------------------------------------------------------ */

export function BoardSummary({
  sim,
  sliderValue,
}: {
  sim: SimResult;
  sliderValue: number;
}) {
  return (
    <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
      <p className="text-sm text-emerald-800 font-medium leading-relaxed">
        Recovering <span className="font-bold">{sliderValue}</span> student
        {sliderValue !== 1 ? "s" : ""} saves an estimated{" "}
        <span className="font-bold">
          ${sim.totalRecovery.toLocaleString()}
        </span>
        /year
        {sim.teacherEquiv > 0 && (
          <>
            {" "}
            — equivalent to{" "}
            <span className="font-bold">{sim.teacherEquiv}</span> teacher{" "}
            {sim.teacherEquiv !== 1 ? "salaries" : "salary"}
          </>
        )}
        .
      </p>
    </div>
  );
}
