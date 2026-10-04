import { test, expect, type Page } from "@playwright/test";
import { courseFixture, dualFixture } from "../course-fixtures";
import {
  courseUnits,
  exerciseSteps,
  type CourseNode,
} from "../../shared/course";
import { getGesture } from "../../shared/catalog";
import type { CameraFrame } from "../../src/gesture-engine/types";
import type { Attempt, LessonResult } from "../../shared/schema";
import { randomUUID } from "node:crypto";
async function setup(page: Page, nodes: CourseNode[] = []) {
  await page.route("**/api/**", (route) => route.abort());
  const results: LessonResult[] = nodes.map((node) => ({
    id: randomUUID(),
    userId: "demo",
    lessonId: node.unitId,
    courseNodeId: node.id,
    sessionKind: "lesson",
    durationMs: 5000,
    createdAt: new Date().toISOString(),
    attempts: exerciseSteps(node.exercise).map((step): Attempt => ({
      id: randomUUID(),
      userId: "demo",
      lessonId: node.unitId,
      gestureId: step.gestureId,
      exerciseId: step.id,
      exerciseType: step.type,
      score: 95,
      success: true,
      corrections: 0,
      mistakes: [],
      durationMs: 1000,
      createdAt: new Date().toISOString(),
    })),
  }));
  await page.addInitScript((results) => {
    if (!localStorage.getItem("signai-progress-v1"))
      localStorage.setItem(
        "signai-progress-v1",
        JSON.stringify({
          progress: { attempts: results.flatMap((r) => r.attempts), results },
          pendingAttempts: [],
          pendingResults: [],
        }),
      );
    const state = window as unknown as {
      frame: unknown;
      starts: number;
      stream: MediaStream;
      segments: number;
    };
    state.starts = 0;
    class TestWorker {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      postMessage(data: {
        type: string;
        bitmap?: ImageBitmap;
        timestamp?: number;
      }) {
        if (data.type === "init") {
          state.starts++;
          setTimeout(() => this.onmessage?.({ data: { type: "ready" } }), 20);
        }
        if (data.type === "frame") {
          data.bitmap?.close();
          setTimeout(
            () =>
              this.onmessage?.({
                data: {
                  type: "result",
                  hands: state.frame || {},
                  timestamp: data.timestamp,
                },
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
      state.stream = await original(constraints);
      return state.stream;
    };
    const clear = CanvasRenderingContext2D.prototype.clearRect,
      stroke: (this: CanvasRenderingContext2D) => void =
        CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      state.segments = 0;
      return clear.apply(this, args);
    };
    CanvasRenderingContext2D.prototype.stroke = function () {
      state.segments++;
      return stroke.call(this);
    };
  }, results);
}
async function frame(page: Page, value: CameraFrame) {
  await page.evaluate((value) => {
    (window as unknown as { frame: CameraFrame }).frame = value;
  }, value);
}
async function start(page: Page) {
  const button = page.getByRole("button", {
    name: /^(Start camera|Включить камеру)$/,
  });
  if (await button.isVisible()) await button.click();
}
async function completeNode(page: Page, node: CourseNode) {
  await page.goto(`/trainer/${node.unitId}?activity=${node.id}`);
  for (const [index, step] of exerciseSteps(node.exercise).entries()) {
    await expect(page.locator(".exercise-count")).toHaveText(
      `${index + 1} / ${exerciseSteps(node.exercise).length}`,
    );
    if (step.type === "SIGN_RECOGNITION") {
      await page
        .getByRole("button", {
          name: getGesture(step.gestureId).letter!,
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
    } else {
      await start(page);
      await frame(page, courseFixture(step.gestureId));
    }
  }
  await expect(page).toHaveURL(/\/results\//);
}
test("short course demo preserves camera and locale, accepts either hand and both visible, and unlocks real activities", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/learn");
  await page
    .getByRole("link", { name: "Start the quick demo", exact: true })
    .click();
  await expect(
    page.getByText("Looking for your hand", { exact: true }),
  ).toBeVisible();
  await frame(page, courseFixture("kz-v", "Left"));
  await expect(page.locator(".feedback-box")).toContainText(
    "Fold your index finger.",
  );
  const stream = await page
    .locator("video")
    .evaluateHandle((v) => (v as HTMLVideoElement).srcObject);
  const score = await page
    .getByRole("progressbar", { name: "Shape accuracy", exact: true })
    .getAttribute("aria-valuenow");
  await page.getByRole("button", { name: "Русский", exact: true }).click();
  await expect(page.locator(".feedback-box")).toContainText(
    "Согни указательный палец.",
  );
  await expect(
    page.getByRole("progressbar", { name: "Точность формы", exact: true }),
  ).toHaveAttribute("aria-valuenow", score!);
  await frame(page, courseFixture("kz-a", "Left"));
  await expect(page.locator("h1")).toHaveText("Покажи В");
  const both = dualFixture();
  await frame(page, both);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { segments: number }).segments),
    )
    .toBe(42);
  await expect(page.locator("h1")).toHaveText("Покажи Ү");
  await frame(page, courseFixture("kz-u-diaeresis"));
  expect(
    await page
      .locator("video")
      .evaluate(
        (v, stream) => (v as HTMLVideoElement).srcObject === stream,
        stream,
      ),
  ).toBe(true);
  expect(
    await page.evaluate(() => (window as unknown as { starts: number }).starts),
  ).toBe(1);
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.locator(".xp-earned strong")).toHaveText("+40");
  const result = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("signai-progress-v1")!).progress
        .results[0],
  );
  expect(result.attempts.map((a: Attempt) => a.gestureId)).toEqual([
    "kz-a",
    "kz-v",
    "kz-u-diaeresis",
  ]);
  expect(new Set(result.attempts.map((a: Attempt) => a.id)).size).toBe(3);
  await page.reload();
  await expect(page.locator(".xp-earned strong")).toHaveText("+40");
  await page.getByRole("link", { name: "Вернуться к курсу" }).click();
  await expect(
    page.getByRole("link", { name: /Работа над ошибками · А В Ү/ }),
  ).toBeVisible();
});
test("recognition needs no camera, explains an incorrect answer and awards no invented XP", async ({
  page,
}) => {
  await setup(page, courseUnits[0].nodes.slice(0, 4));
  const node = courseUnits[0].nodes[4];
  await page.goto(`/trainer/${node.unitId}?activity=${node.id}`);
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.locator(".procedural-hand")).not.toHaveAttribute(
    "aria-label",
    /А/,
  );
  await page.getByRole("button", { name: "О", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("The answer is А.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".xp-earned strong")).toHaveText("+0");
  expect(
    await page.evaluate(() => (window as unknown as { starts: number }).starts),
  ).toBe(0);
});
test("recall hint and EN/RU switch preserve an active camera and score", async ({
  page,
}) => {
  await setup(page, courseUnits[0].nodes.slice(0, 5));
  const node = courseUnits[0].nodes[5];
  await page.goto(`/trainer/${node.unitId}?activity=${node.id}`);
  await expect(page.locator(".procedural-hand")).toHaveCount(0);
  await start(page);
  await frame(page, courseFixture("kz-v"));
  await expect(page.locator(".feedback-box")).toContainText("Fold");
  const score = await page
    .getByRole("progressbar", { name: "Shape accuracy", exact: true })
    .getAttribute("aria-valuenow");
  await page.getByRole("button", { name: "Show hint" }).click();
  await expect(page.locator(".procedural-hand")).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Shape accuracy", exact: true }),
  ).toHaveAttribute("aria-valuenow", score!);
  await page.getByRole("button", { name: "Русский", exact: true }).click();
  expect(
    await page.evaluate(() => (window as unknown as { starts: number }).starts),
  ).toBe(1);
  await frame(page, courseFixture("kz-a"));
  await expect(page).toHaveURL(/\/results\//);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("signai-progress-v1")!,
        ).progress.results.find(
          (result: LessonResult) =>
            result.id === location.pathname.split("/").at(-1),
        ).attempts[0].hintUsed,
    ),
  ).toBe(true);
});
test("leaving a camera activity saves a real unsuccessful attempt for weak practice", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/trainer/course-practice?practice=kz-o");
  await start(page);
  await frame(page, courseFixture("kz-v"));
  await expect(page.locator(".feedback-box")).toContainText("Connect");
  await page.getByRole("link", { name: "Exit exercise" }).click();
  await expect(page).toHaveURL(/\/learn$/);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("signai-progress-v1")!).progress
            .attempts.length,
      ),
    )
    .toBe(1);
  const attempts = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("signai-progress-v1")!).progress.attempts,
  );
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({ gestureId: "kz-o", success: false });
  expect(attempts[0].mistakes.length).toBeGreaterThan(0);
});
test("mixed checkpoint unlocks Unit 2 and Quick Signs advances five camera targets", async ({
  page,
}) => {
  test.setTimeout(90000);
  await setup(page, courseUnits[0].nodes.slice(0, 8));
  await completeNode(page, courseUnits[0].nodes[8]);
  await expect(page.locator(".unlock-message")).toContainText(
    "Next unit unlocked",
  );
  await page.goto("/learn");
  const unit = page.locator(".course-unit").nth(1);
  await unit.locator("summary").click();
  await expect(
    unit.getByRole("link", { name: /Learn & Copy · О/ }),
  ).toBeVisible();
  await page.evaluate(
    ({ nodes }) => {
      const saved = JSON.parse(localStorage.getItem("signai-progress-v1")!);
      saved.progress.results.push(...nodes);
      saved.progress.attempts.push(...nodes.flatMap((n) => n.attempts));
      localStorage.setItem("signai-progress-v1", JSON.stringify(saved));
    },
    {
      nodes: courseUnits[1].nodes.slice(0, 7).map((node) => ({
        id: randomUUID(),
        userId: "demo",
        lessonId: node.unitId,
        courseNodeId: node.id,
        sessionKind: "lesson",
        durationMs: 5000,
        createdAt: new Date().toISOString(),
        attempts: exerciseSteps(node.exercise).map((step) => ({
          id: randomUUID(),
          userId: "demo",
          lessonId: node.unitId,
          gestureId: step.gestureId,
          exerciseId: step.id,
          exerciseType: step.type,
          score: 95,
          success: true,
          corrections: 0,
          mistakes: [],
          durationMs: 1000,
          createdAt: new Date().toISOString(),
        })),
      })),
    },
  );
  await completeNode(page, courseUnits[1].nodes[7]);
  await expect(page.locator(".completion-stats")).toContainText("5 / 5");
  await expect(page.locator(".xp-earned strong")).toHaveText("+60");
});
test("final checkpoint exercises all nine static targets", async ({ page }) => {
  test.setTimeout(90000);
  await setup(page, [
    ...courseUnits[0].nodes,
    ...courseUnits[1].nodes,
    ...courseUnits[2].nodes.slice(0, 8),
  ]);
  await completeNode(page, courseUnits[2].nodes[8]);
  await expect(page.locator(".completion-stats")).toContainText("13 / 13");
  await expect(page.locator(".unlock-message")).toContainText(
    "More lessons coming soon",
  );
});
test("dual development exercise requires both hands, draws two skeletons and holds without restarting MediaPipe", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/dev/dual");
  await start(page);
  await expect(page.locator(".course-coach").getByRole("status")).toHaveText(
    "Show both hands to the camera.",
  );
  const both = dualFixture();
  await frame(page, { left: both.left });
  await expect(page.locator(".course-coach").getByRole("status")).toHaveText(
    "Keep both hands inside the frame.",
  );
  const wrong = structuredClone(both);
  wrong.left!.landmarks = both.right!.landmarks.map((p) => ({
    ...p,
    x: p.x - 0.34,
  }));
  wrong.left!.worldLandmarks = wrong.left!.landmarks;
  await frame(page, wrong);
  await expect(page.locator(".course-coach").getByRole("status")).toContainText(
    "left hand",
  );
  await page.getByRole("button", { name: "Русский", exact: true }).click();
  await expect(page.locator(".course-coach").getByRole("status")).toContainText(
    "левой руки",
  );
  await frame(page, both);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { segments: number }).segments),
    )
    .toBe(42);
  await expect
    .poll(
      async () =>
        Number(
          await page
            .getByRole("progressbar", { name: "Прогресс удержания" })
            .getAttribute("aria-valuenow"),
        ),
      { intervals: [20] },
    )
    .toBeGreaterThan(0);
  await frame(page, { right: both.right });
  await expect(
    page.getByRole("progressbar", { name: "Прогресс удержания" }),
  ).toHaveAttribute("aria-valuenow", "0");
  await frame(page, both);
  await expect(
    page.locator(".course-coach").getByText("Отлично!", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { starts: number }).starts),
  ).toBe(1);
});
test("course, references, recognition choices and dual diagnostics fit all supported widths in EN/RU", async ({
  page,
}) => {
  test.setTimeout(90000);
  await setup(
    page,
    courseUnits.flatMap((u) => u.nodes),
  );
  for (const width of [390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "/learn",
      "/progress",
      "/trainer/first-handshapes?activity=first-handshapes-recognize",
      "/trainer/first-handshapes?activity=first-handshapes-recall-a",
      "/trainer/precision?activity=precision-coach",
      "/dev/dual",
    ]) {
      await page.goto(route);
      for (const locale of ["en", "ru"] as const) {
        await page
          .getByRole("button", {
            name: locale === "en" ? "English" : "Русский",
            exact: true,
          })
          .click();
        await expect(page.locator("h1")).toBeVisible();
        if (route === "/progress") {
          await expect(
            page.locator(".session-history .session-row").first(),
          ).toContainText(locale === "en" ? "Checkpoint" : "Проверка навыков");
          await expect(
            page.locator(".course-mastery-grid article"),
          ).toHaveCount(9);
          await expect(
            page.locator(".mastery-section .section-heading p"),
          ).toContainText(locale === "en" ? "0 of 3" : "0 из 3");
          await expect(
            page.locator(".course-mastery-grid article").first(),
          ).toContainText("95%");
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${width} ${locale} ${route}`,
        ).toBe(true);
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: `/private/tmp/signai-course-${width}-${locale}-${route.replaceAll(/[^a-z0-9]/gi, "-")}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  }
});
