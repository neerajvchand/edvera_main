import { useState, forwardRef } from "react";
import type { TriageItem } from "@/hooks/useAttendanceTriage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, differenceInMinutes } from "date-fns";
import {
  CheckCircle,
  HelpCircle,
  PenLine,
  XCircle,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Props {
  item: TriageItem;
  isSelected: boolean;
  anySelected: boolean;
  onToggleSelect: () => void;
  onAction: (id: string, status: string, note?: string) => void;
  isUpdating: boolean;
  onRowClick: () => void;
  isFocused?: boolean;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-destructive/15 text-destructive border-destructive/30" },
  in_review: { label: "In Review", className: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-text))] border-[hsl(var(--status-info-border))]" },
  needs_info: { label: "Needs Info", className: "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))] border-[hsl(var(--status-warning-border))]" },
  resolved: { label: "Accepted", className: "bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-text))] border-[hsl(var(--status-success-border))]" },
  accepted: { label: "Accepted", className: "bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-text))] border-[hsl(var(--status-success-border))]" },
  corrected: { label: "Corrected", className: "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-text))] border-[hsl(var(--status-info-border))]" },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const TYPE_BADGE: Record<string, string> = {
  tardy: "bg-[hsl(var(--status-caution-bg))] text-[hsl(var(--status-caution-text))] border-[hsl(var(--status-caution-border))]",
  late: "bg-[hsl(var(--status-caution-bg))] text-[hsl(var(--status-caution-text))] border-[hsl(var(--status-caution-border))]",
  absent: "bg-destructive/10 text-destructive border-destructive/20",
  early: "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))] border-[hsl(var(--status-warning-border))]",
};

function getTypeBadgeClass(status: string) {
  const s = status.toLowerCase();
  for (const [key, cls] of Object.entries(TYPE_BADGE)) {
    if (s.includes(key)) return cls;
  }
  return "bg-secondary text-secondary-foreground border-border";
}

function getPriorityBorder(item: TriageItem): string {
  if (item.triage_status !== "new") return "border-l-transparent";
  // Reopened correction: amber border
  if (item.resolved_at) return "border-l-[hsl(var(--status-warning-border))]";
  const mins = differenceInMinutes(new Date(), new Date(item.created_at));
  if (mins >= 30) return "border-l-destructive";
  if (mins >= 10) return "border-l-[hsl(var(--status-warning-border))]";
  return "border-l-transparent";
}

const NEEDS_INFO_TEMPLATES = [
  "What time do you expect arrival?",
  "Can you clarify the reason?",
  "Do you have a note/documentation?",
];

const isActionable = (status: string) =>
  ["new", "in_review", "needs_info"].includes(status);

export const CompactTriageCard = forwardRef<HTMLDivElement, Props>(
  ({ item, isSelected, anySelected, onToggleSelect, onAction, isUpdating, onRowClick, isFocused }, ref) => {
    const [expanded, setExpanded] = useState(false);
    const [showCorrect, setShowCorrect] = useState(false);
    const [noteText, setNoteText] = useState(item.admin_note ?? "");
    const [showNeedsInfo, setShowNeedsInfo] = useState(false);
    const { toast } = useToast();
    const actionable = isActionable(item.triage_status);
    const badge = STATUS_BADGE[item.triage_status] ?? STATUS_BADGE.new;
    const borderClass = getPriorityBorder(item);

    return (
      <div
        ref={ref}
        tabIndex={0}
        className={cn(
          "rounded-lg border bg-card transition-all duration-200 border-l-4",
          borderClass,
          isSelected && "ring-2 ring-primary/40",
          isFocused && "ring-2 ring-ring",
          "focus:outline-none"
        )}
        data-triage-id={item.id}
      >
        {/* ROW 1: Decision layer */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          {/* Checkbox - shown on hover or when any selected */}
          <div
            className={cn(
              "shrink-0 transition-opacity",
              actionable && (anySelected || isSelected) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {actionable && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelect}
                className="h-4 w-4"
              />
            )}
          </div>

          {/* Student info */}
          <div
            className="flex-1 min-w-0 flex items-center gap-2 flex-wrap cursor-pointer"
            onClick={onRowClick}
          >
            <span className="font-semibold text-sm text-foreground truncate">
              {item.child_name}
            </span>
            <Badge variant="outline" className={cn("text-[10px] border h-5", getTypeBadgeClass(item.submitted_status))}>
              {item.submitted_status}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px] border h-5", badge.className)}>
              {badge.label}
            </Badge>
            {item.triage_status === "new" && item.resolved_at && (
              <Badge variant="outline" className="text-[10px] border h-5 bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))] border-[hsl(var(--status-warning-border))]">
                Updated
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {format(new Date(item.updated_at ?? item.created_at), "h:mm a")}
            </span>
          </div>

          {/* Actions */}
          {actionable && (
            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                className="h-7 text-[11px] gap-1 px-2.5 bg-[hsl(var(--status-success-text))] hover:bg-[hsl(var(--status-success-text))]/90 text-white"
                onClick={() => onAction(item.id, "resolved")}
                disabled={isUpdating}
              >
                <CheckCircle className="w-3 h-3" /> Accept
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setShowNeedsInfo(!showNeedsInfo)}>
                    <HelpCircle className="w-3.5 h-3.5 mr-2" /> Needs Info
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowCorrect(!showCorrect)}>
                    <PenLine className="w-3.5 h-3.5 mr-2" /> Correct
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onAction(item.id, "rejected")}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-2" /> Reject
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* ROW 2: Context layer */}
        {item.submitted_reason && (
          <div className="px-3 pb-2">
            <div
              className={cn(
                "text-xs text-foreground/70 bg-secondary/50 rounded px-2 py-1.5 cursor-pointer",
                !expanded && "line-clamp-2"
              )}
              onClick={() => setExpanded(!expanded)}
            >
              "{item.submitted_reason}"
              {item.submitted_reason.length > 100 && (
                <button className="inline-flex items-center ml-1 text-primary text-[10px]">
                  {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>
            {expanded && item.parent_name && (
              <p className="text-[10px] text-muted-foreground mt-1">— {item.parent_name}</p>
            )}
            {expanded && item.admin_note && (
              <p className="text-[10px] text-muted-foreground italic mt-1">Staff: {item.admin_note}</p>
            )}
          </div>
        )}

        {/* Needs Info quick templates */}
        {showNeedsInfo && (
          <div className="px-3 pb-2 space-y-2" onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] font-medium text-muted-foreground">Quick template (copy & mark):</p>
            <div className="flex flex-wrap gap-1.5">
              {NEEDS_INFO_TEMPLATES.map((t) => (
                <Button
                  key={t}
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2 gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(t);
                    toast({ title: "Copied to clipboard" });
                  }}
                >
                  <Copy className="w-2.5 h-2.5" /> {t}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => {
                onAction(item.id, "needs_info", noteText.trim() || undefined);
                setShowNeedsInfo(false);
              }}
              disabled={isUpdating || !noteText.trim()}
              title={!noteText.trim() ? "Select or type a note first" : undefined}
            >
              Mark as Needs Info
            </Button>
          </div>
        )}

        {/* Correct note input */}
        {showCorrect && (
          <div className="px-3 pb-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Correction note..."
              className="text-xs min-h-[50px] flex-1"
            />
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                className="h-7 text-[10px]"
                onClick={() => {
                  onAction(item.id, "corrected", noteText);
                  setShowCorrect(false);
                }}
                disabled={isUpdating}
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px]"
                onClick={() => setShowCorrect(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

CompactTriageCard.displayName = "CompactTriageCard";
