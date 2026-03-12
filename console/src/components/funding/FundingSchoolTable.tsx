import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/InfoTooltip";
import type { SchoolFunding } from "@/hooks/useFunding";

export function FundingSchoolTable({ schools }: { schools: SchoolFunding[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-clip overflow-y-visible">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">By School</h2>
      </div>
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
              School
            </th>
            <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Students
            </th>
            <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <span className="inline-flex items-center">
                Chronic Absent
                <InfoTooltip text="Number of students at this school absent 10%+ of enrolled days." />
              </span>
            </th>
            <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <span className="inline-flex items-center">
                Chronic Rate
                <InfoTooltip text="Chronic absent students \u00f7 total enrolled students at this school." />
              </span>
            </th>
            <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <span className="inline-flex items-center">
                Projected Loss
                <InfoTooltip text="Estimated ADA funding loss for this school. Higher chronic rates = more lost instructional days = more lost revenue." />
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {schools.map((s) => (
            <tr
              key={s.school_name}
              className="hover:bg-emerald-50/50 transition-colors"
            >
              <td className="py-3 px-4 text-sm font-medium text-gray-900">
                {s.school_name}
              </td>
              <td className="py-3 px-4 text-sm text-gray-700 tabular-nums">
                {s.total_students}
              </td>
              <td className="py-3 px-4 text-sm text-gray-700 tabular-nums">
                {s.total_chronic_absent}
              </td>
              <td className="py-3 px-4">
                <span
                  className={cn(
                    "text-sm font-medium tabular-nums",
                    s.chronic_rate >= 20
                      ? "text-red-600"
                      : s.chronic_rate >= 10
                        ? "text-orange-600"
                        : "text-gray-700"
                  )}
                >
                  {s.chronic_rate.toFixed(1)}%
                </span>
              </td>
              <td className="py-3 px-4 text-sm font-medium text-gray-900 tabular-nums">
                ${s.total_projected_loss.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
