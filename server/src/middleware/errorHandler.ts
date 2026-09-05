import { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../lib/errors";

// Consistent shape for every error response in the API:
// { success: false, error: { code, message, details? } }
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        error: { code: "CONFLICT", message: "This record already exists." },
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Record not found." },
      });
    }
  }

  // Never leak stack traces or internals to the client.
  console.error(err);
  return res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
  });
};
