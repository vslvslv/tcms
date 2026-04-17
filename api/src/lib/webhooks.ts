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
  | "result.created"
  | "test.assigned";

function isSlackUrl(url: string): boolean {
  return url.includes("hooks.slack.com/") || url.includes("hooks.slack-gov.com/");
}

function isTeamsUrl(url: string): boolean {
  return url.includes(".webhook.office.com/") || url.includes(".logic.azure.com/");
}

function formatSlackPayload(payload: Record<string, unknown>): string {
  const event = payload.event as string;
  const entityType = payload.entityType as string;
  const entityId = payload.entityId as string;
  const meta = (payload.metadata ?? {}) as Record<string, unknown>;
  const name = (meta.name ?? entityType) as string;
  const passed = (meta.passed ?? 0) as number;
  const failed = (meta.failed ?? 0) as number;
  const total = (meta.total ?? 0) as number;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  return JSON.stringify({
    blocks: [
      { type: "header", text: { type: "plain_text", text: `TCMS: ${event}` } },
      { type: "section", text: { type: "mrkdwn", text: `*${name}* (${entityId})\nPassed: ${passed} | Failed: ${failed} | Total: ${total} | Pass rate: ${passRate}%` } },
    ],
  });
}

function formatTeamsPayload(payload: Record<string, unknown>): string {
  const event = payload.event as string;
  const entityType = payload.entityType as string;
  const entityId = payload.entityId as string;
  const meta = (payload.metadata ?? {}) as Record<string, unknown>;
  const name = (meta.name ?? entityType) as string;
  const passed = (meta.passed ?? 0) as number;
  const failed = (meta.failed ?? 0) as number;
  const total = (meta.total ?? 0) as number;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  return JSON.stringify({
    type: "message",
    attachments: [{
      contentType: "application/vnd.microsoft.card.adaptive",
      content: {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard",
        version: "1.4",
        body: [
          { type: "TextBlock", text: `TCMS: ${event}`, weight: "Bolder", size: "Medium" },
          { type: "TextBlock", text: `${name} (${entityId})`, wrap: true },
          { type: "FactSet", facts: [
            { title: "Passed", value: String(passed) },
            { title: "Failed", value: String(failed) },
            { title: "Total", value: String(total) },
            { title: "Pass Rate", value: `${passRate}%` },
          ]},
        ],
      },
    }],
  });
}

export async function dispatchWebhooks(
  projectId: string,
  event: WebhookEvent,
  payload: { event: WebhookEvent; entityType: string; entityId: string; projectId: string; timestamp: string; metadata?: Record<string, unknown> }
): Promise<void> {
  const db = await getDb();
  const list = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.projectId, projectId), eq(webhooks.isActive, true)));
  const toCall = list.filter((w) => w.events && (w.events as string[]).includes(event));
  for (const w of toCall) {
    let body: string;
    if (isSlackUrl(w.url)) {
      body = formatSlackPayload(payload);
    } else if (isTeamsUrl(w.url)) {
      body = formatTeamsPayload(payload);
    } else {
      body = JSON.stringify(payload);
    }
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
