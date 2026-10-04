import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/app";
import { Store } from "../server/storage";
import type { Attempt } from "../shared/schema";
import { gestureIds } from "../shared/catalog";
const attempt = (gestureId: Attempt["gestureId"] = "fist"): Attempt => ({
  id: randomUUID(),
  userId: "demo",
  lessonId: "handshape-basics",
  gestureId,
  score: 93,
  success: true,
  mistakes: ["index"],
  corrections: 1,
  durationMs: 3500,
  createdAt: new Date().toISOString(),
});
describe("API and SQLite persistence", () => {
  let store: Store;
  beforeEach(() => {
    store = new Store(":memory:");
  });
  afterEach(() => store.close());
  it("serves health, real lesson metadata and empty progress", async () => {
    const app = createApp(store);
    expect((await request(app).get("/api/health")).body.status).toBe("ok");
    expect(
      (await request(app).get("/api/lessons")).body.lessons[0].gestureIds,
    ).toHaveLength(3);
    expect(
      (await request(app).get("/api/progress")).body.summary.attempts,
    ).toBe(0);
  });
  it("validates payloads and rejects extra image fields, bad scores and malformed JSON", async () => {
    const app = createApp(store);
    for (const body of [
      { ...attempt(), score: 101 },
      { ...attempt(), video: "frame-data" },
      { ...attempt(), gestureId: "unknown" },
    ])
      expect((await request(app).post("/api/attempts").send(body)).status).toBe(
        400,
      );
    expect(
      (
        await request(app)
          .post("/api/attempts")
          .set("Content-Type", "application/json")
          .send("{")
      ).status,
    ).toBe(400);
    expect((await request(app).get("/api/missing")).status).toBe(404);
  });
  it("stores attempts idempotently and persists whole lessons atomically", async () => {
    const app = createApp(store),
      attempts = gestureIds.map(attempt);
    for (let n = 0; n < 2; n++)
      expect(
        (await request(app).post("/api/attempts").send(attempts[0])).status,
      ).toBe(201);
    const result = {
      id: randomUUID(),
      userId: "demo",
      lessonId: "handshape-basics",
      attempts,
      durationMs: 12000,
      createdAt: new Date().toISOString(),
    };
    for (let n = 0; n < 2; n++)
      expect(
        (await request(app).post("/api/lesson-results").send(result)).status,
      ).toBe(201);
    const retry = await request(app)
      .post("/api/lesson-results")
      .send({ ...result, id: randomUUID() });
    expect(retry.body.id).toBe(result.id);
    const progress = (await request(app).get("/api/progress")).body;
    expect(progress.attempts).toHaveLength(3);
    expect(progress.results).toHaveLength(1);
    expect(progress.summary.average).toBe(93);
    expect(progress.learning.totalXP).toBe(40);
    expect(progress.learning.completedNodes).toBe(1);
  });
  it("rejects incomplete or duplicate-gesture lesson results", async () => {
    const result = {
      id: randomUUID(),
      userId: "demo",
      lessonId: "handshape-basics",
      attempts: [attempt(), attempt(), attempt()],
      durationMs: 1000,
      createdAt: new Date().toISOString(),
    };
    expect(
      (await request(createApp(store)).post("/api/lesson-results").send(result))
        .status,
    ).toBe(400);
    expect(store.attempts()).toHaveLength(0);
  });

  it("persists quick-practice rewards and dates through the API", async () => {
    const app = createApp(store);
    const completed = {
      id: randomUUID(),
      userId: "demo",
      lessonId: "handshape-basics",
      sessionKind: "practice",
      attempts: [attempt("palm")],
      durationMs: 3000,
      createdAt: new Date().toISOString(),
      practiceDate: "2026-09-29",
    };
    expect(
      (await request(app).post("/api/lesson-results").send(completed)).status,
    ).toBe(201);
    expect(
      (await request(app).post("/api/lesson-results").send(completed)).status,
    ).toBe(201);
    const progress = (await request(app).get("/api/progress")).body;
    expect(progress.learning.totalXP).toBe(15);
    expect(progress.results[0].practiceDate).toBe("2026-09-29");
    expect(progress.learning.completedNodes).toBe(0);
  });
  it("only exposes guarded reset when explicitly enabled and restricts cross-origin access", async () => {
    store.addAttempt(attempt());
    expect(
      (await request(createApp(store)).post("/api/dev/reset")).status,
    ).toBe(404);
    const app = createApp(store, false, {
      devTools: true,
      allowedOrigin: "https://signai.example",
    });
    expect((await request(app).post("/api/dev/reset")).status).toBe(403);
    expect(
      (
        await request(app)
          .get("/api/health")
          .set("Origin", "https://other.example")
      ).headers["access-control-allow-origin"],
    ).toBeUndefined();
    expect(
      (
        await request(app)
          .options("/api/attempts")
          .set("Origin", "https://signai.example")
      ).headers["access-control-allow-origin"],
    ).toBe("https://signai.example");
    expect(
      (await request(app).post("/api/dev/reset").set("X-SignAI-Reset", "demo"))
        .status,
    ).toBe(200);
    expect(store.progress()).toEqual({ attempts: [], results: [] });
  });
  it("survives a database restart", () => {
    const folder = mkdtempSync(join(tmpdir(), "signai-test-"));
    try {
      const path = join(folder, "test.sqlite");
      const first = new Store(path);
      first.addAttempt(attempt());
      first.close();
      const second = new Store(path);
      expect(second.attempts()).toHaveLength(1);
      second.close();
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
