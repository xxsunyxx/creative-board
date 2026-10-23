export type KeywordInput = {
  title: string;
  content?: string | null;
};

export type MergeInput = KeywordInput & {
  keywords: string[];
};

const STOP_WORDS = new Set([
  "的",
  "了",
  "但",
  "和",
  "与",
  "是",
  "在",
  "有",
  "也",
  "就",
  "都",
  "而",
  "及",
  "或",
  "一个",
  "一种",
  "这个",
  "那个",
  "我们",
  "他们",
]);

const LEADING_WORDS =
  /^(但是|但|而且|并且|所以|因为|如果|可以|需要|通过|对于|关于|以及|还有|同时|然后)/;

export function extractKeywords(input: KeywordInput): string[] {
  const title = input.title.trim();
  const segments = (input.content ?? "")
    .split(/[，。、；：！？\n,.;:!?()（）【】\[\]“”"'’·]+/g)
    .map((part) => part.trim())
    .map((part) => part.replace(LEADING_WORDS, "").trim())
    .filter((part) => part.length >= 2 && part.length <= 12)
    .filter((part) => !STOP_WORDS.has(part))
    .filter((part) => part !== title);

  return Array.from(new Set([title, ...segments].filter(Boolean))).slice(0, 5);
}

export function mergeInspirations(a: MergeInput, b: MergeInput) {
  const keywords = Array.from(
    new Set([...a.keywords, ...b.keywords]),
  ).slice(0, 8);

  return {
    title: `${a.title} × ${b.title}`,
    content: [
      `融合自「${a.title}」与「${b.title}」。`,
      "",
      `A · ${a.content || "暂无内容"}`,
      "",
      `B · ${b.content || "暂无内容"}`,
      "",
      "待整理：找出共同点、差异，以及可以继续推进的方向。",
    ].join("\n"),
    keywords,
  };
}
