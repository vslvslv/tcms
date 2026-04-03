import { useEffect, useState } from "react";
import { api, type Dataset, type DatasetColumn, type DatasetRow } from "../api";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { LoadingSpinner } from "./ui/LoadingSpinner";

export function DatasetEditor({
  datasetId,
  onBack,
}: {
  datasetId: string;
  onBack?: () => void;
}) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [columns, setColumns] = useState<DatasetColumn[]>([]);
  const [rows, setRows] = useState<DatasetRow[]>([]);
  const [newColumnName, setNewColumnName] = useState("");
  const [newRowData, setNewRowData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const d = await api<Dataset>(`/api/datasets/${datasetId}`);
      setDataset(d);
      setColumns((d.columns ?? []).sort((a, b) => a.sortOrder - b.sortOrder));
      setRows(d.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dataset");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [datasetId]);

  async function addColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!newColumnName.trim()) return;
    if (columns.some((c) => c.name.toLowerCase() === newColumnName.trim().toLowerCase())) {
      setError("Column name already exists");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api<DatasetColumn>(`/api/datasets/${datasetId}/columns`, {
        method: "POST",
        body: JSON.stringify({ name: newColumnName.trim(), sortOrder: columns.length }),
      });
      setNewColumnName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add column");
    } finally {
      setSaving(false);
    }
  }

  async function addRow() {
    const hasData = Object.values(newRowData).some((v) => v.trim());
    if (!hasData) return;
    setSaving(true);
    setError("");
    try {
      await api<DatasetRow>(`/api/datasets/${datasetId}/rows`, {
        method: "POST",
        body: JSON.stringify({ data: newRowData }),
      });
      setNewRowData({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add row");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {onBack && (
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
        )}
        <h3 className="text-base font-semibold text-text">{dataset?.name ?? "Dataset"}</h3>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {/* Column management */}
      <Card className="p-4">
        <h4 className="mb-2 text-sm font-medium text-text-secondary">Columns</h4>
        <div className="flex flex-wrap items-center gap-2">
          {columns.map((col) => (
            <span
              key={col.id}
              className="inline-flex rounded-full bg-surface-raised px-3 py-1 text-sm font-medium text-text"
            >
              {col.name}
            </span>
          ))}
          <form onSubmit={addColumn} className="flex items-center gap-2">
            <input
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              placeholder="Column name"
              className="w-36 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <Button type="submit" variant="primary" disabled={saving || !newColumnName.trim()}>
              Add
            </Button>
          </form>
        </div>
        {columns.length === 0 && (
          <p className="mt-2 text-sm text-muted">Add columns to define your dataset structure.</p>
        )}
      </Card>

      {/* Data grid */}
      {columns.length > 0 && (
        <Card className="p-4">
          <h4 className="mb-2 text-sm font-medium text-text-secondary">
            Data ({rows.length} row{rows.length !== 1 ? "s" : ""})
          </h4>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-raised">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted w-10">#</th>
                  {columns.map((col) => (
                    <th key={col.id} className="px-3 py-2 text-left text-xs font-semibold text-muted">
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id} className="border-b border-border hover:bg-surface-raised/50">
                    <td className="px-3 py-2 text-muted">{idx + 1}</td>
                    {columns.map((col) => (
                      <td key={col.id} className="px-3 py-2">
                        {row.data[col.name] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* New row input */}
                <tr className="bg-primary/5">
                  <td className="px-3 py-2 text-muted">+</td>
                  {columns.map((col) => (
                    <td key={col.id} className="px-3 py-1">
                      <input
                        value={newRowData[col.name] ?? ""}
                        onChange={(e) =>
                          setNewRowData((prev) => ({ ...prev, [col.name]: e.target.value }))
                        }
                        placeholder={col.name}
                        className="w-full rounded border border-border bg-surface px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <Button
            type="button"
            variant="primary"
            className="mt-2"
            onClick={addRow}
            disabled={saving || !Object.values(newRowData).some((v) => v.trim())}
          >
            Add row
          </Button>
          {rows.length === 0 && (
            <p className="mt-2 text-sm text-muted">
              No data rows yet. Fill in the inputs above and click Add row.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
