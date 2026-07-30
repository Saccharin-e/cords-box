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

import { useRef, useCallback, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { ComponentNode } from './ComponentNode';
import { WireLayer } from './WireLayer';
import { buildWireVisuals } from './wireUtils';
import { GridBackground } from './GridBackground';
import { CanvasControls } from './CanvasControls';
import { WireOptionsPanel } from './WireOptionsPanel';
import { ExportBoxOverlay } from './ExportBoxOverlay';
import { useCanvasKeyboard } from './useCanvasKeyboard';
import { ContextMenu, type ContextMenuState } from '@ui/contextmenu/ContextMenu';
import { getShape, getAllCanvasLugs } from './shapes';
import type { ComponentType } from '@graph/types';
import { generateComponentId } from '@graph/types';
import type { WireAnchor } from '@store/canvasStore';

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

export function PhysicalView({ width, height }: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPanDraggingRef = useRef(false);
  const panStartPosRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });

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
  const updateWiringCursor = useCanvasStore((s) => s.updateWiringCursor);

  const { addComponent, solverResult, selectEdge, selectedEdgeId } = useCircuitStore();
  const graph = useCircuitStore((s) => s.graph);

  const trRef = useRef<Konva.Transformer>(null);

  const activeEdges = solverResult?.activeEdges ?? new Set<string>();
  const wires = buildWireVisuals(() => graph.getEdges(), instances, activeEdges);

  useEffect(() => {
    if (trRef.current && stageRef.current) {
      if (selectedIds.length === 1) {
        const id = selectedIds[0];
        const selectedNode = stageRef.current.findOne('#' + id);
        if (selectedNode) {
          trRef.current.nodes([selectedNode]);
          trRef.current.getLayer()?.batchDraw();
          return;
        }
      }
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selectedIds, instances]);

  /* ─── Drop from Component Library ──────────────────────────────────── */
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const dragId = e.dataTransfer.getData('componentId');

      const stage = stageRef.current;
      if (!stage) return;

      const stageBox = stage.container().getBoundingClientRect();
      const dropX = Math.round((e.clientX - stageBox.left - panX) / scale);
      const dropY = Math.round((e.clientY - stageBox.top - panY) / scale);

      // Handle standalone Wire drag & drop directly onto the canvas
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

        return;
      }

      const compType = DRAG_TYPE_MAP[dragId];
      if (!compType) return;

      const shape = getShape(compType);
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

  const startWiring = useCanvasStore((s) => s.startWiring);

  /* ─── Stage Click ────────────────────────────────────────────────── */
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === stageRef.current) {
        selectInstance(null);
        selectEdge(null);
        if (wiringMode) {
          const stage = stageRef.current;
          if (!stage) return;
          const pos = stage.getPointerPosition();
          if (!pos) return;
          const canvasX = Math.round((pos.x - panX) / scale);
          const canvasY = Math.round((pos.y - panY) / scale);

          // Find if there's an existing lug nearby (within 20px)
          const allLugs = getAllCanvasLugs(instances);
          let targetAnchor: WireAnchor | null = null;
          let minDistance = 20;

          for (const lug of allLugs) {
            const dx = lug.x - canvasX;
            const dy = lug.y - canvasY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDistance) {
              minDistance = dist;
              targetAnchor = {
                componentId: lug.componentId,
                lugId: lug.lugId,
                x: lug.x,
                y: lug.y,
              };
            }
          }

          // If no lug nearby, create a free canvas junction node anywhere on the canvas
          if (!targetAnchor) {
            const junctionId = `j_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            useCircuitStore.getState().addNode({
              id: junctionId,
              type: 'junction',
              componentId: 'canvas',
              signalState: 'inactive',
              position: { x: canvasX, y: canvasY },
            });
            targetAnchor = {
              componentId: junctionId,
              lugId: '',
              x: canvasX,
              y: canvasY,
            };
          }

          startWiring(targetAnchor);
        }
      }
    },
    [selectInstance, selectEdge, wiringMode, panX, panY, scale, instances, startWiring],
  );

  const selectionBoxRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  function updateSelectionBox(box: { x1: number; y1: number; x2: number; y2: number } | null) {
    selectionBoxRef.current = box;
    setSelectionBox(box);
  }

  /* ─── Cursor tracking & Mouse Move ─────────────────────────────── */
  const mouseRafRef = useRef<number | null>(null);

  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Middle Mouse Button (button 1) OR Alt + Right/Left Click -> Pan Viewport
      if (e.evt.button === 1 || (e.evt.altKey && (e.evt.button === 0 || e.evt.button === 2))) {
        isPanDraggingRef.current = true;
        setIsPanning(true);
        panStartPosRef.current = {
          mouseX: e.evt.clientX,
          mouseY: e.evt.clientY,
          panX,
          panY,
        };
        return;
      }

      // Left Click on empty Stage area -> Start Marquee Rectangular Selection
      const isDraggableTarget = e.target !== stageRef.current && Boolean(e.target.draggable());
      if (!isDraggableTarget && e.evt.button === 0 && !wiringMode) {
        const stage = stageRef.current;
        if (!stage) return;
        const pos = stage.getPointerPosition();
        if (!pos) return;

        const canvasX = (pos.x - panX) / scale;
        const canvasY = (pos.y - panY) / scale;

        isSelectingRef.current = true;
        selectionStartRef.current = { x: canvasX, y: canvasY };
        updateSelectionBox({ x1: canvasX, y1: canvasY, x2: canvasX, y2: canvasY });
      }
    },
    [panX, panY, scale, wiringMode],
  );

  const handleMouseMoveCombined = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanDraggingRef.current) {
        const dx = e.evt.clientX - panStartPosRef.current.mouseX;
        const dy = e.evt.clientY - panStartPosRef.current.mouseY;
        setPan(panStartPosRef.current.panX + dx, panStartPosRef.current.panY + dy);
        return;
      }

      if (isSelectingRef.current && stageRef.current) {
        const pos = stageRef.current.getPointerPosition();
        if (pos) {
          const canvasX = (pos.x - panX) / scale;
          const canvasY = (pos.y - panY) / scale;
          updateSelectionBox({
            x1: selectionStartRef.current.x,
            y1: selectionStartRef.current.y,
            x2: canvasX,
            y2: canvasY,
          });
        }
      }

      if (pendingWire) {
        const pos = stageRef.current?.getPointerPosition();
        if (pos) {
          if (mouseRafRef.current) cancelAnimationFrame(mouseRafRef.current);
          mouseRafRef.current = requestAnimationFrame(() => {
            updateWiringCursor((pos.x - panX) / scale, (pos.y - panY) / scale);
          });
        }
      }
    },
    [panX, panY, scale, setPan, pendingWire, updateWiringCursor],
  );

  const handleStageMouseUp = useCallback(() => {
    if (isPanDraggingRef.current) {
      isPanDraggingRef.current = false;
      setIsPanning(false);
    }

    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      const box = selectionBoxRef.current;
      if (box) {
        const minX = Math.min(box.x1, box.x2);
        const maxX = Math.max(box.x1, box.x2);
        const minY = Math.min(box.y1, box.y2);
        const maxY = Math.max(box.y1, box.y2);

        if (maxX - minX > 5 || maxY - minY > 5) {
          const currentInstances = useCanvasStore.getState().instances;
          const currentEdges = useCircuitStore.getState().graph.getEdges();

          // 1. Select matching components within rectangle
          const selectedComponents = currentInstances.filter((inst) => {
            const shape = getShape(inst.type);
            const w = shape.width;
            const h = shape.height;
            const instLeft = inst.x;
            const instRight = inst.x + w;
            const instTop = inst.y;
            const instBottom = inst.y + h;
            return instLeft <= maxX && instRight >= minX && instTop <= maxY && instBottom >= minY;
          });
          useCanvasStore.getState().setSelectedIds(selectedComponents.map((i) => i.id));

          // 2. Select matching wire (edge) within rectangle
          const wireVisuals = buildWireVisuals(() => currentEdges, currentInstances, new Set());
          const hitWire = wireVisuals.find((w) => {
            const inBox = (px: number, py: number) =>
              px >= minX && px <= maxX && py >= minY && py <= maxY;
            if (inBox(w.x1, w.y1) || inBox(w.x2, w.y2)) return true;
            if (w.controlPoint && inBox(w.controlPoint.x, w.controlPoint.y)) return true;
            if (w.controlPoints?.some((cp) => inBox(cp.x, cp.y))) return true;
            return false;
          });

          if (hitWire) {
            selectEdge(hitWire.id);
          } else if (selectedComponents.length > 0) {
            selectEdge(null);
          }
        } else {
          useCanvasStore.getState().clearSelection();
          selectEdge(null);
        }
      }
      updateSelectionBox(null);
    }
  }, [selectEdge]);

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

  const canvasCursor = wiringMode ? 'crosshair' : isPanning ? 'grabbing' : 'default';

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        cursor: canvasCursor,
        overflow: 'hidden',
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Floating CAD Options Toolbar */}
      <CanvasControls />

      {/* DIYLC-Style Wire Configuration Panel */}
      <WireOptionsPanel />

      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={scale}
        scaleY={scale}
        x={panX}
        y={panY}
        draggable={false}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseUp={handleStageMouseUp}
        onClick={handleStageClick}
        onMouseMove={handleMouseMoveCombined}
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
          <Transformer
            ref={trRef}
            boundBoxFunc={(oldBox, newBox) => {
              // Enforce min width / height of 15px
              if (Math.abs(newBox.width) < 15 || Math.abs(newBox.height) < 15) {
                return oldBox;
              }
              return newBox;
            }}
            anchorSize={7}
            anchorCornerRadius={2}
            anchorFill="#38bdf8"
            anchorStroke="#0284c7"
            borderStroke="#38bdf8"
            borderDash={[4, 4]}
          />
        </Layer>

        {/* Selection Box Overlay Layer */}
        {selectionBox && (
          <Layer listening={false}>
            <Rect
              x={Math.min(selectionBox.x1, selectionBox.x2)}
              y={Math.min(selectionBox.y1, selectionBox.y2)}
              width={Math.abs(selectionBox.x2 - selectionBox.x1)}
              height={Math.abs(selectionBox.y2 - selectionBox.y1)}
              fill="rgba(59, 130, 246, 0.18)"
              stroke="#3b82f6"
              strokeWidth={1 / scale}
              dash={[4 / scale, 4 / scale]}
            />
          </Layer>
        )}

        {/* Export Bounding Box Line Overlay Layer */}
        <Layer x={panX} y={panY} scaleX={scale} scaleY={scale}>
          <ExportBoxOverlay />
        </Layer>
      </Stage>

      {/* Floating Context Menu */}
      {contextMenu && <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />}
    </div>
  );
}
