import { getGesture, type GestureId } from "../shared/catalog";
import type {
  HandInput,
  Point,
  TrackedHand,
} from "../src/gesture-engine/types";
export function fixture(id: GestureId): HandInput {
  const p: Point[] = Array.from({ length: 21 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
  }));
  p[0] = { x: 0.5, y: 0.82, z: 0 };
  p[1] = { x: 0.4, y: 0.73, z: 0 };
  p[2] = { x: 0.35, y: 0.65, z: 0 };
  p[3] = { x: 0.31, y: 0.58, z: 0 };
  p[4] =
    id === "palm" ? { x: 0.17, y: 0.46, z: 0 } : { x: 0.49, y: 0.6, z: -0.03 };
  const bases = [
    { x: 0.4, y: 0.6, z: 0 },
    { x: 0.47, y: 0.56, z: 0 },
    { x: 0.54, y: 0.59, z: 0 },
    { x: 0.6, y: 0.64, z: 0 },
  ];
  const fingers = ["index", "middle", "ring", "pinky"] as const;
  fingers.forEach((finger, i) => {
    const b = bases[i],
      m = 5 + i * 4;
    p[m] = b;
    if (getGesture(id).fingers[finger] === "extended") {
      const dx = id === "victory" ? (i === 0 ? -0.03 : 0.025) : 0;
      p[m + 1] = { x: b.x + dx, y: b.y - 0.12, z: 0 };
      p[m + 2] = { x: b.x + dx * 1.5, y: b.y - 0.2, z: 0 };
      p[m + 3] = { x: b.x + dx * 2, y: b.y - 0.27, z: 0 };
    } else {
      p[m + 1] = { x: b.x, y: b.y - 0.06, z: -0.02 };
      p[m + 2] = { x: b.x, y: b.y + 0.015, z: -0.06 };
      p[m + 3] = { x: b.x, y: b.y + 0.075, z: -0.015 };
    }
  });
  return {
    landmarks: p,
    worldLandmarks: p.map((p) => ({ ...p })),
    handedness: "Right",
    aspectRatio: 4 / 3,
  };
}

export function almostOpenPalm(): TrackedHand {
  const hand = fixture("palm"),
    folded = fixture("fist");
  for (let i = 13; i <= 16; i++)
    for (const key of ["x", "y", "z"] as const) {
      hand.landmarks[i][key] +=
        (folded.landmarks[i][key] - hand.landmarks[i][key]) * 0.45;
      hand.worldLandmarks![i][key] = hand.landmarks[i][key];
    }
  return {
    ...hand,
    handedness: "Left",
    confidence: 1,
    trackingQuality: "valid",
  };
}
