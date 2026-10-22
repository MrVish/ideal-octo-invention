import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { hrOnly } from "@/lib/viewer";
import { addTemplateItem, deleteLocation, deleteTemplateItem, saveLocation, updateClient } from "../../actions";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  await hrOnly();
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: { checklistTemplates: { orderBy: [{ phase: "desc" }, { sortOrder: "asc" }] }, locations: { orderBy: { name: "asc" } } },
  });
  if (!client) notFound();

  return (
    <>
      <p className="small">
        <Link href="/clients">← Clients</Link>
      </p>
      <h1>{client.name}</h1>
      <p className="subtitle">Changes to the checklist apply to new placements; existing placements keep their own copy.</p>

      <div className="card">
        <h2>Settings</h2>
        <form action={updateClient}>
          <input type="hidden" name="id" value={client.id} />
          <div className="form-grid">
            <label>
              Name
              <input name="name" defaultValue={client.name} required />
            </label>
            <label>
              Client contacts (entry / exit emails)
              <input name="clientContactEmails" defaultValue={client.clientContactEmails} />
            </label>
            <label>
              Escalation list (cc on reminders)
              <input name="escalationEmails" defaultValue={client.escalationEmails} />
            </label>
            <label>
              Exit email lead (days before LWD)
              <input name="exitEmailLeadDays" type="number" min={0} defaultValue={client.exitEmailLeadDays} />
            </label>
            <label>
              Asset entry grace (days after start)
              <input name="assetEntryGraceDays" type="number" min={0} defaultValue={client.assetEntryGraceDays} />
            </label>
            <label>
              Reminder interval (days)
              <input name="reminderIntervalDays" type="number" min={1} defaultValue={client.reminderIntervalDays} />
            </label>
            <label className="check">
              <input name="assetTrackingEnabled" type="checkbox" defaultChecked={client.assetTrackingEnabled} /> Track client assets
            </label>
            <label className="check">
              <input name="active" type="checkbox" defaultChecked={client.active} /> Active
            </label>
          </div>
          <div className="actions">
            <button>Save settings</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Checklist template</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Phase</th>
                <th>Step</th>
                <th>Done by</th>
                <th>Required</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {client.checklistTemplates.map((t) => (
                <tr key={t.id}>
                  <td className="small">{t.phase.toLowerCase()}</td>
                  <td>
                    {t.title}
                    {t.description && <div className="small muted">{t.description}</div>}
                  </td>
                  <td>{t.owner === "HR" ? "HR" : "Employee"}</td>
                  <td>{t.required ? "Yes" : "No"}</td>
                  <td>
                    <form action={deleteTemplateItem}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="link">Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={addTemplateItem} style={{ marginTop: 12 }}>
          <input type="hidden" name="clientId" value={client.id} />
          <div className="form-grid">
            <label>
              Phase
              <select name="phase">
                <option value="ONBOARDING">Onboarding</option>
                <option value="OFFBOARDING">Offboarding</option>
              </select>
            </label>
            <label>
              Step
              <input name="title" required />
            </label>
            <label>
              Description
              <input name="description" />
            </label>
            <label>
              Done by
              <select name="owner">
                <option value="EMPLOYEE">Employee</option>
                <option value="HR">HR</option>
              </select>
            </label>
            <label className="check">
              <input name="required" type="checkbox" defaultChecked /> Required
            </label>
          </div>
          <div className="actions">
            <button className="secondary">+ Add step</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Locations &amp; asset SPOCs</h2>
        <div className="grid">
          {client.locations.map((l) => (
            <div key={l.id} className="row">
              <LocationForm clientId={client.id} location={l} />
              <form action={deleteLocation}>
                <input type="hidden" name="id" value={l.id} />
                <button className="link">Remove</button>
              </form>
            </div>
          ))}
          <LocationForm clientId={client.id} />
        </div>
      </div>
    </>
  );
}

function LocationForm({
  clientId,
  location,
}: {
  clientId: string;
  location?: { id: string; name: string; spocName: string; spocEmail: string; spocPhone: string };
}) {
  return (
    <form action={saveLocation} className="row" style={{ alignItems: "end" }}>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="id" value={location?.id ?? ""} />
      <label>
        Location
        <input name="name" defaultValue={location?.name} required placeholder="e.g. Bangalore" />
      </label>
      <label>
        SPOC name
        <input name="spocName" defaultValue={location?.spocName} />
      </label>
      <label>
        SPOC email
        <input name="spocEmail" type="email" defaultValue={location?.spocEmail} />
      </label>
      <label>
        SPOC phone
        <input name="spocPhone" defaultValue={location?.spocPhone} />
      </label>
      <button className="secondary">{location ? "Save" : "+ Add location"}</button>
    </form>
  );
}
