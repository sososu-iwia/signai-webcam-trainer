import type { DualGestureDefinition } from "../../shared/catalog";
import { evaluateGesture } from "./evaluateGesture";
import { extractFeatures } from "./features";
import { clamp, rangeScore } from "./geometry";
import { semanticHands } from "./hands";
import { trackingQuality } from "./trackingQuality";
import type {
  CameraFrame,
  CorrectionCode,
  Evaluation,
  Mistake,
  TrackedHands,
} from "./types";
export function dualFeatures(hands: TrackedHands) {
  if (!hands.left || !hands.right) return null;
  const left = extractFeatures(hands.left),
    right = extractFeatures(hands.right);
  if (!left || !right) return null;
  const aspect = hands.left.aspectRatio ?? 1;
  const size = (left.scale + right.scale) / 2;
  if (size < 1e-6) return null;
  const dx = ((right.center.x - left.center.x) * Math.max(1, aspect)) / size;
  const dy = (right.center.y - left.center.y) / Math.min(1, aspect) / size;
  const lw = hands.left.landmarks[0],
    rw = hands.right.landmarks[0];
  const orientation = Math.abs(
    left.normal.x * right.normal.x +
      left.normal.y * right.normal.y +
      left.normal.z * right.normal.z,
  );
  const symmetry =
    1 -
    Object.keys(left.extension).reduce(
      (sum, key) =>
        sum +
        Math.abs(
          left.extension[key as keyof typeof left.extension] -
            right.extension[key as keyof typeof right.extension],
        ),
      0,
    ) /
      5;
  return {
    wristDistance:
      Math.hypot(
        (rw.x - lw.x) * Math.max(1, aspect),
        (rw.y - lw.y) / Math.min(1, aspect),
      ) / size,
    palmDistance: Math.hypot(dx, dy),
    horizontal: dx,
    vertical: dy,
    higher:
      dy > 0
        ? ("left" as const)
        : dy < 0
          ? ("right" as const)
          : ("same" as const),
    depthDifference: null,
    orientation: clamp(orientation),
    symmetry: clamp(symmetry),
  };
}
export function dualTracking(frame: CameraFrame) {
  const hands = semanticHands(frame),
    count = Number(Boolean(hands.left)) + Number(Boolean(hands.right));
  if (count < 2)
    return {
      kind: "missing" as const,
      message: "",
      mistake: {
        category: "visibility" as const,
        severity: 3,
        message: "",
        code: count === 0 ? ("SHOW_BOTH" as const) : ("KEEP_BOTH" as const),
      },
    };
  for (const side of ["left", "right"] as const) {
    const quality = trackingQuality(hands[side]!);
    if (quality.kind !== "ready")
      return {
        ...quality,
        message: "",
        mistake: {
          category: "visibility" as const,
          severity: 3,
          message: "",
          code: "WHOLE_HAND" as const,
          hand: side,
        },
      };
  }
  return { kind: "ready" as const, message: "", mistake: null };
}
export function evaluateDual(
  frame: CameraFrame,
  target: DualGestureDefinition,
): Evaluation {
  const hands = semanticHands(frame),
    quality = dualTracking(frame);
  const base: Evaluation = {
    gestureId: target.id,
    score: 0,
    confidence: 0,
    isCorrect: false,
    mistakes: [],
    featureScores: {},
    handScores: { left: 0, right: 0, relationship: 0 },
  };
  if (quality.kind !== "ready")
    return { ...base, mistakes: quality.mistake ? [quality.mistake] : [] };
  const left = evaluateGesture(hands.left!, target.leftHand),
    right = evaluateGesture(hands.right!, target.rightHand),
    features = dualFeatures(hands);
  if (!left || !right || !features) return base;
  const mistakes: Mistake[] = [];
  for (const [side, evaluation, pose] of [
    ["left", left, target.leftHand],
    ["right", right, target.rightHand],
  ] as const)
    for (const m of evaluation.mistakes) {
      const finger = Object.hasOwn(pose.fingers, m.category)
        ? (m.category as keyof typeof pose.fingers)
        : undefined;
      const code: CorrectionCode =
        m.code ||
        (finger
          ? pose.fingers[finger] === "extended"
            ? "EXTEND_FINGER"
            : "FOLD_FINGER"
          : m.category === "orientation"
            ? "TURN_PALM"
            : "WHOLE_HAND");
      mistakes.push({ ...m, message: "", hand: side, finger, code });
    }
  const relation = target.relationship;
  const scores: number[] = [];
  const add = (
    score: number,
    code: CorrectionCode,
    hand?: "left" | "right",
  ) => {
    scores.push(Number.isFinite(score) ? score : 0);
    if (!Number.isFinite(score) || score < 0.8)
      mistakes.push({
        category: "position",
        severity: 1.6,
        message: "",
        code,
        hand,
      });
  };
  add(
    rangeScore(features.palmDistance, ...relation.distanceRange, 1),
    features.palmDistance < relation.distanceRange[0]
      ? "HANDS_APART"
      : "HANDS_CLOSER",
  );
  if (relation.verticalRelation === "same")
    add(
      rangeScore(Math.abs(features.vertical), 0, relation.tolerance, 0.5),
      "SAME_HEIGHT",
    );
  else {
    const side = relation.verticalRelation === "left-above" ? "left" : "right";
    add(
      rangeScore(
        side === "left" ? features.vertical : -features.vertical,
        relation.tolerance,
        4,
        0.5,
      ),
      "RAISE_HAND",
      side,
    );
  }
  add(
    rangeScore(
      relation.horizontalRelation === "apart"
        ? Math.abs(features.horizontal)
        : features.horizontal,
      0.6,
      8,
      0.5,
    ),
    "SEPARATE_HORIZONTALLY",
  );
  if (relation.orientationRelation === "parallel")
    add(rangeScore(features.orientation, 0.8, 1, 0.4), "ALIGN_PALMS");
  const relationship =
    (scores.reduce((sum, s) => sum + s, 0) / scores.length) * 100;
  const weights = [
    target.weights.left,
    target.weights.right,
    target.weights.relationship,
  ].map((w) => (Number.isFinite(w) ? Math.max(0, w) : 0));
  const largest = Math.max(...weights);
  const normalized = weights.map((weight) => (largest ? weight / largest : 0));
  const total = normalized.reduce((a, b) => a + b, 0);
  const score = total
    ? Math.round(
        (left.score * normalized[0] +
          right.score * normalized[1] +
          relationship * normalized[2]) /
          total,
      )
    : 0;
  mistakes.sort((a, b) => b.severity - a.severity);
  return {
    ...base,
    score,
    confidence: Math.min(left.confidence, right.confidence),
    isCorrect: score >= target.thresholds.success && mistakes.length === 0,
    mistakes,
    handScores: {
      left: left.score,
      right: right.score,
      relationship: Math.round(relationship),
    },
    featureScores: {
      left: left.score,
      right: right.score,
      relationship: Math.round(relationship),
    },
  };
}
