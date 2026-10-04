import type { GestureDefinition } from "../../shared/catalog";
import { evaluateGesture } from "./evaluateGesture";
import { extractFeatures } from "./features";
import { trackingQuality } from "./trackingQuality";
import type {
  CameraFrame,
  HandInput,
  TrackedHand,
  TrackedHands,
} from "./types";
export function frameHands(frame: CameraFrame): HandInput[] {
  if (!frame) return [];
  if ("landmarks" in frame) return [frame];
  return [frame.left, frame.right].filter((hand): hand is TrackedHand =>
    Boolean(hand),
  );
}
export function semanticHands(frame: CameraFrame): TrackedHands {
  if (!frame) return {};
  if (!("landmarks" in frame)) return frame;
  const side = frame.handedness === "Left" ? "left" : "right";
  return {
    [side]: {
      ...frame,
      handedness: side === "left" ? "Left" : "Right",
      confidence: frame.confidence ?? 1,
      trackingQuality: extractFeatures(frame) ? "valid" : "invalid",
    },
  };
}
export class HandAssociation {
  private previous: TrackedHands = {};
  private at = 0;
  private lastSeen = 0;
  normalize(hands: HandInput[], now: number): TrackedHands {
    if (now - this.lastSeen > 500 || now < this.at) this.previous = {};
    this.at = now;
    let valid = hands
      .filter(
        (h) =>
          Array.isArray(h?.landmarks) &&
          h.landmarks.length === 21 &&
          Array.from(h.landmarks).every(
            (p) => p && [p.x, p.y, p.z].every(Number.isFinite),
          ),
      )
      .slice(0, 2);
    if (!this.previous.left && !this.previous.right) {
      valid = valid.filter(
        (hand) => hand.handedness === "Left" || hand.handedness === "Right",
      );
      if (valid.length === 2 && valid[0].handedness === valid[1].handedness)
        valid = [...valid]
          .sort(
            (a, b) =>
              (b.confidence ?? 1) - (a.confidence ?? 1) ||
              a.landmarks[0].x - b.landmarks[0].x,
          )
          .slice(0, 1);
    }
    const cost = (hand: HandInput, side: "left" | "right") => {
      const declared = hand.handedness?.toLowerCase();
      const confidence = Number.isFinite(hand.confidence)
        ? hand.confidence!
        : 1;
      const mismatch =
        declared === side
          ? 0
          : declared === "left" || declared === "right"
            ? 0.65 * confidence
            : 0.3;
      const old = this.previous[side]?.landmarks[0];
      return (
        mismatch +
        (old
          ? Math.min(
              0.5,
              Math.hypot(
                old.x - hand.landmarks[0].x,
                old.y - hand.landmarks[0].y,
              ),
            )
          : 0.15)
      );
    };
    const result: TrackedHands = {};
    const assign = (hand: HandInput, side: "left" | "right") => {
      result[side] = {
        ...hand,
        handedness: side === "left" ? "Left" : "Right",
        confidence: Number.isFinite(hand.confidence)
          ? Math.max(0, Math.min(1, hand.confidence!))
          : 1,
        trackingQuality: extractFeatures(hand) ? "valid" : "invalid",
      };
    };
    if (valid.length === 2) {
      const straight = cost(valid[0], "left") + cost(valid[1], "right");
      const swapped = cost(valid[0], "right") + cost(valid[1], "left");
      assign(valid[0], straight <= swapped ? "left" : "right");
      assign(valid[1], straight <= swapped ? "right" : "left");
    } else if (valid[0])
      assign(
        valid[0],
        cost(valid[0], "left") < cost(valid[0], "right") ? "left" : "right",
      );
    if (valid.length) {
      this.previous = result;
      this.lastSeen = now;
    }
    return result;
  }
}
export class SingleHandSelector {
  private side = "";
  private candidate = "";
  private since = 0;
  select(frame: CameraFrame, target: GestureDefinition | null, now: number) {
    const eligible = frameHands(frame).filter(
      (h) =>
        !target ||
        target.allowedHand === "either" ||
        h.handedness?.toLowerCase() === target.allowedHand,
    );
    if (eligible.length === 1) {
      this.side = eligible[0].handedness || "Unknown";
      this.candidate = "";
      return eligible[0];
    }
    const candidates = eligible.map((hand) => {
      const evaluation = target ? evaluateGesture(hand, target) : null;
      return {
        hand,
        side: hand.handedness || "Unknown",
        quality: trackingQuality(hand),
        score: evaluation?.score ?? 0,
        correct: evaluation?.isCorrect ?? false,
      };
    });
    candidates.sort(
      (a, b) =>
        Number(b.quality.kind === "ready") -
          Number(a.quality.kind === "ready") ||
        Number(b.correct) - Number(a.correct) ||
        b.score - a.score,
    );
    const best = candidates[0],
      current = candidates.find((c) => c.side === this.side);
    if (!best) {
      this.side = "";
      this.candidate = "";
      return null;
    }
    if (
      !current ||
      (current.quality.kind !== "ready" && best.quality.kind === "ready")
    )
      this.side = best.side;
    else if (
      best.side !== current.side &&
      ((best.correct && !current.correct) || best.score > current.score + 12)
    ) {
      if (this.candidate !== best.side) {
        this.candidate = best.side;
        this.since = now;
      }
      if (now - this.since >= 300) this.side = best.side;
    } else this.candidate = "";
    return (candidates.find((c) => c.side === this.side) || best).hand;
  }
}
export function mirroredDisplayPoint(point: { x: number; y: number }) {
  return { x: 1 - point.x, y: point.y };
}
