import type { NoteRole } from "@/lib/canvas-types";
import type { CanvasSnapshot, SnapshotNode } from "./types";

export function inferRoleFromTopology(
  node: SnapshotNode,
  incomingCount: number,
  outgoingCount: number,
): NoteRole {
  if (node.roleLocked && node.role !== "blank") {
    return node.role;
  }

  if (incomingCount === 0) {
    return "inspiration";
  }

  if (outgoingCount === 0) {
    return "result";
  }

  return "process";
}

export function getBlankNodes(snapshot: CanvasSnapshot): SnapshotNode[] {
  return snapshot.nodes.filter((node) => !node.content.trim());
}

export function planInferenceWaves(
  snapshot: CanvasSnapshot,
  blankNodes: SnapshotNode[],
): SnapshotNode[][] {
  if (blankNodes.length === 0) {
    return [];
  }

  const blankIds = new Set(blankNodes.map((node) => node.id));
  const dependencies = new Map<string, Set<string>>();

  for (const node of blankNodes) {
    const incoming = snapshot.incoming.get(node.id) ?? [];
    dependencies.set(
      node.id,
      new Set(
        incoming
          .map((edge) => edge.source)
          .filter((sourceId) => blankIds.has(sourceId)),
      ),
    );
  }

  const remaining = new Set(blankIds);
  const waves: SnapshotNode[][] = [];

  while (remaining.size > 0) {
    const ready = blankNodes.filter(
      (node) =>
        remaining.has(node.id) &&
        [...(dependencies.get(node.id) ?? [])].every(
          (dependencyId) => !remaining.has(dependencyId),
        ),
    );

    if (ready.length === 0) {
      waves.push(blankNodes.filter((node) => remaining.has(node.id)));
      break;
    }

    waves.push(ready);
    for (const node of ready) {
      remaining.delete(node.id);
    }
  }

  return waves;
}
