import { useState, useRef, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  currentAbsentDays: number;
  projectedFutureAbsences: number;
  totalProjectedDays: number;
  perPupilRate: number;
  totalProjectedLoss: number;
  totalRecoverable: number;
  children: ReactNode;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtDollars(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ADALossTooltip({
  currentAbsentDays,
  projectedFutureAbsences,
  totalProjectedDays,
  perPupilRate,
  totalProjectedLoss,
  totalRecoverable,
  children,
}: Props) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(true);
  }

  function handleLeave() {
    timeoutRef.current = setTimeout(() => setVisible(false), 150);
  }

  return (
    <span
      className="relative inline-block cursor-help"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}

      {visible && (
        <span
          className="absolute z-50 bottom-full left-0 mb-2 w-80 rounded-lg bg-gray-900 p-4 shadow-xl pointer-events-auto"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          {/* Tooltip content */}
          <span className="block text-[11px] font-semibold text-white mb-1.5">
            Projected ADA Loss &mdash; How We Calculate This
          </span>
          <span className="block border-t border-gray-700 my-2" />

          <span className="block text-xs text-gray-300 space-y-1.5">
            <span className="flex justify-between gap-4">
              <span className="shrink-0">Absent days to date:</span>
              <span className="text-white font-medium tabular-nums whitespace-nowrap">
                {currentAbsentDays} days
              </span>
            </span>
            <span className="flex justify-between gap-4">
              <span className="shrink-0">Projected future absences:</span>
              <span className="text-white font-medium tabular-nums whitespace-nowrap">
                +{projectedFutureAbsences} days
              </span>
            </span>
            <span className="flex justify-between gap-4">
              <span className="shrink-0">Total projected absences:</span>
              <span className="text-white font-semibold tabular-nums whitespace-nowrap">
                {totalProjectedDays} days
              </span>
            </span>
            <span className="block text-gray-400 pt-0.5">
              &times; ${perPupilRate}/day (CA per-pupil rate)
            </span>
          </span>

          <span className="block border-t border-gray-700 my-2" />

          <span className="flex justify-between text-xs gap-4">
            <span className="text-gray-300">=</span>
            <span className="text-emerald-400 font-semibold tabular-nums">
              {fmtDollars(totalProjectedLoss)}
            </span>
          </span>

          <span className="block mt-2 flex justify-between text-xs gap-4">
            <span className="text-gray-400 shrink-0">
              Recoverable with intervention:
            </span>
            <span className="text-emerald-400 font-semibold tabular-nums whitespace-nowrap">
              {fmtDollars(totalRecoverable)}
            </span>
          </span>

          {/* Arrow */}
          <span className="absolute top-full left-8 border-[6px] border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}
