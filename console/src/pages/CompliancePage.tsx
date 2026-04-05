import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { InfoTooltip } from "@/components/InfoTooltip";
import {
  getCaseList,
  type ComplianceCaseRow,
  type CaseListResult,
} from "@/services/compliance/getCaseList";
import { SARB_STATUS_CONFIG, type SarbStatus } from "@/lib/sarbStatus";
import {
  CASE_WORKFLOW_STAGE_CONFIG,
  OUTCOME_STAGE_CONFIG,
  type CaseWorkflowStage,
  type OutcomeStage,
} from "@/lib/caseStages";
import { SearchInput } from "@/components/shared/SearchInput";
import { SchoolFilter } from "@/components/shared/SchoolFilter";
import { PaginationControls } from "@/components/shared/PaginationControls";
import {
  CARD,
  TABLE_HEADER,
  CASE_NAME,
  CASE_DETAIL,
  PAGE_TITLE,
  CONTENT_PADDING,
} from "@/lib/designTokens";

/* ------------------------------------------------------------------ */
/* Tier helpers (kept for table badge rendering)                       */
/* ------------------------------------------------------------------ */

const TIER_LABELS: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  tier_1_letter: {
    label: "Tier 1",
    bg: "bg-amber-50",
    text: "text-amber-700",
  },
  tier_2_conference: {
    label: "Tier 2",
    bg: "bg-orange-50",
    text: "text-orange-700",
  },
  tier_3_sarb_referral: {
    label: "Tier 3",
    bg: "bg-red-50",
    text: "text-red-700",
  },
};

/* ------------------------------------------------------------------ */
/* Queue definitions                                                   */
/* ------------------------------------------------------------------ */

const QUEUES = [
  {
    id: "all",
    label: "All Open Cases",
    color: "gray",
    description: "All active compliance cases",
    filter: (_c: ComplianceCaseRow) => true,
  },
  {
    id: "needs_review",
    label: "Needs Review",
    color: "red",
    description: "New cases not yet assigned or reviewed",
    filter: (c: ComplianceCaseRow) =>
      c.case_workflow_stage === "new" ||
      c.case_workflow_stage === "needs_review",
  },
  {
    id: "outreach_overdue",
    label: "Outreach",
    color: "amber",
    description: "Cases where outreach or barrier assessment is in progress",
    filter: (c: ComplianceCaseRow) =>
      c.case_workflow_stage === "outreach_in_progress" ||
      c.case_workflow_stage === "barrier_assessment",
  },
  {
    id: "compliance_prep",
    label: "Compliance Prep",
    color: "orange",
    description: "Cases preparing for SARB referral",
    filter: (c: ComplianceCaseRow) =>
      c.case_workflow_stage === "compliance_prep" ||
      c.case_workflow_stage === "intervention_active",
  },
  {
    id: "monitoring",
    label: "Monitoring",
    color: "emerald",
    description: "Cases with improved attendance in observation period",
    filter: (c: ComplianceCaseRow) =>
      c.case_workflow_stage === "monitoring_period",
  },
  {
    id: "ready_for_review",
    label: "Ready for Approval",
    color: "blue",
    description: "Packets awaiting principal approval",
    filter: (c: ComplianceCaseRow) =>
      c.packet_stage === "under_review" || c.packet_stage === "generated",
  },
  {
    id: "submitted",
    label: "Submitted / Hearing",
    color: "purple",
    description: "Packets submitted to SARB board or hearing scheduled",
    filter: (c: ComplianceCaseRow) =>
      c.packet_stage === "submitted" ||
      c.case_workflow_stage === "ready_for_board",
  },
] as const;

/* ------------------------------------------------------------------ */
/* Queue pill color map                                                */
/* ------------------------------------------------------------------ */

const PILL_ACTIVE: Record<string, string> = {
  gray: "bg-blue-50 border-blue-200 text-blue-800 font-semibold",
  red: "bg-blue-50 border-blue-200 text-blue-800 font-semibold",
  amber: "bg-blue-50 border-blue-200 text-blue-800 font-semibold",
  orange: "bg-blue-50 border-blue-200 text-blue-800 font-semibold",
  blue: "bg-blue-50 border-blue-200 text-blue-800 font-semibold",
  emerald: "bg-blue-50 border-blue-200 text-blue-800 font-semibold",
  purple: "bg-blue-50 border-blue-200 text-blue-800 font-semibold",
};

const BADGE_BG: Record<string, string> = {
  gray: "bg-gray-500",
  red: "bg-red-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  purple: "bg-purple-500",
};

/* ------------------------------------------------------------------ */
/* SLA helper                                                          */
/* ------------------------------------------------------------------ */

function slaIndicator(openedAt: string): {
  text: string;
  cls: string;
} | null {
  const days = Math.floor(
    (Date.now() - new Date(openedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days <= 7) return null;
  if (days <= 14) return { text: `${days}d`, cls: "text-gray-400" };
  if (days <= 29)
    return { text: `${days}d`, cls: "text-amber-500 font-medium" };
  return { text: `${days}d`, cls: "text-red-600 font-semibold" };
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 25;

// We fetch up to 500 filtered cases for queue counting, then paginate
// client-side within that batch. This is a pragmatic tradeoff: it avoids
// N+1 queries for each queue count while keeping the page responsive.
// When case counts exceed 500, move to server-side queue counts.
const QUEUE_FETCH_LIMIT = 500;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function CompliancePage() {
  const [allCases, setAllCases] = useState<ComplianceCaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeQueue, setActiveQueue] = useState<string>("all");

  // Filters
  const [search, setSearch] = useState("");
  const [schoolId, setSchoolId] = useState<string | undefined>();
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch up to QUEUE_FETCH_LIMIT to allow client-side queue counting
      const result: CaseListResult = await getCaseList({
        search: search || undefined,
        schoolId,
        page: 1,
        pageSize: QUEUE_FETCH_LIMIT,
      });
      setAllCases(result.cases);
      setTotal(result.total);
    } catch (err) {
      console.error("Failed to fetch compliance cases:", err);
    } finally {
      setLoading(false);
    }
  }, [search, schoolId]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, schoolId, activeQueue, tierFilter]);

  // Apply queue + tier filter client-side
  const activeQueueDef =
    QUEUES.find((q) => q.id === activeQueue) ?? QUEUES[0];
  const queueFiltered = allCases.filter((c) => {
    if (!activeQueueDef.filter(c)) return false;
    if (tierFilter !== "all" && c.current_tier !== tierFilter) return false;
    return true;
  });

  // Client-side pagination within queue-filtered results
  const totalFiltered = queueFiltered.length;
  const totalPages = Math.ceil(totalFiltered / PAGE_SIZE);
  const pageFrom = (page - 1) * PAGE_SIZE;
  const pageTo = pageFrom + PAGE_SIZE;
  const visibleCases = queueFiltered.slice(pageFrom, pageTo);

  function handleSearchChange(v: string) {
    setSearch(v);
    setPage(1);
  }

  function handleSchoolChange(v: string | undefined) {
    setSchoolId(v);
    setPage(1);
  }

  return (
    <div className={`${CONTENT_PADDING} max-w-6xl`}>
      <div className="mb-6">
        <h1 className={PAGE_TITLE}>Compliance Tracker</h1>
        <p className={`${CASE_DETAIL} mt-0.5`}>
          {activeQueue === "all"
            ? `${total} open case${total !== 1 ? "s" : ""}`
            : `Showing ${totalFiltered} of ${total} \u2014 ${activeQueueDef.label}`}
        </p>
      </div>

      {/* Search + School Filter + Tier Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder="Search student name..."
        />
        <SchoolFilter value={schoolId} onChange={handleSchoolChange} />
        <div className="relative">
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="appearance-none bg-white border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          >
            <option value="all">All Tiers</option>
            <option value="tier_1_letter">Tier 1</option>
            <option value="tier_2_conference">Tier 2</option>
            <option value="tier_3_sarb_referral">Tier 3</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
      </div>

      {/* Queue pills */}
      <div className="overflow-x-auto pb-1 mb-6">
        <div className="flex gap-2 flex-nowrap">
          {QUEUES.map((queue) => {
            const count = allCases.filter(queue.filter).length;
            const isActive = activeQueue === queue.id;
            return (
              <button
                key={queue.id}
                onClick={() => {
                  setActiveQueue(queue.id);
                  setPage(1);
                }}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-2.5 rounded-lg border",
                  "text-sm transition-colors whitespace-nowrap",
                  isActive
                    ? PILL_ACTIVE[queue.color]
                    : "bg-white border-gray-200 text-gray-500 font-medium hover:bg-gray-50"
                )}
              >
                <span
                  className={cn(
                    "inline-flex items-center justify-center",
                    "w-5 h-5 rounded-full text-xs font-semibold text-white",
                    isActive
                      ? BADGE_BG[queue.color]
                      : "bg-gray-400"
                  )}
                >
                  {count}
                </span>
                {queue.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className={`${CARD} overflow-x-clip overflow-y-visible`}>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : visibleCases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-3" />
            <p className={`${CASE_NAME} mb-1`}>
              {search || schoolId
                ? "No cases match your search"
                : "No cases in this queue"}
            </p>
            <p className={CASE_DETAIL}>
              {activeQueueDef.description}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className={`py-2.5 px-4 ${TABLE_HEADER} rounded-tl-lg`}>
                    Student
                  </th>
                  <th className={`py-2.5 px-4 ${TABLE_HEADER}`}>
                    School
                  </th>
                  <th className={`py-2.5 px-4 ${TABLE_HEADER}`}>
                    Tier
                  </th>
                  <th className={`py-2.5 px-4 ${TABLE_HEADER}`}>
                    Stage
                  </th>
                  <th className={`py-2.5 px-4 ${TABLE_HEADER}`}>
                    <span className="inline-flex items-center">
                      Unexcused
                      <InfoTooltip text="Count of unexcused absences only. California truancy law (EC §48260) tracks unexcused absences separately from total absences." />
                    </span>
                  </th>
                  <th className={`py-2.5 px-4 ${TABLE_HEADER}`}>
                    <span className="inline-flex items-center">
                      Total Absences
                      <InfoTooltip text="All absences including excused, unexcused, and suspensions. Chronic absence (EC §60901) counts all types." />
                    </span>
                  </th>
                  <th className={`py-2.5 px-4 ${TABLE_HEADER} rounded-tr-lg`} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleCases.map((c) => {
                  const tier = TIER_LABELS[c.current_tier] ?? {
                    label: c.current_tier,
                    bg: "bg-gray-50",
                    text: "text-gray-700",
                  };
                  const stageCfg =
                    CASE_WORKFLOW_STAGE_CONFIG[
                      c.case_workflow_stage as CaseWorkflowStage
                    ] ?? CASE_WORKFLOW_STAGE_CONFIG.new;
                  const sla = slaIndicator(c.opened_at);

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {/* Student + SLA */}
                      <td className="py-3 px-4">
                        <Link
                          to={`/student/${c.student_id}`}
                          className={`${CASE_NAME} hover:text-brand-500`}
                        >
                          {c.student_name}
                        </Link>
                        {sla && (
                          <p className={cn("text-[10px] mt-0.5", sla.cls)}>
                            {sla.text}
                          </p>
                        )}
                      </td>

                      {/* School */}
                      <td className={`py-3 px-4 ${CASE_DETAIL}`}>
                        {c.school_name}
                      </td>

                      {/* Tier */}
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
                            SARB_STATUS_CONFIG[
                              c.sarb_packet_status as SarbStatus
                            ] && (
                              <span
                                className={cn(
                                  "inline-block text-[10px] font-medium px-2 py-0.5 rounded-full",
                                  SARB_STATUS_CONFIG[
                                    c.sarb_packet_status as SarbStatus
                                  ].bg,
                                  SARB_STATUS_CONFIG[
                                    c.sarb_packet_status as SarbStatus
                                  ].text
                                )}
                              >
                                {
                                  SARB_STATUS_CONFIG[
                                    c.sarb_packet_status as SarbStatus
                                  ].label
                                }
                              </span>
                            )}
                        </div>
                      </td>

                      {/* Stage */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={cn(
                              "inline-block text-xs font-medium px-2.5 py-0.5 rounded-full",
                              stageCfg.bg,
                              stageCfg.text
                            )}
                          >
                            {stageCfg.label}
                          </span>
                          {c.outcome_stage &&
                            c.outcome_stage !== "pending" &&
                            OUTCOME_STAGE_CONFIG[c.outcome_stage as OutcomeStage] && (
                              <span
                                className={cn(
                                  "inline-block text-[10px] font-medium px-2 py-0.5 rounded-full",
                                  OUTCOME_STAGE_CONFIG[c.outcome_stage as OutcomeStage].bg,
                                  OUTCOME_STAGE_CONFIG[c.outcome_stage as OutcomeStage].text
                                )}
                              >
                                {OUTCOME_STAGE_CONFIG[c.outcome_stage as OutcomeStage].label}
                              </span>
                            )}
                        </div>
                      </td>

                      {/* Unexcused */}
                      <td className={`py-3 px-4 ${CASE_DETAIL} tabular-nums`}>
                        {c.unexcused_absence_count}
                      </td>

                      {/* Total Absences */}
                      <td className={`py-3 px-4 ${CASE_DETAIL} tabular-nums`}>
                        {c.total_absence_count}
                      </td>

                      {/* View Case link */}
                      <td className="py-3 px-4">
                        <Link
                          to={`/compliance/cases/${c.id}`}
                          className="text-xs font-semibold text-brand-500 hover:text-brand-600"
                        >
                          View Case
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <PaginationControls
              page={page}
              totalPages={totalPages}
              total={totalFiltered}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
