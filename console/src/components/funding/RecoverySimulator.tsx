import { InfoTooltip } from "@/components/InfoTooltip";
import { TARGET_OPTIONS, type SimResult } from "@/hooks/useFunding";
import {
  RecoveryProjection,
  BeforeAfterComparison,
  BoardSummary,
} from "./RecoveryImpact";

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface RecoverySimulatorProps {
  sim: SimResult;
  totalLoss: number;
  sliderValue: number;
  onSliderChange: (v: number) => void;
  dailyRate: number;
  onDailyRateChange: (v: number) => void;
  targetRate: number;
  onTargetRateChange: (v: number) => void;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function RecoverySimulator({
  sim,
  totalLoss,
  sliderValue,
  onSliderChange,
  dailyRate,
  onDailyRateChange,
  targetRate,
  onTargetRateChange,
}: RecoverySimulatorProps) {
  return (
    <div className="mt-8 border-t border-slate-100 pt-8 print:break-before-page">
      <h2 className="text-xl font-semibold text-slate-900 flex items-center mb-6">
        Recovery Simulator
        <InfoTooltip text="Model the revenue impact of improving attendance for chronically absent students. Move students from chronic absence to satisfactory attendance and see the projected ADA funding recovered. Use this to build the budget case for attendance interventions." />
      </h2>

      {sim.totalChronic === 0 ? (
        <SimulatorEmptyState />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT COLUMN - Controls + Breakdown */}
          <div className="space-y-6">
            <RecoverySlider
              value={sliderValue}
              max={sim.totalChronic}
              onChange={onSliderChange}
            />
            <DailyRateInput value={dailyRate} onChange={onDailyRateChange} />
            <TargetRateSelect value={targetRate} onChange={onTargetRateChange} />
            <RecoveryMath sim={sim} targetRate={targetRate} />
          </div>

          {/* RIGHT COLUMN - Impact Visualization */}
          <div className="space-y-6">
            <RecoveryProjection
              sim={sim}
              totalLoss={totalLoss}
              sliderValue={sliderValue}
            />
            <BeforeAfterComparison sim={sim} totalLoss={totalLoss} />
            {sliderValue > 0 && (
              <BoardSummary sim={sim} sliderValue={sliderValue} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components (controls)                                           */
/* ------------------------------------------------------------------ */

function SimulatorEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-emerald-50 p-4 mb-4">
        <svg
          className="h-8 w-8 text-emerald-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        No chronically absent students
      </h3>
      <p className="text-sm text-gray-500 max-w-sm">
        No recovery needed — all students are attending at satisfactory rates.
      </p>
    </div>
  );
}

function RecoverySlider({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-3">
        Students recovered to satisfactory attendance
      </label>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={0}
          max={max}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-track]:rounded-full [&::-webkit-slider-track]:bg-slate-200
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-emerald-500
            [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-shadow
            [&::-webkit-slider-thumb]:hover:shadow-lg
            [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-slate-200 [&::-moz-range-track]:h-2
            [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-emerald-500
            [&::-moz-range-thumb]:shadow-md"
          style={{
            background: `linear-gradient(to right, #10b981 0%, #10b981 ${(value / max) * 100}%, #e2e8f0 ${(value / max) * 100}%, #e2e8f0 100%)`,
          }}
        />
        <span className="text-2xl font-semibold text-slate-900 tabular-nums min-w-[100px] text-right">
          {value}{" "}
          <span className="text-sm font-normal text-slate-500">
            student{value !== 1 ? "s" : ""}
          </span>
        </span>
      </div>
      <p className="text-sm text-slate-400 mt-1">
        of {max} chronically absent students
      </p>
    </div>
  );
}

function DailyRateInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        Per-pupil daily ADA rate
      </label>
      <div className="relative w-40">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
          $
        </span>
        <input
          type="number"
          min={1}
          max={500}
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v > 0) onChange(v);
          }}
          className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>
      <p className="text-xs text-slate-400 mt-1">
        California average ~$65/day. Adjust to match your district's rate.
      </p>
    </div>
  );
}

function TargetRateSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        Target attendance rate for recovered students
      </label>
      <select
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-64 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
      >
        {TARGET_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function RecoveryMath({
  sim,
  targetRate,
}: {
  sim: SimResult;
  targetRate: number;
}) {
  return (
    <div className="bg-slate-50 rounded-lg p-4">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Recovery Math
      </h4>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600">Avg absence days (chronic students)</span>
          <span className="text-slate-900 font-medium tabular-nums">
            {sim.avgAbsenceDays.toFixed(1)} days
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">
            Target absence days at {(targetRate * 100).toFixed(0)}%
          </span>
          <span className="text-slate-900 font-medium tabular-nums">
            {sim.targetAbsenceDays.toFixed(1)} days
          </span>
        </div>
        <div className="border-t border-slate-200 pt-2 flex justify-between">
          <span className="text-slate-600">Days recovered per student</span>
          <span className="text-emerald-600 font-semibold tabular-nums">
            {sim.daysRecoveredPerStudent.toFixed(1)} days
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Revenue per recovered student</span>
          <span className="text-emerald-600 font-semibold tabular-nums">
            ${Math.round(sim.revenuePerStudent).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
