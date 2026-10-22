import Link from "next/link";
import { prisma } from "@/lib/db";
import { hrOnly } from "@/lib/viewer";
import { runRemindersNow } from "../actions";

export default async function Reminders() {
  await hrOnly();
  const logs = await prisma.reminderLog.findMany({
    include: { placement: { include: { employee: true, client: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <>
      <h1>Reminders</h1>
      <p className="subtitle">
        Reminders go to whoever has to act (employee, SPOC) with the client&apos;s escalation list in copy. Each issue is
        repeated at most once per the client&apos;s reminder interval. Schedule <code>/api/cron/reminders</code> daily;
        email delivery is log-only until a mail provider is connected.
      </p>
      <form action={runRemindersNow} className="actions" style={{ marginBottom: 16 }}>
        <button>Run reminders now</button>
      </form>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Employee</th>
              <th>Subject</th>
              <th>Recipients</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No reminders generated yet.
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="small">{l.createdAt.toLocaleString("en-GB")}</td>
                <td>
                  <Link href={`/placements/${l.placementId}`}>{l.placement.employee.name}</Link>
                  <div className="small muted">{l.placement.client.name}</div>
                </td>
                <td>
                  <details>
                    <summary>{l.subject}</summary>
                    <pre className="small" style={{ whiteSpace: "pre-wrap" }}>{l.body}</pre>
                  </details>
                </td>
                <td className="small muted">{l.recipients}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
