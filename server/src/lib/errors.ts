// Central error type. Every handler that needs to fail with a specific HTTP
// status should throw one of these instead of building its own res.json shape
// inline — keeps the response envelope consistent everywhere.

export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_TRANSITION: 400,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError("BAD_REQUEST", message, details);
  }
  static validation(message: string, details?: unknown) {
    return new AppError("VALIDATION_ERROR", message, details);
  }
  static unauthenticated(message = "Authentication is required.") {
    return new AppError("UNAUTHENTICATED", message);
  }
  static forbidden(message: string) {
    return new AppError("FORBIDDEN", message);
  }
  static notFound(message: string) {
    return new AppError("NOT_FOUND", message);
  }
   static conflict(message: string, details?: unknown) { 
    return new AppError("CONFLICT", message, details); } 
  static invalidTransition(message: string, details?: unknown) {
    return new AppError("INVALID_TRANSITION", message, details);
  }
}
