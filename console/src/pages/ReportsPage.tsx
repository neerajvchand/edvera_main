import { BriefsPanel } from "@/components/BriefsPanel";
import { DistrictAttendanceReport } from "@/components/reports/DistrictAttendanceReport";

export function ReportsPage() {
  return (
    <div className="p-8 max-w-5xl">
      {/* District Attendance Report */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          District Attendance Report
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Generate a comprehensive attendance summary for board presentations, staff meetings, or compliance documentation.
        </p>
      </div>

      <DistrictAttendanceReport />

      {/* Daily Attendance Brief */}
      <div className="border-t border-gray-200 my-8" />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Daily Attendance Brief
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          AI-generated attendance summary emailed to school administrators each
          morning. Briefs use aggregate metrics only — no student PII is
          processed by AI.
        </p>
      </div>

      <BriefsPanel />
    </div>
  );
}
