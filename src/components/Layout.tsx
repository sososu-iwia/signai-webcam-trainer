import { LanguageSwitcher } from "./LanguageSwitcher";
import { useI18n } from "../i18n";
import { NavLink, Outlet, Link } from "react-router-dom";
import {
  BookOpen,
  ChartNoAxesCombined,
  Hand,
  MessageSquare,
  ShieldCheck,
  Dumbbell,
  Flame,
  Zap,
  Award,
  ArrowRight,
} from "lucide-react";
import { useProgress } from "../hooks/useProgress";
import { learningStats, localDay, rewards } from "../../shared/learning";
import { Meter } from "./Common";
export function Brand() {
  const { t } = useI18n();
  return (
    <Link className="brand" to="/learn" aria-label={t("SignAI home")}>
      <span className="brand-icon">
        <Hand size={25} strokeWidth={2} />
      </span>
      {t("Sign")}
      <span className="brand-ai">{t("AI")}</span>
      <span className="brand-dot">.</span>
    </Link>
  );
}
const links = [
  { path: "/learn", label: "Learn", icon: BookOpen },
  { path: "/practice", label: "Practice", icon: Dumbbell },
  { path: "/translate", label: "Translate", icon: MessageSquare },
  { path: "/progress", label: "Progress", icon: ChartNoAxesCombined },
];
export function ProgressStrip() {
  const { t, plural } = useI18n();
  const { progress } = useProgress();
  const stats = learningStats(progress);
  return (
    <div className="progress-strip" aria-label={t("Learning rewards")}>
      <span
        className="streak-count"
        title={`${t("Day streak")}: ${plural("day", stats.streak)}`}
      >
        <Flame size={22} fill="currentColor" />
        <strong>{stats.streak}</strong>
        <span>{plural("day", stats.streak, false)}</span>
      </span>
      <span className="xp-count">
        <Zap size={21} fill="currentColor" />
        <strong>{stats.totalXP}</strong>
        <span>{t("XP")}</span>
      </span>
      <Link to="/progress" className="level-count">
        <Award size={23} />
        <strong>
          {t("Level")} {stats.level.level}
        </strong>
      </Link>
    </div>
  );
}
export function MotivationRail() {
  const { t, locale, plural } = useI18n();
  const { progress } = useProgress();
  const stats = learningStats(progress);
  return (
    <aside className="motivation-rail" aria-label={t("Your motivation")}>
      <section className="motivation-card goal-card">
        <div className="widget-heading">
          <span className="widget-icon gold">
            <Zap size={22} fill="currentColor" />
          </span>
          <h2>{t("Your daily goal")}</h2>
        </div>
        <div className="goal-amount">
          <strong>{stats.todayXP}</strong>
          <span>
            / {rewards.dailyGoal} {t("XP")}
          </span>
        </div>
        <Meter
          value={(stats.todayXP / rewards.dailyGoal) * 100}
          label={t("Daily XP goal")}
        />
        <p>
          {stats.todayXP >= rewards.dailyGoal
            ? t("Goal reached! Look at you go.")
            : stats.todayXP
              ? t("You’re getting there. Keep it going!")
              : t("One little lesson. One big win.")}
        </p>
      </section>
      <section className="motivation-card streak-card">
        <div className="widget-heading">
          <span className="widget-icon coral">
            <Flame size={23} fill="currentColor" />
          </span>
          <h2>{t("Build your streak")}</h2>
        </div>
        <p className="streak-number">
          <strong>{stats.streak}</strong> {plural("day", stats.streak, false)}
        </p>
        <p>
          {stats.practicedToday
            ? t("Today is in the books. See you tomorrow?")
            : stats.streak
              ? t("A session today keeps your streak going.")
              : t("Finish a session today to light your first flame.")}
        </p>
        <div className="streak-days" aria-label={t("Practice days this week")}>
          {Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - 6 + i);
            const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            const done = progress.results.some(
              (r) =>
                (r.practiceDate || localDay(new Date(r.createdAt))) === day,
            );
            return (
              <span
                className={done ? "done" : ""}
                key={day}
                title={`${date.toLocaleDateString(locale)}${done ? t(" · practiced") : ""}`}
              >
                <span>
                  {date.toLocaleDateString(locale, { weekday: "narrow" })}
                </span>
                <span>
                  {done ? <Flame size={15} fill="currentColor" /> : "·"}
                </span>
              </span>
            );
          })}
        </div>
      </section>
      <section className="motivation-card unit-widget">
        <div className="widget-heading">
          <span className="widget-icon blue">
            <Hand size={22} />
          </span>
          <h2>{t("One shape at a time")}</h2>
        </div>
        <p>{t("UNIT 1 · HANDSHAPE BASICS")}</p>
        <div className="unit-widget-count">
          <strong>{stats.completedNodes} / 6</strong>
          <span>{t("sessions completed")}</span>
        </div>
        <Meter
          value={(stats.completedNodes / 6) * 100}
          label={t("Unit completion")}
        />
        <Link className="text-link" to="/progress">
          {t("See your growth")} <ArrowRight size={15} />
        </Link>
      </section>
      <p className="rail-note">
        <ShieldCheck size={17} />
        {t("Your camera stays on your device.")}
        <br />
        {t("Your progress comes with you.")}
      </p>
    </aside>
  );
}
export function Layout() {
  const { t, text } = useI18n();
  const { status } = useProgress();
  return (
    <div className="app-layout">
      <a href="#main" className="skip-link">
        {t("Skip to content")}
      </a>
      <aside className="sidebar">
        <Brand />
        <nav aria-label={t("Main navigation")}>
          {links.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={path}>
              <Icon size={24} strokeWidth={2} />
              <span>{text(label)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="small-hand-mark">
            <Hand size={38} strokeWidth={1.8} />
            <span>
              {t("Small steps.")}
              <br />
              <strong>{t("Real connection.")}</strong>
            </span>
          </div>
          <div className="profile">
            <span className="avatar" aria-hidden="true">
              {t("Your learning journey").slice(0, 1)}
            </span>
            <div>
              <strong>{t("Your learning journey")}</strong>
              <span>
                {status === "offline"
                  ? t("Saved here · sync pending")
                  : status === "memory"
                    ? t("Session only · storage unavailable")
                    : t("Ready when you are")}
              </span>
            </div>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <div className="mobile-brand">
            <Brand />
          </div>
          <span className="header-welcome">
            {t("A little practice goes a long way.")}
          </span>
          <div className="header-tools">
            <ProgressStrip />
            <LanguageSwitcher />
          </div>
        </header>
        <main id="main">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>{t("Your pace. Your progress.")}</span>
          <span>{t("Made for meaningful connection.")}</span>
        </footer>
      </div>
    </div>
  );
}
