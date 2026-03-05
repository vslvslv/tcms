import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, type Run } from "../api";

export default function CreateRun() {
  const { suiteId } = useParams<{ suiteId: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!suiteId) return;
    setError("");
    setSaving(true);
    try {
      const run = await api<Run>(`/api/suites/${suiteId}/runs`, {
        method: "POST",
        body: JSON.stringify({ name, description: description || undefined }),
      });
      navigate(`/runs/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create run");
    } finally {
      setSaving(false);
    }
  }

  if (!suiteId) return null;

  return (
    <div style={{ maxWidth: 500, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 24 }}>
        <Link to={`/suites/${suiteId}`}>Suite</Link> → Create run
      </header>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>
            Name <input value={name} onChange={(e) => setName(e.target.value)} required style={{ width: "100%" }} />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>
            Description <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ width: "100%" }} />
          </label>
        </div>
        <button type="submit" disabled={saving}>{saving ? "Creating…" : "Create run"}</button>
      </form>
    </div>
  );
}
