import { describe, expect, it } from "vitest";
import { getGesture, gestures } from "../shared/catalog";
import { angle, distance } from "../src/gesture-engine/geometry";
import {
  classifyFinger,
  extractFeatures,
} from "../src/gesture-engine/features";
import {
  evaluateFeatures,
  evaluateGesture,
} from "../src/gesture-engine/evaluateGesture";
import {
  FeedbackSmoother,
  StabilityTracker,
} from "../src/gesture-engine/stability";
import { fixture } from "./fixtures";
import measured from "./measured-landmarks.json";
describe("geometry and feature extraction", () => {
  it("calculates joint angles and distances", () => {
    expect(
      angle({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }),
    ).toBeCloseTo(90);
    expect(distance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(5);
  });
  it("classifies clear and partial finger extension", () => {
    expect(classifyFinger(0.9)).toBe("extended");
    expect(classifyFinger(0.1)).toBe("folded");
    expect(classifyFinger(0.5)).toBe("partial");
  });
  it("rejects incomplete, nonfinite and degenerate landmarks", () => {
    expect(extractFeatures({ landmarks: [] })).toBeNull();
    expect(
      extractFeatures({ landmarks: Array(21).fill({ x: 0, y: 0, z: 0 }) }),
    ).toBeNull();
    const hand = fixture("palm");
    hand.landmarks[8].x = NaN;
    expect(extractFeatures(hand)).toBeNull();
  });
  it("normalizes shape against scale and translation", () => {
    const hand = fixture("victory"),
      original = extractFeatures(hand)!;
    hand.worldLandmarks = hand.worldLandmarks!.map((p) => ({
      x: p.x * 2 + 4,
      y: p.y * 2 - 3,
      z: p.z * 2 + 1,
    }));
    const transformed = extractFeatures(hand)!;
    expect(transformed.extension.index).toBeCloseTo(original.extension.index);
    expect(transformed.separation).toBeCloseTo(original.separation);
  });
});
describe("custom gesture evaluator", () => {
  for (const gesture of gestures) {
    it(`recognizes ${gesture.label} from landmarks`, () => {
      const result = evaluateGesture(fixture(gesture.id), gesture)!;
      expect(result.isCorrect).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(84);
      expect(result.mistakes).toEqual([]);
      for (const other of gestures.filter((g) => g.id !== gesture.id))
        expect(evaluateGesture(fixture(gesture.id), other)!.isCorrect).toBe(
          false,
        );
    });
  }
  it("reports an incorrect index finger and blocks success even at a high aggregate score", () => {
    const features = extractFeatures(fixture("palm"))!;
    features.extension.index = 0.4;
    const result = evaluateFeatures(features, getGesture("palm"));
    expect(result.score).toBeGreaterThan(84);
    expect(result.isCorrect).toBe(false);
    expect(result.mistakes[0].message).toBe("Straighten your index finger.");
  });
  it("provides folded-finger and thumb corrections", () => {
    const result = evaluateGesture(fixture("palm"), getGesture("victory"))!;
    expect(result.mistakes.map((m) => m.message)).toContain(
      "Fold your ring finger.",
    );
    expect(result.mistakes.map((m) => m.message)).toContain(
      "Bring your thumb closer to your palm.",
    );
  });
  it("measures separation, hand position, size, and orientation", () => {
    const f = extractFeatures(fixture("victory"))!;
    f.separation = 0.01;
    f.center.y = 0.98;
    f.facing = 0.05;
    f.scale = 0.03;
    const result = evaluateFeatures(f, getGesture("victory"));
    expect(result.isCorrect).toBe(false);
    expect(result.mistakes.map((m) => m.category)).toEqual(
      expect.arrayContaining([
        "position",
        "scale",
        "orientation",
        "separation",
      ]),
    );
    expect(result.mistakes.map((m) => m.message)).toContain(
      "Raise your hand higher.",
    );
  });
  it("works with either mirrored hand", () => {
    const hand = fixture("palm");
    hand.worldLandmarks = hand.worldLandmarks!.map((p) => ({
      ...p,
      x: 1 - p.x,
    }));
    hand.landmarks = hand.landmarks.map((p) => ({ ...p, x: 1 - p.x }));
    expect(evaluateGesture(hand, getGesture("palm"))!.isCorrect).toBe(true);
  });
});
describe("temporal stability and feedback", () => {
  const good = evaluateGesture(fixture("palm"), getGesture("palm"))!;
  it("requires a continuous 800 ms hold", () => {
    const tracker = new StabilityTracker();
    expect(tracker.update(good, 0).complete).toBe(false);
    for (let t = 100; t < 800; t += 100)
      expect(tracker.update(good, t).complete).toBe(false);
    expect(tracker.update(good, 800).complete).toBe(true);
  });
  it("resets hold on wrong gesture, lost hand, or a stale frame gap", () => {
    const tracker = new StabilityTracker();
    tracker.update(good, 0);
    tracker.update(good, 100);
    expect(tracker.update({ ...good, isCorrect: false }, 200).hold).toBe(0);
    tracker.update(good, 300);
    expect(tracker.update(null, 400).hold).toBe(0);
    tracker.update(good, 500);
    expect(tracker.update(good, 1500).complete).toBe(false);
  });
  it("does not carry a hold between different gestures", () => {
    const tracker = new StabilityTracker();
    tracker.update(good, 0);
    tracker.update(good, 100);
    expect(tracker.update({ ...good, gestureId: "fist" }, 200).hold).toBe(0);
  });
  it("smooths scores and avoids rapidly changing correction text", () => {
    const tracker = new StabilityTracker();
    tracker.update(good, 0);
    const next = tracker.update({ ...good, score: 20, isCorrect: false }, 50);
    expect(next.score).toBeGreaterThan(20);
    expect(next.score).toBeLessThan(100);
    const feedback = new FeedbackSmoother();
    expect(feedback.update("First", 0)).toBe("First");
    expect(feedback.update("Second", 100)).toBe("First");
    expect(feedback.update("Second", 460)).toBe("Second");
  });
});

describe("measured MediaPipe landmarks from real reference photographs", () => {
  for (const reference of measured) {
    it(`recognizes the measured ${reference.id} hand and rejects the other shapes`, () => {
      for (const gesture of gestures) {
        const result = evaluateGesture(reference.hand, gesture)!;
        expect(result.isCorrect).toBe(gesture.id === reference.id);
        if (gesture.id === reference.id)
          expect(result.score).toBeGreaterThanOrEqual(84);
      }
    });
  }
});
