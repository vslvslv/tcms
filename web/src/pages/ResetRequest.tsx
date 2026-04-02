import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { SubmitButton } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";

export default function ResetRequest() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await api<{ message: string; resetToken?: string; resetUrl?: string }>(
        "/api/auth/reset-request",
        { method: "POST", body: JSON.stringify({ email }), token: null }
      );
      setSubmitted(true);
      if (res.resetUrl) setResetUrl(res.resetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-border bg-surface p-8 shadow-card">
            <h2 className="mb-2 text-xl font-bold text-gray-900">Check your email</h2>
            <p className="text-sm text-muted">
              If an account exists with that email, a reset link has been generated.
            </p>
            {resetUrl && (
              <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm">
                <strong>MVP mode:</strong> No email configured. Use this link directly:
                <br />
                <Link to={resetUrl} className="mt-1 block break-all font-medium text-primary hover:underline">
                  {resetUrl}
                </Link>
              </div>
            )}
            <p className="mt-6 text-center text-sm text-gray-600">
              <Link to="/login" className="font-medium text-primary hover:underline">
                Back to login
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-surface p-8 shadow-card">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">Reset Password</h1>
            <p className="mt-1 text-sm text-muted">Enter your email to receive a password reset link.</p>
          </div>
          {error && (
            <div className="mb-4 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="reset-email">Email address</Label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <SubmitButton className="w-full py-2.5 text-base">Send Reset Link</SubmitButton>
          </form>
          <p className="mt-6 text-center text-sm text-gray-600">
            <Link to="/login" className="font-medium text-primary hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
