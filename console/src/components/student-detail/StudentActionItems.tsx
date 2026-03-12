import { Link } from "react-router-dom";
import { FileText, Phone, ClipboardList, ChevronRight } from "lucide-react";
import type { Action } from "@/hooks/useStudentDetail";
import { fmtShortDate } from "@/hooks/useStudentDetail";

const ACTION_ICONS: Record<string, typeof FileText> = {
  send_letter: FileText,
  schedule_conference: Phone,
  follow_up_call: Phone,
  prepare_sarb_packet: FileText,
  review_case: ClipboardList,
};

export function StudentActionItems({ actions }: { actions: Action[] }) {
  const openActions = actions.filter((a) => a.status === "open");
  if (openActions.length === 0) return null;

  return (
    <div className="border-l-4 border-amber-400 bg-amber-50 rounded-r-lg p-4 mb-6">
      <p className="text-sm font-semibold text-amber-800 mb-2">
        {openActions.length} action{openActions.length !== 1 ? "s" : ""} due for this student
      </p>
      <div className="space-y-1.5">
        {openActions.map((a) => {
          const Icon = ACTION_ICONS[a.action_type] ?? ClipboardList;
          return (
            <div key={a.id} className="flex items-center gap-2 text-sm">
              <Icon className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span className="text-slate-700">{a.title}</span>
              <span className="text-slate-400 text-xs ml-auto shrink-0">
                Due {fmtShortDate(a.due_date)}
              </span>
              {a.compliance_case_id && (
                <Link
                  to={`/compliance/cases/${a.compliance_case_id}`}
                  className="text-xs text-amber-700 hover:text-amber-800 font-medium flex items-center gap-0.5 shrink-0"
                >
                  View Case <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
