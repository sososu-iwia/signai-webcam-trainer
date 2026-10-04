import type {
  Finger,
  GestureDefinition,
  GestureTarget,
} from "../../shared/catalog";
import { useI18n } from "../i18n";
const bases: Record<Finger, [number, number]> = {
  thumb: [68, 178],
  index: [87, 145],
  middle: [116, 137],
  ring: [144, 147],
  pinky: [166, 166],
};
function HandDiagram({
  pose,
  side = "right",
  concealLetter = false,
}: {
  pose: GestureDefinition;
  side?: "left" | "right";
  concealLetter?: boolean;
}) {
  const { t, text } = useI18n();
  const downward = pose.rules?.some(
    (r) => r.type === "direction" && r.direction === "down",
  );
  const contact = pose.rules?.some((r) => r.type === "contact");
  const spread =
    pose.rules?.some((r) => r.type === "spread" && r.min > 0) ||
    pose.id === "victory";
  const fingers = (Object.keys(bases) as Finger[]).map((finger, index) => {
    const [x, y] = bases[finger];
    const extended = pose.fingers[finger] === "extended";
    const fan = spread ? (index - 2) * 13 : 0;
    let points =
      finger === "thumb"
        ? extended
          ? [
              [68, 178],
              [52, 155],
              [34, 140],
              [22, 122],
            ]
          : [
              [68, 178],
              [82, 170],
              [103, 176],
              [124, 178],
            ]
        : extended
          ? [
              [x, y],
              [x + fan, y - 45],
              [x + fan * 1.25, y - 75],
              [x + fan * 1.5, y - 95],
            ]
          : [
              [x, y],
              [x - 3, y - 24],
              [x + 4, y + 11],
              [x + 6, y + 31],
            ];
    if (contact && finger === "index")
      points = [
        [87, 145],
        [68, 101],
        [53, 122],
        [75, 140],
      ];
    if (contact && finger === "thumb")
      points = [
        [68, 178],
        [50, 158],
        [54, 141],
        [75, 140],
      ];
    return { finger, points };
  });
  return (
    <svg
      className="procedural-hand"
      viewBox="0 0 240 280"
      role="img"
      aria-label={
        concealLetter
          ? text(pose.shortInstruction)
          : pose.letter
            ? t("Letter {letter} reference", { letter: pose.letter })
            : text(pose.label)
      }
    >
      <g
        transform={`${side === "left" ? "translate(240 0) scale(-1 1)" : ""} ${downward ? "rotate(180 120 140)" : ""}`}
      >
        <path
          d="M87 257 L87 218 Q58 202 65 172 L87 145 Q119 123 166 166 L174 195 Q175 215 151 226 L151 257"
          fill="#efd0af"
          stroke="#54473b"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {fingers.map(({ finger, points }) => (
          <g key={finger}>
            <polyline
              points={points.map((p) => p.join(",")).join(" ")}
              fill="none"
              stroke="#54473b"
              strokeWidth="20"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={points.map((p) => p.join(",")).join(" ")}
              fill="none"
              stroke="#efd0af"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map(([x, y], index) => (
              <circle key={index} cx={x} cy={y} r="3" fill="#365e91" />
            ))}
          </g>
        ))}
        <circle cx="120" cy="227" r="4" fill="#365e91" />
      </g>
      {downward && (
        <path
          d="M216 80 V175 M207 164 L216 177 L225 164"
          fill="none"
          stroke="#4266d5"
          strokeWidth="4"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
export function GestureReference({
  target,
  compact = false,
  concealLetter = false,
}: {
  target: GestureTarget;
  compact?: boolean;
  concealLetter?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div
      style={
        target.handMode === "dual"
          ? {
              columnGap: Math.min(
                48,
                Math.max(8, target.relationship.distanceRange[0] * 12),
              ),
            }
          : undefined
      }
      className={`gesture-reference ${compact ? "compact" : ""} ${target.handMode}`}
    >
      {target.handMode === "single" ? (
        <HandDiagram
          pose={target}
          side={target.allowedHand === "left" ? "left" : "right"}
          concealLetter={concealLetter}
        />
      ) : (
        <>
          <div
            style={{
              paddingTop:
                target.relationship.verticalRelation === "right-above" ? 32 : 0,
            }}
          >
            <span>{t("Left")}</span>
            <HandDiagram pose={target.leftHand} side="left" />
          </div>
          <div
            style={{
              paddingTop:
                target.relationship.verticalRelation === "left-above" ? 32 : 0,
            }}
          >
            <span>{t("Right")}</span>
            <HandDiagram pose={target.rightHand} />
          </div>
          <p>
            {target.relationship.verticalRelation === "same"
              ? t("Keep both hands at the same height.")
              : target.relationship.verticalRelation === "left-above"
                ? t("Raise your left hand slightly.")
                : t("Raise your right hand slightly.")}
          </p>
        </>
      )}
    </div>
  );
}
