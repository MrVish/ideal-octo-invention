import Link from "next/link";
import { prisma } from "@/lib/db";
import { hrOnly } from "@/lib/viewer";
import { Badge } from "@/components/ui";

export default async function Clients() {
  await hrOnly();
  const clients = await prisma.client.findMany({
    include: { _count: { select: { placements: { where: { closedAt: null } }, checklistTemplates: true, locations: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Clients</h1>
          <p className="subtitle">Each client has its own checklist, locations / asset SPOCs, contacts and reminder rules.</p>
        </div>
        <Link className="button" href="/clients/new">
          + Add client
        </Link>
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Open placements</th>
              <th>Checklist steps</th>
              <th>Locations</th>
              <th>Asset tracking</th>
              <th>Exit email lead</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/clients/${c.id}`}>{c.name}</Link> {!c.active && <Badge>inactive</Badge>}
                </td>
                <td>{c._count.placements}</td>
                <td>{c._count.checklistTemplates}</td>
                <td>{c._count.locations}</td>
                <td>{c.assetTrackingEnabled ? "On" : "Off"}</td>
                <td>{c.exitEmailLeadDays} days</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
