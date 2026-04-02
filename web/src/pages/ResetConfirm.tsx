import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function ResetConfirm() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    try {
      await api("/api/auth/reset-confirm", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: password }),
        token: null,
      });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    }
  }

  if (success) {
    return (
      <div style={{ maxWidth: 400, margin: "80px auto", padding: 24 }}>
        <h2>Password Reset</h2>
        <p style={{ color: "green" }}>Password reset successfully. Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: 24 }}>
      <h2>Set New Password</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            required
            minLength={8}
            style={{ width: "100%", padding: 8 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>
        <button type="submit" style={{ width: "100%", padding: 8 }}>Reset Password</button>
      </form>
      <p style={{ marginTop: 16, fontSize: 14 }}>
        <Link to="/login">Back to login</Link>
      </p>
    </div>
  );
}
