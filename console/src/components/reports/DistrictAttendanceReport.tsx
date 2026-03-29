import { cn } from "@/lib/utils";
import {
  FileBarChart,
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { useReports } from "@/hooks/useReports";
import type { ReportPeriod } from "@/types/reports";
import { PERIOD_LABELS } from "@/services/reports/getReportData";

export function DistrictAttendanceReport() {
  const rpt = useReports();

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Configuration card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-lg w-full">
        <div className="space-y-4">
          {/* District name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">District Name</label>
            <input
              type="text"
              value={rpt.districtName}
              onChange={(e) => rpt.setDistrictName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Report period */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Report Period</label>
            <div className="relative">
              <select
                value={rpt.period}
                onChange={(e) => rpt.setPeriod(e.target.value as ReportPeriod)}
                className="w-full appearance-none rounded-lg border border-gray-200 px-3 py-2 pr-8 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {(Object.keys(PERIOD_LABELS) as ReportPeriod[]).map((k) => (
                  <option key={k} value={k}>{PERIOD_LABELS[k]}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Prepared by */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Prepared By</label>
            <input
              type="text"
              value={rpt.preparedBy}
              onChange={(e) => rpt.setPreparedBy(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input
              type="text"
              value={rpt.reportDate}
              readOnly
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-slate-500 bg-slate-50 cursor-not-allowed"
            />
          </div>

          {/* Generate button */}
          <button
            onClick={rpt.handleGenerate}
            disabled={rpt.generating || rpt.dataLoading}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors mt-2",
              rpt.generating || rpt.dataLoading
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            )}
          >
            {rpt.generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating report...</>
            ) : rpt.dataLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Loading data...</>
            ) : (
              <><FileBarChart className="h-4 w-4" /> Generate Report</>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-4">
          Report generates as a downloadable PDF. All data reflects the most recent engine computation.
        </p>

        {rpt.error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-100 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{rpt.error}</p>
          </div>
        )}
      </div>

      {/* History panel */}
      {rpt.history.length > 0 && (
        <div className="flex-1 max-w-sm">
          <h2 className="text-sm font-medium text-slate-700 mb-3">Previously Generated</h2>
          <div className="space-y-2">
            {rpt.history.map((report, i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="text-sm text-slate-700 truncate">{report.name}</span>
                </div>
                <button
                  onClick={() => rpt.handleDownloadHistory(report)}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 shrink-0 ml-3"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
