import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/InfoTooltip";
import { getStudentList } from "@/services/students/getStudentList";
import type { StudentListItem } from "@/types/student";

function signalPill(level: string | undefined | null) {
  switch (level) {
    case "elevated":
      return { label: "Elevated", bg: "bg-red-50", text: "text-red-700" };
    case "softening":
      return { label: "Softening", bg: "bg-amber-50", text: "text-amber-700" };
    case "stable":
      return { label: "Stable", bg: "bg-emerald-50", text: "text-emerald-700" };
    default:
      return { label: "Pending", bg: "bg-gray-50", text: "text-gray-500" };
  }
}

export function StudentsPage() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudentList()
      .then(setStudents)
      .catch((err) => console.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold text-gray-900">Students</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {students.length} active students
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-clip overflow-y-visible">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tl-xl">
                Name
              </th>
              <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Grade
              </th>
              <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                School
              </th>
              <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <span className="inline-flex items-center">
                  Attendance
                  <InfoTooltip text="Attendance rate = (days present ÷ days enrolled) × 100. Red values indicate the student is below the 90% chronic absence threshold." />
                </span>
              </th>
              <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Absences
              </th>
              <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tr-xl">
                <span className="inline-flex items-center">
                  Signal
                  <InfoTooltip text="Risk engine classification based on 30-day attendance trajectory. Stable = holding steady. Softening = declining trend. Elevated = crossed into higher-risk band or accelerating decline." />
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map((s) => {
              const pill = signalPill(s.signal_level);
              return (
                <tr
                  key={s.id}
                  className="hover:bg-emerald-50/50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <Link
                      to={`/student/${s.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-emerald-700"
                    >
                      {s.last_name}, {s.first_name}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700">
                    {s.grade_level}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700">
                    {s.school_name ?? "—"}
                  </td>
                  <td className="py-3 px-4 text-sm tabular-nums">
                    {s.attendance_rate != null ? (
                      <span
                        className={cn(
                          "font-medium",
                          s.is_chronic_absent
                            ? "text-red-600"
                            : "text-gray-900"
                        )}
                      >
                        {s.attendance_rate.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700 tabular-nums">
                    {s.days_absent ?? "—"}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={cn(
                        "inline-block text-xs font-medium px-2.5 py-0.5 rounded-full",
                        pill.bg,
                        pill.text
                      )}
                    >
                      {pill.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
