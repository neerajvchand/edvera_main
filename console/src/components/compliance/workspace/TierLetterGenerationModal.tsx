import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, Loader2, AlertCircle } from "lucide-react";
import {
  generateTier1Letter,
  type Tier1LetterData,
} from "@/services/compliance/generateDocument";
import { getStudentPrimaryContact } from "@/services/students/getStudentContact";
import { getCurrentUserDisplayName } from "@/services/profiles/getCurrentUserDisplayName";
import type { CaseWorkspaceResponse } from "@/types/caseWorkspace";

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  caseId: string;
  workspaceData: CaseWorkspaceResponse;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const INPUT_CLS =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors";

function Label({
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

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function TierLetterGenerationModal({
  caseId,
  workspaceData,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const c = workspaceData.case;

  const [parentName, setParentName] = useState("");
  const [parentAddress, setParentAddress] = useState("");
  const [schoolAddress, setSchoolAddress] = useState(c.schoolAddress ?? "");
  const [schoolPhone, setSchoolPhone] = useState(c.schoolPhone ?? "");
  const [principalName, setPrincipalName] = useState(c.principalName ?? "");
  const [districtName] = useState(c.districtName);
  const [districtAddress, setDistrictAddress] = useState(
    c.districtAddress ?? ""
  );
  const [preparedBy, setPreparedBy] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Pre-populate parent info from contacts and preparedBy from profile
  useEffect(() => {
    if (!isOpen || loaded) return;

    const loadData = async () => {
      // Fetch primary contact for student
      const contact = await getStudentPrimaryContact(c.studentId).catch(() => null);
      if (contact) {
        const name = `${contact.firstName} ${contact.lastName}`.trim();
        if (name) setParentName(name);
        if (contact.address) setParentAddress(contact.address);
      }

      // Fetch current user's display name
      const displayName = await getCurrentUserDisplayName().catch(() => null);
      if (displayName) setPreparedBy(displayName);

      setLoaded(true);
    };

    loadData();
  }, [isOpen, loaded, c.studentId]);

  if (!isOpen) return null;

  const canSubmit = parentName.trim() && deliveryMethod && !isSubmitting;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    const letterData: Tier1LetterData = {
      parentName: parentName.trim(),
      parentAddress: parentAddress.trim(),
      deliveryMethod,
      preparedBy: preparedBy.trim(),
    };

    // Override workspace data with any edits the user made
    const updatedWorkspace: CaseWorkspaceResponse = {
      ...workspaceData,
      case: {
        ...workspaceData.case,
        schoolAddress,
        schoolPhone,
        principalName,
        districtAddress,
      },
    };

    const result = await generateTier1Letter(
      caseId,
      letterData,
      updatedWorkspace
    );

    if (result.success) {
      onSuccess();
      onClose();
    } else {
      setError(result.error ?? "Failed to generate letter");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Generate Tier 1 Notification Letter
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {c.studentName} — {c.schoolName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Parent/Guardian */}
          <div>
            <Label required>Parent/Guardian Name</Label>
            <input
              type="text"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              className={INPUT_CLS}
              placeholder="Enter parent/guardian name"
            />
          </div>
          <div>
            <Label>Parent/Guardian Address</Label>
            <input
              type="text"
              value={parentAddress}
              onChange={(e) => setParentAddress(e.target.value)}
              className={INPUT_CLS}
              placeholder="Enter address"
            />
          </div>

          <hr className="border-gray-100" />

          {/* School info */}
          <div>
            <Label>School Address</Label>
            <input
              type="text"
              value={schoolAddress}
              onChange={(e) => setSchoolAddress(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>School Phone</Label>
              <input
                type="text"
                value={schoolPhone}
                onChange={(e) => setSchoolPhone(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <Label>Principal Name</Label>
              <input
                type="text"
                value={principalName}
                onChange={(e) => setPrincipalName(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* District info */}
          <div>
            <Label>District Name</Label>
            <input
              type="text"
              value={districtName}
              className={cn(INPUT_CLS, "bg-gray-50 text-gray-500")}
              readOnly
            />
          </div>
          <div>
            <Label>District Address</Label>
            <input
              type="text"
              value={districtAddress}
              onChange={(e) => setDistrictAddress(e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          <hr className="border-gray-100" />

          {/* Prepared by + method */}
          <div>
            <Label>Prepared By</Label>
            <input
              type="text"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <Label required>Delivery Method</Label>
            <select
              value={deliveryMethod}
              onChange={(e) => setDeliveryMethod(e.target.value)}
              className={INPUT_CLS}
            >
              <option value="">Select method…</option>
              <option value="hand_delivery">Hand delivery</option>
              <option value="mail">US Mail</option>
              <option value="email">Email</option>
              <option value="certified_mail">Certified Mail</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 pb-3">
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2",
              canSubmit
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-gray-300 cursor-not-allowed"
            )}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate & Download
          </button>
        </div>
      </div>
    </div>
  );
}
