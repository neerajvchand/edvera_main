import { cn } from "@/lib/utils";
import { getAbsenceBand, type DashboardMetrics } from "@/hooks/useDashboard";

interface SchoolSnapshotListProps {
  schools: DashboardMetrics["schoolBreakdown"];
}

export function SchoolSnapshotList({ schools }: SchoolSnapshotListProps) {
  if (schools.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-6">
        <p className="text-sm text-gray-400">
          No school data available. Import attendance data to see school
          metrics.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Schools</h2>
      </div>

      <div className="divide-y divide-gray-100">
        {schools.map((school) => {
          const band = getAbsenceBand(school.chronicRate);

          return (
            <div
              key={school.name}
              className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors"
            >
              {/* School name */}
              <span className="text-sm font-medium text-gray-900 flex-1 min-w-0 truncate">
                {school.name}
              </span>

              {/* Chronic rate + band pill */}
              <span className="text-sm tabular-nums text-gray-600 shrink-0">
                {school.chronicRate.toFixed(1)}%
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0",
                  band.pillBg,
                  band.pillText,
                )}
              >
                {band.label}
              </span>

              {/* ADA loss */}
              <span className="text-sm tabular-nums text-gray-500 shrink-0 w-16 text-right">
                ${school.adaLoss.toLocaleString()}
              </span>

              {/* Elevated count */}
              <span
                className={cn(
                  "text-xs tabular-nums shrink-0 w-8 text-right",
                  school.elevated > 0 ? "text-red-600 font-medium" : "text-gray-400",
                )}
              >
                {school.elevated > 0 ? school.elevated : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
