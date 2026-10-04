export const gestureIds = ["fist", "palm", "victory"] as const;
export const courseGestureIds = [
  "kz-a",
  "kz-v",
  "kz-u-diaeresis",
  "kz-o",
  "kz-u",
  "kz-i",
  "kz-l",
  "kz-m",
  "kz-n",
] as const;
export const supportedGestureIds = [
  ...gestureIds,
  ...courseGestureIds,
] as const;
export type CourseGestureId = (typeof courseGestureIds)[number];
export type GestureId = (typeof supportedGestureIds)[number];
export type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";
export type FingerState = "extended" | "folded";
export interface GestureDefinition {
  id: GestureId;
  handMode: "single";
  allowedHand: "either" | "left" | "right";
  letter?: string;
  rules?: PoseRule[];
  label: string;
  shortInstruction: string;
  tips: string[];
  difficulty: "Beginner";
  fingers: Record<Finger, FingerState>;
  separation?: { min: number; max: number };
  orientation: { minFacing: number };
  position: {
    minScale: number;
    maxScale: number;
    x: [number, number];
    y: [number, number];
  };
  thresholds: { success: number; finger: number; holdMs: number };
  reference: { view: string; description: string };
}
const common = {
  handMode: "single" as const,
  allowedHand: "either" as const,
  difficulty: "Beginner" as const,
  orientation: { minFacing: 0.36 },
  position: {
    minScale: 0.1,
    maxScale: 0.48,
    x: [0.2, 0.8] as [number, number],
    y: [0.22, 0.8] as [number, number],
  },
  thresholds: { success: 84, finger: 0.66, holdMs: 800 },
};
export const gestures: GestureDefinition[] = [
  {
    ...common,
    id: "fist",
    label: "Closed fist",
    shortInstruction:
      "Fold your fingers into your palm. Rest your thumb across them.",
    tips: [
      "Keep all four fingers folded.",
      "Rest your thumb across your fingers.",
      "Face your knuckles toward the camera.",
    ],
    fingers: {
      thumb: "folded",
      index: "folded",
      middle: "folded",
      ring: "folded",
      pinky: "folded",
    },
    reference: {
      view: "Front view · either hand",
      description:
        "A closed fist, with the thumb resting across the folded fingers.",
    },
  },
  {
    ...common,
    id: "palm",
    label: "Open palm",
    shortInstruction:
      "Open your hand and straighten all five fingers toward the camera.",
    tips: [
      "Straighten all four fingers.",
      "Open your thumb away from your palm.",
      "Keep your palm facing the camera.",
    ],
    fingers: {
      thumb: "extended",
      index: "extended",
      middle: "extended",
      ring: "extended",
      pinky: "extended",
    },
    reference: {
      view: "Palm view · either hand",
      description: "An open palm with all fingers and the thumb extended.",
    },
  },
  {
    ...common,
    id: "victory",
    label: "V handshape",
    shortInstruction:
      "Extend your index and middle fingers in a V. Fold the others.",
    tips: [
      "Straighten your index and middle fingers.",
      "Separate those two fingers into a V.",
      "Keep your ring finger, pinky and thumb folded.",
    ],
    fingers: {
      thumb: "folded",
      index: "extended",
      middle: "extended",
      ring: "folded",
      pinky: "folded",
    },
    separation: { min: 0.28, max: 1.35 },
    reference: {
      view: "Palm view · either hand",
      description:
        "Index and middle fingers extended and separated, with the other fingers folded.",
    },
  },
];
export const lesson = {
  id: "handshape-basics",
  title: "Handshape Basics",
  description: "Three simple shapes. Your first step toward signing.",
  gestureIds: ["palm", "fist", "victory"] as GestureId[],
  duration: "3–5 min",
  level: "Getting started",
};
export function getGesture(id: GestureId) {
  return [...gestures, ...courseGestures].find((g) => g.id === id)!;
}

export type PoseRule =
  | { type: "contact"; fingers: [Finger, Finger]; max: number; weight: number }
  | {
      type: "spread";
      fingers: [Finger, Finger];
      min: number;
      max: number;
      weight: number;
    }
  | {
      type: "direction";
      direction: "up" | "down";
      min: number;
      weight: number;
    };
const pose = (
  id: CourseGestureId,
  letter: string,
  fingers: GestureDefinition["fingers"],
  shortInstruction: string,
  rules: PoseRule[] = [],
): GestureDefinition => ({
  ...common,
  id,
  letter,
  label: letter,
  shortInstruction,
  fingers,
  rules,
  tips: [shortInstruction],
  reference: { view: "Palm view · either hand", description: shortInstruction },
});
const folded: GestureDefinition["fingers"] = {
  thumb: "folded",
  index: "folded",
  middle: "folded",
  ring: "folded",
  pinky: "folded",
};
const spread: PoseRule = {
  type: "spread",
  fingers: ["index", "middle"],
  min: 0.28,
  max: 1.35,
  weight: 1,
};
const down: PoseRule = {
  type: "direction",
  direction: "down",
  min: 0.45,
  weight: 1.5,
};
export const courseGestures: GestureDefinition[] = [
  pose(
    "kz-a",
    "А",
    folded,
    "Fold all four fingers. Rest your thumb beside the folded fingers.",
  ),
  pose(
    "kz-v",
    "В",
    {
      thumb: "extended",
      index: "extended",
      middle: "extended",
      ring: "extended",
      pinky: "extended",
    },
    "Straighten four fingers close together. Keep your thumb open.",
    [
      {
        type: "spread",
        fingers: ["index", "middle"],
        min: 0,
        max: 0.48,
        weight: 1,
      },
      {
        type: "spread",
        fingers: ["middle", "ring"],
        min: 0,
        max: 0.48,
        weight: 1,
      },
      {
        type: "spread",
        fingers: ["ring", "pinky"],
        min: 0,
        max: 0.48,
        weight: 1,
      },
    ],
  ),
  pose(
    "kz-u-diaeresis",
    "Ү",
    { ...folded, index: "extended", middle: "extended" },
    "Extend and separate your index and middle fingers. Fold the other fingers.",
    [spread, { type: "direction", direction: "up", min: 0.25, weight: 1.5 }],
  ),
  pose(
    "kz-o",
    "О",
    { ...folded, middle: "extended", ring: "extended", pinky: "extended" },
    "Connect your thumb and index finger in a rounded shape. Keep the other three fingers straight.",
    [{ type: "contact", fingers: ["thumb", "index"], max: 0.22, weight: 2 }],
  ),
  pose(
    "kz-u",
    "У",
    { ...folded, thumb: "extended", pinky: "extended" },
    "Extend your thumb and little finger. Fold the other three fingers.",
  ),
  pose(
    "kz-i",
    "И",
    { ...folded, ring: "extended", pinky: "extended" },
    "Extend your ring and little fingers. Fold your index and middle fingers.",
  ),
  pose(
    "kz-l",
    "Л",
    { ...folded, index: "extended", middle: "extended" },
    "Point your separated index and middle fingers downward. Fold the other fingers.",
    [spread, down],
  ),
  pose(
    "kz-m",
    "М",
    { ...folded, index: "extended", middle: "extended", ring: "extended" },
    "Point your index, middle and ring fingers downward, slightly apart. Fold your little finger.",
    [
      spread,
      {
        type: "spread",
        fingers: ["middle", "ring"],
        min: 0.22,
        max: 1.35,
        weight: 1,
      },
      down,
    ],
  ),
  pose(
    "kz-n",
    "Н",
    { ...folded, index: "extended", middle: "extended", pinky: "extended" },
    "Extend your index, middle and little fingers. Fold your ring finger and thumb.",
  ),
];
export interface DualGestureDefinition {
  id: "dev-dual";
  handMode: "dual";
  leftHand: GestureDefinition;
  rightHand: GestureDefinition;
  relationship: {
    distanceRange: [number, number];
    verticalRelation: "same" | "left-above" | "right-above";
    horizontalRelation: "apart" | "left-before-right";
    orientationRelation: "any" | "parallel";
    tolerance: number;
  };
  weights: { left: number; right: number; relationship: number };
  thresholds: { success: number; holdMs: number };
}
export type GestureTarget = GestureDefinition | DualGestureDefinition;
