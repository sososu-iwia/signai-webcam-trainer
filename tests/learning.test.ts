import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  learningStats,
  learningPath,
  levelForXP,
  gestureMastery,
  resultXP,
  rewards,
} from "../shared/learning";
import {
  resultSchema,
  type Attempt,
  type LessonResult,
  type Progress,
} from "../shared/schema";
const today = "2026-09-29";
function attempt(
  gestureId: Attempt["gestureId"] = "palm",
  date = today,
): Attempt {
  return {
    id: randomUUID(),
    userId: "demo",
    lessonId: "handshape-basics",
    gestureId,
    score: 94,
    success: true,
    mistakes: [],
    corrections: 0,
    durationMs: 1000,
    createdAt: `${date}T12:00:00.000Z`,
    practiceDate: date,
  };
}
function result(
  date = today,
  nodeId: LessonResult["nodeId"] = "warm-up",
): LessonResult {
  return {
    id: randomUUID(),
    userId: "demo",
    lessonId: "handshape-basics",
    attempts: (["palm", "fist", "victory"] as const).map((id) =>
      attempt(id, date),
    ),
    durationMs: 5000,
    createdAt: `${date}T12:00:00.000Z`,
    practiceDate: date,
    nodeId,
    sessionKind: nodeId === "practice" ? "practice" : "lesson",
  };
}
const progress = (
  results: LessonResult[],
  attempts: Attempt[] = [],
): Progress => ({ results, attempts });
describe("learning rewards and progression", () => {
  it("starts honestly with zero XP and only Warm Up available", () => {
    const stats = learningStats(progress([]), today);
    expect(stats.totalXP).toBe(0);
    expect(stats.streak).toBe(0);
    expect(stats.level.level).toBe(1);
    expect(stats.path.map((n) => n.state)).toEqual([
      "current",
      "locked",
      "locked",
      "locked",
      "locked",
      "locked",
    ]);
  });
  it("awards a complete lesson 40 XP without counting persisted attempts twice", () => {
    const r = result();
    const stats = learningStats(progress([r], r.attempts), today);
    expect(stats.totalXP).toBe(40);
    expect(stats.todayXP).toBe(40);
    expect(stats.path[0].state).toBe("completed");
    expect(stats.path[1].state).toBe("current");
    expect(resultXP(r)).toBe(40);
  });
  it("awards partial exercise XP but no streak or completion bonus", () => {
    const stats = learningStats(
      progress([], [attempt(), { ...attempt(), success: false }]),
      today,
    );
    expect(stats.totalXP).toBe(rewards.exercise);
    expect(stats.streak).toBe(0);
    expect(stats.completedNodes).toBe(0);
  });
  it("deduplicates retries and result IDs that reuse the same completed exercises", () => {
    const r = result();
    const stats = learningStats(
      progress(
        [r, r, { ...r, id: randomUUID() }],
        [...r.attempts, ...r.attempts],
      ),
      today,
    );
    expect(stats.totalXP).toBe(40);
    expect(stats.sessions).toBe(1);
  });
  it("awards quick practice 15 XP and does not unlock a path lesson", () => {
    const r: LessonResult = {
      ...result(),
      nodeId: undefined,
      sessionKind: "practice",
      attempts: [attempt()],
    };
    expect(resultSchema.safeParse(r).success).toBe(true);
    const stats = learningStats(progress([r]), today);
    expect(resultXP(r)).toBe(15);
    expect(stats.totalXP).toBe(15);
    expect(stats.streak).toBe(1);
    expect(stats.lessons).toBe(0);
    expect(stats.completedNodes).toBe(0);
  });
  it("requires three different successful exercises for path sessions", () => {
    const r = result();
    expect(
      resultSchema.safeParse({ ...r, attempts: [attempt()] }).success,
    ).toBe(false);
    expect(
      resultSchema.safeParse({ ...r, sessionKind: "practice" }).success,
    ).toBe(false);
    expect(
      resultSchema.safeParse({
        ...r,
        attempts: r.attempts.map((a) => ({ ...a, success: false })),
      }).success,
    ).toBe(false);
    expect(
      resultSchema.safeParse({ ...r, practiceDate: "2026-02-31" }).success,
    ).toBe(false);
  });
  it("fully completes the functional six-session unit with a 35 XP review", () => {
    const results = learningPath.map((n) => result(today, n.id));
    const stats = learningStats(progress(results), today);
    expect(stats.totalXP).toBe(235);
    expect(stats.completedNodes).toBe(6);
    expect(stats.unitComplete).toBe(true);
    expect(stats.currentNode).toBeNull();
    expect(stats.level.level).toBe(2);
  });
  it("retains progression for previously saved lessons without new fields", () => {
    const r = result();
    delete r.nodeId;
    delete r.sessionKind;
    delete r.practiceDate;
    expect(resultSchema.safeParse(r).success).toBe(true);
    expect(learningStats(progress([r]), today).path[0].state).toBe("completed");
  });
});
describe("calendar streaks and level boundaries", () => {
  it("counts dates, not repeat sessions, and preserves yesterday’s streak", () => {
    const results = [
      result("2026-09-27"),
      result("2026-09-28"),
      result("2026-09-28"),
    ];
    expect(learningStats(progress(results), today).streak).toBe(2);
    expect(
      learningStats(progress([...results, result(today), result(today)]), today)
        .streak,
    ).toBe(3);
  });
  it("resets after a missed day and excludes earlier XP from today’s goal", () => {
    const stats = learningStats(progress([result("2026-09-27")]), today);
    expect(stats.streak).toBe(0);
    expect(stats.todayXP).toBe(0);
    expect(stats.totalXP).toBe(40);
  });
  it("uses the stored practice date across UTC midnight", () => {
    const r = result(today);
    r.createdAt = "2026-09-28T22:00:00.000Z";
    r.attempts = r.attempts.map((a) => ({ ...a, createdAt: r.createdAt }));
    expect(learningStats(progress([r]), today).todayXP).toBe(40);
    expect(learningStats(progress([r]), today).lastPracticeDate).toBe(today);
  });
  it("derives levels consistently at thresholds and beyond the initial levels", () => {
    expect(levelForXP(99).level).toBe(1);
    expect(levelForXP(100).level).toBe(2);
    expect(levelForXP(249).level).toBe(2);
    expect(levelForXP(250).level).toBe(3);
    expect(levelForXP(1000).level).toBe(6);
    expect(levelForXP(1400)).toEqual({
      level: 7,
      start: 1400,
      next: 1800,
      progress: 0,
    });
  });
  it("derives mastery using demonstrated repeat accuracy", () => {
    expect(gestureMastery([], "palm").state).toBe("New");
    expect(gestureMastery([attempt()], "palm").state).toBe("Learning");
    expect(gestureMastery([attempt(), attempt()], "palm").state).toBe("Good");
    expect(
      gestureMastery(
        Array.from({ length: 5 }, () => attempt()),
        "palm",
      ).state,
    ).toBe("Mastered");
    expect(
      gestureMastery(
        Array.from({ length: 5 }, () => ({ ...attempt(), score: 70 })),
        "palm",
      ).state,
    ).toBe("Learning");
  });
});
