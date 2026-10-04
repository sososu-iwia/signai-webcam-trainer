import { GestureReference } from "./GestureReference";
import { getGesture } from "../../shared/catalog";
import { useI18n } from "../i18n";
import type { GestureId } from "../../shared/catalog";
export function HandIllustration({
  gesture,
  className = "",
}: {
  gesture: GestureId;
  className?: string;
}) {
  const { t } = useI18n();
  if (gesture.startsWith("kz-"))
    return <GestureReference target={getGesture(gesture)} />;
  return (
    <svg
      viewBox="0 0 240 240"
      className={`hand-illustration ${className}`}
      role="img"
      aria-label={t("{0} reference illustration", {
        0:
          gesture === "fist"
            ? t("Closed fist")
            : gesture === "palm"
              ? t("Open palm")
              : t("V handshape"),
      })}
    >
      <circle cx="120" cy="120" r="98" fill="currentColor" opacity=".06" />
      <g
        fill="#e8bf98"
        stroke="#54473b"
        strokeWidth="3.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {gesture === "palm" && (
          <>
            <path d="M85 215v-27c-17-12-24-27-32-40l-20-31c-9-14 8-25 17-12l24 27-9-71c-2-18 20-20 22-3l9 57-3-78c-1-18 22-19 23-1l5 76 7-84c2-16 23-14 22 3l-6 84 12-65c3-16 25-12 21 5l-12 92c-2 19-14 31-27 41v27" />
            <path
              d="M77 135c18 2 27 14 28 31M108 180c11-11 25-14 40-12M101 124l10 2m16-3 9 1m13 0 8 2"
              fill="none"
            />
          </>
        )}
        {gesture === "fist" && (
          <>
            <path d="M75 216v-32c-19-12-27-29-27-48l-1-37c0-18 25-21 27-4V83c0-18 27-18 28 0v-4c0-18 27-15 28 3v9c1-17 27-11 28 6l2 45c0 20-12 34-24 44v30" />
            <path
              d="M74 106v23c1 12 23 11 24-1v-26m3-14 1 37c0 13 25 12 26-1V92m3 1v32c0 13 25 14 27 0v-24"
              fill="none"
            />
            <path d="M52 141c-8-15 3-26 16-20l56 19c13 5 6 25-6 21l-28-7c-3 15-10 22-21 24" />
            <path d="M91 184c18-8 38-8 52-4" fill="none" />
          </>
        )}
        {gesture === "victory" && (
          <>
            <path d="M82 215v-29c-18-10-27-28-26-46l-5-26c-3-15 18-20 23-6l-15-70c-4-18 18-25 23-7l29 82 22-87c4-19 27-13 23 5l-16 85c2-17 25-18 27-1l2 14c5-15 26-9 25 7l-4 25c-3 18-16 30-31 39v25" />
            <path
              d="m113 119 3 24c2 17 25 12 23-4l-1-21m4 6 4 24c3 15 22 11 23-3v-11"
              fill="none"
            />
            <path d="M61 139c-6-15 8-24 20-16l37 23c14 9 1 27-11 18l-19-12c1 14-5 24-15 29" />
            <path d="M99 187c14-7 31-8 45-4" fill="none" />
          </>
        )}
      </g>
      <g fill="#2e7361">
        <circle cx="120" cy="204" r="4" />
        {gesture === "palm" && (
          <>
            <circle cx="75" cy="65" r="4" />
            <circle cx="104" cy="40" r="4" />
            <circle cx="139" cy="33" r="4" />
            <circle cx="166" cy="58" r="4" />
            <circle cx="41" cy="114" r="4" />
          </>
        )}
        {gesture === "victory" && (
          <>
            <circle cx="71" cy="39" r="4" />
            <circle cx="144" cy="30" r="4" />
          </>
        )}
        {gesture === "fist" && (
          <>
            <circle cx="87" cy="86" r="4" />
            <circle cx="115" cy="76" r="4" />
            <circle cx="145" cy="86" r="4" />
          </>
        )}
      </g>
    </svg>
  );
}
