import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, X, Clock, Calendar } from "lucide-react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import type { Todo } from "@/types/todos";

interface TodoDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todo: Todo | null;
  onDone: (id: string) => void;
  onDismiss: (id: string) => void;
  onSnooze: (id: string, newDueDate: string) => void;
}

export function TodoDetailsModal({ open, onOpenChange, todo, onDone, onDismiss, onSnooze }: TodoDetailsModalProps) {
  const [busy, setBusy] = useState(false);

  if (!todo) return null;

  const handle = async (action: () => void) => {
    setBusy(true);
    try {
      action();
      onOpenChange(false);
    } catch {
      toast.error("Couldn't update. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const snoozeOptions = [
    { label: "Tomorrow", date: format(addDays(new Date(), 1), "yyyy-MM-dd") },
    { label: "In 3 days", date: format(addDays(new Date(), 3), "yyyy-MM-dd") },
    { label: "Next week", date: format(addDays(new Date(), 7), "yyyy-MM-dd") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{todo.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {todo.details && (
            <p className="text-sm text-muted-foreground">{todo.details}</p>
          )}
          {todo.due_date && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>Due {format(new Date(`${todo.due_date}T00:00:00`), "EEE, MMM d")}</span>
            </div>
          )}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <button
              disabled={busy}
              onClick={() => handle(() => onDone(todo.id))}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              <Check className="w-4 h-4" /> Done
            </button>
            <button
              disabled={busy}
              onClick={() => handle(() => onDismiss(todo.id))}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-secondary disabled:opacity-40"
            >
              <X className="w-4 h-4" /> Dismiss
            </button>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Snooze</p>
            <div className="flex gap-2">
              {snoozeOptions.map((opt) => (
                <button
                  key={opt.date}
                  disabled={busy}
                  onClick={() => handle(() => onSnooze(todo.id, opt.date))}
                  className="flex-1 py-1.5 text-xs rounded-md border border-border text-foreground hover:bg-secondary disabled:opacity-40"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
