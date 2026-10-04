import { describe, expect, it } from "vitest";
import { courseGestures, getGesture } from "../shared/catalog";
import { courseFixture, dualFixture } from "./course-fixtures";
import { extractFeatures } from "../src/gesture-engine/features";
import {
  evaluateFeatures,
  evaluateGesture,
} from "../src/gesture-engine/evaluateGesture";
import {
  HandAssociation,
  mirroredDisplayPoint,
  SingleHandSelector,
} from "../src/gesture-engine/hands";
import {
  dualFeatures,
  dualTracking,
  evaluateDual,
} from "../src/gesture-engine/dual";
import { StabilityTracker } from "../src/gesture-engine/stability";
import { dualTestTarget } from "../src/pages/DualTest";
import { correctionText } from "../src/i18n/feedback";
import type { CourseGestureId } from "../shared/catalog";

describe("nine declarative handshapes", () => {
  for (const pose of courseGestures) {
    for (const side of ["Left", "Right"] as const)
      it(`${pose.id} accepts ${side} and reports a specific invalid-finger correction`, () => {
        const hand = courseFixture(pose.id as CourseGestureId, side);
        const result = evaluateGesture(hand, pose)!;
        expect(Number.isFinite(result.score)).toBe(true);
        expect(result.mistakes).toEqual([]);
        expect(result.isCorrect).toBe(true);
        const features = extractFeatures(hand)!;
        features.extension.ring = pose.fingers.ring === "extended" ? 0 : 1;
        const invalid = evaluateFeatures(features, pose);
        expect(invalid.isCorrect).toBe(false);
        expect(invalid.mistakes.some((m) => m.category === "ring")).toBe(true);
        expect(
          correctionText(
            "ru",
            invalid.mistakes.find((m) => m.category === "ring")!,
          ),
        ).toMatch(/палец/);
        expect(evaluateGesture({ landmarks: [] }, pose)).toBeNull();
      });
  }
  it("coaches contact, finger spacing and downward orientation separately", () => {
    const contact = extractFeatures(courseFixture("kz-o"))!;
    contact.tipDistances["thumb:index"] = 1;
    expect(
      evaluateFeatures(contact, getGesture("kz-o")).mistakes.some(
        (m) => m.code === "CONNECT_FINGERS",
      ),
    ).toBe(true);
    const spread = extractFeatures(courseFixture("kz-u-diaeresis"))!;
    spread.tipDistances["index:middle"] = 0;
    expect(
      evaluateFeatures(spread, getGesture("kz-u-diaeresis")).mistakes.some(
        (m) => m.code === "SPREAD_FINGERS",
      ),
    ).toBe(true);
    const close = extractFeatures(courseFixture("kz-v"))!;
    close.tipDistances["ring:pinky"] = 2;
    expect(
      evaluateFeatures(close, getGesture("kz-v")).mistakes.some(
        (m) => m.code === "CLOSE_FINGERS",
      ),
    ).toBe(true);
    expect(
      evaluateGesture(
        courseFixture("kz-u-diaeresis"),
        getGesture("kz-l"),
      )!.mistakes.some((m) => m.code === "TURN_DOWN"),
    ).toBe(true);
  });
});
describe("semantic two-hand tracking and evaluation", () => {
  it("never invents initial handedness from missing or duplicate labels", () => {
    const hands = dualFixture();
    expect(
      new HandAssociation().normalize(
        [{ ...hands.left!, handedness: undefined }],
        0,
      ),
    ).toEqual({});
    const duplicates = [
      hands.left!,
      { ...hands.right!, handedness: "Left", confidence: 0.1 },
    ];
    const result = new HandAssociation().normalize(duplicates, 0);
    expect(result.left?.landmarks).toEqual(hands.left!.landmarks);
    expect(result.right).toBeUndefined();
    expect(
      new HandAssociation().normalize([...duplicates].reverse(), 0),
    ).toEqual(result);
  });
  it("maps handedness independently of array order and preserves image coordinates", () => {
    const hands = dualFixture(),
      association = new HandAssociation();
    const first = association.normalize([hands.left!, hands.right!], 0);
    const second = association.normalize([hands.right!, hands.left!], 40);
    expect(second).toEqual(first);
    expect(second.left?.landmarks).toEqual(hands.left?.landmarks);
    expect(mirroredDisplayPoint({ x: 0.2, y: 0.3 })).toEqual({
      x: 0.8,
      y: 0.3,
    });
    const weakLabels = [
      { ...hands.left!, handedness: "Right", confidence: 0.1 },
      { ...hands.right!, handedness: "Left", confidence: 0.1 },
    ];
    expect(association.normalize(weakLabels, 80).left?.landmarks).toEqual(
      hands.left?.landmarks,
    );
  });
  it("chooses either valid hand, uses hysteresis and respects restrictions", () => {
    const hands = dualFixture();
    const selector = new SingleHandSelector();
    expect(
      selector.select({ left: hands.left }, getGesture("palm"), 0)?.handedness,
    ).toBe("Left");
    expect(selector.select(hands, getGesture("fist"), 100)?.handedness).toBe(
      "Left",
    );
    expect(selector.select(hands, getGesture("fist"), 450)?.handedness).toBe(
      "Right",
    );
    expect(
      selector.select(
        hands,
        { ...getGesture("palm"), allowedHand: "left" },
        500,
      )?.handedness,
    ).toBe("Left");
    expect(
      selector.select(
        { right: hands.right },
        { ...getGesture("palm"), allowedHand: "left" },
        550,
      ),
    ).toBeNull();
  });
  it("scores independent poses and normalized relationships with finite weights", () => {
    const hands = dualFixture(),
      features = dualFeatures(hands)!;
    expect(features.palmDistance).toBeGreaterThan(1);
    expect(features.depthDifference).toBeNull();
    const result = evaluateDual(hands, dualTestTarget);
    expect(result.mistakes).toEqual([]);
    expect(result.isCorrect).toBe(true);
    expect(result.handScores?.left).toBeGreaterThan(84);
    expect(result.handScores?.right).toBeGreaterThan(84);
    expect(
      Number.isFinite(
        evaluateDual(hands, {
          ...dualTestTarget,
          weights: { left: NaN, right: -1, relationship: 0 },
        }).score,
      ),
    ).toBe(true);
  });
  it("prioritizes missing hands and labels left/right finger mistakes", () => {
    const hands = dualFixture();
    expect(dualTracking({}).mistake?.code).toBe("SHOW_BOTH");
    expect(
      evaluateDual({ left: hands.left }, dualTestTarget).mistakes.map(
        (m) => m.code,
      ),
    ).toEqual(["KEEP_BOTH"]);
    const leftWrong = evaluateDual(hands, {
      ...dualTestTarget,
      leftHand: getGesture("fist"),
    });
    expect(
      leftWrong.mistakes.some(
        (m) => m.hand === "left" && m.code === "FOLD_FINGER",
      ),
    ).toBe(true);
    const rightWrong = evaluateDual(hands, {
      ...dualTestTarget,
      rightHand: getGesture("palm"),
    });
    expect(
      rightWrong.mistakes.some(
        (m) => m.hand === "right" && m.code === "EXTEND_FINGER",
      ),
    ).toBe(true);
    expect(correctionText("ru", rightWrong.mistakes[0])).toContain(
      "правой руки",
    );
  });
  it("reports relationship mistakes and only completes a continuous dual hold", () => {
    const hands = dualFixture(),
      shifted = structuredClone(hands);
    shifted.right!.landmarks = shifted.right!.landmarks.map((p) => ({
      ...p,
      y: p.y - 0.12,
    }));
    const wrong = evaluateDual(shifted, dualTestTarget);
    expect(wrong.mistakes.some((m) => m.code === "SAME_HEIGHT")).toBe(true);
    expect(
      evaluateDual(hands, {
        ...dualTestTarget,
        relationship: {
          ...dualTestTarget.relationship,
          distanceRange: [0.1, 0.5],
        },
      }).mistakes.some((m) => m.code === "HANDS_CLOSER"),
    ).toBe(true);
    const stable = new StabilityTracker(),
      good = evaluateDual(hands, dualTestTarget);
    for (let now = 0; now <= 800; now += 100)
      expect(stable.update(good, now).complete).toBe(now === 800);
    expect(
      stable.update(evaluateDual({ left: hands.left }, dualTestTarget), 900)
        .hold,
    ).toBe(0);
    expect(
      evaluateDual(
        { left: { ...hands.left!, landmarks: [] }, right: hands.right },
        dualTestTarget,
      ).score,
    ).toBe(0);
  });
});
