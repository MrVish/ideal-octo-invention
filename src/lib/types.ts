import type { Asset, ChecklistItem, Client, Employee, Location, Placement } from "@prisma/client";

export type Phase = "ONBOARDING" | "OFFBOARDING";
export type BgcStatus = "PENDING" | "GREEN" | "AMBER" | "RED";
export const BGC_STATUSES: BgcStatus[] = ["PENDING", "GREEN", "AMBER", "RED"];
export const ASSET_TYPES = ["Laptop", "Monitor", "Docking station", "Headset", "Keyboard / Mouse", "Security token", "Phone", "Other"];

export type PlacementFull = Placement & {
  employee: Employee;
  client: Client;
  location: Location | null;
  checklist: ChecklistItem[];
  assets: Asset[];
};

export const placementInclude = {
  employee: true,
  client: true,
  location: true,
  checklist: { orderBy: [{ phase: "desc" as const }, { sortOrder: "asc" as const }] },
  assets: { orderBy: { createdAt: "asc" as const } },
};
