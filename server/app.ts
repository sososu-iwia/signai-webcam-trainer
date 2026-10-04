import { courseUnits } from "../shared/course.js";
import { courseGestures } from "../shared/catalog.js";
import express, { type ErrorRequestHandler } from "express";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { lesson, gestures } from "../shared/catalog.js";
import { attemptSchema, resultSchema, summarize } from "../shared/schema.js";
import { learningStats, learningPath, rewards } from "../shared/learning.js";
import type { Store } from "./storage.js";
export function createApp(
  store: Store,
  serveFrontend = false,
  options: { devTools?: boolean; allowedOrigin?: string } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api", (req, res, next) => {
    const origin = req.get("Origin");
    if (origin && options.allowedOrigin === origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, X-SignAI-Reset",
      );
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });
  if (options.devTools && process.env.NODE_ENV !== "production")
    app.post("/api/dev/reset", (req, res) => {
      if (
        req.get("X-SignAI-Reset") !== "demo" ||
        (req.get("Origin") && req.get("Sec-Fetch-Site") === "cross-site")
      ) {
        res.sendStatus(403);
        return;
      }
      store.reset();
      res.json({ reset: true });
    });
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", storage: "sqlite" }),
  );
  app.get("/api/lessons", (_req, res) =>
    res.json({ lessons: [lesson], gestures, learningPath, rewards, courseUnits, courseGestures }),
  );
  app.get("/api/progress", (_req, res) => {
    const progress = store.progress();
    res.json({
      ...progress,
      summary: summarize(progress),
      learning: learningStats(progress),
    });
  });
  app.get("/api/attempts", (_req, res) =>
    res.json({ attempts: store.attempts() }),
  );
  app.post("/api/attempts", (req, res) => {
    const parsed = attemptSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid attempt", details: parsed.error.flatten() });
      return;
    }
    store.addAttempt(parsed.data);
    res.status(201).json(parsed.data);
  });
  app.post("/api/lesson-results", (req, res) => {
    const parsed = resultSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid lesson result",
        details: parsed.error.flatten(),
      });
      return;
    }
    res.status(201).json(store.addResult(parsed.data));
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Endpoint not found" }),
  );
  if (serveFrontend && existsSync(resolve("dist/index.html"))) {
    app.use(express.static(resolve("dist")));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve("dist/index.html")),
    );
  }
  const onError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const status =
      error &&
      typeof error === "object" &&
      "status" in error &&
      typeof error.status === "number"
        ? error.status
        : 500;
    if (status >= 500) console.error(error);
    res.status(status).json({
      error:
        status === 400
          ? "Invalid JSON body"
          : status === 413
            ? "Request is too large"
            : "Unable to save right now. Your local progress is safe.",
    });
  };
  app.use(onError);
  return app;
}
