/**
 * Seeds Intuit as the baseline client plus a second example client and a few
 * sample placements in different stages. Contacts are placeholders — replace
 * them in the Clients screen.
 */
import { PrismaClient } from "@prisma/client";
import { BASELINE_CHECKLIST } from "../src/lib/baseline";
import { addDays } from "../src/lib/dates";

const prisma = new PrismaClient();
const today = new Date();

async function createClient(name: string, opts: { contacts: string; escalation: string; locations: { name: string; spocName: string; spocEmail: string }[] }) {
  return prisma.client.create({
    data: {
      name,
      clientContactEmails: opts.contacts,
      escalationEmails: opts.escalation,
      checklistTemplates: { create: BASELINE_CHECKLIST.map((t, i) => ({ ...t, sortOrder: i })) },
      locations: { create: opts.locations },
    },
    include: { checklistTemplates: true, locations: true },
  });
}

type SeededClient = Awaited<ReturnType<typeof createClient>>;

async function place(
  client: SeededClient,
  emp: { name: string; email: string; empCode: string },
  opts: {
    startOffset: number;
    bgc?: string;
    entrySent?: boolean;
    doneSteps?: string[];
    lwdOffset?: number;
    exitSent?: boolean;
    assets?: { type: string; makeModel: string; serialNo: string }[];
  },
) {
  const employee = await prisma.employee.create({ data: emp });
  const start = addDays(today, opts.startOffset);
  const lwd = opts.lwdOffset !== undefined ? addDays(today, opts.lwdOffset) : null;
  await prisma.placement.create({
    data: {
      employeeId: employee.id,
      clientId: client.id,
      locationId: client.locations[0]?.id,
      role: "Software Engineer",
      clientEmployeeId: `${client.name.slice(0, 3).toUpperCase()}-${emp.empCode}`,
      startDate: start,
      billingStartDate: start,
      lastWorkingDay: lwd,
      billingStopDate: lwd,
      bgcStatus: opts.bgc ?? "GREEN",
      entryEmailSentAt: opts.entrySent ? addDays(start, -3) : null,
      exitEmailSentAt: opts.exitSent && lwd ? addDays(lwd, -8) : null,
      checklist: {
        create: client.checklistTemplates.map((t) => {
          const done = opts.doneSteps?.includes(t.title) ?? false;
          return {
            templateItemId: t.id,
            phase: t.phase,
            title: t.title,
            description: t.description,
            owner: t.owner,
            required: t.required,
            sortOrder: t.sortOrder,
            completedAt: done ? start : null,
            completedBy: done ? emp.name : null,
          };
        }),
      },
      assets: { create: (opts.assets ?? []).map((a) => ({ ...a, receivedAt: start })) },
    },
  });
}

async function main() {
  await prisma.reminderLog.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.placement.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.client.deleteMany();

  const intuit = await createClient("Intuit", {
    contacts: "onboarding@intuit.example.com",
    escalation: "veena@company.example.com, honey@company.example.com, raveen@company.example.com",
    // SPOC for Bangalore to be provided by Honey.
    locations: [{ name: "Bangalore", spocName: "", spocEmail: "" }],
  });
  const acme = await createClient("Acme Corp (example)", {
    contacts: "vendor-mgmt@acme.example.com",
    escalation: "hr@company.example.com",
    locations: [{ name: "Hyderabad", spocName: "Ravi K", spocEmail: "ravi.k@acme.example.com" }],
  });

  const onboardingSteps = BASELINE_CHECKLIST.filter((t) => t.phase === "ONBOARDING").map((t) => t.title);

  // Joining next week: BGC still pending, nothing done yet.
  await place(intuit, { name: "Aarav Sharma", email: "aarav.sharma@company.example.com", empCode: "E1001" }, { startOffset: 5, bgc: "PENDING" });
  // Joined recently: some steps done, assets not entered yet.
  await place(
    intuit,
    { name: "Priya Nair", email: "priya.nair@company.example.com", empCode: "E1002" },
    { startOffset: -6, entrySent: true, doneSteps: ["WFH acknowledgement", "Infosec training"] },
  );
  // Fully onboarded and active.
  await place(
    intuit,
    { name: "Rahul Verma", email: "rahul.verma@company.example.com", empCode: "E1003" },
    {
      startOffset: -120,
      entrySent: true,
      doneSteps: onboardingSteps,
      assets: [
        { type: "Laptop", makeModel: "MacBook Pro 14", serialNo: "C02XK1ABCD" },
        { type: "Security token", makeModel: "YubiKey 5", serialNo: "YK-55120" },
      ],
    },
  );
  // Leaving in 4 days: exit email not sent yet, laptop still out.
  await place(
    intuit,
    { name: "Sneha Iyer", email: "sneha.iyer@company.example.com", empCode: "E1004" },
    {
      startOffset: -300,
      entrySent: true,
      doneSteps: onboardingSteps,
      lwdOffset: 4,
      assets: [{ type: "Laptop", makeModel: "Dell Latitude 7440", serialNo: "DL-7440-9921" }],
    },
  );
  // Second client, active.
  await place(
    acme,
    { name: "Karthik Rao", email: "karthik.rao@company.example.com", empCode: "E1005" },
    { startOffset: -40, entrySent: true, doneSteps: onboardingSteps, assets: [{ type: "Laptop", makeModel: "ThinkPad T14", serialNo: "PF-3XY12" }] },
  );

  console.log("Seeded clients: Intuit (baseline), Acme Corp (example) with 5 placements");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
