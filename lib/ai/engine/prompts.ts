import type { NoteRole } from "@/lib/canvas-types";
import type { InferenceContext } from "./types";

const roleInstructions: Record<NoteRole, string> = {
  inspiration:
    "这是一个灵感节点。补一个能推进下游节点的灵感、前提、素材或关键问题。不要空泛，尽量具体。",
  process:
    "这是一个过程节点。补一个中间机制、因果链或转化过程。优先使用入线维度框里的关系类型和已选维度；不要只重复两端标题。",
  result:
    "这是一个结果节点。综合入线节点，输出一个结论，并给出 2-3 条支撑理由。不要引入上下文里没有的新事实；证据不足时明确标注「假设」。",
  blank:
    "这是一个空白节点。先根据入线 / 出线判断它更像灵感、过程还是结果，再生成内容。",
};

export function buildSystemPrompt(role: NoteRole) {
  return `你是「创意画布」的推理引擎，负责补全画布上的一个便签。

只输出一个 JSON 对象，不要 Markdown 代码块，不要任何解释。JSON 必须有这些字段：
- nodeId: string，必须等于输入里的 node.id
- role: "inspiration" | "process" | "result"
- title: string，可选，12 字以内
- content: string，10-800 字，中文
- confidence: number，0 到 1

规则：
- 只补当前节点的内容，不要创建新节点，不要改连接线，不要改维度框。
- 不要编造上下文里没有的具体数据、引用或人物。
- 内容要能被用户继续编辑和追问。
- ${roleInstructions[role]}`;
}

export function buildUserPrompt(context: InferenceContext) {
  return `画布上下文（只包含当前节点和 1 跳邻居）：
${JSON.stringify(context, null, 2)}

请为 node.id = "${context.node.id}" 生成内容。只输出 JSON。`;
}

export const noteOutputSchema = {
  type: "object",
  properties: {
    nodeId: { type: "string" },
    role: {
      type: "string",
      enum: ["inspiration", "process", "result"],
    },
    title: { type: "string" },
    content: { type: "string" },
    confidence: { type: "number" },
  },
  required: ["nodeId", "role", "content", "confidence"],
  additionalProperties: false,
};
