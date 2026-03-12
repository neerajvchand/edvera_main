import { Button } from "@/components/ui/button";
import { CheckCircle, HelpCircle, XCircle, X } from "lucide-react";

interface Props {
  count: number;
  onAction: (status: string) => void;
  isUpdating: boolean;
  onClear: () => void;
}

export function TriageBatchBar({ count, onAction, isUpdating, onClear }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg">
      <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{count} selected</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClear}>
            <X className="w-3 h-3 mr-1" /> Clear
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-9 text-xs gap-1.5 bg-[hsl(var(--status-success-text))] hover:bg-[hsl(var(--status-success-text))]/90 text-white"
            onClick={() => onAction("resolved")}
            disabled={isUpdating}
          >
            <CheckCircle className="w-3.5 h-3.5" /> Accept
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs gap-1.5"
            onClick={() => onAction("needs_info")}
            disabled={isUpdating}
          >
            <HelpCircle className="w-3.5 h-3.5" /> Needs Info
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => onAction("rejected")}
            disabled={isUpdating}
          >
            <XCircle className="w-3.5 h-3.5" /> Reject
          </Button>
        </div>
      </div>
    </div>
  );
}
