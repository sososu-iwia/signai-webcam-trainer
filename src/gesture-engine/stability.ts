import type { Evaluation, Mistake } from "./types";
export class StabilityTracker {
  private smooth = 0;
  private start: number | null = null;
  private previous: number | null = null;
  private gesture: string | null = null;
  private complete = false;
  reset() {
    this.smooth = 0;
    this.start = null;
    this.previous = null;
    this.gesture = null;
    this.complete = false;
  }
  update(evaluation: Evaluation | null, now: number, holdMs = 800) {
    if (
      !evaluation ||
      !Number.isFinite(evaluation.score) ||
      !Number.isFinite(now) ||
      !Number.isFinite(holdMs) ||
      holdMs <= 0
    ) {
      this.reset();
      return { score: 0, hold: 0, complete: false };
    }
    if (
      this.gesture !== evaluation.gestureId ||
      (this.previous !== null &&
        (now - this.previous > 250 || now < this.previous))
    )
      this.reset();
    this.gesture = evaluation.gestureId;
    this.smooth =
      this.previous === null
        ? evaluation.score
        : this.smooth +
          (evaluation.score - this.smooth) *
            (1 - Math.exp(-(now - this.previous) / 160));
    this.previous = now;
    if (evaluation.isCorrect) {
      this.start ??= now;
    } else {
      this.start = null;
      this.complete = false;
    }
    const hold =
      this.start === null ? 0 : Math.min(1, (now - this.start) / holdMs);
    if (hold === 1) this.complete = true;
    return { score: Math.round(this.smooth), hold, complete: this.complete };
  }
}
export class FeedbackSmoother {
  private shown = "";
  private candidate = "";
  private since = 0;
  reset() {
    this.shown = "";
    this.candidate = "";
    this.since = 0;
  }
  update(message: string, now: number) {
    if (!this.shown) this.shown = message;
    if (this.candidate !== message) {
      this.candidate = message;
      this.since = now;
    }
    if (now - this.since >= 350) this.shown = message;
    return this.shown;
  }
}

function correctionIdentity(mistake: Mistake | null) {
  return mistake
    ? [
        mistake.code || mistake.message,
        mistake.hand || "",
        mistake.finger || "",
      ].join(":")
    : "";
}
export class CorrectionSelector {
  private shown: Mistake | null = null;
  private candidate = "";
  private since = 0;
  reset() {
    this.shown = null;
    this.candidate = "";
    this.since = 0;
  }
  update(mistakes: Mistake[], now: number): Mistake | null {
    const first = mistakes[0];
    if (!first) {
      this.reset();
      return null;
    }
    const stillPresent = mistakes.find(
      (m) => correctionIdentity(m) === correctionIdentity(this.shown),
    );
    if (!this.shown) this.shown = first;
    if (stillPresent && first.severity < stillPresent.severity + 0.4) {
      this.candidate = "";
      this.since = now;
      this.shown = stillPresent;
      return this.shown;
    }
    if (this.candidate !== correctionIdentity(first)) {
      this.candidate = correctionIdentity(first);
      this.since = now;
    }
    if (
      (first.severity >= 2 && this.shown.severity < 2) ||
      now - this.since >= 450
    )
      this.shown = first;
    return this.shown;
  }
}

export function scoreLabel(score: number, correct: boolean) {
  if (correct) return "Great position!";
  return score < 50
    ? "Keep trying"
    : score < 70
      ? "Getting closer"
      : "Almost there!";
}
