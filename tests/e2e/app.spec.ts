import { test, expect, type Page } from "@playwright/test";
import { fixture } from "../fixtures";
import { developmentOrigins } from "../../shared/development";
import type { HandInput } from "../../src/gesture-engine/types";
const routes = [
  "/",
  "/dashboard",
  "/practice",
  "/learn",
  "/trainer/handshape-basics",
  "/translate",
  "/progress",
];
async function offlineApi(page: Page) {
  await page.route("**/api/**", (route) => route.abort());
}
async function mockTracking(page: Page) {
  await page.addInitScript(() => {
    const createOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const testWindow = window as unknown as { testToneCount: number };
      testWindow.testToneCount = (testWindow.testToneCount || 0) + 1;
      return createOscillator.call(this);
    };
    class TestWorker {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      postMessage(data: {
        type: string;
        bitmap?: ImageBitmap;
        timestamp?: number;
      }) {
        if (data.type === "init") {
          const testWindow = window as unknown as { testWorkerStarts: number };
          testWindow.testWorkerStarts = (testWindow.testWorkerStarts || 0) + 1;
          setTimeout(() => this.onmessage?.({ data: { type: "ready" } }), 20);
        }
        if (data.type === "frame") {
          data.bitmap?.close();
          const hand =
            (window as unknown as { testHand: unknown }).testHand || null;
          setTimeout(
            () =>
              this.onmessage?.({
                data: { type: "result", hand, timestamp: data.timestamp },
              }),
            10,
          );
        }
      }
      terminate() {
        this.onmessage = null;
      }
    }
    Object.defineProperty(window, "Worker", { value: TestWorker });
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      (window as unknown as { testStream: MediaStream }).testStream = stream;
      return stream;
    };
  });
}
async function hand(page: Page, input: HandInput | null) {
  await page.evaluate((input) => {
    (window as unknown as { testHand: HandInput | null }).testHand = input;
  }, input);
}
test("all core routes render on desktop and mobile without overflow or page errors", async ({
  page,
}) => {
  await offlineApi(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [1440, 768, 430, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      if (route.startsWith("/trainer") && width <= 768) {
        const camera = await page.locator(".camera-panel").boundingBox();
        expect(camera!.width).toBeGreaterThan(width * 0.85);
        const preview = await page.locator(".camera-stage").boundingBox();
        expect(preview!.width).toBeGreaterThan(width * 0.85);
        const target = await page.locator(".mobile-target").boundingBox();
        expect(target!.y + target!.height).toBeLessThan(camera!.y);
      }
      await page.screenshot({
        path: `/private/tmp/signai-${width}-${route.replaceAll("/", "-").replace(/^-/, "") || "landing"}.png`,
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
});
test("camera denial explains how to recover and allows retry", async ({
  page,
}) => {
  await offlineApi(page);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await page.goto("/trainer/handshape-basics");
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.getByRole("alert")).toContainText("Allow camera access");
  await expect(
    page.getByRole("button", { name: "Try camera again" }),
  ).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/signai-camera-denied.png",
    fullPage: true,
  });
});
test("real MediaPipe worker loads local assets and handles a camera frame with no hand", async ({
  page,
}) => {
  await offlineApi(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/trainer/handshape-basics");
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(
    page.getByText("Looking for your hand", { exact: true }),
  ).toBeVisible({ timeout: 35000 });
  await expect(page.getByText("Show one hand to the camera")).toBeVisible();
  await page.getByRole("button", { name: "Stop camera" }).click();
  await expect(
    page.getByRole("button", { name: "Start camera" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("path lesson automatically opens the camera, coaches mistakes, awards XP and unlocks the next node", async ({
  page,
}) => {
  await offlineApi(page);
  await mockTracking(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/learn$/);
  await page.getByRole("button", { name: "Warm Up · current lesson" }).click();
  await page.screenshot({
    path: "/private/tmp/signai-path-selected.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "START", exact: true }).click();
  await expect(
    page.getByText("Looking for your hand", { exact: true }),
  ).toBeVisible();
  await hand(page, fixture("fist"));
  await expect(page.locator(".feedback-box").getByRole("status")).toContainText(
    "Straighten your index finger.",
  );
  await page.screenshot({
    path: "/private/tmp/signai-error-mode.png",
    fullPage: true,
  });
  await hand(page, fixture("palm"));
  await expect(
    page.getByRole("heading", { name: "Closed fist", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".feedback-box").getByRole("status")).toContainText(
    "Fold your index finger.",
  );
  await hand(page, fixture("fist"));
  await expect(
    page.getByRole("heading", { name: "V handshape", exact: true }),
  ).toBeVisible();
  await hand(page, fixture("victory"));
  await expect(page).toHaveURL(/\/results\//);
  await expect(
    page.getByRole("heading", { name: "Great work!" }),
  ).toBeVisible();
  await expect(page.getByLabel("40 XP earned")).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { testToneCount: number }).testToneCount,
    ),
  ).toBe(9);
  await expect(
    page.getByText("Warm Up complete. Open Palm is ready for you."),
  ).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/signai-results.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(() =>
      (window as unknown as { testStream: MediaStream }).testStream
        .getTracks()
        .every((t) => t.readyState === "ended"),
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/private/tmp/signai-mobile-results.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByLabel("40 XP earned")).toBeVisible();
  await page.getByRole("link", { name: "CONTINUE", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Warm Up · completed, practice again" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Open Palm · current lesson" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Closed Fist · locked" }),
  ).toBeEnabled();
  await expect(page.locator(".xp-count strong")).toHaveText("40");
  await expect(page.locator(".streak-count strong")).toHaveText("1");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("signai-progress-v1") || "{}"),
  );
  expect(saved.progress.attempts).toHaveLength(3);
  expect(saved.progress.results).toHaveLength(1);
  await page
    .getByRole("button", { name: "Open Palm · current lesson" })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/private/tmp/signai-mobile-unlocked.png",
    fullPage: true,
  });
  await page.unroute("**/api/**");
  const received: string[] = [];
  await page.route("**/api/**", async (route) => {
    if (route.request().method() === "POST") {
      received.push(route.request().url());
      await route.fulfill({ json: route.request().postDataJSON() });
    } else await route.fulfill({ json: { attempts: [], results: [] } });
  });
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect
    .poll(
      () => received.filter((url) => url.endsWith("/lesson-results")).length,
    )
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("signai-progress-v1") || "{}")
            .pendingResults.length,
      ),
    )
    .toBe(0);
  await expect(page.locator(".xp-count strong")).toHaveText("40");
});
test("quick practice completes one selected shape and persists exactly 15 XP", async ({
  page,
}) => {
  await offlineApi(page);
  await mockTracking(page);
  await page.goto("/practice");
  await page
    .locator(".quick-choice")
    .filter({ hasText: "Closed fist" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Make a closed fist." }),
  ).toBeVisible();
  await hand(page, fixture("fist"));
  await expect(page.getByLabel("15 XP earned")).toBeVisible();
  await page.getByRole("link", { name: "CONTINUE", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Warm Up · current lesson" }),
  ).toBeEnabled();
  await expect(page.locator(".xp-count strong")).toHaveText("15");
  await page.reload();
  await expect(page.locator(".xp-count strong")).toHaveText("15");
});
test("all six unit sessions are functional and the checkpoint completes the unit", async ({
  page,
}) => {
  test.setTimeout(90000);
  await offlineApi(page);
  await mockTracking(page);
  await page.goto("/learn");
  const nodes = [
    "Warm Up",
    "Open Palm",
    "Closed Fist",
    "V Handshape",
    "Mix & Practice",
    "Unit Checkpoint",
  ];
  for (const node of nodes) {
    await page
      .getByRole("button", { name: `${node} · current lesson` })
      .click();
    await page.getByRole("link", { name: "START", exact: true }).click();
    for (const [id, label] of [
      ["palm", "Open palm"],
      ["fist", "Closed fist"],
      ["victory", "V handshape"],
    ] as const) {
      await expect(
        page.getByRole("heading", { name: label, exact: true }),
      ).toBeVisible();
      await hand(page, fixture(id));
    }
    await expect(
      page.getByRole("heading", { name: "Great work!" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "CONTINUE", exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "First unit. Big achievement." }),
  ).toBeVisible();
  await expect(page.locator(".path-stop.completed")).toHaveCount(6);
  await expect(page.locator(".xp-count strong")).toHaveText("235");
  await expect(
    page.getByRole("progressbar", { name: "Daily XP goal" }),
  ).toHaveAttribute("aria-valuenow", "100");
  await expect(page.locator(".level-count strong")).toHaveText("Level 2");
  await page.goto("/progress");
  await expect(
    page.getByRole("heading", { name: "Level 2 · Building confidence" }),
  ).toBeVisible();
  await expect(page.locator(".mastery-state.mastered")).toHaveCount(3);
  await page.screenshot({
    path: "/private/tmp/signai-progress-earned.png",
    fullPage: true,
  });
});
test("unit guide and locked-node states are usable on a narrow screen", async ({
  page,
}) => {
  await offlineApi(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/learn");
  await page.getByRole("button", { name: "Guide", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Warm Up · current lesson" }).click();
  await expect(
    page.getByRole("link", { name: "START", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open Palm · locked" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Complete Warm Up to unlock this session.",
  );
  await expect(
    page
      .locator("#node-card-open-palm")
      .getByRole("link", { name: "START", exact: true }),
  ).toHaveCount(0);
  await page.goto("/trainer/handshape-basics?node=checkpoint");
  await expect(
    page.getByText("Complete the previous session to unlock it."),
  ).toBeVisible();
});
test("gesture lab suppresses duplicates and supports removing and clearing the sequence", async ({
  page,
}) => {
  await offlineApi(page);
  await mockTracking(page);
  await page.goto("/translate");
  await page.getByRole("button", { name: "Start camera" }).click();
  await hand(page, fixture("palm"));
  await expect(page.locator(".transcript-entry")).toHaveCount(1);
  await expect(
    page.getByText("Try a different shape, or lower your hand to repeat."),
  ).toBeVisible();
  await hand(page, fixture("victory"));
  await expect(page.locator(".transcript-entry")).toHaveCount(2);
  await page.getByRole("button", { name: "Remove last" }).click();
  await expect(page.locator(".transcript-entry")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.locator(".transcript-entry")).toHaveCount(0);
});

test("coach distinguishes no hand, hand positioning, and shape adjustments", async ({
  page,
}) => {
  await offlineApi(page);
  await mockTracking(page);
  await page.goto("/trainer/handshape-basics");
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.locator(".feedback-box").getByRole("status")).toHaveText(
    "Show your hand to the camera",
  );
  const offCenter = fixture("palm");
  offCenter.landmarks = offCenter.landmarks.map((p) => ({
    ...p,
    x: p.x - 0.5,
  }));
  await hand(page, offCenter);
  await expect(page.locator(".feedback-box")).toContainText(
    "Keep your hand in view",
  );
  await expect(page.locator(".feedback-box").getByRole("status")).toHaveText(
    "Move your hand fully inside the frame.",
  );
  await hand(page, fixture("fist"));
  await expect(page.locator(".feedback-box")).toContainText("Keep trying");
  await expect(page.locator(".feedback-box").getByRole("status")).toHaveText(
    "Straighten your index finger.",
  );
  await page.getByRole("link", { name: "Exit exercise" }).click();
  await expect(page.locator(".xp-count strong")).toHaveText("0");
});

test("camera setup blocks clipped hands and mobile coaching stays beside the preview", async ({
  page,
}) => {
  await offlineApi(page);
  await mockTracking(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/trainer/handshape-basics?practice=palm&diagnostics=1");
  await page.getByRole("button", { name: "Start camera" }).click();
  const clipped = fixture("palm");
  clipped.landmarks[8].y = -0.05;
  await hand(page, clipped);
  await expect(page.getByLabel("Camera setup")).toBeVisible();
  await expect(page.locator(".mobile-coaching")).toContainText(
    "Move your hand fully inside the frame.",
  );
  await expect(
    page.getByRole("progressbar", { name: "Lesson progress" }),
  ).toHaveAttribute("aria-valuenow", "0");
  await expect(page.locator(".mobile-target")).toBeInViewport();
  await expect(page.locator(".mobile-coaching")).toBeInViewport();
  await page.screenshot({
    path: "/private/tmp/signai-mobile-preflight.png",
    fullPage: true,
  });
  await hand(page, fixture("palm"));
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.getByLabel("15 XP earned", { exact: true })).toContainText(
    "15",
  );
});

test("canceling pending permission releases a camera that resolves late", async ({
  page,
}) => {
  await offlineApi(page);
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      (window as unknown as { delayedStream: MediaStream }).delayedStream =
        stream;
      await new Promise<void>((resolve) => {
        (window as unknown as { releaseCamera: () => void }).releaseCamera =
          resolve;
      });
      return stream;
    };
  });
  await page.goto("/trainer/handshape-basics");
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.getByText("Allow your camera to begin")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (window as unknown as { releaseCamera?: () => void }).releaseCamera,
        ),
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.evaluate(() =>
    (window as unknown as { releaseCamera: () => void }).releaseCamera(),
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { delayedStream: MediaStream }).delayedStream
          .getTracks()
          .every((track) => track.readyState === "ended"),
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("button", { name: "Start camera" }),
  ).toBeVisible();
});

test("model failure releases the camera and offers a clean retry", async ({
  page,
}) => {
  await offlineApi(page);
  await mockTracking(page);
  await page.addInitScript(() => {
    class FailedWorker {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      postMessage() {
        setTimeout(
          () =>
            this.onmessage?.({
              data: {
                type: "error",
                message:
                  "Hand tracking could not load. Check your connection and try again.",
              },
            }),
          20,
        );
      }
      terminate() {
        this.onmessage = null;
      }
    }
    Object.defineProperty(window, "Worker", { value: FailedWorker });
  });
  await page.goto("/trainer/handshape-basics");
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Hand tracking could not load",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { testStream: MediaStream }).testStream
          .getTracks()
          .every((track) => track.readyState === "ended"),
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("button", { name: "Try camera again" }),
  ).toBeVisible();
});

test("development reset requires confirmation and clears local progress and pending sync", async ({
  page,
}) => {
  await offlineApi(page);
  await mockTracking(page);
  await page.goto("/trainer/handshape-basics?practice=fist");
  await page.getByRole("button", { name: "Start camera" }).click();
  await hand(page, fixture("fist"));
  await expect(page).toHaveURL(/\/results\//);
  await page.goto("/dev");
  await expect(
    page.getByRole("button", { name: "Reset demo progress" }),
  ).toBeDisabled();
  await page.route("**/api/dev/reset", (route) =>
    route.fulfill({ json: { reset: true } }),
  );
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Reset demo progress" }).click();
  await expect(page.getByRole("status")).toContainText("Demo reset.");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("signai-progress-v1")!),
  );
  expect(saved.progress).toEqual({ attempts: [], results: [] });
  expect(saved.pendingAttempts).toEqual([]);
  expect(saved.pendingResults).toEqual([]);
  await page.getByRole("link", { name: "Back to learning" }).click();
  await expect(page.locator(".xp-count strong")).toHaveText("0");
});

test("portrait camera frames keep video and landmark canvas aligned on mobile", async ({
  page,
}) => {
  await offlineApi(page);
  await mockTracking(page);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 360;
      canvas.height = 640;
      const context = canvas.getContext("2d")!;
      const draw = () => {
        context.fillStyle = "#263550";
        context.fillRect(0, 0, 360, 640);
        requestAnimationFrame(draw);
      };
      draw();
      return canvas.captureStream(20);
    };
  });
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/trainer/handshape-basics");
  await page.getByRole("button", { name: "Start camera" }).click();
  await hand(page, fixture("fist"));
  await expect(page.locator(".camera-status")).toContainText("Hand detected");
  await expect(page.locator(".mobile-coaching")).toContainText(
    "Straighten your index finger.",
  );
  const dimensions = await page
    .locator(".video-surface")
    .evaluate((surface) => {
      const video = surface.querySelector("video")!;
      const canvas = surface.querySelector("canvas")!;
      const v = video.getBoundingClientRect(),
        c = canvas.getBoundingClientRect();
      return {
        sourceRatio: video.videoWidth / video.videoHeight,
        canvasRatio: canvas.width / canvas.height,
        sameBox:
          v.x === c.x &&
          v.y === c.y &&
          v.width === c.width &&
          v.height === c.height,
        videoFit: getComputedStyle(video).objectFit,
        canvasFit: getComputedStyle(canvas).objectFit,
      };
    });
  expect(dimensions.sourceRatio).toBeCloseTo(360 / 640);
  expect(dimensions.canvasRatio).toBeCloseTo(dimensions.sourceRatio);
  expect(dimensions.sameBox).toBe(true);
  expect(dimensions.videoFit).toBe("contain");
  expect(dimensions.canvasFit).toBe("contain");
  await expect(page.locator(".mobile-coaching")).toBeInViewport();
  await page.screenshot({
    path: "/private/tmp/signai-mobile-portrait.png",
    fullPage: true,
  });
});

test("audio device failure cannot block completion, persistence, or result refresh", async ({
  page,
}) => {
  await offlineApi(page);
  await mockTracking(page);
  await page.addInitScript(() => {
    AudioContext.prototype.createOscillator = () => {
      throw new DOMException("Device disconnected", "InvalidStateError");
    };
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/trainer/handshape-basics?practice=fist");
  await page.getByRole("button", { name: "Start camera" }).click();
  await hand(page, fixture("fist"));
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.getByLabel("15 XP earned", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("15 XP earned", { exact: true })).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("signai-progress-v1")!),
  );
  expect(saved.progress.attempts).toHaveLength(1);
  expect(saved.progress.results).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("invalid tracking frames recover without non-finite scores or console errors", async ({
  page,
}) => {
  await offlineApi(page);
  await mockTracking(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/trainer/handshape-basics?practice=fist");
  await page.getByRole("button", { name: "Start camera" }).click();
  await hand(page, { landmarks: [] });
  await expect(page.locator(".feedback-box")).toContainText(
    "Keep your whole hand visible and still for a moment.",
  );
  await expect(page.locator("main")).not.toContainText("NaN");
  await hand(page, fixture("fist"));
  await expect(page).toHaveURL(/\/results\//);
  expect(errors).toEqual([]);
});

for (const [name, errorName, message] of [
  ["missing camera", "NotFoundError", "No camera found"],
  ["busy camera", "NotReadableError", "Your camera is busy"],
] as const)
  test(`${name} offers a working retry`, async ({ page }) => {
    await offlineApi(page);
    await mockTracking(page);
    await page.addInitScript((errorName) => {
      const original = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      let first = true;
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (first) {
          first = false;
          throw new DOMException("Camera failure", errorName);
        }
        return original(constraints);
      };
    }, errorName);
    await page.goto("/trainer/handshape-basics?practice=fist");
    await page.getByRole("button", { name: "Start camera" }).click();
    await expect(page.getByRole("alert")).toContainText(message);
    await page.getByRole("button", { name: "Try camera again" }).click();
    await hand(page, fixture("fist"));
    await expect(page).toHaveURL(/\/results\//);
  });

test.describe("localization", () => {
  test.use({ locale: "ru-RU" });
  test("Russian default, manual override, reload and navigation persistence", async ({
    page,
    browser,
  }) => {
    await offlineApi(page);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.locator("h1")).toHaveText("Пора учиться руками.");
    await page.getByRole("button", { name: "English", exact: true }).click();
    await expect(page.locator("h1")).toHaveText(
      "Let’s put your hands to work.",
    );
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.getByRole("link", { name: "Practice", exact: true }).click();
    await expect(page.locator("h1")).toHaveText(
      "A little practice. A lot of possibility.",
    );
    const state = await page.context().storageState();
    const restarted = await browser.newContext({
      locale: "ru-RU",
      storageState: state,
    });
    const restored = await restarted.newPage();
    await offlineApi(restored);
    await restored.goto(`${developmentOrigins.frontend}/learn`);
    await expect(restored.locator("html")).toHaveAttribute("lang", "en");
    await restarted.close();
  });
  test("switching during coaching and hold keeps camera, score, IDs and XP intact", async ({
    page,
  }) => {
    await offlineApi(page);
    await mockTracking(page);
    await page.goto("/trainer/handshape-basics?practice=palm&diagnostics=1");
    await page.getByRole("button", { name: "Включить камеру" }).click();
    await hand(page, fixture("fist"));
    await expect(page.locator(".feedback-box")).toContainText("Выпрями");
    const camera = await page
      .locator("video")
      .evaluateHandle((video) => (video as HTMLVideoElement).srcObject);
    const score = await page
      .getByRole("progressbar", { name: "Точность формы", exact: true })
      .getAttribute("aria-valuenow");
    await page.getByRole("button", { name: "English", exact: true }).click();
    await expect(page.locator(".feedback-box")).toContainText("Straighten");
    await expect(
      page.getByRole("progressbar", { name: "Shape accuracy", exact: true }),
    ).toHaveAttribute("aria-valuenow", score!);
    await expect(page.locator(".exercise-count")).toHaveText("1 / 1");
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { testWorkerStarts: number }).testWorkerStarts,
      ),
    ).toBe(1);
    await hand(page, fixture("palm"));
    await expect
      .poll(
        async () =>
          Number(
            await page
              .getByRole("progressbar", { name: "Hold progress", exact: true })
              .getAttribute("aria-valuenow"),
          ),
        { intervals: [20] },
      )
      .toBeGreaterThan(0);
    await page.getByRole("button", { name: "Русский", exact: true }).click();
    await expect(
      page.getByRole("progressbar", {
        name: "Прогресс удержания",
        exact: true,
      }),
    ).not.toHaveAttribute("aria-valuenow", "0");
    expect(
      await page
        .locator("video")
        .evaluate(
          (video, stream) => (video as HTMLVideoElement).srcObject === stream,
          camera,
        ),
    ).toBe(true);
    await expect(page).toHaveURL(/\/results\//);
    await expect(page.locator("h1")).toHaveText("Отличная работа!");
    await expect(page.locator(".xp-earned strong")).toHaveText("+15");
    const saved = await page.evaluate(() =>
      localStorage.getItem("signai-progress-v1"),
    );
    const progress = JSON.parse(saved!).progress;
    expect(progress.attempts).toHaveLength(1);
    expect(progress.results).toHaveLength(1);
    expect(progress.attempts[0].gestureId).toBe("palm");
    expect(progress.results[0].lessonId).toBe("handshape-basics");
    await page.getByRole("button", { name: "English", exact: true }).click();
    await expect(page.locator("h1")).toHaveText("Great work!");
    expect(
      await page.evaluate(() => localStorage.getItem("signai-progress-v1")),
    ).toBe(saved);
    await page.reload();
    await expect(page.locator(".xp-earned strong")).toHaveText("+15");
    await page.getByRole("button", { name: "Русский", exact: true }).click();
    const resultUrl = page.url();
    for (const locale of ["ru", "en"] as const) {
      await page
        .getByRole("button", {
          name: locale === "ru" ? "Русский" : "English",
          exact: true,
        })
        .click();
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.screenshot({
          path: `/private/tmp/signai-i18n-${locale}-${width}-results.png`,
          fullPage: true,
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    }
    await page.goto(resultUrl);
    await expect(page.locator(".xp-earned strong")).toHaveText("+15");
  });
  test("both languages fit desktop and mobile routes, popovers, guide and camera errors", async ({
    page,
  }) => {
    await offlineApi(page);
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("Denied", "NotAllowedError");
      };
    });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of [
        "/learn",
        "/trainer/handshape-basics?diagnostics=1",
        "/progress",
        "/translate",
        "/practice",
        "/about",
      ]) {
        await page.goto(route);
        for (const locale of ["ru", "en"] as const) {
          await page
            .getByRole("button", {
              name: locale === "ru" ? "Русский" : "English",
              exact: true,
            })
            .click();
          await expect(page.locator("html")).toHaveAttribute("lang", locale);
          await expect(page.locator("h1")).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${locale} ${width} ${route}`,
          ).toBe(true);
          if (route === "/learn") {
            await page.locator(".lesson-node").nth(1).click();
            await expect(page.locator(".locked-explanation")).toContainText(
              locale === "ru"
                ? "Заверши занятие «Разминка»"
                : "Complete Warm Up",
            );
            await page.screenshot({
              path: `/private/tmp/signai-i18n-${locale}-${width}-popover.png`,
              fullPage: true,
            });
            await page
              .getByRole("button", {
                name:
                  locale === "ru"
                    ? "Закрыть описание занятия"
                    : "Close lesson details",
              })
              .click();
            await page
              .getByRole("button", {
                name: locale === "ru" ? "Как заниматься" : "Guide",
                exact: true,
              })
              .click();
            await expect(page.locator("dialog")).toBeVisible();
            await page.screenshot({
              path: `/private/tmp/signai-i18n-${locale}-${width}-guide.png`,
              fullPage: true,
            });
            await page.keyboard.press("Escape");
          }
          await page.screenshot({
            path: `/private/tmp/signai-i18n-${locale}-${width}-${route.split("?")[0].replaceAll("/", "-")}.png`,
            fullPage: true,
          });
        }
        if (route.startsWith("/trainer")) {
          await page.getByRole("button", { name: "Start camera" }).click();
          await expect(page.getByRole("alert")).toContainText(
            "Camera access is blocked.",
          );
          await page
            .getByRole("button", { name: "Русский", exact: true })
            .click();
          await expect(page.getByRole("alert")).toContainText(
            "Доступ к камере заблокирован.",
          );
          await expect(
            page.getByRole("button", { name: "Подключить снова" }),
          ).toBeVisible();
        }
      }
    }
  });
});

test("non-Russian browser starts in English and stored Russian wins", async ({
  page,
}) => {
  await offlineApi(page);
  await page.goto("/learn");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Русский", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await page.getByRole("link", { name: "Прогресс", exact: true }).click();
  await expect(page.locator("h1")).toHaveText(
    "Здесь начинается твоё обучение.",
  );
});

test("Russian preflight, retained recognition history and populated progress stay localized", async ({
  page,
}) => {
  await offlineApi(page);
  await mockTracking(page);
  await page.goto("/translate");
  await page.getByRole("button", { name: "Русский", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.getByRole("button", { name: "Включить камеру" }).click();
  await expect(page.locator(".camera-preflight")).toContainText(
    "Рука в нужном положении",
  );
  await page.screenshot({
    path: "/private/tmp/signai-i18n-ru-390-preflight.png",
    fullPage: true,
  });
  await hand(page, fixture("palm"));
  await expect(page.locator(".transcript-entry")).toHaveText(/Открытая ладонь/);
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator(".transcript-entry")).toHaveCount(1);
  await expect(page.locator(".transcript-entry")).toHaveText(/Open palm/);
  await page.getByRole("button", { name: "Русский", exact: true }).click();
  await page.goto("/trainer/handshape-basics");
  await page.getByRole("button", { name: "Включить камеру" }).click();
  for (const [id, title] of [
    ["palm", "Покажи открытую ладонь."],
    ["fist", "Сожми руку в кулак."],
    ["victory", "Покажи форму V."],
  ] as const) {
    await expect(page.locator("h1")).toHaveText(title);
    await hand(page, fixture(id));
  }
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.locator(".xp-earned strong")).toHaveText("+40");
  await expect(page.locator(".unlock-message")).toContainText(
    "«Разминка» завершено.",
  );
  await page.screenshot({
    path: "/private/tmp/signai-i18n-ru-390-full-results.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "ПРОДОЛЖИТЬ", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(
    page.getByRole("button", {
      name: "Открытая ладонь · текущее занятие",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Прогресс", exact: true }).click();
  await expect(page.locator(".growth-highlights")).toContainText("40");
  await expect(page.locator(".growth-history")).toContainText(
    "1 занятие завершено · 3 попытки",
  );
  await expect(page.locator(".mastery-state").first()).toHaveText("Изучается");
  const expectedDate = new Date().toLocaleDateString("ru", {
    month: "short",
    day: "numeric",
  });
  await expect(page.locator(".session-row small")).toContainText(expectedDate);
  await expect(page.locator(".session-row small")).toContainText(
    "3 формы выполнены",
  );
  await page.screenshot({
    path: "/private/tmp/signai-i18n-ru-390-populated-progress.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "/private/tmp/signai-i18n-ru-1440-populated-progress.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Практика", exact: true }).click();
  await expect(page.locator(".practice-module").first()).toContainText(
    "Потренируй форму «",
  );
  await expect(page.locator(".practice-module").first()).toContainText(
    "Средняя точность — 100%",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
