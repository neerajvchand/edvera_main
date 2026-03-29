import { Link } from "react-router-dom";
import { Settings, FileText } from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { useAdminMembership } from "@/hooks/useAdminMembership";
import { useAdminAnnouncements } from "@/hooks/useAdminAnnouncements";
import { useAdminSchoolEvents } from "@/hooks/useAdminSchoolEvents";
import { useAttendanceTriage } from "@/hooks/useAttendanceTriage";
import { useComingUp } from "@/hooks/useComingUp";
import { useSchoolRiskSummary } from "@/hooks/useSchoolRiskSummary";
import { TriageQueue } from "@/components/admin/dashboard/TriageQueue";
import { TodayContext } from "@/components/admin/dashboard/TodayContext";
import { CommsSidebar } from "@/components/admin/dashboard/CommsSidebar";
import { StudentRiskSummary } from "@/components/admin/dashboard/StudentRiskSummary";

function getTodayInTz(tz: string): string {
  const now = toZonedTime(new Date(), tz);
  return format(now, "yyyy-MM-dd");
}

export default function AdminDashboard() {
  const { schoolId, timezone } = useAdminMembership();
  const tz = timezone ?? "America/Los_Angeles";
  const todayStr = getTodayInTz(tz);

  const { announcements } = useAdminAnnouncements(schoolId);
  useAdminSchoolEvents(schoolId);
  const { items: allTriageItems, updateTriage, isUpdating } =
    useAttendanceTriage(schoolId, "all");
  const riskSummary = useSchoolRiskSummary(schoolId);
  const { data: comingUpEvents } = useComingUp(schoolId ?? undefined);

  const handleAction = async (args: { id: string; triage_status: string; admin_note?: string }) => {
    await updateTriage(args);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Command Center</h1>
        <p className="text-sm text-muted-foreground">Bayside Academy operations overview</p>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <TriageQueue items={allTriageItems} updateTriage={handleAction} isUpdating={isUpdating} />
          <TodayContext triageItems={allTriageItems} riskSummary={riskSummary} />
        </div>
        <div className="lg:col-span-1 space-y-6">
          <CommsSidebar announcements={announcements} events={comingUpEvents ?? []} />
          <StudentRiskSummary summary={riskSummary} />
        </div>
      </div>

      {/* Utility links */}
      <div className="flex items-center gap-6 pt-2">
        <Link
          to="/admin/school-profile"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          School Settings
        </Link>
        <Link
          to="/admin/documents"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          Documents
        </Link>
      </div>
    </div>
  );
}
