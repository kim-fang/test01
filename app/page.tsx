import { MessageBoard } from "@/components/message-board";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Next.js + Vercel + Postgres</span>
          <h1>可直接部署的全栈留言板</h1>
          <p>
            这个示例包含完整的前端 CRUD 界面、Next.js API 接口、Postgres
            建表脚本，以及适合部署到 Vercel 的项目结构。
          </p>
        </div>

        <div className="hero-metrics">
          <div className="metric-card">
            <strong>4</strong>
            <span>CRUD 操作</span>
          </div>
          <div className="metric-card">
            <strong>2</strong>
            <span>API 路由</span>
          </div>
          <div className="metric-card">
            <strong>1</strong>
            <span>SQL 建表脚本</span>
          </div>
        </div>
      </section>

      <MessageBoard />
    </main>
  );
}
