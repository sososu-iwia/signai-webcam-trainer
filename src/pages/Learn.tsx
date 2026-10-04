import { CoursePath } from "../components/CoursePath";
import { useI18n } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  Hand,
  LockKeyhole,
  RotateCcw,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { gestures } from "../../shared/catalog";
import {
  learningStats,
  nodeTrainerUrl,
  rewards,
  type NodeId,
} from "../../shared/learning";
import { useProgress } from "../hooks/useProgress";
import { useTitle } from "../components/Common";
import { HandIllustration } from "../components/HandIllustration";
import { MotivationRail } from "../components/Layout";
import { armSuccessAudio } from "../services/sound";
const offsets = [0, -65, -25, 70, 30, -40];
export function Learn() {
  const { t, text } = useI18n();
  useTitle("Learn");
  const location = useLocation();
  const currentButton = useRef<HTMLButtonElement>(null);
  const { progress } = useProgress();
  const stats = learningStats(progress);
  const [selected, setSelected] = useState<NodeId | null>(null);
  const guide = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (location.state?.justCompleted) {
      currentButton.current?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
      currentButton.current?.focus({ preventScroll: true });
    }
  }, [location.key, location.state?.justCompleted, stats.currentNode?.id]);
  useEffect(() => {
    if (selected)
      document
        .getElementById(`node-card-${selected}`)
        ?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [selected]);

  let height = 40;
  const nodes = stats.path.map((node, i) => {
    const y = height + 55;
    height += selected === node.id ? 420 : 162;
    return { ...node, x: 250 + offsets[i], y };
  });
  const line = nodes
    .map((n, i) =>
      i
        ? `C ${nodes[i - 1].x} ${nodes[i - 1].y + 85} ${n.x} ${n.y - 85} ${n.x} ${n.y}`
        : `M ${n.x} ${n.y}`,
    )
    .join(" ");
  return (
    <div
      className={`page learn-page ${progress.attempts.length ? "" : "fresh-learner"}`}
    >
      <div className="learn-columns">
        <div className="learn-center">
          <div className="learning-intro">
            <p className="eyebrow">{t("YOUR NEXT SMALL WIN")}</p>
            <h1>{t("Let’s put your hands to work.")}</h1>
            <p>
              {t(
                "Learn three handshapes with your camera and get live, specific corrections. Start with Warm Up below.",
              )}
            </p>
          </div>
          <CoursePath />
          <p className="eyebrow">{t("Classic practice path")}</p>
          <section className="unit-header">
            <div>
              <span>{t("UNIT 1 · GETTING STARTED")}</span>
              <h2>{t("Handshape Basics")}</h2>
              <p>{t("Meet three shapes. Learn to make them your own.")}</p>
            </div>
            <button
              className="guide-button"
              aria-label={t("Guide")}
              onClick={() => guide.current?.showModal()}
            >
              <BookOpen size={19} />
              <span>{t("Guide")}</span>
            </button>
          </section>
          <div className="path-intro">
            <span>
              {stats.unitComplete
                ? t("YOUR FIRST UNIT, COMPLETE")
                : t("FOLLOW YOUR PATH")}
            </span>
            <span>
              {stats.completedNodes} {t("of 6 sessions")}
            </span>
          </div>
          <div className="learning-trail" style={{ height }}>
            <svg
              className="trail-line"
              viewBox={`0 0 500 ${height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d={line} />
            </svg>
            {nodes.map((node, i) => {
              const locked = node.state === "locked",
                current = node.state === "current",
                done = node.state === "completed",
                expanded = selected === node.id;
              const xp =
                rewards.exercise * 3 +
                (node.kind === "practice"
                  ? rewards.practiceBonus
                  : rewards.lessonBonus);
              return (
                <div
                  className={`path-stop ${node.state} ${expanded ? "selected" : ""}`}
                  key={node.id}
                  style={{
                    top: node.y - 50,
                    left: `calc(50% + ${offsets[i]}px)`,
                  }}
                >
                  {current && !expanded && (
                    <span className="start-here">
                      {stats.completedNodes ? t("UP NEXT") : t("START HERE")}
                    </span>
                  )}
                  <button
                    className={`lesson-node ${node.kind}`}
                    ref={current ? currentButton : undefined}
                    aria-label={`${text(node.title)} · ${locked ? t("locked") : done ? t("completed, practice again") : t("current lesson")}`}
                    aria-expanded={expanded}
                    aria-controls={`node-card-${node.id}`}
                    onClick={() => setSelected(expanded ? null : node.id)}
                  >
                    {locked ? (
                      <LockKeyhole size={28} />
                    ) : done ? (
                      <Check size={36} strokeWidth={3} />
                    ) : node.gesture ? (
                      <HandIllustration gesture={node.gesture} />
                    ) : node.kind === "checkpoint" ? (
                      <Trophy size={35} />
                    ) : node.kind === "practice" ? (
                      <RotateCcw size={34} />
                    ) : (
                      <Hand size={37} strokeWidth={2.1} />
                    )}
                    {done && (
                      <span className="node-completed-badge" aria-hidden="true">
                        <Check size={13} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                  <strong className="node-label">{text(node.title)}</strong>
                  {node.kind === "checkpoint" && locked && (
                    <span className="checkpoint-caption">
                      {t("YOUR FIRST MILESTONE")}
                    </span>
                  )}
                  {expanded && (
                    <div
                      className="node-popover"
                      style={{ marginLeft: -offsets[i] }}
                      id={`node-card-${node.id}`}
                    >
                      <div className="popover-top">
                        <span>
                          {done
                            ? t("KEEP BUILDING CONFIDENCE")
                            : t("SESSION {0} OF 6", { 0: i + 1 })}
                        </span>
                        <button
                          className="icon-button"
                          aria-label={t("Close lesson details")}
                          onClick={() => setSelected(null)}
                        >
                          <X size={17} />
                        </button>
                      </div>
                      <h3>{text(node.title)}</h3>
                      <p>{text(node.description)}</p>
                      <div className="node-meta">
                        <span>{t("3 exercises · 3–5 min")}</span>
                        <strong>
                          <Zap size={15} fill="currentColor" />+{xp} {t("XP")}
                        </strong>
                      </div>
                      {locked ? (
                        <p className="locked-explanation" role="status">
                          <LockKeyhole size={17} />
                          {t("Complete {0} to unlock this session.", {
                            0: text(nodes[i - 1]?.title),
                          })}
                        </p>
                      ) : (
                        <Link
                          onClick={armSuccessAudio}
                          to={nodeTrainerUrl(node)}
                          state={{ autoStart: true }}
                          className="button button-primary"
                        >
                          {done ? t("PRACTICE AGAIN") : t("START")}
                          <ArrowRight size={18} />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {stats.unitComplete && (
            <div className="unit-finished">
              <Trophy size={29} />
              <div>
                <h3>{t("First unit. Big achievement.")}</h3>
                <p>
                  {t(
                    "You’ve completed all six sessions. Keep your skills fresh with practice.",
                  )}
                </p>
              </div>
              <Link to="/practice" className="button button-primary">
                {t("Keep practicing")}
              </Link>
            </div>
          )}
          <p className="path-lock-note">
            <LockKeyhole size={15} />
            {t("Complete each session to unlock the next.")}
          </p>
          <p className="scope-note">
            {t(
              "These are foundational handshape exercises, not verified sign-language translations.",
            )}
          </p>
        </div>
        <MotivationRail />
      </div>
      <dialog className="unit-guide" ref={guide}>
        <div className="guide-heading">
          <div>
            <p className="eyebrow">{t("YOUR UNIT 1 FIELD GUIDE")}</p>
            <h2>{t("Three shapes. You’ve got this.")}</h2>
          </div>
          <button
            className="icon-button"
            aria-label={t("Close guide")}
            onClick={() => guide.current?.close()}
          >
            <X />
          </button>
        </div>
        <p>
          {t(
            "Every path session practices open palm, closed fist, then V. Each builds familiarity through repetition. A short hold completes an exercise automatically.",
          )}
        </p>
        <div className="guide-shapes">
          {gestures.map((g) => (
            <div key={g.id}>
              <HandIllustration gesture={g.id} />
              <h3>{text(g.label)}</h3>
              <p>{text(g.shortInstruction)}</p>
            </div>
          ))}
        </div>
        <p className="guide-rewards">
          <Zap size={19} />
          {t(
            "Earn {0} XP per shape, plus {1} XP for finishing a lesson. The practice session adds a {2} XP bonus.",
            {
              0: rewards.exercise,
              1: rewards.lessonBonus,
              2: rewards.practiceBonus,
            },
          )}
        </p>
        <button
          className="button button-primary"
          onClick={() => guide.current?.close()}
        >
          {t("Got it. Let’s learn")} <ArrowRight size={18} />
        </button>
      </dialog>
    </div>
  );
}
