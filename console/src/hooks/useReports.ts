import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/hooks/useSession";
import type { ReportData, ReportPeriod } from "@/types/reports";
import { fetchReportData } from "@/services/reports/getReportData";
import { buildDistrictReportPdf } from "@/components/reports/districtReportPdf";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface GeneratedReport {
  name: string;
  date: string;
  blob: Blob;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function todayStr(): string {
  const d = new Date();
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/\s/g, "-")}-${todayISO()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useReports() {
  const { user } = useSession();

  // Config
  const [districtName, setDistrictName] = useState("");
  const [period, setPeriod] = useState<ReportPeriod>("ytd");
  const [preparedBy, setPreparedBy] = useState("");
  const [reportDate] = useState(todayStr());

  // Data + generation state
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GeneratedReport[]>([]);

  // Pre-fill user email
  useEffect(() => {
    if (user?.email && !preparedBy) {
      setPreparedBy(user.email);
    }
  }, [user]);

  // Pre-fetch data
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchReportData();
        setReportData(data);
        if (data.districtName) setDistrictName(data.districtName);
      } catch (err) {
        console.error("Failed to fetch report data:", err);
      } finally {
        setDataLoading(false);
      }
    })();
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!reportData) return;
    setGenerating(true);
    setError(null);

    try {
      await new Promise((r) => setTimeout(r, 100));

      const blob = buildDistrictReportPdf(reportData, {
        districtName,
        period,
        preparedBy,
        date: reportDate,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `District-Attendance-Report-${todayISO()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setHistory((prev) => [
        { name: `District Report - ${reportDate}`, date: reportDate, blob },
        ...prev,
      ]);
    } catch (err) {
      console.error("PDF generation failed:", err);
      setError(err instanceof Error ? err.message : "Failed to generate PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [reportData, districtName, period, preparedBy, reportDate]);

  const handleDownloadHistory = useCallback((report: GeneratedReport) => {
    downloadBlob(report.blob, report.name);
  }, []);

  return {
    districtName,
    setDistrictName,
    period,
    setPeriod,
    preparedBy,
    setPreparedBy,
    reportDate,
    dataLoading,
    generating,
    error,
    history,
    handleGenerate,
    handleDownloadHistory,
  };
}
