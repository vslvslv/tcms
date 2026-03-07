import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { SubmitButton } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-surface p-8 shadow-card">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">TCMS</h1>
            <p className="mt-1 text-sm text-muted">Test Case Management System</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5" data-testid="login-form">
            {error && (
              <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error" role="alert" data-testid="login-error">
                {error}
              </div>
            )}
            <div>
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
            <SubmitButton
              disabled={submitting}
              className="w-full py-2.5 text-base"
            >
              {submitting ? "Signing in…" : "Log in"}
            </SubmitButton>
          </form>
          <p className="mt-6 text-center text-sm text-gray-600">
            Don’t have an account?{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Register
            </Link>
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          Sign in to manage test cases, runs, and plans.
        </p>
      </div>
    </div>
  );
}
