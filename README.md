# Creative Board

一个私有的 AI 创意 / 研究工作台：灵感库收集和融合素材，画布上用连接线和维度框建立多层关系，输出节点生成结果，最后沉淀为 Markdown 文档。

当前阶段：**M0 画布技术验证已通过**。React Flow 方案可行，准备进入 M1。

## 本地运行

```bash
pnpm install
pnpm dev
```

打开 http://localhost:3000。

## M0 验证

先保持 dev server 运行，再执行：

```bash
pnpm check:m0
```

脚本会用本机 Chrome / Edge 跑一遍：

- 节点 / 连线 / 多维度 chip 渲染
- chip 打开 popover、选择细节回写
- 拖动节点 chip 跟随
- 缩放 / 平移
- 动态追加维度 chip

Chrome 路径可以用 `CHROME_PATH` 环境变量指定。

## 计划与讨论

产品定义、核心机制、交互、数据模型、技术方案都在 [`plan/`](plan/README.md)。

## 技术栈

- Next.js 16 + React 19 + TypeScript
- React Flow（`@xyflow/react`）
- SQLite + Drizzle（M1 接入）
- AI provider 可切换，M0 阶段用 mock
