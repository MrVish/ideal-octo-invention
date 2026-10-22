import type { ChecklistItem } from "@prisma/client";
import { addAsset, deleteAsset, setLastWorkingDay, toggleAssetReturned, toggleChecklistItem } from "@/app/actions";
import { formatDate, toDateInput } from "@/lib/dates";
import { ASSET_TYPES, type PlacementFull } from "@/lib/types";

export function Checklist({ items, isHR }: { items: ChecklistItem[]; isHR: boolean }) {
  if (!items.length) return <p className="muted">No steps configured for this client.</p>;
  return (
    <ul className="checklist">
      {items.map((i) => {
        const canToggle = isHR || i.owner === "EMPLOYEE";
        return (
          <li key={i.id}>
            <form action={toggleChecklistItem}>
              <input type="hidden" name="id" value={i.id} />
              <button
                className={`tick ${i.completedAt ? "done" : ""}`}
                disabled={!canToggle}
                title={canToggle ? (i.completedAt ? "Mark as not done" : "Mark as done") : "Completed by HR"}
                aria-label={i.title}
              >
                {i.completedAt ? "✓" : ""}
              </button>
            </form>
            <div>
              <div>
                <strong>{i.title}</strong> {!i.required && <span className="small muted">(optional)</span>}{" "}
                <span className="small muted">· {i.owner === "HR" ? "HR" : "Employee"}</span>
              </div>
              {i.description && <div className="small muted">{i.description}</div>}
              {i.completedAt && (
                <div className="small muted">
                  Done {formatDate(i.completedAt)} by {i.completedBy}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function LwdForm({ p, isHR }: { p: PlacementFull; isHR: boolean }) {
  const locked = !isHR && !!p.exitEmailSentAt;
  return (
    <form action={setLastWorkingDay} className="row">
      <input type="hidden" name="placementId" value={p.id} />
      <label>
        Last working day
        <input name="lastWorkingDay" type="date" defaultValue={toDateInput(p.lastWorkingDay)} disabled={locked} />
      </label>
      {!locked && (
        <button className="secondary" style={{ alignSelf: "end" }}>
          Save LWD
        </button>
      )}
      {locked && <span className="small muted">Exit email already sent — ask HR to change.</span>}
    </form>
  );
}

export function AssetPanel({ p, isHR }: { p: PlacementFull; isHR: boolean }) {
  const loc = p.location;
  return (
    <>
      <div className="notice small">
        <strong>Asset SPOC:</strong>{" "}
        {loc?.spocName ? (
          <>
            {loc.spocName} ({loc.name}){loc.spocEmail && <> · <a href={`mailto:${loc.spocEmail}`}>{loc.spocEmail}</a></>}
            {loc.spocPhone && <> · {loc.spocPhone}</>}
          </>
        ) : (
          <span>not assigned yet{loc ? ` for ${loc.name}` : ""}</span>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Make / model</th>
              <th>Serial no.</th>
              <th>Asset tag</th>
              <th>Received</th>
              <th>Returned</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {p.assets.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No assets recorded yet.
                </td>
              </tr>
            )}
            {p.assets.map((a) => (
              <tr key={a.id}>
                <td>{a.type}</td>
                <td>{a.makeModel || "—"}</td>
                <td>{a.serialNo || "—"}</td>
                <td>{a.assetTag || "—"}</td>
                <td>{formatDate(a.receivedAt)}</td>
                <td>{a.returnedAt ? formatDate(a.returnedAt) : <span className="badge warning">with employee</span>}</td>
                <td className="row">
                  {isHR && (
                    <form action={toggleAssetReturned}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="link">{a.returnedAt ? "Undo return" : "Mark returned"}</button>
                    </form>
                  )}
                  {(isHR || !a.returnedAt) && (
                    <form action={deleteAsset}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="link">Remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!p.closedAt && (
        <form action={addAsset} style={{ marginTop: 12 }}>
          <input type="hidden" name="placementId" value={p.id} />
          <div className="form-grid">
            <label>
              Type
              <select name="type" required>
                {ASSET_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Make / model
              <input name="makeModel" placeholder="e.g. MacBook Pro 14" />
            </label>
            <label>
              Serial no.
              <input name="serialNo" />
            </label>
            <label>
              Asset tag
              <input name="assetTag" />
            </label>
            <label>
              Received on
              <input name="receivedAt" type="date" defaultValue={toDateInput(new Date())} />
            </label>
          </div>
          <div className="actions">
            <button className="secondary">+ Add asset</button>
          </div>
        </form>
      )}
    </>
  );
}
