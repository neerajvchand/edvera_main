import { Plus, Trash2 } from "lucide-react";
import { ATTENDEE_ROLES, type Attendee } from "@/hooks/useSarbPacket";

export function SarbPacketStepAttendees({
  attendees,
  setAttendees,
}: {
  attendees: Attendee[];
  setAttendees: (v: Attendee[]) => void;
}) {
  function addAttendee() {
    setAttendees([
      ...attendees,
      { id: crypto.randomUUID(), name: "", role: "Other", title: "" },
    ]);
  }

  function updateAttendee(id: string, field: keyof Attendee, value: string) {
    setAttendees(
      attendees.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  }

  function removeAttendee(id: string) {
    setAttendees(attendees.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Add the SARB meeting attendees. Include school staff, parent/guardians, and any other participants.
      </p>

      <div className="space-y-3">
        {attendees.map((att) => (
          <div key={att.id} className="rounded-lg border border-gray-200 p-3">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-5">
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input
                  value={att.name}
                  onChange={(e) => updateAttendee(att.id, "name", e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-xs text-gray-500 mb-1">Role</label>
                <select
                  value={att.role}
                  onChange={(e) => updateAttendee(att.id, "role", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  {ATTENDEE_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-3">
                <label className="block text-xs text-gray-500 mb-1">Title</label>
                <input
                  value={att.title}
                  onChange={(e) => updateAttendee(att.id, "title", e.target.value)}
                  placeholder="Job title"
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div className="col-span-1 flex items-end justify-center pb-0.5">
                <button
                  onClick={() => removeAttendee(att.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addAttendee}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors w-full justify-center"
      >
        <Plus className="h-4 w-4" /> Add Attendee
      </button>

      {attendees.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-2">
          No attendees added yet. Add participants for the SARB meeting.
        </p>
      )}
    </div>
  );
}
