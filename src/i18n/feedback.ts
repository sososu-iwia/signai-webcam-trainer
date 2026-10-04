import { displayText, translate, type Language } from "./index";
import type { Mistake } from "../gesture-engine/types";
export function correctionText(
  locale: Language,
  mistake: Mistake | null,
  fallback = "",
) {
  if (!mistake?.code) return displayText(locale, mistake?.message || fallback);
  const t = (
    key: Parameters<typeof translate>[1],
    values?: Record<string, string | number>,
  ) => translate(locale, key, values);
  const right = mistake.hand === "right";
  const finger = displayText(locale, `${mistake.finger || "index"} finger`);
  switch (mistake.code) {
    case "CONNECT_FINGERS":
      return t("Connect your thumb and index finger.");
    case "SPREAD_FINGERS":
      return t("Spread your fingers slightly.");
    case "CLOSE_FINGERS":
      return t("Bring your fingers closer together.");
    case "TURN_DOWN":
      return t("Turn your hand downward.");
    case "TURN_UP":
      return t("Turn your hand upward.");
    case "EXTEND_FINGER":
      return t(
        right
          ? "Straighten the {finger} on your right hand."
          : "Straighten the {finger} on your left hand.",
        { finger },
      );
    case "FOLD_FINGER":
      return t(
        right
          ? "Fold the {finger} on your right hand."
          : "Fold the {finger} on your left hand.",
        { finger },
      );
    case "RAISE_HAND":
      return t(
        right
          ? "Raise your right hand slightly."
          : "Raise your left hand slightly.",
      );
    case "LOWER_HAND":
      return t(right ? "Lower your right hand." : "Lower your left hand.");
    case "TURN_PALM":
      return t(
        right
          ? "Turn your right palm toward the camera."
          : "Turn your left palm toward the camera.",
      );
    case "HANDS_APART":
      return t("Move your hands farther apart.");
    case "HANDS_CLOSER":
      return t("Bring your hands closer together.");
    case "SAME_HEIGHT":
      return t("Keep both hands at the same height.");
    case "SHOW_BOTH":
      return t("Show both hands to the camera.");
    case "KEEP_BOTH":
      return t("Keep both hands inside the frame.");
    case "WHOLE_HAND":
      return t(
        right
          ? "Keep your whole right hand in the frame."
          : "Keep your whole left hand in the frame.",
      );
    case "SEPARATE_HORIZONTALLY":
      return t("Keep your hands separated horizontally.");
    case "ALIGN_PALMS":
      return t("Keep your palms facing the same direction.");
  }
}
