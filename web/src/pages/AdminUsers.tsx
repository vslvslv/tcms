import { useEffect, useState } from "react";
import { api, type AdminUser } from "../api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageTitle } from "../components/ui/PageTitle";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await api<AdminUser[]>("/api/admin/users");
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(userId: string, isActive: boolean) {
    try {
      await api(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !isActive }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  }

  async function toggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    try {
      await api(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ globalRole: newRole }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl">
      <PageTitle className="mb-6">User Administration</PageTitle>
      {error && <p className="mb-4 text-sm text-error">{error}</p>}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Joined</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-muted">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                      u.globalRole === "admin" ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-700"
                    }`}>{u.globalRole}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                      u.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}>{u.isActive ? "Active" : "Deactivated"}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => toggleRole(u.id, u.globalRole)}>
                        {u.globalRole === "admin" ? "Demote" : "Promote"}
                      </Button>
                      <Button variant="ghost" onClick={() => toggleActive(u.id, u.isActive)}>
                        {u.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
