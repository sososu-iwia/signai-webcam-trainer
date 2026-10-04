import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";
import {
  courseNodes,
  courseProgress,
  courseUnits,
  exerciseSteps,
  exerciseTypes,
} from "../shared/course";
import {
  attemptSchema,
  resultSchema,
  summarize,
  type Attempt,
  type LessonResult,
} from "../shared/schema";
import {
  gestureMastery,
  learningStats,
  resultXP,
  uniqueResults,
} from "../shared/learning";
import { courseGestures, courseGestureIds } from "../shared/catalog";
import { Store } from "../server/storage";
import { createApp } from "../server/app";
import { en } from "../src/i18n/en";
import { ru } from "../src/i18n/ru";
import { correctionText } from "../src/i18n/feedback";
import type { CorrectionCode } from "../src/gesture-engine/types";
function session(
  node = courseUnits[0].nodes[0],
  quizCorrect = true,
): LessonResult {
  const createdAt = new Date().toISOString();
  const attempts = exerciseSteps(node.exercise).map((step): Attempt => ({
    id: randomUUID(),
    userId: "demo",
    lessonId: node.unitId,
    gestureId: step.gestureId,
    exerciseId: step.id,
    exerciseType: step.type,
    hintUsed: false,
    score: step.type === "SIGN_RECOGNITION" && !quizCorrect ? 0 : 95,
    success: step.type !== "SIGN_RECOGNITION" || quizCorrect,
    durationMs: 1000,
    mistakes: [],
    corrections: 0,
    createdAt,
  }));
  return {
    id: randomUUID(),
    userId: "demo",
    lessonId: node.unitId,
    courseNodeId: node.id,
    sessionKind: "lesson",
    attempts,
    durationMs: attempts.length * 1000,
    createdAt,
  };
}
describe("course exercise data, rewards and persistence", () => {
  it("defines exactly three units, nine targets and all six exercise types", () => {
    expect(courseUnits).toHaveLength(3);
    expect(courseGestureIds).toHaveLength(9);
    expect(courseUnits.map((u) => u.nodes.length)).toEqual([9, 9, 9]);
    expect(new Set(courseNodes.map((n) => n.exercise.type))).toEqual(
      new Set(exerciseTypes),
    );
    expect(new Set(courseNodes.map((n) => n.id)).size).toBe(courseNodes.length);
    expect(exerciseSteps(courseUnits[0].demo!.exercise)).toHaveLength(3);
    expect(exerciseSteps(courseUnits[2].nodes.at(-1)!.exercise)).toHaveLength(
      13,
    );
    expect(
      courseNodes.every((n) =>
        exerciseSteps(n.exercise).every((s) =>
          courseGestureIds.includes(s.gestureId),
        ),
      ),
    ).toBe(true);
  });
  it("validates the precise step sequence for every course activity", () => {
    for (const node of courseNodes) {
      const result = session(node);
      expect(resultSchema.safeParse(result).success, node.id).toBe(true);
      expect(resultSchema.safeParse({ ...result, attempts: [] }).success).toBe(
        false,
      );
      const wrong = structuredClone(result);
      wrong.attempts[0].exerciseId = "made-up";
      expect(resultSchema.safeParse(wrong).success).toBe(false);
      expect(
        resultSchema.safeParse({ ...result, lessonId: "handshape-basics" })
          .success,
      ).toBe(false);
    }
  });
  it("keeps legacy mastery separate from new targets with additional rules", () => {
    const attempt = { ...session().attempts[0], gestureId: "palm" as const };
    expect(gestureMastery([attempt], "palm").count).toBe(1);
    expect(gestureMastery([attempt], "kz-v").count).toBe(0);
  });
  it("allows an answered incorrect recognition exercise without inventing XP or mastery", () => {
    const result = session(courseUnits[0].nodes[4], false);
    expect(resultSchema.safeParse(result).success).toBe(true);
    expect(resultXP(result)).toBe(0);
    const stats = learningStats({
      attempts: result.attempts,
      results: [result],
    });
    expect(stats.totalXP).toBe(0);
    expect(stats.courseMastery.find((m) => m.gestureId === "kz-a")?.count).toBe(
      0,
    );
    const correct = session(courseUnits[0].nodes[4]);
    expect(resultXP(correct)).toBe(5);
    expect(
      summarize({ attempts: correct.attempts, results: [correct] }).learned,
    ).toBe(0);
    const camera = session();
    expect(
      summarize({ attempts: camera.attempts, results: [camera] }).learned,
    ).toBe(1);
    expect(
      learningStats({
        attempts: correct.attempts,
        results: [correct],
      }).courseMastery.find((m) => m.gestureId === "kz-a")?.count,
    ).toBe(0);
  });
  it("requires a checkpoint to unlock the next unit and derives demo progress", () => {
    const demo = session(courseUnits[0].demo!);
    let progress = courseProgress({ attempts: demo.attempts, results: [demo] });
    expect(progress[0].nodes.slice(0, 3).every((n) => n.done)).toBe(true);
    expect(progress[0].nodes[3].unlocked).toBe(true);
    expect(progress[1].unlocked).toBe(false);
    const checkpoint = session(courseUnits[0].nodes.at(-1)!);
    progress = courseProgress({ attempts: [], results: [demo, checkpoint] });
    expect(progress[1].unlocked).toBe(true);
    expect(progress[2].unlocked).toBe(false);
    expect(
      courseProgress({
        attempts: [],
        results: [checkpoint, session(courseUnits[1].nodes.at(-1)!)],
      })[2].unlocked,
    ).toBe(true);
  });
  it("deduplicates repeated result IDs and completion retries without changing XP", () => {
    const result = session(courseUnits[0].demo!);
    const retry = { ...result, id: randomUUID() };
    expect(uniqueResults([result, retry])).toHaveLength(1);
    const stats = learningStats({
      attempts: [...result.attempts, ...result.attempts],
      results: [result, retry],
    });
    expect(stats.totalXP).toBe(40);
    expect(stats.courseMastery.filter((m) => m.count === 1)).toHaveLength(3);
  });
  it("retains strict stable IDs and rejects media in new attempts", () => {
    const attempt = session().attempts[0];
    expect(
      attemptSchema.safeParse({ ...attempt, gestureId: "А" }).success,
    ).toBe(false);
    expect(attemptSchema.safeParse({ ...attempt, landmarks: [] }).success).toBe(
      false,
    );
    expect(attemptSchema.safeParse({ ...attempt, score: NaN }).success).toBe(
      false,
    );
  });
  it("stores mixed course checkpoints atomically and idempotently through the existing API", async () => {
    const store = new Store(":memory:");
    try {
      const app = createApp(store),
        result = session(courseUnits[0].nodes.at(-1)!, false);
      expect(
        (await request(app).post("/api/lesson-results").send(result)).status,
      ).toBe(201);
      const retry = await request(app)
        .post("/api/lesson-results")
        .send({ ...result, id: randomUUID() });
      expect(retry.body.id).toBe(result.id);
      const saved = (await request(app).get("/api/progress")).body;
      expect(saved.results).toHaveLength(1);
      expect(saved.attempts).toHaveLength(result.attempts.length);
      expect(saved.learning.totalXP).toBe(resultXP(result));
    } finally {
      store.close();
    }
  });
});
describe("new bilingual curriculum and structured corrections", () => {
  it("has complete EN/RU content without display IDs", () => {
    const messages = [
      ...courseUnits.flatMap((u) => [u.titleKey, u.descriptionKey]),
      ...courseNodes.flatMap((n) => [n.titleKey, n.exercise.instructionKey]),
      ...courseGestures.flatMap((g) => [g.shortInstruction, ...g.tips]),
    ];
    for (const message of messages) {
      expect(Object.hasOwn(en, message), message).toBe(true);
      expect(Object.hasOwn(ru, message), message).toBe(true);
    }
    const codes: CorrectionCode[] = [
      "CONNECT_FINGERS",
      "SPREAD_FINGERS",
      "CLOSE_FINGERS",
      "TURN_DOWN",
      "TURN_UP",
      "EXTEND_FINGER",
      "FOLD_FINGER",
      "RAISE_HAND",
      "LOWER_HAND",
      "TURN_PALM",
      "HANDS_APART",
      "HANDS_CLOSER",
      "SAME_HEIGHT",
      "SHOW_BOTH",
      "KEEP_BOTH",
      "WHOLE_HAND",
      "SEPARATE_HORIZONTALLY",
      "ALIGN_PALMS",
    ];
    for (const code of codes)
      for (const hand of ["left", "right"] as const) {
        const mistake = {
          category: "index" as const,
          message: "",
          severity: 1,
          code,
          hand,
          finger: "index" as const,
        };
        expect(correctionText("en", mistake)).toMatch(/[A-Za-z]/);
        expect(correctionText("ru", mistake)).toMatch(/[А-Яа-яЁё]/);
        expect(correctionText("ru", mistake)).not.toMatch(/\{|[A-Z_]{3}/);
      }
  });
});
