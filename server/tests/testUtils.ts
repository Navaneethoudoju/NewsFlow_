import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { signAuthToken } from "../src/lib/jwt";

/** Wipes all tables in FK-safe order. Only ever call this against a test DB. */
export async function resetDb() {
  await prisma.dismissedAlert.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.articleEvent.deleteMany();
  await prisma.article.deleteMany();
  await prisma.sectionWriter.deleteMany();
  await prisma.section.deleteMany();
  await prisma.user.deleteMany();
}

export async function createUser(role: "EDITOR" | "WRITER", email: string) {
  const passwordHash = await bcrypt.hash("password123", 4);
  return prisma.user.create({ data: { email, name: email.split("@")[0], role, passwordHash } });
}

export function cookieFor(userId: string, role: "EDITOR" | "WRITER") {
  const token = signAuthToken({ id: userId, role: role as any });
  return `token=${token}`;
}
