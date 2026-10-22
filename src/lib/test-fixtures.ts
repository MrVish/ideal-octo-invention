import type { ChecklistItem } from "@prisma/client";
import type { PlacementFull } from "./types";

export const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

let seq = 0;
export function item(over: Partial<ChecklistItem> = {}): ChecklistItem {
  seq += 1;
  return {
    id: `i${seq}`, placementId: "p1", templateItemId: null, phase: "ONBOARDING", title: `Step ${seq}`,
    description: "", owner: "EMPLOYEE", required: true, sortOrder: seq, completedAt: null, completedBy: null, note: "",
    ...over,
  };
}

/** A fully onboarded, active placement that started on 2026-01-01; override to create problems. */
export function placement(over: Partial<PlacementFull> = {}): PlacementFull {
  return {
    id: "p1", employeeId: "e1", clientId: "c1", locationId: "l1", role: "", clientEmployeeId: "INT-1",
    startDate: d("2026-01-01"), billingStartDate: d("2026-01-01"), lastWorkingDay: null, billingStopDate: null,
    bgcStatus: "GREEN", entryEmailSentAt: d("2025-12-28"), exitEmailSentAt: null, clientIdDeactivatedAt: null,
    closedAt: null, createdAt: d("2025-12-20"),
    employee: { id: "e1", empCode: "E1", name: "Priya Nair", email: "priya@co.test", createdAt: d("2025-12-20") },
    client: {
      id: "c1", name: "Intuit", active: true, clientContactEmails: "onb@intuit.test",
      escalationEmails: "veena@co.test, honey@co.test, raveen@co.test", exitEmailLeadDays: 7,
      assetTrackingEnabled: true, assetEntryGraceDays: 3, reminderIntervalDays: 2, createdAt: d("2025-01-01"),
    },
    location: { id: "l1", clientId: "c1", name: "Bangalore", spocName: "Spoc Person", spocEmail: "spoc@intuit.test", spocPhone: "" },
    checklist: [item({ completedAt: d("2026-01-01") })],
    assets: [{
      id: "a1", placementId: "p1", type: "Laptop", makeModel: "", serialNo: "SN1", assetTag: "",
      receivedAt: d("2026-01-01"), returnedAt: null, notes: "", createdAt: d("2026-01-01"),
    }],
    ...over,
  };
}
