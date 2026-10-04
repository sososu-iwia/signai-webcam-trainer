import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());
describe("optional success audio", () => {
  it("cannot interrupt completion when an audio device fails", async () => {
    vi.resetModules();
    vi.stubGlobal("localStorage", { getItem: () => null });
    const close = vi.fn(async () => {});
    vi.stubGlobal(
      "AudioContext",
      class {
        state = "running";
        currentTime = 0;
        resume = async () => {};
        close = close;
        createOscillator() {
          throw new DOMException(
            "Audio output unavailable",
            "InvalidStateError",
          );
        }
      },
    );
    const sound = await import("../src/services/sound");
    sound.armSuccessAudio();
    expect(() => sound.playSuccess()).not.toThrow();
    expect(close).toHaveBeenCalledOnce();
    expect(() => sound.playSuccess()).not.toThrow();
  });
  it("tolerates missing AudioContext and remembers mute preference", async () => {
    vi.resetModules();
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => stored.get(key) || null,
      setItem: (key: string, value: string) => stored.set(key, value),
    });
    vi.stubGlobal("AudioContext", undefined);
    const sound = await import("../src/services/sound");
    expect(() => {
      sound.armSuccessAudio();
      sound.playSuccess();
      sound.closeSuccessAudio();
    }).not.toThrow();
    expect(sound.toggleSound()).toBe(false);
    vi.resetModules();
    expect((await import("../src/services/sound")).soundEnabled()).toBe(false);
  });
});
