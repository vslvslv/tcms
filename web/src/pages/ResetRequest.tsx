import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

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
      <div style={{ maxWidth: 400, margin: "80px auto", padding: 24 }}>
        <h2>Check your email</h2>
        <p>If an account exists with that email, a reset link has been generated.</p>
        {resetUrl && (
          <div style={{ marginTop: 16, padding: 12, background: "#f0f9ff", borderRadius: 4, fontSize: 13 }}>
            <strong>MVP mode:</strong> No email configured. Use this link directly:
            <br />
            <Link to={resetUrl}>{resetUrl}</Link>
          </div>
        )}
        <p style={{ marginTop: 16 }}>
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: 24 }}>
      <h2>Reset Password</h2>
      <p style={{ color: "#666", fontSize: 14 }}>Enter your email to receive a password reset link.</p>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>
        <button type="submit" style={{ width: "100%", padding: 8 }}>Send Reset Link</button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14 }}>
        <Link to="/login">Back to login</Link>
      </p>
    </div>
  );
}
