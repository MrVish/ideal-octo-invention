import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { hrOnly } from "@/lib/viewer";
import { Badge } from "@/components/ui";

export default async function Assets({ searchParams }: { searchParams: Promise<{ client?: string; status?: string }> }) {
  await hrOnly();
  const { client, status } = await searchParams;
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  const assets = await prisma.asset.findMany({
    where: {
      ...(client ? { placement: { clientId: client } } : {}),
      ...(status === "returned" ? { returnedAt: { not: null } } : status === "all" ? {} : { returnedAt: null }),
    },
    include: { placement: { include: { employee: true, client: true, location: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <h1>Client asset tracker</h1>
      <p className="subtitle">Every client-issued asset, who holds it, and the SPOC it goes back to.</p>
      <form className="row" style={{ marginBottom: 16 }}>
        <select name="client" defaultValue={client ?? ""}>
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ""}>
          <option value="">With employees</option>
          <option value="returned">Returned</option>
          <option value="all">All</option>
        </select>
        <button className="secondary">Filter</button>
      </form>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Client / location</th>
              <th>Asset</th>
              <th>Serial / tag</th>
              <th>Received</th>
              <th>LWD</th>
              <th>SPOC</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  No assets match.
                </td>
              </tr>
            )}
            {assets.map((a) => {
              const p = a.placement;
              return (
                <tr key={a.id}>
                  <td>
                    <Link href={`/placements/${p.id}`}>{p.employee.name}</Link>
                  </td>
                  <td>
                    {p.client.name}
                    {p.location && <div className="small muted">{p.location.name}</div>}
                  </td>
                  <td>
                    {a.type}
                    {a.makeModel && <div className="small muted">{a.makeModel}</div>}
                  </td>
                  <td className="small">
                    {a.serialNo || "—"}
                    {a.assetTag && <div className="muted">{a.assetTag}</div>}
                  </td>
                  <td>{formatDate(a.receivedAt)}</td>
                  <td>{formatDate(p.lastWorkingDay)}</td>
                  <td>{p.location?.spocName || <span className="muted">—</span>}</td>
                  <td>{a.returnedAt ? <Badge kind="ok">returned {formatDate(a.returnedAt)}</Badge> : <Badge kind="warning">with employee</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
