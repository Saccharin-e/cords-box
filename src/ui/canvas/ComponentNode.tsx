/**
 * ComponentNode — Realistic Photorealistic Component Renderers (DIYLC-style).
 *
 * Supports rotation, horizontal/vertical flipping, group outlines, and multi-selection handles.
 */

import { memo } from 'react';
import { Group, Rect, Circle, Text, Line, Path } from 'react-konva';
import type Konva from 'konva';
import type { CanvasComponentInstance } from '@store/canvasStore';
import { getShape, getLugAbsolutePosition } from './shapes';
import { useCanvasStore } from '@store/canvasStore';

interface Props {
  instance: CanvasComponentInstance;
  isSelected: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragEnd: (x: number, y: number) => void;
}

export const ComponentNode = memo(function ComponentNode({ instance, isSelected, onSelect, onDragEnd }: Props) {
  const shape = getShape(instance.type);
  const wiringMode = useCanvasStore((s) => s.wiringMode);
  const startWiring = useCanvasStore((s) => s.startWiring);
  const accentColor = shape.color;

  function handleDragStart(e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
  }

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
    onDragEnd(e.target.x(), e.target.y());
  }

  return (
    <Group
      x={instance.x}
      y={instance.y}
      rotation={instance.rotation ?? 0}
      scaleX={instance.flippedH ? -1 : 1}
      scaleY={instance.flippedV ? -1 : 1}
      offsetX={instance.flippedH ? shape.width : 0}
      offsetY={instance.flippedV ? shape.height : 0}
      draggable={!wiringMode}
      onClick={onSelect}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Drop Shadow */}
      <Rect
        x={3}
        y={3}
        width={shape.width}
        height={shape.height}
        cornerRadius={8}
        fill="rgba(0,0,0,0.5)"
        shadowBlur={8}
      />

      {/* Selection Glow Overlay */}
      {isSelected && (
        <Rect
          x={-3}
          y={-3}
          width={shape.width + 6}
          height={shape.height + 6}
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
          width={shape.width + 10}
          height={shape.height + 10}
          cornerRadius={12}
          stroke="#eab308"
          strokeWidth={1.5}
          dash={[6, 3]}
          opacity={0.8}
        />
      )}

      {/* Realistic Component Visual Graphic */}
      {renderPhysicalComponent(instance.type, shape.width, shape.height, instance.label)}

      {/* Component Title Overlay Badge */}
      <Text
        x={4}
        y={4}
        width={shape.width - 8}
        text={instance.label.toUpperCase()}
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

      {/* Component Lugs / Wire Terminals */}
      {shape.lugs.map((lug) => {
        // Compute unrotated relative position within the group
        const abs = getLugAbsolutePosition(shape, lug, 0, 0, 0, false, false);
        return (
          <Group key={lug.id}>
            {/* Outer halo ring */}
            <Circle
              x={abs.x}
              y={abs.y}
              radius={8}
              fill="transparent"
              stroke={accentColor}
              strokeWidth={1}
              opacity={0.6}
            />

            {/* Solder Lug Outer Ring */}
            <Circle
              x={abs.x}
              y={abs.y}
              radius={5.5}
              fill="#d4d4d8"
              stroke="#27272a"
              strokeWidth={1}
              shadowColor="#000"
              shadowBlur={3}
            />

            {/* Eyelet Solder Hole Center */}
            <Circle
              x={abs.x}
              y={abs.y}
              radius={2.5}
              fill="#18181b"
              cursor="crosshair"
              onClick={(e) => {
                e.cancelBubble = true;
                startWiring({
                  componentId: instance.id,
                  lugId: lug.id,
                  x: instance.x + abs.x,
                  y: instance.y + abs.y,
                });
              }}
            />

            {/* Lug Label Suffix */}
            <Text
              x={abs.x - 20}
              y={abs.y < shape.height / 2 ? abs.y - 14 : abs.y + 6}
              width={40}
              text={lug.label}
              fontSize={7}
              fontFamily="sans-serif"
              fill="#a1a1aa"
              align="center"
              listening={false}
            />
          </Group>
        );
      })}
    </Group>
  );
});

/** Render photorealistic graphics for component shapes */
function renderPhysicalComponent(
  type: CanvasComponentInstance['type'],
  w: number,
  h: number,
  _label: string,
) {
  switch (type) {
    case 'pickup_single_coil':
      return (
        <Group>
          <Rect width={w} height={h} cornerRadius={24} fill="#fef08a" stroke="#ca8a04" strokeWidth={2} />
          <Rect x={10} y={10} width={w - 20} height={h - 20} cornerRadius={16} fill="#fef9c3" stroke="#eab308" strokeWidth={1} />
          {/* 6 Alnico Pole Pieces */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Circle key={i} x={25 + i * (w - 50) / 5} y={h / 2} radius={5} fill="#a1a1aa" stroke="#52525b" strokeWidth={1} />
          ))}
        </Group>
      );
    case 'pickup_humbucker':
      return (
        <Group>
          <Rect width={w} height={h} cornerRadius={10} fill="#3f3f46" stroke="#18181b" strokeWidth={2} />
          <Rect x={6} y={6} width={w / 2 - 8} height={h - 12} cornerRadius={6} fill="#18181b" />
          <Rect x={w / 2 + 2} y={6} width={w / 2 - 8} height={h - 12} cornerRadius={6} fill="#18181b" />
          {/* Slotted & Hex Pole Screws */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Group key={i}>
              <Circle x={14 + i * (w / 2 - 24) / 5} y={h / 2} radius={4} fill="#e4e4e7" />
              <Circle x={w / 2 + 10 + i * (w / 2 - 24) / 5} y={h / 2} radius={4} fill="#a1a1aa" />
            </Group>
          ))}
        </Group>
      );
    case 'pot_volume':
    case 'pot_tone':
    case 'pot_blend':
      return (
        <Group>
          <Circle x={w / 2} y={h / 2 - 8} radius={w / 2 - 4} fill="#71717a" stroke="#3f3f46" strokeWidth={2} />
          <Circle x={w / 2} y={h / 2 - 8} radius={w / 3} fill="#a1a1aa" />
          <Circle x={w / 2} y={h / 2 - 8} radius={6} fill="#ca8a04" />
          <Rect x={w / 2 - 12} y={h - 18} width={24} height={14} fill="#3f3f46" cornerRadius={2} />
        </Group>
      );
    case 'pot_concentric':
      return (
        <Group>
          <Circle x={w / 2} y={h / 3} radius={w / 2 - 4} fill="#52525b" stroke="#27272a" strokeWidth={2} />
          <Circle x={w / 2} y={h / 3} radius={w / 4} fill="#ca8a04" />
          <Circle x={w / 2} y={h / 3} radius={6} fill="#e4e4e7" />
          <Rect x={10} y={h / 2 + 10} width={w - 20} height={20} fill="#3f3f46" cornerRadius={3} />
        </Group>
      );
    case 'switch_3way':
      return (
        <Group>
          <Rect width={w} height={h} cornerRadius={12} fill="#27272a" stroke="#00e5ff" strokeWidth={1.5} />
          <Circle x={w / 2} y={h / 2 - 10} radius={14} fill="#e4e4e7" stroke="#71717a" strokeWidth={2} />
          <Line points={[w / 2, h / 2 - 10, w / 2, h / 2 - 32]} stroke="#ca8a04" strokeWidth={6} lineCap="round" />
        </Group>
      );
    case 'switch_4way':
    case 'switch_5way':
      return (
        <Group>
          <Rect width={w} height={h} cornerRadius={6} fill="#1e293b" stroke="#0284c7" strokeWidth={1.5} />
          <Rect x={10} y={15} width={w - 20} height={12} fill="#0f172a" cornerRadius={2} />
          <Rect x={w / 2 - 4} y={8} width={8} height={26} fill="#ca8a04" cornerRadius={2} />
        </Group>
      );
    case 'switch_dpdt':
      return (
        <Group>
          <Rect width={w} height={h} cornerRadius={6} fill="#1d4ed8" stroke="#3b82f6" strokeWidth={1.5} />
          <Circle x={w / 2} y={h / 2} radius={12} fill="#93c5fd" />
          <Line points={[w / 2, h / 2, w / 2, h / 2 - 18]} stroke="#ca8a04" strokeWidth={5} lineCap="round" />
        </Group>
      );
    case 'capacitor':
      return (
        <Group>
          <Rect width={w} height={h} cornerRadius={h / 2} fill="#f97316" stroke="#c2410c" strokeWidth={1.5} />
          <Line points={[0, h / 2, w, h / 2]} stroke="#e4e4e7" strokeWidth={2} />
          <Rect x={12} y={4} width={w - 24} height={h - 8} cornerRadius={6} fill="#fdba74" />
        </Group>
      );
    case 'resistor':
      return (
        <Group>
          <Rect width={w} height={h} cornerRadius={h / 2} fill="#d1d5db" stroke="#9ca3af" strokeWidth={1.5} />
          <Line points={[0, h / 2, w, h / 2]} stroke="#e4e4e7" strokeWidth={2} />
          <Rect x={14} y={3} width={w - 28} height={h - 6} cornerRadius={4} fill="#f3f4f6" />
          {/* Color Bands */}
          <Rect x={22} y={3} width={4} height={h - 6} fill="#ef4444" />
          <Rect x={32} y={3} width={4} height={h - 6} fill="#3b82f6" />
          <Rect x={42} y={3} width={4} height={h - 6} fill="#eab308" />
          <Rect x={58} y={3} width={4} height={h - 6} fill="#ca8a04" />
        </Group>
      );
    case 'output_jack':
      return (
        <Group>
          <Rect width={w} height={h} cornerRadius={8} fill="#a1a1aa" stroke="#52525b" strokeWidth={2} />
          <Circle x={w / 2} y={h / 2} radius={18} fill="#27272a" />
          <Circle x={w / 2} y={h / 2} radius={12} fill="#e4e4e7" />
          <Path data="M 50 20 Q 65 30 65 40" stroke="#ca8a04" strokeWidth={3} fill="transparent" />
        </Group>
      );
    default:
      return <Rect width={w} height={h} fill="#3f3f46" cornerRadius={6} />;
  }
}
