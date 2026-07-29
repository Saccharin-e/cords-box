/**
 * PhysicalView — Konva Stage for the guitar-body layout view.
 *
 * Handles:
 * - Drag-drop from ComponentLibrary sidebar
 * - Component placement, selection, and drag-to-move
 * - Wire drawing via lug click-to-click
 * - Zoom (scroll wheel) and pan (middle mouse / space+drag)
 */

import { useRef, useCallback } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { ComponentNode } from './ComponentNode';
import { WireLayer, buildWireVisuals } from './WireLayer';
import { getShape } from './shapes';
import type { ComponentType } from '@graph/types';
import { generateComponentId } from '@graph/types';

// Map drag-type strings from ComponentLibrary to ComponentType enum
const DRAG_TYPE_MAP: Record<string, ComponentType> = {
  pickup_sc:    'pickup_single_coil',
  pickup_hb:    'pickup_humbucker',
  switch_3way:  'switch_3way',
  switch_4way:  'switch_4way',
  switch_5way:  'switch_5way',
  switch_dpdt:  'switch_dpdt',
  pot_volume:   'pot_volume',
  pot_tone:     'pot_tone',
  pot_blend:    'pot_blend',
  pot_concentric: 'pot_concentric',
  capacitor:    'capacitor',
  resistor:     'resistor',
  output_jack:  'output_jack',
};

interface Props {
  width: number;
  height: number;
}

export function PhysicalView({ width, height }: Props) {
  const stageRef = useRef<Konva.Stage>(null);

  const {
    instances, scale, panX, panY,
    selectedId, wiringMode, pendingWire,
    addInstance, moveInstance, selectInstance,
    setScale, cancelWiring,
    updateWiringCursor,
  } = useCanvasStore();

  const { addComponent, solverResult } = useCircuitStore();
  const graphEdges = useCircuitStore((s) => s.graph.getEdges.bind(s.graph));

  const activeEdges = solverResult?.activeEdges ?? new Set<string>();
  const wires = buildWireVisuals(graphEdges, instances, activeEdges);

  /* ─── Drop from sidebar ────────────────────────────────────────────── */
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

      // Register in Zustand canvas store
      addInstance({
        id,
        type: compType,
        label: shape.label,
        x: dropX - shape.width / 2,
        y: dropY - shape.height / 2,
        width: shape.width,
        height: shape.height,
      });

      // Register in graph store
      addComponent({ id, type: compType, label: shape.label });
    },
    [scale, panX, panY, addInstance, addComponent],
  );

  /* ─── Zoom ─────────────────────────────────────────────────────────── */
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const factor = e.evt.deltaY < 0 ? 1.08 : 0.93;
      setScale(scale * factor);
    },
    [scale, setScale],
  );

  /* ─── Canvas click (deselect / cancel wire) ─────────────────────────── */
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === stageRef.current) {
        selectInstance(null);
        if (wiringMode) cancelWiring();
      }
    },
    [selectInstance, wiringMode, cancelWiring],
  );

  /* ─── Cursor tracking for pending wire ─────────────────────────────── */
  const handleMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!pendingWire) return;
      const pos = stageRef.current?.getPointerPosition();
      if (pos) updateWiringCursor((pos.x - panX) / scale, (pos.y - panY) / scale);
    },
    [pendingWire, panX, panY, scale, updateWiringCursor],
  );

  return (
    <div
      style={{ width, height, cursor: wiringMode ? 'crosshair' : 'default' }}
      onDragOver={(e) => e.preventDefault()}
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
        onWheel={handleWheel}
        onClick={handleStageClick}
        onMouseMove={handleMouseMove}
      >
        {/* Wire layer rendered below components */}
        <WireLayer wires={wires} />

        {/* Component layer */}
        <Layer>
          {instances.map((inst) => (
            <ComponentNode
              key={inst.id}
              instance={inst}
              isSelected={selectedId === inst.id}
              onSelect={() => selectInstance(inst.id)}
              onDragEnd={(x, y) => moveInstance(inst.id, x, y)}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
