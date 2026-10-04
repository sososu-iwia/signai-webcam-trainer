import { CourseMastery } from "../components/CourseMastery";
import { useI18n } from "../i18n";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Award,
  Flame,
  RefreshCw,
  Trophy,
  Zap,
  Check,
  Target,
} from "lucide-react";
import {
  learningStats,
  rewards,
  uniqueResults,
  resultXP,
  learningPath,
} from "../../shared/learning";
import { findCourseNode } from "../../shared/course";
import { summarize } from "../../shared/schema";
import {
  AttemptList,
  Meter,
  PageHeading,
  useTitle,
} from "../components/Common";
import { HandIllustration } from "../components/HandIllustration";
import { useProgress } from "../hooks/useProgress";
import { armSuccessAudio } from "../services/sound";
import { syncProgress } from "../services/progress";
export function ProgressPage() {
  const { t, text, locale, plural } = useI18n();
  useTitle("Your progress");
  const { progress, status } = useProgress();
  const stats = learningStats(progress);
  const summary = summarize(progress);
  return (
    <div className="page growth-page">
      <PageHeading
        eyebrow={t("LOOK HOW FAR YOU’VE COME")}
        title={
          stats.totalXP
            ? t("Small wins add up.")
            : t("Your learning journey starts here.")
        }
        description={
          stats.totalXP
            ? t(
                "Every shape, every adjustment, every little breakthrough. It all counts.",
              )
            : t("Your first shape is the start of something good.")
        }
      >
        <Link className="button button-primary" to="/learn">
          {stats.totalXP ? t("Keep learning") : t("Start learning")}
          <ArrowRight size={18} />
        </Link>
      </PageHeading>
      {(status === "offline" || status === "memory") && (
        <div className="sync-banner" role="status">
          <span>
            {status === "offline"
              ? t("Progress is saved here. We’ll sync when you’re connected.")
              : t(
                  "Browser storage is unavailable. Progress is kept for this session.",
                )}
          </span>
          <button className="text-button" onClick={() => void syncProgress()}>
            <RefreshCw size={16} />
            {t("Retry sync")}
          </button>
        </div>
      )}
      <section className="level-hero">
        <div className="level-medal">
          <Award size={41} />
          <strong>{stats.level.level}</strong>
        </div>
        <div className="level-copy">
          <p className="eyebrow">{t("YOUR NEXT CHAPTER")}</p>
          <h2>
            {t("Level")} {stats.level.level} ·{" "}
            {stats.level.level === 1
              ? t("Finding your feet")
              : stats.level.level < 4
                ? t("Building confidence")
                : t("Making it second nature")}
          </h2>
          <p>
            {stats.level.next - stats.totalXP}{" "}
            {t("XP until your next level. One shape at a time.")}
          </p>
          <Meter value={stats.level.progress} label={t("Level progress")} />
          <span>
            {stats.totalXP} / {stats.level.next} {t("XP")}{" "}
          </span>
        </div>
      </section>
      <div className="growth-highlights">
        <div>
          <Zap className="gold-text" size={24} fill="currentColor" />
          <strong>{stats.totalXP}</strong>
          <span>{t("Total XP")}</span>
        </div>
        <div>
          <Flame className="coral-text" size={24} fill="currentColor" />
          <strong>{stats.streak}</strong>
          <span>{t("Day streak")}</span>
        </div>
        <div>
          <Trophy className="blue-text" size={24} />
          <strong>{stats.lessons}</strong>
          <span>{t("Lessons completed")}</span>
        </div>
        <div>
          <Target className="teal-text" size={24} />
          <strong>{summary.attempts ? `${summary.average}%` : "—"}</strong>
          <span>{t("Overall accuracy")}</span>
        </div>
      </div>
      <CourseMastery />
      <section className="mastery-section">
        <div className="section-heading">
          <div>
            <h2>{t("Your hands are learning.")}</h2>
            <p>
              {stats.mastery.filter((m) => m.successes > 0).length}{" "}
              {t("of 3 shapes practiced. There’s no rush to mastery.")}
            </p>
          </div>
          <span className="mastery-key">
            <Check size={16} />
            {t("Progress, at your pace")}
          </span>
        </div>
        <div className="mastery-list">
          {stats.mastery.map((m) => (
            <article className="mastery-item" key={m.gestureId}>
              <HandIllustration gesture={m.gestureId} />
              <div>
                <h3>{text(m.label)}</h3>
                <span className={`mastery-state ${m.state.toLowerCase()}`}>
                  {text(m.state)}
                </span>
              </div>
              <div className="mastery-measure">
                <div>
                  <span>
                    {m.count
                      ? plural("attempt", m.count)
                      : t("Your next first try")}
                  </span>
                  <strong>{m.count ? `${m.average}%` : "—"}</strong>
                </div>
                <Meter
                  value={m.average}
                  label={t("{0} average accuracy", { 0: text(m.label) })}
                />
              </div>
              <Link
                to={`/trainer/handshape-basics?practice=${m.gestureId}`}
                state={{ autoStart: true }}
                className="icon-button"
                aria-label={t("Practice {0}", { 0: text(m.label) })}
                onClick={armSuccessAudio}
              >
                <ArrowRight size={21} />
              </Link>
            </article>
          ))}
        </div>
        <details className="mastery-explainer">
          <summary>{t("How does mastery work?")}</summary>
          <p>
            {t(
              "Learning starts with your first attempt. Good means at least 2 successful attempts and 80% average accuracy. Mastered means at least 5 successes and 90% average accuracy.",
            )}
          </p>
        </details>
      </section>
      <section className="growth-history">
        <div className="section-heading">
          <div>
            <h2>{t("Your recent small wins")}</h2>
            <p>
              {plural("session", stats.sessions)} ·{" "}
              {plural("attempt", summary.attempts)}
            </p>
          </div>
        </div>
        {progress.results.length > 0 && (
          <div className="session-history" aria-label={t("Recent sessions")}>
            {uniqueResults(progress.results)
              .reverse()
              .slice(0, 5)
              .map((result) => (
                <Link
                  key={result.id}
                  to={`/results/${result.id}`}
                  className="session-row"
                >
                  <span>
                    <strong>
                      {text(
                        findCourseNode(result.courseNodeId)?.titleKey ||
                          learningPath.find((n) => n.id === result.nodeId)
                            ?.title ||
                          (result.sessionKind === "practice"
                            ? "Quick Practice"
                            : "Warm Up"),
                      )}
                    </strong>
                    <small>
                      {text(
                        new Date(result.createdAt).toLocaleDateString(locale, {
                          month: "short",
                          day: "numeric",
                        }),
                      )}{" "}
                      · {plural("shape", result.attempts.length)}
                    </small>
                  </span>
                  <strong>
                    +{resultXP(result)} {t("XP")} <ArrowRight size={17} />
                  </strong>
                </Link>
              ))}
          </div>
        )}
        {progress.attempts.length ? (
          <details className="mastery-explainer">
            <summary>{t("Review recent practice attempts")}</summary>
            <AttemptList attempts={progress.attempts.slice(0, 12)} />
          </details>
        ) : (
          <div className="history-empty">
            <Trophy size={34} />
            <h3>{t("Your first win is waiting.")}</h3>
            <p>
              {t("Complete a lesson to earn your first")}{" "}
              {rewards.exercise * 3 + rewards.lessonBonus} {t("XP.")}
            </p>
            <Link className="text-link" to="/learn">
              {t("Let’s get started")} <ArrowRight size={17} />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
