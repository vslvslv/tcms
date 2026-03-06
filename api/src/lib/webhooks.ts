import { createHmac } from "crypto";
import { getDb } from "../db/index.js";
import { webhooks } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

const WEBHOOK_TIMEOUT_MS = 5000;

export type WebhookEvent =
  | "case.created"
  | "case.updated"
  | "run.created"
  | "run.completed"
  | "result.created";

export async function dispatchWebhooks(
  projectId: string,
  event: WebhookEvent,
  payload: { event: WebhookEvent; entityType: string; entityId: string; projectId: string; timestamp: string }
): Promise<void> {
  const db = await getDb();
  const list = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.projectId, projectId), eq(webhooks.isActive, true)));
  const body = JSON.stringify(payload);
  const toCall = list.filter((w) => w.events && (w.events as string[]).includes(event));
  for (const w of toCall) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": event,
    };
    if (w.secret) {
      const sig = createHmac("sha256", w.secret).update(body).digest("hex");
      headers["X-Webhook-Signature"] = `sha256=${sig}`;
    }
    fetch(w.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));
  }
}
