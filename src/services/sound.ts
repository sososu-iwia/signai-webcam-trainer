let context: AudioContext | null = null;
let enabled = true;
try {
  enabled = localStorage.getItem("signai-sound") !== "off";
} catch {
  enabled = true;
}
export const soundEnabled = () => enabled;
export function armSuccessAudio() {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
  } catch {
    context = null;
  }
}
export function toggleSound() {
  enabled = !enabled;
  if (enabled) armSuccessAudio();
  try {
    localStorage.setItem("signai-sound", enabled ? "on" : "off");
  } catch {
    return enabled;
  }
  return enabled;
}
export function playSuccess() {
  if (!enabled || !context || context.state !== "running") return;
  try {
    const now = context.currentTime;
    for (const [index, frequency] of [523.25, 659.25, 783.99].entries()) {
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + index * 0.075);
      gain.gain.linearRampToValueAtTime(0.035, now + index * 0.075 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.075 + 0.22);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + index * 0.075);
      oscillator.stop(now + index * 0.075 + 0.25);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    }
  } catch {
    closeSuccessAudio();
  }
}
export function closeSuccessAudio() {
  const previous = context;
  context = null;
  try {
    if (previous && previous.state !== "closed")
      void previous.close().catch(() => {});
  } catch {
    return;
  }
}

let users = 0;
export function retainSuccessAudio() {
  users++;
}
export function releaseSuccessAudio() {
  users = Math.max(0, users - 1);
  queueMicrotask(() => {
    if (users === 0) closeSuccessAudio();
  });
}
