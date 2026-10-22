import { describe, expect, it } from "vitest";
import { alertsFor, canClose, stageOf } from "./lifecycle";
import { d, item, placement } from "./test-fixtures";

const codes = (p: Parameters<typeof alertsFor>[0], today: string) => alertsFor(p, d(today)).map((a) => a.code);

describe("stageOf", () => {
  it("is ACTIVE when onboarding is complete", () => {
    expect(stageOf(placement())).toBe("ACTIVE");
  });
  it("is ONBOARDING while BGC is not green, entry email unsent or required steps open", () => {
    expect(stageOf(placement({ bgcStatus: "PENDING" }))).toBe("ONBOARDING");
    expect(stageOf(placement({ entryEmailSentAt: null }))).toBe("ONBOARDING");
    expect(stageOf(placement({ checklist: [item()] }))).toBe("ONBOARDING");
  });
  it("ignores optional steps", () => {
    expect(stageOf(placement({ checklist: [item({ required: false })] }))).toBe("ACTIVE");
  });
  it("is OFFBOARDING once an LWD is set, CLOSED once closed", () => {
    expect(stageOf(placement({ lastWorkingDay: d("2026-06-30") }))).toBe("OFFBOARDING");
    expect(stageOf(placement({ closedAt: d("2026-07-01") }))).toBe("CLOSED");
  });
});

describe("alertsFor — onboarding", () => {
  it("has no alerts for a healthy active placement", () => {
    expect(codes(placement(), "2026-03-01")).toEqual([]);
  });
  it("flags BGC, entry email and open steps split by owner", () => {
    const p = placement({
      bgcStatus: "AMBER",
      entryEmailSentAt: null,
      checklist: [item({ title: "WFH acknowledgement" }), item({ owner: "HR", title: "Laptop request" })],
    });
    const alerts = alertsFor(p, d("2025-12-31"));
    expect(alerts.map((a) => a.code)).toEqual(["BGC_NOT_GREEN", "ONBOARDING_EMPLOYEE_ITEMS", "ONBOARDING_HR_ITEMS", "ENTRY_EMAIL_NOT_SENT"]);
    expect(alerts.find((a) => a.code === "ENTRY_EMAIL_NOT_SENT")?.severity).toBe("critical");
    expect(alerts.find((a) => a.code === "ONBOARDING_EMPLOYEE_ITEMS")?.audience).toEqual(["EMPLOYEE"]);
  });
  it("asks for asset details only after the grace period", () => {
    const p = placement({ assets: [] });
    expect(codes(p, "2026-01-03")).not.toContain("ASSETS_NOT_RECORDED");
    expect(codes(p, "2026-01-04")).toContain("ASSETS_NOT_RECORDED");
  });
  it("skips asset alerts when the client does not track assets", () => {
    const p = placement({ assets: [], location: null });
    p.client = { ...p.client, assetTrackingEnabled: false };
    expect(codes(p, "2026-02-01")).toEqual([]);
  });
  it("flags a missing SPOC", () => {
    const p = placement();
    p.location = { ...p.location!, spocName: "" };
    expect(codes(p, "2026-02-01")).toContain("SPOC_MISSING");
  });
});

describe("alertsFor — offboarding", () => {
  const leaving = (over = {}) => placement({ lastWorkingDay: d("2026-06-30"), billingStopDate: d("2026-06-30"), ...over });

  it("stays quiet before the exit-email window", () => {
    expect(codes(leaving(), "2026-06-01")).toEqual([]);
  });
  it("flags the exit email and outstanding assets inside the window", () => {
    const alerts = alertsFor(leaving(), d("2026-06-25"));
    expect(alerts.map((a) => a.code)).toEqual(["EXIT_EMAIL_DUE", "ASSETS_NOT_RETURNED"]);
    expect(alerts[1].audience).toEqual(["EMPLOYEE", "SPOC"]);
    expect(alerts[1].message).toContain("Spoc Person");
  });
  it("escalates to critical after LWD and asks for ID deactivation confirmation", () => {
    const alerts = alertsFor(leaving({ exitEmailSentAt: d("2026-06-20") }), d("2026-07-01"));
    expect(alerts.map((a) => [a.code, a.severity])).toEqual([
      ["CLIENT_ID_NOT_CONFIRMED", "critical"],
      ["ASSETS_NOT_RETURNED", "critical"],
    ]);
  });
  it("can close only when everything is done", () => {
    const done = leaving({ exitEmailSentAt: d("2026-06-20"), clientIdDeactivatedAt: d("2026-06-30") });
    expect(canClose(done)).toBe(false);
    done.assets = done.assets.map((a) => ({ ...a, returnedAt: d("2026-06-30") }));
    expect(canClose(done)).toBe(true);
    done.checklist = [...done.checklist, item({ phase: "OFFBOARDING" })];
    expect(canClose(done)).toBe(false);
  });
  it("returns nothing for a closed placement", () => {
    expect(codes(leaving({ closedAt: d("2026-07-01"), bgcStatus: "RED" }), "2026-07-05")).toEqual([]);
  });
});
