import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useI18n } from "../i18n";
import {
  ArrowRight,
  Camera,
  Check,
  MoveUpRight,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Layout";
import { HandIllustration } from "../components/HandIllustration";
import { useTitle } from "../components/Common";
export function Landing() {
  const { t } = useI18n();
  useTitle("Learn with your hands");
  return (
    <div className="landing">
      <header className="landing-header">
        <Brand />
        <LanguageSwitcher />
        <nav aria-label={t("Main navigation")}>
          <Link to="/learn">{t("Explore the lesson")}</Link>
          <Link to="/dashboard" className="button button-outline">
            {t("Your learning space")} <ArrowRight size={17} />
          </Link>
        </nav>
      </header>
      <main id="main">
        <section className="landing-hero">
          <div className="hero-copy">
            <p className="eyebrow">
              {t("A SMALL START. A NEW WAY TO CONNECT.")}
            </p>
            <h1>
              {t("Learning begins")}
              <br />
              {t("with your")} <em>{t("hands.")}</em>
            </h1>
            <p>
              {t(
                "A little guidance makes a big difference. Practice foundational handshapes with your webcam and get clear feedback as you go.",
              )}
            </p>
            <Link className="button button-primary" to="/dashboard">
              {t("Start learning")} <ArrowRight size={19} />
            </Link>
            <span className="hero-detail">
              {t("3 handshapes · Your own pace · No sign-up")}
            </span>
          </div>
          <div className="hero-demo">
            <div className="demo-top">
              <span className="eyebrow">{t("A CLOSER LOOK AT PRACTICE")}</span>
              <span>01 / 03</span>
            </div>
            <div className="demo-hand">
              <HandIllustration gesture="palm" />
              <span className="demo-label">
                {t("Open palm")}
                <span>{t("Keep all five fingers extended")}</span>
              </span>
            </div>
            <div className="demo-feedback">
              <span className="check-icon">
                <Check size={21} />
              </span>
              <div>
                <strong>{t("Small adjustments. Real progress.")}</strong>
                <p>{t("See exactly what to change, one finger at a time.")}</p>
              </div>
            </div>
            <div className="demo-caption">
              {t("Illustrated preview · practice with your camera inside")}{" "}
              <MoveUpRight size={15} />
            </div>
          </div>
        </section>
        <section className="how-it-works" aria-labelledby="how-title">
          <div>
            <p className="eyebrow">{t("SIMPLE BY DESIGN")}</p>
            <h2 id="how-title">
              {t("A moment of practice.")}
              <br />
              {t("A step toward connection.")}
            </h2>
          </div>
          <div className="how-step">
            <span>01</span>
            <h3>{t("See the shape")}</h3>
            <p>{t("Follow a clear reference, with simple instructions.")}</p>
          </div>
          <div className="how-step">
            <span>02</span>
            <h3>{t("Give it a try")}</h3>
            <p>
              {t(
                "Use your camera. Get a specific correction when you need it.",
              )}
            </p>
          </div>
          <div className="how-step">
            <span>03</span>
            <h3>{t("Find your flow")}</h3>
            <p>
              {t("Hold the shape, move to the next, and see your progress.")}
            </p>
          </div>
        </section>
        <section className="landing-note">
          <ShieldCheck size={24} />
          <p>
            <strong>{t("Your practice stays personal.")}</strong>{" "}
            {t(
              "Camera processing happens on your device. We save your results, never your video.",
            )}
          </p>
          <Camera size={24} />
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <span>
          {t(
            "A foundation for learning. These training handshapes are not a complete sign language.",
          )}
        </span>
        <Link to="/learn">
          {t("Let’s begin")} <ArrowRight size={16} />
        </Link>
      </footer>
    </div>
  );
}
