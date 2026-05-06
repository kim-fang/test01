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

### 方式一：用 Vercel 控制台部署

1. 把代码推到 Git 仓库。
2. 在 Vercel 导入这个仓库。
3. Vercel 会自动识别这是一个 Next.js 项目，构建命令默认就是 `npm run build`。
4. 在项目的 `Storage` / `Marketplace` 里添加一个 Postgres 集成。
5. 确认环境变量里已经出现 `POSTGRES_URL`，如果你的数据库提供商给的是 `DATABASE_URL` 也可以直接使用。
6. 在数据库控制台执行 [sql/init.sql](./sql/init.sql)。
7. 如果你希望部署后就能看到演示内容，再执行 [sql/seed.sql](./sql/seed.sql)。
8. 重新触发一次部署。

### 方式二：用 Vercel CLI 部署

Vercel 官方 CLI 文档在 `2026-03-12` 的快速参考里给出的基本顺序是：`vercel link` -> `vercel env pull` -> `vercel deploy` -> `vercel deploy --prod`。

如果你本机还没有安装全局 CLI，也可以直接用 `npx`：

```bash
npx vercel@latest link
npx vercel@latest env pull .env.local
npm run db:init
npm run db:seed
npx vercel@latest deploy
npx vercel@latest deploy --prod
```

说明：

1. `link` 会把当前目录绑定到你的 Vercel 项目。
2. `env pull` 会把 Vercel 上的环境变量拉到本地，方便你执行数据库初始化脚本。
3. `db:init` 负责建表。
4. `db:seed` 是可选的示例数据。
5. `deploy` 先发预览环境。
6. `deploy --prod` 再发正式环境。

### 当前项目的部署准备

这个仓库已经具备下面这些上线准备：

- `vercel.json` 已声明 `nextjs` 框架
- `.vercelignore` 已避免把本地构建产物和本地环境变量上传
- `.env.example` 已提供环境变量模板
- `npm run db:init` 和 `npm run db:seed` 已准备好
- `npm run build` 已本地验证通过

## 官方参考

- Vercel MCP 文档：https://vercel.com/docs/agent-resources/vercel-mcp
- Vercel Postgres 文档：https://vercel.com/docs/postgres
- Vercel CLI 概览：https://vercel.com/docs/cli
- Vercel CLI 部署指南：https://vercel.com/docs/projects/deploy-from-cli
- Neon Vercel 迁移指南：https://neon.com/docs/guides/vercel-postgres-transition-guide
