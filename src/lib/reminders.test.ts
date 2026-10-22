import type { ReminderLog } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { entryEmail, exitEmail, mailtoHref } from "./emails";
import { buildReminders } from "./reminders";
import { d, placement } from "./test-fixtures";

const log = (code: string, at: string): ReminderLog => ({
  id: "r", placementId: "p1", alertCode: code, recipients: "", subject: "", body: "", createdAt: d(at),
});

describe("buildReminders", () => {
  const p = placement({ assets: [] });

  it("reminds the employee with the escalation list in copy", () => {
    const [m] = buildReminders([p], [], d("2026-01-10"));
    expect(m.alertCode).toBe("ASSETS_NOT_RECORDED");
    expect(m.recipients).toEqual(["priya@co.test", "veena@co.test", "honey@co.test", "raveen@co.test"]);
  });
  it("includes the SPOC for asset returns", () => {
    const leaving = placement({ lastWorkingDay: d("2026-06-30"), billingStopDate: d("2026-06-30"), exitEmailSentAt: d("2026-06-20") });
    const [m] = buildReminders([leaving], [], d("2026-06-28"));
    expect(m.alertCode).toBe("ASSETS_NOT_RETURNED");
    expect(m.recipients).toContain("spoc@intuit.test");
  });
  it("does not repeat within the reminder interval", () => {
    expect(buildReminders([p], [log("ASSETS_NOT_RECORDED", "2026-01-09")], d("2026-01-10"))).toHaveLength(0);
    expect(buildReminders([p], [log("ASSETS_NOT_RECORDED", "2026-01-08")], d("2026-01-10"))).toHaveLength(1);
  });
  it("skips info-level alerts", () => {
    const future = placement({ startDate: d("2026-02-01"), checklist: [{ ...placement().checklist[0], completedAt: null }] });
    expect(buildReminders([future], [], d("2026-01-10")).map((m) => m.alertCode)).not.toContain("ONBOARDING_EMPLOYEE_ITEMS");
  });
});

describe("client emails", () => {
  it("entry email carries billing start date and goes to client contacts", () => {
    const e = entryEmail(placement());
    expect(e.to).toEqual(["onb@intuit.test"]);
    expect(e.body).toContain("Billing start date: 01 Jan 2026");
  });
  it("exit email asks for client ID deactivation with billing stop date", () => {
    const e = exitEmail(placement({ lastWorkingDay: d("2026-06-30"), billingStopDate: d("2026-06-30") }));
    expect(e.body).toContain("Client ID: INT-1");
    expect(e.body).toContain("Billing stop date: 30 Jun 2026");
    expect(e.body).toContain("deactivate the client ID");
  });
  it("mailto link encodes spaces as %20", () => {
    expect(mailtoHref(entryEmail(placement()))).not.toContain("+");
  });
});
