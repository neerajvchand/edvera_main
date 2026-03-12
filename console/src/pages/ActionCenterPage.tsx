import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import { InfoTooltip } from "@/components/InfoTooltip";
import { useActionCenter } from "@/hooks/useActionCenter";
import { ActionCard } from "@/components/action-center/ActionCard";
import { ActionFilterBar } from "@/components/action-center/ActionFilterBar";

/* ------------------------------------------------------------------ */
/* Metric Card                                                         */
/* ------------------------------------------------------------------ */

function MetricCard({
  label,
  value,
  pill,
  tooltip,
}: {
  label: string;
  value: string;
  pill?: { label: string; bg: string; text: string };
  tooltip?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-[13px] font-medium text-gray-500 flex items-center">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </p>
      <p className="text-[28px] font-semibold text-gray-900 mt-1 leading-tight">
        {value}
      </p>
      {pill && (
        <span
          className={cn(
            "inline-block mt-2 text-xs font-medium px-2.5 py-0.5 rounded-full",
            pill.bg,
            pill.text
          )}
        >
          {pill.label}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty State                                                         */
/* ------------------------------------------------------------------ */

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-emerald-50 p-4 mb-4">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {hasFilters ? "No actions match your filters" : "All caught up!"}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm">
        {hasFilters
          ? "Try adjusting your filters to see more actions."
          : "There are no open actions right now. New actions will appear automatically when the compliance engine detects threshold crossings."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Action Center Page                                                  */
/* ------------------------------------------------------------------ */

export function ActionCenterPage() {
  const ac = useActionCenter();

  if (ac.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold text-gray-900">
          Action Center
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Tasks generated from compliance engine threshold crossings
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Open Actions"
          value={String(ac.metrics.totalOpen)}
          tooltip="Total actions currently open and awaiting completion. Actions are generated automatically when the compliance engine detects truancy or chronic absence threshold crossings."
          pill={
            ac.metrics.totalOpen > 0
              ? {
                  label: `${ac.metrics.urgent} urgent`,
                  bg: ac.metrics.urgent > 0 ? "bg-red-50" : "bg-slate-50",
                  text: ac.metrics.urgent > 0 ? "text-red-700" : "text-slate-600",
                }
              : undefined
          }
        />
        <MetricCard
          label="Overdue"
          value={String(ac.metrics.overdue)}
          tooltip="Actions past their due date that have not been completed. Due dates are calculated from the compliance tier trigger date plus the required business days for that action type."
          pill={
            ac.metrics.overdue > 0
              ? { label: "Needs attention", bg: "bg-red-50", text: "text-red-700" }
              : { label: "On track", bg: "bg-emerald-50", text: "text-emerald-700" }
          }
        />
        <MetricCard
          label="Urgent Priority"
          value={String(ac.metrics.urgent)}
          tooltip="Actions flagged as urgent — either past due or requiring immediate attention. Urgent actions are typically associated with Tier 3 SARB referrals or actions that have passed their compliance deadline."
        />
        <MetricCard
          label="Completed Today"
          value={String(ac.metrics.completedToday)}
          tooltip="Actions marked as completed today by your team."
          pill={
            ac.metrics.completedToday > 0
              ? { label: "Great progress", bg: "bg-emerald-50", text: "text-emerald-700" }
              : undefined
          }
        />
      </div>

      {/* Filter Bar */}
      <ActionFilterBar
        searchQuery={ac.searchQuery}
        onSearchChange={ac.setSearchQuery}
        statusFilter={ac.statusFilter}
        onStatusChange={ac.setStatusFilter}
        typeFilter={ac.typeFilter}
        onTypeChange={ac.setTypeFilter}
        schoolFilter={ac.schoolFilter}
        onSchoolChange={ac.setSchoolFilter}
        sortBy={ac.sortBy}
        onSortChange={ac.setSortBy}
        schools={ac.schools}
        hasFilters={ac.hasFilters}
        filteredCount={ac.filteredActions.length}
        onReset={ac.resetFilters}
      />

      {/* Action List */}
      {ac.filteredActions.length === 0 ? (
        <EmptyState hasFilters={ac.hasFilters} />
      ) : (
        <div className="space-y-3">
          {ac.filteredActions.map((action) => (
            <ActionCard key={action.id} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}
