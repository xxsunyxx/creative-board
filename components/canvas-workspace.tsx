"use client";

import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MiniMap,
  NodeResizer,
  Position,
  ReactFlow,
  useEdgesState,
  useInternalNode,
  useNodesState,
  type Connection as FlowConnection,
  type EdgeProps,
  type EdgeTypes,
  type NodeChange,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import Link from "next/link";
import {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import dagre from "@dagrejs/dagre";
import { RelationshipPicker } from "@/components/relationship-picker";
import {
  deleteCanvasNode,
  saveNodeNote,
  updateNodeColor,
  updateNodePosition,
  updateNodePositions,
  updateNodeSize,
  updateNodeWeight,
} from "@/lib/actions/canvas";
import {
  addDimensionNode,
  createConnection as createConnectionAction,
  createDimensionGroup,
  deleteConnection as deleteConnectionAction,
  deleteDimensionGroup,
  selectDimension,
} from "@/lib/actions/edges";
import {
  clearNodeContent,
  createNote,
  exportNodeToDocument,
  insertProcessOnConnection,
  saveNodeToInspiration,
  updateNoteContent,
  updateNoteRole,
} from "@/lib/actions/canvas";
import type {
  InferencePatchDto,
  TokenUsage,
} from "@/lib/ai/engine/types";
import { readAiConfig } from "@/lib/ai/providers";
import type {
  CanvasNodeData,
  CanvasNodeType,
  DimensionEdgeData,
  DimensionEdgeType,
  DimensionGroupData,
  DimensionNodeData,
  NoteRole,
} from "@/lib/canvas-types";
import { RELATION_TYPES } from "@/lib/ai/relations";
import "@xyflow/react/dist/style.css";

const palette = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#64748b",
];

type CanvasActions = {
  updateWeight: (id: string, weight: number) => void;
  updateColor: (id: string, color: string) => void;
  resizeNode: (id: string, width: number, height: number) => void;
  updateRole: (id: string, role: NoteRole) => void;
  updateContent: (id: string, content: string) => Promise<void>;
  saveNote: (id: string, note: string) => Promise<number>;
  deleteNode: (id: string) => void;
  insertProcess: (connectionId: string) => void;
  clearContent: (id: string) => void;
  saveToInspiration: (id: string) => void;
  exportDocument: (id: string) => void;
  requestAddGroup: (connectionId: string) => void;
  selectedDimension: { connectionId: string; groupId: string } | null;
  selectDimensionChip: (connectionId: string, groupId: string) => void;
  clearDimensionChip: () => void;
  selectDimension: (
    connectionId: string,
    groupId: string,
    dimensionId: string,
  ) => void;
  addDimension: (
    connectionId: string,
    groupId: string,
    parentId: string | null,
    label: string,
  ) => void;
  deleteGroup: (connectionId: string, groupId: string) => void;
  deleteConnection: (connectionId: string) => void;
};

const CanvasActionsContext = createContext<CanvasActions | null>(null);

function InspirationNode({ id, data, selected }: NodeProps<CanvasNodeType>) {
  const actions = useContext(CanvasActionsContext);
  const [weight, setWeight] = useState(data.weight);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(data.note);
  const [savingNote, setSavingNote] = useState(false);
  const [contentOpen, setContentOpen] = useState(false);
  const [contentDraft, setContentDraft] = useState(data.content);
  const [savingContent, setSavingContent] = useState(false);

  if (!actions) {
    return null;
  }

  const commitWeight = () => {
    const next = Math.max(1, Math.min(9, Math.round(weight || data.weight)));
    setWeight(next);
    actions.updateWeight(id, next);
  };

  const commitNote = async () => {
    setSavingNote(true);
    try {
      await actions.saveNote(id, noteDraft);
      setNoteOpen(false);
    } finally {
      setSavingNote(false);
    }
  };

  const commitContent = async () => {
    setSavingContent(true);
    try {
      await actions.updateContent(id, contentDraft);
      setContentOpen(false);
    } finally {
      setSavingContent(false);
    }
  };

  return (
    <div
      className={`canvas-node role-${data.role}`}
      style={{ "--node-color": data.color } as CSSProperties}
    >
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="canvas-handle canvas-handle-top"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="canvas-handle canvas-handle-source canvas-handle-right"
        title="拖到另一个便签上建立连接"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="canvas-handle canvas-handle-bottom"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="canvas-handle canvas-handle-left"
      />

      <NodeResizer
        isVisible={selected}
        minWidth={180}
        minHeight={120}
        maxWidth={520}
        maxHeight={480}
        color={data.color}
        handleClassName="canvas-resize-handle"
        lineClassName="canvas-resize-line"
        onResizeEnd={(_, params) =>
          actions.resizeNode(id, params.width, params.height)
        }
      />

      <div
        className="canvas-note-paper"
        style={{ borderWidth: 1 + Math.round((data.weight - 1) / 3) }}
      >

        <div className="canvas-node-top">
          <button
            type="button"
            className="canvas-color-button nodrag"
            style={{ background: data.color }}
            onClick={() => setPaletteOpen((open) => !open)}
            title="更换颜色"
            aria-label="更换颜色"
          />
          <span className="canvas-node-title">{data.title}</span>
          <input
            className="canvas-weight nodrag"
            type="number"
            min={1}
            max={9}
            value={weight}
            title="权重 1-9"
            onChange={(event) => setWeight(Number(event.target.value))}
            onBlur={commitWeight}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
          {!data.sourceInspirationId ? (
            <button
              type="button"
              className="node-action node-clear nodrag"
            onClick={() => {
              if (window.confirm("清空这个便签的正文？")) {
                actions.clearContent(id);
              }
            }}
            title="清空正文"
            aria-label="清空正文"
            disabled={!data.content.trim()}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m7 21-4-4 10-10 4 4-10 10Z" />
              <path d="M22 21H7" />
            </svg>
          </button>
          ) : null}
          <button
            type="button"
            className="node-action node-delete nodrag"
            onClick={() => {
              if (window.confirm("删除这个便签？灵感库条目会保留。")) {
                actions.deleteNode(id);
              }
            }}
            title="删除便签"
            aria-label="删除便签"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v5M14 11v5" />
            </svg>
          </button>
        </div>

        {contentOpen ? (
          <div className="content-editor nodrag nowheel">
            <textarea
              className="content-textarea"
              value={contentDraft}
              onChange={(event) => setContentDraft(event.target.value)}
              placeholder="写正文，或先留空等 AI 推理"
              rows={4}
            />
            <div className="note-actions">
              <button
                type="button"
                className="mini-button"
                onClick={() => setContentOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="button-primary button-small"
                onClick={commitContent}
                disabled={savingContent}
              >
                {savingContent ? "保存中…" : "保存正文"}
              </button>
            </div>
          </div>
        ) : (
          <p
            className="canvas-node-content nowheel"
            title="双击编辑正文"
            onDoubleClick={() => {
              setContentDraft(data.content);
              setContentOpen(true);
            }}
          >
            {data.content ||
              (data.role === "blank"
                ? "空便签 · 摆好结构后点开始推理"
                : "等待推理 · 双击编辑")}
          </p>
        )}

        <div className="canvas-node-footer">
          <select
            className={`note-role-select role-${data.role} nodrag`}
            value={data.role}
            title="便签角色"
            onChange={(event) =>
              actions.updateRole(id, event.target.value as NoteRole)
            }
          >
            <option value="inspiration">灵感</option>
            <option value="process">过程</option>
            <option value="result">结果</option>
            {!data.sourceInspirationId ? (
              <option value="blank">空白</option>
            ) : null}
          </select>
          <div className="node-footer-actions">
            {!data.sourceInspirationId ? (
              <>
                <button
                  type="button"
                  className="node-icon-button nodrag"
                  title="存入灵感库（手动）"
                  aria-label="存入灵感库"
                  disabled={!data.content.trim()}
                  onClick={() => actions.saveToInspiration(id)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                    <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="node-icon-button nodrag"
                  title="导出为文档"
                  aria-label="导出为文档"
                  disabled={!data.content.trim()}
                  onClick={() => actions.exportDocument(id)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                    <path d="M14 2v6h6" />
                    <path d="M12 18v-6" />
                    <path d="m9 15 3 3 3-3" />
                  </svg>
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="node-note-button nodrag"
              onClick={() => {
                setContentDraft(data.content);
                setContentOpen(true);
              }}
            >
              编辑
            </button>
            <button
              type="button"
              className="node-note-button nodrag"
              onClick={() => {
                setNoteDraft(data.note);
                setNoteOpen((open) => !open);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              <span>备注 {data.noteCount}</span>
            </button>
          </div>
        </div>

        {paletteOpen && (
          <div className="color-palette nodrag">
            {palette.map((color) => (
              <button
                key={color}
                type="button"
                className={`color-swatch ${
                  color === data.color ? "is-selected" : ""
                }`}
                style={{ background: color }}
                onClick={() => {
                  actions.updateColor(id, color);
                  setPaletteOpen(false);
                }}
                title={color}
                aria-label={`颜色 ${color}`}
              />
            ))}
          </div>
        )}

        {noteOpen && (
          <div className="note-editor nodrag nowheel">
            <textarea
              className="note-textarea"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="写一条备注，保存后会追加到灵感文字里"
              rows={3}
            />
            <div className="note-actions">
              <button
                type="button"
                className="mini-button"
                onClick={() => setNoteOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="button-primary button-small"
                onClick={commitNote}
                disabled={savingNote}
              >
                {savingNote ? "保存中…" : "保存备注"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };

function perimeterPoint(box: Box, toward: Point): Point {
  const center = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;

  if (dx === 0 && dy === 0) {
    return center;
  }

  const scaleX =
    dx === 0 ? Number.POSITIVE_INFINITY : box.width / 2 / Math.abs(dx);
  const scaleY =
    dy === 0 ? Number.POSITIVE_INFINITY : box.height / 2 / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);

  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
}

function cubicPoint(
  p0: Point,
  c1: Point,
  c2: Point,
  p3: Point,
  t: number,
): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p3.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p3.y,
  };
}

function cubicTangent(
  p0: Point,
  c1: Point,
  c2: Point,
  p3: Point,
  t: number,
): Point {
  const mt = 1 - t;
  const a = 3 * mt * mt;
  const b = 6 * mt * t;
  const c = 3 * t * t;
  return {
    x: a * (c1.x - p0.x) + b * (c2.x - c1.x) + c * (p3.x - c2.x),
    y: a * (c1.y - p0.y) + b * (c2.y - c1.y) + c * (p3.y - c2.y),
  };
}

function childrenOf(group: DimensionGroupData, parentId: string | null) {
  return group.nodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

function selectedPath(group: DimensionGroupData) {
  const selected = group.nodes.find((node) => node.selected);

  if (!selected) {
    return "待选择";
  }

  const labels = [selected.label];
  let parentId = selected.parentId;

  while (parentId) {
    const parent = group.nodes.find((node) => node.id === parentId);
    if (!parent) {
      break;
    }
    labels.unshift(parent.label);
    parentId = parent.parentId;
  }

  return labels.join(" / ");
}

function DimensionBranch({
  node,
  group,
  depth,
  expanded,
  onToggle,
  onSelect,
  onAdd,
}: {
  node: DimensionNodeData;
  group: DimensionGroupData;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onAdd: (parentId: string, label: string) => void;
}) {
  const children = childrenOf(group, node.id);
  const isExpanded = expanded.has(node.id);
  const isSelected = group.nodes.find((item) => item.selected)?.id === node.id;

  return (
    <div className={`dim-branch dim-depth-${depth}`}>
      <div className="dim-row">
        <button
          type="button"
          className={`dim-label ${isSelected ? "is-selected" : ""}`}
          onClick={() => {
            if (children.length > 0) {
              onToggle(node.id);
            } else {
              onSelect(node.id);
            }
          }}
        >
          {node.label}
        </button>
        <button
          type="button"
          className="dim-select"
          onClick={() => onSelect(node.id)}
          title="选这个维度"
        >
          选
        </button>
        <button
          type="button"
          className="dim-add"
          onClick={() => {
            const label = window.prompt("新增子维度");
            if (label?.trim()) {
              onAdd(node.id, label.trim());
            }
          }}
          title="新增子维度"
        >
          ＋
        </button>
        {children.length > 0 ? (
          <button
            type="button"
            className="dim-toggle"
            onClick={() => onToggle(node.id)}
          >
            {isExpanded ? "−" : "+"}
          </button>
        ) : null}
      </div>

      {isExpanded && children.length > 0 ? (
        <div className="dim-children">
          {children.map((child) => (
            <DimensionBranch
              key={child.id}
              node={child}
              group={group}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              onAdd={onAdd}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DimensionGroupPanel({
  connectionId,
  group,
  actions,
  onClose,
}: {
  connectionId: string;
  group: DimensionGroupData;
  actions: CanvasActions;
  onClose: () => void;
}) {
  const roots = childrenOf(group, null);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(roots.map((node) => node.id)),
  );

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const add = (parentId: string | null, label: string) => {
    actions.addDimension(connectionId, group.id, parentId, label);
    if (parentId) {
      setExpanded((current) => new Set(current).add(parentId));
    }
  };

  return (
    <div className="dimension-popover-inner">
      <div className="popover-head">
        <span className="popover-type">{group.relationType}</span>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="关闭"
        >
          ×
        </button>
      </div>
      <div className="popover-sub">
        选一个维度；＋ 可继续加子级，支持多层
      </div>

      <div className="dim-tree">
        {roots.map((node) => (
          <DimensionBranch
            key={node.id}
            node={node}
            group={group}
            depth={0}
            expanded={expanded}
            onToggle={toggle}
            onSelect={(dimensionId) =>
              actions.selectDimension(connectionId, group.id, dimensionId)
            }
            onAdd={(parentId, label) => add(parentId, label)}
          />
        ))}
      </div>

      <div className="dim-popover-actions">
        <button
          type="button"
          className="mini-button"
          onClick={() => {
            const label = window.prompt("新增主维度");
            if (label?.trim()) {
              add(null, label.trim());
            }
          }}
        >
          ＋ 主维度
        </button>
        <button
          type="button"
          className="mini-button lucky-button"
          onClick={() => {
            const details = group.nodes.filter(
              (node) => node.level !== "main",
            );
            const pool = details.length > 0 ? details : group.nodes;
            const picked = pool[Math.floor(Math.random() * pool.length)];
            if (picked) {
              actions.selectDimension(
                connectionId,
                group.id,
                picked.id,
              );
            }
          }}
        >
          🎲 Lucky
        </button>
        <button
          type="button"
          className="mini-button"
          onClick={() => {
            actions.insertProcess(connectionId);
            onClose();
          }}
        >
          插入过程节点
        </button>
        <button
          type="button"
          className="mini-button danger"
          onClick={() => {
            if (window.confirm(`删除「${group.relationType}」维度框？`)) {
              actions.deleteGroup(connectionId, group.id);
              onClose();
            }
          }}
        >
          删除维度框
        </button>
      </div>

      <button
        type="button"
        className="dim-delete-connection"
        onClick={() => {
          if (window.confirm("删除整条连接？")) {
            actions.deleteConnection(connectionId);
          }
        }}
      >
        删除整条连接
      </button>
    </div>
  );
}

function DimensionEdge({
  id,
  data,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
}: EdgeProps<DimensionEdgeType>) {
  const actions = useContext(CanvasActionsContext);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const sourceNode = useInternalNode<CanvasNodeType>(source);
  const targetNode = useInternalNode<CanvasNodeType>(target);
  const groups = data?.groups ?? [];

  const sourceBox = sourceNode
    ? {
        x: sourceNode.internals.positionAbsolute.x,
        y: sourceNode.internals.positionAbsolute.y,
        width: sourceNode.measured?.width ?? sourceNode.width ?? 280,
        height: sourceNode.measured?.height ?? sourceNode.height ?? 200,
      }
    : null;
  const targetBox = targetNode
    ? {
        x: targetNode.internals.positionAbsolute.x,
        y: targetNode.internals.positionAbsolute.y,
        width: targetNode.measured?.width ?? targetNode.width ?? 280,
        height: targetNode.measured?.height ?? targetNode.height ?? 200,
      }
    : null;

  const sourceCenter = sourceBox
    ? {
        x: sourceBox.x + sourceBox.width / 2,
        y: sourceBox.y + sourceBox.height / 2,
      }
    : null;
  const targetCenter = targetBox
    ? {
        x: targetBox.x + targetBox.width / 2,
        y: targetBox.y + targetBox.height / 2,
      }
    : null;

  const p0 =
    sourceBox && targetCenter
      ? perimeterPoint(sourceBox, targetCenter)
      : { x: sourceX, y: sourceY };
  const p3 =
    targetBox && sourceCenter
      ? perimeterPoint(targetBox, sourceCenter)
      : { x: targetX, y: targetY };
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const c1 = horizontal
    ? { x: p0.x + dx * 0.45, y: p0.y }
    : { x: p0.x, y: p0.y + dy * 0.45 };
  const c2 = horizontal
    ? { x: p3.x - dx * 0.45, y: p3.y }
    : { x: p3.x, y: p3.y - dy * 0.45 };
  const path = `M ${p0.x},${p0.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${p3.x},${p3.y}`;

  const chipPositions = groups.map((_, index) => {
    const count = groups.length;
    const t = count === 1 ? 0.5 : 0.32 + (index / (count - 1)) * 0.36;
    const point = cubicPoint(p0, c1, c2, p3, t);
    const tangent = cubicTangent(p0, c1, c2, p3, t);
    const length = Math.hypot(tangent.x, tangent.y) || 1;
    const normal = { x: -tangent.y / length, y: tangent.x / length };
    const offset = (index % 2 === 0 ? 1 : -1) * 34;
    return {
      x: point.x + normal.x * offset,
      y: point.y + normal.y * offset,
    };
  });

  const midPoint = cubicPoint(p0, c1, c2, p3, 0.5);
  const sourceColor = data?.sourceColor ?? "#60a5fa";
  const targetColor = data?.targetColor ?? "#a78bfa";
  const gradientId = `edge-gradient-${id}`;
  const markerId = `edge-arrow-${id}`;

  if (!actions) {
    return null;
  }

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={sourceColor} />
          <stop offset="100%" stopColor={targetColor} />
        </linearGradient>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={targetColor} />
        </marker>
      </defs>
      <path className="dimension-edge-base" d={path} />
      <path className="dimension-edge-glow" d={path} stroke={sourceColor} />
      <path
        className={`dimension-edge-path ${selected ? "is-selected" : ""}`}
        d={path}
        style={{ stroke: selected ? "#ef4444" : `url(#${gradientId})` }}
        markerEnd={`url(#${markerId})`}
      />
      <path
        className="dimension-edge-flow"
        d={path}
        style={{ stroke: targetColor }}
      />
      <circle r="2.4" fill={targetColor} opacity="0.88">
        <animateMotion dur="2.8s" repeatCount="indefinite" path={path} />
      </circle>
      <circle r="1.6" fill={sourceColor} opacity="0.62">
        <animateMotion
          dur="3.8s"
          repeatCount="indefinite"
          begin="1.1s"
          path={path}
        />
      </circle>
      <EdgeLabelRenderer>
        <div
          className="edge-endpoint"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${p0.x}px, ${p0.y}px)`,
            background: sourceColor,
          }}
        />
        <div
          className="edge-endpoint"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${p3.x}px, ${p3.y}px)`,
            background: targetColor,
          }}
        />
        {groups.map((group, index) => {
          const position = chipPositions[index];
          const isOpen = openGroupId === group.id;
          const isSelected =
            actions.selectedDimension?.connectionId === id &&
            actions.selectedDimension.groupId === group.id;

          return (
            <Fragment key={group.id}>
              <div
                className={`dimension-chip-wrap ${
                  isSelected ? "is-selected" : ""
                }`}
                style={{
                  position: "absolute",
                  transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
                  pointerEvents: "all",
                }}
              >
                <button
                  type="button"
                  className={`dimension-chip nodrag nopan ${
                    isOpen ? "is-open" : ""
                  } ${isSelected ? "is-selected" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    actions.selectDimensionChip(id, group.id);
                    setOpenGroupId(isOpen ? null : group.id);
                  }}
                >
                  <span className="chip-type">{group.relationType}</span>
                  <span className="chip-value">{selectedPath(group)}</span>
                </button>
                <button
                  type="button"
                  className="dimension-chip-close nodrag nopan"
                  title="删除这个维度框"
                  aria-label={`删除维度框 ${group.relationType}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpenGroupId(null);
                    actions.deleteGroup(id, group.id);
                    actions.clearDimensionChip();
                  }}
                >
                  ×
                </button>
              </div>

              {isOpen && (
                <div
                  className="dimension-popover nodrag nopan nowheel"
                  style={{
                    position: "absolute",
                    transform: `translate(-50%, 0) translate(${position.x}px, ${position.y + 30}px)`,
                    pointerEvents: "all",
                  }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <DimensionGroupPanel
                    connectionId={id}
                    group={group}
                    actions={actions}
                    onClose={() => setOpenGroupId(null)}
                  />
                </div>
              )}
            </Fragment>
          );
        })}

        <button
          type="button"
          className="edge-add nodrag nopan"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${midPoint.x}px, ${midPoint.y + 78}px)`,
            pointerEvents: "all",
          }}
          onClick={(event) => {
            event.stopPropagation();
            actions.requestAddGroup(id);
          }}
          title="在同一条线上增加一个维度框"
        >
          ＋ 维度框
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { note: InspirationNode } as NodeTypes;
const edgeTypes = { dimension: DimensionEdge } as EdgeTypes;

const roleTitles: Record<NoteRole, string> = {
  inspiration: "空灵感",
  process: "过程",
  result: "空结果",
  blank: "空便签",
};

const defaultRoleTitles = new Set(Object.values(roleTitles));

type NotePayload = {
  id: string;
  role: NoteRole;
  title: string;
  content: string;
  weight: number;
  color: string;
  note: string;
  roleLocked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

function noteToCanvasNode(note: NotePayload): CanvasNodeType {
  return {
    id: note.id,
    type: "note",
    position: { x: note.x, y: note.y },
    width: note.width,
    height: note.height,
    data: {
      title: note.title,
      content: note.content,
      weight: note.weight,
      color: note.color,
      note: note.note,
      noteCount: 0,
      sourceInspirationId: null,
      role: note.role,
      roleLocked: note.roleLocked,
    },
  };
}

export default function CanvasWorkspace({
  canvasId,
  initialNodes,
  initialEdges,
  initialCanvasTokens = 0,
  initialLastRunId = null,
}: {
  canvasId: string;
  initialNodes: CanvasNodeType[];
  initialEdges: DimensionEdgeType[];
  initialCanvasTokens?: number;
  initialLastRunId?: string | null;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [picker, setPicker] = useState<{
    connectionId: string;
    mode: "new" | "add";
  } | null>(null);
  const [insertRole, setInsertRole] = useState<NoteRole>("blank");
  const [inferring, setInferring] = useState(false);
  const [inferMessage, setInferMessage] = useState("");
  const [inferHint, setInferHint] = useState("");
  const [selectedDimension, setSelectedDimension] = useState<{
    connectionId: string;
    groupId: string;
  } | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(
    initialLastRunId,
  );
  const [lastUsage, setLastUsage] = useState<TokenUsage | null>(null);
  const [canvasTokens, setCanvasTokens] = useState(initialCanvasTokens);
  const flowRef =
    useRef<ReactFlowInstance<CanvasNodeType, DimensionEdgeType> | null>(null);

  const handleNodesChange = (changes: NodeChange<CanvasNodeType>[]) => {
    onNodesChange(changes);

    for (const change of changes) {
      if (
        change.type === "position" &&
        change.dragging === false &&
        change.position
      ) {
        void updateNodePosition(
          change.id,
          change.position.x,
          change.position.y,
        );
      }
    }
  };

  const actions = useMemo<CanvasActions>(
    () => ({
      updateWeight: (id, weight) => {
        const next = Math.max(1, Math.min(9, Math.round(weight)));
        setNodes((current) =>
          current.map((node) =>
            node.id === id
              ? { ...node, data: { ...node.data, weight: next } }
              : node,
          ),
        );
        void updateNodeWeight(id, next);
      },
      updateColor: (id, color) => {
        setNodes((current) =>
          current.map((node) =>
            node.id === id
              ? { ...node, data: { ...node.data, color } }
              : node,
          ),
        );
        void updateNodeColor(id, color);
      },
      resizeNode: (id, width, height) => {
        void updateNodeSize(id, width, height);
      },
      updateRole: (id, role) => {
        setNodes((current) =>
          current.map((node) =>
            node.id === id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    role,
                    roleLocked: true,
                    title: defaultRoleTitles.has(node.data.title)
                      ? roleTitles[role]
                      : node.data.title,
                  },
                }
              : node,
          ),
        );
        void updateNoteRole(id, role);
      },
      updateContent: async (id, content) => {
        await updateNoteContent(id, content);
        setNodes((current) =>
          current.map((node) =>
            node.id === id
              ? { ...node, data: { ...node.data, content: content.trim() } }
              : node,
          ),
        );
      },
      insertProcess: (connectionId) => {
        void (async () => {
          const result = await insertProcessOnConnection(connectionId);
          if (!result) {
            return;
          }

          setNodes((current) => [
            ...current,
            noteToCanvasNode(result.processNote),
          ]);
          setEdges((current) => {
            const oldEdge = current.find(
              (edge) => edge.id === connectionId,
            );
            if (!oldEdge) {
              return current;
            }
            const oldData = oldEdge.data as
              | DimensionEdgeData
              | undefined;
            const first: DimensionEdgeType = {
              id: result.firstConnectionId,
              source: oldEdge.source,
              target: result.processNote.id,
              type: "dimension",
              data: {
                groups: oldData?.groups ?? [],
                sourceColor: oldData?.sourceColor,
                targetColor: result.processNote.color,
              },
            };
            const second: DimensionEdgeType = {
              id: result.secondConnectionId,
              source: result.processNote.id,
              target: oldEdge.target,
              type: "dimension",
              data: {
                groups: [],
                sourceColor: result.processNote.color,
                targetColor: oldData?.targetColor,
              },
            };
            return [
              ...current.filter((edge) => edge.id !== connectionId),
              first,
              second,
            ];
          });
        })();
      },
      clearContent: (id) => {
        setNodes((current) =>
          current.map((node) =>
            node.id === id
              ? { ...node, data: { ...node.data, content: "" } }
              : node,
          ),
        );
        void clearNodeContent(id);
        setInferMessage("已清空便签正文");
      },
      saveToInspiration: (id) => {
        void (async () => {
          const result = await saveNodeToInspiration(id);
          if (!result.ok) {
            setInferMessage(result.error ?? "存入灵感库失败");
            return;
          }
          setInferMessage(
            result.existed
              ? `灵感库已有「${result.title}」`
              : `已存入灵感库 · ${result.title}`,
          );
        })();
      },
      exportDocument: (id) => {
        void (async () => {
          const result = await exportNodeToDocument(id);
          if (!result.ok) {
            setInferMessage(result.error ?? "导出文档失败");
            return;
          }
          setInferMessage(`文档已生成 · ${result.title}`);
        })();
      },
      saveNote: async (id, note) => {
        const result = await saveNodeNote(id, note);
        setNodes((current) =>
          current.map((node) =>
            node.id === id
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    note: note.trim(),
                    noteCount: result.noteCount,
                  },
                }
              : node,
          ),
        );
        return result.noteCount;
      },
      deleteNode: (id) => {
        setNodes((current) => current.filter((node) => node.id !== id));
        setEdges((current) =>
          current.filter(
            (edge) => edge.source !== id && edge.target !== id,
          ),
        );
        void deleteCanvasNode(id);
      },
      requestAddGroup: (connectionId) => {
        setPicker({ connectionId, mode: "add" });
      },
      selectedDimension,
      selectDimensionChip: (connectionId, groupId) => {
        setSelectedDimension({ connectionId, groupId });
      },
      clearDimensionChip: () => {
        setSelectedDimension(null);
      },
      selectDimension: (connectionId, groupId, dimensionId) => {
        setEdges((current) =>
          current.map((edge) => {
            if (edge.id !== connectionId) {
              return edge;
            }
            const edgeData = edge.data as DimensionEdgeData | undefined;
            return {
              ...edge,
              data: {
                groups: (edgeData?.groups ?? []).map((group) =>
                  group.id === groupId
                    ? {
                        ...group,
                        nodes: group.nodes.map((node) => ({
                          ...node,
                          selected: node.id === dimensionId,
                        })),
                      }
                    : group,
                ),
              },
            };
          }),
        );
        void selectDimension(connectionId, groupId, dimensionId);
      },
      addDimension: (connectionId, groupId, parentId, label) => {
        void (async () => {
          const result = await addDimensionNode(groupId, parentId, label);
          if (!result) {
            return;
          }
          setEdges((current) =>
            current.map((edge) => {
              if (edge.id !== connectionId) {
                return edge;
              }
              const edgeData = edge.data as DimensionEdgeData | undefined;
              return {
                ...edge,
                data: {
                  groups: (edgeData?.groups ?? []).map((group) =>
                    group.id === groupId
                      ? {
                          ...group,
                          nodes: [...group.nodes, result.node],
                        }
                      : group,
                  ),
                },
              };
            }),
          );
        })();
      },
      deleteGroup: (connectionId, groupId) => {
        setSelectedDimension((current) =>
          current?.groupId === groupId ? null : current,
        );
        setEdges((current) =>
          current.map((edge) => {
            if (edge.id !== connectionId) {
              return edge;
            }
            const edgeData = edge.data as DimensionEdgeData | undefined;
            return {
              ...edge,
              data: {
                groups: (edgeData?.groups ?? []).filter(
                  (group) => group.id !== groupId,
                ),
              },
            };
          }),
        );
        void deleteDimensionGroup(connectionId, groupId);
      },
      deleteConnection: (connectionId) => {
        setSelectedDimension((current) =>
          current?.connectionId === connectionId ? null : current,
        );
        setEdges((current) =>
          current.filter((edge) => edge.id !== connectionId),
        );
        void deleteConnectionAction(connectionId);
      },
    }),
    [selectedDimension, setEdges, setNodes],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable='true']",
        )
      ) {
        return;
      }

      if (selectedDimension) {
        event.preventDefault();
        event.stopPropagation();
        actions.deleteGroup(
          selectedDimension.connectionId,
          selectedDimension.groupId,
        );
        setSelectedDimension(null);
        return;
      }

      const selectedIds = edges
        .filter((edge) => edge.selected)
        .map((edge) => edge.id);

      if (selectedIds.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      for (const edgeId of selectedIds) {
        actions.deleteConnection(edgeId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actions, edges, selectedDimension]);

  const handleConnect = (connection: FlowConnection) => {
    if (
      !connection.source ||
      !connection.target ||
      connection.source === connection.target
    ) {
      return;
    }

    void (async () => {
      const result = await createConnectionAction(
        canvasId,
        connection.source!,
        connection.target!,
      );
      if (!result) {
        return;
      }

      const edge: DimensionEdgeType = {
        id: result.connectionId,
        source: connection.source!,
        target: connection.target!,
        type: "dimension",
        data: { groups: [] },
      };

      setEdges((current) => [...current, edge]);
      setPicker({ connectionId: result.connectionId, mode: "new" });
    })();
  };

  const handlePickRelation = async (
    relationType: string,
    lucky = false,
  ) => {
    if (!picker) {
      return;
    }

    const result = await createDimensionGroup(
      picker.connectionId,
      relationType,
    );

    if (result) {
      let groups = result.group;

      if (lucky) {
        const detailNodes = groups.nodes.filter(
          (node) => node.level !== "main",
        );
        const pool = detailNodes.length > 0 ? detailNodes : groups.nodes;
        const picked = pool[Math.floor(Math.random() * pool.length)];

        if (picked) {
          await selectDimension(
            picker.connectionId,
            groups.id,
            picked.id,
          );
          groups = {
            ...groups,
            nodes: groups.nodes.map((node) => ({
              ...node,
              selected: node.id === picked.id,
            })),
          };
        }
      }

      setEdges((current) =>
        current.map((edge) => {
          if (edge.id !== picker.connectionId) {
            return edge;
          }
          const edgeData = edge.data as DimensionEdgeData | undefined;
          return {
            ...edge,
            data: {
              groups: [...(edgeData?.groups ?? []), groups],
            },
          };
        }),
      );
    }

    setPicker(null);
  };

  const handleCancelPicker = () => {
    if (!picker) {
      return;
    }

    if (picker.mode === "new") {
      setEdges((current) =>
        current.filter((edge) => edge.id !== picker.connectionId),
      );
      void deleteConnectionAction(picker.connectionId);
    }

    setPicker(null);
  };

  const handleAutoLayout = () => {
    if (nodes.length === 0) {
      return;
    }

    const width = 280;
    const height = 180;
    let next: CanvasNodeType[];

    if (edges.length === 0) {
      const columns = Math.ceil(Math.sqrt(nodes.length));
      next = nodes.map((node, index) => ({
        ...node,
        position: {
          x: 80 + (index % columns) * 340,
          y: 80 + Math.floor(index / columns) * 240,
        },
      }));
    } else {
      const graph = new dagre.graphlib.Graph();
      graph.setDefaultEdgeLabel(() => ({}));
      graph.setGraph({
        rankdir: "LR",
        nodesep: 120,
        ranksep: 220,
        marginx: 40,
        marginy: 40,
      });

      for (const node of nodes) {
        graph.setNode(node.id, { width, height });
      }
      for (const edge of edges) {
        graph.setEdge(edge.source, edge.target);
      }

      dagre.layout(graph);

      next = nodes.map((node) => {
        const position = graph.node(node.id);
        return {
          ...node,
          position: {
            x: position.x - width / 2,
            y: position.y - height / 2,
          },
        };
      });
    }

    setNodes(next);
    void updateNodePositions(
      next.map((node) => ({
        id: node.id,
        x: node.position.x,
        y: node.position.y,
      })),
    );
    window.setTimeout(() => {
      flowRef.current?.fitView({ padding: 0.2, maxZoom: 1.2 });
    }, 80);
  };

  const handleInsertNote = () => {
    void (async () => {
      const position = flowRef.current?.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      }) ?? { x: 200, y: 200 };
      const offset = nodes.length * 24;
      const note = await createNote(
        canvasId,
        insertRole,
        position.x + offset,
        position.y + offset,
      );

      if (!note) {
        return;
      }

      setNodes((current) => [...current, noteToCanvasNode(note)]);
    })();
  };

  const applyNodePatches = (
    patches: InferencePatchDto[],
    useBefore = false,
  ) => {
    const fieldsByNode = new Map(
      patches.map((patch) => [
        patch.nodeId,
        useBefore ? patch.before : patch.after,
      ]),
    );

    setNodes((current) =>
      current.map((node) => {
        const fields = fieldsByNode.get(node.id);
        return fields
          ? {
              ...node,
              data: {
                ...node.data,
                role: fields.role,
                title: fields.title,
                content: fields.content,
                roleLocked: fields.roleLocked,
              },
            }
          : node;
      }),
    );
  };

  const handleInferAll = () => {
    void (async () => {
      const config = readAiConfig();

      if (config && (!config.apiKey.trim() || !config.model.trim())) {
        setInferMessage("请先在 AI 设置里测试连接并选择模型");
        return;
      }

      const provider = config?.provider ?? "mock";
      const apiKey = config?.apiKey ?? "";
      const model = config?.model ?? "";

      setInferring(true);
      setInferMessage("");
      setLastRunId(null);
      setLastUsage(null);

      try {
        const response = await fetch("/api/ai/infer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            canvasId,
            hint: inferHint.trim(),
            provider,
            model,
            apiKey,
          }),
        });
        const result = (await response.json()) as
          | {
              ok: true;
              runId: string;
              status: "succeeded" | "partial" | "failed";
              patches: InferencePatchDto[];
              usage: TokenUsage;
              canvasTokens: number;
              errors: string[];
            }
          | { ok: false; error: string };

        if (!response.ok || !result.ok) {
          setInferMessage(
            result.ok ? "推理失败" : (result.error ?? "推理失败"),
          );
          return;
        }

        applyNodePatches(result.patches);
        setLastRunId(result.patches.length > 0 ? result.runId : null);
        setLastUsage(result.usage);
        setCanvasTokens(result.canvasTokens);

        if (result.status === "failed") {
          setInferMessage(
            `推理失败：${result.errors[0] ?? "未知错误"}`,
          );
          return;
        }

        const mockLabel = provider === "mock" ? "（mock）" : "";
        const errorLabel =
          result.errors.length > 0
            ? ` · ${result.errors.length} 个失败`
            : "";
        setInferMessage(
          result.patches.length > 0
            ? `已推理 ${result.patches.length} 个空便签${mockLabel} · ${result.usage.totalTokens} tokens${errorLabel}`
            : "没有空便签",
        );
      } catch (error) {
        setInferMessage(
          error instanceof Error ? error.message : "推理失败",
        );
      } finally {
        setInferring(false);
      }
    })();
  };

  const handleUndoInference = () => {
    if (!lastRunId) {
      return;
    }

    void (async () => {
      setInferMessage("正在撤销…");

      try {
        const response = await fetch("/api/ai/infer/undo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: lastRunId }),
        });
        const result = (await response.json()) as
          | {
              ok: true;
              runId: string;
              patches: InferencePatchDto[];
              canvasTokens: number;
            }
          | { ok: false; error: string };

        if (!response.ok || !result.ok) {
          setInferMessage(
            result.ok ? "撤销失败" : (result.error ?? "撤销失败"),
          );
          return;
        }

        applyNodePatches(result.patches, true);
        setLastRunId(null);
        setCanvasTokens(result.canvasTokens);
        setInferMessage(`已撤销 ${result.patches.length} 个便签`);
      } catch (error) {
        setInferMessage(
          error instanceof Error ? error.message : "撤销失败",
        );
      }
    })();
  };

  const pickerEdge = picker
    ? edges.find((edge) => edge.id === picker.connectionId)
    : null;
  const pickerSource = pickerEdge
    ? nodes.find((node) => node.id === pickerEdge.source)
    : null;
  const pickerTarget = pickerEdge
    ? nodes.find((node) => node.id === pickerEdge.target)
    : null;
  const pickerContext = `${pickerSource?.data.title ?? ""} ${
    pickerTarget?.data.title ?? ""
  }`;

  return (
    <CanvasActionsContext.Provider value={actions}>
      <div className="canvas-stage">
        <div className="canvas-hint">
          拖动便签调整位置 · 四边圆点拉线 · 选中连线按 Delete 删除 ·{" "}
          {nodes.length} 便签 · {edges.length} 连接
        </div>
        <button
          type="button"
          className="canvas-auto-layout"
          onClick={handleAutoLayout}
        >
          自动排布
        </button>

        <div className="canvas-insert-bar">
          <select
            className="canvas-insert-select"
            value={insertRole}
            onChange={(event) =>
              setInsertRole(event.target.value as NoteRole)
            }
            title="插入什么角色"
          >
            <option value="blank">空便签</option>
            <option value="inspiration">空灵感</option>
            <option value="process">空过程</option>
            <option value="result">空结果</option>
          </select>
          <button
            type="button"
            className="canvas-tool"
            onClick={handleInsertNote}
          >
            ＋ 插入
          </button>
          <input
            className="canvas-hint-input"
            value={inferHint}
            onChange={(event) => setInferHint(event.target.value)}
            placeholder="本次提示（可选）"
            maxLength={300}
            title="一句话告诉 AI 这次想解决什么"
          />
          <button
            type="button"
            className="canvas-tool canvas-infer"
            onClick={handleInferAll}
            disabled={inferring}
            title="未配置 AI 时使用 mock 推理"
          >
            {inferring ? "推理中…" : "开始推理"}
          </button>
          {lastRunId ? (
            <button
              type="button"
              className="canvas-tool"
              onClick={handleUndoInference}
            >
              撤销
            </button>
          ) : null}
          <span className="canvas-board-stats">
            {nodes.length} 便签 · {edges.length} 连接
          </span>
          <span className="canvas-token-stats">
            {lastUsage
              ? `本次 ${lastUsage.totalTokens} tok · `
              : ""}
            画布 {canvasTokens} tok
          </span>
          {inferMessage ? (
            <span className="canvas-infer-status">{inferMessage}</span>
          ) : null}
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onInit={(instance) => {
            flowRef.current = instance;
          }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={null}
          snapToGrid
          snapGrid={[20, 20]}
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
          minZoom={0.35}
          maxZoom={1.8}
          connectionLineStyle={{ stroke: "#94a3b8", strokeWidth: 2 }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1.4}
            color="#d7dee8"
          />
          <MiniMap
            pannable
            zoomable
            nodeColor={(node) =>
              (node.data as CanvasNodeData | undefined)?.color ?? "#94a3b8"
            }
          />
          <Controls />
        </ReactFlow>

        {nodes.length === 0 && (
          <div className="canvas-empty-overlay">
            <strong>这个画布还没有便签。</strong>
            <span>去灵感库选一条，发送到画布。</span>
            <Link href="/inspirations" className="text-link">
              去灵感库 →
            </Link>
          </div>
        )}

        <RelationshipPicker
          open={Boolean(picker)}
          mode={picker?.mode ?? "new"}
          context={pickerContext}
          onSelect={(label, lucky) => {
            void handlePickRelation(label, lucky);
          }}
          onLucky={() => {
            const type =
              RELATION_TYPES[
                Math.floor(Math.random() * RELATION_TYPES.length)
              ];
            void handlePickRelation(type.label, true);
          }}
          onCancel={handleCancelPicker}
        />
      </div>
    </CanvasActionsContext.Provider>
  );
}
