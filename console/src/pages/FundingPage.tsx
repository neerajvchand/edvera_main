import { InfoTooltip } from "@/components/InfoTooltip";
import { useFunding } from "@/hooks/useFunding";
import { FundingSchoolTable } from "@/components/funding/FundingSchoolTable";
import { RecoverySimulator } from "@/components/funding/RecoverySimulator";
import { InterventionNarrativeBlock } from "@/components/funding/InterventionNarrativeBlock";
import { ADALossTooltip } from "@/components/funding/ADALossTooltip";
import {
  CARD,
  METRIC_LABEL,
  METRIC_VALUE,
  PAGE_TITLE,
  CASE_DETAIL,
  CONTENT_PADDING,
} from "@/lib/designTokens";

/* ------------------------------------------------------------------ */
/* Funding Page                                                        */
/* ------------------------------------------------------------------ */

export function FundingPage() {
  const f = useFunding();

  if (f.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  // Derived values for the tooltip at the district level
  const projectedFutureAbsences = Math.max(
    0,
    f.totalProjectedDaysChronic - f.totalAbsentDaysChronic
  );

  // Full sim recovery at max slider (all chronic students recovered)
  const fullRecovery = f.sim.totalChronic > 0
    ? Math.round(f.sim.revenuePerStudent * f.sim.totalChronic)
    : 0;
  const fullRemainingLoss = Math.max(0, f.totalLoss - fullRecovery);

  return (
    <div className={`${CONTENT_PADDING} max-w-6xl`}>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className={PAGE_TITLE}>Funding Impact</h1>
          <p className={`${CASE_DETAIL} mt-0.5`}>
            Projected ADA loss at ${f.dailyRate}/day per-pupil rate
          </p>
        </div>
      </div>

      {/* Total loss card */}
      <div className={`${CARD} p-5 mb-6`}>
        <p className={`${METRIC_LABEL} flex items-center`}>
          Total Projected ADA Revenue Loss
          <InfoTooltip text="Total estimated funding loss from chronic absence across the district. This is the number the Recovery Simulator below helps you reduce. Formula: sum of (absent days × $65/day per-pupil rate) for all chronically absent students." />
        </p>
        <p className={`${METRIC_VALUE} text-gray-900 mt-1`}>
          <ADALossTooltip
            currentAbsentDays={f.totalAbsentDaysChronic}
            projectedFutureAbsences={projectedFutureAbsences}
            totalProjectedDays={f.totalProjectedDaysChronic}
            perPupilRate={f.dailyRate}
            totalProjectedLoss={f.totalLoss}
            totalRecoverable={fullRecovery}
          >
            <span>${f.totalLoss.toLocaleString()}</span>
          </ADALossTooltip>
        </p>
        {f.totalLoss > 100000 && (
          <span className="inline-block mt-2 text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-50 text-red-700">
            Significant district impact
          </span>
        )}
      </div>

      {/* Intervention urgency narrative */}
      <div className="mb-6">
        <InterventionNarrativeBlock
          totalProjectedLoss={f.totalLoss}
          totalChronicStudents={f.sim.totalChronic}
          totalRecovery={fullRecovery}
          remainingLoss={fullRemainingLoss}
          remainingSchoolDays={f.remainingSchoolDays}
          districtName={f.districtName}
        />
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
