# 万能导入下单系统

一个可直接部署到 Vercel 的 Next.js 全栈项目，面向物流批量下单场景，支持多模板 Excel 自动识别、手动映射、模板记忆、预览编辑、导出、提交入库和历史运单查询。

## 公开地址

- 在线访问：`https://vercel-message-board-kim.vercel.app`
- Git 仓库：`https://github.com/kim-fang/test01`

## 亮点

- 自动识别中文 / 英文表头、列序变化、说明页、多 Sheet、合并单元格
- 手动列映射 + 模板记忆学习
- 预览表格支持逐格编辑、回车 / Tab 连续录入、行内错误提示
- 全量错误一次性展示，支持重复编码批次内和历史库双重检查
- 导出当前预览结果为 Excel
- 提交后写入 Vercel Postgres 兼容数据库
- 历史运单支持筛选和分页

## 技术栈

- Next.js App Router
- TypeScript
- Vercel Postgres / Neon 兼容驱动
- SheetJS (`xlsx`)
- Zod

## 本地运行

```bash
npm install
npm run db:init
npm run dev
```

## 环境变量

复制 `.env.example` 为 `.env.local`，填写数据库连接串。

## 数据库

- 建表脚本：[`sql/init.sql`](./sql/init.sql)
- 示例数据：[`sql/seed.sql`](./sql/seed.sql)

## 交互细节

- 点击单元格即可编辑
- `Enter` / `Tab` 会切换到下一格，`Shift + Tab` 返回上一格
- 错误单元格会高亮并显示行内提示
- 导入、提交、导出都有进度或 loading 提示

## 边界处理

- 空文件、坏文件、无有效 Sheet 都会给出明确错误
- 选填字段缺失不会阻断导入
- 重复外部编码会同时检查本批次和历史库
- 历史查询支持开始 / 结束日期筛选，开始日期不能晚于结束日期

