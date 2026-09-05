import { ArticleStatus, EventType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

interface LogEventInput {
  articleId: string;
  type: EventType;
  actorId: string;
  oldStatus?: ArticleStatus | null;
  newStatus?: ArticleStatus | null;
  message?: string | null;
}

/**
 * Every meaningful action on an article must go through this so the audit
 * trail is complete. Accepts an optional transaction client so callers can
 * write the event atomically alongside the article mutation it describes.
 */
export function logEvent(
  input: LogEventInput,
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  return client.articleEvent.create({
    data: {
      articleId: input.articleId,
      type: input.type,
      actorId: input.actorId,
      oldStatus: input.oldStatus ?? null,
      newStatus: input.newStatus ?? null,
      message: input.message ?? null,
    },
  });
}
