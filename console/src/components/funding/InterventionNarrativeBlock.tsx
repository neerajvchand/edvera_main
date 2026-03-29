import { AlertTriangle } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  totalProjectedLoss: number;
  totalChronicStudents: number;
  totalRecovery: number;
  remainingLoss: number;
  remainingSchoolDays: number;
  districtName: string;
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

export function InterventionNarrativeBlock({
  totalProjectedLoss,
  totalChronicStudents,
  totalRecovery,
  remainingLoss,
  remainingSchoolDays,
  districtName,
}: Props) {
  // Edge cases: render nothing
  if (totalChronicStudents === 0 || totalProjectedLoss === 0) return null;

  const recoveryPercent = Math.round(
    (totalRecovery / totalProjectedLoss) * 100
  );

  const daysUrgent = remainingSchoolDays <= 30;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-sm text-amber-900 leading-relaxed">
        <AlertTriangle className="inline h-4 w-4 text-amber-600 mr-1.5 -mt-0.5" />
        <span className="font-semibold">{districtName}</span> is on track to
        lose{" "}
        <span className="font-semibold text-amber-900">
          {fmtDollars(totalProjectedLoss)}
        </span>{" "}
        in ADA revenue this year across{" "}
        <span className="font-semibold">{totalChronicStudents}</span>{" "}
        chronically absent students. Successful intervention on all{" "}
        <span className="font-semibold">{totalChronicStudents}</span> could
        recover{" "}
        <span className="font-semibold text-amber-900">
          {fmtDollars(totalRecovery)}
        </span>{" "}
        &mdash; {recoveryPercent}% of projected losses. The remaining{" "}
        <span className="font-semibold text-amber-900">
          {fmtDollars(remainingLoss)}
        </span>{" "}
        represents the district floor even at 95% attendance targets.
        {remainingSchoolDays > 0 && (
          <>
            {" "}
            <span className={daysUrgent ? "font-bold" : ""}>
              {remainingSchoolDays} school days remain to act.
            </span>
          </>
        )}
      </p>
    </div>
  );
}
