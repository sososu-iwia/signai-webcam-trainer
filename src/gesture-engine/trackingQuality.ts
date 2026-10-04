import { extractFeatures } from "./features";
import type { HandInput, Mistake } from "./types";

export interface TrackingQuality {
  kind: "missing" | "tracking" | "position" | "ready";
  message: string;
  mistake: Mistake | null;
}

export function trackingQuality(hand: HandInput | null): TrackingQuality {
  if (!hand)
    return {
      kind: "missing",
      message: "Show your hand to the camera",
      mistake: null,
    };
  const features = extractFeatures(hand);
  if (!features)
    return {
      kind: "tracking",
      message: "Keep your whole hand visible and still for a moment.",
      mistake: {
        category: "visibility",
        message: "Keep your whole hand visible and still for a moment.",
        severity: 2,
      },
    };
  const problem = (
    category: Mistake["category"],
    message: string,
  ): TrackingQuality => ({
    kind: category === "visibility" ? "tracking" : "position",
    message,
    mistake: { category, message, severity: 2 },
  });
  if (features.scale > 0.5)
    return problem("scale", "Move your hand a little farther away.");
  if (
    hand.landmarks.some(
      (p) => p.x < 0.015 || p.x > 0.985 || p.y < 0.015 || p.y > 0.985,
    )
  )
    return problem("visibility", "Move your hand fully inside the frame.");
  if (features.scale < 0.085)
    return problem("scale", "Move your hand a little closer.");
  if (features.center.y > 0.82)
    return problem("position", "Raise your hand higher.");
  if (features.center.y < 0.2)
    return problem("position", "Lower your hand a little.");
  if (features.center.x < 0.18 || features.center.x > 0.82)
    return problem("position", "Move your hand toward the center.");
  return { kind: "ready", message: "Your hand is in view", mistake: null };
}

export class CameraPreflight {
  private since: number | null = null;
  private previous: number | null = null;
  private ready = false;
  update(quality: TrackingQuality, now: number) {
    if (
      quality.kind !== "ready" ||
      (this.previous !== null &&
        (now - this.previous > 300 || now < this.previous))
    ) {
      this.since = null;
      this.ready = false;
    }
    this.previous = now;
    if (quality.kind === "ready") {
      this.since ??= now;
      this.ready = now - this.since >= 600;
    }
    return this.ready;
  }
}
