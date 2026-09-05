import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { verifyAuthToken, AuthTokenPayload } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

const COOKIE_NAME = "token";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  try {
    req.user = verifyAuthToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}

// Usage: router.post("/sections", requireAuth, requireRole("EDITOR"), handler)
export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated." });
    }
    if (!allowed.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: `This action requires role: ${allowed.join(" or ")}.` });
    }
    next();
  };
}

const isProd = process.env.NODE_ENV === "production";

// In production the frontend (Vercel) and backend (Render/Railway/Fly) live on
// different domains, so the cookie must be SameSite=None + Secure to survive
// the cross-site XHR. Locally (same-site, http) Lax + non-secure is correct.
export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  secure: isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export { COOKIE_NAME };
