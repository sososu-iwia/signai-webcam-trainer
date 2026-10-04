import { courseNodes, exerciseSteps, findCourseNode } from "./course.js";
import { getGesture, courseGestureIds, type GestureId } from "./catalog.js";
import type { Attempt, LessonResult, Progress } from "./schema.js";
export const rewards = {
  exercise: 10,
  lessonBonus: 10,
  practiceBonus: 5,
  dailyGoal: 40,
} as const;
export const nodeIds = [
  "warm-up",
  "open-palm",
  "closed-fist",
  "v-handshape",
  "practice",
  "checkpoint",
] as const;
export type NodeId = (typeof nodeIds)[number];
export interface LearningNode {
  id: NodeId;
  title: string;
  description: string;
  kind: "lesson" | "practice" | "checkpoint";
  gesture?: GestureId;
}
export const learningPath: LearningNode[] = [
  {
    id: "warm-up",
    title: "Warm Up",
    description:
      "Meet your camera coach. Try all three shapes, one small step at a time.",
    kind: "lesson",
  },
  {
    id: "open-palm",
    title: "Open Palm",
    description:
      "Lead with an open palm, then put all three shapes into practice.",
    kind: "lesson",
    gesture: "palm",
  },
  {
    id: "closed-fist",
    title: "Closed Fist",
    description:
      "Build confidence folding your fingers as you revisit all three shapes.",
    kind: "lesson",
    gesture: "fist",
  },
  {
    id: "v-handshape",
    title: "V Handshape",
    description:
      "Work on finger separation and bring your three shapes together.",
    kind: "lesson",
    gesture: "victory",
  },
  {
    id: "practice",
    title: "Mix & Practice",
    description:
      "Repeat all three shapes and turn small adjustments into confidence.",
    kind: "practice",
  },
  {
    id: "checkpoint",
    title: "Unit Checkpoint",
    description:
      "Complete the three shapes once more to finish your first unit.",
    kind: "checkpoint",
  },
];
export const levelThresholds = [0, 100, 250, 450, 700, 1000];
export function levelForXP(xp: number) {
  let level = 1;
  while (level < levelThresholds.length && xp >= levelThresholds[level])
    level++;
  if (xp >= 1000) level = 6 + Math.floor((xp - 1000) / 400);
  const start =
    level <= 6 ? levelThresholds[level - 1] : 1000 + (level - 6) * 400;
  const next = level < 6 ? levelThresholds[level] : start + 400;
  return {
    level,
    start,
    next,
    progress: Math.min(100, ((xp - start) / (next - start)) * 100),
  };
}
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function priorDay(day: string) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return localDay(date);
}
const exerciseRewards = new Map(
  courseNodes
    .flatMap((n) => exerciseSteps(n.exercise))
    .map((step) => [step.id, step.xp]),
);
export function attemptXP(attempt: Attempt) {
  return attempt.success
    ? (attempt.exerciseId && exerciseRewards.get(attempt.exerciseId)) ||
        (attempt.exerciseType === "SIGN_RECOGNITION" ? 5 : rewards.exercise)
    : 0;
}
export function resultBonus(result: LessonResult) {
  return result.courseNodeId
    ? (findCourseNode(result.courseNodeId)?.finishXP ?? 0)
    : result.sessionKind === "practice"
      ? rewards.practiceBonus
      : rewards.lessonBonus;
}
export function resultXP(result: LessonResult) {
  return (
    result.attempts.reduce((sum, a) => sum + attemptXP(a), 0) +
    resultBonus(result)
  );
}
export function uniqueResults(results: LessonResult[]) {
  const keys = new Set<string>();
  return [...new Map(results.map((result) => [result.id, result])).values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .filter((result) => {
      const key = result.attempts
        .map((a) => a.id)
        .sort()
        .join("|");
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    });
}
export function gestureMastery(attempts: Attempt[], gestureId: GestureId) {
  const items = attempts.filter(
    (a) => a.gestureId === gestureId && a.exerciseType !== "SIGN_RECOGNITION",
  );
  const average = items.length
    ? Math.round(items.reduce((sum, a) => sum + a.score, 0) / items.length)
    : 0;
  const successes = items.filter((a) => a.success).length;
  const best = items.length
    ? Math.round(Math.max(...items.map((a) => a.score)))
    : 0;
  const state = !items.length
    ? "New"
    : successes >= 5 && average >= 90
      ? "Mastered"
      : successes >= 2 && average >= 80
        ? "Good"
        : "Learning";
  return {
    gestureId,
    label: getGesture(gestureId).label,
    state,
    average,
    best,
    successes,
    count: items.length,
  };
}
export function learningStats(progress: Progress, today = localDay()) {
  const results = uniqueResults(progress.results);
  const attempts = [
    ...new Map(
      [...progress.attempts, ...results.flatMap((r) => r.attempts)].map((a) => [
        a.id,
        a,
      ]),
    ).values(),
  ];
  const successes = attempts.filter((a) => a.success);
  const bonus = resultBonus;
  const totalXP =
    successes.reduce((sum, a) => sum + attemptXP(a), 0) +
    results.reduce((sum, r) => sum + bonus(r), 0);
  const todayXP =
    successes.filter(
      (a) => (a.practiceDate || localDay(new Date(a.createdAt))) === today,
    ).length *
      rewards.exercise +
    results
      .filter(
        (r) => (r.practiceDate || localDay(new Date(r.createdAt))) === today,
      )
      .reduce((sum, r) => sum + bonus(r), 0);
  const days = new Set(
    results
      .map((r) => r.practiceDate || localDay(new Date(r.createdAt)))
      .filter((day) => day <= today),
  );
  let day = days.has(today) ? today : priorDay(today),
    streak = 0;
  while (days.has(day)) {
    streak++;
    day = priorDay(day);
  }
  const completed = new Set<NodeId>(
    results.filter((r) => r.nodeId).map((r) => r.nodeId!),
  );
  if (
    results.some(
      (r) => !r.nodeId && !r.courseNodeId && r.sessionKind !== "practice",
    )
  )
    completed.add("warm-up");
  const currentIndex = learningPath.findIndex(
    (node) => !completed.has(node.id),
  );
  const path = learningPath.map((node, i) => ({
    ...node,
    state: completed.has(node.id)
      ? ("completed" as const)
      : i === currentIndex
        ? ("current" as const)
        : ("locked" as const),
  }));
  return {
    totalXP,
    todayXP,
    streak,
    lastPracticeDate: [...days].sort().at(-1) || null,
    level: levelForXP(totalXP),
    path,
    completedNodes: completed.size,
    unitComplete: currentIndex === -1,
    currentNode: learningPath[currentIndex] || null,
    lessons: results.filter((r) => r.sessionKind !== "practice").length,
    sessions: results.length,
    practicedToday: days.has(today),
    courseMastery: courseGestureIds.map((id) => gestureMastery(attempts, id)),
    mastery: (["palm", "fist", "victory"] as const).map((id) =>
      gestureMastery(attempts, id),
    ),
  };
}
export function nodeTrainerUrl(node: LearningNode) {
  return `/trainer/handshape-basics?node=${node.id}`;
}

export function completionKey(result: LessonResult) {
  return result.attempts
    .map((a) => a.id)
    .sort()
    .join("|");
}
export function practiceRecommendation(progress: Progress) {
  const attempts = [...progress.attempts].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const missed = attempts
    .slice(0, 8)
    .find(
      (a) =>
        !a.success &&
        !attempts.some(
          (later) =>
            later.gestureId === a.gestureId &&
            later.success &&
            later.createdAt > a.createdAt,
        ),
    );
  const stats = learningStats(progress);
  const weakest = [...stats.mastery, ...stats.courseMastery]
    .filter((m) => m.count)
    .sort((a, b) => a.average - b.average)[0];
  const gestureId = missed?.gestureId || weakest?.gestureId;
  return gestureId
    ? {
        ...gestureMastery(attempts, gestureId),
        gestureId,
        label: getGesture(gestureId).label,
        reason: missed ? "missed" : "average",
      }
    : null;
}
