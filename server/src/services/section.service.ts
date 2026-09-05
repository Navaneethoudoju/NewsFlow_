import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { AuthTokenPayload } from "../lib/jwt";
import { isEditor } from "../lib/permissions";

const SECTION_INCLUDE = {
  ownerEditor: { select: { id: true, name: true, email: true } },
  writers: { include: { writer: { select: { id: true, name: true, email: true } } } },
  _count: { select: { articles: true } },
} as const;

export async function listSections(user: AuthTokenPayload, includeArchived: boolean) {
  if (isEditor(user)) {
    return prisma.section.findMany({
      where: includeArchived ? {} : { archived: false },
      include: SECTION_INCLUDE,
      orderBy: { name: "asc" },
    });
  }
  return prisma.section.findMany({
    where: { writers: { some: { writerId: user.id } } },
    include: SECTION_INCLUDE,
    orderBy: { name: "asc" },
  });
}

export async function getSection(id: string) {
  const section = await prisma.section.findUnique({ where: { id }, include: SECTION_INCLUDE });
  if (!section) throw AppError.notFound("Section not found.");
  return section;
}

/** Throws unless the given user id belongs to an EDITOR. */
async function assertIsEditor(userId: string) {
  const owner = await prisma.user.findUnique({ where: { id: userId } });
  if (!owner || owner.role !== "EDITOR") {
    throw AppError.badRequest("The selected owner must be an editor.");
  }
}

export async function createSection(
  user: AuthTokenPayload,
  input: { name: string; description: string; ownerEditorId?: string }
) {
  // Defaults to the creating editor, but any editor can be named as owner.
  const ownerEditorId = input.ownerEditorId ?? user.id;
  if (ownerEditorId !== user.id) await assertIsEditor(ownerEditorId);

  return prisma.section.create({
    data: { name: input.name, description: input.description, ownerEditorId },
    include: SECTION_INCLUDE,
  });
}

export async function updateSection(
  id: string,
  input: { name?: string; description?: string; ownerEditorId?: string }
) {
  await getSection(id);
  if (input.ownerEditorId) await assertIsEditor(input.ownerEditorId);
  return prisma.section.update({ where: { id }, data: input, include: SECTION_INCLUDE });
}

export async function setSectionArchived(id: string, archived: boolean) {
  await getSection(id);
  return prisma.section.update({ where: { id }, data: { archived }, include: SECTION_INCLUDE });
}

export async function assignWriter(sectionId: string, writerId: string) {
  await getSection(sectionId);
  const writer = await prisma.user.findUnique({ where: { id: writerId } });
  if (!writer || writer.role !== "WRITER") {
    throw AppError.badRequest("The selected user is not a writer.");
  }
  await prisma.sectionWriter.upsert({
    where: { sectionId_writerId: { sectionId, writerId } },
    update: {},
    create: { sectionId, writerId },
  });
  return getSection(sectionId);
}

export async function removeWriter(sectionId: string, writerId: string) {
  await getSection(sectionId);
  await prisma.sectionWriter.deleteMany({ where: { sectionId, writerId } });
  return getSection(sectionId);
}

export async function listWriters() {
  return prisma.user.findMany({
    where: { role: "WRITER" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

export async function listEditors() {
  return prisma.user.findMany({
    where: { role: "EDITOR" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}
