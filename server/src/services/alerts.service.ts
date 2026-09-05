import { prisma } from "../lib/prisma";
import { logEvent } from "./history.service";
import { AuthTokenPayload } from "../lib/jwt";
import { AppError } from "../lib/errors";

/**
 * A scheduled article is overdue when its publishAt has passed. Alerts are
 * keyed on (articleId, publishAt) rather than a one-time boolean on the
 * article, so if it's unpublished and rescheduled to a new time, that new
 * time can alert again even though the old one was dismissed.
 */
export async function listOverdueAlerts() {
  const now = new Date();
  const overdue = await prisma.article.findMany({
    where: { status: "SCHEDULED", publishAt: { lt: now } },
    include: {
      section: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
      dismissedAlerts: true,
    },
    orderBy: { publishAt: "asc" },
  });

  return overdue
    .filter((a) => a.publishAt && !a.dismissedAlerts.some((d) => d.scheduledAt.getTime() === a.publishAt!.getTime()))
    .map((a) => ({
      articleId: a.id,
      title: a.title,
      section: a.section,
      author: a.author,
      scheduledAt: a.publishAt,
      overdueMs: now.getTime() - a.publishAt!.getTime(),
    }));
}

export async function dismissAlert(user: AuthTokenPayload, articleId: string) {
  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article) throw AppError.notFound("Article not found.");
  if (article.status !== "SCHEDULED" || !article.publishAt) {
    throw AppError.conflict("This article does not have an active overdue alert.");
  }

  return prisma.$transaction(async (tx) => {
    const dismissed = await tx.dismissedAlert.upsert({
      where: { articleId_scheduledAt: { articleId, scheduledAt: article.publishAt! } },
      update: {},
      create: { articleId, scheduledAt: article.publishAt!, dismissedById: user.id },
    });
    await logEvent({ articleId, type: "ALERT_DISMISSED", actorId: user.id, message: "Overdue alert dismissed." }, tx);
    return dismissed;
  });
}
