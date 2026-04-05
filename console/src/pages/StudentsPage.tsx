import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/InfoTooltip";
import {
  getStudentList,
  type StudentListResult,
} from "@/services/students/getStudentList";
import type { StudentListItem } from "@/types/student";
import { SearchInput } from "@/components/shared/SearchInput";
import { SchoolFilter } from "@/components/shared/SchoolFilter";
import { PaginationControls } from "@/components/shared/PaginationControls";
import {
  CARD,
  TABLE_HEADER,
  CASE_NAME,
  CASE_DETAIL,
  PAGE_TITLE,
  CONTENT_PADDING,
} from "@/lib/designTokens";

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

const PAGE_SIZE = 25;

export function StudentsPage() {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [schoolId, setSchoolId] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const result: StudentListResult = await getStudentList({
        search: search || undefined,
        schoolId,
        page,
        pageSize: PAGE_SIZE,
      });
      setStudents(result.students);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [search, schoolId, page]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  function handleSearchChange(v: string) {
    setSearch(v);
    setPage(1);
  }

  function handleSchoolChange(v: string | undefined) {
    setSchoolId(v);
    setPage(1);
  }

  return (
    <div className={`${CONTENT_PADDING} max-w-6xl`}>
      <div className="mb-6">
        <h1 className={PAGE_TITLE}>Students</h1>
        <p className={`${CASE_DETAIL} mt-0.5`}>
          {total.toLocaleString()} active student{total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder="Search by name or student ID..."
        />
        <SchoolFilter value={schoolId} onChange={handleSchoolChange} />
      </div>

      {/* Table */}
      <div className={`${CARD} overflow-x-clip overflow-y-visible`}>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className={`${CASE_NAME} mb-1`}>
              No students found
            </p>
            <p className={CASE_DETAIL}>
              {search || schoolId
                ? "Try adjusting your search or filters."
                : "Import attendance data to see students here."}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className={`py-2.5 px-4 ${TABLE_HEADER} rounded-tl-lg`}>
                    Name
                  </th>
                  <th className={`py-2.5 px-4 ${TABLE_HEADER}`}>
                    Grade
                  </th>
                  <th className={`py-2.5 px-4 ${TABLE_HEADER}`}>
                    School
                  </th>
                  <th className={`py-2.5 px-4 ${TABLE_HEADER}`}>
                    <span className="inline-flex items-center">
                      Attendance
                      <InfoTooltip text="Attendance rate = (days present / days enrolled) x 100. Red values indicate the student is below the 90% chronic absence threshold." />
                    </span>
                  </th>
                  <th className={`py-2.5 px-4 ${TABLE_HEADER}`}>
                    Absences
                  </th>
                  <th className={`py-2.5 px-4 ${TABLE_HEADER} rounded-tr-lg`}>
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
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Link
                          to={`/student/${s.id}`}
                          className={`${CASE_NAME} hover:text-brand-500`}
                        >
                          {s.last_name}, {s.first_name}
                        </Link>
                      </td>
                      <td className={`py-3 px-4 ${CASE_DETAIL}`}>
                        {s.grade_level}
                      </td>
                      <td className={`py-3 px-4 ${CASE_DETAIL}`}>
                        {s.school_name ?? "\u2014"}
                      </td>
                      <td className="py-3 px-4 tabular-nums">
                        {s.attendance_rate != null ? (
                          <span
                            className={cn(
                              CASE_NAME,
                              s.is_chronic_absent
                                ? "!text-red-600"
                                : ""
                            )}
                          >
                            {s.attendance_rate.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-gray-400">{"\u2014"}</span>
                        )}
                      </td>
                      <td className={`py-3 px-4 ${CASE_DETAIL} tabular-nums`}>
                        {s.days_absent ?? "\u2014"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "inline-block text-[clamp(11px,0.85vw,12px)] font-semibold px-2.5 py-1 rounded-full",
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

            {/* Pagination */}
            <PaginationControls
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
