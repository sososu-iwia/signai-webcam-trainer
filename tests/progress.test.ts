import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Attempt, LessonResult } from "../shared/schema";
import { learningStats } from "../shared/learning";
const attempt = (): Attempt => ({
  id: crypto.randomUUID(),
  userId: "demo",
  lessonId: "handshape-basics",
  gestureId: "fist",
  score: 95,
  success: true,
  durationMs: 1000,
  mistakes: [],
  corrections: 0,
  createdAt: new Date().toISOString(),
});
const response = (value: unknown) =>
  new Response(JSON.stringify(value), { status: 200 });
describe("offline queue and sync", () => {
  const storage = new Map<string, string>();
  beforeEach(() => {
    vi.resetModules();
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("survives reload offline, deduplicates completion events, and safely drains on reconnect", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    let service = await import("../src/services/progress");
    const saved = attempt();
    const result: LessonResult = {
      id: crypto.randomUUID(),
      userId: "demo",
      lessonId: "handshape-basics",
      sessionKind: "practice",
      attempts: [saved],
      durationMs: 1000,
      createdAt: saved.createdAt,
    };
    service.saveAttempt(saved);
    service.saveResult(result);
    service.saveResult({ ...result, id: crypto.randomUUID() });
    await service.syncProgress();
    expect(service.getSnapshot().status).toBe("offline");
    expect(learningStats(service.getSnapshot().progress).totalXP).toBe(15);
    vi.resetModules();
    service = await import("../src/services/progress");
    expect(service.getSnapshot().pendingResults).toHaveLength(1);
    const fetcher = vi.fn(async (_url: string, options?: RequestInit) =>
      response(
        options?.method === "POST"
          ? {}
          : { attempts: [saved], results: [result] },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    await service.syncProgress();
    await service.syncProgress();
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === "POST"),
    ).toHaveLength(2);
    expect(service.getSnapshot().pendingAttempts).toEqual([]);
    expect(service.getSnapshot().pendingResults).toEqual([]);
    expect(service.getSnapshot().progress.results).toHaveLength(1);
    expect(learningStats(service.getSnapshot().progress).totalXP).toBe(15);
  });
  it("flushes an event added while the remote progress request is in flight", async () => {
    const service = await import("../src/services/progress");
    let release: (value: Response) => void = () => {};
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      )
      .mockImplementation(async () => response({ attempts: [], results: [] }));
    vi.stubGlobal("fetch", fetcher);
    const syncing = service.syncProgress();
    const saved = attempt();
    service.saveAttempt(saved);
    release(response({ attempts: [], results: [] }));
    await syncing;
    expect(service.getSnapshot().pendingAttempts).toEqual([]);
    expect(fetcher.mock.calls.some(([url]) => url === "/api/attempts")).toBe(
      true,
    );
    expect(learningStats(service.getSnapshot().progress).totalXP).toBe(10);
  });
  it("keeps working when browser storage is unavailable", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const service = await import("../src/services/progress");
    service.saveAttempt(attempt());
    await service.syncProgress();
    expect(service.getSnapshot().status).toBe("memory");
    expect(service.getSnapshot().progress.attempts).toHaveLength(1);
  });
});
