import {
  Megaphone,
  Calendar,
  ClipboardCheck,
  Trash2,
  Pencil,
  Activity,
  Settings,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import type { AuditEntry } from "@/hooks/useAuditLog";

interface RecentActivityProps {
  entries: AuditEntry[] | undefined;
  isLoading: boolean;
}

function actionIcon(action: string) {
  if (action.includes("ANNOUNCEMENT")) return Megaphone;
  if (action.includes("EVENT")) return Calendar;
  if (action.includes("TRIAGE")) return ClipboardCheck;
  if (action.includes("DELETE")) return Trash2;
  if (action.includes("UPDATE") && action.includes("SCHOOL")) return Settings;
  if (action.includes("UPDATE")) return Pencil;
  return Activity;
}

function actionLabel(entry: AuditEntry): string {
  const meta = entry.meta ?? {};
  const triageStatus = (meta as Record<string, unknown>).triage_status as string | undefined;

  switch (entry.action) {
    case "RESOLVE_TRIAGE":
      if (triageStatus === "rejected") return "Rejected absence";
      return "Accepted absence";
    case "REJECT_TRIAGE":
      return "Rejected absence";
    case "CORRECT_TRIAGE":
      return "Corrected record";
    case "NEEDS_INFO_TRIAGE":
      return "Requested more info";
    case "CREATE_ANNOUNCEMENT":
      return "Published announcement";
    case "UPDATE_ANNOUNCEMENT":
      return "Updated announcement";
    case "DELETE_ANNOUNCEMENT":
      return "Deleted announcement";
    case "CREATE_EVENT":
      return "Added event";
    case "UPDATE_EVENT":
      return "Updated event";
    case "DELETE_EVENT":
      return "Deleted event";
    case "UPDATE_SCHOOL_PROFILE":
      return "Updated school profile";
    default:
      return entry.action.replace(/_/g, " ").toLowerCase();
  }
}

const MAX_ENTRIES = 8;

export function RecentActivity({ entries, isLoading }: RecentActivityProps) {
  if (isLoading) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Recent Activity</h3>
        <p className="text-xs text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const list = (entries ?? []).slice(0, MAX_ENTRIES);

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">Recent Activity</h3>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recent activity</p>
      ) : (
        <div className="divide-y divide-border">
          {list.map((entry) => {
            const Icon = actionIcon(entry.action);
            return (
              <div key={entry.id} className="flex items-center gap-2.5 py-2">
                <div className="rounded-md bg-secondary p-1 shrink-0">
                  <Icon className="w-3 h-3 text-muted-foreground" />
                </div>
                <span className="text-xs text-foreground flex-1 truncate">{actionLabel(entry)}</span>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                  {formatDistanceToNowStrict(new Date(entry.created_at), { addSuffix: false })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
