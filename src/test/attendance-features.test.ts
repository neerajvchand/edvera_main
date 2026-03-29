import { describe, it, expect } from "vitest";
import { computeAttendanceMetrics } from "@/lib/attendanceMetrics";
import type { AttendanceRecord } from "@/types/schoolpulse";

describe("computeAttendanceMetrics", () => {
  it("returns defaults for empty records", () => {
    const m = computeAttendanceMetrics([]);
    expect(m.attendance_rate).toBe(100);
    expect(m.consecutive_absences).toBe(0);
    expect(m.total_days_recorded).toBe(0);
    expect(m.is_chronic_risk).toBe(false);
  });

  it("counts present correctly", () => {
    const records: AttendanceRecord[] = [
      { date: "2026-02-16", status: "present" },
      { date: "2026-02-15", status: "present" },
      { date: "2026-02-14", status: "absent" },
    ];
    const m = computeAttendanceMetrics(records);
    expect(m.total_days_recorded).toBe(3);
    // 2 present out of 3 = 66.7%
    expect(m.attendance_rate).toBeCloseTo(66.7, 0);
  });

  it("treats tardy as present for rate calculation", () => {
    const records: AttendanceRecord[] = [
      { date: "2026-02-16", status: "tardy" },
      { date: "2026-02-15", status: "present" },
      { date: "2026-02-14", status: "absent" },
    ];
    const m = computeAttendanceMetrics(records);
    // tardy + present = 2 present out of 3 = 66.7%
    expect(m.attendance_rate).toBeCloseTo(66.7, 0);
  });

  it("treats excused as present for rate calculation", () => {
    const records: AttendanceRecord[] = [
      { date: "2026-02-16", status: "excused" },
      { date: "2026-02-15", status: "absent" },
    ];
    const m = computeAttendanceMetrics(records);
    expect(m.attendance_rate).toBe(50);
  });

  it("calculates consecutive absences from most recent", () => {
    const records: AttendanceRecord[] = [
      { date: "2026-02-12", status: "present" },
      { date: "2026-02-13", status: "absent" },
      { date: "2026-02-14", status: "absent" },
      { date: "2026-02-15", status: "absent" },
    ];
    const m = computeAttendanceMetrics(records);
    expect(m.consecutive_absences).toBe(3);
  });

  it("tardy breaks consecutive absences", () => {
    const records: AttendanceRecord[] = [
      { date: "2026-02-13", status: "absent" },
      { date: "2026-02-14", status: "absent" },
      { date: "2026-02-15", status: "tardy" },
    ];
    const m = computeAttendanceMetrics(records);
    // Most recent is tardy, which is not absent, so streak = 0
    expect(m.consecutive_absences).toBe(0);
  });

  it("flags chronic risk below 90%", () => {
    const records: AttendanceRecord[] = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-02-${String(i + 1).padStart(2, "0")}`,
      status: i < 8 ? ("present" as const) : ("absent" as const),
    }));
    const m = computeAttendanceMetrics(records);
    // 8/10 = 80% → chronic risk
    expect(m.is_chronic_risk).toBe(true);
  });
});

describe("weekly progress computation", () => {
  function computeWeeklyProgress(
    entries: { child_id: string; attendance_date: string }[],
    childId: string,
    todayDate: string,
    excludedDates: Set<string> = new Set()
  ) {
    const today = new Date(`${todayDate}T00:00:00`);
    const dow = today.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    // Generate weekdays Mon–Fri
    const weekdays: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekdays.push(d.toISOString().slice(0, 10));
    }
    const schoolDays = weekdays.filter((d) => !excludedDates.has(d));
    const total = schoolDays.length;
    const logged = entries.filter(
      (e) =>
        e.child_id === childId &&
        schoolDays.includes(e.attendance_date)
    ).length;
    return { logged: Math.min(logged, total), total };
  }

  it("counts entries within Mon-Fri of current week", () => {
    // 2026-02-17 is a Tuesday
    const result = computeWeeklyProgress(
      [
        { child_id: "c1", attendance_date: "2026-02-16" }, // Monday
        { child_id: "c1", attendance_date: "2026-02-17" }, // Tuesday
      ],
      "c1",
      "2026-02-17"
    );
    expect(result.logged).toBe(2);
    expect(result.total).toBe(5);
  });

  it("excludes entries from previous week", () => {
    const result = computeWeeklyProgress(
      [
        { child_id: "c1", attendance_date: "2026-02-13" }, // Previous Friday
        { child_id: "c1", attendance_date: "2026-02-16" }, // This Monday
      ],
      "c1",
      "2026-02-17"
    );
    expect(result.logged).toBe(1);
  });

  it("caps at total school days", () => {
    const entries = Array.from({ length: 7 }, (_, i) => ({
      child_id: "c1",
      attendance_date: `2026-02-${String(16 + i).padStart(2, "0")}`,
    }));
    const result = computeWeeklyProgress(entries, "c1", "2026-02-17");
    expect(result.logged).toBe(5);
  });

  it("handles Monday correctly (prev weekday = Friday)", () => {
    // 2026-02-16 is a Monday
    const result = computeWeeklyProgress([], "c1", "2026-02-16");
    expect(result.logged).toBe(0);
  });

  it("excludes holidays from denominator", () => {
    // 2026-02-16 (Monday) is Presidents' Day
    const excluded = new Set(["2026-02-16"]);
    const result = computeWeeklyProgress(
      [
        { child_id: "c1", attendance_date: "2026-02-17" }, // Tuesday
        { child_id: "c1", attendance_date: "2026-02-18" }, // Wednesday
      ],
      "c1",
      "2026-02-18",
      excluded
    );
    expect(result.total).toBe(4); // 5 - 1 holiday
    expect(result.logged).toBe(2);
  });

  it("excludes multiple holidays from denominator", () => {
    const excluded = new Set(["2026-02-16", "2026-02-17"]);
    const result = computeWeeklyProgress(
      [{ child_id: "c1", attendance_date: "2026-02-18" }],
      "c1",
      "2026-02-18",
      excluded
    );
    expect(result.total).toBe(3);
    expect(result.logged).toBe(1);
  });

  it("does not count attendance on excluded days", () => {
    const excluded = new Set(["2026-02-16"]);
    const result = computeWeeklyProgress(
      [{ child_id: "c1", attendance_date: "2026-02-16" }], // logged on holiday
      "c1",
      "2026-02-17",
      excluded
    );
    expect(result.total).toBe(4);
    expect(result.logged).toBe(0); // holiday attendance doesn't count
  });
});

describe("missed previous weekday logic", () => {
  function getPreviousWeekday(todayDate: string): string {
    const todayD = new Date(`${todayDate}T00:00:00`);
    const dow = todayD.getDay();
    const prevWeekday = new Date(todayD);
    if (dow === 1) {
      prevWeekday.setDate(todayD.getDate() - 3); // Friday
    } else if (dow === 0) {
      prevWeekday.setDate(todayD.getDate() - 2); // Friday
    } else if (dow === 6) {
      prevWeekday.setDate(todayD.getDate() - 1); // Friday
    } else {
      prevWeekday.setDate(todayD.getDate() - 1);
    }
    return prevWeekday.toISOString().slice(0, 10);
  }

  it("returns Friday for Monday", () => {
    // 2026-02-16 is Monday
    expect(getPreviousWeekday("2026-02-16")).toBe("2026-02-13");
  });

  it("returns Friday for Sunday", () => {
    // 2026-02-15 is Sunday
    expect(getPreviousWeekday("2026-02-15")).toBe("2026-02-13");
  });

  it("returns Friday for Saturday", () => {
    // 2026-02-14 is Saturday
    expect(getPreviousWeekday("2026-02-14")).toBe("2026-02-13");
  });

  it("returns Thursday for Friday", () => {
    // 2026-02-13 is Friday
    expect(getPreviousWeekday("2026-02-13")).toBe("2026-02-12");
  });

  it("returns Wednesday for Thursday", () => {
    // 2026-02-12 is Thursday
    expect(getPreviousWeekday("2026-02-12")).toBe("2026-02-11");
  });
});

describe("tel link builder", () => {
  function buildTelLink(phone: string | null, ext: string | null): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    return ext ? `tel:${digits},,${ext}` : `tel:${digits}`;
  }

  it("builds tel link with extension", () => {
    expect(buildTelLink("6503127660", "3")).toBe("tel:6503127660,,3");
  });

  it("builds tel link without extension", () => {
    expect(buildTelLink("6503127660", null)).toBe("tel:6503127660");
  });

  it("strips non-digits from phone", () => {
    expect(buildTelLink("(650) 312-7660", "3")).toBe("tel:6503127660,,3");
  });

  it("returns null when phone is null", () => {
    expect(buildTelLink(null, "3")).toBeNull();
  });
});
