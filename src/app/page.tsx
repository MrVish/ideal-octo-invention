import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { alertsFor, bySeverity, stageOf } from "@/lib/lifecycle";
import { placementInclude, type PlacementFull } from "@/lib/types";
import { hrOnly } from "@/lib/viewer";
import { Badge, Stat } from "@/components/ui";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  await hrOnly();
  const { client: clientFilter } = await searchParams;
  const clients = await prisma.client.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const placements = await prisma.placement.findMany({
    where: { closedAt: null, ...(clientFilter ? { clientId: clientFilter } : {}) },
    include: placementInclude,
    orderBy: { startDate: "desc" },
  });

  const today = new Date();
  const rows = placements.map((p) => ({ p, stage: stageOf(p), alerts: alertsFor(p, today) }));
  const actions = rows
    .flatMap(({ p, alerts }) => alerts.filter((a) => a.severity !== "info").map((a) => ({ ...a, p })))
    .sort(bySeverity);
  const count = (s: string) => rows.filter((r) => r.stage === s).length;
  const assetsOut = placements.flatMap((p) => p.assets).filter((a) => !a.returnedAt).length;

  return (
    <>
      <h1>HR dashboard</h1>
      <p className="subtitle">What needs attention across onboarding, offboarding and client assets.</p>

      <form className="row" style={{ marginBottom: 16 }}>
        <select name="client" defaultValue={clientFilter ?? ""}>
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="secondary">Filter</button>
      </form>

      <div className="stats">
        <Stat n={count("ONBOARDING")} label="Onboarding" />
        <Stat n={count("ACTIVE")} label="Active" />
        <Stat n={count("OFFBOARDING")} label="Offboarding" />
        <Stat n={actions.filter((a) => a.severity === "critical").length} label="Critical actions" />
        <Stat n={assetsOut} label="Client assets with employees" />
      </div>

      <div className="card">
        <h2>Action items ({actions.length})</h2>
        {actions.length === 0 ? (
          <p className="muted">All clear.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Employee</th>
                  <th>Client</th>
                  <th>Action</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={`${a.p.id}-${a.code}`}>
                    <td>
                      <Badge kind={a.severity}>{a.severity}</Badge>
                    </td>
                    <td>
                      <Link href={`/placements/${a.p.id}`}>{a.p.employee.name}</Link>
                    </td>
                    <td>{a.p.client.name}</td>
                    <td>{a.message}</td>
                    <td className="small muted">{a.audience.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Upcoming exits</h2>
        <UpcomingExits rows={rows.filter((r) => r.p.lastWorkingDay)} />
      </div>
    </>
  );
}

function UpcomingExits({ rows }: { rows: { p: PlacementFull }[] }) {
  if (!rows.length) return <p className="muted">No last working days recorded.</p>;
  const sorted = [...rows].sort((a, b) => a.p.lastWorkingDay!.getTime() - b.p.lastWorkingDay!.getTime());
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Client</th>
            <th>LWD</th>
            <th>Billing stop</th>
            <th>Exit email</th>
            <th>Client ID off</th>
            <th>Assets out</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ p }) => (
            <tr key={p.id}>
              <td>
                <Link href={`/placements/${p.id}`}>{p.employee.name}</Link>
              </td>
              <td>{p.client.name}</td>
              <td>{formatDate(p.lastWorkingDay)}</td>
              <td>{formatDate(p.billingStopDate)}</td>
              <td>{p.exitEmailSentAt ? <Badge kind="ok">sent</Badge> : <Badge kind="warning">not sent</Badge>}</td>
              <td>{p.clientIdDeactivatedAt ? <Badge kind="ok">confirmed</Badge> : <Badge>pending</Badge>}</td>
              <td>{p.assets.filter((a) => !a.returnedAt).length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
