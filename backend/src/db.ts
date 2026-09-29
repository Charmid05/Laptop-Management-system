import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..", "..");

export const dbFile = process.env.DATABASE_FILE
  ? resolve(process.env.DATABASE_FILE)
  : join(projectRoot, "db", "practice.db");

export const schemaFile = join(projectRoot, "db", "schema.sql");

mkdirSync(dirname(dbFile), { recursive: true });

export const db = new DatabaseSync(dbFile);
db.exec(readFileSync(schemaFile, "utf8"));

export type Row = Record<string, string | number | bigint | null | Uint8Array>;

export function all(sql: string, ...params: (string | number | null)[]): Row[] {
  return db.prepare(sql).all(...params) as Row[];
}

export function one(sql: string, ...params: (string | number | null)[]): Row | undefined {
  return db.prepare(sql).get(...params) as Row | undefined;
}

export function run(sql: string, ...params: (string | number | null)[]): void {
  db.prepare(sql).run(...params);
}

let depth = 0;

/** Re-entrant: nested calls join the outermost transaction. */
export function transaction<T>(fn: () => T): T {
  if (depth > 0) {
    depth += 1;
    try {
      return fn();
    } finally {
      depth -= 1;
    }
  }
  db.exec("BEGIN");
  depth = 1;
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    depth = 0;
  }
}
