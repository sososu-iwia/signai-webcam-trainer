import {
  courseGestureIds,
  type CourseGestureId,
  type GestureId,
} from "./catalog.js";
import type { Attempt, Progress } from "./schema.js";
export const exerciseTypes = [
  "LEARN_COPY",
  "ERROR_COACH",
  "CAMERA_RECALL",
  "SIGN_RECOGNITION",
  "QUICK_SIGNS",
  "CHECKPOINT",
] as const;
export type ExerciseType = (typeof exerciseTypes)[number];
export const unitIds = [
  "first-handshapes",
  "finger-control",
  "precision",
] as const;
export type UnitId = (typeof unitIds)[number];
export interface ExerciseDefinition {
  id: string;
  type: ExerciseType;
  gestureIds: CourseGestureId[];
  titleKey: string;
  instructionKey: string;
  xp: number;
  config: {
    options?: CourseGestureId[];
    steps?: ExerciseDefinition[];
    hint?: boolean;
  };
}
export interface CourseNode {
  id: string;
  unitId: UnitId;
  titleKey: string;
  finishXP: number;
  exercise: ExerciseDefinition;
}
export interface CourseUnit {
  id: UnitId;
  titleKey: string;
  descriptionKey: string;
  gestureIds: CourseGestureId[];
  nodes: CourseNode[];
  demo?: CourseNode;
}
export interface ExerciseStep {
  id: string;
  type: Exclude<ExerciseType, "QUICK_SIGNS" | "CHECKPOINT">;
  gestureId: CourseGestureId;
  xp: number;
  options?: CourseGestureId[];
  hint: boolean;
  sequence?: { index: number; total: number };
}
const titles: Record<ExerciseType, string> = {
  LEARN_COPY: "Learn & Copy",
  ERROR_COACH: "Error Coach",
  CAMERA_RECALL: "Camera Recall",
  SIGN_RECOGNITION: "Sign Recognition",
  QUICK_SIGNS: "Quick Signs",
  CHECKPOINT: "Checkpoint",
};
const instructions: Record<ExerciseType, string> = {
  LEARN_COPY: "Follow the reference and hold the handshape.",
  ERROR_COACH: "Follow one correction at a time. Small adjustments count.",
  CAMERA_RECALL:
    "Show the letter from memory. Reveal a hint whenever you need it.",
  SIGN_RECOGNITION: "Which letter is this?",
  QUICK_SIGNS: "Hold each target. The next one appears automatically.",
  CHECKPOINT: "Combine recognition, recall and a short camera sequence.",
};
function exercise(
  id: string,
  type: ExerciseType,
  gestureIds: CourseGestureId[],
  config: ExerciseDefinition["config"] = {},
): ExerciseDefinition {
  return {
    id,
    type,
    gestureIds,
    titleKey: titles[type],
    instructionKey: instructions[type],
    xp: type === "SIGN_RECOGNITION" ? 5 : 10,
    config,
  };
}
export const courseUnits: CourseUnit[] = unitIds.map((id, index) => {
  const own = courseGestureIds.slice(index * 3, index * 3 + 3);
  const reviewed = courseGestureIds.slice(0, index * 3 + 3);
  const options = [
    ...own,
    ...courseGestureIds.filter((g) => !own.includes(g)).slice(0, 1),
  ];
  const node = (
    suffix: string,
    type: ExerciseType,
    ids: CourseGestureId[],
    config?: ExerciseDefinition["config"],
  ): CourseNode => ({
    id: `${id}-${suffix}`,
    unitId: id,
    titleKey: titles[type],
    finishXP: type === "SIGN_RECOGNITION" ? 0 : 10,
    exercise: exercise(`${id}-${suffix}`, type, ids, config),
  });
  const checkpoint = node("checkpoint", "CHECKPOINT", reviewed, {
    steps: [
      exercise(`${id}-check-recognize`, "SIGN_RECOGNITION", [own[0]], {
        options,
      }),
      exercise(`${id}-check-coach`, "ERROR_COACH", [own[2]]),
      exercise(`${id}-check-copy`, "LEARN_COPY", [own[1]]),
      exercise(`${id}-check-recall`, "CAMERA_RECALL", [own[0]], { hint: true }),
      exercise(`${id}-check-quick`, "QUICK_SIGNS", reviewed),
    ],
  });
  return {
    id,
    titleKey: ["First Handshapes", "Finger Control", "Precision"][index],
    descriptionKey: [
      "Start with А, В and Ү. Three static targets, one reliable first step.",
      "Build finger independence with О, У and И.",
      "Control direction and precision with Л, М and Н.",
    ][index],
    gestureIds: own,
    nodes: [
      node("copy-a", "LEARN_COPY", [own[0]]),
      node("copy-b", "LEARN_COPY", [own[1]]),
      node("copy-c", "LEARN_COPY", [own[2]]),
      node("coach", "ERROR_COACH", own),
      node("recognize", "SIGN_RECOGNITION", [own[0]], { options }),
      node("recall-a", "CAMERA_RECALL", [own[0]], { hint: true }),
      node("recall-c", "CAMERA_RECALL", [own[2]], { hint: true }),
      node(
        "quick",
        "QUICK_SIGNS",
        index ? [own[0], reviewed[0], own[1], reviewed[2], own[2]] : own,
      ),
      checkpoint,
    ],
    demo: index === 0 ? node("demo", "QUICK_SIGNS", own) : undefined,
  };
});
export const courseNodes = courseUnits.flatMap((u) => [
  ...u.nodes,
  ...(u.demo ? [u.demo] : []),
]);
export function findCourseNode(id: string | undefined) {
  return courseNodes.find((n) => n.id === id);
}
export function exerciseSteps(definition: ExerciseDefinition): ExerciseStep[] {
  if (definition.type === "CHECKPOINT")
    return (definition.config.steps || []).flatMap(exerciseSteps);
  return definition.gestureIds.map((gestureId, index) => ({
    id: `${definition.id}:${index}`,
    type:
      definition.type === "QUICK_SIGNS"
        ? "ERROR_COACH"
        : (definition.type as ExerciseStep["type"]),
    gestureId,
    xp: definition.xp,
    options: definition.config.options,
    hint: definition.config.hint ?? false,
    sequence:
      definition.type === "QUICK_SIGNS"
        ? { index: index + 1, total: definition.gestureIds.length }
        : undefined,
  }));
}
export function courseProgress(progress: Progress) {
  const completed = new Set(
    progress.results.map((r) => r.courseNodeId).filter(Boolean),
  );
  for (const unit of courseUnits)
    if (unit.demo && completed.has(unit.demo.id))
      unit.nodes.slice(0, 3).forEach((node) => completed.add(node.id));
  return courseUnits.map((unit, index) => ({
    ...unit,
    unlocked:
      index === 0 || completed.has(courseUnits[index - 1].nodes.at(-1)!.id),
    completed: completed.has(unit.nodes.at(-1)!.id),
    nodes: unit.nodes.map((node, i) => ({
      ...node,
      done: completed.has(node.id),
      unlocked:
        (index === 0 ||
          completed.has(courseUnits[index - 1].nodes.at(-1)!.id)) &&
        (i === 0 || completed.has(unit.nodes[i - 1].id)),
    })),
  }));
}
export function courseResultValid(result: {
  courseNodeId?: string;
  lessonId: string;
  attempts: Attempt[];
}) {
  const node = findCourseNode(result.courseNodeId);
  if (!node || node.unitId !== result.lessonId) return false;
  const steps = exerciseSteps(node.exercise);
  return (
    steps.length === result.attempts.length &&
    steps.every((step, index) => {
      const attempt = result.attempts[index];
      return (
        attempt.exerciseId === step.id &&
        attempt.exerciseType === step.type &&
        attempt.gestureId === step.gestureId &&
        attempt.lessonId === node.unitId &&
        (attempt.success || step.type === "SIGN_RECOGNITION")
      );
    })
  );
}
export function courseGesture(gestureId: GestureId) {
  return courseGestureIds.includes(gestureId as CourseGestureId);
}
