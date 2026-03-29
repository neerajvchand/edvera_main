/**
 * Root Cause Card — Chunk 3
 *
 * Mounts the existing RootCauseAnalysis component inline (not in a modal).
 * Adds debounced auto-save so users don't need to manually click Save.
 * Shows progress bar and domain breakdown.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Brain, ChevronDown, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import { updateRootCauseData } from "@/services/compliance/updateCase";
import type { CaseWorkspaceResponse } from "@/types/caseWorkspace";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type TriState = "yes" | "no" | "unknown";

interface DomainQuestion {
  key: string;
  label: string;
}

interface DomainConfig {
  key: string;
  label: string;
  color: string;
  questions: DomainQuestion[];
}

interface RootCauseData {
  [domainKey: string]: {
    questions: Record<string, TriState>;
    notes: string;
  };
}

interface Props {
  caseId: string;
  rootCause: CaseWorkspaceResponse["rootCause"];
  rootCauseData: Record<string, unknown> | null;
  onSaved: () => void;
}

/* ------------------------------------------------------------------ */
/* Domain Definitions (SMCOE SART Toolkit — 6 domains, 23 questions)  */
/* ------------------------------------------------------------------ */

const DOMAINS: DomainConfig[] = [
  {
    key: "academic",
    label: "Academic",
    color: "bg-blue-500",
    questions: [
      { key: "current_academic_situation", label: "Current academic situation is a concern" },
      { key: "accommodations_in_place", label: "Accommodations are in place" },
      { key: "language_barrier", label: "Language barrier impacts learning" },
      { key: "has_504_iep", label: "Student has a 504 plan or IEP" },
      { key: "iep_addressed_attendance", label: "IEP team has addressed attendance" },
    ],
  },
  {
    key: "safety",
    label: "Safety",
    color: "bg-red-500",
    questions: [
      { key: "being_bullied", label: "Student is being bullied" },
      { key: "bias_risk_race", label: "At risk of bias — race" },
      { key: "bias_risk_disability", label: "At risk of bias — disability" },
      { key: "bias_risk_orientation", label: "At risk of bias — sexual orientation" },
      { key: "bias_risk_gender", label: "At risk of bias — gender expression" },
    ],
  },
  {
    key: "social",
    label: "Social",
    color: "bg-purple-500",
    questions: [
      { key: "difficulty_adjusting", label: "Difficulty adjusting socially at school" },
      { key: "struggling_transitions", label: "Struggling with transitions (new school, grade change)" },
    ],
  },
  {
    key: "home",
    label: "Home",
    color: "bg-amber-500",
    questions: [
      { key: "parent_supportive", label: "Parent/guardian supportive of attendance improvement" },
      { key: "childcare_challenges", label: "Childcare responsibilities at home" },
      { key: "joblessness", label: "Parent joblessness or work schedule conflicts" },
      { key: "mental_health_home", label: "Mental health concerns in the home" },
      { key: "housing_instability", label: "Housing instability" },
    ],
  },
  {
    key: "health",
    label: "Health",
    color: "bg-emerald-500",
    questions: [
      { key: "school_safety_concerns", label: "School conditions impact feeling of safety" },
      { key: "anxiety", label: "Student experiences anxiety" },
      { key: "depression", label: "Student experiences depression" },
      { key: "separation_anxiety", label: "Separation anxiety" },
    ],
  },
  {
    key: "school_culture",
    label: "School Culture",
    color: "bg-orange-500",
    questions: [
      { key: "trusted_adult", label: "Positive relationship with trusted adult on campus" },
      { key: "areas_of_interest", label: "Areas of interest identified to engage student" },
    ],
  },
];

const TOTAL_QUESTIONS = DOMAINS.reduce((sum, d) => sum + d.questions.length, 0);

/* ------------------------------------------------------------------ */
/* Tri-State Toggle                                                    */
/* ------------------------------------------------------------------ */

function TriStateToggle({
  value,
  onChange,
}: {
  value: TriState;
  onChange: (v: TriState) => void;
}) {
  const options: { val: TriState; label: string }[] = [
    { val: "yes", label: "Yes" },
    { val: "no", label: "No" },
    { val: "unknown", label: "?" },
  ];

  return (
    <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5">
      {options.map((o) => (
        <button
          key={o.val}
          type="button"
          onClick={() => onChange(o.val)}
          className={cn(
            "px-2.5 py-1 text-xs font-medium rounded transition-colors",
            value === o.val
              ? o.val === "yes"
                ? "bg-emerald-500 text-white"
                : o.val === "no"
                  ? "bg-red-500 text-white"
                  : "bg-gray-400 text-white"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export function RootCauseCard({
  caseId,
  rootCause,
  rootCauseData: initialData,
  onSaved,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<RootCauseData>({});
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rc = rootCause ?? { assessedCount: 0, totalCount: TOTAL_QUESTIONS, status: "not_started" as const };
  const pct = rc.totalCount > 0 ? Math.round((rc.assessedCount / rc.totalCount) * 100) : 0;

  // Initialize from existing data
  useEffect(() => {
    const parsed: RootCauseData = {};
    const raw = (initialData ?? {}) as Record<string, unknown>;
    for (const domain of DOMAINS) {
      const existing = (raw[domain.key] as Record<string, unknown>) ?? {};
      parsed[domain.key] = {
        questions: (existing.questions as Record<string, TriState>) ?? {},
        notes: (existing.notes as string) ?? "",
      };
    }
    setData(parsed);
  }, [initialData]);

  // Debounced auto-save
  const saveToDb = useCallback(
    async (toSave: RootCauseData) => {
      setSaving(true);
      try {
        await updateRootCauseData(caseId, toSave);
        dirtyRef.current = false;
        setLastSaved(
          new Date().toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })
        );
        onSaved();
      } catch (err) {
        console.error("Failed to save root cause data:", err);
      } finally {
        setSaving(false);
      }
    },
    [caseId, onSaved]
  );

  function scheduleSave(updatedData: RootCauseData) {
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveToDb(updatedData);
    }, 1500); // 1.5s debounce
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Save on collapse if dirty
  useEffect(() => {
    if (!expanded && dirtyRef.current) {
      if (timerRef.current) clearTimeout(timerRef.current);
      saveToDb(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  function setQuestion(domainKey: string, questionKey: string, value: TriState) {
    setData((prev) => {
      const updated = {
        ...prev,
        [domainKey]: {
          ...prev[domainKey],
          questions: {
            ...prev[domainKey]?.questions,
            [questionKey]: value,
          },
        },
      };
      scheduleSave(updated);
      return updated;
    });
  }

  function setNotes(domainKey: string, notes: string) {
    setData((prev) => {
      const updated = {
        ...prev,
        [domainKey]: {
          ...prev[domainKey],
          notes,
        },
      };
      scheduleSave(updated);
      return updated;
    });
  }

  // Count answered questions from local state
  const answeredCount = DOMAINS.reduce((sum, d) => {
    const domainData = data[d.key]?.questions ?? {};
    return sum + d.questions.filter((q) => domainData[q.key] && domainData[q.key] !== "unknown").length;
  }, 0);

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    not_started: { label: "Not started", color: "text-gray-500" },
    in_progress: { label: "In progress", color: "text-yellow-600" },
    complete: { label: "Complete", color: "text-emerald-600" },
  };

  const statusInfo = STATUS_LABELS[rc.status] ?? STATUS_LABELS.not_started;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="rounded-lg p-2 bg-violet-50">
            <Brain className="h-4 w-4 text-violet-600" />
          </div>
          <div className="text-left">
            <h3 className="text-base font-semibold text-gray-900">Root Cause</h3>
            <span className="text-xs text-gray-400">
              SMCOE SART Toolkit — {answeredCount}/{TOTAL_QUESTIONS} assessed
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />}
          {lastSaved && !saving && (
            <span className="text-[10px] text-gray-400">Saved {lastSaved}</span>
          )}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Progress bar — always visible */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className={cn("text-sm font-medium", statusInfo.color)}>
            {statusInfo.label}
          </span>
          <span className="text-xs text-gray-400 tabular-nums">
            {answeredCount}/{TOTAL_QUESTIONS}
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all"
            style={{ width: `${Math.round((answeredCount / TOTAL_QUESTIONS) * 100)}%` }}
          />
        </div>
      </div>

      {/* Domain breakdown chips — always visible */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {DOMAINS.map((domain) => {
          const domainData = data[domain.key]?.questions ?? {};
          const answered = domain.questions.filter(
            (q) => domainData[q.key] && domainData[q.key] !== "unknown"
          ).length;
          const isComplete = answered === domain.questions.length;

          return (
            <span
              key={domain.key}
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
                isComplete
                  ? "bg-violet-50 text-violet-700"
                  : "bg-gray-50 text-gray-500"
              )}
            >
              {isComplete && <CheckCircle2 className="h-2.5 w-2.5" />}
              {domain.label} {answered}/{domain.questions.length}
            </span>
          );
        })}
      </div>

      {/* Expanded: inline SART assessment */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
          {DOMAINS.map((domain) => {
            const domainData = data[domain.key] ?? { questions: {}, notes: "" };
            return (
              <div
                key={domain.key}
                className="rounded-lg border border-gray-100 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn("w-2.5 h-2.5 rounded-full", domain.color)} />
                  <h4 className="text-sm font-semibold text-gray-900">{domain.label}</h4>
                </div>

                <div className="space-y-2.5">
                  {domain.questions.map((q) => (
                    <div key={q.key} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-700 flex-1">{q.label}</span>
                      <TriStateToggle
                        value={domainData.questions[q.key] ?? "unknown"}
                        onChange={(v) => setQuestion(domain.key, q.key, v)}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  <textarea
                    value={domainData.notes}
                    onChange={(e) => setNotes(domain.key, e.target.value)}
                    placeholder={`Notes about ${domain.label.toLowerCase()} factors...`}
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
