import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Shared Form Elements                                                */
/* ------------------------------------------------------------------ */

export function Label({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

export const INPUT_CLS =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors";

export const SELECT_CLS = INPUT_CLS;

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Form Props                                                          */
/* ------------------------------------------------------------------ */

interface FormProps {
  data: Record<string, unknown>;
  onChange: (k: string, v: unknown) => void;
}

/* ------------------------------------------------------------------ */
/* Letter Form                                                         */
/* ------------------------------------------------------------------ */

export function LetterForm({ data, onChange }: FormProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label required>Date sent</Label>
        <input
          type="date"
          value={(data.dateSent as string) ?? todayISO()}
          onChange={(e) => onChange("dateSent", e.target.value)}
          className={INPUT_CLS}
        />
      </div>
      <div>
        <Label required>Delivery method</Label>
        <select
          value={(data.method as string) ?? ""}
          onChange={(e) => onChange("method", e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">Select method…</option>
          <option value="hand_delivery">Hand delivery</option>
          <option value="mail">US Mail</option>
          <option value="email">Email</option>
          <option value="certified_mail">Certified Mail</option>
        </select>
      </div>
      <div>
        <Label>Notes</Label>
        <textarea
          value={(data.notes as string) ?? ""}
          onChange={(e) => onChange("notes", e.target.value)}
          className={cn(INPUT_CLS, "h-20 resize-none")}
          placeholder="Optional notes…"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Call Form                                                           */
/* ------------------------------------------------------------------ */

export function CallForm({ data, onChange }: FormProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label required>Date of call</Label>
        <input
          type="date"
          value={(data.callDate as string) ?? todayISO()}
          onChange={(e) => onChange("callDate", e.target.value)}
          className={INPUT_CLS}
        />
      </div>
      <div>
        <Label required>Outcome</Label>
        <select
          value={(data.outcome as string) ?? ""}
          onChange={(e) => onChange("outcome", e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">Select outcome…</option>
          <option value="reached_positive">Reached — positive response</option>
          <option value="reached_no_resolution">
            Reached — no resolution
          </option>
          <option value="left_voicemail">Left voicemail</option>
          <option value="no_answer">No answer</option>
          <option value="wrong_number">Wrong number</option>
        </select>
      </div>
      <div>
        <Label>Notes</Label>
        <textarea
          value={(data.notes as string) ?? ""}
          onChange={(e) => onChange("notes", e.target.value)}
          className={cn(INPUT_CLS, "h-20 resize-none")}
          placeholder="Optional notes…"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Conference Form                                                     */
/* ------------------------------------------------------------------ */

const ATTENDEE_OPTIONS = [
  "Parent/Guardian",
  "Student",
  "Teacher",
  "Counselor",
  "Principal",
  "Vice Principal",
  "Attendance Clerk",
  "Social Worker",
  "School Psychologist",
  "Other",
];

const RESOURCE_OPTIONS = [
  "Transportation assistance",
  "Tutoring",
  "Counseling referral",
  "Community resources",
  "Other",
];

export function ConferenceForm({ data, onChange }: FormProps) {
  const attendees = (data.attendees as string[]) ?? [];
  const resources = (data.resources as string[]) ?? [];

  const toggleList = (key: string, list: string[], item: string) => {
    onChange(
      key,
      list.includes(item) ? list.filter((i) => i !== item) : [...list, item]
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <Label required>Conference date</Label>
        <input
          type="date"
          value={(data.conferenceDate as string) ?? todayISO()}
          onChange={(e) => onChange("conferenceDate", e.target.value)}
          className={INPUT_CLS}
        />
      </div>
      <div>
        <Label required>Status</Label>
        <select
          value={(data.conferenceStatus as string) ?? ""}
          onChange={(e) => onChange("conferenceStatus", e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">Select status…</option>
          <option value="held_parent_attended">Held — parent attended</option>
          <option value="held_parent_absent">
            Held — parent did not attend
          </option>
          <option value="attempted_no_response">
            Attempted — no response
          </option>
          <option value="rescheduled">Rescheduled</option>
        </select>
      </div>

      {/* Attendees */}
      <div>
        <Label>Attendees</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {ATTENDEE_OPTIONS.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 text-sm text-gray-600"
            >
              <input
                type="checkbox"
                checked={attendees.includes(opt)}
                onChange={() => toggleList("attendees", attendees, opt)}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              {opt}
            </label>
          ))}
        </div>
      </div>

      {/* Resources */}
      <div>
        <Label>Resources offered</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {RESOURCE_OPTIONS.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 text-sm text-gray-600"
            >
              <input
                type="checkbox"
                checked={resources.includes(opt)}
                onChange={() => toggleList("resources", resources, opt)}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              {opt}
            </label>
          ))}
        </div>
      </div>

      {/* EC §48262 checkbox */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={!!data.ec48262Notified}
            onChange={(e) => onChange("ec48262Notified", e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm text-amber-800">
            Parent notified of continued truancy consequences per{" "}
            <Link
              to="/reference/education-code#section-48262"
              className="font-medium text-emerald-700 underline decoration-dotted underline-offset-2 hover:text-emerald-800"
              target="_blank"
            >
              EC §48262
            </Link>
            <span className="text-red-500 ml-0.5">*</span>
          </span>
        </label>
      </div>

      {/* Commitments */}
      <div>
        <Label>Commitments made</Label>
        <textarea
          value={(data.commitments as string) ?? ""}
          onChange={(e) => onChange("commitments", e.target.value)}
          className={cn(INPUT_CLS, "h-16 resize-none")}
          placeholder="Agreements between school and family…"
        />
      </div>

      {/* Follow-up date */}
      <div>
        <Label>Follow-up date</Label>
        <input
          type="date"
          value={(data.followUpDate as string) ?? ""}
          onChange={(e) => onChange("followUpDate", e.target.value)}
          className={INPUT_CLS}
        />
      </div>

      <div>
        <Label>Notes</Label>
        <textarea
          value={(data.notes as string) ?? ""}
          onChange={(e) => onChange("notes", e.target.value)}
          className={cn(INPUT_CLS, "h-16 resize-none")}
          placeholder="Optional notes…"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Generic / SARB Form                                                 */
/* ------------------------------------------------------------------ */

export function GenericForm({ data, onChange }: FormProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label required>Date completed</Label>
        <input
          type="date"
          value={(data.dateCompleted as string) ?? todayISO()}
          onChange={(e) => onChange("dateCompleted", e.target.value)}
          className={INPUT_CLS}
        />
      </div>
      <div>
        <Label>Notes</Label>
        <textarea
          value={(data.notes as string) ?? ""}
          onChange={(e) => onChange("notes", e.target.value)}
          className={cn(INPUT_CLS, "h-20 resize-none")}
          placeholder="Optional notes…"
        />
      </div>
    </div>
  );
}
