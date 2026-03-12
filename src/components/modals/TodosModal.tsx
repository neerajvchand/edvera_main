import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Check, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, parseISO, addDays } from "date-fns";
import { ModalShell } from "./ModalShell";
import type { Todo } from "@/types/todos";
import { callNoteAiAssist } from "@/lib/noteAiAssist";

interface TodosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todos: Todo[];
  onAdd: (input: { title: string; details?: string; due_date?: string; child_id?: string; school_id: string }) => void;
  onMarkDone: (id: string) => void;
  onDelete: (id: string) => void;
  schoolId: string;
  childId?: string;
}

type DueChip = "today" | "tomorrow" | "pick" | null;

function chipDate(chip: DueChip): string | undefined {
  if (chip === "today") return format(new Date(), "yyyy-MM-dd");
  if (chip === "tomorrow") return format(addDays(new Date(), 1), "yyyy-MM-dd");
  return undefined;
}

export function TodosModal({ open, onOpenChange, todos, onAdd, onMarkDone, onDelete, schoolId, childId }: TodosModalProps) {
  const [title, setTitle] = useState("");
  const [selectedChip, setSelectedChip] = useState<DueChip>(null);
  const [customDate, setCustomDate] = useState("");
  const [refining, setRefining] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setTitle("");
      setSelectedChip(null);
      setCustomDate("");
      setRefining(false);
    }
  }, [open]);

  const openNativePicker = useCallback(() => {
    const el = dateInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); } catch { el.focus(); }
    } else {
      el.focus();
    }
  }, []);

  const resolvedDueDate = selectedChip === "pick" ? customDate || undefined : chipDate(selectedChip);

  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      due_date: resolvedDueDate,
      child_id: childId,
      school_id: schoolId,
    });
    setTitle("");
    setSelectedChip(null);
    setCustomDate("");
    toast.success("To-do added");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && title.trim()) {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRefine = async () => {
    if (!title.trim() || refining) return;
    setRefining(true);
    try {
      const result = await callNoteAiAssist("refine", title.trim());
      if (result.refined) setTitle(result.refined);
      else toast.error("AI couldn't refine. Try again.");
    } catch (err: any) {
      toast.error(err?.message || "AI response couldn't be parsed. Try again.");
    } finally {
      setRefining(false);
    }
  };

  const pickLabel = customDate
    ? format(parseISO(customDate), "MMM d")
    : "Pick date";

  const chips: { key: DueChip; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "tomorrow", label: "Tomorrow" },
    { key: "pick", label: pickLabel },
  ];

  const footer = (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleAdd}
        disabled={!title.trim()}
        className="px-5 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors sm:w-auto w-full"
      >
        Add
      </button>
    </>
  );

  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title="To-dos" footer={footer}>
      {/* Title input with refine */}
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          placeholder="Add a task..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <button
          type="button"
          onClick={handleRefine}
          disabled={!title.trim() || refining}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors rounded shrink-0"
        >
          {refining ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          ✨ Refine
        </button>
      </div>

      {/* Due date chips */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Due date</p>
        <div className="flex flex-wrap gap-2">
          {chips.map(({ key, label }) => {
            if (key === "pick") {
              return (
                <div key={key} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedChip === "pick" && customDate) {
                        setSelectedChip(null);
                        setCustomDate("");
                      } else {
                        setSelectedChip("pick");
                        const el = dateInputRef.current;
                        if (el && typeof el.showPicker === "function") {
                          try { el.showPicker(); } catch { /* ignore */ }
                        }
                      }
                    }}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                      selectedChip === key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                  <input
                    ref={dateInputRef}
                    type="date"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    tabIndex={-1}
                    aria-hidden
                    value={customDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        setCustomDate(val);
                        setSelectedChip("pick");
                      }
                    }}
                    onBlur={() => {
                      if (!customDate && selectedChip === "pick") {
                        setSelectedChip(null);
                      }
                    }}
                  />
                </div>
              );
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedChip(selectedChip === key ? null : key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                  selectedChip === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Existing todos list */}
      {todos.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          {todos.map((todo) => (
            <div key={todo.id} className="rounded-lg border border-border p-3 space-y-1">
              <p className="text-sm font-medium text-foreground">{todo.title}</p>
              {todo.details && (
                <p className="text-xs text-muted-foreground">{todo.details}</p>
              )}
              {todo.due_date && (
                <p className="text-[11px] text-muted-foreground">
                  Due {format(parseISO(todo.due_date), "MMM d, yyyy")}
                </p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => { onMarkDone(todo.id); toast.success("Marked done"); }}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                >
                  <Check className="w-3 h-3" /> Done
                </button>
                <button
                  onClick={() => { onDelete(todo.id); toast.success("To-do deleted"); }}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
