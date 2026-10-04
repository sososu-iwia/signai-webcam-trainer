import { lazy, Suspense } from "react";
const CourseResult = lazy(() =>
  import("./CourseResult").then((module) => ({ default: module.CourseResult })),
);
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useI18n } from "../i18n";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  RotateCcw,
  Trophy,
  Zap,
  Target,
  Hand,
  Lightbulb,
  Award,
} from "lucide-react";
import { getGesture } from "../../shared/catalog";
import {
  learningStats,
  learningPath,
  resultXP,
  rewards,
} from "../../shared/learning";
import { duration, Meter, useTitle } from "../components/Common";
import { Brand } from "../components/Layout";
import { HandIllustration } from "../components/HandIllustration";
import { useProgress } from "../hooks/useProgress";
import { armSuccessAudio } from "../services/sound";
export function Results() {
  const { t, text, locale } = useI18n();
  useTitle("Session complete");
  const { resultId } = useParams();
  const { progress, status } = useProgress();
  const result = progress.results.find((r) => r.id === resultId);
  if (!result)
    return (
      <main className="page centered-state">
        <LanguageSwitcher />
        <h1>
          {status === "syncing"
            ? t("Loading your win…")
            : t("Let’s find your progress.")}
        </h1>
        <p>{t("Your saved practice is on the progress page.")}</p>
        <Link to="/progress" className="button button-primary">
          {t("View progress")} <ArrowRight size={17} />
        </Link>
      </main>
    );
  if (
    result.courseNodeId ||
    result.attempts.some((a) => a.exerciseId?.startsWith("practice:kz-"))
  )
    return (
      <Suspense fallback={<p>{t("Loading…")}</p>}>
        <CourseResult result={result} />
      </Suspense>
    );
  const stats = learningStats(progress),
    count = result.attempts.length,
    avg = Math.round(result.attempts.reduce((s, a) => s + a.score, 0) / count),
    xp = resultXP(result);
  const isPractice = result.sessionKind === "practice";
  const node = learningPath.find((n) => n.id === result.nodeId);
  const repeat = node
    ? `/trainer/handshape-basics?node=${node.id}`
    : isPractice
      ? `/trainer/handshape-basics?practice=${count === 1 ? result.attempts[0].gestureId : "all"}`
      : "/trainer/handshape-basics";
  return (
    <main className="completion-page" id="main">
      <header className="completion-header">
        <Brand />
        <LanguageSwitcher />
        <span>
          {text(duration(result.durationMs, locale))} {t("well spent")}
        </span>
      </header>
      <div className="completion-content">
        <div className="trophy-scene" aria-hidden="true">
          <span className="confetti c1" />
          <span className="confetti c2" />
          <span className="confetti c3" />
          <span className="confetti c4" />
          <div className="trophy-plinth">
            <Trophy size={57} strokeWidth={1.7} />
          </div>
        </div>
        <p className="eyebrow">
          {text(node?.title || (isPractice ? "Quick Practice" : "Warm Up"))} ·{" "}
          {isPractice
            ? t("PRACTICE COMPLETE")
            : result.nodeId === "checkpoint"
              ? t("UNIT COMPLETE")
              : t("LESSON COMPLETE")}
        </p>
        <h1>{t("Great work!")}</h1>
        <p className="completion-subtitle">
          {result.nodeId === "checkpoint"
            ? t(
                "Your first unit is in the books. That’s something to be proud of.",
              )
            : t("A little more practice. A little more confidence.")}
        </p>
        <div className="xp-earned" aria-label={t("{0} XP earned", { 0: xp })}>
          <Zap size={30} fill="currentColor" />
          <strong>+{xp}</strong>
          <span>{t("XP")}</span>
        </div>
        <p className="xp-breakdown">
          {t("{0} exercise XP + {1} finish bonus", {
            0: count * rewards.exercise,
            1: isPractice ? rewards.practiceBonus : rewards.lessonBonus,
          })}
        </p>
        <div className="completion-stats">
          <div>
            <Target size={20} />
            <strong>{avg}%</strong>
            <span>{t("Accuracy")}</span>
          </div>
          <div>
            <Hand size={20} />
            <strong>
              {count} / {count}
            </strong>
            <span>{t("Shapes completed")}</span>
          </div>
          <div>
            <Lightbulb size={20} />
            <strong>
              {result.attempts.reduce((s, a) => s + a.corrections, 0)}
            </strong>
            <span>{t("Corrections")}</span>
          </div>
          <div>
            <Award size={20} />
            <strong>
              {Math.round(Math.max(...result.attempts.map((a) => a.score)))}%
            </strong>
            <span>{t("Best score")}</span>
          </div>
        </div>
        <div className="completion-performance">
          {result.attempts.map((a) => (
            <div key={a.id}>
              <HandIllustration gesture={a.gestureId} />
              <strong>{text(getGesture(a.gestureId).label)}</strong>
              <span>
                <Check size={16} />
                {Math.round(a.score)}%
              </span>
            </div>
          ))}
        </div>
        <div className="completion-goal">
          <div>
            <span>
              <Zap size={17} />
              {stats.todayXP >= rewards.dailyGoal
                ? t("Daily goal complete!")
                : t("Daily goal in progress")}
            </span>
            <strong>
              {stats.todayXP} / {rewards.dailyGoal} {t("XP")}
            </strong>
          </div>
          <Meter
            value={(stats.todayXP / rewards.dailyGoal) * 100}
            label={t("Daily XP goal")}
          />
        </div>
        {node && (
          <p className="unlock-message">
            <Check size={18} />
            {stats.currentNode
              ? t("{0} complete. {1} is ready for you.", {
                  0: text(node.title),
                  1: text(stats.currentNode.title),
                })
              : t("All six sessions complete. Your first unit is yours.")}
          </p>
        )}
        <p className="save-note" role="status">
          {status === "offline"
            ? t("Saved on this device. We’ll sync when you reconnect.")
            : status === "memory"
              ? t("Saved for this session. Browser storage is unavailable.")
              : status === "syncing"
                ? t("Saved here. Syncing your progress…")
                : t("Progress saved. Every little win counts.")}
        </p>
        <div className="completion-actions">
          <Link
            className="button button-primary"
            to="/learn"
            state={{ justCompleted: result.nodeId }}
          >
            {t("CONTINUE")} <ArrowRight size={19} />
          </Link>
          <Link
            className="button button-outline"
            to={repeat}
            state={{ autoStart: true }}
            onClick={armSuccessAudio}
          >
            <RotateCcw size={18} />
            {t("PRACTICE AGAIN")}
          </Link>
        </div>
      </div>
    </main>
  );
}
