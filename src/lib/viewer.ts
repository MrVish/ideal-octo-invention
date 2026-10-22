import { cookies } from "next/headers";

/**
 * Demo sign-in: the current viewer is chosen from the header and kept in a cookie.
 * Replace with company SSO before real use.
 */
export type Viewer = { role: "HR" } | { role: "EMPLOYEE"; employeeId: string };

export const VIEWER_COOKIE = "viewer";

export async function getViewer(): Promise<Viewer> {
  const v = (await cookies()).get(VIEWER_COOKIE)?.value;
  if (v?.startsWith("emp:")) return { role: "EMPLOYEE", employeeId: v.slice(4) };
  return { role: "HR" };
}

/** For HR-only pages: employees are sent to their portal. */
export async function hrOnly() {
  const { redirect } = await import("next/navigation");
  if ((await getViewer()).role !== "HR") redirect("/portal");
}
