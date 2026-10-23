import type { NoteRole } from "@/lib/canvas-types";
import type {
  CanvasSnapshot,
  ContextNeighbor,
  InferenceContext,
  SnapshotEdge,
  SnapshotNode,
} from "./types";

function truncate(value: string, max = 700) {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function toNeighbor(
  snapshot: CanvasSnapshot,
  edge: SnapshotEdge,
  otherId: string,
): ContextNeighbor | null {
  const other = snapshot.nodeById.get(otherId);
  if (!other) {
    return null;
  }

  const dimensions = snapshot.dimensionsByEdge.get(edge.id) ?? [];

  return {
    id: other.id,
    role: other.role,
    title: other.title,
    content: truncate(other.content),
    weight: other.weight,
    edge: {
      relationTypes: [...new Set(dimensions.map((item) => item.relationType))],
      selectedPaths: [
        ...new Set(dimensions.flatMap((item) => item.selectedPaths)),
      ],
    },
  };
}

function neighbors(
  snapshot: CanvasSnapshot,
  nodeId: string,
  direction: "incoming" | "outgoing",
) {
  const edges =
    direction === "incoming"
      ? (snapshot.incoming.get(nodeId) ?? [])
      : (snapshot.outgoing.get(nodeId) ?? []);

  return edges
    .map((edge) =>
      toNeighbor(
        snapshot,
        edge,
        direction === "incoming" ? edge.source : edge.target,
      ),
    )
    .filter((item): item is ContextNeighbor => Boolean(item))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8);
}

export function buildInferenceContext({
  snapshot,
  node,
  role,
  hint,
}: {
  snapshot: CanvasSnapshot;
  node: SnapshotNode;
  role: NoteRole;
  hint: string;
}): InferenceContext {
  return {
    canvas: {
      name: snapshot.canvas.name,
      description: snapshot.canvas.description,
    },
    hint: hint.trim(),
    node: {
      id: node.id,
      role,
      title: node.title,
      content: truncate(node.content),
      weight: node.weight,
    },
    incoming: neighbors(snapshot, node.id, "incoming"),
    outgoing: neighbors(snapshot, node.id, "outgoing"),
  };
}
