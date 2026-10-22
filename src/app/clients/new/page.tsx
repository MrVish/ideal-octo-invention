import { prisma } from "@/lib/db";
import { hrOnly } from "@/lib/viewer";
import { createClient } from "../../actions";

export default async function NewClient({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await hrOnly();
  const { error } = await searchParams;
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  const intuit = clients.find((c) => c.name.toLowerCase() === "intuit");
  return (
    <>
      <h1>Add client</h1>
      <p className="subtitle">Start from an existing client&apos;s checklist (Intuit is the baseline) and adjust afterwards.</p>
      {error && <p className="notice error">{error}</p>}
      <form action={createClient} className="card">
        <div className="form-grid">
          <label>
            Client name
            <input name="name" required />
          </label>
          <label>
            Copy checklist from
            <select name="copyFrom" defaultValue={intuit?.id ?? "baseline"}>
              <option value="baseline">Standard baseline</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Client contacts for entry / exit emails
            <input name="clientContactEmails" placeholder="a@client.com, b@client.com" />
          </label>
          <label>
            Internal escalation list (cc on reminders)
            <input name="escalationEmails" placeholder="hr1@company.com, hr2@company.com" />
          </label>
          <label>
            Exit email lead time (days before LWD)
            <input name="exitEmailLeadDays" type="number" min={0} defaultValue={7} />
          </label>
          <label className="check">
            <input name="assetTrackingEnabled" type="checkbox" defaultChecked /> Track client-issued assets
          </label>
        </div>
        <div className="actions">
          <button>Create client</button>
        </div>
      </form>
    </>
  );
}
