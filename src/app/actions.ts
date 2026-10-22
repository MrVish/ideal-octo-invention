"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseDateInput } from "@/lib/dates";
import { BASELINE_CHECKLIST } from "@/lib/baseline";
import { canClose } from "@/lib/lifecycle";
import { runReminders } from "@/lib/reminders.server";
import { BGC_STATUSES, placementInclude } from "@/lib/types";
import { getViewer, VIEWER_COOKIE } from "@/lib/viewer";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function int(fd: FormData, key: string, fallback: number): number {
  const n = Number.parseInt(str(fd, key), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

async function requireHR() {
  const v = await getViewer();
  if (v.role !== "HR") throw new Error("Only HR can do this");
  return v;
}

/** HR may act on any placement; an employee only on their own. Returns who acted. */
async function requirePlacementAccess(placementId: string): Promise<string> {
  const v = await getViewer();
  if (v.role === "HR") return "HR";
  const p = await prisma.placement.findUnique({ where: { id: placementId }, include: { employee: true } });
  if (!p || p.employeeId !== v.employeeId) throw new Error("Not your placement");
  return p.employee.name;
}

/** A placement's location must belong to its client; anything else is treated as "not set". */
async function locationFor(clientId: string, locationId: string): Promise<string | null> {
  if (!locationId) return null;
  const loc = await prisma.location.findUnique({ where: { id: locationId } });
  return loc?.clientId === clientId ? loc.id : null;
}

/** Client names are unique, ignoring case. */
async function clientNameTaken(name: string, exceptId?: string): Promise<boolean> {
  const clients = await prisma.client.findMany({ select: { id: true, name: true } });
  return clients.some((c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase());
}

function refresh(placementId?: string) {
  revalidatePath("/", "layout");
  if (placementId) revalidatePath(`/placements/${placementId}`);
}

// ---------- Viewer (demo sign-in) ----------

export async function setViewer(fd: FormData) {
  const value = str(fd, "viewer") || "hr";
  (await cookies()).set(VIEWER_COOKIE, value, { path: "/", httpOnly: true, sameSite: "lax" });
  redirect(value.startsWith("emp:") ? "/portal" : "/");
}

// ---------- Clients ----------

export async function createClient(fd: FormData) {
  await requireHR();
  const name = str(fd, "name");
  if (!name) throw new Error("Client name is required");
  if (await clientNameTaken(name)) redirect(`/clients/new?error=${encodeURIComponent(`A client named "${name}" already exists`)}`);
  const copyFrom = str(fd, "copyFrom");

  const source =
    copyFrom && copyFrom !== "baseline"
      ? (await prisma.checklistTemplateItem.findMany({ where: { clientId: copyFrom }, orderBy: { sortOrder: "asc" } })).map(
          ({ phase, title, description, owner, required }) => ({ phase, title, description, owner, required }),
        )
      : BASELINE_CHECKLIST.map((t) => ({ ...t, required: true }));

  const client = await prisma.client.create({
    data: {
      name,
      clientContactEmails: str(fd, "clientContactEmails"),
      escalationEmails: str(fd, "escalationEmails"),
      exitEmailLeadDays: int(fd, "exitEmailLeadDays", 7),
      assetTrackingEnabled: fd.get("assetTrackingEnabled") === "on",
      checklistTemplates: { create: source.map((t, i) => ({ ...t, sortOrder: i })) },
    },
  });
  refresh();
  redirect(`/clients/${client.id}`);
}

export async function updateClient(fd: FormData) {
  await requireHR();
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!name || (await clientNameTaken(name, id))) {
    redirect(`/clients/${id}?error=${encodeURIComponent(name ? `A client named "${name}" already exists` : "Client name is required")}`);
  }
  await prisma.client.update({
    where: { id },
    data: {
      name,
      active: fd.get("active") === "on",
      clientContactEmails: str(fd, "clientContactEmails"),
      escalationEmails: str(fd, "escalationEmails"),
      exitEmailLeadDays: int(fd, "exitEmailLeadDays", 7),
      assetTrackingEnabled: fd.get("assetTrackingEnabled") === "on",
      assetEntryGraceDays: int(fd, "assetEntryGraceDays", 3),
      reminderIntervalDays: Math.max(1, int(fd, "reminderIntervalDays", 2)),
    },
  });
  refresh();
}

export async function addTemplateItem(fd: FormData) {
  await requireHR();
  const clientId = str(fd, "clientId");
  const title = str(fd, "title");
  if (!title) return;
  const count = await prisma.checklistTemplateItem.count({ where: { clientId } });
  await prisma.checklistTemplateItem.create({
    data: {
      clientId,
      title,
      description: str(fd, "description"),
      phase: str(fd, "phase") === "OFFBOARDING" ? "OFFBOARDING" : "ONBOARDING",
      owner: str(fd, "owner") === "HR" ? "HR" : "EMPLOYEE",
      required: fd.get("required") === "on",
      sortOrder: count,
    },
  });
  refresh();
}

export async function deleteTemplateItem(fd: FormData) {
  await requireHR();
  await prisma.checklistTemplateItem.delete({ where: { id: str(fd, "id") } });
  refresh();
}

export async function saveLocation(fd: FormData) {
  await requireHR();
  const id = str(fd, "id");
  const data = { name: str(fd, "name"), spocName: str(fd, "spocName"), spocEmail: str(fd, "spocEmail"), spocPhone: str(fd, "spocPhone") };
  if (!data.name) return;
  if (id) await prisma.location.update({ where: { id }, data });
  else await prisma.location.create({ data: { ...data, clientId: str(fd, "clientId") } });
  refresh();
}

export async function deleteLocation(fd: FormData) {
  await requireHR();
  const id = str(fd, "id");
  await prisma.placement.updateMany({ where: { locationId: id }, data: { locationId: null } });
  await prisma.location.delete({ where: { id } });
  refresh();
}

// ---------- Placements ----------

export async function createPlacement(fd: FormData) {
  await requireHR();
  const clientId = str(fd, "clientId");
  const startDate = parseDateInput(fd.get("startDate"));
  if (!clientId || !startDate) throw new Error("Client and start date are required");

  let employeeId = str(fd, "employeeId");
  if (!employeeId) {
    const name = str(fd, "newName");
    const email = str(fd, "newEmail").toLowerCase();
    const empCode = str(fd, "newEmpCode");
    if (!name || !email || !empCode) throw new Error("Pick an employee or enter name, email and employee code");
    const emp = await prisma.employee.upsert({ where: { email }, update: {}, create: { name, email, empCode } });
    employeeId = emp.id;
  }

  const template = await prisma.checklistTemplateItem.findMany({ where: { clientId }, orderBy: { sortOrder: "asc" } });
  const bgc = str(fd, "bgcStatus");
  const placement = await prisma.placement.create({
    data: {
      employeeId,
      clientId,
      locationId: await locationFor(clientId, str(fd, "locationId")),
      role: str(fd, "role"),
      clientEmployeeId: str(fd, "clientEmployeeId"),
      startDate,
      billingStartDate: parseDateInput(fd.get("billingStartDate")) ?? startDate,
      bgcStatus: BGC_STATUSES.includes(bgc as never) ? bgc : "PENDING",
      checklist: {
        create: template.map((t) => ({
          templateItemId: t.id,
          phase: t.phase,
          title: t.title,
          description: t.description,
          owner: t.owner,
          required: t.required,
          sortOrder: t.sortOrder,
        })),
      },
    },
  });
  refresh();
  redirect(`/placements/${placement.id}`);
}

export async function updatePlacement(fd: FormData) {
  await requireHR();
  const id = str(fd, "id");
  const bgc = str(fd, "bgcStatus");
  const lwd = parseDateInput(fd.get("lastWorkingDay"));
  const { clientId } = await prisma.placement.findUniqueOrThrow({ where: { id } });
  await prisma.placement.update({
    where: { id },
    data: {
      role: str(fd, "role"),
      clientEmployeeId: str(fd, "clientEmployeeId"),
      locationId: await locationFor(clientId, str(fd, "locationId")),
      startDate: parseDateInput(fd.get("startDate")) ?? undefined,
      billingStartDate: parseDateInput(fd.get("billingStartDate")),
      lastWorkingDay: lwd,
      billingStopDate: parseDateInput(fd.get("billingStopDate")) ?? lwd,
      bgcStatus: BGC_STATUSES.includes(bgc as never) ? bgc : undefined,
    },
  });
  refresh(id);
}

/** Employees enter their own LWD so asset return can be tracked; billing stop defaults to it. */
export async function setLastWorkingDay(fd: FormData) {
  const id = str(fd, "placementId");
  await requirePlacementAccess(id);
  const lwd = parseDateInput(fd.get("lastWorkingDay"));
  const current = await prisma.placement.findUniqueOrThrow({ where: { id } });
  if (current.exitEmailSentAt && (await getViewer()).role !== "HR") {
    throw new Error("Exit email already sent to client — ask HR to change the LWD");
  }
  await prisma.placement.update({
    where: { id },
    data: { lastWorkingDay: lwd, billingStopDate: current.billingStopDate ?? lwd },
  });
  refresh(id);
}

const MILESTONES = {
  entryEmail: "entryEmailSentAt",
  exitEmail: "exitEmailSentAt",
  clientIdDeactivated: "clientIdDeactivatedAt",
} as const;

export async function toggleMilestone(fd: FormData) {
  await requireHR();
  const id = str(fd, "placementId");
  const field = MILESTONES[str(fd, "milestone") as keyof typeof MILESTONES];
  if (!field) throw new Error("Unknown milestone");
  const p = await prisma.placement.findUniqueOrThrow({ where: { id } });
  await prisma.placement.update({ where: { id }, data: { [field]: p[field] ? null : new Date() } });
  refresh(id);
}

export async function toggleChecklistItem(fd: FormData) {
  const item = await prisma.checklistItem.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  const actor = await requirePlacementAccess(item.placementId);
  if (actor !== "HR" && item.owner !== "EMPLOYEE") throw new Error("This step is completed by HR");
  await prisma.checklistItem.update({
    where: { id: item.id },
    data: item.completedAt ? { completedAt: null, completedBy: null } : { completedAt: new Date(), completedBy: actor },
  });
  refresh(item.placementId);
}

export async function closePlacement(fd: FormData) {
  await requireHR();
  const id = str(fd, "placementId");
  const p = await prisma.placement.findUniqueOrThrow({ where: { id }, include: placementInclude });
  if (!canClose(p)) throw new Error("Offboarding is not complete yet");
  await prisma.placement.update({ where: { id }, data: { closedAt: new Date() } });
  refresh(id);
}

// ---------- Assets ----------

export async function addAsset(fd: FormData) {
  const placementId = str(fd, "placementId");
  await requirePlacementAccess(placementId);
  const type = str(fd, "type");
  if (!type) return;
  await prisma.asset.create({
    data: {
      placementId,
      type,
      makeModel: str(fd, "makeModel"),
      serialNo: str(fd, "serialNo"),
      assetTag: str(fd, "assetTag"),
      receivedAt: parseDateInput(fd.get("receivedAt")) ?? new Date(),
      notes: str(fd, "notes"),
    },
  });
  refresh(placementId);
}

export async function deleteAsset(fd: FormData) {
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  const actor = await requirePlacementAccess(asset.placementId);
  if (actor !== "HR" && asset.returnedAt) throw new Error("Returned assets can only be changed by HR");
  await prisma.asset.delete({ where: { id: asset.id } });
  refresh(asset.placementId);
}

/** Return is confirmed by HR once the SPOC has the asset back. */
export async function toggleAssetReturned(fd: FormData) {
  await requireHR();
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: str(fd, "id") } });
  await prisma.asset.update({ where: { id: asset.id }, data: { returnedAt: asset.returnedAt ? null : new Date() } });
  refresh(asset.placementId);
}

// ---------- Reminders ----------

export async function runRemindersNow() {
  await requireHR();
  await runReminders();
  refresh();
  redirect("/reminders");
}
