/**
 * SART Action Plan step — dynamic list of 1-5 action items.
 * Each item has description, assigned role, and due date.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { saveSartActionPlan } from "@/services/compliance/saveSartActionPlan";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const ROLE_OPTIONS = [
  "Attendance Clerk",
  "Counselor",
  "Principal",
  "Parent/Guardian",
  "Student",
  "Teacher",
  "Community Liaison",
];

interface ActionDraft {
  description: string;
  assigned_role: string;
  due_date: string;
}

function emptyItem(): ActionDraft {
  return { description: "", assigned_role: "", due_date: "" };
}

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  caseId: string;
  studentId: string;
  schoolId: string;
  onSaved: () => void;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function SartActionPlanStep({
  caseId,
  studentId,
  schoolId,
  onSaved,
}: Props) {
  const [items, setItems] = useState<ActionDraft[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdd = items.length < 5;
  const canSave =
    !saving &&
    items.length > 0 &&
    items.every((i) => i.description.trim() && i.assigned_role && i.due_date);

  function updateItem(index: number, patch: Partial<ActionDraft>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addItem() {
    if (canAdd) setItems((prev) => [...prev, emptyItem()]);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await saveSartActionPlan(caseId, studentId, schoolId, items);
    setSaving(false);
    if (result.success) {
      onSaved();
    } else {
      setError(result.error ?? "Failed to save.");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Define action items agreed upon during the SART meeting. Each item
        should have a clear owner and due date.
      </p>

      {/* Action items */}
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="p-3 rounded-lg border border-gray-200 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Item {idx + 1}
              </span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Description */}
            <input
              type="text"
              value={item.description}
              onChange={(e) =>
                updateItem(idx, { description: e.target.value })
              }
              placeholder="What needs to be done?"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />

            <div className="flex gap-2">
              {/* Assigned role */}
              <select
                value={item.assigned_role}
                onChange={(e) =>
                  updateItem(idx, { assigned_role: e.target.value })
                }
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Assign to…</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>

              {/* Due date */}
              <input
                type="date"
                value={item.due_date}
                onChange={(e) =>
                  updateItem(idx, { due_date: e.target.value })
                }
                className="w-40 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Add button */}
      {canAdd && (
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium hover:text-emerald-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add action item
        </button>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={!canSave}
        className={cn(
          "w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2",
          canSave
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-gray-200 text-gray-400 cursor-not-allowed",
        )}
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Action Plan ({items.length} item{items.length !== 1 ? "s" : ""})
      </button>
    </div>
  );
}
