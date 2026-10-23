"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesState,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import Link from "next/link";
import { createContext, useContext, useMemo, useState } from "react";
import {
  deleteCanvasNode,
  saveNodeNote,
  updateNodeColor,
  updateNodePosition,
  updateNodeWeight,
} from "@/lib/actions/canvas";
import type { CanvasNodeData, CanvasNodeType } from "@/lib/canvas-types";
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
  saveNote: (id: string, note: string) => Promise<number>;
  deleteNode: (id: string) => void;
};

const CanvasActionsContext = createContext<CanvasActions | null>(null);

function InspirationNode({ id, data }: NodeProps<CanvasNodeType>) {
  const actions = useContext(CanvasActionsContext);
  const [weight, setWeight] = useState(data.weight);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(data.note);
  const [savingNote, setSavingNote] = useState(false);

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

  return (
    <div
      className="canvas-node"
      style={{
        borderColor: data.color,
        borderWidth: 2 + Math.round((data.weight - 1) / 2),
      }}
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
          🗑
        </button>
      </div>

      <p className="canvas-node-content nowheel">{data.content}</p>

      <div className="canvas-node-footer">
        <button
          type="button"
          className="node-note-button nodrag"
          onClick={() => {
            setNoteDraft(data.note);
            setNoteOpen((open) => !open);
          }}
        >
          ✎ 备注 {data.noteCount}
        </button>
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
  );
}

const nodeTypes = { inspiration: InspirationNode } as NodeTypes;

export default function CanvasWorkspace({
  initialNodes,
}: {
  initialNodes: CanvasNodeType[];
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

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
        void deleteCanvasNode(id);
      },
    }),
    [setNodes],
  );

  return (
    <CanvasActionsContext.Provider value={actions}>
      <div className="canvas-stage">
        <div className="canvas-hint">
          拖动便签调整位置 · 权重 / 颜色 / 备注 / 删除都在便签上
        </div>

        <ReactFlow
          nodes={nodes}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          onNodeDragStop={(_, node) => {
            void updateNodePosition(
              node.id,
              node.position.x,
              node.position.y,
            );
          }}
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
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
      </div>
    </CanvasActionsContext.Provider>
  );
}
