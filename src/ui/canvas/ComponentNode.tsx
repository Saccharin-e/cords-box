/**
 * ComponentNode — Realistic Photorealistic Component Renderers (DIYLC-style).
 *
 * Supports rotation, horizontal/vertical flipping, group outlines, and multi-selection handles.
 */

import { memo, useRef } from 'react';
import { Group, Rect, Circle, Text, Line, Path } from 'react-konva';
import type Konva from 'konva';
import type { CanvasComponentInstance } from '@store/canvasStore';
import { getShape, getLugAbsolutePosition } from './shapes';
import { resolveWireTarget } from './wireUtils';
import { useCanvasStore } from '@store/canvasStore';

interface Props {
  instance: CanvasComponentInstance;
  isSelected: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragEnd: (x: number, y: number) => void;
}

export const ComponentNode = memo(function ComponentNode({
  instance,
  isSelected,
  onSelect,
  onDragEnd,
}: Props) {
  const shape = getShape(instance.type);
  const wiringMode = useCanvasStore((s) => s.wiringMode);
  const startWiring = useCanvasStore((s) => s.startWiring);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const instances = useCanvasStore((s) => s.instances);
  const moveInstances = useCanvasStore((s) => s.moveInstances);
  const showComponentLabels = useCanvasStore((s) => s.showComponentLabels);
  const accentColor = shape.color;

  const startPosRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  function handleDragStart(e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
    startPosRef.current.clear();

    const isMulti = selectedIds.includes(instance.id) && selectedIds.length > 1;
    const targetIds = isMulti ? selectedIds : [instance.id];

    for (const inst of instances) {
      if (targetIds.includes(inst.id)) {
        startPosRef.current.set(inst.id, { x: inst.x, y: inst.y });
      }
    }
  }

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
    const newX = e.target.x();
    const newY = e.target.y();

    const initialSelfPos = startPosRef.current.get(instance.id) ?? {
      x: instance.x,
      y: instance.y,
    };
    const dx = newX - initialSelfPos.x;
    const dy = newY - initialSelfPos.y;

    if (selectedIds.includes(instance.id) && selectedIds.length > 1) {
      const deltas: { id: string; x: number; y: number }[] = [];
      startPosRef.current.forEach((start, id) => {
        deltas.push({ id, x: start.x + dx, y: start.y + dy });
      });
      moveInstances(deltas);
    } else {
      onDragEnd(newX, newY);
    }
  }

  const nodeW = instance.width || shape.width;
  const nodeH = instance.height || shape.height;

  function handleTransformEnd(e: Konva.KonvaEventObject<Event>) {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const newWidth = Math.max(20, Math.round(nodeW * scaleX));
    const newHeight = Math.max(20, Math.round(nodeH * scaleY));
    useCanvasStore.getState().updateInstance(instance.id, {
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      width: newWidth,
      height: newHeight,
    });
  }

  function handleComponentClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if ((window as any).__wireJustCompleted) {
      (window as any).__wireJustCompleted = false;
      return;
    }

    if (wiringMode) {
      e.cancelBubble = true;
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!pointer) return;

      const scale = useCanvasStore.getState().scale;
      const panX = useCanvasStore.getState().panX;
      const panY = useCanvasStore.getState().panY;

      const canvasX = Math.round((pointer.x - panX) / scale);
      const canvasY = Math.round((pointer.y - panY) / scale);

      const pendingWire = useCanvasStore.getState().pendingWire;
      if (pendingWire) {
        const target = resolveWireTarget(canvasX, canvasY, pendingWire.from);
        useCanvasStore.getState().completeWiring(target);
      } else {
        const target = resolveWireTarget(canvasX, canvasY);
        useCanvasStore.getState().startWiring(target);
      }
      return;
    }

    onSelect(e);
  }

  return (
    <Group
      id={instance.id}
      x={instance.x}
      y={instance.y}
      rotation={instance.rotation ?? 0}
      scaleX={instance.flippedH ? -1 : 1}
      scaleY={instance.flippedV ? -1 : 1}
      offsetX={instance.flippedH ? nodeW : 0}
      offsetY={instance.flippedV ? nodeH : 0}
      draggable={!wiringMode}
      onClick={handleComponentClick}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      {/* Drop Shadow for Hardware Components */}
      {!instance.type.startsWith('shape_') && instance.type !== 'text_box' && (
        <Rect
          x={3}
          y={3}
          width={nodeW}
          height={nodeH}
          cornerRadius={8}
          fill="rgba(0,0,0,0.4)"
          shadowBlur={8}
        />
      )}

      {/* Selection Glow Overlay */}
      {isSelected && (
        <Rect
          x={-3}
          y={-3}
          width={nodeW + 6}
          height={nodeH + 6}
          cornerRadius={10}
          stroke={accentColor}
          strokeWidth={2.5}
          shadowColor={accentColor}
          shadowBlur={14}
          shadowOpacity={0.9}
        />
      )}

      {/* Grouped Outline Indicator */}
      {instance.groupId && (
        <Rect
          x={-5}
          y={-5}
          width={nodeW + 10}
          height={nodeH + 10}
          cornerRadius={12}
          stroke="#eab308"
          strokeWidth={1.5}
          dash={[6, 3]}
          opacity={0.8}
        />
      )}

      {/* Realistic Component Visual Graphic */}
      {renderPhysicalComponent(instance, nodeW, nodeH, instance.customLabel || instance.label || shape.label)}

      {/* Component Title Overlay Badge (Toggleable) */}
      {showComponentLabels && instance.type !== 'text_box' && instance.type !== 'project_card' && !instance.type.startsWith('shape_') && (
        <Text
          x={4}
          y={4}
          width={nodeW - 8}
          text={(instance.customLabel || instance.label || shape.label).toUpperCase()}
          fontSize={8}
          fontFamily="'JetBrains Mono', monospace"
          fontStyle="bold"
          fill={isSelected ? accentColor : '#e4e4e7'}
          align="center"
          shadowColor="#000"
          shadowBlur={4}
          shadowOpacity={0.9}
          listening={false}
        />
      )}

      {/* Component Lugs / Wire Terminals */}
      {shape.lugs.map((lug) => {
        const abs = getLugAbsolutePosition(shape, lug, 0, 0, 0, false, false);
        const displayLugLabel = instance.customLugLabels?.[lug.id] || lug.label;

        const thisAnchor = {
          componentId: instance.id,
          lugId: lug.id,
          x: instance.x + abs.x,
          y: instance.y + abs.y,
        };

        const handleLugMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
          e.cancelBubble = true;
          const cx = 'clientX' in e.evt ? e.evt.clientX : e.evt.touches[0]?.clientX ?? 0;
          const cy = 'clientY' in e.evt ? e.evt.clientY : e.evt.touches[0]?.clientY ?? 0;
          const startX = cx;
          const startY = cy;

          // Check if we already have a pending wire (click-click second click scenario)
          const existingPending = useCanvasStore.getState().pendingWire;
          if (existingPending) {
            // Don't set up drag listeners — let click handle completion
            return;
          }

          let hasDragged = false;
          let wireStarted = false;

          const onWindowMove = (moveEvt: MouseEvent) => {
            const dx = moveEvt.clientX - startX;
            const dy = moveEvt.clientY - startY;
            const dist = Math.hypot(dx, dy);

            if (dist > 6) {
              hasDragged = true;

              // Lazily start wiring on first drag movement
              if (!wireStarted) {
                wireStarted = true;
                startWiring(thisAnchor);
              }

              // Update wire cursor position
              const stage = e.target.getStage();
              if (stage) {
                const rect = stage.container().getBoundingClientRect();
                const scale = useCanvasStore.getState().scale;
                const panX = useCanvasStore.getState().panX;
                const panY = useCanvasStore.getState().panY;
                const canvasX = (moveEvt.clientX - rect.left - panX) / scale;
                const canvasY = (moveEvt.clientY - rect.top - panY) / scale;
                useCanvasStore.getState().updateWiringCursor(canvasX, canvasY);
              }
            }
          };

          const onWindowUp = (upEvt: MouseEvent) => {
            window.removeEventListener('mousemove', onWindowMove);
            window.removeEventListener('mouseup', onWindowUp);

            if (hasDragged && wireStarted) {
              const stage = e.target.getStage();
              if (!stage) return;

              const rect = stage.container().getBoundingClientRect();
              const scale = useCanvasStore.getState().scale;
              const panX = useCanvasStore.getState().panX;
              const panY = useCanvasStore.getState().panY;

              const canvasX = Math.round((upEvt.clientX - rect.left - panX) / scale);
              const canvasY = Math.round((upEvt.clientY - rect.top - panY) / scale);

              const pendingWire = useCanvasStore.getState().pendingWire;
              if (pendingWire) {
                const target = resolveWireTarget(canvasX, canvasY, pendingWire.from);
                useCanvasStore.getState().completeWiring(target);
              }
              // Block the trailing click event from doing anything
              (window as any).__wireJustCompleted = true;
              setTimeout(() => {
                (window as any).__wireJustCompleted = false;
              }, 100);
            }
          };

          window.addEventListener('mousemove', onWindowMove);
          window.addEventListener('mouseup', onWindowUp);
        };

        const handleLugClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
          e.cancelBubble = true;

          // Block trailing click after a drag-complete
          if ((window as any).__wireJustCompleted) {
            (window as any).__wireJustCompleted = false;
            return;
          }

          const pendingWire = useCanvasStore.getState().pendingWire;
          if (!pendingWire) {
            // No pending wire — start a new wire from this lug (click-click mode)
            startWiring(thisAnchor);
          } else {
            // Pending wire exists — check for self-wire
            if (
              pendingWire.from.componentId === instance.id &&
              pendingWire.from.lugId === lug.id
            ) {
              // Clicking the same lug we started from — cancel the wire
              useCanvasStore.getState().cancelWiring();
              // Re-enable wiring mode since user likely wants to keep wiring
              useCanvasStore.setState({ wiringMode: true });
              return;
            }
            // Complete wire to this lug
            useCanvasStore.getState().completeWiring(thisAnchor);
          }
        };

        return (
          <Group key={lug.id}>
            {/* Outer halo ring */}
            <Circle
              x={abs.x}
              y={abs.y}
              radius={wiringMode ? 10 : 8}
              fill="transparent"
              stroke={wiringMode ? '#22c55e' : accentColor}
              strokeWidth={wiringMode ? 2 : 1}
              opacity={wiringMode ? 0.9 : 0.6}
            />

            {/* Solder Lug Outer Ring */}
            <Circle
              x={abs.x}
              y={abs.y}
              radius={5.5}
              fill="#d4d4d8"
              stroke="#27272a"
              strokeWidth={1}
              shadowColor={wiringMode ? '#22c55e' : '#000'}
              shadowBlur={wiringMode ? 8 : 3}
            />

            {/* Eyelet Solder Hole Center */}
            <Circle
              x={abs.x}
              y={abs.y}
              radius={2.5}
              fill="#18181b"
            />

            {/* LARGE INVISIBLE HIT TARGET FOR EASY CLICKING, DRAGGING & HOVERING */}
            <Circle
              x={abs.x}
              y={abs.y}
              radius={16}
              fill="rgba(0,0,0,0.001)"
              cursor="crosshair"
              onMouseDown={handleLugMouseDown}
              onPointerDown={handleLugMouseDown}
              onClick={handleLugClick}
              onTap={handleLugClick}
            />

            {/* Lug Label Suffix */}
            {showComponentLabels && (
              <Text
                x={abs.x - 25}
                y={abs.y < shape.height / 2 ? abs.y - 14 : abs.y + 6}
                width={50}
                text={displayLugLabel}
                fontSize={7}
                fontFamily="sans-serif"
                fill={wiringMode ? '#4ade80' : '#a1a1aa'}
                align="center"
                listening={false}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
});

/** Render photorealistic graphics for component shapes */
function renderPhysicalComponent(
  instance: CanvasComponentInstance,
  w: number,
  h: number,
  displayLabel: string,
) {
  const { type, textValue, authorValue, modelValue, revisionValue, colorTheme } = instance;
  const isCream = colorTheme === 'cream';
  const isBlack = colorTheme === 'black';
  switch (type) {
    case 'pickup_single_coil':
      return (
        <Group>
          <Rect
            width={w}
            height={h}
            cornerRadius={24}
            fill={isBlack ? '#27272a' : isCream ? '#fef3c7' : '#fef08a'}
            stroke={isBlack ? '#18181b' : '#ca8a04'}
            strokeWidth={2}
          />
          <Rect
            x={10}
            y={10}
            width={w - 20}
            height={h - 20}
            cornerRadius={16}
            fill={isBlack ? '#3f3f46' : isCream ? '#fffbeb' : '#fef9c3'}
            stroke={isBlack ? '#52525b' : '#eab308'}
            strokeWidth={1}
          />
          {/* 6 Alnico Pole Pieces */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Circle
              key={i}
              x={25 + (i * (w - 50)) / 5}
              y={h / 2}
              radius={5}
              fill="#a1a1aa"
              stroke="#52525b"
              strokeWidth={1}
            />
          ))}
        </Group>
      );

    case 'pickup_p90':
      return (
        <Group>
          {/* Soapbar Outer Cover */}
          <Rect
            width={w}
            height={h}
            cornerRadius={12}
            fill={isBlack ? '#18181b' : '#fef3c7'}
            stroke={isBlack ? '#3f3f46' : '#d97706'}
            strokeWidth={2}
          />
          {/* Mounting Screw Holes */}
          <Circle x={18} y={h / 2} radius={3.5} fill="#71717a" stroke="#27272a" strokeWidth={1} />
          <Circle x={w - 18} y={h / 2} radius={3.5} fill="#71717a" stroke="#27272a" strokeWidth={1} />
          {/* 6 Adjustable Screw Pole Pieces */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Circle
              key={i}
              x={35 + (i * (w - 70)) / 5}
              y={h / 2}
              radius={4.5}
              fill="#d4d4d8"
              stroke="#3f3f46"
              strokeWidth={1}
            />
          ))}
        </Group>
      );
    case 'pickup_humbucker':
      return (
        <Group>
          {/* Baseplate Metal Flange */}
          <Rect
            width={w}
            height={h}
            cornerRadius={8}
            fill="#52525b"
            stroke="#27272a"
            strokeWidth={1.5}
          />
          {/* Side Mounting Feet with Screw Holes */}
          <Circle x={10} y={h / 2} radius={3.5} fill="#d4d4d8" stroke="#27272a" strokeWidth={1} />
          <Circle x={w - 10} y={h / 2} radius={3.5} fill="#d4d4d8" stroke="#27272a" strokeWidth={1} />

          {/* Tape-Wrapped Bobbin Enclosure */}
          <Rect
            x={18}
            y={8}
            width={w - 36}
            height={h - 26}
            cornerRadius={6}
            fill="#18181b"
            stroke="#09090b"
            strokeWidth={1.5}
          />
          {/* North Coil (Alnico Slug Bobbin) */}
          <Rect x={22} y={11} width={w - 44} height={22} cornerRadius={4} fill="#27272a" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Circle
              key={`slug-${i}`}
              x={30 + (i * (w - 60)) / 5}
              y={22}
              radius={4}
              fill="#e4e4e7"
              stroke="#71717a"
              strokeWidth={1}
            />
          ))}

          {/* South Coil (Adjustable Pole Screw Bobbin) */}
          <Rect x={22} y={35} width={w - 44} height={22} cornerRadius={4} fill="#27272a" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Group key={`screw-${i}`}>
              <Circle
                x={30 + (i * (w - 60)) / 5}
                y={46}
                radius={4}
                fill="#a1a1aa"
                stroke="#3f3f46"
                strokeWidth={1}
              />
              <Line
                points={[
                  30 + (i * (w - 60)) / 5 - 2.5,
                  46,
                  30 + (i * (w - 60)) / 5 + 2.5,
                  46,
                ]}
                stroke="#18181b"
                strokeWidth={1}
              />
            </Group>
          ))}

          {/* Bottom Baseplate Solder Eyelet Tabs */}
          {[0.15, 0.32, 0.49, 0.66, 0.83].map((rx, idx) => (
            <Circle
              key={`ey-${idx}`}
              x={w * rx}
              y={h * 0.9}
              radius={3.5}
              fill="#27272a"
              stroke="#d4d4d8"
              strokeWidth={1}
            />
          ))}
        </Group>
      );
    case 'pot_volume':
    case 'pot_tone':
      return (
        <Group>
          {/* 3 Protruding Metallic Solder Lug Tabs at Bottom */}
          {[
            { x: w * 0.2, label: '1' },
            { x: w * 0.5, label: '2' },
            { x: w * 0.8, label: '3' },
          ].map((lug, idx) => (
            <Group key={idx}>
              <Rect
                x={lug.x - 7}
                y={h * 0.6}
                width={14}
                height={h * 0.32}
                fill="#d4d4d8"
                stroke="#52525b"
                strokeWidth={1}
                cornerRadius={3}
              />
              <Circle
                x={lug.x}
                y={h * 0.9}
                radius={4}
                fill="#27272a"
                stroke="#d4d4d8"
                strokeWidth={1}
              />
            </Group>
          ))}
          {/* Main Metallic Pot Casing */}
          <Circle
            x={w / 2}
            y={h * 0.4}
            radius={w * 0.38}
            fill="#a1a1aa"
            stroke="#3f3f46"
            strokeWidth={2}
          />
          {/* Threaded Mounting Bushing */}
          <Circle
            x={w / 2}
            y={h * 0.4}
            radius={w * 0.22}
            fill="#d4d4d8"
            stroke="#71717a"
            strokeWidth={1.5}
          />
          {/* Brass Control Shaft Center */}
          <Circle
            x={w / 2}
            y={h * 0.4}
            radius={w * 0.12}
            fill="#eab308"
            stroke="#ca8a04"
            strokeWidth={1}
          />
        </Group>
      );

    case 'pot_blend':
    case 'pot_concentric':
      return (
        <Group>
          {/* Upper Pot Lugs */}
          {[w * 0.18, w * 0.5, w * 0.82].map((lx, idx) => (
            <Rect
              key={`u-${idx}`}
              x={lx - 6}
              y={h * 0.2}
              width={12}
              height={h * 0.25}
              fill="#d4d4d8"
              stroke="#52525b"
              strokeWidth={1}
              cornerRadius={2}
            />
          ))}
          {/* Upper Metallic Pot Casing */}
          <Circle
            x={w / 2}
            y={h * 0.25}
            radius={w * 0.32}
            fill="#9ca3af"
            stroke="#4b5563"
            strokeWidth={1.5}
          />

          {/* Lower Pot Lugs */}
          {[w * 0.18, w * 0.5, w * 0.82].map((lx, idx) => (
            <Rect
              key={`l-${idx}`}
              x={lx - 6}
              y={h * 0.65}
              width={12}
              height={h * 0.28}
              fill="#d4d4d8"
              stroke="#52525b"
              strokeWidth={1}
              cornerRadius={2}
            />
          ))}
          {/* Lower Metallic Pot Casing */}
          <Circle
            x={w / 2}
            y={h * 0.7}
            radius={w * 0.32}
            fill="#6b7280"
            stroke="#374151"
            strokeWidth={1.5}
          />
          {/* Concentric Shaft Center */}
          <Circle x={w / 2} y={h * 0.25} radius={10} fill="#ca8a04" />
        </Group>
      );

    case 'pot_pushpull':
      return (
        <Group>
          {/* Top Pot Metallic Lugs Aligned to relY: 0.35 */}
          {[w * 0.2, w * 0.5, w * 0.8].map((lx, idx) => (
            <Rect
              key={`pot-${idx}`}
              x={lx - 6}
              y={h * 0.15}
              width={12}
              height={h * 0.22}
              fill="#d4d4d8"
              stroke="#52525b"
              strokeWidth={1}
              cornerRadius={2}
            />
          ))}
          {/* Metallic Pot Casing */}
          <Circle
            x={w / 2}
            y={h * 0.2}
            radius={w * 0.34}
            fill="#d4d4d8"
            stroke="#71717a"
            strokeWidth={2}
          />
          <Circle x={w / 2} y={h * 0.2} radius={8} fill="#eab308" stroke="#ca8a04" strokeWidth={1} />

          {/* DPDT Switch Blue Block Body Below */}
          <Rect
            x={w * 0.12}
            y={h * 0.55}
            width={w * 0.76}
            height={h * 0.42}
            cornerRadius={6}
            fill="#1d4ed8"
            stroke="#3b82f6"
            strokeWidth={1.5}
          />
          {/* 6 DPDT Solder Pins Protruding Out Aligned to relY: 0.68, 0.80, 0.92 */}
          {[0.68, 0.8, 0.92].map((ry, rowIdx) => (
            <Group key={`dpdt-${rowIdx}`}>
              <Circle
                cx={w * 0.25}
                cy={h * ry}
                r={4.5}
                fill="#e4e4e7"
                stroke="#18181b"
                strokeWidth={1}
              />
              <Circle
                cx={w * 0.75}
                cy={h * ry}
                r={4.5}
                fill="#e4e4e7"
                stroke="#18181b"
                strokeWidth={1}
              />
            </Group>
          ))}
        </Group>
      );

    case 'switch_3way':
      return (
        <Group>
          {/* Top Contact Lug Tabs */}
          {[0.15, 0.5, 0.85].map((rx, idx) => (
            <Rect
              key={idx}
              x={w * rx - 5}
              y={h * 0.1}
              width={10}
              height={h * 0.2}
              fill="#d4d4d8"
              stroke="#52525b"
              strokeWidth={1}
              cornerRadius={2}
            />
          ))}
          {/* Main Heavy Toggle Casing */}
          <Rect
            x={w * 0.12}
            y={h * 0.28}
            width={w * 0.76}
            height={h * 0.5}
            cornerRadius={8}
            fill="#27272a"
            stroke="#00e5ff"
            strokeWidth={1.5}
          />
          <Circle
            x={w / 2}
            y={h * 0.53}
            radius={14}
            fill="#e4e4e7"
            stroke="#71717a"
            strokeWidth={2}
          />
          <Line
            points={[w / 2, h * 0.53, w / 2, h * 0.22]}
            stroke="#ca8a04"
            strokeWidth={6}
            lineCap="round"
          />
          {/* Bottom Common Output Solder Lug Tab */}
          <Rect
            x={w * 0.5 - 6}
            y={h * 0.78}
            width={12}
            height={h * 0.18}
            fill="#d4d4d8"
            stroke="#52525b"
            strokeWidth={1}
            cornerRadius={2}
          />
        </Group>
      );

    case 'switch_4way':
      return (
        <Group>
          {/* Metal Mounting Frame */}
          <Rect
            width={w}
            height={h * 0.45}
            cornerRadius={6}
            fill="#334155"
            stroke="#0284c7"
            strokeWidth={1.5}
          />
          <Rect x={12} y={8} width={w - 24} height={10} fill="#0f172a" cornerRadius={2} />
          <Rect x={w / 2 - 4} y={2} width={8} height={20} fill="#ca8a04" cornerRadius={2} />

          {/* Phenolic Wafer Lug Board */}
          <Rect
            x={w * 0.04}
            y={h * 0.5}
            width={w * 0.92}
            height={h * 0.28}
            fill="#78350f"
            stroke="#451a03"
            strokeWidth={1}
            cornerRadius={4}
          />
          {/* 10 Protruding Metallic Solder Teeth Lugs for 4-Way Blade */}
          {[0.08, 0.17, 0.26, 0.35, 0.44, 0.56, 0.65, 0.74, 0.83, 0.92].map((rx, idx) => (
            <Rect
              key={idx}
              x={w * rx - 4}
              y={h * 0.75}
              width={8}
              height={h * 0.2}
              fill="#e4e4e7"
              stroke="#475569"
              strokeWidth={1}
              cornerRadius={2}
            />
          ))}
        </Group>
      );

    case 'switch_5way':
      return (
        <Group>
          {/* Metal Mounting Frame */}
          <Rect
            width={w}
            height={h * 0.45}
            cornerRadius={6}
            fill="#334155"
            stroke="#0284c7"
            strokeWidth={1.5}
          />
          <Rect x={12} y={8} width={w - 24} height={10} fill="#0f172a" cornerRadius={2} />
          <Rect x={w / 2 - 4} y={2} width={8} height={20} fill="#ca8a04" cornerRadius={2} />

          {/* Phenolic Wafer Lug Board */}
          <Rect
            x={w * 0.04}
            y={h * 0.5}
            width={w * 0.92}
            height={h * 0.28}
            fill="#78350f"
            stroke="#451a03"
            strokeWidth={1}
            cornerRadius={4}
          />
          {/* 8 Protruding Metallic Solder Teeth Lugs for 5-Way Blade */}
          {[0.08, 0.2, 0.32, 0.44, 0.56, 0.68, 0.8, 0.92].map((rx, idx) => (
            <Rect
              key={idx}
              x={w * rx - 4}
              y={h * 0.75}
              width={8}
              height={h * 0.2}
              fill="#e4e4e7"
              stroke="#475569"
              strokeWidth={1}
              cornerRadius={2}
            />
          ))}
        </Group>
      );

    case 'switch_dpdt':
      return (
        <Group>
          {/* Blue DPDT Epoxy Body */}
          <Rect
            x={w * 0.15}
            y={h * 0.12}
            width={w * 0.7}
            height={h * 0.76}
            cornerRadius={6}
            fill="#1d4ed8"
            stroke="#3b82f6"
            strokeWidth={1.5}
          />
          {/* Toggle Bat Lever */}
          <Circle x={w / 2} y={h / 2} radius={12} fill="#93c5fd" />
          <Line points={[w / 2, h / 2, w / 2, h * 0.2]} stroke="#ca8a04" strokeWidth={5} lineCap="round" />
          {/* 6 Protruding Solder Pins */}
          {[0.22, 0.53, 0.84].map((ry, rowIdx) => (
            <Group key={rowIdx}>
              <Circle x={w * 0.28} y={h * ry} radius={4} fill="#e4e4e7" stroke="#1e293b" strokeWidth={1} />
              <Circle x={w * 0.72} y={h * ry} radius={4} fill="#e4e4e7" stroke="#1e293b" strokeWidth={1} />
            </Group>
          ))}
        </Group>
      );

    case 'capacitor':
      return (
        <Group>
          {/* Axial Silver Lead Wires Extending Out Left & Right */}
          <Line points={[0, h / 2, w, h / 2]} stroke="#d4d4d8" strokeWidth={2.5} />
          {/* Orange Drop / Film Capacitor Body in Center */}
          <Rect
            x={w * 0.2}
            y={h * 0.12}
            width={w * 0.6}
            height={h * 0.76}
            cornerRadius={8}
            fill="#f97316"
            stroke="#c2410c"
            strokeWidth={1.5}
          />
          <Rect
            x={w * 0.24}
            y={h * 0.2}
            width={w * 0.52}
            height={h * 0.6}
            cornerRadius={6}
            fill="#fdba74"
          />
        </Group>
      );

    case 'resistor':
      return (
        <Group>
          {/* Axial Silver Lead Wires */}
          <Line points={[0, h / 2, w, h / 2]} stroke="#d4d4d8" strokeWidth={2.5} />
          {/* Ceramic Resistor Body */}
          <Rect
            x={w * 0.22}
            y={h * 0.15}
            width={w * 0.56}
            height={h * 0.7}
            cornerRadius={6}
            fill="#f3f4f6"
            stroke="#9ca3af"
            strokeWidth={1.5}
          />
          {/* Color Code Bands */}
          <Rect x={w * 0.3} y={h * 0.15} width={4} height={h * 0.7} fill="#ef4444" />
          <Rect x={w * 0.4} y={h * 0.15} width={4} height={h * 0.7} fill="#3b82f6" />
          <Rect x={w * 0.5} y={h * 0.15} width={4} height={h * 0.7} fill="#eab308" />
          <Rect x={w * 0.66} y={h * 0.15} width={4} height={h * 0.7} fill="#ca8a04" />
        </Group>
      );

    case 'battery_9v':
      return (
        <Group>
          {/* 9V Battery Casing */}
          <Rect
            width={w}
            height={h}
            cornerRadius={8}
            fill="#18181b"
            stroke="#eab308"
            strokeWidth={2}
          />
          {/* Golden 9V Brand Stripe */}
          <Rect x={0} y={22} width={w} height={24} fill="#eab308" />
          <Text
            x={0}
            y={28}
            width={w}
            text="ACTIVE 9V"
            fontSize={9}
            fontFamily="sans-serif"
            fontStyle="bold"
            fill="#000"
            align="center"
          />
          {/* Battery Snap Terminals on Top */}
          <Circle x={w * 0.35} y={h * 0.92} radius={5} fill="#a1a1aa" stroke="#3f3f46" strokeWidth={1} />
          <Circle x={w * 0.65} y={h * 0.92} radius={6.5} fill="#d4d4d8" stroke="#3f3f46" strokeWidth={1} />
        </Group>
      );

    case 'ground_terminal':
      return (
        <Group>
          {/* Brass Star Ground Ring Plate */}
          <Rect
            width={w}
            height={h}
            cornerRadius={25}
            fill="#3f3f46"
            stroke="#e2e8f0"
            strokeWidth={2}
          />
          <Text
            x={0}
            y={8}
            width={w}
            text="STAR GROUND"
            fontSize={8}
            fontFamily="monospace"
            fontStyle="bold"
            fill="#e2e8f0"
            align="center"
          />
        </Group>
      );

    case 'treble_bleed':
      return (
        <Group>
          {/* Axial Silver Lead Wires */}
          <Line points={[0, h / 2, w, h / 2]} stroke="#d4d4d8" strokeWidth={2.5} />
          {/* Treble Bleed Circuit Module */}
          <Rect
            x={w * 0.15}
            y={h * 0.1}
            width={w * 0.7}
            height={h * 0.8}
            cornerRadius={8}
            fill="#581c87"
            stroke="#c084fc"
            strokeWidth={1.5}
          />
          <Text
            x={0}
            y={h / 2 - 4}
            width={w}
            text="TREBLE BLEED"
            fontSize={7}
            fontFamily="sans-serif"
            fontStyle="bold"
            fill="#f3e8ff"
            align="center"
          />
        </Group>
      );

    case 'text_box':
      return (
        <Group>
          <Rect
            width={w}
            height={h}
            cornerRadius={instance.cornerRadius ?? 6}
            fill={instance.fillColor || 'transparent'}
            stroke={instance.strokeColor || '#38bdf8'}
            strokeWidth={instance.strokeWidth ?? 1.5}
            dash={instance.dashStyle === 'dashed' ? [6, 4] : instance.dashStyle === 'dotted' ? [2, 3] : [6, 4]}
          />
          <Text
            x={10}
            y={10}
            width={w - 20}
            height={h - 20}
            text={textValue || 'Double click in Inspector to edit notes / instructions…'}
            fontSize={11}
            fontFamily="'Inter', sans-serif"
            fill={instance.strokeColor || '#e4e4e7'}
            wrap="word"
          />
        </Group>
      );

    case 'project_card':
      return (
        <Group>
          {/* CAD Blueprint Title Block Frame */}
          <Rect
            width={w}
            height={h}
            cornerRadius={instance.cornerRadius ?? 6}
            fill={instance.fillColor || '#0f172a'}
            stroke={instance.strokeColor || '#38bdf8'}
            strokeWidth={instance.strokeWidth ?? 2}
          />
          {/* Title Banner */}
          <Rect x={0} y={0} width={w} height={26} fill="#0284c7" cornerRadius={[6, 6, 0, 0]} />
          <Text
            x={10}
            y={6}
            width={w - 20}
            text={displayLabel || 'GUITAR WIRING HARNESS'}
            fontSize={11}
            fontFamily="'Inter', sans-serif"
            fontStyle="bold"
            fill="#ffffff"
          />
          {/* Specs Lines */}
          <Line points={[0, 26, w, 26]} stroke="#38bdf8" strokeWidth={1} />
          <Line points={[0, 85, w, 85]} stroke="#1e293b" strokeWidth={1} />

          <Text
            x={12}
            y={32}
            width={w - 24}
            text={`AUTHOR: ${authorValue || 'Luthier Studio'}`}
            fontSize={9}
            fontFamily="monospace"
            fontStyle="bold"
            fill="#38bdf8"
          />
          <Text
            x={12}
            y={46}
            width={w - 24}
            text={`MODEL: ${modelValue || 'Stratocaster / Telecaster'}`}
            fontSize={9}
            fontFamily="monospace"
            fill="#cbd5e1"
          />
          <Text
            x={12}
            y={60}
            width={w - 24}
            text={`DATE / REV: ${revisionValue || '2026-07-30 · Rev 1.0'}`}
            fontSize={8}
            fontFamily="monospace"
            fill="#94a3b8"
          />
          <Text
            x={12}
            y={92}
            width={w - 24}
            height={h - 96}
            text={`SPECS: ${textValue || '250k CTS Pots, Orange Drop 0.047uF Cap, Treble Bleed'}`}
            fontSize={9}
            fontFamily="sans-serif"
            fill="#e2e8f0"
            wrap="word"
          />
        </Group>
      );

    case 'shape_rect':
      return (
        <Group>
          <Rect
            width={w}
            height={h}
            cornerRadius={instance.cornerRadius ?? 6}
            fill={instance.fillColor || 'transparent'}
            stroke={instance.strokeColor || '#a855f7'}
            strokeWidth={instance.strokeWidth ?? 2}
            dash={instance.dashStyle === 'dashed' ? [6, 4] : instance.dashStyle === 'dotted' ? [2, 3] : undefined}
          />
          <Text
            x={10}
            y={10}
            width={w - 20}
            text={displayLabel || ''}
            fontSize={10}
            fontFamily="monospace"
            fontStyle="bold"
            fill={instance.strokeColor || '#c084fc'}
          />
        </Group>
      );

    case 'shape_circle':
      return (
        <Group>
          <Circle
            x={w / 2}
            y={h / 2}
            radius={Math.min(w, h) / 2 - 2}
            fill={instance.fillColor || 'transparent'}
            stroke={instance.strokeColor || '#38bdf8'}
            strokeWidth={instance.strokeWidth ?? 2}
            dash={instance.dashStyle === 'dashed' ? [4, 4] : instance.dashStyle === 'dotted' ? [2, 3] : undefined}
          />
          <Text
            x={0}
            y={h / 2 - 5}
            width={w}
            text={displayLabel || ''}
            fontSize={10}
            fontFamily="monospace"
            fontStyle="bold"
            fill={instance.strokeColor || '#38bdf8'}
            align="center"
          />
        </Group>
      );

    case 'shape_line':
      return (
        <Group>
          <Line
            points={[0, h / 2, w, h / 2]}
            stroke={instance.strokeColor || '#e2e8f0'}
            strokeWidth={instance.strokeWidth ?? 2.5}
            dash={instance.dashStyle === 'dashed' ? [6, 4] : instance.dashStyle === 'dotted' ? [2, 3] : undefined}
          />
          <Text
            x={0}
            y={h / 2 - 14}
            width={w}
            text={displayLabel || ''}
            fontSize={8}
            fontFamily="monospace"
            fill={instance.strokeColor || '#94a3b8'}
            align="center"
          />
        </Group>
      );

    case 'shape_arrow':
      return (
        <Group>
          <Line
            points={[0, h / 2, w - 12, h / 2]}
            stroke={instance.strokeColor || '#eab308'}
            strokeWidth={instance.strokeWidth ?? 2.5}
            dash={instance.dashStyle === 'dashed' ? [6, 4] : instance.dashStyle === 'dotted' ? [2, 3] : undefined}
          />
          <Path
            data={`M ${w - 14} ${h / 2 - 6} L ${w} ${h / 2} L ${w - 14} ${h / 2 + 6} Z`}
            fill={instance.strokeColor || '#eab308'}
          />
          <Text
            x={0}
            y={h / 2 - 14}
            width={w - 16}
            text={displayLabel || ''}
            fontSize={8}
            fontFamily="sans-serif"
            fontStyle="bold"
            fill={instance.strokeColor || '#fef08a'}
          />
        </Group>
      );

    case 'output_jack':
      return (
        <Group>
          <Rect
            width={w}
            height={h}
            cornerRadius={8}
            fill="#a1a1aa"
            stroke="#52525b"
            strokeWidth={2}
          />
          <Circle x={w / 2} y={h / 2} radius={18} fill="#27272a" />
          <Circle x={w / 2} y={h / 2} radius={12} fill="#e4e4e7" />
          <Path data="M 50 20 Q 65 30 65 40" stroke="#ca8a04" strokeWidth={3} fill="transparent" />
        </Group>
      );
    default:
      return <Rect width={w} height={h} fill="#3f3f46" cornerRadius={6} />;
  }
}
