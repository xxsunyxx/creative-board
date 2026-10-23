import M0Canvas from "@/components/m0-canvas";

export default function M0Page() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">M0 · 画布技术验证</p>
          <h1>连接线 + 多维度 chip</h1>
          <p className="subtitle">
            拖动节点、缩放画布，点线上的 chip 展开维度树，或点「＋
            维度框」追加一个。
          </p>
        </div>
        <div className="checklist" aria-label="验证清单">
          <span>① 多 chip</span>
          <span>② 点击展开</span>
          <span>③ 拖拽跟随</span>
          <span>④ 缩放 / 平移</span>
        </div>
      </header>
      <section className="canvas-wrap">
        <M0Canvas />
      </section>
    </main>
  );
}
