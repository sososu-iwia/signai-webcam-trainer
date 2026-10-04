import { useI18n } from "./i18n";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { Component, lazy, Suspense, useEffect, type ReactNode } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Layout } from "./components/Layout";
import { Landing } from "./pages/Landing";
import { Practice } from "./pages/Practice";
import { Learn } from "./pages/Learn";
import { Trainer } from "./pages/Trainer";
import { Results } from "./pages/Results";
import { Translate } from "./pages/Translate";
import { ProgressPage } from "./pages/Progress";
import { NotFound } from "./pages/NotFound";
import { syncProgress } from "./services/progress";
const DevTools = import.meta.env.DEV
  ? lazy(() => import("./pages/DevTools"))
  : null;
const DualTest = import.meta.env.DEV
  ? lazy(() => import("./pages/DualTest"))
  : null;
function Lifecycle() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  useEffect(() => {
    void syncProgress();
    const sync = () => {
      void syncProgress();
    };
    window.addEventListener("online", sync);
    const timer = setInterval(sync, 30000);
    return () => {
      window.removeEventListener("online", sync);
      clearInterval(timer);
    };
  }, []);
  return null;
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Recovery retry={() => this.setState({ failed: false })} />
    ) : (
      this.props.children
    );
  }
}
function Recovery({ retry }: { retry: () => void }) {
  const { t } = useI18n();
  return (
    <main className="centered-state">
      <LanguageSwitcher />
      <h1>{t("Let’s try that again.")}</h1>
      <p>{t("Your saved progress is still on this device.")}</p>
      <button className="button button-primary" onClick={() => retry()}>
        {t("Retry")}
      </button>
      <button
        className="button button-outline"
        onClick={() => window.location.assign("/learn")}
      >
        {t("Return to your learning space")}
      </button>
    </main>
  );
}
export function App() {
  const { t } = useI18n();
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Lifecycle />
        <Routes>
          <Route path="/" element={<Navigate to="/learn" replace />} />
          {DevTools && (
            <Route
              path="/dev"
              element={
                <Suspense fallback={<p>{t("Loading…")}</p>}>
                  <DevTools />
                </Suspense>
              }
            />
          )}
          {DualTest && (
            <Route
              path="/dev/dual"
              element={
                <Suspense fallback={<p>{t("Loading…")}</p>}>
                  <DualTest />
                </Suspense>
              }
            />
          )}
          <Route path="/about" element={<Landing />} />
          <Route path="/trainer/:lessonId" element={<Trainer />} />
          <Route path="/results/:resultId" element={<Results />} />
          <Route element={<Layout />}>
            <Route
              path="/dashboard"
              element={<Navigate to="/learn" replace />}
            />
            <Route path="/practice" element={<Practice />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/translate" element={<Translate />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
