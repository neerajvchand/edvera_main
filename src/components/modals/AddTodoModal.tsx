import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { format, addDays } from "date-fns";
import { toast } from "sonner";

interface AddTodoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: { title: string; details?: string; due_date?: string; child_id?: string; school_id: string }) => void;
  schoolId: string;
  childId?: string;
}

export function AddTodoModal({ open, onOpenChange, onAdd, schoolId, childId }: AddTodoModalProps) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [dueDate, setDueDate] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      details: details.trim() || undefined,
      due_date: dueDate || undefined,
      child_id: childId,
      school_id: schoolId,
    });
    setTitle("");
    setDetails("");
    setDueDate("");
    onOpenChange(false);
    toast.success("To-do added");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Add a to-do</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder="What do you need to do?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <Input
            placeholder="Details (optional)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          <div>
            <label className="text-xs text-muted-foreground">Due date (optional)</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <button
            type="submit"
            disabled={!title.trim()}
            className="w-full py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            Add to-do
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
