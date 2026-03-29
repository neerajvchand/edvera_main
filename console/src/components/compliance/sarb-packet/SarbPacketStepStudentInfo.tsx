import { fmtDate, type CaseDetailForModal } from "@/hooks/useSarbPacket";

export function SarbPacketStepStudentInfo({
  caseDetail,
  ssid,
  setSsid,
  referralType,
  setReferralType,
  specialEdNotes,
  setSpecialEdNotes,
}: {
  caseDetail: CaseDetailForModal;
  ssid: string;
  setSsid: (v: string) => void;
  referralType: string;
  setReferralType: (v: string) => void;
  specialEdNotes: string;
  setSpecialEdNotes: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 mb-4">
        Review and confirm student information for the SARB referral packet.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Student Name</label>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
            {caseDetail.student_first_name} {caseDetail.student_last_name}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Grade</label>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
            {caseDetail.student_grade || "\u2014"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Date of Birth</label>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
            {caseDetail.student_dob ? fmtDate(caseDetail.student_dob) : "\u2014"}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            SSID <span className="text-gray-400 font-normal">(State Student ID)</span>
          </label>
          <input
            value={ssid}
            onChange={(e) => setSsid(e.target.value)}
            maxLength={10}
            placeholder="10-digit SSID"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">School</label>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
            {caseDetail.school_name}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Academic Year</label>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
            {caseDetail.academic_year}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Referral Type</label>
        <select
          value={referralType}
          onChange={(e) => setReferralType(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        >
          <option value="initial">Initial SARB Referral</option>
          <option value="followup">Follow-up Referral</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Special Education Notes <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={specialEdNotes}
          onChange={(e) => setSpecialEdNotes(e.target.value)}
          rows={2}
          placeholder="IEP status, 504 plan, or other special education information..."
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Attendance summary card */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Attendance Summary</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Unexcused Absences</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">{caseDetail.unexcused_absence_count}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Truancy Events</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">{caseDetail.truancy_count}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Absences</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">{caseDetail.total_absence_count}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
