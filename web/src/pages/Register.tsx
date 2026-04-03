import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { SubmitButton } from "../components/ui/Button";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(email, password, name);
      navigate("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-raised px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-surface p-8 shadow-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-text font-mono">Create account</h1>
            <p className="mt-1 text-sm text-muted">Register for TCMS</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error" role="alert">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="register-name" className="mb-1.5 block text-sm font-medium text-muted">
                Name
              </label>
              <input
                id="register-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-surface-raised text-text px-3 py-2 text-sm placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Your name"
              />
            </div>
            <div>
              <label htmlFor="register-email" className="mb-1.5 block text-sm font-medium text-muted">
                Email
              </label>
              <input
                id="register-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-surface-raised text-text px-3 py-2 text-sm placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="register-password" className="mb-1.5 block text-sm font-medium text-muted">
                Password
              </label>
              <input
                id="register-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-border bg-surface-raised text-text px-3 py-2 text-sm placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="At least 8 characters"
              />
              <p className="mt-1 text-xs text-muted">Minimum 8 characters</p>
            </div>
            <SubmitButton
              disabled={submitting}
              className="w-full py-2.5 text-base"
            >
              {submitting ? "Creating account…" : "Register"}
            </SubmitButton>
          </form>
          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
