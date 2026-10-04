import { CourseMastery } from "../components/CourseMastery";
import { useI18n } from "../i18n";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  RotateCcw,
  Target,
  Zap,
  Lightbulb,
  Check,
} from "lucide-react";
import { lesson, getGesture } from "../../shared/catalog";
import { practiceRecommendation, rewards } from "../../shared/learning";
import { useProgress } from "../hooks/useProgress";
import { HandIllustration } from "../components/HandIllustration";
import { PageHeading, useTitle } from "../components/Common";
import { armSuccessAudio } from "../services/sound";
const corrections: Record<string, string> = {
  thumb: "Find a comfortable thumb position.",
  index: "Work on extending and folding your index finger.",
  middle: "Give your middle finger a little attention.",
  ring: "Practice keeping your ring finger in position.",
  pinky: "Work on your little finger’s position.",
  separation: "Practice separating your index and middle fingers.",
  orientation: "Face your hand toward the camera.",
  position: "Keep your hand comfortably centered.",
  scale: "Find a comfortable distance from your camera.",
  visibility: "Keep your whole hand inside the frame.",
};
export function Practice() {
  const { t, text } = useI18n();
  useTitle("Practice");
  const { progress } = useProgress();
  const weakest = practiceRecommendation(progress);
  const recent = [
    ...new Set(progress.attempts.slice(0, 8).flatMap((a) => a.mistakes)),
  ].slice(0, 3);
  return (
    <div className="page practice-page">
      <PageHeading
        eyebrow={t("MAKE IT SECOND NATURE")}
        title={t("A little practice. A lot of possibility.")}
        description={t(
          "Revisit a shape, work through an adjustment, or go for your personal best.",
        )}
      />
      <section className="quick-practice">
        <div className="quick-copy">
          <span className="practice-kicker">
            <RotateCcw size={17} />
            {t("QUICK PRACTICE")}
          </span>
          <h2>
            {t("One shape.")}
            <br /> {t("One small win.")}
          </h2>
          <p>
            {t(
              "Pick a handshape and give it a go. Your coach will help you find the position.",
            )}
          </p>
          <span className="quick-xp">
            <Zap size={17} fill="currentColor" />+
            {rewards.exercise + rewards.practiceBonus}{" "}
            {t("XP per completed practice")}
          </span>
        </div>
        <div className="quick-choices">
          {lesson.gestureIds.map((id) => (
            <Link
              key={id}
              to={`/trainer/handshape-basics?practice=${id}`}
              state={{ autoStart: true }}
              onClick={armSuccessAudio}
              className="quick-choice"
            >
              <HandIllustration gesture={id} />
              <strong>{text(getGesture(id).label)}</strong>
              <span>
                {t("LET’S TRY IT")} <ArrowRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <div className="practice-modules">
        <section className="practice-module">
          <span className="module-icon blue">
            <Target size={26} />
          </span>
          <p className="eyebrow">{t("YOUR NEXT FOCUS")}</p>
          <h2>
            {weakest
              ? t("A little love for {0}.", {
                  0: text(weakest.label).toLowerCase(),
                })
              : t("Let’s find your starting point.")}
          </h2>
          <p>
            {weakest
              ? weakest.reason === "missed"
                ? t(
                    "You recently left this shape unfinished. Give it another try with your coach.",
                  )
                : t(
                    "Your average is {0}%. A short focused practice can help the shape feel more natural.",
                    { 0: weakest.average },
                  )
              : t(
                  "Complete your first lesson to see practice recommendations that are personal to you.",
                )}
          </p>
          <Link
            className="button button-outline"
            to={
              weakest
                ? `/trainer/handshape-basics?practice=${weakest.gestureId}`
                : "/learn"
            }
            state={{ autoStart: true }}
            onClick={weakest ? armSuccessAudio : undefined}
          >
            {weakest ? t("Practice this shape") : t("Start learning")}
            <ArrowRight size={17} />
          </Link>
        </section>
        <section className="practice-module">
          <span className="module-icon gold">
            <Zap size={26} />
          </span>
          <p className="eyebrow">{t("PERFECT YOUR SCORE")}</p>
          <h2>{t("Bring all three together.")}</h2>
          <p>
            {t(
              "Open palm, closed fist, V. A familiar sequence with another chance to feel more confident.",
            )}
          </p>
          <Link
            className="button button-outline"
            to="/trainer/handshape-basics?practice=all"
            state={{ autoStart: true }}
            onClick={armSuccessAudio}
          >
            {t("Practice all three")} <ArrowRight size={17} />
          </Link>
        </section>
      </div>
      <CourseMastery />
      <section className="recent-coaching">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("SMALL ADJUSTMENTS MATTER")}</p>
            <h2>{t("Your practice pointers")}</h2>
          </div>
          <Lightbulb size={25} />
        </div>
        {recent.length ? (
          <div className="coaching-pointers">
            {recent.map((category) => (
              <p key={category}>
                <Check size={18} />
                {text(corrections[category])}
              </p>
            ))}
          </div>
        ) : (
          <p>
            {t(
              "As you practice, useful reminders from your coach will appear here. Nothing to fix before you’ve even started.",
            )}
          </p>
        )}
      </section>
    </div>
  );
}
