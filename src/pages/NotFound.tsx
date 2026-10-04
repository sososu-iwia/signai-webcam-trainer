import { useI18n } from "../i18n";
import { Link } from "react-router-dom";
import { useTitle } from "../components/Common";
export function NotFound() {
  const { t } = useI18n();
  useTitle("Page not found");
  return (
    <div className="page centered-state">
      <p className="eyebrow">{t("LET’S GET YOU BACK ON TRACK")}</p>
      <h1>{t("This page isn’t here.")}</h1>
      <p>{t("Your learning space is just a step away.")}</p>
      <Link to="/dashboard" className="button button-primary">
        {t("Back to overview")}
      </Link>
    </div>
  );
}
