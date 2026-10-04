import { unitIds, exerciseTypes, courseResultValid } from "./course.js";
import { z } from "zod";
import { gestureIds, supportedGestureIds } from "./catalog.js";
import { nodeIds } from "./learning.js";
const practiceDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  });
export const mistakeCategories = [
  "thumb",
  "index",
  "middle",
  "ring",
  "pinky",
  "separation",
  "orientation",
  "position",
  "scale",
  "visibility",
] as const;
export const attemptSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.literal("demo"),
    lessonId: z.enum(["handshape-basics", ...unitIds]),
    gestureId: z.enum(supportedGestureIds),
    exerciseId: z.string().max(120).optional(),
    exerciseType: z.enum(exerciseTypes).optional(),
    hintUsed: z.boolean().optional(),
    score: z.number().min(0).max(100),
    success: z.boolean(),
    durationMs: z.number().int().min(0).max(86400000),
    mistakes: z.array(z.enum(mistakeCategories)).max(10),
    corrections: z.number().int().min(0).max(100000),
    createdAt: z.string().datetime(),
    practiceDate: practiceDateSchema.optional(),
  })
  .strict();
export const resultSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.literal("demo"),
    lessonId: z.enum(["handshape-basics", ...unitIds]),
    attempts: z.array(attemptSchema).min(1).max(20),
    courseNodeId: z.string().max(120).optional(),
    nodeId: z.enum(nodeIds).optional(),
    sessionKind: z.enum(["lesson", "practice"]).optional(),
    durationMs: z.number().int().min(0).max(86400000),
    createdAt: z.string().datetime(),
    practiceDate: practiceDateSchema.optional(),
  })
  .strict()
  .refine((r) => {
    if (r.courseNodeId)
      return (
        new Set(r.attempts.map((a) => a.id)).size === r.attempts.length &&
        !r.nodeId &&
        courseResultValid(r)
      );
    if (r.lessonId !== "handshape-basics") return false;
    if (
      !r.attempts.every((a) => a.success) ||
      new Set(r.attempts.map((a) => a.id)).size !== r.attempts.length
    )
      return false;
    if (r.nodeId && r.nodeId !== "practice" && r.sessionKind === "practice")
      return false;
    if (r.nodeId === "practice" && r.sessionKind !== "practice") return false;
    if (r.sessionKind === "practice" && !r.nodeId)
      return (
        r.attempts.length === 1 ||
        (r.attempts.length === 3 &&
          gestureIds.every((id) => r.attempts.some((a) => a.gestureId === id)))
      );
    return (
      r.attempts.length === 3 &&
      gestureIds.every(
        (id) => r.attempts.filter((a) => a.gestureId === id).length === 1,
      )
    );
  }, "Complete every required exercise once before saving a session.");
export type Attempt = z.infer<typeof attemptSchema>;
export type LessonResult = z.infer<typeof resultSchema>;
export const progressSchema = z.object({
  attempts: z.array(attemptSchema),
  results: z.array(resultSchema),
});
export type Progress = z.infer<typeof progressSchema>;
export const emptyProgress: Progress = { attempts: [], results: [] };
export function summarize(progress: Progress) {
  const scores = progress.attempts.map((a) => a.score);
  return {
    lessons: progress.results.filter((r) => r.sessionKind !== "practice")
      .length,
    attempts: scores.length,
    average: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0,
    best: scores.length ? Math.round(Math.max(...scores)) : 0,
    learned: new Set(
      progress.attempts
        .filter((a) => a.success && a.exerciseType !== "SIGN_RECOGNITION")
        .map((a) => a.gestureId),
    ).size,
  };
}
