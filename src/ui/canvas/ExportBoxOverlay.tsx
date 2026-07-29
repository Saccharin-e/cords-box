/**
 * ExportBoxOverlay — Draggable / Resizable Canvas Crop Region Indicator Line.
 *
 * Displays a glowing cyan dashed box on the canvas highlighting the exact region
 * that will be exported as PNG or PDF.
 */

import { memo } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@store/canvasStore';

export const ExportBoxOverlay = memo(function ExportBoxOverlay() {
  const exportBox = useCanvasStore((s) => s.exportBox);
  const showExportBox = useCanvasStore((s) => s.showExportBox);
  const setExportBox = useCanvasStore((s) => s.setExportBox);
  const gridSize = useCanvasStore((s) => s.gridSize);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);

  if (!showExportBox) return null;

  const { x, y, width, height } = exportBox;

  function snap(val: number) {
    return snapToGrid ? Math.round(val / gridSize) * gridSize : Math.round(val);
  }

  function handleMainDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
    const newX = snap(e.target.x());
    const newY = snap(e.target.y());
    setExportBox({ x: Math.max(0, newX), y: Math.max(0, newY) });
  }

  function handleTopLeftDrag(e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
    const handleX = e.target.x();
    const handleY = e.target.y();
    const newWidth = Math.max(100, snap(x + width - handleX));
    const newHeight = Math.max(100, snap(y + height - handleY));
    const newX = snap(x + width - newWidth);
    const newY = snap(y + height - newHeight);
    setExportBox({ x: newX, y: newY, width: newWidth, height: newHeight });
  }

  function handleBottomRightDrag(e: Konva.KonvaEventObject<DragEvent>) {
    e.cancelBubble = true;
    const handleX = e.target.x();
    const handleY = e.target.y();
    const newWidth = Math.max(100, snap(handleX - x));
    const newHeight = Math.max(100, snap(handleY - y));
    setExportBox({ width: newWidth, height: newHeight });
  }

  return (
    <Group x={x} y={y} draggable onDragEnd={handleMainDragEnd}>
      {/* Outer Glow Line */}
      <Rect
        x={-2}
        y={-2}
        width={width + 4}
        height={height + 4}
        stroke="rgba(56, 189, 248, 0.4)"
        strokeWidth={4}
        cornerRadius={4}
        listening={false}
      />

      {/* Main Export Bounding Box Line */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        stroke="#38bdf8"
        strokeWidth={2.5}
        dash={[10, 6]}
        cornerRadius={4}
        fill="rgba(56, 189, 248, 0.04)"
      />

      {/* Label Badge on Top-Left */}
      <Group x={0} y={-26} listening={false}>
        <Rect
          width={180}
          height={22}
          fill="rgba(15, 23, 42, 0.92)"
          stroke="#38bdf8"
          strokeWidth={1}
          cornerRadius={4}
        />
        <Text
          x={8}
          y={5}
          text={`📷 EXPORT BOX: ${width} × ${height} px`}
          fontSize={10}
          fontStyle="bold"
          fontFamily="'Inter', monospace"
          fill="#38bdf8"
        />
      </Group>

      {/* Top-Left Corner Resize Handle */}
      <Rect
        x={-6}
        y={-6}
        width={12}
        height={12}
        fill="#38bdf8"
        stroke="#0f172a"
        strokeWidth={1.5}
        cornerRadius={2}
        draggable
        onDragEnd={handleTopLeftDrag}
      />

      {/* Bottom-Right Corner Resize Handle */}
      <Rect
        x={width - 6}
        y={height - 6}
        width={12}
        height={12}
        fill="#38bdf8"
        stroke="#0f172a"
        strokeWidth={1.5}
        cornerRadius={2}
        draggable
        onDragEnd={handleBottomRightDrag}
      />
    </Group>
  );
});
