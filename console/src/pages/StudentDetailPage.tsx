import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudentDetail } from "@/hooks/useStudentDetail";
import { StudentDetailHeader } from "@/components/student-detail/StudentDetailHeader";
import { StudentActionItems } from "@/components/student-detail/StudentActionItems";
import { StudentAttendanceSummary } from "@/components/student-detail/StudentAttendanceSummary";
import { StudentAttendanceTrend } from "@/components/student-detail/StudentAttendanceTrend";
import { StudentComplianceCases } from "@/components/student-detail/StudentComplianceCases";
import { StudentHistoryTimeline } from "@/components/student-detail/StudentHistoryTimeline";
import { StudentFundingImpact } from "@/components/student-detail/StudentFundingImpact";

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={cn("bg-white rounded-xl border border-gray-100 shadow-sm animate-pulse", className)}>
      <div className="p-6 space-y-3">
        <div className="h-4 bg-slate-100 rounded w-1/3" />
        <div className="h-3 bg-slate-100 rounded w-2/3" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
      </div>
    </div>
  );
}

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const data = useStudentDetail(id);

  if (!data.headerLoading && !data.student) {
    return (
      <div className="p-8">
        <Link to="/students" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Students
        </Link>
        <p className="text-sm text-gray-500">Student not found.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <Link to="/students" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Students
      </Link>

      {data.headerLoading ? (
        <SkeletonBlock className="mb-6 h-[100px]" />
      ) : data.student ? (
        <StudentDetailHeader student={data.student} snapshot={data.snapshot} signal={data.signal} complianceCase={data.activeCase} />
      ) : null}

      {!data.timelineLoading && <StudentActionItems actions={data.actions} />}

      {data.headerLoading || data.chartDataLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <SkeletonBlock className="h-[400px]" />
          <SkeletonBlock className="h-[400px]" />
        </div>
      ) : data.snapshot ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <StudentAttendanceSummary snapshot={data.snapshot} />
          <StudentAttendanceTrend signal={data.signal} allAttendance={data.allAttendance} />
        </div>
      ) : null}

      {!data.timelineLoading && <StudentComplianceCases cases={data.allComplianceCases} />}

      {data.timelineLoading ? (
        <SkeletonBlock className="h-[300px] mb-6" />
      ) : (
        <StudentHistoryTimeline
          absences={data.absences}
          complianceCases={data.activeCase ? [data.activeCase] : []}
          actions={data.actions}
          interventions={data.interventions}
        />
      )}

      {!data.headerLoading && <StudentFundingImpact snapshot={data.snapshot} />}
    </div>
  );
}
