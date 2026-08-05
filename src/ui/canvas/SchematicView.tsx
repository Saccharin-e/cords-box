/**
 * SchematicView — Konva Stage for the node-based electrical schematic.
 *
 * Renders the circuit as a formal electrical schematic with:
 * - Standardized component symbols
 * - Net-highlighted signal paths
 * - Active path glow on signal-carrying wires
 * - Standard stage dragging, zoom-to-cursor, and right-click menu
 */

import { useRef, useCallback, useState, useMemo } from 'react';
import { Stage, Layer, Rect, Text, Circle, Group } from 'react-konva';
import type Konva from 'konva';
import { memo } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { WireLayer } from './WireLayer';
import { buildWireVisuals } from './wireUtils';
import { ContextMenu, type ContextMenuState } from '@ui/contextmenu/ContextMenu';
import { getShape } from './shapes';
import { GridBackground } from './GridBackground';

import { generateComponentId, type ComponentType } from '@graph/types';

const DRAG_TYPE_MAP: Record<string, ComponentType> = {
  pickup_sc: 'pickup_single_coil',
  pickup_p90: 'pickup_p90',
  pickup_hb: 'pickup_humbucker',
  switch_3way: 'switch_3way',
  switch_4way: 'switch_4way',
  switch_5way: 'switch_5way',
  switch_dpdt: 'switch_dpdt',
  pot_volume: 'pot_volume',
  pot_tone: 'pot_tone',
  pot_blend: 'pot_blend',
  pot_concentric: 'pot_concentric',
  pot_pushpull: 'pot_pushpull',
  battery_9v: 'battery_9v',
  ground_terminal: 'ground_terminal',
  treble_bleed: 'treble_bleed',
  text_box: 'text_box',
  project_card: 'project_card',
  shape_rect: 'shape_rect',
  shape_circle: 'shape_circle',
  shape_line: 'shape_line',
  shape_arrow: 'shape_arrow',
  capacitor: 'capacitor',
  resistor: 'resistor',
  output_jack: 'output_jack',
};

interface Props {
  width: number;
  height: number;
}

export function SchematicView({ width, height }: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const instances = useCanvasStore((s) => s.instances);
  const scale = useCanvasStore((s) => s.scale);
  const panX = useCanvasStore((s) => s.panX);
  const panY = useCanvasStore((s) => s.panY);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const themeMode = useCanvasStore((s) => s.themeMode);
  const gridStyle = useCanvasStore((s) => s.gridStyle);
  const gridSize = useCanvasStore((s) => s.gridSize);
  const selectInstance = useCanvasStore((s) => s.selectInstance);
  const setScale = useCanvasStore((s) => s.setScale);
  const setPan = useCanvasStore((s) => s.setPan);
  const addInstance = useCanvasStore((s) => s.addInstance);

  const selectEdge = useCircuitStore((s) => s.selectEdge);
  const selectedEdgeId = useCircuitStore((s) => s.selectedEdgeId);
  const addComponent = useCircuitStore((s) => s.addComponent);
  const graph = useCircuitStore((s) => s.graph);
  const solverResult = useCircuitStore((s) => s.solverResult);
  const activeEdges = useMemo(
    () => solverResult?.activeEdges ?? new Set<string>(),
    [solverResult],
  );
  const activeNodes = useMemo(
    () => solverResult?.activeNodes ?? new Set<string>(),
    [solverResult],
  );

  const wires = useMemo(
    () => buildWireVisuals(() => graph.getEdges(), instances, activeEdges),
    [graph, instances, activeEdges],
  );

  const handleSelectSymbol = useCallback(
    (id: string) => {
      selectInstance(id);
      selectEdge(null);
    },
    [selectInstance, selectEdge],
  );

  const handleSelectEdge = useCallback(
    (edgeId: string) => {
      selectEdge(edgeId);
    },
    [selectEdge],
  );

  /* ─── Drop from Component Library ──────────────────────────────────── */
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const dragId =
        e.dataTransfer.getData('componentId') ||
        e.dataTransfer.getData('text/plain') ||
        e.dataTransfer.getData('text');

      if (!dragId) return;

      const stage = stageRef.current;
      if (!stage) return;

      const stageBox = stage.container().getBoundingClientRect();
      const dropX = Math.round((e.clientX - stageBox.left - panX) / scale);
      const dropY = Math.round((e.clientY - stageBox.top - panY) / scale);

      if (dragId === 'wire' || dragId === 'hookup_wire') {
        const j1Id = `j_${Date.now()}_1`;
        const j2Id = `j_${Date.now()}_2`;

        const { addNode, addEdge } = useCircuitStore.getState();
        const { wireDrawOptions } = useCanvasStore.getState();

        addNode({
          id: j1Id,
          type: 'junction',
          componentId: 'canvas',
          signalState: 'inactive',
          position: { x: dropX - 45, y: dropY },
        });

        addNode({
          id: j2Id,
          type: 'junction',
          componentId: 'canvas',
          signalState: 'inactive',
          position: { x: dropX + 45, y: dropY },
        });

        const edgeId = `wire_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        addEdge({
          id: edgeId,
          source: j1Id,
          target: j2Id,
          resistance: 0,
          wireColor: wireDrawOptions.color,
          connectionType: wireDrawOptions.connectionType,
          wireType: wireDrawOptions.wireType,
        });

        useCanvasStore.getState().pushHistory();
        return;
      }

      const compType = DRAG_TYPE_MAP[dragId] || (dragId as ComponentType);
      if (!compType) return;

      const shape = getShape(compType);
      if (!shape) return;
      const id = generateComponentId();

      addInstance({
        id,
        type: compType,
        label: shape.label,
        x: dropX - shape.width / 2,
        y: dropY - shape.height / 2,
        width: shape.width,
        height: shape.height,
      });

      addComponent({ id, type: compType, label: shape.label });
    },
    [scale, panX, panY, addInstance, addComponent],
  );

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
    <div
      style={{ width, height, cursor: 'grab', position: 'relative', overflow: 'hidden' }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={handleDrop}
    >
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
          onSelectEdge={handleSelectEdge}
        />

        {/* Schematic symbols layer */}
        <Layer>
          {instances.map((inst) => (
            <SchematicSymbol
              key={inst.id}
              inst={inst}
              isSelected={selectedId === inst.id}
              activeNodes={activeNodes}
              onSelect={handleSelectSymbol}
            />
          ))}
        </Layer>
      </Stage>

      {/* Floating Context Menu */}
      {contextMenu && <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />}
    </div>
  );
}

interface SymbolProps {
  inst: ReturnType<typeof useCanvasStore.getState>['instances'][number];
  isSelected: boolean;
  activeNodes: ReadonlySet<string>;
  onSelect: (id: string) => void;
}

const SchematicSymbol = memo(function SchematicSymbol({
  inst,
  isSelected,
  activeNodes,
  onSelect,
}: SymbolProps) {
  const shape = getShape(inst.type);
  const isActive = activeNodes.has(inst.id + '_hot');

  return (
    <Group
      x={inst.x}
      y={inst.y}
      onClick={() => {
        onSelect(inst.id);
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
        const lugActive = activeNodes.has(inst.id + lug.id);

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
});
