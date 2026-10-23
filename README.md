# Creative Board

一个私有的 AI 创意 / 研究工作台：灵感库收集和融合素材，画布上用连接线、维度框和「一种便签、四种角色」建立多层关系，空便签推理补全，结果节点沉淀为 Markdown 文档。

当前阶段：**E1 推理引擎骨架已通过**。下一步 M5b：结果输出与文档。

## 本地运行

```bash
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

打开 http://localhost:3000。

首次运行需要 `db:push` + `db:seed`；已有 `data/app.db` 时 seed 会自动跳过。

## 页面

- `/inspirations`：灵感库（新增、关键词、融合、发送到画布）
- `/canvases`：画布列表（读取 + 新建 + 节点数）
- `/canvases/[id]`：画布详情（默认全屏、一种便签 + 四种角色、空便签推理、过程拆分、Lucky、撤销、本次/画布 tokens）
- `/documents`：文档列表 + Markdown 详情
- `/settings`：AI 设置（OpenAI / Claude / DeepSeek，测试后选模型，Key 只存本机 localStorage）
- `/api/health`：数据库计数
- `/m0`：M0 画布技术验证

## 验证

```bash
pnpm typecheck
pnpm build
pnpm db:check
pnpm check:m0
pnpm check:m1
pnpm check:m2
pnpm check:m3
pnpm check:m4
pnpm check:m5
pnpm check:engine
pnpm check:settings
```

`check:*` 需要 dev server 正在运行，并会调用本机 Chrome / Edge；可用 `CHROME_PATH` 指定浏览器路径。

## 数据库

- SQLite 文件：`data/app.db`（不进 Git）
- Schema：`lib/db/schema.ts`
- 迁移：`drizzle/`
- 命令：`db:generate` / `db:push` / `db:migrate` / `db:seed` / `db:studio`

## 计划与讨论

产品定义、核心机制、交互、数据模型、技术方案都在 [`plan/`](plan/README.md)。

## 技术栈

- Next.js 16.4 + React 19.3 + TypeScript
- React Flow（`@xyflow/react` 12.12）
- Dagre（自动排布）
- SQLite + Drizzle ORM 0.45
- AI provider 可切换，当前阶段用 mock
