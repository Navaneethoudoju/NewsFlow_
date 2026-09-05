import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthTokenPayload } from "../lib/jwt";
import { articleVisibilityFilter, isEditor } from "../lib/permissions";

// Every query below is scoped through articleVisibilityFilter so a writer's
// dashboard only ever reflects what the article-listing endpoint would also
// let them see (their own articles, plus non-draft articles in sections
// they're assigned to) — never newsroom-wide numbers.
function visibleWhere(user: AuthTokenPayload, extra: Prisma.ArticleWhereInput = {}): Prisma.ArticleWhereInput {
  return { revisionOfId: null, AND: [articleVisibilityFilter(user)], ...extra };
}

export async function getSummary(user: AuthTokenPayload) {
  const now = new Date();
  const [drafts, inReview, approved, scheduled, published, overdue] = await Promise.all([
    prisma.article.count({ where: visibleWhere(user, { status: "DRAFT" }) }),
    prisma.article.count({ where: visibleWhere(user, { status: "IN_REVIEW" }) }),
    prisma.article.count({ where: visibleWhere(user, { status: "APPROVED" }) }),
    prisma.article.count({ where: visibleWhere(user, { status: "SCHEDULED" }) }),
    prisma.article.count({ where: visibleWhere(user, { status: "PUBLISHED" }) }),
    prisma.article.count({ where: visibleWhere(user, { status: "SCHEDULED", publishAt: { lt: now } }) }),
  ]);
  return { drafts, inReview, approved, scheduled, published, overdue };
}

export async function getByStatus(user: AuthTokenPayload) {
  const groups = await prisma.article.groupBy({
    by: ["status"],
    where: visibleWhere(user),
    _count: { _all: true },
  });
  return groups.map((g) => ({ status: g.status, count: g._count._all }));
}

export async function getBySection(user: AuthTokenPayload) {
  // Which sections even appear differs by role: editors see every section,
  // writers only the ones they're assigned to (so an unassigned section
  // with zero visible articles doesn't show up as a misleading zero either).
  const sections = isEditor(user)
    ? await prisma.section.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    : await prisma.section.findMany({
        where: { writers: { some: { writerId: user.id } } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

  const counts = await prisma.article.groupBy({
    by: ["sectionId"],
    where: visibleWhere(user),
    _count: { _all: true },
  });
  const countBySection = new Map(counts.map((c) => [c.sectionId, c._count._all]));

  return sections.map((s) => ({ sectionId: s.id, sectionName: s.name, count: countBySection.get(s.id) ?? 0 }));
}

/** Published-article counts for each of the last 8 (ISO-week-aligned) weeks. */
export async function getWeeklyPublished(user: AuthTokenPayload) {
  const weeks = 8;
  const now = new Date();
  const buckets: { weekStart: string; count: number }[] = [];

  const startOfWeek = (d: Date) => {
    const copy = new Date(d);
    const day = copy.getDay();
    const diff = (day + 6) % 7; // Monday-start weeks
    copy.setDate(copy.getDate() - diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };

  const earliestStart = new Date(startOfWeek(now));
  earliestStart.setDate(earliestStart.getDate() - (weeks - 1) * 7);

  const published = await prisma.article.findMany({
    where: visibleWhere(user, { status: "PUBLISHED", publishedAt: { gte: earliestStart } }),
    select: { publishedAt: true },
  });

  for (let i = 0; i < weeks; i++) {
    const ws = new Date(earliestStart);
    ws.setDate(ws.getDate() + i * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    const count = published.filter((p) => p.publishedAt && p.publishedAt >= ws && p.publishedAt < we).length;
    buckets.push({ weekStart: ws.toISOString().slice(0, 10), count });
  }

  return buckets;
}

export async function getRecentActivity(user: AuthTokenPayload, limit = 15) {
  return prisma.articleEvent.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    where: isEditor(user) ? {} : { article: articleVisibilityFilter(user) },
    include: {
      actor: { select: { id: true, name: true } },
      article: { select: { id: true, title: true } },
    },
  });
}

export async function getUpcomingPublications(user: AuthTokenPayload, limit = 10) {
  return prisma.article.findMany({
    where: visibleWhere(user, { status: "SCHEDULED" }),
    orderBy: { publishAt: "asc" },
    take: limit,
    include: {
      section: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  });
}
