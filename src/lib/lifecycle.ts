import { addDays, daysBetween, formatDate } from "./dates";
import type { PlacementFull } from "./types";

export type Stage = "ONBOARDING" | "ACTIVE" | "OFFBOARDING" | "CLOSED";
export type Severity = "critical" | "warning" | "info";
export type Audience = "EMPLOYEE" | "HR" | "SPOC";

export interface Alert {
  code: string;
  severity: Severity;
  message: string;
  /** Who is expected to act. Reminders go to these people plus the client's escalation list. */
  audience: Audience[];
}

type Lifecycle = Pick<
  PlacementFull,
  | "startDate" | "billingStartDate" | "lastWorkingDay" | "billingStopDate" | "bgcStatus"
  | "entryEmailSentAt" | "exitEmailSentAt" | "clientIdDeactivatedAt" | "closedAt"
  | "client" | "location" | "checklist" | "assets"
>;

function openItems(p: Lifecycle, phase: string) {
  return p.checklist.filter((i) => i.phase === phase && i.required && !i.completedAt);
}

export function isOnboardingComplete(p: Lifecycle): boolean {
  return openItems(p, "ONBOARDING").length === 0 && p.bgcStatus === "GREEN" && !!p.entryEmailSentAt;
}

export function stageOf(p: Lifecycle): Stage {
  if (p.closedAt) return "CLOSED";
  if (p.lastWorkingDay) return "OFFBOARDING";
  if (!isOnboardingComplete(p)) return "ONBOARDING";
  return "ACTIVE";
}

/** Offboarding can be closed once the client confirmed ID deactivation and every asset is back. */
export function canClose(p: Lifecycle): boolean {
  return (
    !!p.lastWorkingDay &&
    !!p.exitEmailSentAt &&
    !!p.clientIdDeactivatedAt &&
    openItems(p, "OFFBOARDING").length === 0 &&
    p.assets.every((a) => a.returnedAt)
  );
}

/** Everything that needs someone's attention on a placement, as of `today`. */
export function alertsFor(p: Lifecycle, today: Date): Alert[] {
  if (p.closedAt) return [];
  const alerts: Alert[] = [];
  const daysToStart = daysBetween(today, p.startDate);
  const started = daysToStart <= 0;

  // --- Onboarding ---
  if (p.bgcStatus !== "GREEN") {
    alerts.push({
      code: "BGC_NOT_GREEN",
      severity: p.bgcStatus === "RED" || started ? "critical" : "warning",
      message: `Background check is ${p.bgcStatus.toLowerCase()} (must be green)`,
      audience: ["HR"],
    });
  }

  const onboardingOpen = openItems(p, "ONBOARDING");
  const empOpen = onboardingOpen.filter((i) => i.owner === "EMPLOYEE");
  const hrOpen = onboardingOpen.filter((i) => i.owner === "HR");
  if (empOpen.length) {
    alerts.push({
      code: "ONBOARDING_EMPLOYEE_ITEMS",
      severity: started ? "warning" : "info",
      message: `Onboarding pending for employee: ${empOpen.map((i) => i.title).join(", ")}`,
      audience: ["EMPLOYEE"],
    });
  }
  if (hrOpen.length) {
    alerts.push({
      code: "ONBOARDING_HR_ITEMS",
      severity: started ? "warning" : "info",
      message: `Onboarding pending for HR: ${hrOpen.map((i) => i.title).join(", ")}`,
      audience: ["HR"],
    });
  }

  if (!p.billingStartDate) {
    alerts.push({ code: "BILLING_START_MISSING", severity: "warning", message: "Billing start date not set", audience: ["HR"] });
  }
  if (!p.entryEmailSentAt) {
    alerts.push({
      code: "ENTRY_EMAIL_NOT_SENT",
      severity: daysToStart <= 2 ? "critical" : "warning",
      message: `Entry email to client not sent (start ${formatDate(p.startDate)})`,
      audience: ["HR"],
    });
  }

  // --- Assets ---
  if (p.client.assetTrackingEnabled) {
    if (!p.location || !p.location.spocName) {
      alerts.push({
        code: "SPOC_MISSING",
        severity: "warning",
        message: p.location ? `No asset SPOC named for ${p.location.name}` : "No client location / asset SPOC assigned",
        audience: ["HR"],
      });
    }
    const entryDue = addDays(p.startDate, p.client.assetEntryGraceDays);
    if (p.assets.length === 0 && daysBetween(entryDue, today) >= 0 && !p.lastWorkingDay) {
      alerts.push({
        code: "ASSETS_NOT_RECORDED",
        severity: "warning",
        message: "Client-issued asset details not entered on the portal",
        audience: ["EMPLOYEE"],
      });
    }
  }

  // --- Offboarding ---
  if (p.lastWorkingDay) {
    const daysToLwd = daysBetween(today, p.lastWorkingDay);
    const pastLwd = daysToLwd < 0;
    const inWindow = daysToLwd <= p.client.exitEmailLeadDays;

    if (!p.billingStopDate) {
      alerts.push({ code: "BILLING_STOP_MISSING", severity: "warning", message: "Billing stop date not set", audience: ["HR"] });
    }
    if (!p.exitEmailSentAt && inWindow) {
      alerts.push({
        code: "EXIT_EMAIL_DUE",
        severity: daysToLwd <= 1 ? "critical" : "warning",
        message: pastLwd
          ? `Exit email to client not sent and LWD (${formatDate(p.lastWorkingDay)}) has passed`
          : `Exit email to client due — LWD in ${daysToLwd} day(s)`,
        audience: ["HR"],
      });
    }
    if (p.exitEmailSentAt && !p.clientIdDeactivatedAt && daysToLwd <= 0) {
      alerts.push({
        code: "CLIENT_ID_NOT_CONFIRMED",
        severity: pastLwd ? "critical" : "warning",
        message: "Client ID deactivation not yet confirmed by client",
        audience: ["HR"],
      });
    }
    const offOpen = openItems(p, "OFFBOARDING");
    if (offOpen.length && inWindow) {
      alerts.push({
        code: "OFFBOARDING_ITEMS",
        severity: pastLwd ? "critical" : "warning",
        message: `Offboarding pending: ${offOpen.map((i) => i.title).join(", ")}`,
        audience: Array.from(new Set(offOpen.map((i) => i.owner as Audience))),
      });
    }
    const outstanding = p.assets.filter((a) => !a.returnedAt);
    if (outstanding.length && inWindow) {
      alerts.push({
        code: "ASSETS_NOT_RETURNED",
        severity: pastLwd ? "critical" : "warning",
        message: `${outstanding.length} asset(s) to return${p.location?.spocName ? ` to ${p.location.spocName}` : ""}: ${outstanding
          .map((a) => a.type + (a.serialNo ? ` (${a.serialNo})` : ""))
          .join(", ")}`,
        audience: ["EMPLOYEE", "SPOC"],
      });
    }
  }

  return alerts;
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
export function bySeverity(a: { severity: Severity }, b: { severity: Severity }) {
  return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
}
