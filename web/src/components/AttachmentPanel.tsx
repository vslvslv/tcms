import { useEffect, useState } from "react";
import { api, getToken, type Attachment } from "../api";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(contentType: string | null): boolean {
  return !!contentType && contentType.startsWith("image/");
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function AttachmentPanel({
  entityType,
  entityId,
}: {
  entityType: "case" | "result";
  entityId: string;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const url = entityType === "case"
        ? `/api/cases/${entityId}/attachments`
        : `/api/results/${entityId}/attachments`;
      const rows = await api<Attachment[]>(url);
      setAttachments(rows);
    } catch {
      // Attachment listing may fail if entity doesn't exist yet
    }
  }

  useEffect(() => {
    load();
  }, [entityId, entityType]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    const url = entityType === "case"
      ? `/api/cases/${entityId}/attachments`
      : `/api/results/${entityId}/attachments`;

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const token = getToken();
        await fetch(`${API_BASE}${url}`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        }).then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.message || `Upload failed (${res.status})`);
          }
        });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(id: string) {
    try {
      await api(`/api/attachments/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const downloadUrl = (id: string) => {
    const token = getToken();
    return `${API_BASE}/api/attachments/${id}/download${token ? `?token=${token}` : ""}`;
  };

  return (
    <Card className="p-6">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">Attachments</h3>
      {error && <p className="mb-2 text-sm text-error">{error}</p>}

      {attachments.length > 0 && (
        <div className="mb-3 space-y-2">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm">
              {isImage(att.contentType) && (
                <img
                  src={`${API_BASE}/api/attachments/${att.id}/download`}
                  alt={att.fileName}
                  className="h-10 w-10 rounded object-cover"
                  crossOrigin="anonymous"
                />
              )}
              <div className="flex-1 min-w-0">
                <a
                  href={`${API_BASE}/api/attachments/${att.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate font-medium text-primary hover:underline"
                >
                  {att.fileName}
                </a>
                <span className="text-xs text-muted">{formatSize(att.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(att.id)}
                className="text-sm text-muted hover:text-error"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="inline-flex cursor-pointer items-center gap-2">
        <input
          type="file"
          multiple
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
        <Button type="button" variant="secondary" disabled={uploading} onClick={(e) => {
          const input = (e.currentTarget as HTMLElement).parentElement?.querySelector("input[type=file]") as HTMLInputElement;
          input?.click();
        }}>
          {uploading ? "Uploading..." : "Attach file"}
        </Button>
      </label>

      {attachments.length === 0 && !uploading && (
        <p className="mt-2 text-sm text-muted">No attachments yet.</p>
      )}
    </Card>
  );
}
