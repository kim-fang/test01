import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const connectionString =
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
  throw new Error(
    "Missing POSTGRES_URL or DATABASE_URL. Add your Postgres connection string before running db:seed.",
  );
}

const sql = neon(connectionString);

await sql`
  INSERT INTO messages (name, content)
  VALUES
    ('Vercel 团队', '欢迎使用这个 Next.js 全栈留言板示例。'),
    ('产品经理', '这里已经接好了前端 CRUD、API 和 Postgres。'),
    ('开发者', '你可以直接在当前项目基础上继续扩展权限、搜索和分页。');
`;

console.log("Database seeded successfully.");
