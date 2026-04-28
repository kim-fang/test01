import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import dotenv from "dotenv";
import ws from "ws";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const sqlPath = resolve(process.cwd(), "sql", "init.sql");
const initSql = await readFile(sqlPath, "utf8");
const connectionString =
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
  throw new Error(
    "Missing POSTGRES_URL or DATABASE_URL. Add your Postgres connection string before running db:init.",
  );
}

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString });
const client = await pool.connect();

try {
  await client.query(initSql);
  console.log("Database initialized successfully.");
} finally {
  client.release();
  await pool.end();
}
