/**
 * ComponentNode — Konva shape for a single placed component.
 *
 * Renders as a neumorphic rounded rectangle with:
 * - Hardware-accent colored border/glow
 * - Component label and type badge
 * - Lug anchor dots for wiring
 */

import { Group, Rect, Circle, Text } from 'react-konva';
import type Konva from 'konva';
import type { CanvasComponentInstance } from '@store/canvasStore';
import { getShape, getLugAbsolutePosition } from './shapes';
import { useCanvasStore } from '@store/canvasStore';

interface Props {
  instance: CanvasComponentInstance;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}

export function ComponentNode({ instance, isSelected, onSelect, onDragEnd }: Props) {
  const shape = getShape(instance.type);
  const { wiringMode, startWiring } = useCanvasStore();

  const BG = '#1b1b1e';
  const SHADOW_DARK = 'rgba(0,0,0,0.7)';
  const SHADOW_LIGHT = 'rgba(255,255,255,0.06)';
  const accentColor = shape.color;

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onDragEnd(e.target.x(), e.target.y());
  }

  return (
    <Group
      x={instance.x}
      y={instance.y}
      draggable={!wiringMode}
      onClick={onSelect}
      onDragEnd={handleDragEnd}
    >
      {/* Drop shadow (extruded neumorphic) */}
      <Rect
        x={4}
        y={4}
        width={shape.width}
        height={shape.height}
        cornerRadius={8}
        fill={SHADOW_DARK}
        opacity={0.6}
      />
      <Rect
        x={-2}
        y={-2}
        width={shape.width}
        height={shape.height}
        cornerRadius={8}
        fill={SHADOW_LIGHT}
        opacity={0.7}
      />

      {/* Main body */}
      <Rect
        width={shape.width}
        height={shape.height}
        cornerRadius={8}
        fill={BG}
        stroke={isSelected ? accentColor : 'rgba(255,255,255,0.06)'}
        strokeWidth={isSelected ? 2 : 1}
        shadowColor={isSelected ? accentColor : 'transparent'}
        shadowBlur={isSelected ? 14 : 0}
        shadowOpacity={0.7}
      />

      {/* Accent stripe top */}
      <Rect
        y={0}
        width={shape.width}
        height={3}
        cornerRadius={[8, 8, 0, 0]}
        fill={accentColor}
        opacity={isSelected ? 1 : 0.5}
      />

      {/* Label */}
      <Text
        x={4}
        y={10}
        width={shape.width - 8}
        height={shape.height - 14}
        text={shape.label.toUpperCase()}
        fontSize={10}
        fontFamily="'JetBrains Mono', monospace"
        fontStyle="bold"
        fill={isSelected ? accentColor : '#a1a1aa'}
        align="center"
        verticalAlign="middle"
        listening={false}
      />

      {/* Lug anchors */}
      {shape.lugs.map((lug) => {
        const abs = getLugAbsolutePosition(shape, lug, 0, 0);
        return (
          <Group key={lug.id}>
            {/* Outer glow ring */}
            <Circle
              x={abs.x}
              y={abs.y}
              radius={8}
              fill="transparent"
              stroke={accentColor}
              strokeWidth={1}
              opacity={0.3}
            />
            {/* Inner dot */}
            <Circle
              x={abs.x}
              y={abs.y}
              radius={5}
              fill={wiringMode ? accentColor : '#121215'}
              stroke={accentColor}
              strokeWidth={1.5}
              shadowColor={accentColor}
              shadowBlur={wiringMode ? 10 : 4}
              shadowOpacity={0.8}
              onClick={(e) => {
                if (!wiringMode) return;
                e.cancelBubble = true;
                startWiring({
                  componentId: instance.id,
                  lugId: instance.id + lug.id,
                  x: instance.x + abs.x,
                  y: instance.y + abs.y,
                });
              }}
            />
            {/* Lug label */}
            <Text
              x={abs.x - 12}
              y={abs.y + 7}
              width={24}
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
}
