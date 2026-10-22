import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDate, toDateInput } from "@/lib/dates";
import { entryEmail, exitEmail, mailtoHref, type EmailDraft } from "@/lib/emails";
import { alertsFor, bySeverity, canClose, stageOf } from "@/lib/lifecycle";
import { BGC_STATUSES, placementInclude } from "@/lib/types";
import { hrOnly } from "@/lib/viewer";
import { AlertList, Badge } from "@/components/ui";
import { AssetPanel, Checklist, LwdForm } from "@/components/placement";
import { closePlacement, toggleMilestone, updatePlacement } from "../../actions";

export default async function PlacementPage({ params }: { params: Promise<{ id: string }> }) {
  await hrOnly();
  const { id } = await params;
  const p = await prisma.placement.findUnique({ where: { id }, include: placementInclude });
  if (!p) notFound();
  const locations = await prisma.location.findMany({ where: { clientId: p.clientId }, orderBy: { name: "asc" } });
  const reminders = await prisma.reminderLog.findMany({ where: { placementId: id }, orderBy: { createdAt: "desc" }, take: 10 });

  const stage = stageOf(p);
  const alerts = alertsFor(p, new Date()).sort(bySeverity);
  const onboarding = p.checklist.filter((i) => i.phase === "ONBOARDING");
  const offboarding = p.checklist.filter((i) => i.phase === "OFFBOARDING");

  return (
    <>
      <p className="small">
        <Link href="/placements">← Placements</Link>
      </p>
      <div className="row">
        <h1>{p.employee.name}</h1>
        <Badge kind={stage}>{stage.toLowerCase()}</Badge>
      </div>
      <p className="subtitle">
        {p.employee.empCode} · {p.employee.email} · {p.client.name}
        {p.location ? ` — ${p.location.name}` : ""}
        {p.role ? ` · ${p.role}` : ""}
      </p>

      <div className="card">
        <h2>Open items</h2>
        <AlertList alerts={alerts} empty={p.closedAt ? `Closed on ${formatDate(p.closedAt)}.` : "Nothing pending."} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Onboarding</h2>
          <div className="milestone">
            <span>Background check</span>
            <Badge kind={p.bgcStatus}>{p.bgcStatus.toLowerCase()}</Badge>
          </div>
          <Checklist items={onboarding} isHR />
          <h3>Client entry email</h3>
          <Milestone
            placementId={p.id}
            milestone="entryEmail"
            label="Entry email (onboarding + billing start)"
            doneAt={p.entryEmailSentAt}
            doneLabel="Sent"
            actionLabel="Mark sent"
          />
          <EmailDraftView draft={entryEmail(p)} />
        </div>

        <div className="card">
          <h2>Offboarding</h2>
          <LwdForm p={p} isHR />
          <div className="milestone">
            <span>Billing stop date</span>
            <span>{formatDate(p.billingStopDate)}</span>
          </div>
          <Checklist items={offboarding} isHR />
          <h3>Client exit email</h3>
          <Milestone
            placementId={p.id}
            milestone="exitEmail"
            label={`Exit email (≥ ${p.client.exitEmailLeadDays} days before LWD)`}
            doneAt={p.exitEmailSentAt}
            doneLabel="Sent"
            actionLabel="Mark sent"
          />
          <Milestone
            placementId={p.id}
            milestone="clientIdDeactivated"
            label={`Client ID deactivated${p.clientEmployeeId ? ` (${p.clientEmployeeId})` : ""}`}
            doneAt={p.clientIdDeactivatedAt}
            doneLabel="Confirmed"
            actionLabel="Confirm"
            disabled={!p.exitEmailSentAt}
          />
          {p.lastWorkingDay ? <EmailDraftView draft={exitEmail(p)} /> : <p className="small muted">Set the LWD to draft the exit email.</p>}
          {p.lastWorkingDay && !p.closedAt && (
            <form action={closePlacement} className="actions">
              <input type="hidden" name="placementId" value={p.id} />
              <button disabled={!canClose(p)} title="Needs exit email, ID deactivation, offboarding steps and all assets returned">
                Close placement
              </button>
            </form>
          )}
        </div>
      </div>

      {p.client.assetTrackingEnabled && (
        <div className="card">
          <h2>Client assets</h2>
          <AssetPanel p={p} isHR />
        </div>
      )}

      <div className="card">
        <h2>Placement details</h2>
        <form action={updatePlacement}>
          <input type="hidden" name="id" value={p.id} />
          <div className="form-grid">
            <label>
              Role
              <input name="role" defaultValue={p.role} />
            </label>
            <label>
              Client ID / login
              <input name="clientEmployeeId" defaultValue={p.clientEmployeeId} />
            </label>
            <label>
              Location
              <select name="locationId" defaultValue={p.locationId ?? ""}>
                <option value="">— Not set —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              BGC status
              <select name="bgcStatus" defaultValue={p.bgcStatus}>
                {BGC_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Start date
              <input name="startDate" type="date" defaultValue={toDateInput(p.startDate)} />
            </label>
            <label>
              Billing start date
              <input name="billingStartDate" type="date" defaultValue={toDateInput(p.billingStartDate)} />
            </label>
            <label>
              Last working day
              <input name="lastWorkingDay" type="date" defaultValue={toDateInput(p.lastWorkingDay)} />
            </label>
            <label>
              Billing stop date
              <input name="billingStopDate" type="date" defaultValue={toDateInput(p.billingStopDate)} />
            </label>
          </div>
          <div className="actions">
            <button>Save details</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Reminders sent</h2>
        {reminders.length === 0 ? (
          <p className="muted">None yet.</p>
        ) : (
          <table>
            <tbody>
              {reminders.map((r) => (
                <tr key={r.id}>
                  <td className="small">{formatDate(r.createdAt)}</td>
                  <td>{r.subject}</td>
                  <td className="small muted">{r.recipients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Milestone(props: {
  placementId: string;
  milestone: string;
  label: string;
  doneAt: Date | null;
  doneLabel: string;
  actionLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="milestone">
      <span>
        {props.label}
        {props.doneAt && (
          <span className="small muted">
            {" "}
            — {props.doneLabel.toLowerCase()} {formatDate(props.doneAt)}
          </span>
        )}
      </span>
      <form action={toggleMilestone}>
        <input type="hidden" name="placementId" value={props.placementId} />
        <input type="hidden" name="milestone" value={props.milestone} />
        {props.doneAt ? (
          <button className="link">Undo</button>
        ) : (
          <button className="secondary" disabled={props.disabled}>
            {props.actionLabel}
          </button>
        )}
      </form>
    </div>
  );
}

function EmailDraftView({ draft }: { draft: EmailDraft }) {
  return (
    <details style={{ marginTop: 8 }}>
      <summary className="small">Preview email draft</summary>
      <p className="small">
        <strong>To:</strong> {draft.to.join(", ") || <em>no client contacts configured</em>}
        <br />
        <strong>Cc:</strong> {draft.cc.join(", ") || "—"}
        <br />
        <strong>Subject:</strong> {draft.subject}
      </p>
      <textarea readOnly defaultValue={draft.body} style={{ width: "100%" }} />
      <div className="actions">
        <a className="button secondary" href={mailtoHref(draft)}>
          Open in mail app
        </a>
      </div>
    </details>
  );
}
