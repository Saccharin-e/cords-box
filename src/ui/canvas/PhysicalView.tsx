/**
 * PhysicalView — Konva Stage for the guitar-body layout view.
 *
 * Implements professional CAD canvas features:
 * - Floating CAD Control Bar (Themes, Grid Styles, Snap-to-Grid, Rotate, Flip, Group, Copy/Paste, Undo/Redo)
 * - Canvas themes: Dark, Light, Blueprint, Vintage Paper
 * - Grid styles: Dot Matrix, Line Grid, Crosshatch, Isometric, None
 * - Keyboard shortcuts: Ctrl+C, Ctrl+V, Ctrl+D, Ctrl+A, Ctrl+Z, R, H, V, Delete, Arrow keys
 * - Multi-selection (Shift-click)
 */

import { useRef, useCallback, useState } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { ComponentNode } from './ComponentNode';
import { WireLayer, buildWireVisuals } from './WireLayer';
import { GridBackground } from './GridBackground';
import { CanvasControls } from './CanvasControls';
import { ExportBoxOverlay } from './ExportBoxOverlay';
import { useCanvasKeyboard } from './useCanvasKeyboard';
import { ContextMenu, type ContextMenuState } from '@ui/contextmenu/ContextMenu';
import { getShape } from './shapes';
import type { ComponentType } from '@graph/types';
import { generateComponentId } from '@graph/types';

const DRAG_TYPE_MAP: Record<string, ComponentType> = {
  pickup_sc:      'pickup_single_coil',
  pickup_hb:      'pickup_humbucker',
  switch_3way:    'switch_3way',
  switch_4way:    'switch_4way',
  switch_5way:    'switch_5way',
  switch_dpdt:    'switch_dpdt',
  pot_volume:     'pot_volume',
  pot_tone:       'pot_tone',
  pot_blend:      'pot_blend',
  pot_concentric: 'pot_concentric',
  capacitor:      'capacitor',
  resistor:       'resistor',
  output_jack:    'output_jack',
};

interface Props {
  width: number;
  height: number;
}

export function PhysicalView({ width, height }: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Activate global CAD keyboard shortcuts
  useCanvasKeyboard();

  const instances = useCanvasStore((s) => s.instances);
  const scale = useCanvasStore((s) => s.scale);
  const panX = useCanvasStore((s) => s.panX);
  const panY = useCanvasStore((s) => s.panY);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const wiringMode = useCanvasStore((s) => s.wiringMode);
  const pendingWire = useCanvasStore((s) => s.pendingWire);
  const themeMode = useCanvasStore((s) => s.themeMode);
  const gridStyle = useCanvasStore((s) => s.gridStyle);
  const gridSize = useCanvasStore((s) => s.gridSize);

  const addInstance = useCanvasStore((s) => s.addInstance);
  const moveInstance = useCanvasStore((s) => s.moveInstance);
  const selectInstance = useCanvasStore((s) => s.selectInstance);
  const setScale = useCanvasStore((s) => s.setScale);
  const setPan = useCanvasStore((s) => s.setPan);
  const cancelWiring = useCanvasStore((s) => s.cancelWiring);
  const updateWiringCursor = useCanvasStore((s) => s.updateWiringCursor);

  const { addComponent, solverResult, selectEdge, selectedEdgeId } = useCircuitStore();
  const graph = useCircuitStore((s) => s.graph);

  const activeEdges = solverResult?.activeEdges ?? new Set<string>();
  const wires = buildWireVisuals(() => graph.getEdges(), instances, activeEdges);

  /* ─── Drop from Component Library ──────────────────────────────────── */
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const dragId = e.dataTransfer.getData('componentId');
      const compType = DRAG_TYPE_MAP[dragId];
      if (!compType) return;

      const shape = getShape(compType);
      const stage = stageRef.current;
      if (!stage) return;

      const stageBox = stage.container().getBoundingClientRect();
      const dropX = (e.clientX - stageBox.left - panX) / scale;
      const dropY = (e.clientY - stageBox.top  - panY) / scale;
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

  /* ─── Stage Click ────────────────────────────────────────────────── */
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === stageRef.current) {
        selectInstance(null);
        selectEdge(null);
        if (wiringMode) cancelWiring();
      }
    },
    [selectInstance, selectEdge, wiringMode, cancelWiring],
  );

  /* ─── Cursor tracking for pending wire ─────────────────────────────── */
  const mouseRafRef = useRef<number | null>(null);
  const handleMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!pendingWire) return;
      const pos = stageRef.current?.getPointerPosition();
      if (!pos) return;
      if (mouseRafRef.current) cancelAnimationFrame(mouseRafRef.current);
      mouseRafRef.current = requestAnimationFrame(() => {
        updateWiringCursor((pos.x - panX) / scale, (pos.y - panY) / scale);
      });
    },
    [pendingWire, panX, panY, scale, updateWiringCursor],
  );

  /* ─── Context Menu Handler (Right Click) ────────────────────────────── */
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
      style={{
        position: 'relative',
        width,
        height,
        cursor: wiringMode ? 'crosshair' : 'grab',
        overflow: 'hidden',
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Floating CAD Options Toolbar */}
      <CanvasControls />

      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={scale}
        scaleY={scale}
        x={panX}
        y={panY}
        draggable={!wiringMode}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onMouseMove={handleMouseMove}
        onDragEnd={handleStageDragEnd}
        onContextMenu={handleContextMenu}
      >
        {/* Dynamic Grid Background Layer */}
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

        {/* Wire layer */}
        <WireLayer
          wires={wires}
          selectedEdgeId={selectedEdgeId}
          onSelectEdge={(edgeId) => selectEdge(edgeId)}
        />

        {/* Component layer */}
        <Layer>
          {instances.map((inst) => (
            <ComponentNode
              key={inst.id}
              instance={inst}
              isSelected={selectedIds.includes(inst.id)}
              onSelect={(evt) => {
                const multiSelect = evt.evt.shiftKey;
                selectInstance(inst.id, multiSelect);
                selectEdge(null);
              }}
              onDragEnd={(x, y) => moveInstance(inst.id, x, y)}
            />
          ))}
        </Layer>

        {/* Export Bounding Box Line Overlay Layer */}
        <Layer x={panX} y={panY} scaleX={scale} scaleY={scale}>
          <ExportBoxOverlay />
        </Layer>
      </Stage>

      {/* Floating Context Menu */}
      {contextMenu && (
        <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
      )}
    </div>
  );
}
