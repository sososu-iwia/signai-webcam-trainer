import { useI18n } from "../i18n";
import { useEffect, type ReactNode } from "react";
import {
  armSuccessAudio,
  retainSuccessAudio,
  releaseSuccessAudio,
} from "../services/sound";
import {
  Camera,
  CameraOff,
  Hand,
  LoaderCircle,
  ShieldCheck,
  ScanLine,
} from "lucide-react";
import { useCamera } from "../camera/useCamera";
import type { CameraFrame } from "../gesture-engine/types";
export function CameraStage({
  onHand,
  completed = false,
  autoStart = false,
  celebration,
  setup,
  feedback,
  requiredHands = 1,
}: {
  requiredHands?: 1 | 2;
  onHand: (hand: CameraFrame, now: number) => void;
  completed?: boolean;
  autoStart?: boolean;
  celebration?: ReactNode;
  setup?: { ready: boolean; tracking: { kind: string }; feedback: string };
  feedback?: ReactNode;
}) {
  const { t, text } = useI18n();
  const camera = useCamera(onHand);
  useEffect(() => {
    retainSuccessAudio();
    return releaseSuccessAudio;
  }, []);
  const startCamera = camera.start;
  useEffect(() => {
    if (autoStart) startCamera();
  }, [autoStart, startCamera]);
  const active = camera.state === "ready";
  const loading = camera.state === "requesting" || camera.state === "loading";
  const detected =
    requiredHands === 2 ? camera.handCount === 2 : camera.hasHand;
  const label = active
    ? detected
      ? requiredHands === 2
        ? "Both hands detected"
        : "Hand detected"
      : requiredHands === 2
        ? "Show both hands to the camera."
        : "Looking for your hand"
    : camera.state === "requesting"
      ? "Waiting for permission"
      : camera.state === "loading"
        ? "Loading hand tracking"
        : camera.state === "error"
          ? "Camera unavailable"
          : "Camera is off";
  return (
    <section className="camera-panel" aria-label={t("Webcam practice")}>
      <div className="camera-toolbar">
        <span>
          <ScanLine size={17} /> {t("YOUR CAMERA")}
        </span>
        <span className={`camera-status ${active ? "active" : ""}`}>
          <span className="small-dot" />
          {text(label)}
        </span>
      </div>
      <div
        className={`camera-stage ${completed ? "stage-complete" : ""}`}
        style={{
          aspectRatio: Math.max(1, Math.min(16 / 9, camera.aspectRatio)),
        }}
      >
        <div className="video-surface">
          <video
            ref={camera.videoRef}
            autoPlay
            playsInline
            muted
            aria-label={t("Mirrored live camera preview")}
          />
          <canvas ref={camera.canvasRef} aria-hidden="true" />
        </div>
        {active && !camera.hasHand && (
          <div className="hand-guide" aria-hidden="true">
            <Hand size={120} strokeWidth={0.8} />
          </div>
        )}
        {!active && (
          <div className="camera-overlay">
            <div className="camera-empty-icon">
              {loading ? (
                <LoaderCircle size={29} className="spin" />
              ) : camera.error ? (
                <CameraOff size={29} />
              ) : (
                <Camera size={29} />
              )}
            </div>
            <h2>
              {camera.state === "requesting"
                ? t("Allow your camera to begin")
                : camera.state === "loading"
                  ? t("Getting your coach ready")
                  : camera.error
                    ? t("Let’s reconnect your camera")
                    : t("Your practice starts here")}
            </h2>
            <p role={camera.error ? "alert" : "status"}>
              {text(
                camera.error ||
                  (camera.state === "requesting"
                    ? "Choose Allow in your browser’s camera prompt. Your video stays on this device."
                    : camera.state === "loading"
                      ? "Preparing on-device hand tracking. This may take a moment."
                      : "Find a bright spot, leave room for your hand, and turn on your camera."),
              )}
            </p>
            {!loading && (
              <button
                className="button button-light"
                onClick={() => {
                  armSuccessAudio();
                  camera.start();
                }}
              >
                <Camera size={18} />
                {camera.error ? t("Try camera again") : t("Start camera")}
              </button>
            )}
            {loading && (
              <button
                className="button button-ghost-light"
                onClick={camera.stop}
              >
                {t("Cancel")}
              </button>
            )}
          </div>
        )}
        {active && (
          <div className="camera-bottom-hint">
            {completed
              ? t("Great. Gesture completed.")
              : requiredHands === 2
                ? camera.handCount
                  ? t("Keep both hands inside the frame.")
                  : t("Show both hands to the camera.")
                : camera.hasHand
                  ? t("Keep your whole hand in the frame")
                  : t("Show one hand to the camera")}
          </div>
        )}
        {active && setup && !setup.ready && (
          <div className="camera-preflight" aria-label={t("Camera setup")}>
            <strong>{t("Let’s find your frame")}</strong>
            <ol>
              <li className="checked">{t("Camera ready")}</li>
              <li className={detected ? "checked" : ""}>
                {requiredHands === 2
                  ? t("Both hands detected")
                  : t("Hand detected")}
              </li>
              <li className={setup.tracking.kind === "ready" ? "checked" : ""}>
                {requiredHands === 2
                  ? t("Both hands in position")
                  : t("Hand in position")}
              </li>
            </ol>
            <p>{t("Practice starts automatically when your hand is ready.")}</p>
          </div>
        )}
        {celebration}
        <span className="frame-corner tl" />
        <span className="frame-corner tr" />
        <span className="frame-corner bl" />
        <span className="frame-corner br" />
      </div>
      {feedback}
      <div className="camera-footer">
        <span>
          <ShieldCheck size={16} />
          {t("Private, on-device processing")}
        </span>
        {active ? (
          <button className="text-button" onClick={camera.stop}>
            <CameraOff size={16} />
            {t("Stop camera")}
          </button>
        ) : (
          <span>
            {requiredHands === 2
              ? t("Both hands required")
              : t("Either hand works")}
          </span>
        )}
      </div>
    </section>
  );
}
