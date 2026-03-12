import { SchoolPulseData } from "@/types/schoolpulse";

// Scenario 1: Normal day with action items and good attendance
export const normalDayData: SchoolPulseData = {
  child: {
    id: "child-1",
    name: "Ayan",
    schoolId: "school-1",
    grade: "4th"
  },
  school: {
    id: "school-1",
    name: "Ormondale Elementary",
    district: "Los Altos School District"
  },
  dayInfo: {
    date: "2026-02-02",
    type: "normal",
    pickupTime: "3:05 PM",
    startTime: "8:15 AM",
    notes: "Lunch served • After-school care available"
  },
  actionItems: [
    {
      id: "action-1",
      title: "Permission slip for field trip",
      dueDate: "2026-02-04",
      dueAt: "2026-02-04T14:45:00",
      urgency: "action",
      status: "open"
    },
    {
      id: "action-2",
      title: "Book fair payment due",
      dueDate: "2026-02-06",
      dueAt: "2026-02-06T16:00:00",
      urgency: "action",
      status: "open"
    },
    {
      id: "action-3",
      title: "Photo day order form",
      dueDate: "2026-02-07",
      dueAt: "2026-02-07T14:45:00",
      urgency: "note",
      status: "open"
    }
  ],
  upcomingEvents: [
    {
      id: "event-1",
      dateTimeStart: "2026-02-03T13:05:00",
      title: "Minimum Day",
      plainSummary: "Pickup at 1:05 PM",
      urgencyLevel: "note",
      source: "calendar"
    },
    {
      id: "event-2",
      dateTimeStart: "2026-02-05T08:15:00",
      title: "Field Trip - California Academy of Sciences",
      plainSummary: "Remember to send lunch",
      urgencyLevel: "note",
      source: "parentsquare"
    },
    {
      id: "event-3",
      dateTimeStart: "2026-02-10T00:00:00",
      title: "Presidents' Day - No School",
      plainSummary: "Holiday",
      urgencyLevel: "none",
      source: "calendar"
    }
  ],
  dailyBrief: {
    date: "2026-02-02",
    text: "Everything looks normal today. Tomorrow is a minimum day (pickup 1:05 PM). Field trip on Friday requires a signed permission slip by tomorrow.",
    reasons: [
      "Minimum day tomorrow detected",
      "Upcoming field trip with action item",
      "Normal schedule today"
    ],
    sources: ["Calendar", "ParentSquare", "Aeries"]
  },
  attendance: {
    currentStreak: 12,
    totalDaysPresent: 87,
    totalDaysAbsent: 3,
    totalTardies: 2,
    attendanceRate: 96.7,
    alertLevel: "good",
    aiInsight: "Ayan has excellent attendance this semester. The 12-day streak is their best yet!",
    recentRecords: [
      { date: "2026-02-02", status: "present" },
      { date: "2026-01-31", status: "present" },
      { date: "2026-01-30", status: "present" },
      { date: "2026-01-29", status: "present" },
      { date: "2026-01-28", status: "present" },
      { date: "2026-01-27", status: "present" },
      { date: "2026-01-24", status: "present" },
      { date: "2026-01-23", status: "present" },
      { date: "2026-01-22", status: "tardy", reason: "Traffic" },
      { date: "2026-01-21", status: "present" }
    ]
  },
  academic: {
    overallStatus: "good",
    gpa: "3.8",
    lastSyncTime: "2h ago",
    aiSummary: "Ayan is performing well across all subjects. Math grade improved after the recent test. Keep up the great work!",
    grades: [
      { subject: "Math", currentGrade: "A-", trend: "up", lastUpdated: "2026-01-30" },
      { subject: "English", currentGrade: "A", trend: "stable", lastUpdated: "2026-01-28" },
      { subject: "Science", currentGrade: "B+", trend: "up", lastUpdated: "2026-01-29" },
      { subject: "Social Studies", currentGrade: "A", trend: "stable", lastUpdated: "2026-01-27" },
      { subject: "Art", currentGrade: "A", trend: "stable", lastUpdated: "2026-01-20" }
    ],
    missingAssignments: [],
    insights: [
      {
        id: "insight-1",
        type: "celebration",
        subject: "Math",
        title: "Math improvement! 📈",
        description: "Ayan's math grade went from B+ to A- after the last unit test. Great progress!",
        priority: "high",
        source: "Aeries",
        actionRequired: false
      },
      {
        id: "insight-2",
        type: "tip",
        title: "Reading log reminder",
        description: "Reading logs are due every Friday. Ayan has completed 3 of 4 this month.",
        priority: "medium",
        source: "Aeries",
        actionRequired: false
      }
    ]
  }
};

// Scenario 2: Minimum day with attendance concern
export const minimumDayData: SchoolPulseData = {
  child: {
    id: "child-1",
    name: "Ayan",
    schoolId: "school-1",
    grade: "4th"
  },
  school: {
    id: "school-1",
    name: "Ormondale Elementary",
    district: "Los Altos School District"
  },
  dayInfo: {
    date: "2026-02-03",
    type: "minimum",
    pickupTime: "1:05 PM",
    startTime: "8:15 AM",
    notes: "Early dismissal • No after-school care"
  },
  actionItems: [],
  upcomingEvents: [
    {
      id: "event-2",
      dateTimeStart: "2026-02-05T08:15:00",
      title: "Field Trip - California Academy of Sciences",
      plainSummary: "Permission slip submitted ✓",
      urgencyLevel: "none",
      source: "parentsquare"
    },
    {
      id: "event-3",
      dateTimeStart: "2026-02-10T00:00:00",
      title: "Presidents' Day - No School",
      plainSummary: "Holiday",
      urgencyLevel: "none",
      source: "calendar"
    },
    {
      id: "event-4",
      dateTimeStart: "2026-02-14T08:15:00",
      title: "Valentine's Day Party",
      plainSummary: "Bring valentines for classmates",
      urgencyLevel: "note",
      source: "parentsquare"
    }
  ],
  dailyBrief: {
    date: "2026-02-03",
    text: "Today is a minimum day - pickup at 1:05 PM. No after-school care available. Note: Ayan has had 3 tardies this month which is above average.",
    reasons: [
      "Minimum day schedule in effect",
      "Tardy pattern detected",
      "Field trip permission submitted"
    ],
    sources: ["Calendar", "ParentSquare", "Aeries"]
  },
  attendance: {
    currentStreak: 5,
    totalDaysPresent: 82,
    totalDaysAbsent: 5,
    totalTardies: 6,
    attendanceRate: 91.2,
    alertLevel: "watch",
    aiInsight: "Ayan has been tardy 3 times this month, mostly on Mondays. Consider adjusting the morning routine.",
    recentRecords: [
      { date: "2026-02-03", status: "present" },
      { date: "2026-02-02", status: "present" },
      { date: "2026-01-31", status: "tardy", reason: "Late arrival" },
      { date: "2026-01-30", status: "present" },
      { date: "2026-01-29", status: "present" },
      { date: "2026-01-28", status: "tardy", reason: "Late arrival" },
      { date: "2026-01-27", status: "absent", reason: "Sick" },
      { date: "2026-01-24", status: "present" },
      { date: "2026-01-23", status: "tardy", reason: "Late arrival" },
      { date: "2026-01-22", status: "present" }
    ]
  },
  academic: {
    overallStatus: "watch",
    gpa: "3.2",
    lastSyncTime: "1h ago",
    aiSummary: "There's one missing assignment in Science. Math grade has been slipping - consider reviewing homework together.",
    grades: [
      { subject: "Math", currentGrade: "B-", trend: "down", lastUpdated: "2026-02-01" },
      { subject: "English", currentGrade: "B+", trend: "stable", lastUpdated: "2026-01-30" },
      { subject: "Science", currentGrade: "B", trend: "down", lastUpdated: "2026-02-02" },
      { subject: "Social Studies", currentGrade: "A-", trend: "stable", lastUpdated: "2026-01-28" },
      { subject: "Art", currentGrade: "A", trend: "stable", lastUpdated: "2026-01-20" }
    ],
    missingAssignments: [
      {
        id: "missing-1",
        subject: "Science",
        title: "Solar System Worksheet",
        dueDate: "2026-01-30",
        daysOverdue: 4,
        pointsPossible: 20
      }
    ],
    insights: [
      {
        id: "insight-1",
        type: "alert",
        subject: "Science",
        title: "Missing assignment",
        description: "Solar System Worksheet is 4 days overdue. Worth 20 points.",
        priority: "high",
        source: "Aeries",
        actionRequired: true
      },
      {
        id: "insight-2",
        type: "pattern",
        subject: "Math",
        title: "Math trend detected",
        description: "Math grades have dropped from A- to B- over the past 3 weeks. Recent concepts may need extra practice.",
        priority: "high",
        source: "Aeries",
        actionRequired: false
      }
    ]
  }
};

// Scenario 3: No school day with academic concerns
export const noSchoolData: SchoolPulseData = {
  child: {
    id: "child-1",
    name: "Ayan",
    schoolId: "school-1",
    grade: "4th"
  },
  school: {
    id: "school-1",
    name: "Ormondale Elementary",
    district: "Los Altos School District"
  },
  dayInfo: {
    date: "2026-02-10",
    type: "noschool",
    pickupTime: "N/A",
    startTime: "N/A",
    notes: "Presidents' Day - Federal Holiday"
  },
  actionItems: [],
  upcomingEvents: [
    {
      id: "event-5",
      dateTimeStart: "2026-02-11T08:15:00",
      title: "Back to School",
      plainSummary: "Normal schedule resumes",
      urgencyLevel: "none",
      source: "calendar"
    },
    {
      id: "event-4",
      dateTimeStart: "2026-02-14T08:15:00",
      title: "Valentine's Day Party",
      plainSummary: "Bring valentines for classmates",
      urgencyLevel: "note",
      source: "parentsquare"
    },
    {
      id: "event-6",
      dateTimeStart: "2026-02-20T18:00:00",
      title: "Parent-Teacher Conference",
      plainSummary: "Schedule your slot online",
      urgencyLevel: "action",
      source: "parentsquare"
    }
  ],
  dailyBrief: {
    date: "2026-02-10",
    text: "No school today - it's Presidents' Day! ⚠️ Important: There are 3 missing assignments that need attention. Consider using this day off to catch up.",
    reasons: [
      "Presidents' Day holiday",
      "Multiple missing assignments detected",
      "Parent-teacher conference signup needed"
    ],
    sources: ["Calendar", "ParentSquare", "Aeries"]
  },
  attendance: {
    currentStreak: 0,
    totalDaysPresent: 75,
    totalDaysAbsent: 10,
    totalTardies: 8,
    attendanceRate: 85.2,
    alertLevel: "concern",
    aiInsight: "Attendance has dropped below 90% this semester. Chronic absenteeism (below 90%) can significantly impact learning. Let's work on improving this.",
    recentRecords: [
      { date: "2026-02-07", status: "absent", reason: "Sick" },
      { date: "2026-02-06", status: "absent", reason: "Sick" },
      { date: "2026-02-05", status: "present" },
      { date: "2026-02-04", status: "tardy" },
      { date: "2026-02-03", status: "present" },
      { date: "2026-02-02", status: "absent", reason: "Appointment" },
      { date: "2026-01-31", status: "present" },
      { date: "2026-01-30", status: "tardy" },
      { date: "2026-01-29", status: "present" },
      { date: "2026-01-28", status: "absent" }
    ]
  },
  academic: {
    overallStatus: "concern",
    gpa: "2.5",
    lastSyncTime: "Today",
    aiSummary: "3 assignments are missing and grades are slipping in Math and Science. The absences may be impacting classwork. Today is a great day to catch up!",
    grades: [
      { subject: "Math", currentGrade: "C+", trend: "down", lastUpdated: "2026-02-07" },
      { subject: "English", currentGrade: "B", trend: "down", lastUpdated: "2026-02-06" },
      { subject: "Science", currentGrade: "C", trend: "down", lastUpdated: "2026-02-07" },
      { subject: "Social Studies", currentGrade: "B-", trend: "down", lastUpdated: "2026-02-05" },
      { subject: "Art", currentGrade: "A-", trend: "stable", lastUpdated: "2026-02-01" }
    ],
    missingAssignments: [
      {
        id: "missing-1",
        subject: "Math",
        title: "Fractions Practice Sheet",
        dueDate: "2026-02-05",
        daysOverdue: 5,
        pointsPossible: 25
      },
      {
        id: "missing-2",
        subject: "Science",
        title: "Lab Report: Plant Growth",
        dueDate: "2026-02-04",
        daysOverdue: 6,
        pointsPossible: 50
      },
      {
        id: "missing-3",
        subject: "English",
        title: "Book Report Draft",
        dueDate: "2026-02-06",
        daysOverdue: 4,
        pointsPossible: 30
      }
    ],
    insights: [
      {
        id: "insight-1",
        type: "alert",
        title: "Absences affecting grades",
        description: "Recent absences have caused 3 missed assignments worth 105 total points. Catching up today could help!",
        priority: "high",
        source: "Aeries",
        actionRequired: true
      },
      {
        id: "insight-2",
        type: "alert",
        subject: "Math",
        title: "Math intervention recommended",
        description: "Math grade has dropped significantly. Teacher recommends extra practice with fractions.",
        priority: "high",
        source: "Aeries",
        actionRequired: true
      },
      {
        id: "insight-3",
        type: "tip",
        title: "Use this day to catch up",
        description: "No school today is a perfect opportunity to complete missing work and review recent concepts.",
        priority: "medium",
        source: "AI Suggestion",
        actionRequired: false
      }
    ]
  }
};

export const scenarios = {
  normal: normalDayData,
  minimum: minimumDayData,
  noschool: noSchoolData
};

export type ScenarioKey = keyof typeof scenarios;
