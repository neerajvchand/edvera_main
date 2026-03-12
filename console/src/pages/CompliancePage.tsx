import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { InfoTooltip } from "@/components/InfoTooltip";
import { getCaseList, type ComplianceCaseRow } from "@/services/compliance/getCaseList";

const SARB_STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "SARB Draft", bg: "bg-amber-50", text: "text-amber-700" },
  ready: { label: "SARB Ready", bg: "bg-blue-50", text: "text-blue-700" },
  submitted: { label: "SARB Submitted", bg: "bg-emerald-50", text: "text-emerald-700" },
};

const TIER_LABELS: Record<string, { label: string; bg: string; text: string }> =
  {
    tier_1_letter: {
      label: "Tier 1 - Letter",
      bg: "bg-amber-50",
      text: "text-amber-700",
    },
    tier_2_conference: {
      label: "Tier 2 - Conference",
      bg: "bg-orange-50",
      text: "text-orange-700",
    },
    tier_3_sarb_referral: {
      label: "Tier 3 - SARB",
      bg: "bg-red-50",
      text: "text-red-700",
    },
  };

const TIER_TOOLTIPS: Record<string, string> = {
  tier_1_letter:
    "First truancy notification sent to parent/guardian per EC §48260.5. Triggered after 3 unexcused absences or tardies over 30 minutes.",
  tier_2_conference:
    "Parent/guardian conference required per EC §48262. School must make a 'conscientious effort' to hold at least one meeting before escalating.",
  tier_3_sarb_referral:
    "Referral to School Attendance Review Board per EC §48263. Multi-agency board reviews the case and directs resources. Prerequisite: Tier 2 conference attempted.",
};

export function CompliancePage() {
  const [cases, setCases] = useState<ComplianceCaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCases();
  }, []);

  async function fetchCases() {
    try {
      const rows = await getCaseList();
      setCases(rows);
    } catch (err) {
      console.error("Failed to fetch compliance cases:", err);
    } finally {
      setLoading(false);
    }
  }

  const tierCounts = cases.reduce(
    (acc, c) => {
      acc[c.current_tier] = (acc[c.current_tier] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold text-gray-900">
          Compliance Tracker
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {cases.length} open cases
        </p>
      </div>

      {/* Tier summary pills */}
      <div className="flex gap-3 mb-6">
        {Object.entries(TIER_LABELS).map(([tier, style]) => (
          <div
            key={tier}
            className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-2"
          >
            <span
              className={cn(
                "text-xs font-medium px-2.5 py-0.5 rounded-full",
                style.bg,
                style.text
              )}
            >
              {style.label}
            </span>
            <span className="text-lg font-semibold text-gray-900 tabular-nums">
              {tierCounts[tier] ?? 0}
            </span>
            {TIER_TOOLTIPS[tier] && (
              <InfoTooltip text={TIER_TOOLTIPS[tier]} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-clip overflow-y-visible">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tl-xl">
                Student
              </th>
              <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                School
              </th>
              <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tier
              </th>
              <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <span className="inline-flex items-center">
                  Unexcused
                  <InfoTooltip text="Count of unexcused absences only. California truancy law (EC §48260) tracks unexcused absences separately from total absences." />
                </span>
              </th>
              <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <span className="inline-flex items-center">
                  Total Absences
                  <InfoTooltip text="All absences including excused, unexcused, and suspensions. Chronic absence (EC §60901) counts all types." />
                </span>
              </th>
              <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tr-xl">
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cases.map((c) => {
              const tier = TIER_LABELS[c.current_tier] ?? {
                label: c.current_tier,
                bg: "bg-gray-50",
                text: "text-gray-700",
              };
              return (
                <tr
                  key={c.id}
                  className="hover:bg-emerald-50/50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <Link
                      to={`/student/${c.student_id}`}
                      className="text-sm font-medium text-gray-900 hover:text-emerald-700"
                    >
                      {c.student_name}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700">
                    {c.school_name}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={cn(
                          "inline-block text-xs font-medium px-2.5 py-0.5 rounded-full",
                          tier.bg,
                          tier.text
                        )}
                      >
                        {tier.label}
                      </span>
                      {c.current_tier === "tier_3_sarb_referral" &&
                        c.sarb_packet_status !== "not_started" &&
                        SARB_STATUS_STYLES[c.sarb_packet_status] && (
                          <span
                            className={cn(
                              "inline-block text-[10px] font-medium px-2 py-0.5 rounded-full",
                              SARB_STATUS_STYLES[c.sarb_packet_status].bg,
                              SARB_STATUS_STYLES[c.sarb_packet_status].text
                            )}
                          >
                            {SARB_STATUS_STYLES[c.sarb_packet_status].label}
                          </span>
                        )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700 tabular-nums">
                    {c.unexcused_absence_count}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700 tabular-nums">
                    {c.total_absence_count}
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      to={`/compliance/cases/${c.id}`}
                      className="text-xs font-medium text-emerald-600 hover:text-emerald-800"
                    >
                      View Case
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
