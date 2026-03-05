import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type TestCase } from "../api";

export default function SectionCases() {
  const { sectionId } = useParams<{ sectionId: string }>();
  const [cases, setCases] = useState<(TestCase & { steps?: unknown[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sectionId) return;
    api<(TestCase & { steps?: unknown[] })[]>(`/api/sections/${sectionId}/cases`)
      .then(setCases)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [sectionId]);

  if (!sectionId) return null;
  if (loading) return <p>Loading…</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 24 }}>
        <Link to="/projects">Projects</Link> → Section cases
      </header>
      <p>
        <Link to={`/sections/${sectionId}/cases/new`}>Add case</Link>
      </p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {cases.map((c) => (
          <li key={c.id} style={{ marginBottom: 8 }}>
            <Link to={`/cases/${c.id}/edit`}>{c.title}</Link>
          </li>
        ))}
      </ul>
      {cases.length === 0 && <p>No cases yet.</p>}
    </div>
  );
}
