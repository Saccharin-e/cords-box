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
import { getAllCanvasLugs } from './shapes';
import type { CircuitEdge } from '@graph/types';
import type { WireVisual } from './wireUtils';

export type { WireVisual };

interface Props {
  wires: WireVisual[];
  selectedEdgeId?: string | null;
  onSelectEdge?: (edgeId: string) => void;
}

import { memo, useRef } from 'react';

export const WireLayer = memo(function WireLayer({ wires, selectedEdgeId, onSelectEdge }: Props) {
  const pendingWire = useCanvasStore((s) => s.pendingWire);
  const instances = useCanvasStore((s) => s.instances);
  const addNode = useCircuitStore((s) => s.addNode);
  const removeEdge = useCircuitStore((s) => s.removeEdge);
  const addEdge = useCircuitStore((s) => s.addEdge);
  const updateEdge = useCircuitStore((s) => s.updateEdge);
  const graph = useCircuitStore((s) => s.graph);

  const wireRafRef = useRef<number | null>(null);

  function handleEndpointDragMove(
    wire: WireVisual,
    endpoint: 'source' | 'target',
    e: Konva.KonvaEventObject<DragEvent>,
  ) {
    e.cancelBubble = true;
    const moveX = Math.round(e.target.x());
    const moveY = Math.round(e.target.y());

    if (wireRafRef.current) cancelAnimationFrame(wireRafRef.current);
    wireRafRef.current = requestAnimationFrame(() => {
      const existingEdge = graph.getEdges().find((ed) => ed.id === wire.id);
      if (!existingEdge) return;

      const targetNodeId = endpoint === 'source' ? existingEdge.source : existingEdge.target;
      const nodes = graph.getNodes();
      const node = nodes.find((n) => n.id === targetNodeId);

      if (node && node.type === 'junction' && node.position) {
        node.position = { x: moveX, y: moveY };
      } else {
        const tempJunctionId = `j_${wire.id}_${endpoint}`;
        const existingTempNode = nodes.find((n) => n.id === tempJunctionId);
        if (existingTempNode) {
          existingTempNode.position = { x: moveX, y: moveY };
        } else {
          addNode({
            id: tempJunctionId,
            type: 'junction',
            componentId: 'canvas',
            signalState: 'inactive',
            position: { x: moveX, y: moveY },
          });
        }
        if (endpoint === 'source') {
          existingEdge.source = tempJunctionId;
        } else {
          existingEdge.target = tempJunctionId;
        }
      }

      updateEdge(wire.id, {}, true, true);
    });
  }

  function handleEndpointDragEnd(
    wire: WireVisual,
    endpoint: 'source' | 'target',
    e: Konva.KonvaEventObject<DragEvent>,
  ) {
    e.cancelBubble = true;
    const dropX = Math.round(e.target.x());
    const dropY = Math.round(e.target.y());

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
    if (existingEdge) {
      let targetNodeId: string;
      if (closestLug) {
        targetNodeId = closestLug.nodeId;
      } else {
        targetNodeId = `j_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        addNode({
          id: targetNodeId,
          type: 'junction',
          componentId: 'canvas',
          signalState: 'inactive',
          position: { x: dropX, y: dropY },
        });
      }

      const newSource = endpoint === 'source' ? targetNodeId : existingEdge.source;
      const newTarget = endpoint === 'target' ? targetNodeId : existingEdge.target;

      removeEdge(wire.id);
      addEdge({
        ...existingEdge,
        source: newSource,
        target: newTarget,
      });
    }
  }

  function handleMultiControlPointDrag(
    wire: WireVisual,
    idx: number,
    e: Konva.KonvaEventObject<DragEvent>,
    skipSolve = false,
  ) {
    e.cancelBubble = true;
    const existing = graph.getEdges().find((ed) => ed.id === wire.id);
    if (!existing) return;

    const pts = existing.controlPoints ? [...existing.controlPoints] : [];
    pts[idx] = { x: Math.round(e.target.x()), y: Math.round(e.target.y()) };

    updateEdge(wire.id, { controlPoints: pts }, skipSolve, skipSolve);
  }

  function handleControlPointDrag(
    wire: WireVisual,
    e: Konva.KonvaEventObject<DragEvent>,
    skipSolve = false,
  ) {
    e.cancelBubble = true;
    updateEdge(
      wire.id,
      {
        controlPoint: { x: Math.round(e.target.x()), y: Math.round(e.target.y()) },
      },
      skipSolve,
      skipSolve,
    );
  }

  function handleResetControlPoint(wire: WireVisual, e: Konva.KonvaEventObject<MouseEvent>) {
    e.cancelBubble = true;
    updateEdge(wire.id, {
      controlPoint: undefined,
      controlPoints: undefined,
    });
  }

  function handleWireGroupDragEnd(wire: WireVisual, e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
    const dx = e.target.x();
    const dy = e.target.y();
    e.target.x(0);
    e.target.y(0);

    if (dx === 0 && dy === 0) return;

    const existingEdge = graph.getEdges().find((ed) => ed.id === wire.id);
    if (!existingEdge) return;

    const nodes = graph.getNodes();
    const srcNode = nodes.find((n) => n.id === existingEdge.source);
    if (srcNode && srcNode.type === 'junction' && srcNode.position) {
      srcNode.position = {
        x: Math.round(srcNode.position.x + dx),
        y: Math.round(srcNode.position.y + dy),
      };
    }

    const tgtNode = nodes.find((n) => n.id === existingEdge.target);
    if (tgtNode && tgtNode.type === 'junction' && tgtNode.position) {
      tgtNode.position = {
        x: Math.round(tgtNode.position.x + dx),
        y: Math.round(tgtNode.position.y + dy),
      };
    }

    const updates: Partial<CircuitEdge> = {};
    if (existingEdge.controlPoint) {
      updates.controlPoint = {
        x: Math.round(existingEdge.controlPoint.x + dx),
        y: Math.round(existingEdge.controlPoint.y + dy),
      };
    }
    if (existingEdge.controlPoints) {
      updates.controlPoints = existingEdge.controlPoints.map((p) => ({
        x: Math.round(p.x + dx),
        y: Math.round(p.y + dy),
      }));
    }

    updateEdge(wire.id, updates, false);
  }

  return (
    <Layer>
      {/* Committed Wires */}
      {wires.map((wire) => {
        const isSelected = selectedEdgeId === wire.id;
        const strokeColor = isSelected
          ? '#ef4444'
          : wire.isActive
            ? wire.color
            : (wire.color ?? '#ff8c00');
        const strokeW = isSelected ? 4 : wire.isActive ? 3.5 : 2.5;

        const hasMultiPts = Boolean(wire.controlPoints && wire.controlPoints.length > 0);

        // Calculate control point coordinates for curve rendering
        let points: number[] = [];
        let cpHandles: { x: number; y: number; index: number }[] = [];

        if (hasMultiPts && wire.controlPoints) {
          points = [
            wire.x1,
            wire.y1,
            ...wire.controlPoints.flatMap((p) => [p.x, p.y]),
            wire.x2,
            wire.y2,
          ];
          cpHandles = wire.controlPoints.map((p, idx) => ({ ...p, index: idx }));
        } else {
          const defaultMidX = (wire.x1 + wire.x2) / 2;
          const defaultMidY = (wire.y1 + wire.y2) / 2 + (wire.y2 - wire.y1) * 0.15;
          const cpX = wire.controlPoint ? wire.controlPoint.x : defaultMidX;
          const cpY = wire.controlPoint ? wire.controlPoint.y : defaultMidY;
          points = [wire.x1, wire.y1, cpX, cpY, wire.x2, wire.y2];
          cpHandles = [{ x: cpX, y: cpY, index: -1 }];
        }

        return (
          <Group
            key={wire.id}
            draggable={isSelected}
            onDragStart={(evt) => {
              evt.cancelBubble = true;
            }}
            onDragEnd={(evt) => {
              // Ensure we only handle drag events originating from the Group itself
              if (evt.target.getType() === 'Group') {
                handleWireGroupDragEnd(wire, evt);
              }
            }}
          >
            {/* Wire Line Curve */}
            <Line
              points={points}
              tension={0.35}
              stroke={strokeColor}
              strokeWidth={strokeW}
              hitStrokeWidth={16}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
              shadowColor={strokeColor}
              shadowBlur={isSelected || wire.isActive ? 8 : 0}
              shadowOpacity={0.8}
              lineCap="round"
              lineJoin="round"
              onClick={(evt) => {
                evt.cancelBubble = true;
                if ((window as any).__wireJustCompleted) {
                  (window as any).__wireJustCompleted = false;
                  return;
                }
                const isWiringMode = useCanvasStore.getState().wiringMode;
                if (isWiringMode) {
                  const stage = evt.target.getStage();
                  const pos = stage?.getPointerPosition();
                  if (pos) {
                    const scale = useCanvasStore.getState().scale;
                    const panX = useCanvasStore.getState().panX;
                    const panY = useCanvasStore.getState().panY;
                    const canvasX = Math.round((pos.x - panX) / scale);
                    const canvasY = Math.round((pos.y - panY) / scale);
                    const pendingWire = useCanvasStore.getState().pendingWire;
                    if (pendingWire) {
                      import('./wireUtils').then(({ resolveWireTarget }) => {
                        const target = resolveWireTarget(canvasX, canvasY, pendingWire.from);
                        useCanvasStore.getState().completeWiring(target);
                      });
                    } else {
                      import('./wireUtils').then(({ resolveWireTarget }) => {
                        const target = resolveWireTarget(canvasX, canvasY);
                        useCanvasStore.getState().startWiring(target);
                      });
                    }
                  }
                  return;
                }
                onSelectEdge?.(wire.id);
              }}
            />

            {/* Visual Guide Lines when wire is selected */}
            {isSelected && (
              <Group listening={false}>
                <Line
                  points={points}
                  stroke="rgba(255, 255, 255, 0.3)"
                  strokeWidth={1}
                  dash={[4, 4]}
                />
              </Group>
            )}

            {/* Draggable Handles ONLY visible when wire is selected */}
            {isSelected && (
              <>
                {/* Draggable Endpoint Handle P1 (Source Lug Handle) */}
                <Circle
                  x={wire.x1}
                  y={wire.y1}
                  radius={6}
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  draggable
                  onDragStart={(evt) => {
                    evt.cancelBubble = true;
                  }}
                  onDragMove={(evt) => handleEndpointDragMove(wire, 'source', evt)}
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
                  radius={6}
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  draggable
                  onDragStart={(evt) => {
                    evt.cancelBubble = true;
                  }}
                  onDragMove={(evt) => handleEndpointDragMove(wire, 'target', evt)}
                  onDragEnd={(evt) => handleEndpointDragEnd(wire, 'target', evt)}
                  onClick={(evt) => {
                    evt.cancelBubble = true;
                    onSelectEdge?.(wire.id);
                  }}
                />

                {/* Draggable Mid-Point Control Handles (Bend Anywhere) */}
                {cpHandles.map((handle, idx) => (
                  <Circle
                    key={idx}
                    x={handle.x}
                    y={handle.y}
                    radius={6.5}
                    fill="#ef4444"
                    stroke={strokeColor}
                    strokeWidth={2}
                    draggable
                    onDragStart={(evt) => {
                      evt.cancelBubble = true;
                    }}
                    onDragMove={(evt) => {
                      if (handle.index >= 0) {
                        handleMultiControlPointDrag(wire, handle.index, evt, true);
                      } else {
                        handleControlPointDrag(wire, evt, true);
                      }
                    }}
                    onDragEnd={(evt) => {
                      if (handle.index >= 0) {
                        handleMultiControlPointDrag(wire, handle.index, evt, false);
                      } else {
                        handleControlPointDrag(wire, evt, false);
                      }
                    }}
                    onDblClick={(evt) => handleResetControlPoint(wire, evt)}
                    onClick={(evt) => {
                      evt.cancelBubble = true;
                      onSelectEdge?.(wire.id);
                    }}
                    cursor="move"
                  />
                ))}
              </>
            )}
          </Group>
        );
      })}

      {/* Pending Wire (In-Progress Draw) */}
      {pendingWire && (
        <Line
          points={[pendingWire.from.x, pendingWire.from.y, pendingWire.toX, pendingWire.toY]}
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
