import { cn } from "@/lib/utils";
import {
  Mail,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shield,
  Clock,
  ChevronDown,
  ChevronUp,
  CalendarDays,
} from "lucide-react";
import { useBriefs, formatDate, formatTime, relativeTime } from "@/hooks/useBriefs";
import { BriefCard } from "@/components/briefs/BriefCard";

/* ------------------------------------------------------------------ */
/* Briefs Panel                                                        */
/* ------------------------------------------------------------------ */

export function BriefsPanel() {
  const b = useBriefs();

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Mail size={20} className="text-emerald-500" />
          <h2 className="text-lg font-semibold text-slate-900">
            Daily Attendance Brief
          </h2>
        </div>
        <button
          onClick={b.handleGenerate}
          disabled={b.sending}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors",
            b.sending
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          )}
        >
          {b.sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Generate Briefs
            </>
          )}
        </button>
      </div>

      {/* Success message */}
      {b.success && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-100 p-3 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
          <p className="text-sm text-emerald-700">{b.success}</p>
        </div>
      )}

      {/* Error message */}
      {b.error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-100 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{b.error}</p>
        </div>
      )}

      {/* Loading state */}
      {b.loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-600 border-t-transparent" />
        </div>
      )}

      {/* Latest briefs */}
      {!b.loading && b.latestBriefs.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={14} className="text-slate-400" />
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {formatDate(b.latestDate!)}
            </p>
          </div>
          <div className="space-y-3">
            {b.latestBriefs.map((brief) => (
              <BriefCard key={brief.id} brief={brief} />
            ))}
          </div>
        </div>
      )}

      {/* Older briefs (history) */}
      {!b.loading && b.olderDates.length > 0 && (
        <div>
          <button
            onClick={() => b.setShowHistory(!b.showHistory)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-3"
          >
            {b.showHistory ? (
              <>
                <ChevronUp size={14} /> Hide history
              </>
            ) : (
              <>
                <ChevronDown size={14} /> Show {b.olderDates.length} previous
                day{b.olderDates.length !== 1 ? "s" : ""}
              </>
            )}
          </button>

          {b.showHistory &&
            b.olderDates.map((date) => (
              <div key={date} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays size={14} className="text-slate-300" />
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {formatDate(date)}
                  </p>
                </div>
                <div className="space-y-2">
                  {b.briefsByDate[date].map((brief) => (
                    <BriefCard key={brief.id} brief={brief} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Empty state */}
      {!b.loading && b.briefs.length === 0 && (
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-sm text-slate-500">
            No briefs generated yet. Click &ldquo;Generate Briefs&rdquo; to
            create an AI-powered attendance summary for each school.
          </p>
        </div>
      )}

      {/* Recent runs */}
      {!b.loading && b.runs.length > 0 && (
        <div className="mt-5 pt-5 border-t border-gray-100">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
            Recent Runs
          </p>
          <div className="space-y-1.5">
            {b.runs.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between text-xs text-slate-500"
              >
                <div className="flex items-center gap-2">
                  {run.status === "completed" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : run.status === "failed" ? (
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />
                  )}
                  <span>
                    {formatDate(run.started_at)} {formatTime(run.started_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {run.status === "completed" && (
                    <span>
                      {run.schools_processed} school
                      {run.schools_processed !== 1 ? "s" : ""} · {run.briefs_sent}{" "}
                      brief{run.briefs_sent !== 1 ? "s" : ""}
                    </span>
                  )}
                  {run.status === "failed" && (
                    <span className="text-red-500">Failed</span>
                  )}
                  <span className="text-slate-400 flex items-center gap-0.5">
                    <Clock size={10} />
                    {relativeTime(run.started_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trust signal */}
      <div className="flex items-center gap-1.5 mt-4">
        <Shield size={14} className="text-slate-300 flex-shrink-0" />
        <p className="text-xs text-slate-400">
          Briefs use aggregate metrics only. No student names or IDs are
          processed by AI.
        </p>
      </div>
    </div>
  );
}
