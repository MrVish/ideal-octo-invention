import type { ReminderLog } from "@prisma/client";
import { addDays, startOfDay } from "./dates";
import { splitEmails } from "./emails";
import { alertsFor, type Alert } from "./lifecycle";
import type { PlacementFull } from "./types";

export interface ReminderMessage {
  placementId: string;
  alertCode: string;
  recipients: string[];
  subject: string;
  body: string;
}

export function recipientsFor(p: PlacementFull, alert: Alert): string[] {
  const out = new Set<string>();
  if (alert.audience.includes("EMPLOYEE")) out.add(p.employee.email);
  if (alert.audience.includes("SPOC") && p.location?.spocEmail) out.add(p.location.spocEmail);
  // The client's escalation list (HR owners) is always kept in the loop.
  for (const e of splitEmails(p.client.escalationEmails)) out.add(e);
  return [...out];
}

/**
 * Reminders to send now. Info-level alerts are dashboard-only; an alert that was
 * already reminded within the client's reminder interval is skipped.
 */
export function buildReminders(placements: PlacementFull[], recentLogs: ReminderLog[], now: Date): ReminderMessage[] {
  const messages: ReminderMessage[] = [];
  for (const p of placements) {
    const cutoff = addDays(now, -p.client.reminderIntervalDays + 1);
    for (const alert of alertsFor(p, now)) {
      if (alert.severity === "info") continue;
      const recent = recentLogs.some(
        (l) => l.placementId === p.id && l.alertCode === alert.code && startOfDay(l.createdAt) >= cutoff,
      );
      if (recent) continue;
      const recipients = recipientsFor(p, alert);
      if (!recipients.length) continue;
      messages.push({
        placementId: p.id,
        alertCode: alert.code,
        recipients,
        subject: `[Action needed] ${p.employee.name} @ ${p.client.name}: ${alert.message.split(":")[0]}`,
        body: [
          `Hi,`,
          "",
          `${alert.message}.`,
          "",
          `Employee: ${p.employee.name} (${p.employee.empCode})`,
          `Client: ${p.client.name}${p.location ? ` — ${p.location.name}` : ""}`,
          p.location?.spocName ? `Asset SPOC: ${p.location.spocName}${p.location.spocEmail ? ` <${p.location.spocEmail}>` : ""}` : null,
          "",
          "Please update the Employee Lifecycle portal once done.",
        ]
          .filter((l) => l !== null)
          .join("\n"),
      });
    }
  }
  return messages;
}

/** Delivery is pluggable; until a mail provider is configured, reminders are only logged. */
export interface Mailer {
  send(msg: ReminderMessage): Promise<void>;
}

export const logOnlyMailer: Mailer = {
  async send(msg) {
    console.info(`[reminder] to=${msg.recipients.join(",")} subject="${msg.subject}"`);
  },
};
