import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { resetDb, createUser, cookieFor } from "../testUtils";

// These tests exercise the real HTTP + Prisma stack and therefore need a
// reachable test database. Point DATABASE_URL at a disposable Postgres
// instance (see docker-compose.yml) before running `npm test`.
const hasDb = !!process.env.DATABASE_URL;
const maybeDescribe = hasDb ? describe : describe.skip;

maybeDescribe("editorial workflow (integration)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb();
  });

  test("login rejects invalid credentials and accepts valid ones", async () => {
    const user = await createUser("EDITOR", "editor@test.com");

    const bad = await request(app).post("/auth/login").send({ email: user.email, password: "wrong" });
    expect(bad.status).toBe(401);

    const good = await request(app).post("/auth/login").send({ email: user.email, password: "password123" });
    expect(good.status).toBe(200);
    expect(good.headers["set-cookie"]).toBeDefined();
  });

  test("a writer cannot create an article in a section they are not assigned to", async () => {
    const editor = await createUser("EDITOR", "editor2@test.com");
    const writer = await createUser("WRITER", "writer2@test.com");
    const section = await prisma.section.create({
      data: { name: "Politics", description: "d", ownerEditorId: editor.id },
    });

    const res = await request(app)
      .post("/articles")
      .set("Cookie", cookieFor(writer.id, "WRITER"))
      .send({ title: "T", body: "B", sectionId: section.id });

    expect(res.status).toBe(403);
  });

  test("full happy-path workflow: draft -> review -> approve -> schedule -> publish", async () => {
    const editor = await createUser("EDITOR", "editor3@test.com");
    const writer = await createUser("WRITER", "writer3@test.com");
    const section = await prisma.section.create({
      data: { name: "Tech", description: "d", ownerEditorId: editor.id },
    });
    await prisma.sectionWriter.create({ data: { sectionId: section.id, writerId: writer.id } });

    const writerCookie = cookieFor(writer.id, "WRITER");
    const editorCookie = cookieFor(editor.id, "EDITOR");

    const created = await request(app)
      .post("/articles")
      .set("Cookie", writerCookie)
      .send({ title: "Hello", body: "World", sectionId: section.id });
    expect(created.status).toBe(201);
    const articleId = created.body.id;

    const submitted = await request(app)
      .post(`/articles/${articleId}/transition`)
      .set("Cookie", writerCookie)
      .send({ action: "SUBMIT_FOR_REVIEW" });
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe("IN_REVIEW");

    // The author (writer) cannot approve their own article, even as an
    // editor-only action attempted by someone else acting as the author.
    const selfApprove = await request(app)
      .post(`/articles/${articleId}/transition`)
      .set("Cookie", writerCookie)
      .send({ action: "APPROVE" });
    expect(selfApprove.status).toBe(403);

    const approved = await request(app)
      .post(`/articles/${articleId}/transition`)
      .set("Cookie", editorCookie)
      .send({ action: "APPROVE" });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("APPROVED");

    const future = new Date(Date.now() + 60_000).toISOString();
    const scheduled = await request(app)
      .post(`/articles/${articleId}/transition`)
      .set("Cookie", editorCookie)
      .send({ action: "SCHEDULE", publishAt: future });
    expect(scheduled.status).toBe(200);
    expect(scheduled.body.status).toBe("SCHEDULED");

    const published = await request(app)
      .post(`/articles/${articleId}/transition`)
      .set("Cookie", editorCookie)
      .send({ action: "PUBLISH" });
    expect(published.status).toBe(200);
    expect(published.body.status).toBe("PUBLISHED");

    // Published articles cannot be edited directly.
    const directEdit = await request(app)
      .patch(`/articles/${articleId}`)
      .set("Cookie", editorCookie)
      .send({ title: "New title" });
    expect(directEdit.status).toBe(409);

    const history = await request(app).get(`/articles/${articleId}/history`).set("Cookie", editorCookie);
    expect(history.status).toBe(200);
    expect(history.body.length).toBeGreaterThanOrEqual(5);
  });

  test("revision workflow: publishing a revision replaces the original content", async () => {
    const editor = await createUser("EDITOR", "editor4@test.com");
    const writer = await createUser("WRITER", "writer4@test.com");
    const section = await prisma.section.create({
      data: { name: "Culture", description: "d", ownerEditorId: editor.id },
    });
    await prisma.sectionWriter.create({ data: { sectionId: section.id, writerId: writer.id } });

    const original = await prisma.article.create({
      data: {
        title: "Original title",
        body: "Original body",
        sectionId: section.id,
        authorId: writer.id,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    const writerCookie = cookieFor(writer.id, "WRITER");
    const editorCookie = cookieFor(editor.id, "EDITOR");

    const revisionRes = await request(app)
      .post(`/articles/${original.id}/revisions`)
      .set("Cookie", writerCookie);
    expect(revisionRes.status).toBe(201);
    const revisionId = revisionRes.body.id;

    await request(app).patch(`/articles/${revisionId}`).set("Cookie", writerCookie).send({ body: "Corrected body" });
    await request(app).post(`/articles/${revisionId}/transition`).set("Cookie", writerCookie).send({ action: "SUBMIT_FOR_REVIEW" });
    await request(app).post(`/articles/${revisionId}/transition`).set("Cookie", editorCookie).send({ action: "APPROVE" });
    const publishRevision = await request(app)
      .post(`/articles/${revisionId}/transition`)
      .set("Cookie", editorCookie)
      .send({ action: "PUBLISH" });
    expect(publishRevision.status).toBe(200);

    const refreshedOriginal = await prisma.article.findUniqueOrThrow({ where: { id: original.id } });
    expect(refreshedOriginal.body).toBe("Corrected body");
    expect(refreshedOriginal.status).toBe("PUBLISHED");
  });

  test("bulk schedule reports per-article success/failure without failing the whole batch", async () => {
    const editor = await createUser("EDITOR", "editor5@test.com");
    const writer = await createUser("WRITER", "writer5@test.com");
    const section = await prisma.section.create({
      data: { name: "Sports", description: "d", ownerEditorId: editor.id },
    });

    const approved = await prisma.article.create({
      data: { title: "Ready", body: "b", sectionId: section.id, authorId: writer.id, status: "APPROVED" },
    });
    const stillDraft = await prisma.article.create({
      data: { title: "Not ready", body: "b", sectionId: section.id, authorId: writer.id, status: "DRAFT" },
    });

    const res = await request(app)
      .post("/articles/bulk/schedule")
      .set("Cookie", cookieFor(editor.id, "EDITOR"))
      .send({ articleIds: [approved.id, stillDraft.id], publishAt: new Date(Date.now() + 86_400_000).toISOString() });

    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.results.map((r: any) => [r.articleId, r]));
    expect(byId[approved.id].success).toBe(true);
    expect(byId[stillDraft.id].success).toBe(false);
  });

  test("overdue alerts appear for past-due scheduled articles and can be dismissed; rescheduling re-alerts", async () => {
    const editor = await createUser("EDITOR", "editor6@test.com");
    const writer = await createUser("WRITER", "writer6@test.com");
    const section = await prisma.section.create({
      data: { name: "World", description: "d", ownerEditorId: editor.id },
    });

    const overdue = await prisma.article.create({
      data: {
        title: "Overdue",
        body: "b",
        sectionId: section.id,
        authorId: writer.id,
        status: "SCHEDULED",
        publishAt: new Date(Date.now() - 60_000),
      },
    });

    const editorCookie = cookieFor(editor.id, "EDITOR");

    const before = await request(app).get("/alerts").set("Cookie", editorCookie);
    expect(before.body.alerts.some((a: any) => a.articleId === overdue.id)).toBe(true);

    await request(app).post(`/alerts/${overdue.id}/dismiss`).set("Cookie", editorCookie);

    const after = await request(app).get("/alerts").set("Cookie", editorCookie);
    expect(after.body.alerts.some((a: any) => a.articleId === overdue.id)).toBe(false);

    // Unpublish path doesn't apply here (never published); simulate a
    // reschedule directly and confirm a fresh publishAt alerts again.
    await prisma.article.update({
      where: { id: overdue.id },
      data: { publishAt: new Date(Date.now() - 5000) },
    });
    const afterReschedule = await request(app).get("/alerts").set("Cookie", editorCookie);
    expect(afterReschedule.body.alerts.some((a: any) => a.articleId === overdue.id)).toBe(true);
  });

  test("a writer can create an article in a section they are assigned to", async () => {
    const editor = await createUser("EDITOR", "editor7@test.com");
    const writer = await createUser("WRITER", "writer7@test.com");
    const section = await prisma.section.create({
      data: { name: "Business", description: "d", ownerEditorId: editor.id },
    });
    await prisma.sectionWriter.create({ data: { sectionId: section.id, writerId: writer.id } });

    const res = await request(app)
      .post("/articles")
      .set("Cookie", cookieFor(writer.id, "WRITER"))
      .send({ title: "T", body: "B", sectionId: section.id });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("DRAFT");
  });

  test("archived sections cannot receive new articles", async () => {
    const editor = await createUser("EDITOR", "editor8@test.com");
    const writer = await createUser("WRITER", "writer8@test.com");
    const section = await prisma.section.create({
      data: { name: "Opinion", description: "d", ownerEditorId: editor.id, archived: true },
    });
    await prisma.sectionWriter.create({ data: { sectionId: section.id, writerId: writer.id } });

    const res = await request(app)
      .post("/articles")
      .set("Cookie", cookieFor(writer.id, "WRITER"))
      .send({ title: "T", body: "B", sectionId: section.id });

    expect(res.status).toBe(409);
  });

  test("editing an Approved article sends it back to In Review", async () => {
    const editor = await createUser("EDITOR", "editor9@test.com");
    const writer = await createUser("WRITER", "writer9@test.com");
    const section = await prisma.section.create({
      data: { name: "Health", description: "d", ownerEditorId: editor.id },
    });
    const article = await prisma.article.create({
      data: { title: "Old", body: "b", sectionId: section.id, authorId: writer.id, status: "APPROVED" },
    });

    const res = await request(app)
      .patch(`/articles/${article.id}`)
      .set("Cookie", cookieFor(editor.id, "EDITOR"))
      .send({ title: "Edited title" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_REVIEW");
    expect(res.body.title).toBe("Edited title");
  });

  test("editing a Scheduled article sends it back to In Review and clears its publish time", async () => {
    const editor = await createUser("EDITOR", "editor10@test.com");
    const writer = await createUser("WRITER", "writer10@test.com");
    const section = await prisma.section.create({
      data: { name: "Science", description: "d", ownerEditorId: editor.id },
    });
    const article = await prisma.article.create({
      data: {
        title: "Old",
        body: "b",
        sectionId: section.id,
        authorId: writer.id,
        status: "SCHEDULED",
        publishAt: new Date(Date.now() + 86_400_000),
      },
    });

    const res = await request(app)
      .patch(`/articles/${article.id}`)
      .set("Cookie", cookieFor(editor.id, "EDITOR"))
      .send({ body: "Edited body" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_REVIEW");
    expect(res.body.publishAt).toBeNull();
  });

  test("only one open revision may exist per published article at a time", async () => {
    const editor = await createUser("EDITOR", "editor11@test.com");
    const writer = await createUser("WRITER", "writer11@test.com");
    const section = await prisma.section.create({
      data: { name: "Travel", description: "d", ownerEditorId: editor.id },
    });
    await prisma.sectionWriter.create({ data: { sectionId: section.id, writerId: writer.id } });
    const original = await prisma.article.create({
      data: {
        title: "Live",
        body: "b",
        sectionId: section.id,
        authorId: writer.id,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    const writerCookie = cookieFor(writer.id, "WRITER");
    const first = await request(app).post(`/articles/${original.id}/revisions`).set("Cookie", writerCookie);
    expect(first.status).toBe(201);

    const second = await request(app).post(`/articles/${original.id}/revisions`).set("Cookie", writerCookie);
    expect(second.status).toBe(409);
  });

  test("search, status filter, and pagination on the article list are applied server-side", async () => {
    const editor = await createUser("EDITOR", "editor12@test.com");
    const writer = await createUser("WRITER", "writer12@test.com");
    const section = await prisma.section.create({
      data: { name: "Local", description: "d", ownerEditorId: editor.id },
    });
    await prisma.article.create({
      data: { title: "Zebra migration patterns", body: "b", sectionId: section.id, authorId: writer.id, status: "DRAFT" },
    });
    await prisma.article.create({
      data: { title: "Unrelated piece", body: "b", sectionId: section.id, authorId: writer.id, status: "IN_REVIEW" },
    });
    for (let i = 0; i < 3; i++) {
      await prisma.article.create({
        data: { title: `Filler ${i}`, body: "b", sectionId: section.id, authorId: writer.id, status: "DRAFT" },
      });
    }

    const editorCookie = cookieFor(editor.id, "EDITOR");

    const searchRes = await request(app).get("/articles").query({ search: "zebra" }).set("Cookie", editorCookie);
    expect(searchRes.body.items).toHaveLength(1);
    expect(searchRes.body.items[0].title).toMatch(/zebra/i);

    const filterRes = await request(app)
      .get("/articles")
      .query({ status: "IN_REVIEW" })
      .set("Cookie", editorCookie);
    expect(filterRes.body.items.every((a: any) => a.status === "IN_REVIEW")).toBe(true);

    const pageRes = await request(app)
      .get("/articles")
      .query({ page: 1, pageSize: 2 })
      .set("Cookie", editorCookie);
    expect(pageRes.body.items).toHaveLength(2);
    expect(pageRes.body.total).toBe(5);
    expect(pageRes.body.totalPages).toBe(3);
  });

  test("a section's owner must actually be an editor", async () => {
    const editor = await createUser("EDITOR", "editor13@test.com");
    const writer = await createUser("WRITER", "writer13@test.com");

    const res = await request(app)
      .post("/sections")
      .set("Cookie", cookieFor(editor.id, "EDITOR"))
      .send({ name: "Money", description: "d", ownerEditorId: writer.id });

    expect(res.status).toBe(400);
  });

  test("a writer's dashboard summary excludes other writers' drafts and other sections", async () => {
    const editor = await createUser("EDITOR", "editor14@test.com");
    const writerA = await createUser("WRITER", "writerA14@test.com");
    const writerB = await createUser("WRITER", "writerB14@test.com");
    const sectionA = await prisma.section.create({
      data: { name: "SectionA", description: "d", ownerEditorId: editor.id },
    });
    const sectionB = await prisma.section.create({
      data: { name: "SectionB", description: "d", ownerEditorId: editor.id },
    });
    await prisma.sectionWriter.create({ data: { sectionId: sectionA.id, writerId: writerA.id } });

    // writerA's own draft in their section — should count.
    await prisma.article.create({
      data: { title: "Mine", body: "b", sectionId: sectionA.id, authorId: writerA.id, status: "DRAFT" },
    });
    // Someone else's private draft in the same section — should NOT count for writerA.
    await prisma.article.create({
      data: { title: "Not mine", body: "b", sectionId: sectionA.id, authorId: editor.id, status: "DRAFT" },
    });
    // A draft in a section writerA has no access to — should NOT count.
    await prisma.article.create({
      data: { title: "Elsewhere", body: "b", sectionId: sectionB.id, authorId: writerB.id, status: "DRAFT" },
    });

    const res = await request(app).get("/dashboard/summary").set("Cookie", cookieFor(writerA.id, "WRITER"));
    expect(res.status).toBe(200);
    expect(res.body.drafts).toBe(1);
  });
});
