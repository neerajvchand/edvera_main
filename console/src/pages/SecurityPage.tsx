import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";

/* ------------------------------------------------------------------ */
/* Reusable building blocks                                            */
/* ------------------------------------------------------------------ */

function Section({
  title,
  first,
  children,
}: {
  title: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        first ? "mt-0" : "mt-12 border-t border-slate-100 pt-8"
      )}
    >
      <h2 className="text-xl font-semibold text-slate-900 mb-4">{title}</h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-slate-600 leading-relaxed mb-4">{children}</p>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="pl-4 mb-4 space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-slate-600 leading-relaxed flex items-start gap-2">
          <span className="text-slate-300 mt-0.5 shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-medium text-slate-700 mb-2 mt-6">{children}</p>
  );
}

type StatusKey = "active" | "in_implementation" | "planned";

const STATUS_STYLES: Record<StatusKey, { label: string; bg: string; text: string }> =
  {
    active: { label: "Active", bg: "bg-green-100", text: "text-green-700" },
    in_implementation: {
      label: "In implementation",
      bg: "bg-amber-100",
      text: "text-amber-700",
    },
    planned: { label: "Planned", bg: "bg-slate-100", text: "text-slate-600" },
  };

function StatusPill({ status }: { status: StatusKey }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-block text-xs font-medium px-2 py-0.5 rounded-full",
        s.bg,
        s.text
      )}
    >
      {s.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Security Page                                                       */
/* ------------------------------------------------------------------ */

export function SecurityPage() {
  const { session, loading } = useSession();
  const isLoggedIn = !loading && !!session;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Back nav + Logo */}
        <div className="flex items-center justify-between mb-12">
          <Link to={isLoggedIn ? "/dashboard" : "/login"}>
            <img
              src="/logo.png"
              alt="Edvera"
              className="w-[120px] h-auto"
            />
          </Link>
          <Link
            to={isLoggedIn ? "/dashboard" : "/login"}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition"
          >
            <ArrowLeft size={14} />
            {isLoggedIn ? "Back to dashboard" : "Back to login"}
          </Link>
        </div>

        {/* Page header */}
        <h1 className="text-3xl font-semibold text-slate-900">
          Security &amp; Privacy
        </h1>
        <p className="text-lg text-slate-500 mb-12">
          How Edvera protects student data
        </p>

        {/* ---------------------------------------------------------- */}
        {/* Our Commitment                                              */}
        {/* ---------------------------------------------------------- */}
        <Section title="Our Commitment" first>
          <P>
            Student data is among the most sensitive information any organization
            can hold. We built Edvera with the understanding that every
            attendance record, every risk signal, and every compliance case
            belongs to the district&nbsp;&mdash; not to us. Our role is to
            process it securely, surface actionable intelligence, and never do
            anything else with it.
          </P>
        </Section>

        {/* ---------------------------------------------------------- */}
        {/* Data We Store                                               */}
        {/* ---------------------------------------------------------- */}
        <Section title="Data We Store">
          <P>
            Edvera processes the minimum data required to power attendance
            intelligence, compliance tracking, and funding projections.
          </P>

          <SectionSubtitle>What we store:</SectionSubtitle>
          <BulletList
            items={[
              "Student identifiers (district-assigned student ID, name, grade level, school assignment)",
              "Enrollment status and dates",
              "Daily attendance records (present, absent, tardy — with absence type classifications)",
              "Demographic flags relevant to attendance analysis (English Learner, IEP, McKinney-Vento, FRPL status)",
              "Computed outputs: risk signals, attendance snapshots, compliance case status, funding projections, intervention logs",
            ]}
          />

          <SectionSubtitle>What we never store:</SectionSubtitle>
          <BulletList
            items={[
              "Social Security numbers",
              "Medical or health records",
              "Discipline or behavioral records",
              "Academic grades or test scores",
              "Parent/guardian financial information",
              "Any data beyond what the attendance engine requires",
            ]}
          />
        </Section>

        {/* ---------------------------------------------------------- */}
        {/* Infrastructure & Encryption                                 */}
        {/* ---------------------------------------------------------- */}
        <Section title="Infrastructure & Encryption">
          <P>
            Edvera runs on Supabase (hosted on Amazon Web Services) in United
            States data centers.
          </P>
          <BulletList
            items={[
              "Encryption in transit: TLS 1.2 or higher for all connections",
              "Encryption at rest: AES-256 for all stored data and backups",
              "Data residency: All student data resides in the United States",
            ]}
          />
        </Section>

        {/* ---------------------------------------------------------- */}
        {/* Access Controls & Tenant Isolation                          */}
        {/* ---------------------------------------------------------- */}
        <Section title="Access Controls & Tenant Isolation">
          <P>
            Every query in Edvera is filtered by tenant at the database
            level&nbsp;&mdash; not in application code.
          </P>
          <BulletList
            items={[
              "Row-Level Security (RLS): PostgreSQL RLS policies enforce that users can only access records for schools they are assigned to. Enforced by the database engine itself.",
              "Staff membership model: Each user is linked to specific schools. A principal sees only their school. A district administrator sees all schools.",
              "No cross-tenant access: No administrative backdoor exists. Support staff use separate, audited service accounts.",
            ]}
          />

          <SectionSubtitle>Planned access roles:</SectionSubtitle>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left bg-slate-50 text-slate-500 uppercase text-xs tracking-wide px-3 py-2 font-medium">
                    Role
                  </th>
                  <th className="text-left bg-slate-50 text-slate-500 uppercase text-xs tracking-wide px-3 py-2 font-medium">
                    Scope
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                {[
                  ["District Administrator", "All schools in district"],
                  ["School Administrator", "Single school"],
                  ["Attendance Clerk", "Assigned students only"],
                  ["Counselor", "Assigned caseload only"],
                  [
                    "Read-Only / Board Member",
                    "Aggregated data, no individual records",
                  ],
                ].map(([role, scope]) => (
                  <tr key={role} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {role}
                    </td>
                    <td className="px-3 py-2">{scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ---------------------------------------------------------- */}
        {/* FERPA Compliance                                            */}
        {/* ---------------------------------------------------------- */}
        <Section title="FERPA Compliance">
          <P>
            Edvera operates as a &ldquo;school official&rdquo; under FERPA (34
            CFR &sect;&nbsp;99.31(a)(1)).
          </P>
          <BulletList
            items={[
              "Student PII used solely for the contracted educational purpose",
              "No disclosure to third parties except subprocessors",
              "Access restricted to personnel with legitimate need",
              "Direct control maintained per FERPA requirements",
            ]}
          />
        </Section>

        {/* ---------------------------------------------------------- */}
        {/* California Student Data Privacy (AB 1584)                   */}
        {/* ---------------------------------------------------------- */}
        <Section title="California Student Data Privacy (AB 1584)">
          <BulletList
            items={[
              "No sale of student data — ever",
              "No advertising use of any kind",
              "District retains full ownership of all data",
              "Deletion within 30 days of contract termination, with written confirmation",
              "Breach notification within 72 hours",
            ]}
          />
        </Section>

        {/* ---------------------------------------------------------- */}
        {/* COPPA                                                       */}
        {/* ---------------------------------------------------------- */}
        <Section title="COPPA">
          <P>
            Edvera does not collect information directly from students. All data
            flows from the district&rsquo;s SIS through authorized
            administrative channels. No student-facing interface exists.
          </P>
        </Section>

        {/* ---------------------------------------------------------- */}
        {/* Audit & Monitoring                                          */}
        {/* ---------------------------------------------------------- */}
        <Section title="Audit & Monitoring">
          <div className="mb-3">
            <StatusPill status="in_implementation" />
          </div>
          <BulletList
            items={[
              "Access logging for every student record view and data export",
              "Permission change tracking for all role modifications",
              "Data export audit trail with scope and recipient",
              "Connector run history for every ingestion event",
              "Append-only logs retained minimum three years",
            ]}
          />
        </Section>

        {/* ---------------------------------------------------------- */}
        {/* Breach Response                                             */}
        {/* ---------------------------------------------------------- */}
        <Section title="Breach Response">
          <ol className="pl-4 mb-4 space-y-1.5 list-decimal list-outside">
            <li className="text-sm text-slate-600 leading-relaxed pl-1">
              Investigate and confirm scope within 24 hours of detection
            </li>
            <li className="text-sm text-slate-600 leading-relaxed pl-1">
              Notify affected districts within 72 hours with incident details
            </li>
            <li className="text-sm text-slate-600 leading-relaxed pl-1">
              Full cooperation with district incident response
            </li>
            <li className="text-sm text-slate-600 leading-relaxed pl-1">
              Post-incident report within 30 days
            </li>
          </ol>
        </Section>

        {/* ---------------------------------------------------------- */}
        {/* Data Retention & Deletion                                   */}
        {/* ---------------------------------------------------------- */}
        <Section title="Data Retention & Deletion">
          <BulletList
            items={[
              "Active: Data retained for service duration plus current and prior school year",
              "Terminated: All data permanently deleted within 30 days, written confirmation provided",
              "Districts may request specific record deletion at any time",
              "Audit logs retained three years post-termination, contain no student PII",
            ]}
          />
        </Section>

        {/* ---------------------------------------------------------- */}
        {/* Subprocessors                                               */}
        {/* ---------------------------------------------------------- */}
        <Section title="Subprocessors">
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left bg-slate-50 text-slate-500 uppercase text-xs tracking-wide px-3 py-2 font-medium">
                    Subprocessor
                  </th>
                  <th className="text-left bg-slate-50 text-slate-500 uppercase text-xs tracking-wide px-3 py-2 font-medium">
                    Purpose
                  </th>
                  <th className="text-left bg-slate-50 text-slate-500 uppercase text-xs tracking-wide px-3 py-2 font-medium">
                    Data Processed
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                {[
                  [
                    "Supabase",
                    "Database, auth, serverless functions",
                    "All application data",
                  ],
                  [
                    "Amazon Web Services",
                    "Cloud infrastructure (via Supabase)",
                    "All data (encrypted)",
                  ],
                  [
                    "Vercel",
                    "Web hosting",
                    "No student data — static assets only",
                  ],
                ].map(([name, purpose, data]) => (
                  <tr key={name} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {name}
                    </td>
                    <td className="px-3 py-2">{purpose}</td>
                    <td className="px-3 py-2">{data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ---------------------------------------------------------- */}
        {/* Security Roadmap                                            */}
        {/* ---------------------------------------------------------- */}
        <Section title="Security Roadmap">
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left bg-slate-50 text-slate-500 uppercase text-xs tracking-wide px-3 py-2 font-medium">
                    Capability
                  </th>
                  <th className="text-left bg-slate-50 text-slate-500 uppercase text-xs tracking-wide px-3 py-2 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                {(
                  [
                    ["Encryption in transit (TLS 1.2+)", "active"],
                    ["Encryption at rest (AES-256)", "active"],
                    ["Row-Level Security (tenant isolation)", "active"],
                    ["Authentication with session management", "active"],
                    ["Data minimization", "active"],
                    ["Role-based access control", "in_implementation"],
                    ["Comprehensive audit logging", "in_implementation"],
                    ["Secure SFTP ingestion", "planned"],
                    ["Annual penetration testing", "planned"],
                    ["SOC 2 Type II certification", "planned"],
                  ] as [string, StatusKey][]
                ).map(([capability, status]) => (
                  <tr key={capability} className="border-b border-slate-100">
                    <td className="px-3 py-2">{capability}</td>
                    <td className="px-3 py-2">
                      <StatusPill status={status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ---------------------------------------------------------- */}
        {/* Contact                                                     */}
        {/* ---------------------------------------------------------- */}
        <Section title="Contact">
          <P>
            security@edvera.com&nbsp;&mdash; we respond to all inquiries within
            two business days.
          </P>
        </Section>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-16 mb-16">
          &copy; 2026 Edvera
        </p>
      </div>
    </div>
  );
}
