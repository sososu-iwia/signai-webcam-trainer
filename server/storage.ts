import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  attemptSchema,
  resultSchema,
  type Attempt,
  type LessonResult,
  type Progress,
} from "../shared/schema.js";
import { completionKey, uniqueResults } from "../shared/learning.js";
export class Store {
  private db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS results (id TEXT PRIMARY KEY, body TEXT NOT NULL);",
    );
  }
  attempts(): Attempt[] {
    return this.db
      .prepare("SELECT body FROM attempts ORDER BY rowid DESC")
      .all()
      .map((r) => attemptSchema.parse(JSON.parse(String(r.body))));
  }
  results(): LessonResult[] {
    return this.db
      .prepare("SELECT body FROM results ORDER BY rowid DESC")
      .all()
      .map((r) => resultSchema.parse(JSON.parse(String(r.body))));
  }
  progress(): Progress {
    return {
      attempts: this.attempts(),
      results: uniqueResults(this.results()).reverse(),
    };
  }
  addAttempt(attempt: Attempt) {
    this.db
      .prepare(
        "INSERT INTO attempts (id, body) VALUES (?, ?) ON CONFLICT(id) DO NOTHING",
      )
      .run(attempt.id, JSON.stringify(attempt));
  }
  addResult(result: LessonResult) {
    this.db.exec("BEGIN");
    try {
      const existing = this.results().find(
        (saved) =>
          saved.id === result.id ||
          completionKey(saved) === completionKey(result),
      );
      if (existing) {
        this.db.exec("COMMIT");
        return existing;
      }
      for (const attempt of result.attempts) this.addAttempt(attempt);
      this.db
        .prepare(
          "INSERT INTO results (id, body) VALUES (?, ?) ON CONFLICT(id) DO NOTHING",
        )
        .run(result.id, JSON.stringify(result));
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  reset() {
    this.db.exec("BEGIN; DELETE FROM results; DELETE FROM attempts; COMMIT;");
  }
  close() {
    this.db.close();
  }
}
