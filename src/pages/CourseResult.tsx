import { Link } from "react-router-dom";
import { ArrowRight, RotateCcw, Trophy, Zap } from "lucide-react";
import type { LessonResult } from "../../shared/schema";
import { getGesture } from "../../shared/catalog";
import { findCourseNode } from "../../shared/course";
import { learningStats, resultXP } from "../../shared/learning";
import { useProgress } from "../hooks/useProgress";
import { useI18n } from "../i18n";
import { Brand } from "../components/Layout";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { duration, useTitle } from "../components/Common";
export function CourseResult({ result }: { result: LessonResult }) {
  const { t, text, locale } = useI18n();
  useTitle(t("Course session complete"));
  const { progress, status } = useProgress();
  const node = findCourseNode(result.courseNodeId);
  const stats = learningStats(progress),
    xp = resultXP(result);
  const accuracy = Math.round(
    result.attempts.reduce((sum, a) => sum + a.score, 0) /
      result.attempts.length,
  );
  const repeat = node
    ? `/trainer/${node.unitId}?activity=${node.id}`
    : `/trainer/course-practice?practice=${result.attempts[0].gestureId}`;
  return (
    <main className="completion-page" id="main">
      <header className="completion-header">
        <Brand />
        <LanguageSwitcher />
        <span>
          {duration(result.durationMs, locale)} {t("well spent")}
        </span>
      </header>
      <div className="completion-content">
        <div className="trophy-scene">
          <Trophy size={80} />
        </div>
        <p className="eyebrow">
          {text(node?.titleKey || "Course practice")} · {t("LESSON COMPLETE")}
        </p>
        <h1>{t("Great work!")}</h1>
        <p className="completion-subtitle">
          {t("A little more practice. A little more confidence.")}
        </p>
        <div className="xp-earned" aria-label={t("{0} XP earned", { 0: xp })}>
          <Zap />
          <strong>+{xp}</strong>
          <span>XP</span>
        </div>
        <div className="completion-stats">
          <div>
            <strong>{accuracy}%</strong>
            <span>{t("Accuracy")}</span>
          </div>
          <div>
            <strong>
              {result.attempts.length} / {result.attempts.length}
            </strong>
            <span>{t("Exercises completed")}</span>
          </div>
          <div>
            <strong>{duration(result.durationMs, locale)}</strong>
            <span>{t("Elapsed time")}</span>
          </div>
          <div>
            <strong>{stats.totalXP}</strong>
            <span>{t("Total XP")}</span>
          </div>
        </div>
        <div className="course-result-attempts">
          {result.attempts.map((a) => (
            <div key={a.id}>
              <strong>{getGesture(a.gestureId).letter}</strong>
              <span>
                {text(
                  a.exerciseType === "SIGN_RECOGNITION"
                    ? "Sign Recognition"
                    : "Camera mastery",
                )}
              </span>
              <span>{Math.round(a.score)}%</span>
            </div>
          ))}
        </div>
        {node && (
          <p className="unlock-message">
            {node.exercise.type === "CHECKPOINT"
              ? node.unitId === "precision"
                ? t("More lessons coming soon")
                : t("Next unit unlocked")
              : t("Next activity unlocked")}
          </p>
        )}
        <p className="save-note" role="status">
          {status === "offline"
            ? t("Saved on this device. We’ll sync when you reconnect.")
            : status === "memory"
              ? t("Saved for this session. Browser storage is unavailable.")
              : t("Progress saved. Every little win counts.")}
        </p>
        <div className="completion-actions">
          <Link className="button button-primary" to="/learn#course">
            {t("Return to course")}
            <ArrowRight size={18} />
          </Link>
          <Link className="button button-outline" to={repeat}>
            <RotateCcw size={18} />
            {t("PRACTICE AGAIN")}
          </Link>
        </div>
      </div>
    </main>
  );
}
