import { prisma } from "./prisma";
import { AppError } from "./errors";
import { AuthTokenPayload } from "./jwt";

export function isEditor(user: AuthTokenPayload): boolean {
  return user.role === "EDITOR";
}

/** Throws if a WRITER is not assigned to the given section. Editors always pass. */
export async function assertCanWriteInSection(user: AuthTokenPayload, sectionId: string) {
  if (isEditor(user)) return;
  const assignment = await prisma.sectionWriter.findUnique({
    where: { sectionId_writerId: { sectionId, writerId: user.id } },
  });
  if (!assignment) {
    throw AppError.forbidden("You are not assigned to this section.");
  }
}

/** True if a WRITER is assigned to the given section (no throw). */
export async function isAssignedToSection(userId: string, sectionId: string): Promise<boolean> {
  const assignment = await prisma.sectionWriter.findUnique({
    where: { sectionId_writerId: { sectionId, writerId: userId } },
  });
  return !!assignment;
}

/**
 * Visibility rule for articles: editors see everything. Writers see any
 * article they authored, plus any non-draft article in a section they are
 * assigned to (so they have editorial visibility into their section without
 * being able to browse other writers' private drafts).
 */
export function articleVisibilityFilter(user: AuthTokenPayload) {
  if (isEditor(user)) return {};
  return {
    OR: [
      { authorId: user.id },
      {
        AND: [
          { section: { writers: { some: { writerId: user.id } } } },
          { status: { not: "DRAFT" as const } },
        ],
      },
    ],
  };
}

export async function assertCanViewArticle(
  user: AuthTokenPayload,
  article: { authorId: string; sectionId: string; status: string }
) {
  if (isEditor(user)) return;
  if (article.authorId === user.id) return;
  if (article.status !== "DRAFT" && (await isAssignedToSection(user.id, article.sectionId))) {
    return;
  }
  throw AppError.forbidden("You do not have access to this article.");
}
