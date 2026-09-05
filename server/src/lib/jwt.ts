import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";

export interface AuthTokenPayload {
  id: string;
  role: Role;
}

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error("JWT_SECRET is not set. Copy .env.example to .env and fill it in.");
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, SECRET as string, { expiresIn: "7d" });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, SECRET as string) as AuthTokenPayload;
}
