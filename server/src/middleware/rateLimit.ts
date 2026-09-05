import { Request, Response, NextFunction } from "express";

// Simple in-memory fixed-window limiter. Good enough for a single-instance
// take-home deployment; swap for a Redis-backed limiter behind a load balancer.
interface Bucket {
  count: number;
  resetAt: number;
}

export function rateLimit(options: { windowMs: number; max: number }) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    if (bucket.count >= options.max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many attempts. Please wait a moment and try again.",
        },
      });
    }

    bucket.count += 1;
    next();
  };
}
