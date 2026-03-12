import { useState, useMemo, useCallback } from "react";
import { ActionItem } from "@/types/actionCenter";
import { scoreActionItem } from "@/lib/actionCenterScore";
import { supabase } from "@/integrations/supabase/client";
import { useTodos } from "@/hooks/useTodos";
import { useNotes } from "@/hooks/useNotes";
import { useSelectedChild } from "@/hooks/useSelectedChild";
import { useAttendanceEntries } from "@/hooks/useAttendanceEntries";
import type { Todo } from "@/types/todos";
import type { Note } from "@/types/notes";
import { format } from "date-fns";

// Convert a Todo row to an ActionItem for unified scoring/display
function todoToActionItem(todo: Todo): ActionItem {
  return {
    id: `todo:${todo.id}`,
    category: "task",
    title: todo.title,
    description: todo.details ?? undefined,
    dueAt: todo.due_date ? `${todo.due_date}T23:59:59` : undefined,
    createdAt: todo.created_at,
    source: { kind: "user", label: "To-do" },
    status: todo.status as ActionItem["status"],
    requiresAction: true,
    tags: ["todo"],
  };
}

// Build a single note summary ActionItem
function noteToActionItem(note: Note): ActionItem {
  const truncated = note.content.length > 60 ? note.content.slice(0, 57) + "…" : note.content;
  return {
    id: `note:${note.id}`,
    category: "note",
    title: "Latest note",
    description: truncated,
    createdAt: note.created_at,
    source: { kind: "user", label: "Note" },
    status: "open",
    tags: ["note"],
  };
}

// Prompt items shown when there are no real items
function todoPromptItem(): ActionItem {
  return {
    id: "prompt:todo",
    category: "task",
    title: "Add a school to-do",
    description: "Permission slips, picture day, reminders—capture it here.",
    createdAt: new Date().toISOString(),
    source: { kind: "system", label: "Edvera" },
    status: "open",
    tags: ["prompt"],
  };
}

function notePromptItem(): ActionItem {
  return {
    id: "prompt:note",
    category: "note",
    title: "Quick note for later",
    description: "Anything you don't want to forget—store it here.",
    createdAt: new Date().toISOString(),
    source: { kind: "system", label: "Edvera" },
    status: "open",
    tags: ["prompt"],
  };
}

function isItemActive(item: ActionItem, now: Date): boolean {
  if (item.status !== "open") return false;
  if (item.expiresAt && new Date(item.expiresAt) < now) return false;
  if (item.snoozedUntil && new Date(item.snoozedUntil) > now) return false;
  return true;
}

function categoryOrder(cat: string): number {
  // overdue/tasks first, then attendance, then notes last
  if (cat === "alert") return 0;
  if (cat === "task") return 1;
  if (cat === "attendance") return 2;
  if (cat === "note") return 3;
  return 4;
}

function scoreAndSort(raw: ActionItem[], now: Date) {
  const open = raw.filter((i) => isItemActive(i, now));
  const scored = open
    .map((item) => {
      const { score, priority } = scoreActionItem(item, now);
      return { ...item, score, priority };
    })
    .sort((a, b) => {
      // Primary: score descending
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      // Secondary: category order (tasks before notes)
      return categoryOrder(a.category) - categoryOrder(b.category);
    });

  const urgentCount = scored.filter((i) => i.priority === "urgent").length;
  const soonCount = scored.filter((i) => i.priority === "soon").length;
  const fyiCount = scored.filter((i) => i.priority === "fyi").length;
  const topItems = scored.slice(0, 3);

  return { items: scored, urgentCount, soonCount, fyiCount, topItems };
}

export function useActionCenter() {
  const now = useMemo(() => new Date(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const { selectedChild, school } = useSelectedChild();

  const schoolId = selectedChild?.school_id ?? "";
  const childId = selectedChild?.id;

  // Auth listener
  useState(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  });

  // Real DB hooks
  const todosHook = useTodos({ childId, schoolId, status: "open" });
  const notesHook = useNotes({ childId, schoolId, limit: 5 });
  const { entries: attendanceEntries, todayDate, isLoading: attendanceLoading } = useAttendanceEntries();

  // Derive clean, filtered arrays — exclude empty/whitespace content
  const activeTodos = useMemo(
    () => todosHook.todos.filter((t) => t.title.trim().length > 0),
    [todosHook.todos]
  );

  const activeNotes = useMemo(
    () => notesHook.notes.filter((n) => n.content.trim().length > 0),
    [notesHook.notes]
  );

  // Build unified ActionItem list from filtered todos + notes (NO prompts/placeholders)
  const rawItems = useMemo(() => {
    const items: ActionItem[] = [];

    // Attendance item — only show if no entry logged for today
    const hasToday = attendanceEntries.some(e => e.attendance_date === todayDate);
    const todayD = new Date(`${todayDate}T00:00:00`);
    const todayDow = todayD.getDay();
    const isWeekday = todayDow >= 1 && todayDow <= 5;

    if (selectedChild && !hasToday && isWeekday) {
      items.push({
        id: "ac-attendance",
        category: "attendance",
        title: "Confirm today's attendance",
        description: "Mark your child present or report an absence.",
        dueAt: new Date(now.getTime() + 2 * 3600_000).toISOString(),
        createdAt: new Date(now.getTime() - 10 * 3600_000).toISOString(),
        source: { kind: "system", label: "Attendance" },
        status: "open",
        requiresAction: true,
        tags: ["attendance"],
      });
    }

    // Missed previous weekday nudge
    if (selectedChild) {
      const prevWeekday = new Date(todayD);
      if (todayDow === 1) {
        prevWeekday.setDate(todayD.getDate() - 3); // Friday
      } else if (todayDow === 0) {
        prevWeekday.setDate(todayD.getDate() - 2); // Friday
      } else if (todayDow === 6) {
        prevWeekday.setDate(todayD.getDate() - 1); // Friday
      } else {
        prevWeekday.setDate(todayD.getDate() - 1);
      }
      const prevDateStr = prevWeekday.toISOString().slice(0, 10);
      const hasPrev = attendanceEntries.some(e => e.attendance_date === prevDateStr);
      if (!hasPrev) {
        const dayName = prevWeekday.toLocaleDateString("en-US", { weekday: "long" });
        items.push({
          id: `ac-missed:${prevDateStr}`,
          category: "alert",
          title: `You missed logging attendance for ${dayName}`,
          description: `Tap to log attendance for ${dayName}.`,
          createdAt: now.toISOString(),
          source: { kind: "system", label: "Attendance" },
          status: "open",
          requiresAction: true,
          tags: ["attendance", "missed"],
        });
      }
    }

    // Todos → show at most 2 highest-priority in the main list
    const sortedTodos = [...activeTodos].sort((a, b) => {
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;
      if (a.due_date && b.due_date) {
        const cmp = a.due_date.localeCompare(b.due_date);
        if (cmp !== 0) return cmp;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    const topTodos = sortedTodos.slice(0, 2);
    topTodos.forEach((t) => items.push(todoToActionItem(t)));

    // Notes → ActionItem (latest real note only, NO prompt items)
    if (activeNotes.length > 0) {
      items.push(noteToActionItem(activeNotes[0]));
    }

    return items;
  }, [activeTodos, activeNotes, selectedChild, now, attendanceEntries, todayDate]);

  const result = useMemo(() => scoreAndSort(rawItems, now), [rawItems, now]);
  const loading = todosHook.isLoading || notesHook.isLoading || attendanceLoading;

  // Legacy action methods (for attendance items)
  const markDone = useCallback(
    async (id: string) => {
      if (id.startsWith("todo:")) {
        todosHook.markDone.mutate(id.replace("todo:", ""));
      } else if (id.startsWith("note:")) {
        notesHook.deleteNote.mutate(id.replace("note:", ""));
      } else if (id.startsWith("prompt:")) {
        // no-op for prompt items
      }
    },
    [todosHook.markDone, notesHook.deleteNote]
  );

  const dismiss = useCallback(
    async (id: string) => {
      if (id.startsWith("todo:")) {
        todosHook.dismiss.mutate(id.replace("todo:", ""));
      } else if (id.startsWith("note:")) {
        notesHook.deleteNote.mutate(id.replace("note:", ""));
      }
    },
    [todosHook.dismiss, notesHook.deleteNote]
  );

  const snooze = useCallback(
    async (id: string, hours: number) => {
      if (id.startsWith("todo:")) {
        const newDueDate = format(new Date(Date.now() + hours * 3600_000), "yyyy-MM-dd");
        todosHook.snooze.mutate({ id: id.replace("todo:", ""), newDueDate });
      } else if (id.startsWith("note:")) {
        // Notes don't have due dates — pin the note instead as a "snooze" equivalent
        notesHook.updateNote.mutate({ id: id.replace("note:", ""), pinned: true });
      }
    },
    [todosHook.snooze, notesHook.updateNote]
  );

  return {
    ...result,
    loading,
    error: null,
    userId,
    markDone,
    dismiss,
    snooze,
    // Filtered counts for UI
    activeTodosCount: activeTodos.length,
    activeNotesCount: activeNotes.length,
    // Expose hooks for modals
    todosHook,
    notesHook,
    schoolId,
    childId,
  };
}
