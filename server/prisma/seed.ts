import { PrismaClient, Role, ArticleStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertUser(email: string, name: string, role: Role) {
  const passwordHash = await bcrypt.hash("password123", 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role, passwordHash },
  });
}

async function main() {
  // --- Users ---
  const editor1 = await upsertUser("editor1@demo.com", "Priya Nair", Role.EDITOR);
  const editor2 = await upsertUser("editor2@demo.com", "Marcus Lee", Role.EDITOR);
  const writer1 = await upsertUser("writer1@demo.com", "Asha Rao", Role.WRITER);
  const writer2 = await upsertUser("writer2@demo.com", "Devon Clarke", Role.WRITER);
  const writer3 = await upsertUser("writer3@demo.com", "Farah Ahmed", Role.WRITER);
  const writer4 = await upsertUser("writer4@demo.com", "Ken Osei", Role.WRITER);

  console.log("Seeded users. Demo password for all: password123");

  // --- Sections ---
  const sectionDefs = [
    { name: "Politics", description: "National and state politics", owner: editor1, writers: [writer1, writer2] },
    { name: "Culture", description: "Arts, film, and society", owner: editor1, writers: [writer2, writer3] },
    { name: "Tech", description: "Technology and industry news", owner: editor2, writers: [writer3, writer4] },
    { name: "Sports", description: "Sports coverage", owner: editor2, writers: [writer1, writer4] },
  ];

  const sections = [];
  for (const def of sectionDefs) {
    const section = await prisma.section.upsert({
      where: { id: `seed-${def.name.toLowerCase()}` },
      update: {},
      create: {
        id: `seed-${def.name.toLowerCase()}`,
        name: def.name,
        description: def.description,
        ownerEditorId: def.owner.id,
      },
    });
    for (const w of def.writers) {
      await prisma.sectionWriter.upsert({
        where: { sectionId_writerId: { sectionId: section.id, writerId: w.id } },
        update: {},
        create: { sectionId: section.id, writerId: w.id },
      });
    }
    sections.push({ ...section, writers: def.writers });
  }

  console.log(`Seeded ${sections.length} sections.`);

  // --- Articles across every status, including some overdue-to-publish cases ---
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const statuses: { status: ArticleStatus; publishAt: Date | null }[] = [
    { status: ArticleStatus.DRAFT, publishAt: null },
    { status: ArticleStatus.IN_REVIEW, publishAt: null },
    { status: ArticleStatus.APPROVED, publishAt: null },
    { status: ArticleStatus.SCHEDULED, publishAt: new Date(now + 2 * day) }, // future — not overdue
    { status: ArticleStatus.SCHEDULED, publishAt: new Date(now - 3 * day) }, // past — overdue
    { status: ArticleStatus.PUBLISHED, publishAt: new Date(now - 10 * day) },
  ];

  let count = 0;
  let overdueArticleId: string | null = null;
  let publishedArticleId: string | null = null;

  for (const section of sections) {
    for (const s of statuses) {
      const author = section.writers[count % section.writers.length];
      const isPublished = s.status === ArticleStatus.PUBLISHED;
      const article = await prisma.article.create({
        data: {
          sectionId: section.id,
          authorId: author.id,
          title: `${section.name} sample article ${s.status.toLowerCase()} #${count + 1}`,
          body: `This is seed body content for a ${s.status} article in ${section.name}.`,
          status: s.status,
          publishAt: s.publishAt,
          publishedAt: isPublished ? s.publishAt : null,
        },
      });

      if (s.status === ArticleStatus.SCHEDULED && s.publishAt && s.publishAt.getTime() < now) {
        overdueArticleId = article.id;
      }
      if (isPublished) publishedArticleId = article.id;

      await prisma.articleEvent.create({
        data: {
          articleId: article.id,
          type: "STATUS_CHANGE",
          oldStatus: null,
          newStatus: ArticleStatus.DRAFT,
          actorId: author.id,
          message: "Article created.",
        },
      });

      if (s.status !== ArticleStatus.DRAFT) {
        await prisma.articleEvent.create({
          data: {
            articleId: article.id,
            type: "STATUS_CHANGE",
            oldStatus: ArticleStatus.DRAFT,
            newStatus: s.status,
            actorId: section.ownerEditorId,
            message: `Seed data: fast-forwarded to ${s.status}.`,
          },
        });
      }

      // A couple of comments on the in-review-ish articles so the UI has
      // something to show out of the box.
      if (s.status === ArticleStatus.IN_REVIEW || s.status === ArticleStatus.APPROVED) {
        await prisma.comment.create({
          data: {
            articleId: article.id,
            authorId: section.ownerEditorId,
            content: "Good draft — please double check the second paragraph's sourcing.",
          },
        });
      }

      count++;
    }
  }

  console.log(`Seeded ${count} articles with history events.`);

  // One published article gets an open revision in Draft, to demonstrate the
  // revision workflow without any manual steps.
  if (publishedArticleId) {
    const original = await prisma.article.findUniqueOrThrow({ where: { id: publishedArticleId } });
    const revision = await prisma.article.create({
      data: {
        title: `${original.title} (revision)`,
        body: `${original.body}\n\nUpdated seed content pending review.`,
        sectionId: original.sectionId,
        authorId: original.authorId,
        status: ArticleStatus.DRAFT,
        revisionOfId: original.id,
      },
    });
    await prisma.articleEvent.create({
      data: {
        articleId: revision.id,
        type: "REVISION_OPENED",
        newStatus: ArticleStatus.DRAFT,
        actorId: original.authorId,
        message: `Revision opened for published article ${original.id}.`,
      },
    });
    console.log("Seeded one open revision on a published article.");
  }

  // Dismiss the alert on one overdue article's *original* schedule so the
  // demo also shows dismissal, while still leaving another overdue alert
  // active to see in the Alerts page.
  if (overdueArticleId) {
    const overdue = await prisma.article.findUniqueOrThrow({ where: { id: overdueArticleId } });
    console.log(`Left article ${overdue.id} overdue for the Alerts demo (not dismissed).`);
  }

  console.log("Done. Demo login: editor1@demo.com / writer1@demo.com — password: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
