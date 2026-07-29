/**
 * SchematicView — Konva Stage for the node-based electrical schematic.
 *
 * Renders the circuit as a formal electrical schematic with:
 * - Standardized component symbols (not physical shapes)
 * - Net-highlighted signal paths
 * - Active path glow on signal-carrying wires
 */

import { useRef, useCallback } from 'react';
import { Stage, Layer, Rect, Text, Circle, Group } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { WireLayer, buildWireVisuals } from './WireLayer';
import { getShape } from './shapes';

interface Props {
  width: number;
  height: number;
}

export function SchematicView({ width, height }: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const {
    instances, scale, panX, panY,
    selectedId, selectInstance, setScale,
  } = useCanvasStore();

  const graphEdges = useCircuitStore((s) => s.graph.getEdges.bind(s.graph));
  const solverResult = useCircuitStore((s) => s.solverResult);
  const activeEdges = solverResult?.activeEdges ?? new Set<string>();
  const activeNodes = solverResult?.activeNodes ?? new Set<string>();

  const wires = buildWireVisuals(graphEdges, instances, activeEdges);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const factor = e.evt.deltaY < 0 ? 1.08 : 0.93;
      setScale(scale * factor);
    },
    [scale, setScale],
  );

  return (
    <div style={{ width, height }}>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={scale}
        scaleY={scale}
        x={panX}
        y={panY}
        onWheel={handleWheel}
        onClick={(e) => {
          if (e.target === stageRef.current) selectInstance(null);
        }}
      >
        {/* Wires first */}
        <WireLayer wires={wires} />

        {/* Schematic symbols layer */}
        <Layer>
          {instances.map((inst) => {
            const shape = getShape(inst.type);
            const isSelected = selectedId === inst.id;
            const isActive = activeNodes.has(inst.id + '_hot');

            return (
              <Group
                key={inst.id}
                x={inst.x}
                y={inst.y}
                onClick={() => selectInstance(inst.id)}
              >
                {/* Schematic box */}
                <Rect
                  width={shape.width}
                  height={shape.height}
                  cornerRadius={4}
                  fill="#121215"
                  stroke={isSelected ? shape.color : isActive ? shape.color : '#3f3f46'}
                  strokeWidth={isSelected ? 2 : 1}
                  shadowColor={shape.color}
                  shadowBlur={isSelected ? 16 : isActive ? 8 : 0}
                  shadowOpacity={0.7}
                  dash={isSelected ? [] : [4, 2]}
                />

                {/* Node identifier (schematic) */}
                <Text
                  x={4}
                  y={4}
                  width={shape.width - 8}
                  text={shape.label.toUpperCase()}
                  fontSize={9}
                  fontFamily="'JetBrains Mono', monospace"
                  fontStyle="bold"
                  fill={isActive ? shape.color : '#52525b'}
                  align="center"
                  listening={false}
                />

                {/* Lug terminals as schematic pins */}
                {shape.lugs.map((lug) => {
                  const px = lug.relX * shape.width;
                  const py = lug.relY * shape.height;
                  const lugNodeId = inst.id + lug.id;
                  const lugActive = activeNodes.has(lugNodeId);

                  return (
                    <Group key={lug.id}>
                      <Circle
                        x={px}
                        y={py}
                        radius={4}
                        fill={lugActive ? shape.color : '#1b1b1e'}
                        stroke={lugActive ? shape.color : '#52525b'}
                        strokeWidth={1.5}
                        shadowColor={shape.color}
                        shadowBlur={lugActive ? 8 : 0}
                        shadowOpacity={0.9}
                      />
                      <Text
                        x={px - 10}
                        y={py + 6}
                        width={20}
                        text={lug.label}
                        fontSize={7}
                        fontFamily="'JetBrains Mono', monospace"
                        fill="#52525b"
                        align="center"
                        listening={false}
                      />
                    </Group>
                  );
                })}
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
