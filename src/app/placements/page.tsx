import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { alertsFor, stageOf, type Stage } from "@/lib/lifecycle";
import { placementInclude } from "@/lib/types";
import { hrOnly } from "@/lib/viewer";
import { Badge } from "@/components/ui";

const STAGES: Stage[] = ["ONBOARDING", "ACTIVE", "OFFBOARDING", "CLOSED"];

export default async function Placements({ searchParams }: { searchParams: Promise<{ client?: string; stage?: string; q?: string }> }) {
  await hrOnly();
  const { client, stage, q } = await searchParams;
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  const all = await prisma.placement.findMany({
    where: {
      ...(client ? { clientId: client } : {}),
      ...(q ? { employee: { OR: [{ name: { contains: q } }, { empCode: { contains: q } }, { email: { contains: q } }] } } : {}),
    },
    include: placementInclude,
    orderBy: { startDate: "desc" },
  });
  const today = new Date();
  const rows = all
    .map((p) => ({ p, stage: stageOf(p), alerts: alertsFor(p, today) }))
    .filter((r) => (stage ? r.stage === stage : r.stage !== "CLOSED"));

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Placements</h1>
          <p className="subtitle">Each employee engagement at a client.</p>
        </div>
        <Link className="button" href="/placements/new">
          + New onboarding
        </Link>
      </div>

      <form className="row" style={{ marginBottom: 16 }}>
        <input name="q" placeholder="Name, code or email" defaultValue={q ?? ""} />
        <select name="client" defaultValue={client ?? ""}>
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="stage" defaultValue={stage ?? ""}>
          <option value="">All open</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase()}
            </option>
          ))}
        </select>
        <button className="secondary">Filter</button>
      </form>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Client</th>
              <th>Stage</th>
              <th>BGC</th>
              <th>Start</th>
              <th>Billing start</th>
              <th>LWD</th>
              <th>Open items</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  No placements match.
                </td>
              </tr>
            )}
            {rows.map(({ p, stage, alerts }) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/placements/${p.id}`}>{p.employee.name}</Link>
                  <div className="small muted">{p.employee.empCode}</div>
                </td>
                <td>
                  {p.client.name}
                  {p.location && <div className="small muted">{p.location.name}</div>}
                </td>
                <td>
                  <Badge kind={stage}>{stage.toLowerCase()}</Badge>
                </td>
                <td>
                  <Badge kind={p.bgcStatus}>{p.bgcStatus.toLowerCase()}</Badge>
                </td>
                <td>{formatDate(p.startDate)}</td>
                <td>{formatDate(p.billingStartDate)}</td>
                <td>{formatDate(p.lastWorkingDay)}</td>
                <td>
                  {alerts.some((a) => a.severity === "critical") ? (
                    <Badge kind="critical">{alerts.length}</Badge>
                  ) : alerts.length ? (
                    <Badge kind="warning">{alerts.length}</Badge>
                  ) : (
                    <Badge kind="ok">0</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
