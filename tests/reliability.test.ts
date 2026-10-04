import { describe, expect, it } from "vitest";
import { getGesture, gestures } from "../shared/catalog";
import { cameraError } from "../src/camera/useCamera";
import {
  CameraPreflight,
  trackingQuality,
} from "../src/gesture-engine/trackingQuality";
import { CorrectionSelector } from "../src/gesture-engine/stability";
import { evaluateGesture } from "../src/gesture-engine/evaluateGesture";
import { practiceRecommendation } from "../shared/learning";
import type { Attempt } from "../shared/schema";
import { fixture } from "./fixtures";
import measured from "./measured-landmarks.json";

describe("camera setup and frame quality", () => {
  it("requires 600 ms of uninterrupted, positioned hand tracking before practice", () => {
    const setup = new CameraPreflight();
    const quality = trackingQuality(fixture("fist"));
    expect(quality.kind).toBe("ready");
    for (let t = 0; t < 600; t += 100)
      expect(setup.update(quality, t)).toBe(false);
    expect(setup.update(quality, 600)).toBe(true);
    expect(setup.update(trackingQuality(null), 700)).toBe(false);
    expect(setup.update(quality, 800)).toBe(false);
    expect(setup.update(quality, 1500)).toBe(false);
  });
  it("separates missing, invalid, clipped, distant and off-center hands from shape matching", () => {
    expect(trackingQuality(null).kind).toBe("missing");
    expect(trackingQuality({ landmarks: [] }).kind).toBe("tracking");
    const clipped = fixture("palm");
    clipped.landmarks[8].x = 1.02;
    expect(trackingQuality(clipped).mistake?.category).toBe("visibility");
    const large = fixture("fist");
    large.landmarks = large.landmarks.map((p) => ({
      ...p,
      x: 0.5 + (p.x - 0.5) * 2.2,
      y: 0.5 + (p.y - 0.5) * 2.2,
    }));
    expect(trackingQuality(large).message).toContain("farther");
    for (const sample of measured)
      expect(trackingQuality(sample.hand).kind).toBe("ready");
    const small = fixture("palm");
    small.landmarks = small.landmarks.map((p) => ({
      ...p,
      x: 0.5 + (p.x - 0.5) * 0.15,
      y: 0.5 + (p.y - 0.5) * 0.15,
    }));
    expect(trackingQuality(small).message).toContain("closer");
    small.landmarks = small.landmarks.map((p) => ({ ...p, x: p.x + 0.4 }));
    small.landmarks[0].y = 0.6;
    small.landmarks[9].y = 0.45;
    expect(trackingQuality(small).mistake?.category).toBe("position");
    expect(
      evaluateGesture(fixture("fist"), getGesture("palm"))!.confidence,
    ).toBe(1);
    expect(
      evaluateGesture(fixture("fist"), getGesture("palm"))!.score,
    ).toBeLessThan(50);
  });
  it("gives recoverable permission, missing-camera and busy-camera errors without exception text", () => {
    expect(
      cameraError(new DOMException("private driver info", "NotAllowedError")),
    ).toContain("Allow camera access");
    expect(
      cameraError(new DOMException("driver info", "NotFoundError")),
    ).toContain("No camera found");
    expect(
      cameraError(new DOMException("driver info", "NotReadableError")),
    ).toContain("Close other apps");
    expect(cameraError(new Error("private driver info"))).not.toContain(
      "driver info",
    );
  });
});

describe("stable corrections and geometric invariance", () => {
  it("retains unresolved corrections through score noise and prioritizes visibility", () => {
    const selector = new CorrectionSelector();
    const index = {
      category: "index" as const,
      message: "Straighten your index finger.",
      severity: 0.8,
    };
    const middle = {
      category: "middle" as const,
      message: "Straighten your middle finger.",
      severity: 0.9,
    };
    expect(selector.update([index, middle], 0)).toEqual(index);
    expect(selector.update([middle, index], 1000)).toEqual(index);
    expect(selector.update([middle], 1100)).toEqual(index);
    expect(selector.update([middle], 1600)).toEqual(middle);
    const visibility = {
      category: "visibility" as const,
      message: "Show your whole hand.",
      severity: 2,
    };
    expect(selector.update([visibility, middle], 1650)).toEqual(visibility);
    expect(selector.update([], 1700)).toBeNull();
  });
  for (const gesture of gestures)
    it(`preserves ${gesture.id} classification with either hand, wrist rotation and image aspect ratios`, () => {
      for (const mirror of [1, -1])
        for (const rotation of [-0.2, 0, 0.2])
          for (const aspect of [0.75, 4 / 3, 16 / 9]) {
            const hand = fixture(gesture.id);
            hand.handedness = mirror === 1 ? "Right" : "Left";
            hand.worldLandmarks = hand.worldLandmarks!.map((p) => ({
              x: mirror * (p.x * Math.cos(rotation) - p.y * Math.sin(rotation)),
              y: p.x * Math.sin(rotation) + p.y * Math.cos(rotation),
              z: p.z,
            }));
            hand.aspectRatio = aspect;
            expect(evaluateGesture(hand, gesture)!.isCorrect).toBe(true);
          }
    });
});

describe("practice recommendation", () => {
  const attempt = (
    gestureId: Attempt["gestureId"],
    score: number,
    success: boolean,
    createdAt: string,
  ): Attempt => ({
    id: crypto.randomUUID(),
    userId: "demo",
    lessonId: "handshape-basics",
    gestureId,
    score,
    success,
    durationMs: 1000,
    mistakes: [],
    corrections: 0,
    createdAt,
  });
  it("uses no fabricated recommendation without history", () =>
    expect(practiceRecommendation({ attempts: [], results: [] })).toBeNull());
  it("prioritizes a recently unfinished shape then returns to the lowest average once corrected", () => {
    const attempts = [
      attempt("fist", 65, true, "2026-09-28T10:00:00Z"),
      attempt("palm", 80, false, "2026-09-29T10:00:00Z"),
    ];
    expect(practiceRecommendation({ attempts, results: [] })?.gestureId).toBe(
      "palm",
    );
    attempts.push(attempt("palm", 95, true, "2026-09-29T11:00:00Z"));
    expect(practiceRecommendation({ attempts, results: [] })?.gestureId).toBe(
      "fist",
    );
  });
});

describe("adversarial recognition input", () => {
  it("rejects collapsed finger geometry and invalid aspect ratios without non-finite scores", () => {
    const hand = fixture("palm");
    for (const index of [5, 6, 7, 8])
      hand.worldLandmarks![index] = { ...hand.worldLandmarks![0] };
    expect(evaluateGesture(hand, getGesture("palm"))).toBeNull();
    for (const aspectRatio of [NaN, Infinity, -1, 0]) {
      expect(
        evaluateGesture(
          { ...fixture("palm"), aspectRatio },
          getGesture("palm"),
        ),
      ).toBeNull();
    }
  });
  it("requires a continuously higher-priority correction before replacing a still-valid one", () => {
    const selector = new CorrectionSelector();
    const first = {
      category: "thumb" as const,
      message: "Open your thumb.",
      severity: 0.4,
    };
    const higher = {
      category: "index" as const,
      message: "Straighten your index.",
      severity: 1.1,
    };
    expect(selector.update([first], 0)).toEqual(first);
    expect(selector.update([higher, first], 100)).toEqual(first);
    expect(selector.update([first], 500)).toEqual(first);
    expect(selector.update([higher, first], 600)).toEqual(first);
    expect(selector.update([higher, first], 1100)).toEqual(higher);
  });
});
