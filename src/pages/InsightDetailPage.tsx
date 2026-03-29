import { useParams, useNavigate } from "react-router-dom";
import { useInsightById } from "@/hooks/useCurrentInsight";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ShieldCheck, AlertTriangle, MinusCircle, MessageCircle, Check, Circle, Clock, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import type { InsightSeverity, InsightCategory, InsightPayload, ChecklistItem, SubgroupDatum, YearSnapshot } from "@/types/insights";

interface StructuredAnswer {
  answer_title: string;
  answer_bullets: string[];
  suggested_next_steps: string[];
}

const severityConfig: Record<InsightSeverity, { icon: typeof ShieldCheck; label: string; className: string }> = {
  good: { icon: ShieldCheck, label: "Looking Good", className: "status-container-success" },
  neutral: { icon: MinusCircle, label: "Worth Watching", className: "status-container-warning" },
  concern: { icon: AlertTriangle, label: "Needs Attention", className: "status-container-urgent" },
};

const categoryColors: Record<InsightCategory, string> = {
  Attendance: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Academics: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Wellbeing: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Engagement: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Safety: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

/* ── Comparison Bar ── */
function ComparisonBar({ label, value, maxVal, highlight }: { label: string; value: number; maxVal: number; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs text-muted-foreground w-28 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${highlight ? "bg-primary" : "bg-muted-foreground/40"}`}
          style={{ width: `${(value / maxVal) * 100}%` }}
        />
      </div>
      <span className={`text-xs font-medium w-12 ${highlight ? "text-foreground" : "text-muted-foreground"}`}>{value}%</span>
    </div>
  );
}

/* ── Subgroup Horizontal Bar Chart ── */
function SubgroupChart({ data, schoolAvg }: { data: SubgroupDatum[]; schoolAvg?: number }) {
  const allValues = data.filter((d) => d.value != null).map((d) => d.value as number);
  if (schoolAvg != null) allValues.push(schoolAvg);
  const maxVal = Math.max(...allValues, 1) * 1.15;

  const rows = schoolAvg != null
    ? [{ label: "School Average", value: schoolAvg, suppressed: false }, ...data]
    : data;

  return (
    <div className="space-y-2">
      {rows.map((d, i) => {
        const isSchoolAvg = i === 0 && schoolAvg != null;
        if (d.suppressed || d.value == null) {
          return (
            <div key={i} className="flex items-center gap-3 py-1">
              <span className="text-xs text-muted-foreground w-40 shrink-0 text-right truncate">{d.label}</span>
              <span className="text-[11px] italic text-muted-foreground/70">Not shown for privacy (small group size).</span>
            </div>
          );
        }
        return (
          <div key={i} className="flex items-center gap-3 py-1">
            <span className={`text-xs w-40 shrink-0 text-right truncate ${isSchoolAvg ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {d.label}
            </span>
            <div className="flex-1 h-3.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isSchoolAvg ? "bg-primary" : "bg-primary/50"}`}
                style={{ width: `${((d.value as number) / maxVal) * 100}%` }}
              />
            </div>
            <span className={`text-xs font-medium w-12 ${isSchoolAvg ? "text-foreground" : "text-muted-foreground"}`}>
              {d.value}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Year Toggle ── */
function YearToggle({ years, selected, onSelect }: { years: string[]; selected: string; onSelect: (y: string) => void }) {
  return (
    <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
      {years.map((y) => (
        <button
          key={y}
          onClick={() => onSelect(y)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            selected === y ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {y}
        </button>
      ))}
    </div>
  );
}

/* ── Checklist ── */
function ChecklistSection({ items }: { items: ChecklistItem[] }) {
  const statusIcon = (status: string) => {
    if (status === "complete") return <Check className="w-4 h-4 text-emerald-500" />;
    if (status === "incomplete") return <Clock className="w-4 h-4 text-amber-500" />;
    return <Circle className="w-4 h-4 text-muted-foreground" />;
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 text-sm py-2 px-3 rounded-lg border border-border bg-card">
          {statusIcon(item.status)}
          <div className="flex-1 min-w-0">
            <span className={`${item.status === "complete" ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.label}</span>
          </div>
          {item.due && (
            <span className="text-xs text-muted-foreground shrink-0">
              {new Date(item.due).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Answer Card ── */
function AnswerCard({ answer, question }: { answer: StructuredAnswer; question: string }) {
  return (
    <div className="pulse-card !p-4 space-y-3 animate-fade-in">
      <p className="text-xs font-medium text-primary">"{question}"</p>
      <h4 className="text-sm font-semibold text-foreground">{answer.answer_title}</h4>
      <ul className="space-y-1.5">
        {answer.answer_bullets.map((bullet, i) => (
          <li key={i} className="text-sm text-muted-foreground flex gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      {answer.suggested_next_steps.length > 0 && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs font-semibold text-foreground mb-1.5">Next steps</p>
          <div className="space-y-1">
            {answer.suggested_next_steps.map((step, i) => (
              <div key={i} className="flex gap-2 text-sm text-muted-foreground">
                <ChevronRight className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════ */

export default function InsightDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: insight, isLoading } = useInsightById(id);
  const [answer, setAnswer] = useState<StructuredAnswer | null>(null);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);

  // Track impression
  useEffect(() => {
    if (!id || !user?.id) return;
    supabase
      .from("insight_impressions")
      .insert({ user_id: user.id, insight_id: id, school_id: "a1b2c3d4-0001-4000-8000-000000000001" })
      .then(() => {});
  }, [id, user?.id]);

  const p: InsightPayload = insight?.payload ?? {};

  // Year toggle state
  const yearSnapshots = p.year_snapshots ?? [];
  const availableYears = useMemo(() => yearSnapshots.map((s) => s.reporting_year), [yearSnapshots]);
  const [selectedYear, setSelectedYear] = useState<string>("");

  // Default to latest year when data loads
  useEffect(() => {
    if (availableYears.length > 0 && !selectedYear) {
      setSelectedYear(availableYears[availableYears.length - 1]);
    }
  }, [availableYears, selectedYear]);

  // Resolve currently active snapshot (or fall back to top-level payload)
  const activeSnapshot: YearSnapshot | null = useMemo(() => {
    if (!selectedYear || yearSnapshots.length === 0) return null;
    return yearSnapshots.find((s) => s.reporting_year === selectedYear) ?? null;
  }, [selectedYear, yearSnapshots]);

  const activePrimary = activeSnapshot?.primary_metric ?? p.primary_metric;
  const activeComparison = activeSnapshot?.comparison ?? p.comparison;
  const activeSubgroups = activeSnapshot?.subgroup_data ?? p.subgroup_data;

  const handleQuestionTap = async (question: string) => {
    if (!insight) return;
    setActiveQuestion(question);
    setAnswerLoading(true);
    setAnswer(null);
    setAnswerError(null);

    try {
      const resp = await supabase.functions.invoke("insights-answer", {
        body: {
          insight_key: insight.insight_key,
          school_id: "a1b2c3d4-0001-4000-8000-000000000001",
          question_key: question,
        },
      });
      if (resp.error) throw resp.error;
      const data = resp.data;
      if (data?.error) {
        setAnswerError(data.error);
      } else if (data?.answer_title) {
        setAnswer(data as StructuredAnswer);
      } else {
        setAnswerError("Unexpected response format.");
      }
    } catch {
      setAnswerError("Something went wrong. Please try again.");
    } finally {
      setAnswerLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded w-full" />
            <div className="h-40 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Insight not found</p>
      </div>
    );
  }

  const sev = severityConfig[insight.severity];
  const SeverityIcon = sev.icon;

  const bullets = p.meaning_bullets ?? p.what_it_means ?? [];
  const actions = p.parent_actions ?? p.what_you_can_do ?? [];
  const questions = p.questions ?? p.questions_to_ask ?? [];

  const hasDelta = p.previous_year_value != null && p.current_year_value != null && p.delta_value != null;
  const deltaPositive = (p.delta_value ?? 0) > 0;
  const maxBarVal = Math.max(activePrimary?.value ?? 0, activeComparison?.value ?? 0, 1) * 1.15;

  return (
    <div className="min-h-screen bg-background pb-safe">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColors[insight.category]}`}>
            {insight.category}
          </span>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-5">
        {/* Severity badge */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${sev.className}`}>
          <SeverityIcon className="w-4 h-4" />
          <span className="text-sm font-medium">{sev.label}</span>
        </div>

        {/* Headline */}
        <h1 className="text-xl font-bold text-foreground leading-tight">{insight.headline}</h1>

        {/* Reporting year sub-label */}
        {p.reporting_year && (
          <p className="text-xs text-muted-foreground -mt-3">
            School Year {p.reporting_year} ({insight.source})
          </p>
        )}

        {/* Delta display */}
        {hasDelta && (
          <div className="flex items-center gap-2 -mt-2">
            <span className="text-sm font-semibold text-foreground">
              {p.previous_year_value}% → {p.current_year_value}%
            </span>
            <span className={`text-xs flex items-center gap-0.5 ${deltaPositive ? "text-destructive" : "text-emerald-600"}`}>
              {deltaPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {deltaPositive ? "+" : ""}{p.delta_value} percentage points
            </span>
          </div>
        )}

        {p.suppressed_note && (
          <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
            ⚠️ {p.suppressed_note}
          </div>
        )}

        {/* Year toggle */}
        {availableYears.length > 1 && (
          <YearToggle years={availableYears} selected={selectedYear} onSelect={setSelectedYear} />
        )}

        {/* Primary metric + comparison */}
        {activePrimary && (
          <section className="pulse-card !p-4">
            <div className="flex items-end gap-2 mb-1">
              <span className="text-2xl font-bold text-foreground">{activePrimary.value}{activePrimary.unit}</span>
              <span className="text-xs text-muted-foreground mb-1">{activePrimary.label}</span>
            </div>
            {activePrimary.delta != null && (
              <p className={`text-xs mb-2 ${(activePrimary.delta ?? 0) > 0 ? "text-destructive" : "text-emerald-600"}`}>
                {(activePrimary.delta ?? 0) > 0 ? "↑" : "↓"} {Math.abs(activePrimary.delta)} {activePrimary.delta_unit} from prior year
              </p>
            )}
            {activeComparison && (
              <div className="mt-3">
                <ComparisonBar label="Your School" value={activePrimary.value} maxVal={maxBarVal} highlight />
                <ComparisonBar label={activeComparison.label} value={activeComparison.value} maxVal={maxBarVal} />
              </div>
            )}
          </section>
        )}

        {/* Subgroup snapshot */}
        {activeSubgroups && activeSubgroups.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">Subgroup Snapshot</h2>
            <div className="pulse-card !p-4">
              <SubgroupChart data={activeSubgroups} schoolAvg={activePrimary?.value} />
            </div>
          </section>
        )}

        {/* Checklist */}
        {p.checklist_items && p.checklist_items.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">Items to review</h2>
            <ChecklistSection items={p.checklist_items} />
          </section>
        )}

        {/* What it means */}
        {bullets.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">What it means</h2>
            <ul className="space-y-2">
              {bullets.map((item, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* What you can do */}
        {actions.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">What you can do</h2>
            <div className="space-y-2">
              {actions.map((tip, i) => (
                <div key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-primary font-semibold shrink-0">{i + 1}.</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Questions you can ask */}
        {questions.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <MessageCircle className="w-4 h-4" />
              Questions you can ask
            </h2>
            <div className="space-y-2">
              {questions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleQuestionTap(q)}
                  disabled={answerLoading}
                  className={`w-full text-left text-sm px-3 py-2.5 rounded-lg border transition-colors disabled:opacity-50 ${
                    activeQuestion === q
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-secondary/50"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>

            {answerLoading && (
              <div className="mt-3 pulse-card !p-4">
                <p className="text-xs font-medium text-primary mb-2">"{activeQuestion}"</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Thinking...
                </div>
              </div>
            )}

            {answer && activeQuestion && !answerLoading && (
              <div className="mt-3">
                <AnswerCard answer={answer} question={activeQuestion} />
              </div>
            )}

            {answerError && !answerLoading && (
              <div className="mt-3 pulse-card !p-4">
                <p className="text-xs font-medium text-primary mb-2">"{activeQuestion}"</p>
                <p className="text-sm text-destructive">{answerError}</p>
              </div>
            )}
          </section>
        )}

        {/* Footer */}
        <div className="pt-4 pb-6 border-t border-border">
          <p className="text-[11px] text-muted-foreground/70">
            Source: {insight.source} • Updated {new Date(insight.last_updated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
}
