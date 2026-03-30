import { useEffect, useState, useCallback } from "react";
import { useSession } from "@/hooks/useSession";
import { useMembership } from "@/context/MembershipContext";
import { Save, Check, Loader2, Building2, Shield, Bell } from "lucide-react";
import { getDistrict } from "@/services/schools/getDistrict";
import { getCountyOffice } from "@/services/schools/getCountyOffice";
import { getProfile, type ProfileRecord } from "@/services/profiles/getProfile";
import { updateProfileDisplayName } from "@/services/profiles/updateProfile";
import type { DistrictRecord, CountyOfficeRecord } from "@/types/organization";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const ROLE_LABELS: Record<string, string> = {
  district_admin: "District Admin",
  principal: "Principal",
  attendance_clerk: "Attendance Clerk",
  counselor: "Counselor",
  read_only: "Read Only",
};

function formatRole(role: string | null): string {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? role;
}

/** Derive the current academic year label from today's date. */
function currentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  // Academic year starts in July (month 6)
  if (month >= 6) {
    return `${year}–${year + 1}`;
  }
  return `${year - 1}–${year}`;
}

/* ------------------------------------------------------------------ */
/* Section components                                                  */
/* ------------------------------------------------------------------ */

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-6 py-4">
        <Icon className="h-[18px] w-[18px] text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-0">
      <span className="w-44 shrink-0 text-sm text-gray-500">{label}</span>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SettingsPage                                                        */
/* ------------------------------------------------------------------ */

export function SettingsPage() {
  const { user } = useSession();
  const { districtId } = useMembership();

  /* State */
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [district, setDistrict] = useState<DistrictRecord | null>(null);
  const [countyOffice, setCountyOffice] = useState<CountyOfficeRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /* Fetch data */
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // 1. Profile
    const profileRow = await getProfile(user.id).catch(() => null);

    if (profileRow) {
      setProfile(profileRow);
      setDisplayName(profileRow.display_name ?? "");
    }

    // 2. District — from membership context (staff_memberships → schools.district_id)
    if (districtId) {
      const districtRow = await getDistrict(districtId).catch(() => null);

      if (districtRow) {
        setDistrict(districtRow);

        if (districtRow.county_office_id) {
          const coRow = await getCountyOffice(districtRow.county_office_id).catch(
            () => null,
          );
          if (coRow) setCountyOffice(coRow);
        }
      }
    }

    setLoading(false);
  }, [user, districtId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* Save display name */
  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setSaved(false);

    await updateProfileDisplayName(profile.id, displayName.trim() || null);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isDirty = displayName !== (profile?.display_name ?? "");

  /* Loading skeleton */
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
        <div className="mt-6 space-y-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl border border-gray-200 bg-gray-50"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Manage your account and view district configuration.
      </p>

      <div className="mt-8 space-y-5">
        {/* ---- Account ---- */}
        <SectionCard icon={Save} title="Account">
          <div className="space-y-4">
            <FieldRow label="Email">
              <span className="text-gray-600">
                {profile?.email ?? user?.email ?? "—"}
              </span>
            </FieldRow>

            <FieldRow label="Role">
              <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                {formatRole(profile?.role ?? null)}
              </span>
            </FieldRow>

            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-0">
              <label className="w-44 shrink-0 pb-1.5 text-sm text-gray-500 sm:pb-0 sm:pt-2">
                Display name
              </label>
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  onClick={handleSave}
                  disabled={!isDirty || saving}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : saved ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {saving ? "Saving…" : saved ? "Saved" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ---- District Configuration ---- */}
        <SectionCard icon={Building2} title="District Configuration">
          <div className="space-y-4">
            <FieldRow label="District">
              {district?.name ?? (
                <span className="text-gray-400">Not assigned</span>
              )}
            </FieldRow>

            <FieldRow label="County office">
              {countyOffice ? (
                <span>
                  {countyOffice.name}
                  {countyOffice.short_name && (
                    <span className="ml-1.5 text-gray-400">
                      ({countyOffice.short_name})
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </FieldRow>

            <FieldRow label="School year">
              {currentAcademicYear()}
            </FieldRow>
          </div>
        </SectionCard>

        {/* ---- Notifications ---- */}
        <SectionCard icon={Bell} title="Notifications">
          <p className="text-sm text-gray-500">
            Notification preferences coming soon.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
