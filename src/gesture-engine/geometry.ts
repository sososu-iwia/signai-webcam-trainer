import type { Point } from "./types";
export const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
export const subtract = (a: Point, b: Point): Point => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const cross = (a: Point, b: Point): Point => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export function angle(a: Point, b: Point, c: Point) {
  const u = subtract(a, b),
    v = subtract(c, b);
  const magnitude = Math.hypot(u.x, u.y, u.z) * Math.hypot(v.x, v.y, v.z);
  if (magnitude < 1e-10) return 0;
  return (
    (Math.acos(clamp((u.x * v.x + u.y * v.y + u.z * v.z) / magnitude, -1, 1)) *
      180) /
    Math.PI
  );
}
export function rangeScore(
  value: number,
  min: number,
  max: number,
  tolerance: number,
) {
  return value < min
    ? clamp(1 - (min - value) / tolerance)
    : value > max
      ? clamp(1 - (value - max) / tolerance)
      : 1;
}
