import Link from "next/link";
import { prisma } from "@/lib/db";
import { toDateInput } from "@/lib/dates";
import { BGC_STATUSES } from "@/lib/types";
import { hrOnly } from "@/lib/viewer";
import { createPlacement } from "../../actions";

export default async function NewPlacement() {
  await hrOnly();
  const [clients, employees] = await Promise.all([
    prisma.client.findMany({ where: { active: true }, include: { locations: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <h1>New onboarding</h1>
      <p className="subtitle">
        Creates a placement and copies the client&apos;s onboarding and offboarding checklist onto it.
      </p>
      {clients.length === 0 ? (
        <p>
          No active clients yet — <Link href="/clients/new">add a client</Link> first.
        </p>
      ) : (
        <form action={createPlacement} className="card">
          <h2>Employee</h2>
          <div className="form-grid">
            <label>
              Existing employee
              <select name="employeeId" defaultValue="">
                <option value="">— New employee (fill below) —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.empCode})
                  </option>
                ))}
              </select>
            </label>
            <label>
              New: full name
              <input name="newName" />
            </label>
            <label>
              New: email
              <input name="newEmail" type="email" />
            </label>
            <label>
              New: employee code
              <input name="newEmpCode" />
            </label>
          </div>

          <h2 style={{ marginTop: 20 }}>Placement</h2>
          <div className="form-grid">
            <label>
              Client
              <select name="clientId" required>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Location (asset SPOC)
              <select name="locationId" defaultValue="">
                <option value="">— Not set —</option>
                {clients.flatMap((c) =>
                  c.locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {c.name} — {l.name}
                      {l.spocName ? ` (SPOC: ${l.spocName})` : ""}
                    </option>
                  )),
                )}
              </select>
            </label>
            <label>
              Role
              <input name="role" />
            </label>
            <label>
              Client ID / login
              <input name="clientEmployeeId" />
            </label>
            <label>
              Start date
              <input name="startDate" type="date" required defaultValue={toDateInput(new Date())} />
            </label>
            <label>
              Billing start date
              <input name="billingStartDate" type="date" />
            </label>
            <label>
              BGC status
              <select name="bgcStatus" defaultValue="PENDING">
                {BGC_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="small muted">Billing start defaults to the start date if left empty.</p>
          <div className="actions">
            <button type="submit">Create placement</button>
          </div>
        </form>
      )}
    </>
  );
}
