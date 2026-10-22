import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { setViewer } from "./actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Employee Lifecycle",
  description: "Onboarding, offboarding and client asset tracking",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const employees = await prisma.employee.findMany({ orderBy: { name: "asc" } });
  const current = viewer.role === "HR" ? "hr" : `emp:${viewer.employeeId}`;

  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href={viewer.role === "HR" ? "/" : "/portal"} className="brand">
              Employee Lifecycle
            </Link>
            <nav className="nav">
              {viewer.role === "HR" ? (
                <>
                  <Link href="/">Dashboard</Link>
                  <Link href="/placements">Placements</Link>
                  <Link href="/assets">Assets</Link>
                  <Link href="/clients">Clients</Link>
                  <Link href="/reminders">Reminders</Link>
                </>
              ) : (
                <Link href="/portal">My portal</Link>
              )}
            </nav>
            <form action={setViewer} className="viewer" title="Demo sign-in — replace with SSO">
              <span className="small muted">Viewing as</span>
              <select name="viewer" defaultValue={current}>
                <option value="hr">HR team</option>
                {employees.map((e) => (
                  <option key={e.id} value={`emp:${e.id}`}>
                    {e.name}
                  </option>
                ))}
              </select>
              <button className="secondary" type="submit">
                Switch
              </button>
            </form>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
