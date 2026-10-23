import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

const db = new Database(":memory:");
const files = readdirSync("drizzle")
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const file of files) {
  const sql = readFileSync(join("drizzle", file), "utf8");

  for (const statement of sql.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed) {
      db.exec(trimmed);
    }
  }
}

const columns = db
  .prepare("pragma table_info(canvas_nodes)")
  .all()
  .map((column) => column.name);

if (!columns.includes("role_locked")) {
  throw new Error("canvas_nodes.role_locked missing after migrations");
}

const tables = new Set(
  db
    .prepare("select name from sqlite_master where type = 'table'")
    .all()
    .map((table) => table.name),
);

for (const table of ["inference_runs", "inference_patches", "ai_usage"]) {
  if (!tables.has(table)) {
    throw new Error(`${table} missing after migrations`);
  }
}

console.log(
  JSON.stringify({
    ok: true,
    migrations: files,
    canvasNodeColumns: columns.length,
    inferenceTables: true,
  }),
);

db.close();
