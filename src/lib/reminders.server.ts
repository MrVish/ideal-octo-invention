import { prisma } from "./db";
import { addDays } from "./dates";
import { buildReminders, logOnlyMailer, type Mailer } from "./reminders";
import { placementInclude } from "./types";

export async function runReminders(now = new Date(), mailer: Mailer = logOnlyMailer) {
  const placements = await prisma.placement.findMany({
    where: { closedAt: null, client: { active: true } },
    include: placementInclude,
  });
  const recentLogs = await prisma.reminderLog.findMany({ where: { createdAt: { gte: addDays(now, -31) } } });
  const messages = buildReminders(placements, recentLogs, now);
  for (const m of messages) {
    await mailer.send(m);
    await prisma.reminderLog.create({
      data: { placementId: m.placementId, alertCode: m.alertCode, recipients: m.recipients.join(", "), subject: m.subject, body: m.body },
    });
  }
  return messages.length;
}
