import { useEffect, useState, useRef, useCallback } from "react";
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

function fileIcon(contentType: string | null): string {
  if (!contentType) return "📎";
  if (contentType.startsWith("image/")) return "🖼";
  if (contentType.includes("pdf")) return "📄";
  if (contentType.includes("zip") || contentType.includes("compressed")) return "📦";
  if (contentType.includes("text") || contentType.includes("csv")) return "📝";
  return "📎";
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function AttachmentPanel({
  entityType,
  entityId,
}: {
  entityType: "case" | "result";
  entityId: string;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    const url = entityType === "case"
      ? `/api/cases/${entityId}/attachments`
      : `/api/results/${entityId}/attachments`;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > MAX_SIZE) {
          setError(`${file.name} exceeds 10MB limit`);
          continue;
        }
        setUploadProgress(`Uploading ${i + 1}/${files.length}: ${file.name}`);
        const formData = new FormData();
        formData.append("file", file);
        const token = getToken();
        const res = await fetch(`${API_BASE}${url}`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `Upload failed (${res.status})`);
        }
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    await uploadFiles(Array.from(files));
    e.target.value = "";
  }

  async function handleDelete(id: string, fileName: string) {
    if (!confirm(`Delete "${fileName}"?`)) return;
    try {
      await api(`/api/attachments/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  }, [entityId, entityType]);

  return (
    <>
      {/* Lightbox overlay */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightboxSrc(null)}
          role="dialog"
          aria-label="Image preview"
        >
          <img
            src={lightboxSrc}
            alt="Attachment preview"
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute right-4 top-4 rounded-full bg-black/30 p-2 text-white hover:bg-black/50"
            aria-label="Close preview"
          >
            ✕
          </button>
        </div>
      )}

      <Card className="p-6">
        <h3 className="mb-3 text-sm font-semibold text-text">Attachments</h3>
        {error && <p className="mb-2 text-sm text-error">{error}</p>}

        {attachments.length > 0 && (
          <div className="mb-3 space-y-2">
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                {isImage(att.contentType) ? (
                  <button
                    type="button"
                    onClick={() => setLightboxSrc(`${API_BASE}/api/attachments/${att.id}/download`)}
                    className="shrink-0 cursor-zoom-in"
                    aria-label={`Preview ${att.fileName}`}
                  >
                    <img
                      src={`${API_BASE}/api/attachments/${att.id}/download`}
                      alt={att.fileName}
                      className="h-10 w-10 rounded object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </button>
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface-raised text-lg">
                    {fileIcon(att.contentType)}
                  </span>
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
                  onClick={() => handleDelete(att.id, att.fileName)}
                  className="shrink-0 text-sm text-muted hover:text-error"
                  aria-label={`Delete ${att.fileName}`}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Drag-and-drop zone + upload button */}
        <div
          className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {uploadProgress ? (
            <p className="text-sm text-primary">{uploadProgress}</p>
          ) : (
            <>
              <p className="text-sm text-muted">
                {dragOver ? "Drop files here" : "Drag files here or"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
                aria-label="Upload attachment"
              />
              {!dragOver && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={uploading}
                  className="mt-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose files
                </Button>
              )}
              <p className="mt-1 text-xs text-muted">Images, PDFs, up to 10MB</p>
            </>
          )}
        </div>

        {attachments.length === 0 && !uploading && !dragOver && (
          <p className="mt-2 text-sm text-muted">No attachments yet.</p>
        )}
      </Card>
    </>
  );
}
