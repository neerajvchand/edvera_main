import { InfoTooltip } from "@/components/InfoTooltip";
import { useFunding } from "@/hooks/useFunding";
import { FundingSchoolTable } from "@/components/funding/FundingSchoolTable";
import { RecoverySimulator } from "@/components/funding/RecoverySimulator";

/* ------------------------------------------------------------------ */
/* Funding Page                                                        */
/* ------------------------------------------------------------------ */

export function FundingPage() {
  const f = useFunding();

  if (f.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-semibold text-gray-900">
            Funding Impact
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Projected ADA loss at ${f.dailyRate}/day per-pupil rate
          </p>
        </div>
      </div>

      {/* Total loss card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <p className="text-[13px] font-medium text-gray-500 flex items-center">
          Total Projected ADA Revenue Loss
          <InfoTooltip text="Total estimated funding loss from chronic absence across the district. This is the number the Recovery Simulator below helps you reduce. Formula: sum of (absent days \u00d7 $65/day per-pupil rate) for all chronically absent students." />
        </p>
        <p className="text-[32px] font-semibold text-gray-900 mt-1">
          ${f.totalLoss.toLocaleString()}
        </p>
        {f.totalLoss > 100000 && (
          <span className="inline-block mt-2 text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-50 text-red-700">
            Significant district impact
          </span>
        )}
      </div>

      {/* By School table */}
      <FundingSchoolTable schools={f.schools} />

      {/* Recovery Simulator */}
      <RecoverySimulator
        sim={f.sim}
        totalLoss={f.totalLoss}
        sliderValue={f.sliderValue}
        onSliderChange={f.setSliderValue}
        dailyRate={f.dailyRate}
        onDailyRateChange={f.setDailyRate}
        targetRate={f.targetRate}
        onTargetRateChange={f.setTargetRate}
      />
    </div>
  );
}
