import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { alertsFor, bySeverity, stageOf } from "@/lib/lifecycle";
import { placementInclude } from "@/lib/types";
import { getViewer } from "@/lib/viewer";
import { AlertList, Badge } from "@/components/ui";
import { AssetPanel, Checklist, LwdForm } from "@/components/placement";

export default async function Portal() {
  const viewer = await getViewer();
  if (viewer.role !== "EMPLOYEE") redirect("/");
  const employee = await prisma.employee.findUnique({ where: { id: viewer.employeeId } });
  if (!employee) redirect("/");
  const placements = await prisma.placement.findMany({
    where: { employeeId: employee.id, closedAt: null },
    include: placementInclude,
    orderBy: { startDate: "desc" },
  });
  const today = new Date();

  return (
    <>
      <h1>Hi {employee.name.split(" ")[0]}</h1>
      <p className="subtitle">Complete your onboarding steps, log client-issued assets, and enter your last working day when known.</p>

      {placements.length === 0 && <p className="muted">You have no active client placements.</p>}

      {placements.map((p) => {
        const mine = alertsFor(p, today).filter((a) => a.audience.includes("EMPLOYEE")).sort(bySeverity);
        const stage = stageOf(p);
        return (
          <section key={p.id}>
            <div className="row">
              <h2 style={{ margin: 0 }}>
                {p.client.name}
                {p.location ? ` — ${p.location.name}` : ""}
              </h2>
              <Badge kind={stage}>{stage.toLowerCase()}</Badge>
            </div>
            <p className="small muted">Started {formatDate(p.startDate)}{p.role ? ` · ${p.role}` : ""}</p>

            <div className="card">
              <h2>Your to-dos</h2>
              <AlertList alerts={mine} empty="You're all caught up." />
            </div>

            <div className="grid grid-2">
              <div className="card">
                <h2>Onboarding checklist</h2>
                <Checklist items={p.checklist.filter((i) => i.phase === "ONBOARDING")} isHR={false} />
              </div>
              <div className="card">
                <h2>Exit</h2>
                <LwdForm p={p} isHR={false} />
                {p.lastWorkingDay && <Checklist items={p.checklist.filter((i) => i.phase === "OFFBOARDING")} isHR={false} />}
              </div>
            </div>

            {p.client.assetTrackingEnabled && (
              <div className="card">
                <h2>Assets received from {p.client.name}</h2>
                <AssetPanel p={p} isHR={false} />
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
