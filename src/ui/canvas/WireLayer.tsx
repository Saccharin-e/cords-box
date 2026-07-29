/**
 * WireLayer — Konva layer for drawing wires between component lugs.
 *
 * Renders committed wires as colored Bezier curves and the
 * in-progress "pending" wire as a dashed line following the cursor.
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
}

export function WireLayer({ wires }: Props) {
  const { pendingWire } = useCanvasStore();

  return (
    <Layer>
      {/* Committed wires */}
      {wires.map((wire) => {
        const midX = (wire.x1 + wire.x2) / 2;
        const dy = wire.y2 - wire.y1;
        const cp1X = wire.x1 + (midX - wire.x1) * 0.5;
        const cp1Y = wire.y1 + dy * 0.15;
        const cp2X = wire.x2 - (wire.x2 - midX) * 0.5;
        const cp2Y = wire.y2 - dy * 0.15;

        return (
          <Line
            key={wire.id}
            points={[wire.x1, wire.y1, cp1X, cp1Y, cp2X, cp2Y, wire.x2, wire.y2]}
            tension={0.4}
            stroke={wire.isActive ? wire.color : '#2a2a30'}
            strokeWidth={wire.isActive ? 2.5 : 1.5}
            shadowColor={wire.color}
            shadowBlur={wire.isActive ? 10 : 0}
            shadowOpacity={0.6}
            lineCap="round"
            lineJoin="round"
          />
        );
      })}

      {/* Solder joint dots at endpoints */}
      {wires.map((wire) => (
        <>
          <Circle
            key={`${wire.id}-dot1`}
            x={wire.x1}
            y={wire.y1}
            radius={3}
            fill={wire.isActive ? wire.color : '#3f3f46'}
            shadowColor={wire.color}
            shadowBlur={wire.isActive ? 6 : 0}
            shadowOpacity={0.8}
          />
          <Circle
            key={`${wire.id}-dot2`}
            x={wire.x2}
            y={wire.y2}
            radius={3}
            fill={wire.isActive ? wire.color : '#3f3f46'}
            shadowColor={wire.color}
            shadowBlur={wire.isActive ? 6 : 0}
            shadowOpacity={0.8}
          />
        </>
      ))}

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
          strokeWidth={2}
          dash={[8, 4]}
          opacity={0.8}
          shadowColor="#ff8c00"
          shadowBlur={8}
          shadowOpacity={0.5}
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
    // Find source and target instance positions from node ids
    // Node ids are formatted as `${componentId}${lugSuffix}`
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
