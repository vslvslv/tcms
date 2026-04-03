import { useState, useEffect } from "react";
import { api } from "../api";

type NotificationPref = { event: string; enabled: boolean };

const EVENT_LABELS: Record<string, string> = {
  "run.assigned": "Test run assigned to me",
  "run.completed": "Test run completed",
  "case.approval_requested": "Case approval requested",
  "result.recorded": "Result recorded on watched run",
};

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPref[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api<NotificationPref[]>("/api/notifications/preferences")
      .then(setPrefs)
      .finally(() => setLoading(false));
  }, []);

  async function toggle(event: string, enabled: boolean) {
    setSaving(event);
    try {
      await api("/api/notifications/preferences", {
        method: "PATCH",
        body: JSON.stringify({ event, enabled }),
      });
      setPrefs((prev) =>
        prev.map((p) => (p.event === event ? { ...p, enabled } : p))
      );
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-text font-mono">Notification Settings</h1>
      <p className="mb-6 text-sm text-muted">
        Choose which events trigger email notifications. SMTP must be configured on the server.
      </p>
      <div className="rounded-xl border border-border bg-surface shadow-card">
        {prefs.map((pref) => (
          <div
            key={pref.event}
            className="flex items-center justify-between border-b border-border px-5 py-4 last:border-b-0"
          >
            <div>
              <p className="text-sm font-medium text-text">
                {EVENT_LABELS[pref.event] ?? pref.event}
              </p>
              <p className="text-xs text-muted">{pref.event}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={pref.enabled}
              disabled={saving === pref.event}
              onClick={() => toggle(pref.event, !pref.enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                pref.enabled ? "bg-primary" : "bg-surface-raised"
              } ${saving === pref.event ? "opacity-50" : ""}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
                  pref.enabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
