import { useEffect, useState } from "react";
import { api, type ApiToken } from "../api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { PageTitle } from "../components/ui/PageTitle";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";

export default function ApiTokens() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setTokens(await api<ApiToken[]>("/api/tokens"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createToken(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");
    try {
      const res = await api<ApiToken>("/api/tokens", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      setNewToken(res.token ?? null);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create token");
    }
  }

  async function deleteToken(id: string) {
    if (!confirm("Revoke this token? Any CI/CD pipelines using it will stop working.")) return;
    try {
      await api(`/api/tokens/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete token");
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-2xl">
      <PageTitle className="mb-6">API Tokens</PageTitle>
      <p className="mb-6 text-sm text-muted">
        Create tokens for CI/CD pipeline integration. Tokens expire after 90 days by default.
      </p>

      {error && <p className="mb-4 text-sm text-error">{error}</p>}

      {newToken && (
        <Card className="mb-6 border-green-200 bg-green-50 p-4">
          <p className="mb-2 text-sm font-semibold text-green-800">Token created. Copy it now — you won't see it again.</p>
          <code className="block break-all rounded bg-white p-2 text-xs">{newToken}</code>
          <Button variant="secondary" className="mt-2" onClick={() => { navigator.clipboard.writeText(newToken); }}>
            Copy to clipboard
          </Button>
          <Button variant="ghost" className="mt-2 ml-2" onClick={() => setNewToken(null)}>
            Dismiss
          </Button>
        </Card>
      )}

      <Card className="mb-6 p-4">
        <form onSubmit={createToken} className="flex items-end gap-3">
          <div className="flex-1">
            <Label htmlFor="token-name">Token name</Label>
            <Input id="token-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., GitHub Actions CI" required />
          </div>
          <Button type="submit" variant="primary">Create token</Button>
        </form>
      </Card>

      {tokens.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Name</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Created</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Expires</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Last used</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id} className="border-b border-slate-100">
                  <td className="px-4 py-2 font-medium">{t.name}</td>
                  <td className="px-4 py-2 text-xs text-muted">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-xs text-muted">{t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : "Never"}</td>
                  <td className="px-4 py-2 text-xs text-muted">{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : "Never"}</td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" onClick={() => deleteToken(t.id)} className="text-sm text-muted hover:text-error">Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tokens.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-muted">No API tokens yet.</p>
          <p className="mt-1 text-xs text-muted">Create one above to integrate with your CI/CD pipeline.</p>
        </Card>
      )}
    </div>
  );
}
