import { completionKey } from "../../shared/learning";
import {
  attemptSchema,
  emptyProgress,
  progressSchema,
  resultSchema,
  type Attempt,
  type LessonResult,
  type Progress,
} from "../../shared/schema";
const STORAGE_KEY = "signai-progress-v1";
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/+$/,
  "",
);
interface Saved {
  progress: Progress;
  pendingAttempts: string[];
  pendingResults: string[];
}
let memory: Saved = {
  progress: emptyProgress,
  pendingAttempts: [],
  pendingResults: [],
};
let storageAvailable = true;
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "progress" in parsed) {
      const progress = progressSchema.parse(parsed.progress);
      const pendingAttempts =
        "pendingAttempts" in parsed && Array.isArray(parsed.pendingAttempts)
          ? parsed.pendingAttempts.filter(
              (id): id is string => typeof id === "string",
            )
          : [];
      const pendingResults =
        "pendingResults" in parsed && Array.isArray(parsed.pendingResults)
          ? parsed.pendingResults.filter(
              (id): id is string => typeof id === "string",
            )
          : [];
      memory = { progress, pendingAttempts, pendingResults };
    }
  }
} catch {
  storageAvailable = false;
}
const listeners = new Set<() => void>();
type SyncStatus = "saved" | "syncing" | "offline" | "memory";
let status: SyncStatus = storageAvailable ? "saved" : "memory";
let snapshot: Saved & { status: SyncStatus } = { ...memory, status };
function publish() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  if (!storageAvailable) status = "memory";
  snapshot = { ...memory, status };
  listeners.forEach((listener) => listener());
}
export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getSnapshot = () => snapshot;
const merge = <T extends { id: string; createdAt: string }>(a: T[], b: T[]) =>
  [...new Map([...a, ...b].map((item) => [item.id, item])).values()].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
export function saveAttempt(attempt: Attempt) {
  attemptSchema.parse(attempt);
  if (memory.progress.attempts.some((saved) => saved.id === attempt.id)) return;
  memory = {
    ...memory,
    progress: {
      ...memory.progress,
      attempts: merge(memory.progress.attempts, [attempt]),
    },
    pendingAttempts: [...new Set([...memory.pendingAttempts, attempt.id])],
  };
  publish();
  void syncProgress();
}
export function saveResult(result: LessonResult) {
  resultSchema.parse(result);
  if (
    memory.progress.results.some(
      (saved) =>
        saved.id === result.id ||
        completionKey(saved) === completionKey(result),
    )
  )
    return;
  memory = {
    ...memory,
    progress: {
      attempts: merge(memory.progress.attempts, result.attempts),
      results: merge(memory.progress.results, [result]),
    },
    pendingResults: [...new Set([...memory.pendingResults, result.id])],
  };
  publish();
  void syncProgress();
}
async function request(path: string, body?: unknown) {
  const response = await fetch(`${API_BASE}/${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Sync unavailable");
  return response.json() as Promise<unknown>;
}
let syncing: Promise<void> | null = null;
let resetting = false;
export function syncProgress(): Promise<void> {
  if (resetting) return Promise.resolve();
  if (syncing) return syncing;
  syncing = (async () => {
    status = "syncing";
    publish();
    try {
      do {
        while (memory.pendingAttempts.length || memory.pendingResults.length) {
          const attemptId = memory.pendingAttempts[0];
          if (attemptId) {
            const attempt = memory.progress.attempts.find(
              (a) => a.id === attemptId,
            );
            if (attempt) await request("attempts", attempt);
            memory = {
              ...memory,
              pendingAttempts: memory.pendingAttempts.filter(
                (id) => id !== attemptId,
              ),
            };
          } else {
            const resultId = memory.pendingResults[0];
            const result = memory.progress.results.find(
              (r) => r.id === resultId,
            );
            if (result) await request("lesson-results", result);
            memory = {
              ...memory,
              pendingResults: memory.pendingResults.filter(
                (id) => id !== resultId,
              ),
            };
          }
          publish();
        }
        const remote = progressSchema.parse(await request("progress"));
        memory = {
          ...memory,
          progress: {
            attempts: merge(remote.attempts, memory.progress.attempts),
            results: merge(remote.results, memory.progress.results),
          },
        };
      } while (memory.pendingAttempts.length || memory.pendingResults.length);
      status = "saved";
    } catch {
      status = "offline";
    } finally {
      publish();
      syncing = null;
    }
  })();
  return syncing;
}

export async function resetDemoProgress() {
  if (!import.meta.env.DEV)
    throw new Error("Reset is only available in development.");
  if (resetting) return;
  resetting = true;
  try {
    await syncing;
    const response = await fetch(`${API_BASE}/dev/reset`, {
      method: "POST",
      headers: { "X-SignAI-Reset": "demo" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok)
      throw new Error(
        "Start the development API and try again. Your progress has been kept.",
      );
    memory = {
      progress: { attempts: [], results: [] },
      pendingAttempts: [],
      pendingResults: [],
    };
    status = "saved";
    publish();
  } finally {
    resetting = false;
  }
}
