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

import { getAllCanvasLugs } from './shapes';

/**
 * Resolve wire target endpoint at (canvasX, canvasY).
 * Priority:
 * 1. Terminal Lug (within 28px)
 * 2. Existing Wire Segment Splice (within 16px)
 * 3. Component body or blank canvas junction node position
 */
export function resolveWireTarget(
  canvasX: number,
  canvasY: number,
  sourceAnchor?: { componentId: string; lugId: string },
): { componentId: string; lugId: string; x: number; y: number } {
  const instances = useCanvasStore.getState().instances;
  const allLugs = getAllCanvasLugs(instances);

  // 1. Check nearby lug
  let bestLug: { componentId: string; lugId: string; x: number; y: number } | null = null;
  let minLugDist = 28;

  for (const l of allLugs) {
    if (
      sourceAnchor &&
      l.componentId === sourceAnchor.componentId &&
      l.lugId === sourceAnchor.lugId
    ) {
      continue;
    }
    const dist = Math.hypot(l.x - canvasX, l.y - canvasY);
    if (dist < minLugDist) {
      minLugDist = dist;
      bestLug = { componentId: l.componentId, lugId: l.lugId, x: l.x, y: l.y };
    }
  }
  if (bestLug) return bestLug;

  // 2. Check nearby wire line segment (wire splice connection)
  const currentEdges = useCircuitStore.getState().graph.getEdges();
  const wireVisuals = buildWireVisuals(() => currentEdges, instances, new Set());
  let bestSplice: { x: number; y: number } | null = null;
  let minWireDist = 16;

  for (const w of wireVisuals) {
    const { dist, closestX, closestY } = getDistanceToSegment(
      canvasX,
      canvasY,
      w.x1,
      w.y1,
      w.x2,
      w.y2,
    );
    if (dist < minWireDist) {
      minWireDist = dist;
      bestSplice = { x: Math.round(closestX), y: Math.round(closestY) };
    }
  }

  const targetX = bestSplice ? bestSplice.x : canvasX;
  const targetY = bestSplice ? bestSplice.y : canvasY;

  // 3. Create junction node at target position (wire splice point, component body, or canvas)
  const junctionId = `j_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  useCircuitStore.getState().addNode({
    id: junctionId,
    type: 'junction',
    componentId: 'canvas',
    signalState: 'inactive',
    position: { x: targetX, y: targetY },
  });

  return {
    componentId: junctionId,
    lugId: '',
    x: targetX,
    y: targetY,
  };
}

function getDistanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return { dist: Math.hypot(px - x1, py - y1), closestX: x1, closestY: y1 };
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  return { dist: Math.hypot(px - closestX, py - closestY), closestX, closestY };
}
