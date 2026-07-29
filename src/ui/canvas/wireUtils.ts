/**
 * Wire Visualization Utilities
 */

import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { getShape, getLugAbsolutePosition } from './shapes';

export interface WireVisual {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  controlPoint?: { x: number; y: number };
  controlPoints?: { x: number; y: number }[];
  color: string;
  isActive: boolean;
}

/**
 * Build WireVisual list from graph edges + canvas instances.
 * Maps edge node IDs to exact lug coordinates or free canvas junction node positions.
 */
export function buildWireVisuals(
  edges: ReturnType<typeof useCircuitStore.getState>['graph']['getEdges'],
  instances: ReturnType<typeof useCanvasStore.getState>['instances'],
  activeEdges: Set<string>,
): WireVisual[] {
  const visuals: WireVisual[] = [];
  const nodes = useCircuitStore.getState().graph.getNodes();

  for (const edge of edges()) {
    const srcMatch = parseNodeId(edge.source, instances, nodes);
    const tgtMatch = parseNodeId(edge.target, instances, nodes);

    if (!srcMatch || !tgtMatch) continue;

    visuals.push({
      id: edge.id,
      sourceNodeId: edge.source,
      targetNodeId: edge.target,
      x1: srcMatch.x,
      y1: srcMatch.y,
      x2: tgtMatch.x,
      y2: tgtMatch.y,
      controlPoint: edge.controlPoint,
      controlPoints: edge.controlPoints,
      color: edge.wireColor ?? '#ff8c00',
      isActive: activeEdges.has(edge.id),
    });
  }

  return visuals;
}

import type { CircuitNode } from '@graph/types';

/** Helper to parse a node ID into exact absolute lug coordinates or junction positions */
function parseNodeId(
  nodeId: string,
  instances: ReturnType<typeof useCanvasStore.getState>['instances'],
  nodes: readonly CircuitNode[],
): { x: number; y: number } | null {
  // 1. Check matching component instance lugs
  for (const inst of instances) {
    if (nodeId.startsWith(inst.id)) {
      const lugSuffix = nodeId.slice(inst.id.length);
      const shape = getShape(inst.type);
      const lug = shape.lugs.find((l) => l.id === lugSuffix);
      if (lug) {
        return getLugAbsolutePosition(shape, lug, inst.x, inst.y);
      }
      return { x: inst.x + shape.width / 2, y: inst.y + shape.height / 2 };
    }
  }

  // 2. Check matching graph nodes (for free canvas junction nodes)
  const node = nodes.find((n) => n.id === nodeId);
  if (node && node.position) {
    return node.position;
  }

  return null;
}
