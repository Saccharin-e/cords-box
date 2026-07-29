/**
 * WireLayer — DIYLC-Style Interactive Wire Engine (Crash-Free & Butter-Smooth)
 *
 * Mechanics:
 * - Exact lug position alignment matching real-world component shapes.
 * - Draggable wire endpoint handles (P1 and P2) to extend, move, and reconnect wires freely.
 * - Snap-to-lug calculation on drag release to re-anchor wires in the circuit graph.
 * - High-contrast selection, glowing active signal state, and right-click context menu compatibility.
 */

import { Layer, Line, Circle, Group } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { getShape, getLugAbsolutePosition, getAllCanvasLugs } from './shapes';

export interface WireVisual {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  isActive: boolean;
}

interface Props {
  wires: WireVisual[];
  selectedEdgeId?: string | null;
  onSelectEdge?: (edgeId: string) => void;
}

import { memo } from 'react';

export const WireLayer = memo(function WireLayer({ wires, selectedEdgeId, onSelectEdge }: Props) {
  const pendingWire = useCanvasStore((s) => s.pendingWire);
  const instances = useCanvasStore((s) => s.instances);
  const removeEdge = useCircuitStore((s) => s.removeEdge);
  const addEdge = useCircuitStore((s) => s.addEdge);
  const graph = useCircuitStore((s) => s.graph);

  function handleEndpointDragEnd(
    wire: WireVisual,
    endpoint: 'source' | 'target',
    e: Konva.KonvaEventObject<DragEvent>,
  ) {
    e.cancelBubble = true;
    const dropX = e.target.x();
    const dropY = e.target.y();

    const allLugs = getAllCanvasLugs(instances);
    let closestLug = null;
    let minDistance = 24; // Snap radius in px

    for (const lug of allLugs) {
      const dx = lug.x - dropX;
      const dy = lug.y - dropY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDistance) {
        minDistance = dist;
        closestLug = lug;
      }
    }

    const existingEdge = graph.getEdges().find((ed) => ed.id === wire.id);
    if (existingEdge && closestLug) {
      const newSource = endpoint === 'source' ? closestLug.nodeId : existingEdge.source;
      const newTarget = endpoint === 'target' ? closestLug.nodeId : existingEdge.target;

      removeEdge(wire.id);
      addEdge({
        ...existingEdge,
        source: newSource,
        target: newTarget,
      });
    }
  }

  return (
    <Layer>
      {/* Committed Wires */}
      {wires.map((wire) => {
        const isSelected = selectedEdgeId === wire.id;
        const strokeColor = isSelected ? '#ef4444' : wire.isActive ? wire.color : '#ff8c00';
        const strokeW = isSelected ? 4 : wire.isActive ? 3.5 : 2.5;

        // Quadratic Bezier control point calculation
        const midX = (wire.x1 + wire.x2) / 2;
        const midY = (wire.y1 + wire.y2) / 2;
        const dy = wire.y2 - wire.y1;
        const cpX = midX;
        const cpY = midY + dy * 0.15;

        return (
          <Group key={wire.id}>
            {/* Wire Line Curve */}
            <Line
              points={[wire.x1, wire.y1, cpX, cpY, wire.x2, wire.y2]}
              tension={0.3}
              stroke={strokeColor}
              strokeWidth={strokeW}
              hitStrokeWidth={14}
              shadowColor={strokeColor}
              shadowBlur={isSelected || wire.isActive ? 10 : 0}
              shadowOpacity={0.8}
              lineCap="round"
              lineJoin="round"
              onClick={(evt) => {
                evt.cancelBubble = true;
                onSelectEdge?.(wire.id);
              }}
            />

            {/* Draggable Endpoint Handle P1 (Source Lug Handle) */}
            <Circle
              x={wire.x1}
              y={wire.y1}
              radius={isSelected ? 6 : 4.5}
              fill={isSelected ? '#ef4444' : wire.color}
              stroke="#ffffff"
              strokeWidth={1.5}
              draggable
              onDragStart={(evt) => {
                evt.cancelBubble = true;
              }}
              onDragEnd={(evt) => handleEndpointDragEnd(wire, 'source', evt)}
              onClick={(evt) => {
                evt.cancelBubble = true;
                onSelectEdge?.(wire.id);
              }}
            />

            {/* Draggable Endpoint Handle P2 (Target Lug Handle) */}
            <Circle
              x={wire.x2}
              y={wire.y2}
              radius={isSelected ? 6 : 4.5}
              fill={isSelected ? '#ef4444' : wire.color}
              stroke="#ffffff"
              strokeWidth={1.5}
              draggable
              onDragStart={(evt) => {
                evt.cancelBubble = true;
              }}
              onDragEnd={(evt) => handleEndpointDragEnd(wire, 'target', evt)}
              onClick={(evt) => {
                evt.cancelBubble = true;
                onSelectEdge?.(wire.id);
              }}
            />
          </Group>
        );
      })}

      {/* Pending Wire (In-Progress Draw) */}
      {pendingWire && (
        <Line
          points={[
            pendingWire.from.x,
            pendingWire.from.y,
            pendingWire.toX,
            pendingWire.toY,
          ]}
          stroke="#ff8c00"
          strokeWidth={2.5}
          dash={[8, 4]}
          opacity={0.9}
          shadowColor="#ff8c00"
          shadowBlur={8}
          shadowOpacity={0.6}
        />
      )}
    </Layer>
  );
});

/**
 * Build WireVisual list from graph edges + canvas instances.
 * Maps edge node IDs (e.g., "pickup_neck_hot") to exact shape lug coordinates.
 */
export function buildWireVisuals(
  edges: ReturnType<typeof useCircuitStore.getState>['graph']['getEdges'],
  instances: ReturnType<typeof useCanvasStore.getState>['instances'],
  activeEdges: Set<string>,
): WireVisual[] {
  const visuals: WireVisual[] = [];

  for (const edge of edges()) {
    const srcMatch = parseNodeId(edge.source, instances);
    const tgtMatch = parseNodeId(edge.target, instances);

    if (!srcMatch || !tgtMatch) continue;

    visuals.push({
      id: edge.id,
      sourceNodeId: edge.source,
      targetNodeId: edge.target,
      x1: srcMatch.x,
      y1: srcMatch.y,
      x2: tgtMatch.x,
      y2: tgtMatch.y,
      color: edge.wireColor ?? '#ff8c00',
      isActive: activeEdges.has(edge.id),
    });
  }

  return visuals;
}

/** Helper to parse a node ID into exact absolute lug coordinates */
function parseNodeId(
  nodeId: string,
  instances: ReturnType<typeof useCanvasStore.getState>['instances'],
): { x: number; y: number } | null {
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
  return null;
}
