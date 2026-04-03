import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { PageTitle } from "../components/ui/PageTitle";

export default function Profile() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api("/api/auth/me", { method: "PATCH", body: JSON.stringify({ name }) });
      setMessage("Name updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setMessage("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg">
      <PageTitle className="mb-6">Profile</PageTitle>

      {message && <p className="mb-4 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{message}</p>}
      {error && <p className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}

      <Card className="mb-6 p-6">
        <h3 className="mb-4 text-sm font-semibold text-text font-mono">Account Info</h3>
        <p className="mb-4 text-sm text-muted">Email: {user?.email}</p>
        <form onSubmit={handleSaveName} className="space-y-3">
          <div>
            <Label htmlFor="profile-name">Display Name</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving..." : "Update Name"}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-text font-mono">Change Password</h3>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <Label htmlFor="current-pw">Current Password</Label>
            <Input id="current-pw" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <div>
            <Label htmlFor="new-pw">New Password</Label>
            <Input id="new-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="Min 8 characters" />
          </div>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Changing..." : "Change Password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
