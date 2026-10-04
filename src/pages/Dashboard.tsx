import { useI18n } from "../i18n";
import { ArrowRight, BookOpen, Clock3, Hand, Lightbulb } from "lucide-react";
import { Link } from "react-router-dom";
import { gestures } from "../../shared/catalog";
import { summarize } from "../../shared/schema";
import { HandIllustration } from "../components/HandIllustration";
import {
  AttemptList,
  LessonButton,
  Meter,
  PageHeading,
  useTitle,
} from "../components/Common";
import { useProgress } from "../hooks/useProgress";
export function Dashboard() {
  const { t, text } = useI18n();
  useTitle("Overview");
  const { progress } = useProgress();
  const summary = summarize(progress);
  return (
    <div className="page dashboard">
      <PageHeading
        eyebrow={t("YOUR LEARNING SPACE")}
        title={
          summary.lessons
            ? t("Good to have you back.")
            : t("Every connection starts somewhere.")
        }
        description={
          summary.lessons
            ? t("Keep building confidence, one handshape at a time.")
            : t("Start small. Take your time. Let your hands do the learning.")
        }
      />
      <div className="dashboard-grid">
        <section className="continue-card">
          <div className="continue-copy">
            <span className="section-kicker">
              <span className="small-dot" />
              {summary.lessons
                ? t("KEEP YOUR MOMENTUM")
                : t("YOUR FIRST LESSON")}
            </span>
            <h2>
              {t("Handshape")}
              <br />
              {t("Basics")}
            </h2>
            <p>
              {t(
                "Get comfortable with three essential training handshapes and a little guidance along the way.",
              )}
            </p>
            <div className="lesson-meta">
              <span>
                <Hand size={16} />
                {t("3 handshapes")}
              </span>
              <span>
                <Clock3 size={16} />
                {t("3–5 minutes")}
              </span>
            </div>
            <LessonButton>
              {summary.lessons ? t("Practice again") : t("Start learning")}
            </LessonButton>
          </div>
          <div className="continue-art">
            <HandIllustration gesture="victory" />
            <span>{t("One shape at a time.")}</span>
          </div>
        </section>
        <section className="today-card">
          <p className="eyebrow">{t("YOUR JOURNEY, SO FAR")}</p>
          <div className="journey-number">
            {summary.learned}
            <span>/ 3</span>
          </div>
          <h3>{t("handshapes practiced")}</h3>
          <Meter
            value={(summary.learned / 3) * 100}
            label={t("Handshapes learned")}
          />
          <div className="journey-stats">
            <div>
              <strong>{summary.attempts ? `${summary.average}%` : "—"}</strong>
              <span>{t("Average accuracy")}</span>
            </div>
            <div>
              <strong>{summary.attempts}</strong>
              <span>{t("Practice attempts")}</span>
            </div>
          </div>
          <Link to="/progress" className="text-link">
            {t("See your progress")}
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <section className="shapes-section">
        <div className="section-heading">
          <div>
            <h2>{t("Meet your first handshapes")}</h2>
            <p>{t("Three different shapes. A foundation to build on.")}</p>
          </div>
          <Link className="text-link" to="/learn">
            {t("View learning path")}
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="shape-grid">
          {gestures.map((g, i) => (
            <Link
              to="/trainer/handshape-basics"
              className="shape-card"
              key={g.id}
            >
              <span className="shape-number">0{i + 1}</span>
              <HandIllustration gesture={g.id} />
              <div>
                <h3>{text(g.label)}</h3>
                <span>
                  {i === 0
                    ? t("Fold & relax")
                    : i === 1
                      ? t("Open & extend")
                      : t("Separate & hold")}
                </span>
              </div>
              <ArrowRight size={18} />
            </Link>
          ))}
        </div>
      </section>
      <div className="dashboard-bottom">
        <section className="recent-section">
          <div className="section-heading">
            <h2>{t("Recent practice")}</h2>
            {progress.attempts.length > 0 && (
              <Link to="/progress" className="text-link">
                {t("View all")}
                <ArrowRight size={15} />
              </Link>
            )}
          </div>
          {progress.attempts.length ? (
            <AttemptList attempts={progress.attempts.slice(0, 3)} />
          ) : (
            <div className="empty-practice">
              <BookOpen size={26} />
              <div>
                <h3>{t("Your story starts with a first try.")}</h3>
                <p>
                  {t("Finish a handshape and your practice will appear here.")}
                </p>
              </div>
            </div>
          )}
        </section>
        <aside className="practice-tip">
          <Lightbulb size={23} />
          <div>
            <p className="eyebrow">{t("A LITTLE PRACTICE TIP")}</p>
            <h3>{t("Make room for your hands.")}</h3>
            <p>
              {t(
                "Sit somewhere bright, keep your whole hand in the frame, and use whichever hand feels comfortable.",
              )}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
