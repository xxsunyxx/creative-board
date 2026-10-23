import type { NoteRole } from "@/lib/canvas-types";
import type {
  ContextNeighbor,
  InferenceContext,
} from "./types";

const roleLabels: Record<NoteRole, string> = {
  inspiration: "灵感",
  process: "过程",
  result: "结果",
  blank: "空白",
};

const roleInstructions: Record<NoteRole, string> = {
  inspiration: `这是一个灵感节点。先判断它属于哪种情况，再写：
A. 已有对象：标题或提示指向一个现实存在的概念、案例、现象、方法或人。
   - 第一句直接说它是什么，给它一个清楚的边界。
   - 再写它的关键特质、运作方式、适用条件，以及它为什么和当前画布有关。
   - 只写你有把握的部分；不确定就明确说「我理解它通常指……」，不要编造来源或数据。
B. 未知对象：你不知道它是否已经存在，或当前材料里明显缺一个还不存在的东西。
   - 先用一个工作名给它命名。标题里写这个名字，2-8 个字，尽量是具体的名词短语，让人能说「这是一个____」。
   - 不要用「赋能」「闭环」「生态」「体系」这类没有定义的空词；如果非用不可，先解释它具体指什么。
   - 第一段说清它是什么类别、不是什么。
   - 第二段写 3-4 个可观察的特质，不要只堆形容词。
   - 第三段写它的流程：什么触发它，中间发生了什么变化，最后产出什么；再写它在什么条件下成立、什么时候失效。
   - 明确标注「暂命名 / 待验证」，不要把它说成已经存在的公认事实。
判断规则：
- 标题是具体名词、已有概念或用户问「这是什么 / 有哪些」→ 按已存在写。
- 标题是「空灵感」，或上下文明显缺一个机制、角色、工具、空间、规则 → 按未知对象写。
- 不确定时选更保守的一类，并在正文里说明你的假设。`,
  process:
    "写一段机制解释。不要只把两端的标题拼在一起；要说明中间发生了什么、为什么发生。尽量出现「先……再……」「因为……所以……」「如果……就……」这样的中间步骤。",
  result:
    "写一段有逻辑的短论证。先点出真正起作用的变量或冲突，再至少经过一个中间机制解释它为什么导致这个结果，最后给出成立条件或边界。不要从前提直接跳到结论，不要只复述输入，也不要用「都很重要」这种和稀泥结论。可以写成「不是 A 直接导致 B，而是 A 先改变了 X，X 再影响 B」这样的链。如果入线之间缺少中间过程，不要硬下结论；先指出缺口，再写目前能说到哪一步。结构示例（只学逻辑，不要照抄内容）：增加选项不会自动提升决策质量；它先扩大了可比较的范围，却同时提高了取舍成本，只有在评价标准清晰时，更多选项才带来更好的决策，否则只会拖延。",
  blank:
    "先根据入线 / 出线判断它更像灵感、过程还是结果，再写内容。",
};

const relationGuidance: Record<string, string> = {
  因果: "它通过什么机制导致或影响当前便签？",
  相关: "它们如何共同变化？相关不等于因果，真正的驱动因素是什么？",
  类比: "它像什么？相似点在哪里，哪里又不成立？",
  条件: "在什么条件下成立，什么条件下会失效？",
  约束: "它限制了什么？哪些做法因此不可行？",
  转化: "它如何一步步变成当前便签？中间经过了什么？",
  组合: "它们组合后形成了什么新东西？",
  "对立/张力": "冲突在哪里？哪一方在什么条件下占上风？",
  尺度映射: "个体层的机制如何映射到组织层或社会层？",
};

function relationHint(neighbor: ContextNeighbor) {
  const relations = neighbor.edge.relationTypes.filter(Boolean);
  const focuses = neighbor.edge.selectedPaths.filter(Boolean);

  if (relations.length === 0) {
    return "这条线还没有选关系类型；请根据两端内容判断最合理的推理方向。";
  }

  const guidance = relations
    .map((relation) => relationGuidance[relation] ?? "它们之间是什么关系？")
    .filter(Boolean)
    .join("；");
  const focus =
    focuses.length > 0
      ? `这次可以从「${focuses.join("、")}」这个角度想，但不要把这个短语原样写进正文。`
      : "这次还没有选具体角度；直接回答上面的问题，不要套话。";

  return `${relations.join(" / ")}。${guidance} ${focus}`;
}

function formatNeighbor(neighbor: ContextNeighbor, direction: "in" | "out") {
  const content = neighbor.content.trim() || "（还没有内容）";
  const prefix = direction === "in" ? "影响当前便签" : "被当前便签影响";

  return `- 「${neighbor.title || "未命名便签"}」（${roleLabels[neighbor.role]}，权重 ${neighbor.weight}，${prefix}）
  它现在的内容：${content}
  这条线的关系：${relationHint(neighbor)}`;
}

function formatNeighbors(
  neighbors: ContextNeighbor[],
  direction: "in" | "out",
) {
  if (neighbors.length === 0) {
    return "（没有直接相邻的便签）";
  }

  return neighbors
    .map((neighbor) => formatNeighbor(neighbor, direction))
    .join("\n");
}

export function buildSystemPrompt(role: NoteRole) {
  return `你是「创意画布」的推理引擎，负责补全画布上的一个便签。

只输出一个 JSON 对象，不要 Markdown 代码块，不要任何解释。JSON 必须有这些字段：
- nodeId: string，必须等于输入里的 node.id
- role: "inspiration" | "process" | "result"
- title: string，可选，尽量是自然、具体的短标题
- content: string，中文正文
- confidence: number，0 到 1

写作要求：
- 像人在研究笔记或同事讨论里写东西，不像报告模板。
- 先给判断或解释，再展开；句子之间要有因果、转折、条件或对比关系。
- 不要用「结论：」「理由1：」「首先 / 其次 / 最后」「综合来看」这类模板开头。
- 不要出现「维度」「入线」「出线」「关系类型」「已选维度」这些系统词。
- 关系类型和维度名只是推理角度，不是正文素材。不要把它们原样搬进正文；要自然地说出你在解释什么。正文里如果出现提示词里的关系名或角度短语，就是抄格式，请删掉重写。
- 避免「必然」「一定会」「任何一种」「所有」这类绝对化表达；用条件、范围和「取决于」把话说准。
- 不编造具体数据、引用、人物或案例；不确定就写「可能」「取决于」「在……条件下」。
- 正文长度：已知灵感 150-350 字；未知 / 暂命名灵感 250-500 字；过程 150-350 字；结果 200-450 字。能说清就停，不要凑字数。
- 写成 1-3 段自然中文；不要小标题、不要项目符号；结果和过程尽量写成一段。
- 如果写的是未知对象，title 必须填你给它的工作名；如果是已有对象，保留它原本的名字。
- 只写 JSON，不要 JSON 之外的任何内容。
- ${roleInstructions[role]}`;
}

export function buildUserPrompt(context: InferenceContext) {
  const hint = context.hint.trim() || "（没有额外提示，以画布目标为准）";
  const description =
    context.canvas.description.trim() || "（画布没有填写描述）";
  const currentContent =
    context.node.content.trim() || "（空白，等待补全）";
  const task =
    context.node.role === "result"
      ? "把入线当成论证材料，写成一段有中间机制的结论：在什么条件下，什么变量通过什么过程导致了什么结果？如果入线之间是条件、冲突或互相限制的关系，先说清它们如何相互作用，不要把它们并列成两个理由。如果缺少中间过程，先指出缺了什么，不要强行编一个结论。不要写放之四海而皆准的万能结论。"
      : context.node.role === "process"
        ? "把入线和出线看成一条链，写成一段机制解释：中间发生了什么，为什么它会把两端连起来？不要只复述两端。"
        : "先判断它是已有对象还是未知对象：已有对象直接说它是什么；未知对象给它一个工作名，写清类别、可观察特质、流程和边界，并标注「暂命名 / 待验证」。不要写口号，也不要把它伪装成公认事实。";

  return `下面是一张正在成形的画布。请只根据这些信息，为当前便签写内容。

## 画布
名称：${context.canvas.name || "未命名画布"}
目标：${description}
本次提示：${hint}

## 当前便签
角色：${roleLabels[context.node.role]}
标题：${context.node.title || "未命名便签"}
权重：${context.node.weight}
已有内容：${currentContent}
node.id：${context.node.id}（只用于 JSON 回填，不要写进正文）

## 谁在影响当前便签（入线）
${formatNeighbors(context.incoming, "in")}

## 当前便签影响谁（出线）
${formatNeighbors(context.outgoing, "out")}

## 写作任务
${task}

把关系当成推理角度，不要复述关系名称或维度名称。正文要像人真的想过之后写出来的，而不是把上面的字段翻译一遍。只输出 JSON。`;
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
