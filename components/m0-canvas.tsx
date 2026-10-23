"use client";

import { Fragment, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type InspirationData = {
  title: string;
  content: string;
  weight: number;
  color: string;
  noteCount: number;
};

type InspirationNodeType = Node<InspirationData, "inspiration">;

type MainDimension = {
  label: string;
  details: string[];
};

type Dimension = {
  id: string;
  relationType: string;
  selected: string;
  main: MainDimension[];
};

type DimensionEdgeData = {
  dimensions: Dimension[];
};

type DimensionEdgeType = Edge<DimensionEdgeData, "dimension">;

type Point = { x: number; y: number };

const initialNodes: InspirationNodeType[] = [
  {
    id: "a",
    type: "inspiration",
    position: { x: 40, y: 220 },
    data: {
      title: "远程办公",
      content: "降低通勤成本，但沟通变慢。",
      weight: 7,
      color: "#3b82f6",
      noteCount: 2,
    },
  },
  {
    id: "b",
    type: "inspiration",
    position: { x: 420, y: 80 },
    data: {
      title: "团队创新",
      content: "需要高频碰撞和非正式交流。",
      weight: 9,
      color: "#8b5cf6",
      noteCount: 1,
    },
  },
  {
    id: "c",
    type: "inspiration",
    position: { x: 420, y: 390 },
    data: {
      title: "AI 协作工具",
      content: "异步沟通、自动记录、降低协调成本。",
      weight: 6,
      color: "#10b981",
      noteCount: 3,
    },
  },
  {
    id: "d",
    type: "inspiration",
    position: { x: 940, y: 240 },
    data: {
      title: "组织信任",
      content: "高质量关系提升创新容错。",
      weight: 8,
      color: "#f59e0b",
      noteCount: 0,
    },
  },
];

const initialEdges: DimensionEdgeType[] = [
  {
    id: "a-b",
    source: "a",
    target: "b",
    type: "dimension",
    data: {
      dimensions: [
        {
          id: "a-b-constraint",
          relationType: "约束",
          selected: "成本 / 人力成本",
          main: [
            { label: "成本", details: ["人力成本", "时间成本", "沟通成本"] },
            { label: "资源", details: ["预算", "工具", "人力"] },
            { label: "法规", details: ["合规", "数据安全"] },
          ],
        },
        {
          id: "a-b-condition",
          relationType: "条件",
          selected: "同步频率 / 每日",
          main: [
            { label: "同步频率", details: ["每日", "每周", "异步"] },
            { label: "团队规模", details: ["小团队", "跨部门"] },
          ],
        },
      ],
    },
  },
  {
    id: "a-c",
    source: "a",
    target: "c",
    type: "dimension",
    data: {
      dimensions: [
        {
          id: "a-c-analogy",
          relationType: "类比",
          selected: "通信 / 延迟",
          main: [
            { label: "通信", details: ["延迟", "带宽", "丢包"] },
            { label: "一致性", details: ["强一致", "最终一致"] },
          ],
        },
      ],
    },
  },
  {
    id: "b-d",
    source: "b",
    target: "d",
    type: "dimension",
    data: {
      dimensions: [
        {
          id: "b-d-causal",
          relationType: "因果",
          selected: "信任 / 认知信任",
          main: [
            { label: "信任", details: ["认知信任", "情感信任"] },
            { label: "容错", details: ["试错空间", "失败复盘"] },
          ],
        },
        {
          id: "b-d-strength",
          relationType: "强度",
          selected: "放大器",
          main: [
            { label: "强度", details: ["弱关联", "强因果", "瓶颈", "放大器", "触发器"] },
          ],
        },
      ],
    },
  },
];

const nodeTypes = { inspiration: InspirationNode } as NodeTypes;
const edgeTypes = { dimension: DimensionEdge } as EdgeTypes;

function InspirationNode({ id, data }: NodeProps<InspirationNodeType>) {
  const { setNodes } = useReactFlow();

  const updateWeight = (weight: number) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, weight } }
          : node,
      ),
    );
  };

  return (
    <div className="inspiration-node" style={{ borderColor: data.color }}>
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="node-topline">
        <span className="color-dot" style={{ background: data.color }} />
        <span className="node-title">{data.title}</span>
        <input
          className="weight-input nodrag"
          type="number"
          min={1}
          max={9}
          value={data.weight}
          title="权重 1-9"
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next) && next >= 1 && next <= 9) {
              updateWeight(next);
            }
          }}
        />
      </div>
      <p className="node-content">{data.content}</p>
      <div className="node-footer">
        <span className="note-count">备注 {data.noteCount}</span>
        <span className="node-hint">拖动节点</span>
      </div>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
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

function DimensionEdge({
  id,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
}: EdgeProps<DimensionEdgeType>) {
  const { setEdges } = useReactFlow();
  const [openId, setOpenId] = useState<string | null>(null);

  const dimensions = data?.dimensions ?? [];
  const p0 = { x: sourceX, y: sourceY };
  const p3 = { x: targetX, y: targetY };
  const dx = Math.max(70, Math.abs(targetX - sourceX) * 0.55);
  const c1 = { x: sourceX + dx, y: sourceY };
  const c2 = { x: targetX - dx, y: targetY };
  const path = `M ${p0.x},${p0.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${p3.x},${p3.y}`;

  const chipPositions = dimensions.map((_, index) => {
    const count = dimensions.length;
    const t = count === 1 ? 0.5 : 0.34 + (index / (count - 1)) * 0.32;
    const point = cubicPoint(p0, c1, c2, p3, t);
    const tangent = cubicTangent(p0, c1, c2, p3, t);
    const length = Math.hypot(tangent.x, tangent.y) || 1;
    const normal = { x: -tangent.y / length, y: tangent.x / length };
    const offset = (index % 2 === 0 ? 1 : -1) * 30;
    return {
      x: point.x + normal.x * offset,
      y: point.y + normal.y * offset,
    };
  });

  const midPoint = cubicPoint(p0, c1, c2, p3, 0.5);
  const addPoint = { x: midPoint.x, y: midPoint.y + 78 };

  const updateSelected = (dimensionId: string, value: string) => {
    setEdges((edges) =>
      edges.map((edge) => {
        if (edge.id !== id) return edge;
        const edgeData = edge.data as DimensionEdgeData | undefined;
        if (!edgeData) return edge;
        return {
          ...edge,
          data: {
            ...edgeData,
            dimensions: edgeData.dimensions.map((dimension) =>
              dimension.id === dimensionId
                ? { ...dimension, selected: value }
                : dimension,
            ),
          },
        };
      }),
    );
  };

  const addDimension = () => {
    const newDimension: Dimension = {
      id: `dim-${Date.now()}`,
      relationType: "因果",
      selected: "机制 / 触发器",
      main: [
        { label: "机制", details: ["触发器", "放大器", "瓶颈"] },
        { label: "证据", details: ["事实", "假设", "猜想"] },
      ],
    };

    setEdges((edges) =>
      edges.map((edge) => {
        if (edge.id !== id) return edge;
        const edgeData = edge.data as DimensionEdgeData | undefined;
        return {
          ...edge,
          data: {
            ...edgeData,
            dimensions: [...(edgeData?.dimensions ?? []), newDimension],
          },
        };
      }),
    );
  };

  return (
    <>
      <path
        className={`dimension-edge-path ${selected ? "is-selected" : ""}`}
        d={path}
      />
      <EdgeLabelRenderer>
        {dimensions.map((dimension, index) => {
          const position = chipPositions[index];
          const isOpen = openId === dimension.id;

          return (
            <Fragment key={dimension.id}>
              <button
                type="button"
                className={`dimension-chip nodrag nopan ${isOpen ? "is-open" : ""}`}
                style={{
                  position: "absolute",
                  transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
                  pointerEvents: "all",
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenId(isOpen ? null : dimension.id);
                }}
              >
                <span className="chip-type">{dimension.relationType}</span>
                <span className="chip-value">{dimension.selected}</span>
              </button>

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
                  <DimensionTree
                    dimension={dimension}
                    onSelect={(value) => updateSelected(dimension.id, value)}
                    onClose={() => setOpenId(null)}
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
            transform: `translate(-50%, -50%) translate(${addPoint.x}px, ${addPoint.y}px)`,
            pointerEvents: "all",
          }}
          onClick={(event) => {
            event.stopPropagation();
            addDimension();
          }}
          title="在同一条线上增加一个维度框"
        >
          ＋ 维度框
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

function DimensionTree({
  dimension,
  onSelect,
  onClose,
}: {
  dimension: Dimension;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(
    dimension.main[0]?.label ?? null,
  );
  const [selected, setSelected] = useState(dimension.selected);

  const choose = (main: string, detail: string) => {
    const value = `${main} / ${detail}`;
    setSelected(value);
    onSelect(value);
  };

  return (
    <div className="dimension-popover-inner">
      <div className="popover-head">
        <span className="popover-type">{dimension.relationType}</span>
        <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>
      <div className="popover-sub">选主维度，再选细节</div>

      <div className="main-list">
        {dimension.main.map((main) => {
          const isExpanded = expanded === main.label;
          return (
            <div key={main.label} className="main-item">
              <button
                type="button"
                className={`main-button ${isExpanded ? "is-expanded" : ""}`}
                onClick={() => setExpanded(isExpanded ? null : main.label)}
              >
                <span>{main.label}</span>
                <span>{isExpanded ? "−" : "+"}</span>
              </button>

              {isExpanded && (
                <div className="detail-list">
                  {main.details.map((detail) => {
                    const value = `${main.label} / ${detail}`;
                    return (
                      <button
                        key={detail}
                        type="button"
                        className={`detail-button ${selected === value ? "is-selected" : ""}`}
                        onClick={() => choose(main.label, detail)}
                      >
                        {detail}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="popover-foot">
        <span className="selected-label">当前：{selected}</span>
        <button type="button" className="primary-button" onClick={onClose}>
          完成
        </button>
      </div>
    </div>
  );
}

export default function M0Canvas() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="canvas-shell">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.35}
        maxZoom={1.8}
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
            (node.data as InspirationData | undefined)?.color ?? "#94a3b8"
          }
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}
