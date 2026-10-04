import type { Finger, GestureId } from "../../shared/catalog";
import type { mistakeCategories } from "../../shared/schema";
export interface Point {
  x: number;
  y: number;
  z: number;
}
export interface HandInput {
  landmarks: Point[];
  worldLandmarks?: Point[];
  handedness?: string;
  aspectRatio?: number;
  confidence?: number;
}
export type MistakeCategory = (typeof mistakeCategories)[number];
export interface Mistake {
  category: MistakeCategory;
  message: string;
  severity: number;
  code?: CorrectionCode;
  hand?: "left" | "right";
  finger?: Finger;
}
export interface HandFeatures {
  extension: Record<Finger, number>;
  angles: Record<Finger, number>;
  separation: number;
  facing: number;
  center: Point;
  scale: number;
  palmSize: number;
  normal: Point;
  direction: number;
  tipDistances: Record<string, number>;
}
export interface Evaluation {
  gestureId: GestureId | "dev-dual";
  handScores?: { left: number; right: number; relationship: number };
  score: number;
  confidence: number;
  isCorrect: boolean;
  mistakes: Mistake[];
  featureScores: Record<string, number>;
}

export type CorrectionCode =
  | "CONNECT_FINGERS"
  | "SPREAD_FINGERS"
  | "CLOSE_FINGERS"
  | "TURN_DOWN"
  | "TURN_UP"
  | "EXTEND_FINGER"
  | "FOLD_FINGER"
  | "RAISE_HAND"
  | "LOWER_HAND"
  | "TURN_PALM"
  | "HANDS_APART"
  | "HANDS_CLOSER"
  | "SAME_HEIGHT"
  | "SHOW_BOTH"
  | "KEEP_BOTH"
  | "WHOLE_HAND"
  | "SEPARATE_HORIZONTALLY"
  | "ALIGN_PALMS";
export interface TrackedHand extends HandInput {
  handedness: "Left" | "Right";
  confidence: number;
  trackingQuality: "valid" | "invalid";
}
export interface TrackedHands {
  left?: TrackedHand;
  right?: TrackedHand;
}
export type CameraFrame = HandInput | TrackedHands | null;
