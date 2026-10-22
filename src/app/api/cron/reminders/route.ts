import { NextResponse } from "next/server";
import { runReminders } from "@/lib/reminders.server";

// Call daily from a scheduler (e.g. Vercel Cron) with `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sent = await runReminders();
  return NextResponse.json({ sent });
}
