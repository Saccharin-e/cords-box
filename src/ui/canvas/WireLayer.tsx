/**
 * WireLayer — Konva layer for drawing wires between component lugs.
 *
 * Renders committed wires as colored Bezier curves and the
 * in-progress "pending" wire as a dashed line following the cursor.
 * Supports clicking to select wire edge for deletion.
 */

import { Layer, Line, Circle } from 'react-konva';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';

export interface WireVisual {
  id: string;
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
  const { pendingWire } = useCanvasStore();

  return (
    <Layer>
      {/* Committed wires */}
      {wires.map((wire) => {
        const isSelected = selectedEdgeId === wire.id;
        const midX = (wire.x1 + wire.x2) / 2;
        const dy = wire.y2 - wire.y1;
        const cp1X = wire.x1 + (midX - wire.x1) * 0.5;
        const cp1Y = wire.y1 + dy * 0.15;
        const cp2X = wire.x2 - (wire.x2 - midX) * 0.5;
        const cp2Y = wire.y2 - dy * 0.15;

        const strokeColor = isSelected ? '#ef4444' : wire.isActive ? wire.color : '#52525b';
        const strokeW = isSelected ? 4 : wire.isActive ? 3 : 2;

        return (
          <Line
            key={wire.id}
            points={[wire.x1, wire.y1, cp1X, cp1Y, cp2X, cp2Y, wire.x2, wire.y2]}
            tension={0.4}
            stroke={strokeColor}
            strokeWidth={strokeW}
            hitStrokeWidth={12}
            shadowColor={strokeColor}
            shadowBlur={isSelected || wire.isActive ? 10 : 0}
            shadowOpacity={0.8}
            lineCap="round"
            lineJoin="round"
            onClick={(e) => {
              e.cancelBubble = true;
              onSelectEdge?.(wire.id);
            }}
          />
        );
      })}

      {/* Solder joint dots at endpoints */}
      {wires.map((wire) => {
        const isSelected = selectedEdgeId === wire.id;
        const dotColor = isSelected ? '#ef4444' : wire.isActive ? wire.color : '#71717a';

        return (
          <g key={`${wire.id}-dots`}>
            <Circle
              x={wire.x1}
              y={wire.y1}
              radius={4}
              fill={dotColor}
              shadowColor={dotColor}
              shadowBlur={isSelected || wire.isActive ? 6 : 0}
              shadowOpacity={0.8}
            />
            <Circle
              x={wire.x2}
              y={wire.y2}
              radius={4}
              fill={dotColor}
              shadowColor={dotColor}
              shadowBlur={isSelected || wire.isActive ? 6 : 0}
              shadowOpacity={0.8}
            />
          </g>
        );
      })}

      {/* Pending wire (in-progress draw) */}
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

/** Build WireVisual list from graph edges + canvas instances */
export function buildWireVisuals(
  edges: ReturnType<typeof useCircuitStore.getState>['graph']['getEdges'],
  instances: ReturnType<typeof useCanvasStore.getState>['instances'],
  activeEdges: Set<string>,
): WireVisual[] {
  const instanceMap = new Map(instances.map((i) => [i.id, i]));
  const visuals: WireVisual[] = [];

  for (const edge of edges()) {
    const sourceCompId = edge.source.split('_').slice(0, -1).join('_');
    const targetCompId = edge.target.split('_').slice(0, -1).join('_');
    const srcInst = instanceMap.get(sourceCompId);
    const tgtInst = instanceMap.get(targetCompId);
    if (!srcInst || !tgtInst) continue;

    visuals.push({
      id: edge.id,
      x1: srcInst.x + srcInst.width / 2,
      y1: srcInst.y + srcInst.height / 2,
      x2: tgtInst.x + tgtInst.width / 2,
      y2: tgtInst.y + tgtInst.height / 2,
      color: edge.wireColor ?? '#ff8c00',
      isActive: activeEdges.has(edge.id),
    });
  }

  return visuals;
}
