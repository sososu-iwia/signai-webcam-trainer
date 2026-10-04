import { lazy, Suspense } from "react";
const ExercisePlayer = lazy(() =>
  import("./ExercisePlayer").then((module) => ({
    default: module.ExercisePlayer,
  })),
);
import { correctionText } from "../i18n/feedback";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useI18n } from "../i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Check,
  CircleCheck,
  Lightbulb,
  ScanLine,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import {
  getGesture,
  supportedGestureIds,
  lesson,
  type GestureId,
} from "../../shared/catalog";
import {
  learningStats,
  learningPath,
  localDay,
  rewards,
  type LearningNode,
} from "../../shared/learning";
import type { Attempt, LessonResult } from "../../shared/schema";
import { CameraStage } from "../components/CameraStage";
import { HandIllustration } from "../components/HandIllustration";
import { Meter, useTitle } from "../components/Common";
import { useCoach } from "../hooks/useCoach";
import { useProgress } from "../hooks/useProgress";
import type { Evaluation, MistakeCategory } from "../gesture-engine/types";
import { saveAttempt, saveResult } from "../services/progress";
import {
  retainSuccessAudio,
  releaseSuccessAudio,
  playSuccess,
  soundEnabled,
  toggleSound,
} from "../services/sound";
import { scoreLabel } from "../gesture-engine/stability";
import { NotFound } from "./NotFound";
export function Trainer() {
  const { t } = useI18n();
  const { lessonId } = useParams();
  const [params] = useSearchParams();
  const { progress } = useProgress();
  const stats = learningStats(progress);
  const nodeId = params.get("node");
  const practice = params.get("practice");
  if (lessonId !== lesson.id)
    return (
      <Suspense fallback={<p>{t("Loading…")}</p>}>
        <ExercisePlayer />
      </Suspense>
    );
  if (
    lessonId !== lesson.id ||
    Boolean(nodeId && practice) ||
    (practice &&
      practice !== "all" &&
      !supportedGestureIds.includes(practice as GestureId))
  )
    return <NotFound />;
  const node = nodeId ? learningPath.find((n) => n.id === nodeId) : undefined;
  if (nodeId && !node) return <NotFound />;
  if (node && stats.path.find((n) => n.id === node.id)?.state === "locked")
    return (
      <div className="centered-state">
        <LanguageSwitcher />
        <h1>{t("This step is up ahead.")}</h1>
        <p>{t("Complete the previous session to unlock it.")}</p>
        <Link to="/learn" className="button button-primary">
          {t("Back to your path")}
        </Link>
      </div>
    );
  return (
    <LessonTrainer
      key={`${nodeId || "warm-up"}-${practice || "lesson"}`}
      node={node}
      practice={practice}
    />
  );
}
function LessonTrainer({
  node,
  practice,
}: {
  node?: LearningNode;
  practice: string | null;
}) {
  const { t, text, locale } = useI18n();
  const isPractice = Boolean(practice) || node?.kind === "practice";
  const title = node?.title || (isPractice ? "Quick Practice" : "Warm Up");
  useTitle(t("{0} · Practice", { 0: text(title) }));
  const navigate = useNavigate();
  const location = useLocation();
  const autoStart = Boolean(location.state?.autoStart);
  const targets = useMemo(
    () =>
      practice && practice !== "all"
        ? [getGesture(practice as GestureId)]
        : lesson.gestureIds.map(getGesture),
    [practice],
  );
  const [step, setStep] = useState(0),
    [sound, setSound] = useState(soundEnabled);
  const target = targets[step];
  const attempts = useRef<Attempt[]>([]),
    lessonStart = useRef<number | null>(null),
    stepStart = useRef<number | null>(null);
  const mistakes = useRef(new Set<MistakeCategory>()),
    corrections = useRef(0),
    lastCorrection = useRef(""),
    lastCorrectionAt = useRef(0),
    best = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    completed = useRef(false),
    targetRef = useRef(target);
  targetRef.current = target;
  const onEvaluate = useCallback((evaluation: Evaluation, now: number) => {
    lessonStart.current ??= now;
    stepStart.current ??= now;
    best.current = Math.max(best.current, evaluation.score);
    evaluation.mistakes.forEach((m) => mistakes.current.add(m.category));
    const category = evaluation.mistakes[0]?.category || "";
    if (
      category &&
      category !== lastCorrection.current &&
      now - lastCorrectionAt.current > 1200
    ) {
      corrections.current++;
      lastCorrection.current = category;
      lastCorrectionAt.current = now;
    }
    if (evaluation.isCorrect) lastCorrection.current = "";
  }, []);
  const onComplete = useCallback(
    (evaluation: Evaluation) => {
      if (evaluation.gestureId === "dev-dual") return;
      const now = performance.now();
      const attempt: Attempt = {
        id: crypto.randomUUID(),
        userId: "demo",
        lessonId: "handshape-basics",
        gestureId: evaluation.gestureId,
        score: evaluation.score,
        success: true,
        durationMs: Math.min(
          86400000,
          Math.round(now - (stepStart.current ?? now)),
        ),
        mistakes: [...mistakes.current],
        corrections: corrections.current,
        createdAt: new Date().toISOString(),
        practiceDate: localDay(),
      };
      attempts.current.push(attempt);
      saveAttempt(attempt);
      completed.current = true;
      playSuccess();
      let resultId: string | null = null;
      if (step === targets.length - 1) {
        const result: LessonResult = {
          id: crypto.randomUUID(),
          userId: "demo",
          lessonId: "handshape-basics",
          attempts: [...attempts.current],
          durationMs: Math.min(
            86400000,
            Math.round(now - (lessonStart.current ?? now)),
          ),
          createdAt: new Date().toISOString(),
          practiceDate: localDay(),
          sessionKind: isPractice ? "practice" : "lesson",
          nodeId: node?.id || (isPractice ? undefined : "warm-up"),
        };
        saveResult(result);
        resultId = result.id;
      }
      timer.current = setTimeout(() => {
        if (resultId) navigate(`/results/${resultId}`, { replace: true });
        else {
          mistakes.current.clear();
          corrections.current = 0;
          stepStart.current = null;
          best.current = 0;
          lastCorrection.current = "";
          completed.current = false;
          setStep((s) => s + 1);
        }
      }, 1050);
    },
    [isPractice, navigate, node?.id, step, targets.length],
  );
  const coach = useCoach(target, onComplete, onEvaluate);
  useEffect(() => {
    retainSuccessAudio();
    const observedMistakes = mistakes.current;
    return () => {
      clearTimeout(timer.current);
      releaseSuccessAudio();
      if (stepStart.current !== null && !completed.current)
        saveAttempt({
          id: crypto.randomUUID(),
          userId: "demo",
          lessonId: "handshape-basics",
          gestureId: targetRef.current.id,
          score: best.current,
          success: false,
          durationMs: Math.min(
            86400000,
            Math.round(performance.now() - stepStart.current),
          ),
          mistakes: [...observedMistakes],
          corrections: corrections.current,
          createdAt: new Date().toISOString(),
          practiceDate: localDay(),
        });
    };
  }, []);
  const { state } = coach;
  const primaryMistake = state.primaryMistake;
  const feedbackMessage = correctionText(
    locale,
    primaryMistake,
    state.feedback,
  );
  const positioning =
    primaryMistake &&
    ["position", "scale", "orientation"].includes(primaryMistake.category);
  const feedbackTitle = state.completed
    ? "Great!"
    : state.tracking.kind === "tracking"
      ? "Keep your hand in view"
      : positioning
        ? "Find your frame"
        : !state.ready
          ? "Getting ready"
          : !state.evaluation
            ? "Ready when you are"
            : state.evaluation.isCorrect
              ? "Great position!"
              : positioning
                ? "Find your frame"
                : scoreLabel(state.score, false);
  return (
    <main className="exercise-page" id="main">
      <div className="exercise-top">
        <Link
          className="icon-button exit-exercise"
          to={isPractice && !node ? "/practice" : "/learn"}
          aria-label={t("Exit exercise")}
        >
          <X size={25} />
        </Link>
        <Meter
          value={((step + (state.completed ? 1 : 0)) / targets.length) * 100}
          label={t("Lesson progress")}
        />
        <LanguageSwitcher />
        <span className="exercise-count">
          {step + 1} / {targets.length}
        </span>
        <button
          className="icon-button"
          onClick={() => setSound(toggleSound())}
          aria-label={
            sound ? t("Mute success sounds") : t("Enable success sounds")
          }
        >
          {sound ? <Volume2 size={22} /> : <VolumeX size={22} />}
        </button>
      </div>
      <div className="exercise-heading">
        <p className="eyebrow">
          {isPractice ? t("PRACTICE") : t("HANDSHAPE BASICS")} ·{" "}
          {text(title).toUpperCase()}
        </p>
        <h1>
          {target.id === "palm"
            ? t("Make an open palm.")
            : target.id === "fist"
              ? t("Make a closed fist.")
              : t("Make a V handshape.")}
        </h1>
        <p>
          {t(
            "Keep your whole hand in view. Small adjustments are all it takes.",
          )}
        </p>
      </div>
      <div className="exercise-layout">
        <div className="mobile-target">
          <HandIllustration gesture={target.id} />
          <div>
            <strong>{text(target.label)}</strong>
            <p>{text(target.shortInstruction)}</p>
          </div>
        </div>
        <div className="exercise-camera">
          <CameraStage
            onHand={coach.onHand}
            setup={state}
            feedback={
              <div className="mobile-coaching">
                <div className="mobile-score">
                  <strong>{text(feedbackTitle)}</strong>
                  <span>
                    {state.evaluation
                      ? t("{0}% match", { 0: state.score })
                      : t("Camera setup")}
                  </span>
                </div>
                <p role="status">{feedbackMessage}</p>
                <Meter
                  value={state.hold * 100}
                  label={t("Camera hold progress")}
                />
                <small>
                  {state.ready
                    ? t("Hold for 0.8 seconds to continue.")
                    : t("Practice starts automatically when you’re ready.")}
                </small>
              </div>
            }
            autoStart={autoStart}
            completed={state.completed}
            celebration={
              state.completed && (
                <div className="gesture-celebration" aria-live="polite">
                  <span className="celebration-check">
                    <Check size={35} strokeWidth={3} />
                  </span>
                  <div>
                    <strong>{t("Great!")}</strong>
                    <span>{t("{0} completed", { 0: text(target.label) })}</span>
                  </div>
                  <span className="xp-pop">
                    <Zap size={19} fill="currentColor" />+{rewards.exercise}{" "}
                    {t("XP")}
                  </span>
                </div>
              )
            }
          />
          <div className="exercise-reassurance">
            <span>
              <Check size={17} />
              {t("Either hand works")}
            </span>
            <span>
              <Zap size={17} />
              {t("Every small win counts")}
            </span>
          </div>
        </div>
        <section
          className={`coach-panel exercise-coach ${state.completed ? "coach-success" : ""}`}
          aria-label={t("Gesture coach")}
        >
          <div className="target-heading">
            <span className="eyebrow">{t("TRY THIS SHAPE")}</span>
            <span className="reward-label">
              +{rewards.exercise} {t("XP")}
            </span>
          </div>
          <div className="target-art">
            <HandIllustration gesture={target.id} />
          </div>
          <h2>{text(target.label)}</h2>
          <p className="target-instruction">{text(target.shortInstruction)}</p>
          <p className="target-tip">
            {t("Tip: {0}", { 0: text(target.tips.at(-1)) })}
          </p>
          <div className="score-row">
            <span>{t("Shape match")}</span>
            <strong>
              {state.evaluation ? state.score : "—"}
              <small>{state.evaluation ? "%" : ""}</small>
            </strong>
          </div>
          <Meter value={state.score} label={t("Shape accuracy")} />
          <div
            className={`feedback-box ${state.completed ? "is-success" : state.evaluation?.isCorrect ? "is-holding" : ""}`}
          >
            <span className="feedback-symbol">
              {state.completed ? (
                <CircleCheck size={24} />
              ) : state.evaluation?.isCorrect ? (
                <Check size={24} />
              ) : positioning ? (
                <ScanLine size={24} />
              ) : (
                <Lightbulb size={24} />
              )}
            </span>
            <div>
              <strong>{text(feedbackTitle)}</strong>
              <p role="status" aria-live="polite">
                {feedbackMessage}
              </p>
            </div>
          </div>
          <div className="hold-label">
            <span>
              {state.completed ? t("On to the next win…") : t("Hold it…")}
            </span>
            <span>{Math.round(state.hold * 100)}%</span>
          </div>
          <Meter
            value={state.hold * 100}
            label={t("Hold progress")}
            className="hold-meter"
          />
          <p className="auto-note">
            {t("Hold for 0.8 seconds. We’ll move you forward.")}
          </p>
        </section>
      </div>
      {import.meta.env.DEV &&
        new URLSearchParams(location.search).has("diagnostics") && (
          <details className="dev-diagnostics">
            <summary>{t("Camera diagnostics")}</summary>
            <dl>
              <dt>{t("Tracking FPS")}</dt>
              <dd>{state.fps}</dd>
              <dt>{t("Hand")}</dt>
              <dd>{text(state.handedness)}</dd>
              <dt>{t("Frame quality")}</dt>
              <dd>
                {text(state.tracking.kind)} {t("(geometry check)")}
              </dd>
              <dt>{t("Shape match / hold")}</dt>
              <dd>
                {state.score}% / {Math.round(state.hold * 100)}%
              </dd>
              <dt>{t("Correction")}</dt>
              <dd>{text(state.primaryMistake?.category || "None")}</dd>
            </dl>
            <pre>
              {text(
                JSON.stringify(state.evaluation?.featureScores || {}, null, 2),
              )}
            </pre>
          </details>
        )}
      <div className="exercise-bottom">
        <div className="exercise-shape-steps">
          {targets.map((g, i) => (
            <span
              key={g.id}
              className={
                i < step || (i === step && state.completed)
                  ? "done"
                  : i === step
                    ? "current"
                    : ""
              }
            >
              {i < step || (i === step && state.completed) ? (
                <Check size={16} />
              ) : (
                <span>{i + 1}</span>
              )}
              {text(g.label)}
            </span>
          ))}
        </div>
        <span className="earned-xp">
          <Zap size={19} fill="currentColor" />
          {attempts.current.length * rewards.exercise} {t("XP earned")}
        </span>
      </div>
    </main>
  );
}
