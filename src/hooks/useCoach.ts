import { frameHands, SingleHandSelector } from "../gesture-engine/hands";
import { dualTracking, evaluateDual } from "../gesture-engine/dual";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  gestures,
  type GestureDefinition,
  type GestureTarget,
} from "../../shared/catalog";
import { evaluateGesture } from "../gesture-engine/evaluateGesture";
import {
  CorrectionSelector,
  StabilityTracker,
} from "../gesture-engine/stability";
import {
  CameraPreflight,
  trackingQuality,
  type TrackingQuality,
} from "../gesture-engine/trackingQuality";
import type { Evaluation, CameraFrame, Mistake } from "../gesture-engine/types";
export interface CoachState {
  score: number;
  hold: number;
  feedback: string;
  evaluation: Evaluation | null;
  completed: boolean;
  tracking: TrackingQuality;
  ready: boolean;
  primaryMistake: Mistake | null;
  fps: number;
  handedness: string;
}
const initial: CoachState = {
  score: 0,
  hold: 0,
  feedback: "Show your hand to the camera",
  evaluation: null,
  completed: false,
  tracking: trackingQuality(null),
  ready: false,
  primaryMistake: null,
  fps: 0,
  handedness: "Unknown",
};
export function useCoach(
  target: GestureTarget | null,
  onComplete: (evaluation: Evaluation) => void,
  onEvaluate?: (evaluation: Evaluation, now: number) => void,
  catalog: GestureDefinition[] = gestures,
  resetKey?: string,
) {
  const [state, setState] = useState(initial);
  const selector = useRef(new SingleHandSelector());
  const selected = useRef("");
  const stable = useRef(new StabilityTracker()),
    feedback = useRef(new CorrectionSelector()),
    preflight = useRef(new CameraPreflight());
  const complete = useRef(false),
    lastUI = useRef(0),
    lastFrame = useRef(0),
    fps = useRef(0),
    absentSince = useRef<number | null>(null),
    lastRecognized = useRef<string | null>(null);
  const callbacks = useRef({ onComplete, onEvaluate });
  useEffect(() => {
    callbacks.current = { onComplete, onEvaluate };
  }, [onComplete, onEvaluate]);
  useEffect(() => {
    stable.current.reset();
    feedback.current.reset();
    complete.current = false;
    setState((previous) => ({
      ...initial,
      ready: previous.ready,
      tracking: previous.tracking,
    }));
  }, [target, resetKey]);
  const onHand = useCallback(
    (frame: CameraFrame, now: number) => {
      const dual = target?.handMode === "dual";
      const hand = dual
        ? frameHands(frame)[0] || null
        : selector.current.select(
            frame,
            target?.handMode === "single" ? target : null,
            now,
          );
      const identity = dual ? "dual" : hand?.handedness || "";
      if (identity !== selected.current) {
        stable.current.reset();
        preflight.current = new CameraPreflight();
        selected.current = identity;
      }
      if (target && complete.current) return;
      const tracking = dual ? dualTracking(frame) : trackingQuality(hand);
      const ready = preflight.current.update(tracking, now);
      const delta = now - lastFrame.current;
      if (delta > 0 && delta < 1000)
        fps.current += (1000 / delta - fps.current) * 0.15;
      lastFrame.current = now;
      const details = {
        tracking,
        ready,
        fps: Math.round(fps.current),
        handedness: hand?.handedness || "Unknown",
      };
      if (!hand) {
        absentSince.current ??= now;
        if (now - absentSince.current > 500) {
          lastRecognized.current = null;
          complete.current = false;
        }
        stable.current.reset();
        feedback.current.reset();
        if (now - lastUI.current > 100) {
          lastUI.current = now;
          setState({
            ...initial,
            ...details,
            primaryMistake: tracking.mistake,
          });
        }
        return;
      }
      absentSince.current = null;
      if (!ready) {
        stable.current.reset();
        const correction = feedback.current.update(
          tracking.mistake ? [tracking.mistake] : [],
          now,
        );
        if (now - lastUI.current > 100) {
          lastUI.current = now;
          setState({
            ...initial,
            ...details,
            primaryMistake: correction,
            feedback:
              tracking.kind === "ready"
                ? "Hand detected. Keep it still for a moment…"
                : correction?.message || tracking.message,
          });
        }
        return;
      }
      let evaluation: Evaluation | null;
      if (target)
        evaluation =
          target.handMode === "dual"
            ? evaluateDual(frame, target)
            : evaluateGesture(hand, target);
      else {
        const candidates = catalog
          .map((g) => evaluateGesture(hand, g))
          .filter((e): e is Evaluation => e !== null)
          .sort((a, b) => b.score - a.score);
        evaluation = candidates[0] || null;
        if (
          evaluation &&
          candidates[1] &&
          evaluation.score - candidates[1].score < 8
        )
          evaluation = { ...evaluation, isCorrect: false };
        if (evaluation?.gestureId === lastRecognized.current) {
          stable.current.reset();
          if (now - lastUI.current > 120) {
            setState({
              ...details,
              score: evaluation.score,
              hold: 0,
              feedback: "Try a different shape, or lower your hand to repeat.",
              evaluation,
              completed: true,
              primaryMistake: null,
            });
            lastUI.current = now;
          }
          return;
        }
        complete.current = false;
      }
      if (!evaluation) {
        stable.current.reset();
        setState({ ...initial, ...details, primaryMistake: tracking.mistake });
        return;
      }
      callbacks.current.onEvaluate?.(evaluation, now);
      const result = stable.current.update(
        evaluation,
        now,
        target?.thresholds.holdMs || 800,
      );
      const primaryMistake = feedback.current.update(evaluation.mistakes, now);
      const message = evaluation.isCorrect
        ? "Hold that position"
        : primaryMistake?.message || "Almost there. Keep adjusting your hand.";
      if (result.complete && !complete.current) {
        complete.current = true;
        lastRecognized.current = evaluation.gestureId;
        setState({
          ...result,
          ...details,
          feedback: "Great. Gesture completed.",
          evaluation,
          completed: true,
          primaryMistake: null,
        });
        callbacks.current.onComplete(evaluation);
      } else if (now - lastUI.current > 100) {
        lastUI.current = now;
        setState({
          ...result,
          ...details,
          feedback: message,
          evaluation,
          completed: false,
          primaryMistake,
        });
      }
    },
    [target, catalog],
  );
  return { state, onHand };
}
