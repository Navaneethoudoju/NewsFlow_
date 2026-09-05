import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { ApiError } from "../lib/api";
import Button from "../components/Button";

const DEMO_ACCOUNTS = [
  { label: "Editor", email: "editor1@demo.com" },
  { label: "Writer", email: "writer1@demo.com" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("password123");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Masthead panel */}
      <div className="hidden flex-col justify-between bg-ink px-12 py-10 text-white lg:flex">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-masthead" />
          <span className="font-serif text-xl font-semibold tracking-tight">NewsFlow</span>
        </div>
        <div className="max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-paper/50">Editorial workflow system</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.15]">
            Every story, tracked from first draft to the printed record.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-paper/60">
            Assign sections, route articles through review and approval, schedule publication, and keep an
            immutable history of every decision along the way.
          </p>
        </div>
        <p className="font-mono text-[11px] text-paper/40">Est. workflow, always current</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-paper px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-masthead" />
              <span className="font-serif text-xl font-semibold text-ink">NewsFlow</span>
            </div>
          </div>

          <h2 className="font-serif text-2xl font-semibold text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-ink-faint">Access your newsroom dashboard.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <p className="rounded-md border border-status-overdue/25 bg-status-overdue/5 px-3 py-2 text-sm text-status-overdue">
                {error}
              </p>
            )}

            <div>
              <label className="block text-sm font-medium text-ink-light" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-rule bg-white px-3 py-2 text-sm text-ink focus:border-masthead focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-light" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-rule bg-white px-3 py-2 text-sm text-ink focus:border-masthead focus:outline-none"
              />
            </div>

            <Button type="submit" loading={submitting} className="w-full">
              Sign in
            </Button>
          </form>

          <div className="mt-6 rounded-md border border-rule bg-white/70 px-3.5 py-3">
            <p className="text-xs font-medium text-ink-light">Demo accounts</p>
            <p className="mt-0.5 text-xs text-ink-faint">Password for all seeded accounts: password123</p>
            <div className="mt-2 flex gap-2">
              {DEMO_ACCOUNTS.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => fillDemo(d.email)}
                  className="rounded border border-rule bg-paper px-2.5 py-1 text-xs font-medium text-ink-light hover:border-masthead hover:text-masthead"
                >
                  {d.label} · {d.email}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
