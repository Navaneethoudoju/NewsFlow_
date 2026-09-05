import { validateTransition } from "../src/lib/workflow";
import { AppError } from "../src/lib/errors";

const EDITOR = "editor-1";
const OTHER_EDITOR = "editor-2";
const WRITER = "writer-1";

describe("article workflow state machine", () => {
  test("DRAFT -> IN_REVIEW is allowed for the author (writer)", () => {
    const to = validateTransition({
      action: "SUBMIT_FOR_REVIEW",
      currentStatus: "DRAFT",
      actorId: WRITER,
      actorRole: "WRITER",
      authorId: WRITER,
    });
    expect(to).toBe("IN_REVIEW");
  });

  test("IN_REVIEW -> APPROVED is allowed for an editor who is not the author", () => {
    const to = validateTransition({
      action: "APPROVE",
      currentStatus: "IN_REVIEW",
      actorId: OTHER_EDITOR,
      actorRole: "EDITOR",
      authorId: WRITER,
    });
    expect(to).toBe("APPROVED");
  });

  test("a writer cannot approve any article", () => {
    expect(() =>
      validateTransition({
        action: "APPROVE",
        currentStatus: "IN_REVIEW",
        actorId: WRITER,
        actorRole: "WRITER",
        authorId: "someone-else",
      })
    ).toThrow(AppError);
  });

  test("an editor cannot approve their own article", () => {
    expect(() =>
      validateTransition({
        action: "APPROVE",
        currentStatus: "IN_REVIEW",
        actorId: EDITOR,
        actorRole: "EDITOR",
        authorId: EDITOR,
      })
    ).toThrow(/other than the article's author/i);
  });

  test("an editor cannot schedule their own article", () => {
    expect(() =>
      validateTransition({
        action: "SCHEDULE",
        currentStatus: "APPROVED",
        actorId: EDITOR,
        actorRole: "EDITOR",
        authorId: EDITOR,
        publishAt: new Date(Date.now() + 86_400_000),
      })
    ).toThrow(/other than the article's author/i);
  });

  test("scheduling requires a future publishAt", () => {
    expect(() =>
      validateTransition({
        action: "SCHEDULE",
        currentStatus: "APPROVED",
        actorId: OTHER_EDITOR,
        actorRole: "EDITOR",
        authorId: WRITER,
        publishAt: new Date(Date.now() - 1000),
      })
    ).toThrow(/future/i);
  });

  test("PUBLISH is valid directly from SCHEDULED (early publish)", () => {
    const to = validateTransition({
      action: "PUBLISH",
      currentStatus: "SCHEDULED",
      actorId: OTHER_EDITOR,
      actorRole: "EDITOR",
      authorId: WRITER,
    });
    expect(to).toBe("PUBLISHED");
  });

  test("PUBLISHED -> APPROVED (unpublish) is allowed for editors", () => {
    const to = validateTransition({
      action: "UNPUBLISH",
      currentStatus: "PUBLISHED",
      actorId: OTHER_EDITOR,
      actorRole: "EDITOR",
      authorId: WRITER,
    });
    expect(to).toBe("APPROVED");
  });

  test("arbitrary/invalid transitions are rejected", () => {
    expect(() =>
      validateTransition({
        action: "PUBLISH",
        currentStatus: "DRAFT",
        actorId: OTHER_EDITOR,
        actorRole: "EDITOR",
        authorId: WRITER,
      })
    ).toThrow(AppError);
  });

  test("DRAFT cannot go straight to APPROVED", () => {
    expect(() =>
      validateTransition({
        action: "APPROVE",
        currentStatus: "DRAFT",
        actorId: OTHER_EDITOR,
        actorRole: "EDITOR",
        authorId: WRITER,
      })
    ).toThrow(AppError);
  });
});
