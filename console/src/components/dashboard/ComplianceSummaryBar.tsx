import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface ComplianceSummaryBarProps {
  complianceCasesOpen: number;
  actionsOverdue: number;
  tier1Cases: number;
  tier2Cases: number;
  tier3Cases: number;
}

export function ComplianceSummaryBar({
  complianceCasesOpen,
  actionsOverdue,
  tier1Cases,
  tier2Cases,
  tier3Cases,
}: ComplianceSummaryBarProps) {
  return (
    <Link
      to="/compliance"
      className="group flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-2.5 hover:bg-gray-50 transition-colors"
    >
      <p className="text-[11px] text-gray-500">
        <span className="font-medium text-gray-900">
          {complianceCasesOpen}
        </span>{" "}
        open
        <span className="mx-1.5 text-gray-300">·</span>
        <span
          className={
            actionsOverdue > 0
              ? "font-medium text-red-600"
              : "text-gray-500"
          }
        >
          {actionsOverdue} overdue
        </span>
        <span className="mx-2 text-gray-200">|</span>
        Tier 1: <span className="font-medium text-gray-900">{tier1Cases}</span>
        <span className="mx-1.5 text-gray-300">·</span>
        Tier 2: <span className="font-medium text-gray-900">{tier2Cases}</span>
        <span className="mx-1.5 text-gray-300">·</span>
        SARB:{" "}
        <span className="font-medium text-gray-900">{tier3Cases}</span>
      </p>

      <ArrowRight
        size={14}
        className="text-gray-300 group-hover:text-brand-500 transition-colors shrink-0 ml-3"
      />
    </Link>
  );
}
