import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getGesture } from "../../shared/catalog";
import { learningStats } from "../../shared/learning";
import { useProgress } from "../hooks/useProgress";
import { useI18n } from "../i18n";
import { GestureReference } from "./GestureReference";
export function CourseMastery() {
  const { progress } = useProgress();
  const { t, text, plural } = useI18n();
  return (
    <section className="course-mastery">
      <div className="section-heading">
        <div>
          <h2>{t("Learned handshapes")}</h2>
          <p>{t("Recognition practice does not measure camera mastery.")}</p>
        </div>
      </div>
      <div className="course-mastery-grid">
        {learningStats(progress).courseMastery.map((m) => (
          <article key={m.gestureId}>
            <GestureReference target={getGesture(m.gestureId)} compact />
            <div>
              <strong>{getGesture(m.gestureId).letter}</strong>
              <span>{text(m.state)}</span>
              <small>
                {m.count
                  ? `${plural("attempt", m.count)} · ${t("Best: {score}%", { score: m.best })}`
                  : t("No completed camera attempts yet.")}
              </small>
            </div>
            <Link
              className="icon-button"
              to={`/trainer/course-practice?practice=${m.gestureId}`}
              aria-label={t("Practice {0}", { 0: m.label })}
            >
              <ArrowRight size={20} />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
