import { setLanguage, useI18n } from "../i18n";
export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  return (
    <div className="language-switcher" role="group" aria-label={t("Language")}>
      {(["en", "ru"] as const).map((language) => (
        <button
          key={language}
          type="button"
          lang={language}
          aria-label={language === "en" ? "English" : "Русский"}
          aria-pressed={locale === language}
          onClick={() => setLanguage(language)}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
