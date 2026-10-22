import { formatDate } from "./dates";
import type { PlacementFull } from "./types";

export interface EmailDraft {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
}

export function splitEmails(s: string): string[] {
  return s.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
}

export function entryEmail(p: PlacementFull): EmailDraft {
  const e = p.employee;
  return {
    to: splitEmails(p.client.clientContactEmails),
    cc: splitEmails(p.client.escalationEmails),
    subject: `Onboarding: ${e.name} (${e.empCode}) — ${p.client.name}`,
    body: [
      `Hello ${p.client.name} team,`,
      "",
      `This is to notify you that ${e.name} is being onboarded to your engagement.`,
      "",
      `Employee: ${e.name} (${e.empCode})`,
      `Email: ${e.email}`,
      p.role ? `Role: ${p.role}` : null,
      p.location ? `Location: ${p.location.name}` : null,
      `Start date: ${formatDate(p.startDate)}`,
      `Billing start date: ${formatDate(p.billingStartDate)}`,
      "",
      "Please arrange client access and assets as applicable.",
      "",
      "Regards,",
      "HR & Onboarding Team",
    ]
      .filter((l) => l !== null)
      .join("\n"),
  };
}

export function exitEmail(p: PlacementFull): EmailDraft {
  const e = p.employee;
  return {
    to: splitEmails(p.client.clientContactEmails),
    cc: splitEmails(p.client.escalationEmails),
    subject: `Offboarding: ${e.name} (${e.empCode}) — client ID deactivation & billing stop`,
    body: [
      `Hello ${p.client.name} team,`,
      "",
      `${e.name} will be rolling off your engagement.`,
      "",
      `Employee: ${e.name} (${e.empCode})`,
      p.clientEmployeeId ? `Client ID: ${p.clientEmployeeId}` : null,
      `Last working day: ${formatDate(p.lastWorkingDay)}`,
      `Billing stop date: ${formatDate(p.billingStopDate)}`,
      "",
      "Please deactivate the client ID effective the last working day and confirm once done.",
      p.location?.spocName ? `Client assets will be returned to ${p.location.spocName} (${p.location.name}).` : null,
      "",
      "Regards,",
      "HR & Onboarding Team",
    ]
      .filter((l) => l !== null)
      .join("\n"),
  };
}

export function mailtoHref(d: EmailDraft): string {
  const params = new URLSearchParams();
  if (d.cc.length) params.set("cc", d.cc.join(","));
  params.set("subject", d.subject);
  params.set("body", d.body);
  // URLSearchParams encodes spaces as "+", which mail clients show literally.
  return `mailto:${d.to.join(",")}?${params.toString().replace(/\+/g, "%20")}`;
}
