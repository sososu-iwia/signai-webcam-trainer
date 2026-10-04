import { armSuccessAudio } from "../services/sound";
import { Link } from "react-router-dom";
import { ArrowRight, Check, LockKeyhole, Play } from "lucide-react";
import { courseProgress, exerciseSteps } from "../../shared/course";
import { getGesture } from "../../shared/catalog";
import { useProgress } from "../hooks/useProgress";
import { useI18n } from "../i18n";
export function CoursePath() {
  const { progress } = useProgress();
  const { t, text } = useI18n();
  const units = courseProgress(progress);
  return (
    <section
      className="course-path"
      id="course"
      aria-label={t("Your three-unit course")}
    >
      <div className="section-heading">
        <div>
          <h2>{t("Your three-unit course")}</h2>
          <p>
            {t(
              "Nine static training targets. No words or full-language translation.",
            )}
          </p>
        </div>
      </div>
      <div className="course-demo">
        <div>
          <strong>А · В · Ү</strong>
          <p>
            {t("Three targets. A short camera session with live coaching.")}
          </p>
        </div>
        <Link
          className="button button-primary"
          to="/trainer/first-handshapes?activity=first-handshapes-demo"
          state={{ autoStart: true }}
          onClick={armSuccessAudio}
        >
          <Play size={17} />
          {t("Start the quick demo")}
        </Link>
      </div>
      <div className="course-unit-list">
        {units.map((unit, index) => (
          <details
            className={`course-unit ${unit.unlocked ? "" : "locked"}`}
            key={unit.id}
            open={index === 0 ? true : undefined}
          >
            <summary>
              <span className="course-unit-number">
                {unit.completed ? (
                  <Check size={22} />
                ) : unit.unlocked ? (
                  index + 1
                ) : (
                  <LockKeyhole size={20} />
                )}
              </span>
              <span>
                <small>{t("Unit {number}", { number: index + 1 })}</small>
                <strong>{text(unit.titleKey)}</strong>
                <span>
                  {unit.gestureIds
                    .map((id) => getGesture(id).letter)
                    .join(" · ")}
                </span>
              </span>
            </summary>
            <p>{text(unit.descriptionKey)}</p>
            {!unit.unlocked && (
              <p className="course-lock" role="status">
                {t("Complete the previous checkpoint to unlock this unit.")}
              </p>
            )}
            <ol className="course-activities">
              {unit.nodes.map((node, i) => {
                const label = `${text(node.titleKey)} · ${node.exercise.type === "CHECKPOINT" ? unit.gestureIds.map((id) => getGesture(id).letter).join(" ") : node.exercise.gestureIds.map((id) => getGesture(id).letter).join(" ")}`;
                const xp =
                  exerciseSteps(node.exercise).reduce(
                    (sum, s) => sum + s.xp,
                    0,
                  ) + node.finishXP;
                return (
                  <li key={node.id}>
                    {node.unlocked ? (
                      <Link
                        to={`/trainer/${unit.id}?activity=${node.id}`}
                        state={{ autoStart: true }}
                        onClick={armSuccessAudio}
                      >
                        <span>{node.done ? <Check size={18} /> : i + 1}</span>
                        <strong>{label}</strong>
                        <small>+{xp} XP</small>
                        <ArrowRight size={17} />
                      </Link>
                    ) : (
                      <div aria-label={`${label} · ${t("locked")}`}>
                        <LockKeyhole size={17} />
                        <strong>{label}</strong>
                        <small>{t("locked")}</small>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </details>
        ))}
      </div>
      <p className="scope-note">{t("More lessons coming soon")}</p>
    </section>
  );
}
