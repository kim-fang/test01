import { neon } from "@neondatabase/serverless";

export function getConnectionString() {
  return (
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    ""
  );
}

export function ensureConnectionString() {
  const connectionString = getConnectionString();

  if (!connectionString) {
    throw new Error(
      "未找到数据库连接。请在 Vercel 项目里添加 Postgres 集成，或在 .env.local 中配置 POSTGRES_URL / DATABASE_URL。",
    );
  }

  return connectionString;
}

export function getSql() {
  return neon(ensureConnectionString());
}
