import { HandAssociation } from "../gesture-engine/hands";
const association = new HandAssociation();
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
let landmarker: HandLandmarker | null = null;
self.onmessage = async (
  event: MessageEvent<{
    type: "init" | "frame";
    bitmap?: ImageBitmap;
    timestamp?: number;
  }>,
) => {
  if (event.data.type === "init") {
    try {
      const vision = await FilesetResolver.forVisionTasks("/wasm");
      landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/models/hand_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      self.postMessage({ type: "ready" });
    } catch {
      self.postMessage({
        type: "error",
        message:
          "Hand tracking could not load. Check your connection and try again.",
      });
    }
    return;
  }
  const { bitmap, timestamp } = event.data;
  if (!bitmap || !landmarker || timestamp === undefined) {
    bitmap?.close();
    return;
  }
  try {
    const result = landmarker.detectForVideo(bitmap, timestamp);
    self.postMessage({
      type: "result",
      timestamp,
      hands: association.normalize(
        result.landmarks.map((landmarks, index) => ({
          landmarks,
          worldLandmarks: result.worldLandmarks[index],
          handedness: result.handedness[index]?.[0]?.categoryName,
          confidence: result.handedness[index]?.[0]?.score,
          aspectRatio: bitmap.width / bitmap.height,
        })),
        timestamp,
      ),
    });
  } catch {
    self.postMessage({
      type: "error",
      message:
        "Hand tracking was interrupted. Restart your camera to try again.",
    });
  } finally {
    bitmap.close();
  }
};
