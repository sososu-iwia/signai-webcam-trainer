import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { en, type MessageKey } from "../src/i18n/en";
import { ru } from "../src/i18n/ru";
import {
  displayText,
  initialLanguage,
  languageStorageKey,
  plural,
  setLanguage,
  translate,
} from "../src/i18n";
import { gestures, lesson } from "../shared/catalog";
import { learningPath } from "../shared/learning";
import { evaluateGesture } from "../src/gesture-engine/evaluateGesture";
import { fixture } from "./fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
});
describe("interface localization", () => {
  it("detects Russian deterministically and respects either stored choice", () => {
    expect(initialLanguage(null, "ru-RU")).toBe("ru");
    expect(initialLanguage(null, "RU-kz")).toBe("ru");
    expect(initialLanguage(null, "fr-FR")).toBe("en");
    expect(initialLanguage(null, "")).toBe("en");
    expect(initialLanguage("en", "ru-RU")).toBe("en");
    expect(initialLanguage("ru", "en-US")).toBe("ru");
    expect(initialLanguage("invalid", "ru")).toBe("ru");
  });
  it("has complete dictionaries and identical interpolation parameters", () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as MessageKey[]) {
      expect(ru[key].trim(), key).not.toBe("");
      expect(ru[key].match(/\{\w+\}/g)?.sort() || [], key).toEqual(
        en[key].match(/\{\w+\}/g)?.sort() || [],
      );
    }
    expect(
      translate("ru", "{0} complete. {1} is ready for you.", {
        0: "Разминка",
        1: "Открытая ладонь",
      }),
    ).toBe("Занятие «Разминка» завершено. Доступно занятие «Открытая ладонь».");
  });
  it("covers every catalog and learning path display value", () => {
    const messages = [
      lesson.title,
      lesson.description,
      lesson.duration,
      lesson.level,
      ...learningPath.flatMap((n) => [n.title, n.description]),
      ...gestures.flatMap((g) => [
        g.label,
        g.shortInstruction,
        g.difficulty,
        ...g.tips,
        g.reference.view,
        g.reference.description,
      ]),
    ];
    for (const message of messages) {
      expect(Object.hasOwn(en, message), message).toBe(true);
      expect(displayText("ru", message), message).toMatch(/[А-Яа-яЁё]/);
    }
  });
  it("covers camera failures, coaching states and every finger correction", () => {
    for (const file of [
      "src/camera/useCamera.ts",
      "src/camera/tracking.worker.ts",
      "src/hooks/useCoach.ts",
      "src/gesture-engine/trackingQuality.ts",
      "src/gesture-engine/stability.ts",
      "src/gesture-engine/evaluateGesture.ts",
    ]) {
      const ast = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      const walk = (node: ts.Node) => {
        if (ts.isStringLiteral(node) && /^[A-Z].*\s/.test(node.text)) {
          expect(Object.hasOwn(en, node.text), `${file}: ${node.text}`).toBe(
            true,
          );
        }
        ts.forEachChild(node, walk);
      };
      walk(ast);
    }
    for (const finger of ["index", "middle", "ring", "little"])
      for (const verb of ["Straighten", "Fold"])
        expect(displayText("ru", `${verb} your ${finger} finger.`)).toMatch(
          /^(Выпрями|Согни)/,
        );
    expect(displayText("ru", "Straighten your index finger.")).toBe(
      "Выпрями указательный палец.",
    );
    expect(displayText("ru", "Fold your middle finger.")).toBe(
      "Согни средний палец.",
    );
  });
  it("uses Russian and English plural rules, including teens and 21", () => {
    expect(
      [0, 1, 2, 5, 11, 21, 22, 25].map((n) => plural("ru", "day", n)),
    ).toEqual([
      "0 дней",
      "1 день",
      "2 дня",
      "5 дней",
      "11 дней",
      "21 день",
      "22 дня",
      "25 дней",
    ]);
    expect(plural("ru", "attempt", 22)).toBe("22 попытки");
    expect(plural("ru", "session", 11)).toBe("11 занятий завершено");
    expect(plural("en", "day", 1)).toBe("1 day");
    expect(plural("en", "day", 2)).toBe("2 days");
  });
  it("persists only the language preference and tolerates unavailable storage", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem });
    setLanguage("ru");
    expect(setItem).toHaveBeenCalledExactlyOnceWith(languageStorageKey, "ru");
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => setLanguage("en")).not.toThrow();
  });
  it("does not mutate gesture IDs, targets, thresholds or recognition", () => {
    const before = JSON.stringify(gestures);
    for (const gesture of gestures) {
      const expected = evaluateGesture(fixture(gesture.id), gesture);
      setLanguage("ru");
      displayText("ru", gesture.label);
      expect(evaluateGesture(fixture(gesture.id), gesture)).toEqual(expected);
      setLanguage("en");
    }
    expect(JSON.stringify(gestures)).toBe(before);
    expect(gestures.map((g) => g.id)).toEqual(["fist", "palm", "victory"]);
  });
});
