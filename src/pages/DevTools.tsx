import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useI18n } from "../i18n";
import { useState } from "react";
import { Link } from "react-router-dom";
import { resetDemoProgress } from "../services/progress";
export default function DevTools() {
  const { t, text } = useI18n();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <main className="centered-state dev-tools">
      <LanguageSwitcher />
      <p className="eyebrow">{t("DEVELOPMENT ONLY")}</p>
      <h1>{t("Rehearse a fresh start")}</h1>
      <p>
        {t(
          "Reset this browser’s progress and the development API’s demo learner: attempts, sessions, XP, streaks, unlocks and pending sync.",
        )}
      </p>
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />{" "}
        {t("I want to erase demo progress.")}
      </label>
      <button
        className="button button-primary"
        disabled={!confirmed || busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            await resetDemoProgress();
            setMessage("Demo reset. You can start from Warm Up.");
            setConfirmed(false);
          } catch {
            setMessage(
              "Could not reach the development reset endpoint. Start npm run dev and retry. Progress was kept.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? t("Resetting…") : t("Reset demo progress")}
      </button>
      <p role="status">{text(message)}</p>
      <Link className="text-link" to="/dev/dual">
        {t("Open two-hand test")}
      </Link>
      <Link className="text-link" to="/learn">
        {t("Back to learning")}
      </Link>
      <Link className="text-link" to="/trainer/handshape-basics?diagnostics=1">
        {t("Open camera diagnostics")}
      </Link>
    </main>
  );
}
