import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signIn } from "@/services/auth";
import { Shield } from "lucide-react";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await signIn(email, password);

    setLoading(false);

    if (authError) {
      setError(authError);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6f7f9]">
      {/* Structural background — soft ambient depth behind the shell */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse 1100px 650px at 28% 20%, rgba(15, 23, 42, 0.04), transparent 65%)",
            "radial-gradient(ellipse 800px 450px at 78% 78%, rgba(51, 65, 85, 0.02), transparent 60%)",
            "radial-gradient(ellipse 1400px 700px at 50% 48%, rgba(100, 116, 139, 0.018), transparent 55%)",
          ].join(", "),
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1060px] items-center justify-center px-5 py-10 sm:px-8 lg:px-14">
        <div className="grid w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_6px_24px_rgba(0,0,0,0.04)] md:grid-cols-[0.9fr_1.1fr]">
          {/* Left — Context panel */}
          <div className="flex flex-col justify-between border-b border-slate-100 bg-gradient-to-br from-[#f4f5f8] to-[#eef0f4] p-7 md:border-b-0 md:border-r md:p-9 lg:p-11">
            <div>
              <img src="/logo.png" alt="Edvera" className="h-7 w-auto" />
              <h2 className="mt-7 text-xl font-semibold leading-snug tracking-[-0.01em] text-slate-900">
                Attendance Compliance &amp; Operations Platform
              </h2>
              <p className="mt-2 text-[13px] font-medium uppercase tracking-[0.08em] text-slate-400">
                for School Districts
              </p>
              <p className="mt-5 max-w-sm text-[13.5px] leading-[1.7] text-slate-500">
                Manage attendance compliance, intervention workflows, and SARB
                case preparation from one secure district console.
              </p>
            </div>

            <div className="mt-10 space-y-3">
              <div className="rounded-lg border border-slate-200/70 bg-white/70 px-4 py-3.5">
                <p className="text-[13px] font-semibold text-slate-700">
                  District Operations
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
                  Track compliance actions, generate required documentation, and
                  monitor case progression across schools.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200/70 bg-white/70 px-4 py-3.5">
                <p className="text-[13px] font-semibold text-slate-700">
                  Student Data Protection
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
                  Edvera is designed with FERPA-aligned data practices and
                  secure district access controls.
                </p>
                <Link
                  to="/security"
                  className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 transition hover:text-slate-700"
                >
                  <Shield size={11} />
                  View security practices
                </Link>
              </div>
            </div>
          </div>

          {/* Right — Authentication surface */}
          <div className="flex items-center p-7 md:p-9 lg:p-11">
            <div className="w-full">
              <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-slate-900">
                Sign in to Edvera Console
              </h1>
              <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">
                Access your district&apos;s attendance operations workspace.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition duration-150 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/[0.06]"
                    placeholder="admin@district.edu"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-slate-600">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition duration-150 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/[0.06]"
                  />
                </div>

                {error && (
                  <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white shadow-sm transition duration-150 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? "Signing in\u2026" : "Sign in"}
                </button>
              </form>

              <div className="mt-8 rounded-lg border border-slate-200/70 bg-slate-50/60 px-4 py-3.5">
                <p className="text-[13px] font-medium text-slate-600">
                  Need access?
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
                  Accounts are provisioned by your district administrator.
                </p>
                <a
                  href="mailto:support@edvera.ai"
                  className="mt-2 inline-flex items-center text-[12px] font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-800 hover:decoration-slate-400"
                >
                  Request sign-in support
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
