import { expect, test } from "@playwright/test";
import { almostOpenPalm, fixture } from "../fixtures";
import type { CameraFrame } from "../../src/gesture-engine/types";
interface VisionState {
  frame: CameraFrame;
  stream?: MediaStream;
  starts: number;
  stops: number;
  tones: number;
  pending: number;
  peakPending: number;
}
for (const diagnostics of [false, true])
  test(`correct second hand completes once and releases camera with diagnostics ${diagnostics}`, async ({
    page,
  }) => {
    await page.route("**/api/**", (route) => route.abort());
    await page.addInitScript(() => {
      const state = window as unknown as VisionState;
      Object.assign(state, {
        frame: null,
        starts: 0,
        stops: 0,
        tones: 0,
        pending: 0,
        peakPending: 0,
      });
      const createOscillator = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function () {
        state.tones++;
        return createOscillator.call(this);
      };
      const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await getUserMedia(constraints);
        state.stream = stream;
        return stream;
      };
      class TestWorker {
        onmessage: ((event: { data: unknown }) => void) | null = null;
        postMessage(data: {
          type: string;
          timestamp?: number;
          bitmap?: ImageBitmap;
        }) {
          if (data.type === "init") {
            state.starts++;
            setTimeout(() => this.onmessage?.({ data: { type: "ready" } }), 10);
          } else if (data.type === "frame") {
            data.bitmap?.close();
            state.pending++;
            state.peakPending = Math.max(state.pending, state.peakPending);
            const hands = state.frame;
            setTimeout(() => {
              state.pending--;
              this.onmessage?.({
                data: { type: "result", hands, timestamp: data.timestamp },
              });
            }, 10);
          }
        }
        terminate() {
          this.onmessage = null;
          state.stops++;
        }
      }
      Object.defineProperty(window, "Worker", { value: TestWorker });
    });
    await page.goto(
      `/trainer/handshape-basics?practice=palm${diagnostics ? "&diagnostics=1" : ""}`,
    );
    await page
      .getByRole("button", { name: "Start camera", exact: true })
      .click();
    const left = almostOpenPalm();
    await page.evaluate(
      (frame) => {
        (window as unknown as VisionState).frame = frame;
      },
      { left },
    );
    await expect(
      page.locator(".feedback-box").getByRole("status"),
    ).toContainText("Straighten your ring finger.");
    if (diagnostics) {
      await page.getByText("Camera diagnostics", { exact: true }).click();
      await expect(page.locator(".dev-diagnostics")).toContainText("Left");
    }
    await page.evaluate(
      (frame) => {
        (window as unknown as VisionState).frame = frame;
      },
      {
        left,
        right: {
          ...fixture("palm"),
          handedness: "Right" as const,
          confidence: 1,
          trackingQuality: "valid" as const,
        },
      },
    );
    await expect(page).toHaveURL(/\/results\//);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const state = window as unknown as VisionState;
          return {
            starts: state.starts,
            stops: state.stops,
            tones: state.tones,
            peakPending: state.peakPending,
            ended: state.stream
              ?.getTracks()
              .every((track) => track.readyState === "ended"),
          };
        }),
      )
      .toEqual({ starts: 1, stops: 1, tones: 3, peakPending: 1, ended: true });
    const progress = await page.evaluate(
      () => JSON.parse(localStorage.getItem("signai-progress-v1")!).progress,
    );
    expect(progress.attempts).toHaveLength(1);
    expect(progress.results).toHaveLength(1);
    expect(progress.attempts[0]).toMatchObject({
      gestureId: "palm",
      success: true,
      score: 100,
    });
  });
