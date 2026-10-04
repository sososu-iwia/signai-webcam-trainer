import { translate, type Language, useI18n } from "../i18n";
import { useEffect } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { getGesture, type GestureId } from "../../shared/catalog";
import type { Attempt } from "../../shared/schema";
export function useTitle(title: string) {
  const { text } = useI18n();
  const localizedTitle = text(title);
  useEffect(() => {
    document.title = `${localizedTitle} · SignAI`;
  }, [localizedTitle]);
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  const { text } = useI18n();
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{text(eyebrow)}</p>
        <h1>{text(title)}</h1>
        <p className="page-description">{text(description)}</p>
      </div>
      {children}
    </div>
  );
}
export function LessonButton({
  children = "Start lesson",
}: {
  children?: React.ReactNode;
}) {
  const { text } = useI18n();
  return (
    <Link to="/trainer/handshape-basics" className="button button-primary">
      {typeof children === "string" ? text(children) : children}
      <ArrowRight size={18} />
    </Link>
  );
}
export function Meter({
  value,
  label,
  className = "",
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const { text } = useI18n();
  return (
    <div
      className={`meter ${className}`}
      role="progressbar"
      aria-label={text(label)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.max(0, Math.min(100, value)))}
    >
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
export function AttemptList({ attempts }: { attempts: Attempt[] }) {
  const { t, text, locale } = useI18n();
  return (
    <div className="attempt-list">
      {attempts.map((a) => (
        <div className="attempt-row" key={a.id}>
          <span className={`attempt-icon ${a.success ? "success" : ""}`}>
            {a.success ? <Check size={17} /> : "↻"}
          </span>
          <div>
            <strong>{text(getGesture(a.gestureId as GestureId).label)}</strong>
            <span>
              {text(
                new Date(a.createdAt).toLocaleDateString(locale, {
                  month: "short",
                  day: "numeric",
                }),
              )}{" "}
              · {a.success ? t("Completed") : t("Practiced")}
            </span>
          </div>
          <strong className="attempt-score">
            {Math.round(a.score)}
            <small>%</small>
          </strong>
        </div>
      ))}
    </div>
  );
}
export function duration(ms: number, locale: Language = "en") {
  const seconds = Math.round(ms / 1000);
  return translate(locale, "{0}m {1}s", {
    0: Math.floor(seconds / 60),
    1: seconds % 60,
  });
}
