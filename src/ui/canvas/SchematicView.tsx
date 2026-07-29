/**
 * SchematicView — Konva Stage for the node-based electrical schematic.
 *
 * Renders the circuit as a formal electrical schematic with:
 * - Standardized component symbols
 * - Net-highlighted signal paths
 * - Active path glow on signal-carrying wires
 * - Standard stage dragging, zoom-to-cursor, and right-click menu
 */

import { useRef, useCallback, useState } from 'react';
import { Stage, Layer, Rect, Text, Circle, Group } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { WireLayer } from './WireLayer';
import { buildWireVisuals } from './wireUtils';
import { ContextMenu, type ContextMenuState } from '@ui/contextmenu/ContextMenu';
import { getShape } from './shapes';
import { GridBackground } from './GridBackground';

interface Props {
  width: number;
  height: number;
}

export function SchematicView({ width, height }: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const {
    instances,
    scale,
    panX,
    panY,
    selectedId,
    selectInstance,
    setScale,
    setPan,
    themeMode,
    gridStyle,
    gridSize,
  } = useCanvasStore();

  const { selectEdge, selectedEdgeId } = useCircuitStore();
  const graph = useCircuitStore((s) => s.graph);
  const solverResult = useCircuitStore((s) => s.solverResult);
  const activeEdges = solverResult?.activeEdges ?? new Set<string>();
  const activeNodes = solverResult?.activeNodes ?? new Set<string>();

  const wires = buildWireVisuals(() => graph.getEdges(), instances, activeEdges);

  /* ─── Zoom towards mouse pointer ────────────────────────────────────── */
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const zoomFactor = e.evt.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.min(3, Math.max(0.25, oldScale * zoomFactor));

      const mousePointTo = {
        x: (pointer.x - panX) / oldScale,
        y: (pointer.y - panY) / oldScale,
      };

      const newPanX = pointer.x - mousePointTo.x * newScale;
      const newPanY = pointer.y - mousePointTo.y * newScale;

      setScale(newScale);
      setPan(newPanX, newPanY);
    },
    [scale, panX, panY, setScale, setPan],
  );

  /* ─── Stage Drag/Pan End ───────────────────────────────────────────── */
  const handleStageDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (e.target === stageRef.current) {
        setPan(e.target.x(), e.target.y());
      }
    },
    [setPan],
  );

  /* ─── Context Menu Handler ─────────────────────────────────────────── */
  const handleContextMenu = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.evt.preventDefault();
      const mouseX = e.evt.clientX;
      const mouseY = e.evt.clientY;

      if (selectedId) {
        setContextMenu({ x: mouseX, y: mouseY, targetType: 'component', targetId: selectedId });
      } else if (selectedEdgeId) {
        setContextMenu({ x: mouseX, y: mouseY, targetType: 'wire', targetId: selectedEdgeId });
      } else {
        setContextMenu({ x: mouseX, y: mouseY, targetType: 'canvas' });
      }
    },
    [selectedId, selectedEdgeId],
  );

  return (
    <div style={{ width, height, cursor: 'grab' }}>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={scale}
        scaleY={scale}
        x={panX}
        y={panY}
        draggable
        onWheel={handleWheel}
        onDragEnd={handleStageDragEnd}
        onContextMenu={handleContextMenu}
        onClick={(e) => {
          if (e.target === stageRef.current) {
            selectInstance(null);
            selectEdge(null);
          }
        }}
      >
        <GridBackground
          width={width}
          height={height}
          themeMode={themeMode}
          gridStyle={gridStyle}
          gridSize={gridSize}
          scale={scale}
          panX={panX}
          panY={panY}
        />

        {/* Wires first */}
        <WireLayer
          wires={wires}
          selectedEdgeId={selectedEdgeId}
          onSelectEdge={(edgeId) => selectEdge(edgeId)}
        />

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
                onClick={() => {
                  selectInstance(inst.id);
                  selectEdge(null);
                }}
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

                {/* Node identifier */}
                <Text
                  x={4}
                  y={4}
                  width={shape.width - 8}
                  text={shape.label.toUpperCase()}
                  fontSize={9}
                  fontFamily="'JetBrains Mono', monospace"
                  fontStyle="bold"
                  fill={isActive ? shape.color : '#a1a1aa'}
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

      {/* Floating Context Menu */}
      {contextMenu && <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />}
    </div>
  );
}
