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
  INSERT INTO messages (
    code,
    name,
    branch_type,
    service_type,
    organization_type,
    status,
    anomaly_status,
    owner_organization,
    hub_center,
    province,
    department,
    content
  )
  VALUES
    (
      '021114',
      '上海宝山江阳市场窗口',
      '一级网点',
      '寄件服务',
      '市场部',
      '正常',
      '正常',
      '上海市场部',
      '上海分拨中心',
      '上海市',
      '市场运营',
      '欢迎使用这个 Next.js 网点管理后台示例。'
    ),
    (
      '471178',
      '呼和浩特新城一部',
      '二级网点',
      '冷链运输',
      '承包区',
      '筹备中',
      '筹备期',
      '呼和浩特事业网点',
      '郑州分拨中心',
      '内蒙古',
      '客服中心',
      '这里已经接好了前端列表、导入校验和 Postgres 数据存储。'
    ),
    (
      '778004',
      '河池环江网点',
      '一级网点',
      '仓配服务',
      '一级网点',
      '正常',
      '观察中',
      '南京分拨中心',
      '南京分拨中心',
      '江苏省',
      '直营网格',
      '你可以继续扩展搜索、分页、权限控制和日志追踪。'
    );
`;

console.log("Database seeded successfully.");
