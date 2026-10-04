import { useCallback, useEffect, useRef, useState } from "react";
import { frameHands } from "../gesture-engine/hands";
import type { CameraFrame, HandInput } from "../gesture-engine/types";
export type CameraState =
  "idle" | "requesting" | "loading" | "ready" | "error" | "unsupported";
const connections = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];
export function cameraError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError")
    return "Camera access is blocked. Allow camera access in your browser’s site settings, then try again.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return "No camera found. Connect a webcam, then try again.";
  if (name === "NotReadableError" || name === "TrackStartError")
    return "Your camera is busy. Close other apps using it, then try again.";
  return "The camera could not start. Check your camera connection and try again.";
}
export function useCamera(onHand: (hand: CameraFrame, now: number) => void) {
  const videoRef = useRef<HTMLVideoElement>(null),
    canvasRef = useRef<HTMLCanvasElement>(null);
  const callback = useRef(onHand);
  useEffect(() => {
    callback.current = onHand;
  }, [onHand]);
  const [state, setState] = useState<CameraState>("idle");
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [hasHand, setHasHand] = useState(false);
  const [handCount, setHandCount] = useState(0);
  const [aspectRatio, setAspectRatio] = useState(4 / 3);
  const start = useCallback(() => {
    setError("");
    setEnabled(true);
    setGeneration((g) => g + 1);
  }, []);
  const stop = useCallback(() => {
    setEnabled(false);
    setState("idle");
    setHasHand(false);
    setHandCount(0);
    callback.current(null, performance.now());
  }, []);
  useEffect(() => {
    if (!enabled) return;
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      !window.Worker ||
      !window.createImageBitmap
    ) {
      setState("unsupported");
      setError(
        "Camera practice needs a recent browser on HTTPS or localhost. Try the latest Chrome, Edge or Safari.",
      );
      return;
    }
    let disposed = false,
      stream: MediaStream | null = null,
      worker: Worker | null = null,
      raf = 0,
      busy = false,
      lastTime = -1,
      lastFrame = 0;
    let initTimeout: ReturnType<typeof setTimeout> | undefined;
    let frameTimeout: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      cancelAnimationFrame(raf);
      clearTimeout(initTimeout);
      clearTimeout(frameTimeout);
      stream?.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      worker?.terminate();
      const video = videoRef.current;
      if (video) {
        video.onresize = null;
        video.pause();
        video.srcObject = null;
      }
      const canvas = canvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    };
    const fail = (message: string) => {
      if (disposed) return;
      disposed = true;
      cleanup();
      setState("error");
      setError(message);
      setHasHand(false);
      setHandCount(0);
      callback.current(null, performance.now());
    };
    const draw = (frame: CameraFrame) => {
      const canvas = canvasRef.current,
        video = videoRef.current;
      if (!canvas || !video) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const width = video.videoWidth || 640,
        height = video.videoHeight || 480;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const hand of frameHands(frame)) {
        if (
          !hand ||
          !Array.isArray(hand.landmarks) ||
          hand.landmarks.length !== 21 ||
          Array.from(hand.landmarks).some(
            (p) => !p || ![p.x, p.y, p.z].every(Number.isFinite),
          )
        )
          continue;
        ctx.strokeStyle = "#98f0bd";
        ctx.lineWidth = Math.max(2, canvas.width / 260);
        ctx.lineCap = "round";
        for (const [a, b] of connections) {
          const p = hand.landmarks[a],
            q = hand.landmarks[b];
          ctx.beginPath();
          ctx.moveTo(p.x * canvas.width, p.y * canvas.height);
          ctx.lineTo(q.x * canvas.width, q.y * canvas.height);
          ctx.stroke();
        }
        for (const p of hand.landmarks) {
          ctx.beginPath();
          ctx.arc(
            p.x * canvas.width,
            p.y * canvas.height,
            canvas.width / 150,
            0,
            Math.PI * 2,
          );
          ctx.fillStyle = "#f7fff9";
          ctx.fill();
        }
      }
    };
    const tick = async (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      const video = videoRef.current;
      if (
        document.hidden ||
        busy ||
        !video ||
        video.readyState < 2 ||
        video.currentTime === lastTime ||
        now - lastFrame < 42
      )
        return;
      busy = true;
      lastTime = video.currentTime;
      lastFrame = now;
      try {
        const bitmap = await createImageBitmap(video, {
          resizeWidth: 640,
          resizeHeight: Math.round(
            (640 * video.videoHeight) / video.videoWidth,
          ),
        });
        if (disposed || !worker) {
          bitmap.close();
          return;
        }
        frameTimeout = setTimeout(
          () =>
            fail(
              "Hand tracking stopped responding. Restart your camera to continue.",
            ),
          10000,
        );
        worker.postMessage({ type: "frame", bitmap, timestamp: now }, [bitmap]);
      } catch {
        fail(
          "Your browser could not read the camera. Restart the camera or try another browser.",
        );
      }
    };
    const visibility = () => {
      if (document.hidden) {
        draw(null);
        setHasHand(false);
        setHandCount(0);
        callback.current(null, performance.now());
      }
    };
    document.addEventListener("visibilitychange", visibility);
    setState("requesting");
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            frameRate: { ideal: 30, max: 30 },
          },
        });
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.getVideoTracks().forEach((track) => {
          track.onended = () =>
            fail("Your camera was disconnected. Reconnect it and try again.");
        });
        const video = videoRef.current;
        if (!video) {
          cleanup();
          return;
        }
        video.srcObject = stream;
        await video.play();
        if (disposed) return;
        const measure = () => {
          if (!disposed && video.videoHeight)
            setAspectRatio(video.videoWidth / video.videoHeight);
        };
        measure();
        video.onresize = measure;
        setState("loading");
        worker = new Worker("/tracking-worker.js");
        initTimeout = setTimeout(
          () =>
            fail(
              "Hand tracking took too long to load. Try starting the camera again.",
            ),
          45000,
        );
        worker.onerror = () =>
          fail(
            "Hand tracking is unavailable in this browser. Try restarting or using Chrome.",
          );
        worker.onmessage = (
          event: MessageEvent<{
            type: string;
            hand?: HandInput | null;
            hands?: CameraFrame;
            timestamp: number;
            message: string;
          }>,
        ) => {
          if (disposed) return;
          if (event.data.type === "ready") {
            clearTimeout(initTimeout);
            setState("ready");
            raf = requestAnimationFrame(tick);
          } else if (event.data.type === "error") fail(event.data.message);
          else if (event.data.type === "result") {
            clearTimeout(frameTimeout);
            busy = false;
            if (document.hidden) return;
            const hand = event.data.hands ?? event.data.hand ?? null;
            draw(hand);
            setHasHand(frameHands(hand).length > 0);
            setHandCount(frameHands(hand).length);
            callback.current(hand, event.data.timestamp);
          }
        };
        worker.postMessage({ type: "init" });
      } catch (err) {
        fail(cameraError(err));
      }
    })();
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", visibility);
      cleanup();
      callback.current(null, performance.now());
    };
  }, [enabled, generation]);
  return {
    videoRef,
    canvasRef,
    state,
    error,
    hasHand,
    handCount,
    aspectRatio,
    start,
    stop,
  };
}
