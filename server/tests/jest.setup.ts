import "dotenv/config";

// Tests need JWT_SECRET set even when they don't hit the DB (workflow tests
// import lib/jwt.ts indirectly). Fall back to a fixed test value.
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-do-not-use-in-production";
process.env.NODE_ENV = "test";
