# Vercel 留言板示例

一个可以直接部署到 Vercel 的 Next.js 全栈项目，包含：

- 前端页面：留言列表 + 新增 / 查看 / 编辑 / 删除
- 后端接口：Next.js App Router API Routes
- 数据库：Postgres（兼容 Vercel Marketplace 提供的 Postgres 集成）
- 数据脚本：完整建表 SQL + 初始化脚本

## 技术栈

- Next.js 16
- React 19
- TypeScript
- `@neondatabase/serverless`
- Zod

## 项目结构

```text
.
├─ app
│  ├─ api
│  │  └─ messages
│  │     ├─ [id]
│  │     │  └─ route.ts
│  │     └─ route.ts
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
├─ components
│  └─ message-board.tsx
├─ lib
│  ├─ db.ts
│  ├─ messages.ts
│  ├─ types.ts
│  └─ validation.ts
├─ scripts
│  └─ init-db.mjs
├─ sql
│  └─ init.sql
├─ .env.example
├─ .gitignore
├─ eslint.config.mjs
├─ next.config.ts
├─ package.json
├─ README.md
└─ tsconfig.json
```

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 创建环境变量文件

```bash
copy .env.example .env.local
```

3. 把你的数据库连接串填进 `.env.local`

```env
POSTGRES_URL="postgres://username:password@host:5432/database?sslmode=require"
```

4. 初始化数据库

```bash
npm run db:init
```

5. 可选：插入示例数据

```bash
npm run db:seed
```

6. 启动开发环境

```bash
npm run dev
```

## API 说明

### `GET /api/messages`

获取全部留言列表。

### `POST /api/messages`

创建留言，请求体：

```json
{
  "name": "Alice",
  "content": "Hello Vercel!"
}
```

### `GET /api/messages/:id`

获取单条留言。

### `PUT /api/messages/:id`

更新留言，请求体：

```json
{
  "name": "Alice",
  "content": "Updated content"
}
```

### `DELETE /api/messages/:id`

删除留言。

## 数据库 SQL

完整 SQL 在 [sql/init.sql](./sql/init.sql)：

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(80) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_created_at_idx
  ON messages (created_at DESC);

CREATE OR REPLACE FUNCTION set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_set_timestamp ON messages;

CREATE TRIGGER messages_set_timestamp
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION set_timestamp();
```

## 部署到 Vercel

截至 `2026-04-28`，Vercel 官方文档说明原来的 “Vercel Postgres” 已不再对新项目开放，新的做法是在 Vercel 项目里添加 Postgres 集成（通常来自 Vercel Marketplace，例如 Neon）。这个项目已经按当前推荐方式接入了 Neon 的服务端驱动，同时兼容 `POSTGRES_URL` / `DATABASE_URL`。

部署步骤：

1. 把代码推到 Git 仓库。
2. 在 Vercel 导入这个项目。
3. 在项目的 Storage / Marketplace 里添加一个 Postgres 集成。
4. 确认环境变量里已经有 `POSTGRES_URL`，如果你的提供商给的是 `DATABASE_URL` 也可以直接用。
5. 在本地或数据库控制台执行 `sql/init.sql`，或者先拉取环境变量后运行：

```bash
npm run db:init
```

6. 如果你希望一部署就看到演示内容，可以再执行：

```bash
npm run db:seed
```

7. 重新部署项目。

## 官方参考

- Vercel MCP 文档：https://vercel.com/docs/agent-resources/vercel-mcp
- Vercel Postgres 文档：https://vercel.com/docs/postgres
- Neon Vercel 迁移指南：https://neon.com/docs/guides/vercel-postgres-transition-guide
