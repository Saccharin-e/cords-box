/**
 * WireLayer — DIYLC-Style Interactive Wire Engine for Konva Canvas
 *
 * Mechanics:
 * - Exact lug position alignment matching real-world component shapes.
 * - Draggable wire endpoint handles (P1 and P2) to extend, move, and reconnect wires freely.
 * - Magnetic snap-to-lug indicator halo when pulling endpoints near component solder lugs.
 * - Midpoint bend control handle for freeform curved routing.
 * - High-contrast selection, glowing active signal state, and right-click context menu compatibility.
 */

import { useState, useMemo } from 'react';
import { Layer, Line, Circle, Group, Ring } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { getShape, getLugAbsolutePosition, getAllCanvasLugs, type CanvasLugTarget } from './shapes';

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

export function WireLayer({ wires, selectedEdgeId, onSelectEdge }: Props) {
  const { pendingWire, instances } = useCanvasStore();
  const { removeEdge, addEdge } = useCircuitStore();
  const graph = useCircuitStore((s) => s.graph);

  // Live overrides for endpoint dragging
  const [dragOverride, setDragOverride] = useState<{
    edgeId: string;
    endpoint: 'source' | 'target';
    x: number;
    y: number;
    snappedLug: CanvasLugTarget | null;
  } | null>(null);

  // Custom midpoint bends
  const [wireBends, setWireBends] = useState<Record<string, { x: number; y: number }>>({});

  const allLugs = useMemo(() => getAllCanvasLugs(instances), [instances]);

  function handleEndpointDragMove(
    edgeId: string,
    endpoint: 'source' | 'target',
    e: Konva.KonvaEventObject<DragEvent>,
  ) {
    const stage = e.target.getStage();
    if (!stage) return;
    const dragX = e.target.x();
    const dragY = e.target.y();

    // Check magnetic snap to nearest lug (within 18px radius)
    let closestLug: CanvasLugTarget | null = null;
    let minDistance = 18; // Snap radius

    for (const lug of allLugs) {
      const dx = lug.x - dragX;
      const dy = lug.y - dragY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDistance) {
        minDistance = dist;
        closestLug = lug;
      }
    }

    setDragOverride({
      edgeId,
      endpoint,
      x: closestLug ? closestLug.x : dragX,
      y: closestLug ? closestLug.y : dragY,
      snappedLug: closestLug,
    });
  }

  function handleEndpointDragEnd(
    wire: WireVisual,
    endpoint: 'source' | 'target',
  ) {
    if (dragOverride && dragOverride.edgeId === wire.id && dragOverride.snappedLug) {
      const existingEdge = graph.getEdges().find((e) => e.id === wire.id);
      if (existingEdge) {
        const newSource = endpoint === 'source' ? dragOverride.snappedLug.nodeId : existingEdge.source;
        const newTarget = endpoint === 'target' ? dragOverride.snappedLug.nodeId : existingEdge.target;

        // Re-anchor wire edge in circuit graph
        removeEdge(wire.id);
        addEdge({
          ...existingEdge,
          source: newSource,
          target: newTarget,
        });
      }
    }

    setDragOverride(null);
  }

  return (
    <Layer>
      {/* Committed Wires */}
      {wires.map((wire) => {
        const isSelected = selectedEdgeId === wire.id;

        // Apply drag overrides if currently dragging an endpoint
        let p1X = wire.x1;
        let p1Y = wire.y1;
        let p2X = wire.x2;
        let p2Y = wire.y2;

        if (dragOverride && dragOverride.edgeId === wire.id) {
          if (dragOverride.endpoint === 'source') {
            p1X = dragOverride.x;
            p1Y = dragOverride.y;
          } else {
            p2X = dragOverride.x;
            p2Y = dragOverride.y;
          }
        }

        // Custom or calculated midpoint bend
        const bendPos = wireBends[wire.id] ?? {
          x: (p1X + p2X) / 2,
          y: (p1Y + p2Y) / 2,
        };

        const strokeColor = isSelected ? '#ef4444' : wire.isActive ? wire.color : '#52525b';
        const strokeW = isSelected ? 4 : wire.isActive ? 3.5 : 2.5;

        return (
          <Group key={wire.id}>
            {/* Wire Path (Quadratic Bezier with Bend Point) */}
            <Line
              points={[p1X, p1Y, bendPos.x, bendPos.y, p2X, p2Y]}
              tension={0.3}
              stroke={strokeColor}
              strokeWidth={strokeW}
              hitStrokeWidth={14}
              shadowColor={strokeColor}
              shadowBlur={isSelected || wire.isActive ? 12 : 0}
              shadowOpacity={0.8}
              lineCap="round"
              lineJoin="round"
              onClick={(e) => {
                e.cancelBubble = true;
                onSelectEdge?.(wire.id);
              }}
            />

            {/* DIYLC Interactive Endpoint P1 (Source Lug Handle) */}
            <Circle
              x={p1X}
              y={p1Y}
              radius={isSelected ? 6 : 4.5}
              fill={isSelected ? '#ef4444' : wire.color}
              stroke="#ffffff"
              strokeWidth={1.5}
              draggable
              onDragMove={(e) => handleEndpointDragMove(wire.id, 'source', e)}
              onDragEnd={() => handleEndpointDragEnd(wire, 'source')}
              onClick={(e) => {
                e.cancelBubble = true;
                onSelectEdge?.(wire.id);
              }}
            />

            {/* DIYLC Interactive Endpoint P2 (Target Lug Handle) */}
            <Circle
              x={p2X}
              y={p2Y}
              radius={isSelected ? 6 : 4.5}
              fill={isSelected ? '#ef4444' : wire.color}
              stroke="#ffffff"
              strokeWidth={1.5}
              draggable
              onDragMove={(e) => handleEndpointDragMove(wire.id, 'target', e)}
              onDragEnd={() => handleEndpointDragEnd(wire, 'target')}
              onClick={(e) => {
                e.cancelBubble = true;
                onSelectEdge?.(wire.id);
              }}
            />

            {/* DIYLC Midpoint Bend Handle (Visible on select/hover) */}
            {isSelected && (
              <Circle
                x={bendPos.x}
                y={bendPos.y}
                radius={5}
                fill="#eab308"
                stroke="#000000"
                strokeWidth={1}
                draggable
                onDragMove={(e) => {
                  setWireBends((prev) => ({
                    ...prev,
                    [wire.id]: { x: e.target.x(), y: e.target.y() },
                  }));
                }}
              />
            )}
          </Group>
        );
      })}

      {/* Snap Halo Indicator when dragging endpoint near a lug */}
      {dragOverride?.snappedLug && (
        <Group x={dragOverride.snappedLug.x} y={dragOverride.snappedLug.y}>
          <Ring
            innerRadius={8}
            outerRadius={14}
            fill="#22c55e"
            opacity={0.8}
            shadowColor="#22c55e"
            shadowBlur={10}
          />
          <Circle radius={4} fill="#ffffff" />
        </Group>
      )}

      {/* Pending Wire (Currently Drawing) */}
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
}

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
    // Parse component ID and lug ID suffix
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
      // Fallback to component center if lug suffix doesn't match
      return { x: inst.x + shape.width / 2, y: inst.y + shape.height / 2 };
    }
  }
  return null;
}
