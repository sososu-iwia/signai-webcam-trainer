import { describe, expect, it } from "vitest";
import { getGesture } from "../shared/catalog";
import {
  HandAssociation,
  SingleHandSelector,
} from "../src/gesture-engine/hands";
import { evaluateDual } from "../src/gesture-engine/dual";
import { evaluateGesture } from "../src/gesture-engine/evaluateGesture";
import { dualTestTarget } from "../src/pages/DualTest";
import { dualFixture } from "./course-fixtures";
import { fixture, almostOpenPalm } from "./fixtures";
import type { HandInput, TrackedHand } from "../src/gesture-engine/types";

describe("vision input and candidate regressions", () => {
  it("rejects sparse landmark arrays before associating a wrist, then recovers", () => {
    const association = new HandAssociation(),
      hands = dualFixture();
    association.normalize([hands.left!, hands.right!], 0);
    const sparse = new Array<HandInput["landmarks"][number]>(21);
    expect(
      association.normalize([{ ...hands.left!, landmarks: sparse }], 40),
    ).toEqual({});
    const missingJoint = [...hands.left!.landmarks];
    delete missingJoint[8];
    expect(
      association.normalize(
        [{ ...hands.left!, landmarks: missingJoint }, hands.right!],
        80,
      ).left,
    ).toBeUndefined();
    expect(
      association.normalize([hands.right!, hands.left!], 120).left?.landmarks,
    ).toEqual(hands.left!.landmarks);
  });
  it("rejects array-like landmark objects at the tracking boundary", () => {
    const hand = fixture("palm");
    const malformed = {
      ...hand,
      landmarks: { length: 21 },
    } as unknown as HandInput;
    expect(new HandAssociation().normalize([malformed], 0)).toEqual({});
  });
  it("switches from a high-scoring incorrect hand to a correct hand after stable evidence", () => {
    const left = almostOpenPalm();
    const right: TrackedHand = {
      ...fixture("palm"),
      handedness: "Right",
      confidence: 1,
      trackingQuality: "valid",
    };
    const target = getGesture("palm"),
      selector = new SingleHandSelector();
    const wrong = evaluateGesture(left, target)!,
      good = evaluateGesture(right, target)!;
    expect(wrong.isCorrect).toBe(false);
    expect(good.isCorrect).toBe(true);
    expect(good.score - wrong.score).toBeLessThan(12);
    expect(selector.select({ left }, target, 0)?.handedness).toBe("Left");
    expect(selector.select({ left, right }, target, 100)?.handedness).toBe(
      "Left",
    );
    expect(selector.select({ left, right }, target, 250)?.handedness).toBe(
      "Left",
    );
    expect(selector.select({ left, right }, target, 400)?.handedness).toBe(
      "Right",
    );
  });
  it("does not switch hands based on one briefly correct frame", () => {
    const left = almostOpenPalm();
    const right: TrackedHand = {
      ...fixture("palm"),
      handedness: "Right",
      confidence: 1,
      trackingQuality: "valid",
    };
    const selector = new SingleHandSelector(),
      target = getGesture("palm");
    selector.select({ left }, target, 0);
    selector.select({ left, right }, target, 100);
    selector.select({ left }, target, 200);
    expect(selector.select({ left, right }, target, 450)?.handedness).toBe(
      "Left",
    );
    expect(selector.select({ left, right }, target, 750)?.handedness).toBe(
      "Right",
    );
  });
  it.each([1e308, 1e-308])(
    "keeps dual scoring finite and proportional with weight scale %s",
    (scale) => {
      const hands = dualFixture();
      const expected = evaluateDual(hands, dualTestTarget);
      const actual = evaluateDual(hands, {
        ...dualTestTarget,
        weights: {
          left: 0.4 * scale,
          right: 0.4 * scale,
          relationship: 0.2 * scale,
        },
      });
      expect(Number.isFinite(actual.score)).toBe(true);
      expect(actual.score).toBe(expected.score);
      expect(actual.isCorrect).toBe(expected.isCorrect);
    },
  );
});
