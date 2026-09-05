import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { AppError } from "./errors";

type Target = "body" | "query" | "params";

// Validates a request part against a Zod schema and replaces it with the
// parsed (and coerced/defaulted) value so downstream handlers get clean data.
export function validate(schema: ZodSchema, target: Target = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const first = result.error.issues[0];
      const path = first.path.join(".");
      const message = path ? `${path}: ${first.message}` : first.message;
      return next(AppError.validation(message, result.error.issues));
    }
    (req as any)[target] = result.data;
    next();
  };
}
