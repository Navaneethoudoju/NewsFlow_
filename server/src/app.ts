import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth";
import sectionsRoutes from "./routes/sections";
import articlesRoutes from "./routes/articles";
import dashboardRoutes from "./routes/dashboard";
import alertsRoutes from "./routes/alerts";
import { rateLimit } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL ?? "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Auth endpoints get a stricter rate limit since they're the most common
// target for credential-stuffing / brute-force attempts.
app.use("/auth", rateLimit({ windowMs: 60_000, max: 20 }), authRoutes);

app.use("/sections", sectionsRoutes);
app.use("/articles", articlesRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/alerts", alertsRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route not found." } });
});

// Must be registered last: Express only routes errors here once every other
// handler has had a chance to run.
app.use(errorHandler);

export default app;
