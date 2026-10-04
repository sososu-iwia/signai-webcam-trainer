import type { Finger, FingerState } from "../../shared/catalog";
import { angle, clamp, cross, distance, subtract } from "./geometry";
import type { HandFeatures, HandInput } from "./types";
export const fingerIndices: Record<Finger, [number, number, number, number]> = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};
export function classifyFinger(extension: number): FingerState | "partial" {
  return extension >= 0.66
    ? "extended"
    : extension <= 0.34
      ? "folded"
      : "partial";
}
export function extractFeatures(input: HandInput): HandFeatures | null {
  const valid = (points: HandInput["landmarks"]) =>
    Array.isArray(points) &&
    points.length === 21 &&
    Array.from(points).every(
      (p) => p && [p.x, p.y, p.z].every(Number.isFinite),
    );
  const aspectRatio = input.aspectRatio ?? 1;
  if (
    !valid(input.landmarks) ||
    !Number.isFinite(aspectRatio) ||
    aspectRatio <= 0
  )
    return null;
  const image = input.landmarks;
  const p =
    input.worldLandmarks && valid(input.worldLandmarks)
      ? input.worldLandmarks
      : image.map((p) => ({ ...p, y: p.y / aspectRatio }));
  const palmSize = distance(p[0], p[9]);
  if (palmSize < 1e-6 || distance(p[5], p[17]) < 1e-6) return null;
  const extension = {} as Record<Finger, number>,
    angles = {} as Record<Finger, number>;
  for (const finger of Object.keys(fingerIndices) as Finger[]) {
    const [m, pip, dip, tip] = fingerIndices[finger];
    if (
      distance(p[m], p[pip]) < 1e-8 ||
      distance(p[pip], p[dip]) < 1e-8 ||
      distance(p[dip], p[tip]) < 1e-8 ||
      distance(p[m], p[0]) < 1e-8
    )
      return null;
    const joint = angle(p[m], p[pip], p[dip]);
    angles[finger] = joint;
    if (finger === "thumb") {
      extension[finger] = clamp(
        (distance(p[4], p[9]) / palmSize - 0.42) / 0.52,
      );
    } else {
      const straight = clamp((joint - 85) / 80);
      const reach = clamp(
        (distance(p[tip], p[0]) / distance(p[m], p[0]) - 1.05) / 0.65,
      );
      extension[finger] = straight * 0.55 + reach * 0.45;
    }
  }
  const normal = cross(subtract(p[5], p[0]), subtract(p[17], p[0]));
  const center = [0, 5, 9, 13, 17].reduce(
    (s, i) => ({ x: s.x + image[i].x / 5, y: s.y + image[i].y / 5, z: 0 }),
    { x: 0, y: 0, z: 0 },
  );
  const tipDistances: Record<string, number> = {};
  for (const a of Object.keys(fingerIndices) as Finger[])
    for (const b of Object.keys(fingerIndices) as Finger[])
      tipDistances[`${a}:${b}`] =
        distance(p[fingerIndices[a][3]], p[fingerIndices[b][3]]) / palmSize;
  const normalLength = Math.max(1e-8, Math.hypot(normal.x, normal.y, normal.z));
  const features = {
    palmSize,
    tipDistances,
    normal: {
      x: normal.x / normalLength,
      y: normal.y / normalLength,
      z: normal.z / normalLength,
    },
    direction:
      (image[9].y - image[0].y) /
      Math.max(
        1e-8,
        Math.hypot(
          (image[9].x - image[0].x) * aspectRatio,
          image[9].y - image[0].y,
        ),
      ),
    extension,
    angles,
    separation: distance(p[8], p[12]) / palmSize,
    facing:
      Math.abs(normal.z) /
      Math.max(1e-8, Math.hypot(normal.x, normal.y, normal.z)),
    center,
    scale: Math.hypot(
      (image[0].x - image[9].x) * Math.max(1, aspectRatio),
      (image[0].y - image[9].y) / Math.min(1, aspectRatio),
    ),
  };
  return [
    ...Object.values(extension),
    ...Object.values(angles),
    ...Object.values(tipDistances),
    features.direction,
    features.palmSize,
    features.normal.x,
    features.normal.y,
    features.normal.z,
    features.separation,
    features.facing,
    features.scale,
    center.x,
    center.y,
  ].every(Number.isFinite)
    ? features
    : null;
}
