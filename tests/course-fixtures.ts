import type { CourseGestureId } from "../shared/catalog";
import type { HandInput, TrackedHands } from "../src/gesture-engine/types";
import { fixture } from "./fixtures";
const extended: Record<CourseGestureId, number[]> = {
  "kz-a": [],
  "kz-v": [0, 1, 2, 3, 4],
  "kz-u-diaeresis": [1, 2],
  "kz-o": [2, 3, 4],
  "kz-u": [0, 4],
  "kz-i": [3, 4],
  "kz-l": [1, 2],
  "kz-m": [1, 2, 3],
  "kz-n": [1, 2, 4],
};
export function courseFixture(
  id: CourseGestureId,
  handedness: "Left" | "Right" = "Right",
): HandInput {
  const open = fixture("palm"),
    closed = fixture("fist"),
    hand = fixture("fist");
  for (let finger = 0; finger < 5; finger++)
    for (let joint = 0; joint < 4; joint++) {
      const index = 1 + finger * 4 + joint;
      hand.landmarks[index] = {
        ...(extended[id].includes(finger) ? open : closed).landmarks[index],
      };
    }
  if (["kz-u-diaeresis", "kz-l", "kz-m"].includes(id)) {
    for (let finger = 1; finger <= (id === "kz-m" ? 3 : 2); finger++)
      for (let joint = 1; joint <= 3; joint++)
        hand.landmarks[1 + finger * 4 + joint].x +=
          ((finger === 1 ? -0.03 : finger === 2 ? 0.025 : 0.055) * joint) / 1.5;
  }
  if (id === "kz-o") {
    hand.landmarks[4] = { x: 0.405, y: 0.676, z: -0.015 };
    hand.landmarks[8] = { x: 0.4, y: 0.675, z: -0.015 };
  }
  if (id === "kz-l" || id === "kz-m")
    hand.landmarks = hand.landmarks.map((p) => ({
      x: 1 - p.x,
      y: 1.1 - p.y,
      z: p.z,
    }));
  if (handedness === "Left")
    hand.landmarks = hand.landmarks.map((p) => ({ ...p, x: 1 - p.x }));
  hand.worldLandmarks = hand.landmarks.map((p) => ({ ...p }));
  hand.handedness = handedness;
  hand.confidence = 0.99;
  return hand;
}
export function dualFixture(): TrackedHands {
  const place = (hand: HandInput, side: "Left" | "Right") => {
    const offset = side === "Left" ? -0.17 : 0.17;
    const landmarks = hand.landmarks.map((p) => ({
      x: (p.x - 0.5) * 0.6 + 0.5 + offset,
      y: (p.y - 0.5) * 0.6 + 0.5,
      z: p.z * 0.6,
    }));
    return {
      ...hand,
      landmarks,
      worldLandmarks: landmarks.map((p) => ({ ...p })),
      handedness: side,
      confidence: 0.99,
      trackingQuality: "valid" as const,
    };
  };
  return {
    left: place(courseFixture("kz-v", "Left"), "Left"),
    right: place(courseFixture("kz-a"), "Right"),
  };
}
