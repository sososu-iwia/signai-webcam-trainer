import type { Finger, GestureDefinition } from "../../shared/catalog";
import { extractFeatures } from "./features";
import { clamp, rangeScore } from "./geometry";
import type { Evaluation, HandFeatures, HandInput, Mistake } from "./types";
export function evaluateFeatures(
  f: HandFeatures,
  gesture: GestureDefinition,
): Evaluation {
  const mistakes: Mistake[] = [];
  const featureScores: Record<string, number> = {};
  let total = 0,
    weight = 0;
  const add = (key: string, value: number, importance: number) => {
    featureScores[key] = Math.round(value * 100);
    total += value * importance;
    weight += importance;
  };
  for (const finger of Object.keys(gesture.fingers) as Finger[]) {
    if (
      gesture.rules?.some(
        (rule) => rule.type === "contact" && rule.fingers.includes(finger),
      )
    )
      continue;
    const extended = gesture.fingers[finger] === "extended";
    const score = extended ? f.extension[finger] : 1 - f.extension[finger];
    add(finger, score, finger === "thumb" ? 1.3 : 2);
    if (score < gesture.thresholds.finger)
      mistakes.push({
        category: finger,
        severity: (1 - score) * (finger === "thumb" ? 0.9 : 1.2),
        message:
          finger === "thumb"
            ? extended
              ? "Open your thumb away from your palm."
              : "Bring your thumb closer to your palm."
            : `${extended ? "Straighten" : "Fold"} your ${finger === "pinky" ? "little" : finger} finger.`,
      });
  }
  if (gesture.separation) {
    const score = rangeScore(
      f.separation,
      gesture.separation.min,
      gesture.separation.max,
      0.3,
    );
    add("separation", score, 1);
    if (score < 0.7)
      mistakes.push({
        category: "separation",
        severity: 0.65,
        message:
          f.separation < gesture.separation.min
            ? "Separate your index and middle fingers."
            : "Bring your index and middle fingers a little closer.",
      });
  }
  for (const rule of gesture.rules || []) {
    const value =
      rule.type === "direction"
        ? rule.direction === "down"
          ? f.direction
          : -f.direction
        : f.tipDistances[rule.fingers.join(":")];
    const score =
      rule.type === "contact"
        ? rangeScore(value, 0, rule.max, 0.35)
        : rule.type === "spread"
          ? rangeScore(value, rule.min, rule.max, 0.3)
          : rangeScore(value, rule.min, 1, 0.5);
    add(rule.type, Number.isFinite(score) ? score : 0, rule.weight);
    if (!Number.isFinite(score) || score < 0.8)
      mistakes.push({
        category: rule.type === "direction" ? "orientation" : "separation",
        severity: rule.type === "contact" ? 1.4 : 1.05,
        message: "",
        code:
          rule.type === "contact"
            ? "CONNECT_FINGERS"
            : rule.type === "direction"
              ? rule.direction === "down"
                ? "TURN_DOWN"
                : "TURN_UP"
              : value < rule.min
                ? "SPREAD_FINGERS"
                : "CLOSE_FINGERS",
      });
  }
  const orientation = clamp(f.facing / gesture.orientation.minFacing);
  add("orientation", orientation, 1);
  if (orientation < 0.8)
    mistakes.push({
      category: "orientation",
      severity: 0.95,
      message:
        gesture.id === "fist"
          ? "Turn your knuckles toward the camera."
          : "Turn your palm slightly toward the camera.",
    });
  const { x, y, minScale, maxScale } = gesture.position;
  const position = Math.min(
    rangeScore(f.center.x, ...x, 0.18),
    rangeScore(f.center.y, ...y, 0.18),
  );
  featureScores.position = Math.round(position * 100);
  if (position < 0.8)
    mistakes.push({
      category: "position",
      severity: 1.25,
      message:
        f.center.y > y[1]
          ? "Raise your hand higher."
          : f.center.y < y[0]
            ? "Lower your hand a little."
            : "Move your hand toward the center.",
    });
  const scale = rangeScore(
    f.scale,
    minScale,
    maxScale,
    f.scale < minScale ? 0.07 : 0.18,
  );
  featureScores.scale = Math.round(scale * 100);
  if (scale < 0.8)
    mistakes.push({
      category: "scale",
      severity: 1.3,
      message:
        f.scale < minScale
          ? "Move your hand a little closer."
          : "Move your hand a little farther away.",
    });
  const score = Math.round((total / weight) * 100);
  mistakes.sort((a, b) => b.severity - a.severity);
  return {
    gestureId: gesture.id,
    score,
    confidence: clamp(Math.min(scale, position)),
    isCorrect: score >= gesture.thresholds.success && mistakes.length === 0,
    mistakes,
    featureScores,
  };
}
export function evaluateGesture(input: HandInput, gesture: GestureDefinition) {
  const features = extractFeatures(input);
  return features ? evaluateFeatures(features, gesture) : null;
}
