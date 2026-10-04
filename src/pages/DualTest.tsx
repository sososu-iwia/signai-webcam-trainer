import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { getGesture, type DualGestureDefinition } from "../../shared/catalog";
import { useCoach } from "../hooks/useCoach";
import { useI18n } from "../i18n";
import { correctionText } from "../i18n/feedback";
import { CameraStage } from "../components/CameraStage";
import { GestureReference } from "../components/GestureReference";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Meter } from "../components/Common";
export const dualTestTarget: DualGestureDefinition = {
  id: "dev-dual",
  handMode: "dual",
  leftHand: getGesture("palm"),
  rightHand: getGesture("fist"),
  relationship: {
    distanceRange: [1.1, 3.2],
    verticalRelation: "same",
    horizontalRelation: "apart",
    orientationRelation: "any",
    tolerance: 0.3,
  },
  weights: { left: 0.4, right: 0.4, relationship: 0.2 },
  thresholds: { success: 84, holdMs: 800 },
};
export default function DualTest() {
  const { t, locale } = useI18n();
  const [round, setRound] = useState(0);
  const complete = useCallback(() => {}, []);
  const coach = useCoach(
    dualTestTarget,
    complete,
    undefined,
    undefined,
    String(round),
  );
  return (
    <main className="page dual-test">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("DEVELOPMENT ONLY")}</p>
          <h1>{t("Development two-hand test")}</h1>
        </div>
        <LanguageSwitcher />
      </div>
      <p>
        {t(
          "Not linguistic content. Left palm, right fist; same height, moderate spacing.",
        )}
      </p>
      <div className="exercise-layout">
        <CameraStage
          onHand={coach.onHand}
          setup={coach.state}
          requiredHands={2}
        />
        <section className="coach-panel course-coach">
          <GestureReference target={dualTestTarget} />
          <p role="status">
            {correctionText(
              locale,
              coach.state.primaryMistake,
              coach.state.feedback === "Show your hand to the camera"
                ? "Show both hands to the camera."
                : coach.state.feedback,
            )}
          </p>
          <Meter value={coach.state.hold * 100} label={t("Hold progress")} />
          <dl>
            <dt>{t("Left hand score")}</dt>
            <dd>{coach.state.evaluation?.handScores?.left ?? 0}%</dd>
            <dt>{t("Right hand score")}</dt>
            <dd>{coach.state.evaluation?.handScores?.right ?? 0}%</dd>
            <dt>{t("Relationship score")}</dt>
            <dd>{coach.state.evaluation?.handScores?.relationship ?? 0}%</dd>
            <dt>{t("Tracking FPS")}</dt>
            <dd>{coach.state.fps}</dd>
          </dl>
          {coach.state.completed && <strong>{t("Great!")}</strong>}
          <button
            className="button button-outline"
            onClick={() => setRound((n) => n + 1)}
          >
            {t("Repeat test")}
          </button>
        </section>
      </div>
      <Link to="/dev">{t("DEVELOPMENT ONLY")}</Link>
    </main>
  );
}
