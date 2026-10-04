import { correctionText } from "../i18n/feedback";
import { courseGestures } from "../../shared/catalog";
import { useI18n } from "../i18n";
import { useCallback, useState } from "react";
import { Delete, Hand, Trash2 } from "lucide-react";
import { gestures, getGesture, type GestureId } from "../../shared/catalog";
import { CameraStage } from "../components/CameraStage";
import { Meter, PageHeading, useTitle } from "../components/Common";
import { HandIllustration } from "../components/HandIllustration";
import { useCoach } from "../hooks/useCoach";
import type { Evaluation } from "../gesture-engine/types";
interface Entry {
  id: string;
  gestureId: GestureId;
  score: number;
}
export function Translate() {
  const { t, text, locale } = useI18n();
  const [course, setCourse] = useState(false);
  useTitle("Supported Gesture Translator");
  const [entries, setEntries] = useState<Entry[]>([]);
  const onComplete = useCallback((evaluation: Evaluation) => {
    if (evaluation.gestureId === "dev-dual") return;
    const gestureId = evaluation.gestureId;
    setEntries((previous) =>
      [
        ...previous,
        {
          id: crypto.randomUUID(),
          gestureId,
          score: evaluation.score,
        },
      ].slice(-100),
    );
  }, []);
  const coach = useCoach(
    null,
    onComplete,
    undefined,
    course ? courseGestures : gestures,
  );
  const recognized =
    coach.state.evaluation?.gestureId === "dev-dual"
      ? null
      : coach.state.evaluation;
  return (
    <div className="page">
      <PageHeading
        eyebrow={t("THE GESTURE LAB")}
        title={t("Supported Gesture Translator")}
        description={t(
          course
            ? "Explore nine static handshapes and build a sequence as you go."
            : "Explore the three supported handshapes and build a sequence as you go.",
        )}
      />
      <div className="catalog-switch">
        <button
          className="button button-outline"
          aria-pressed={!course}
          onClick={() => setCourse(false)}
        >
          {t("Classic three shapes")}
        </button>
        <button
          className="button button-outline"
          aria-pressed={course}
          onClick={() => setCourse(true)}
        >
          {t("Nine handshapes")}
        </button>
      </div>
      <div className="prototype-note">
        <Hand size={18} />
        <p>
          <strong>{t("Supported-gesture prototype.")}</strong>{" "}
          {t(
            "This lab identifies handshape labels. It does not translate full sign languages or sentences.",
          )}
        </p>
      </div>
      <div className="translator-grid">
        <CameraStage onHand={coach.onHand} setup={coach.state} />
        <section className="transcript-panel">
          <p className="eyebrow">{t("LIVE RECOGNITION")}</p>
          <h2>
            {recognized
              ? text(getGesture(recognized.gestureId as GestureId).label)
              : t("Ready when you are")}
          </h2>
          <p className="live-match">
            {recognized
              ? t("{0}% shape match", { 0: coach.state.score })
              : t("Show one of the shapes below to begin.")}
          </p>
          <Meter
            value={coach.state.hold * 100}
            label={t("Recognition hold progress")}
          />
          <p className="lab-feedback" role="status">
            {correctionText(
              locale,
              coach.state.primaryMistake,
              coach.state.feedback,
            )}
          </p>
          <div className="section-heading">
            <h3>{t("Your sequence")}</h3>
            <span>{entries.length} / 100</span>
          </div>
          <div
            className="transcript"
            aria-label={t("Recognized sequence")}
            aria-live="polite"
          >
            {entries.length ? (
              entries.map((entry) => (
                <span className="transcript-entry" key={entry.id}>
                  {text(getGesture(entry.gestureId).label)}
                  <small>{entry.score}%</small>
                </span>
              ))
            ) : (
              <div className="empty-transcript">
                <Hand size={30} strokeWidth={1.4} />
                <p>
                  {t("Your recognized handshapes")}
                  <br />
                  {t("will appear here.")}
                </p>
              </div>
            )}
          </div>
          <div className="transcript-actions">
            <button
              className="button button-outline"
              disabled={!entries.length}
              onClick={() => setEntries((e) => e.slice(0, -1))}
            >
              <Delete size={17} />
              {t("Remove last")}
            </button>
            <button
              className="text-button"
              disabled={!entries.length}
              onClick={() => setEntries([])}
            >
              <Trash2 size={16} />
              {t("Clear")}
            </button>
          </div>
          <p className="auto-note">
            {t(
              "Hold each shape briefly. Lower your hand for a moment to repeat the same shape. This sequence stays in this session.",
            )}
          </p>
        </section>
      </div>
      <section className="supported-shapes">
        <h2>{course ? t("Nine handshapes") : t("Three shapes to try")}</h2>
        <div>
          {(course ? courseGestures : gestures).map((g) => (
            <div className="supported-shape" key={g.id}>
              <HandIllustration gesture={g.id} />
              <div>
                <h3>{text(g.label)}</h3>
                <p>{text(g.shortInstruction)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
