"use client";

import {
  RELATION_TYPES,
  recommendRelationTypes,
} from "@/lib/ai/relations";

export function RelationshipPicker({
  open,
  mode,
  context,
  onSelect,
  onLucky,
  onCancel,
}: {
  open: boolean;
  mode: "new" | "add";
  context: string;
  onSelect: (label: string, lucky?: boolean) => void;
  onLucky: () => void;
  onCancel: () => void;
}) {
  if (!open) {
    return null;
  }

  const recommended = recommendRelationTypes(context);
  const rest = RELATION_TYPES.filter(
    (type) => !recommended.some((item) => item.label === type.label),
  );

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="relationship-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="选择关系类型"
      >
        <div className="relationship-head">
          <div>
            <p className="page-kicker">Relationship</p>
            <h2>{mode === "new" ? "选择关系类型" : "再加一个维度框"}</h2>
            <p>先选关系类型，AI 会生成主维度和细节维度。</p>
          </div>
          <span className="mock-badge">mock AI</span>
        </div>

        <section className="relationship-section">
          <h3>AI 推荐</h3>
          <div className="relation-grid">
            {recommended.map((type) => (
              <button
                key={type.label}
                type="button"
                className="relation-card"
                onClick={() => onSelect(type.label)}
              >
                <strong>{type.label}</strong>
                <small>{type.description}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="relationship-section">
          <h3>全部关系</h3>
          <div className="relation-grid relation-grid-compact">
            {rest.map((type) => (
              <button
                key={type.label}
                type="button"
                className="relation-chip"
                onClick={() => onSelect(type.label)}
                title={type.description}
              >
                {type.label}
              </button>
            ))}
          </div>
        </section>

        <div className="modal-actions">
          <button
            type="button"
            className="mini-button lucky-button"
            onClick={onLucky}
          >
            🎲 Lucky
          </button>
          <button type="button" className="mini-button" onClick={onCancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
