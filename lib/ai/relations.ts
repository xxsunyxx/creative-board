export type RelationType = {
  label: string;
  description: string;
};

export const RELATION_TYPES: RelationType[] = [
  { label: "因果", description: "A 导致 B / B 导致 A / 共同导致 C" },
  { label: "相关", description: "A 与 B 同涨同落，但未必因果" },
  { label: "类比", description: "A 像 B，可把机制迁移过去" },
  { label: "条件", description: "在什么条件下 A 促进 / 抑制 B" },
  { label: "约束", description: "成本、资源、法规、伦理、场景、能力" },
  { label: "转化", description: "A 的某个属性转化为 B 的价值" },
  { label: "组合", description: "A + B 形成新功能、新产品、新场景" },
  { label: "对立/张力", description: "冲突、制衡、替代" },
  { label: "尺度映射", description: "个体层映射到组织层 / 社会层" },
];

const keywordHints: { pattern: RegExp; label: string }[] = [
  { pattern: /成本|资源|预算|法规|伦理|能力/, label: "约束" },
  { pattern: /导致|影响|因为|所以|驱动|造成/, label: "因果" },
  { pattern: /像|类似|类比|迁移/, label: "类比" },
  { pattern: /条件|前提|何时|场景/, label: "条件" },
  { pattern: /组合|结合|叠加|产品/, label: "组合" },
  { pattern: /冲突|矛盾|替代|制衡/, label: "对立/张力" },
];

export function recommendRelationTypes(text: string): RelationType[] {
  const matched = keywordHints
    .filter((hint) => hint.pattern.test(text))
    .map((hint) => RELATION_TYPES.find((type) => type.label === hint.label))
    .filter((type): type is RelationType => Boolean(type));

  const fallback = RELATION_TYPES.filter(
    (type) => !matched.some((item) => item.label === type.label),
  );

  return [...matched, ...fallback].slice(0, 4);
}
