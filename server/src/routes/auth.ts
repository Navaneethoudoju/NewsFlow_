import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signAuthToken } from "../lib/jwt";
import { requireAuth, COOKIE_NAME, COOKIE_OPTIONS } from "../middleware/auth";

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().min(1),
  role: z.enum(["EDITOR", "WRITER"]),
});

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password, name, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, name, role, passwordHash },
  });

  const token = signAuthToken({ id: user.id, role: user.role });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = signAuthToken({ id: user.id, role: user.role });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.status(204).send();
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  res.json(user);
});

export default router;
