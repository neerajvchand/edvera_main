import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Pin, Trash2, Loader2, Copy, FileInput } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ModalShell } from "./ModalShell";
import type { Note } from "@/types/notes";
import { callNoteAiAssist, type AiMode } from "@/lib/noteAiAssist";

interface NotesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: Note[];
  onAdd: (input: { content: string; child_id?: string; school_id: string; pinned?: boolean }) => void;
  onUpdate: (input: { id: string; pinned?: boolean }) => void;
  onDelete: (id: string) => void;
  schoolId: string;
  childId?: string;
  onAddTodos?: (items: {
    title: string;
    details?: string;
    due_date?: string;
    child_id?: string;
    school_id: string;
  }[]) => void;
}

export function NotesModal({ open, onOpenChange, notes, onAdd, onUpdate, onDelete, schoolId, childId, onAddTodos }: NotesModalProps) {
  const [newContent, setNewContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // AI state
  const [aiBusy, setAiBusy] = useState<AiMode | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [todoPreviewOpen, setTodoPreviewOpen] = useState(false);
  const [previewTodos, setPreviewTodos] = useState<{ title: string; details?: string | null; due_date?: string | null }[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    } else {
      setNewContent("");
      setAiBusy(null);
      setDraftOpen(false);
      setDraftText("");
      setTodoPreviewOpen(false);
      setPreviewTodos([]);
      setSelectedPreview(new Set());
    }
  }, [open]);

  const handleAdd = () => {
    if (!newContent.trim()) return;
    onAdd({
      content: newContent.trim(),
      child_id: childId,
      school_id: schoolId,
    });
    setNewContent("");
    toast.success("Note saved");
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.metaKey && newContent.trim()) {
      e.preventDefault();
      handleAdd();
    }
  };

  // AI handler
  const runAi = async (mode: AiMode) => {
    if (!newContent.trim() || aiBusy) return;
    setAiBusy(mode);
    try {
      const result = await callNoteAiAssist(mode, newContent.trim());

      if (mode === "refine") {
        if (result.refined) setNewContent(result.refined);
        else toast.error("AI couldn't refine the text. Try again.");
      } else if (mode === "extract_todos") {
        if (!result.todos.length) {
          toast("No action items found in your note.");
        } else {
          setPreviewTodos(result.todos);
          setSelectedPreview(new Set(result.todos.map((_, i) => i)));
          setTodoPreviewOpen(true);
        }
      } else if (mode === "draft_message") {
        if (result.draft_message) {
          setDraftText(result.draft_message);
          setDraftOpen(true);
        } else {
          toast.error("AI couldn't draft a message. Try again.");
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "AI response couldn't be parsed. Try again.");
    } finally {
      setAiBusy(null);
    }
  };

  const confirmTodos = () => {
    if (!onAddTodos) return;
    const items = previewTodos
      .filter((_, i) => selectedPreview.has(i))
      .map((t) => ({
        title: t.title,
        details: t.details ?? undefined,
        due_date: t.due_date ?? undefined,
        child_id: childId,
        school_id: schoolId,
      }));
    if (items.length) {
      onAddTodos(items);
      toast.success("Added to Action Center");
    }
    setTodoPreviewOpen(false);
    setPreviewTodos([]);
    setSelectedPreview(new Set());
  };

  const togglePreview = (idx: number) => {
    setSelectedPreview((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const aiDisabled = !newContent.trim() || !!aiBusy;

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
        disabled={!newContent.trim()}
        className="px-5 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors sm:w-auto w-full"
      >
        Add
      </button>
    </>
  );

  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title="Notes" footer={footer}>
      {/* Textarea */}
      <Textarea
        ref={textareaRef}
        placeholder="Write a quick note..."
        value={newContent}
        onChange={(e) => setNewContent(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        className="resize-none"
      />

      {/* AI Assist buttons */}
      <div className="space-y-1">
        <div className="flex flex-wrap gap-2">
          <AiButton label="✨ Refine" disabled={aiDisabled} loading={aiBusy === "refine"} onClick={() => runAi("refine")} />
          <AiButton
            label="✅ Make To-Dos"
            disabled={aiDisabled || !onAddTodos}
            loading={aiBusy === "extract_todos"}
            onClick={() => runAi("extract_todos")}
          />
          <AiButton label="✉️ Draft Message" disabled={aiDisabled} loading={aiBusy === "draft_message"} onClick={() => runAi("draft_message")} />
        </div>
        <p className="text-[10px] text-muted-foreground">AI can help rewrite and organize—please review for accuracy.</p>
      </div>

      {/* Todo preview */}
      {todoPreviewOpen && previewTodos.length > 0 && (
        <div className="rounded-lg border border-border p-3 space-y-2 bg-secondary/30">
          <p className="text-xs font-medium text-foreground">Extracted to-dos</p>
          {previewTodos.map((todo, i) => (
            <label key={i} className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={selectedPreview.has(i)}
                onCheckedChange={() => togglePreview(i)}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <p className="text-sm text-foreground">{todo.title}</p>
                {todo.details && <p className="text-xs text-muted-foreground">{todo.details}</p>}
                {todo.due_date && <p className="text-[11px] text-muted-foreground">Due: {todo.due_date}</p>}
              </div>
            </label>
          ))}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => { setTodoPreviewOpen(false); setPreviewTodos([]); setSelectedPreview(new Set()); }}
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmTodos}
              disabled={selectedPreview.size === 0}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              Add selected ({selectedPreview.size})
            </button>
          </div>
        </div>
      )}

      {/* Draft message preview */}
      {draftOpen && draftText && (
        <div className="rounded-lg border border-border p-3 space-y-2 bg-secondary/30">
          <p className="text-xs font-medium text-foreground">Draft message</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{draftText}</p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => { navigator.clipboard.writeText(draftText); toast.success("Copied to clipboard"); }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg border border-border transition-colors"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
            <button
              onClick={() => {
                setNewContent((prev) => prev + "\n\n— Draft message —\n" + draftText);
                setDraftOpen(false);
                setDraftText("");
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg border border-border transition-colors"
            >
              <FileInput className="w-3 h-3" /> Insert into note
            </button>
            <button
              onClick={() => { setDraftOpen(false); setDraftText(""); }}
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors ml-auto"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Existing notes list */}
      {notes.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg border border-border p-3 space-y-1">
              <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onUpdate({ id: note.id, pinned: !note.pinned })}
                  className={cn(
                    "flex items-center gap-1 text-[11px] transition-colors",
                    note.pinned ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Pin className="w-3 h-3" /> {note.pinned ? "Pinned" : "Pin"}
                </button>
                <button
                  onClick={() => { onDelete(note.id); toast.success("Note deleted"); }}
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

function AiButton({ label, disabled, loading, onClick }: { label: string; disabled: boolean; loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors rounded"
    >
      {loading && <Loader2 className="w-3 h-3 animate-spin" />}
      {label}
    </button>
  );
}
