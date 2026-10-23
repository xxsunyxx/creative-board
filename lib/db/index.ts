import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const dbPath =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "app.db");

mkdirSync(path.dirname(dbPath), { recursive: true });

type SqliteDatabase = InstanceType<typeof Database>;

const globalForDb = globalThis as typeof globalThis & {
  __creativeBoardSqlite?: SqliteDatabase;
};

const sqlite = globalForDb.__creativeBoardSqlite ?? new Database(dbPath);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__creativeBoardSqlite = sqlite;
}

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
