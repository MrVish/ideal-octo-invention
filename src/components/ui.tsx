import type { Alert } from "@/lib/lifecycle";

export function Badge({ kind, children }: { kind?: string; children: React.ReactNode }) {
  return <span className={`badge ${kind ?? ""}`}>{children}</span>;
}

export function AlertList({ alerts, empty = "Nothing pending." }: { alerts: Alert[]; empty?: string }) {
  if (!alerts.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="alerts">
      {alerts.map((a) => (
        <li key={a.code} className={a.severity}>
          {a.message}
        </li>
      ))}
    </ul>
  );
}

export function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="stat">
      <div className="n">{n}</div>
      <div className="l">{label}</div>
    </div>
  );
}
