import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  Check,
  Eye,
  Lightbulb,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import {
  courseGestureIds,
  getGesture,
  type CourseGestureId,
} from "../../shared/catalog";
import {
  courseProgress,
  exerciseSteps,
  findCourseNode,
  type CourseNode,
  type ExerciseStep,
} from "../../shared/course";
import { attemptXP, localDay } from "../../shared/learning";
import type { Attempt, LessonResult } from "../../shared/schema";
import type { Evaluation, MistakeCategory } from "../gesture-engine/types";
import { useCoach } from "../hooks/useCoach";
import { useProgress } from "../hooks/useProgress";
import { useI18n } from "../i18n";
import { correctionText } from "../i18n/feedback";
import { saveAttempt, saveResult } from "../services/progress";
import {
  playSuccess,
  retainSuccessAudio,
  releaseSuccessAudio,
  soundEnabled,
  toggleSound,
} from "../services/sound";
import { CameraStage } from "../components/CameraStage";
import { GestureReference } from "../components/GestureReference";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Meter, useTitle } from "../components/Common";
import { NotFound } from "./NotFound";
export function ExercisePlayer() {
  const { lessonId } = useParams();
  const [params] = useSearchParams();
  const { progress } = useProgress();
  const { t } = useI18n();
  const practice = params.get("practice");
  const node = findCourseNode(params.get("activity") || undefined);
  const practiceId = courseGestureIds.find((id) => id === practice);
  if (lessonId === "course-practice" && practiceId)
    return <Session key={practiceId} practice={practiceId} />;
  if (!node || node.unitId !== lessonId) return <NotFound />;
  const unit = courseProgress(progress).find((u) => u.id === node.unitId)!;
  const unlocked =
    node.id === unit.demo?.id ||
    unit.nodes.find((n) => n.id === node.id)?.unlocked;
  if (!unit.unlocked || !unlocked)
    return (
      <main className="centered-state">
        <LanguageSwitcher />
        <h1>{t("Session unavailable")}</h1>
        <p>{t("Finish the earlier activity to continue.")}</p>
        <Link to="/learn" className="button button-primary">
          {t("Return to course")}
        </Link>
      </main>
    );
  return <Session key={node.id} node={node} />;
}
function Session({
  node,
  practice,
}: {
  node?: CourseNode;
  practice?: CourseGestureId;
}) {
  const { t, text, locale } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const steps = useMemo<ExerciseStep[]>(
    () =>
      node
        ? exerciseSteps(node.exercise)
        : [
            {
              id: `practice:${practice}`,
              type: "ERROR_COACH",
              gestureId: practice!,
              xp: 10,
              hint: false,
            },
          ],
    [node, practice],
  );
  const [index, setIndex] = useState(0),
    [hint, setHint] = useState(false),
    [answer, setAnswer] = useState<string | null>(null),
    [sound, setSound] = useState(soundEnabled);
  const step = steps[index],
    target = getGesture(step.gestureId),
    quiz = step.type === "SIGN_RECOGNITION";
  useTitle(node ? text(node.titleKey) : t("Course practice"));
  const attempts = useRef<Attempt[]>([]),
    start = useRef(performance.now()),
    stepStart = useRef(performance.now()),
    finished = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mistakes = useRef(new Set<MistakeCategory>()),
    corrections = useRef(0),
    lastCorrection = useRef(""),
    lastScore = useRef<number | null>(null);
  const advance = useCallback(() => {
    if (finished.current) return;
    if (index === steps.length - 1) {
      finished.current = true;
      const result: LessonResult = {
        id: crypto.randomUUID(),
        userId: "demo",
        lessonId: node?.unitId || "handshape-basics",
        courseNodeId: node?.id,
        attempts: [...attempts.current],
        sessionKind: node ? "lesson" : "practice",
        durationMs: Math.min(
          86400000,
          Math.round(performance.now() - start.current),
        ),
        createdAt: new Date().toISOString(),
        practiceDate: localDay(),
      };
      saveResult(result);
      navigate(`/results/${result.id}`, { replace: true });
    } else {
      setIndex((i) => i + 1);
      setAnswer(null);
      setHint(false);
      stepStart.current = performance.now();
      mistakes.current.clear();
      corrections.current = 0;
      lastCorrection.current = "";
      lastScore.current = null;
    }
  }, [index, navigate, node, steps.length]);
  const record = useCallback(
    (score: number, success: boolean) => {
      if (attempts.current.some((a) => a.exerciseId === step.id)) return false;
      const attempt: Attempt = {
        id: crypto.randomUUID(),
        userId: "demo",
        lessonId: node?.unitId || "handshape-basics",
        gestureId: step.gestureId,
        exerciseId: step.id,
        exerciseType: step.type,
        hintUsed: hint,
        score,
        success,
        durationMs: Math.min(
          86400000,
          Math.round(performance.now() - stepStart.current),
        ),
        mistakes: [...mistakes.current],
        corrections: corrections.current,
        createdAt: new Date().toISOString(),
        practiceDate: localDay(),
      };
      attempts.current.push(attempt);
      saveAttempt(attempt);
      if (success) playSuccess();
      return true;
    },
    [hint, node?.unitId, step],
  );
  const onComplete = useCallback(
    (evaluation: Evaluation) => {
      if (record(evaluation.score, true))
        timer.current = setTimeout(advance, 1000);
    },
    [advance, record],
  );
  const onEvaluate = useCallback((evaluation: Evaluation) => {
    lastScore.current = evaluation.score;
    for (const mistake of evaluation.mistakes)
      mistakes.current.add(mistake.category);
    const top = evaluation.mistakes[0];
    const key = top ? `${top.code || top.message}:${top.hand || ""}` : "";
    if (key && key !== lastCorrection.current) corrections.current++;
    lastCorrection.current = key;
  }, []);
  const coach = useCoach(target, onComplete, onEvaluate, undefined, step.id);
  const { state } = coach;
  const feedback = correctionText(locale, state.primaryMistake, state.feedback);
  useEffect(() => {
    retainSuccessAudio();
    return () => {
      clearTimeout(timer.current);
      releaseSuccessAudio();
    };
  }, []);
  const pendingRecord = useRef(record);
  useEffect(() => {
    pendingRecord.current = record;
  }, [record]);
  useEffect(
    () => () => {
      if (!finished.current && lastScore.current !== null)
        pendingRecord.current(lastScore.current, false);
    },
    [],
  );
  const reveal = step.type !== "CAMERA_RECALL" || hint;
  const earned = attempts.current.reduce(
    (sum, attempt) => sum + attemptXP(attempt),
    0,
  );
  const options = useMemo(
    () =>
      step.options?.length
        ? step.options
        : [
            step.gestureId,
            ...courseGestureIds
              .filter((id) => id !== step.gestureId)
              .slice(0, 3),
          ],
    [step],
  );
  return (
    <main
      className={`exercise-page course-exercise ${quiz ? "recognition-exercise" : ""} ${step.type === "ERROR_COACH" ? "error-coach-exercise" : ""}`}
      id="main"
    >
      <div className="exercise-top">
        <Link
          className="icon-button"
          to="/learn"
          aria-label={t("Exit exercise")}
        >
          <X />
        </Link>
        <Meter
          value={(index / steps.length) * 100}
          label={t("Lesson progress")}
        />
        <LanguageSwitcher />
        <span className="exercise-count">
          {index + 1} / {steps.length}
        </span>
        <button
          className="icon-button"
          aria-label={
            sound ? t("Mute success sounds") : t("Enable success sounds")
          }
          onClick={() => setSound(toggleSound())}
        >
          {sound ? <Volume2 /> : <VolumeX />}
        </button>
      </div>
      <div className="exercise-heading">
        <p className="eyebrow">
          {text(node?.exercise.titleKey || "Course practice")} ·{" "}
          {text(
            step.type === "LEARN_COPY"
              ? "Learn & Copy"
              : step.type === "ERROR_COACH"
                ? "Error Coach"
                : step.type === "CAMERA_RECALL"
                  ? "Camera Recall"
                  : "Sign Recognition",
          )}
        </p>
        <h1>
          {quiz
            ? t("Which letter is this?")
            : t("Show {letter}", { letter: target.letter! })}
        </h1>
        <p>
          {text(
            node?.exercise.instructionKey ||
              "Follow one correction at a time. Small adjustments count.",
          )}
        </p>
        {step.sequence && (
          <p className="sequence-count">
            {t("Sequence {current} of {total}", {
              current: step.sequence.index,
              total: step.sequence.total,
            })}
          </p>
        )}
      </div>
      {quiz ? (
        <section className="recognition-card">
          <GestureReference target={target} concealLetter />
          <div
            className="recognition-options"
            role="group"
            aria-label={t("Choose a letter")}
          >
            {options.map((id) => (
              <button
                key={id}
                className={`button button-outline ${answer === id ? "chosen" : ""}`}
                disabled={answer !== null}
                onClick={() => {
                  if (
                    record(
                      id === step.gestureId ? 100 : 0,
                      id === step.gestureId,
                    )
                  )
                    setAnswer(id);
                }}
              >
                {getGesture(id).letter}
              </button>
            ))}
          </div>
          {answer && (
            <div className="recognition-answer" role="status">
              <strong>
                {answer === step.gestureId
                  ? t("Correct!")
                  : t("The answer is {letter}.", { letter: target.letter! })}
              </strong>
              <button className="button button-primary" onClick={advance}>
                {t("Continue")}
                <ArrowRight size={18} />
              </button>
            </div>
          )}
        </section>
      ) : (
        <div className="exercise-layout">
          <div className="exercise-camera">
            <CameraStage
              onHand={coach.onHand}
              autoStart={Boolean(location.state?.autoStart)}
              setup={state}
              completed={state.completed}
              celebration={
                state.completed && (
                  <div className="gesture-celebration">
                    <Check size={30} />
                    <strong>{t("Great!")}</strong>
                    <span>+{step.xp} XP</span>
                  </div>
                )
              }
              feedback={
                <div className="mobile-coaching">
                  <div className="mobile-score">
                    <strong>
                      {state.completed
                        ? t("Great!")
                        : t("Keep going at your own pace.")}
                    </strong>
                    <span>{state.score}%</span>
                  </div>
                  <p role="status">{feedback}</p>
                  <Meter
                    value={state.hold * 100}
                    label={t("Camera hold progress")}
                  />
                </div>
              }
            />
          </div>
          <section
            className="coach-panel exercise-coach course-coach"
            aria-label={t("Gesture coach")}
          >
            <div className="target-heading">
              <span className="eyebrow">{t("Practice target")}</span>
              <span className="reward-label">+{step.xp} XP</span>
            </div>
            <strong className="target-letter">{target.letter}</strong>
            {reveal ? (
              <>
                <GestureReference
                  target={target}
                  compact={step.type === "ERROR_COACH"}
                />
                <p className="target-instruction">
                  {text(target.shortInstruction)}
                </p>
              </>
            ) : (
              <button
                className="button button-outline"
                onClick={() => setHint(true)}
              >
                <Eye size={18} />
                {t("Show hint")}
              </button>
            )}
            {hint && <small>{t("Hint shown")}</small>}
            <div className="score-row">
              <span>{t("Shape match")}</span>
              <strong>{state.score}%</strong>
            </div>
            <Meter value={state.score} label={t("Shape accuracy")} />
            <div
              className={`feedback-box ${state.completed ? "is-success" : ""}`}
            >
              <Lightbulb size={23} />
              <div>
                <strong>
                  {state.completed
                    ? t("Great!")
                    : state.evaluation?.isCorrect
                      ? t("Great position!")
                      : t("Almost there!")}
                </strong>
                <p role="status" aria-live="polite">
                  {feedback}
                </p>
              </div>
            </div>
            <Meter value={state.hold * 100} label={t("Hold progress")} />
            <p>{t("Hold for 0.8 seconds. We’ll move you forward.")}</p>
          </section>
        </div>
      )}
      <div className="exercise-bottom">
        <span>
          {t("Exercise {current} of {total}", {
            current: index + 1,
            total: steps.length,
          })}
        </span>
        <span className="earned-xp">
          <Zap size={19} />
          {t("{0} XP earned", { 0: earned })}
        </span>
      </div>
    </main>
  );
}
