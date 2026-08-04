/**
 * GridBackground — Konva Layer rendering customizable canvas themes & grid patterns.
 *
 * Themes:
 * - Dark: Charcoal background (#121214) with subtle zinc grid
 * - Light: Clean white background (#f8fafc) with subtle slate grid
 * - Blueprint: Classic CAD blue background (#0f172a) with cyan grid lines
 * - Vintage: Warm parchment background (#fef3c7) with amber grid lines
 *
 * Grid Styles:
 * - Dots, Lines, Crosshatch, Isometric, None
 */

import { memo } from 'react';
import { Layer, Rect, Line, Circle, Group } from 'react-konva';
import type { CanvasTheme, GridStyle } from '@store/canvasStore';

interface Props {
  width: number;
  height: number;
  themeMode: CanvasTheme;
  gridStyle: GridStyle;
  gridSize: number;
  scale: number;
  panX: number;
  panY: number;
}

const THEME_CONFIGS: Record<CanvasTheme, { bg: string; gridColor: string; subGridColor: string }> =
  {
    dark: { bg: '#121214', gridColor: '#3f3f46', subGridColor: '#27272a' },
    light: { bg: '#f8fafc', gridColor: '#94a3b8', subGridColor: '#cbd5e1' },
    blueprint: { bg: '#0f172a', gridColor: '#0284c7', subGridColor: '#1e293b' },
    vintage: { bg: '#fef3c7', gridColor: '#d97706', subGridColor: '#fde68a' },
  };

export const GridBackground = memo(function GridBackground({
  width,
  height,
  themeMode,
  gridStyle,
  gridSize,
  scale,
  panX,
  panY,
}: Props) {
  const theme = THEME_CONFIGS[themeMode];

  if (gridStyle === 'none') {
    return (
      <Layer listening={false}>
        <Rect
          x={-panX / scale}
          y={-panY / scale}
          width={width / scale + 1000}
          height={height / scale + 1000}
          fill={theme.bg}
        />
      </Layer>
    );
  }

  // Calculate visible grid bounds in canvas space
  const startX = Math.floor(-panX / scale / gridSize) * gridSize - gridSize;
  const endX = Math.ceil((width - panX) / scale / gridSize) * gridSize + gridSize;
  const startY = Math.floor(-panY / scale / gridSize) * gridSize - gridSize;
  const endY = Math.ceil((height - panY) / scale / gridSize) * gridSize + gridSize;

  const lines: React.ReactNode[] = [];

  if (gridStyle === 'lines' || gridStyle === 'crosshatch') {
    // Vertical grid lines
    for (let x = startX; x <= endX; x += gridSize) {
      const isMajor = x % (gridSize * 5) === 0;
      lines.push(
        <Line
          key={`v-${x}`}
          points={[x, startY, x, endY]}
          stroke={isMajor ? theme.gridColor : theme.subGridColor}
          strokeWidth={isMajor ? 1 : 0.5}
          opacity={isMajor ? 0.55 : 0.35}
        />,
      );
    }
    // Horizontal grid lines
    for (let y = startY; y <= endY; y += gridSize) {
      const isMajor = y % (gridSize * 5) === 0;
      lines.push(
        <Line
          key={`h-${y}`}
          points={[startX, y, endX, y]}
          stroke={isMajor ? theme.gridColor : theme.subGridColor}
          strokeWidth={isMajor ? 1 : 0.5}
          opacity={isMajor ? 0.55 : 0.35}
        />,
      );
    }
  } else if (gridStyle === 'dots') {
    // Dot matrix grid - subtle & comfortable radius
    for (let x = startX; x <= endX; x += gridSize) {
      for (let y = startY; y <= endY; y += gridSize) {
        const isMajor = x % (gridSize * 5) === 0 && y % (gridSize * 5) === 0;
        lines.push(
          <Circle
            key={`d-${x}-${y}`}
            x={x}
            y={y}
            radius={isMajor ? 1.75 : 1}
            fill={isMajor ? theme.gridColor : theme.subGridColor}
            opacity={isMajor ? 0.65 : 0.4}
          />,
        );
      }
    }
  } else if (gridStyle === 'isometric') {
    // 30 degree Isometric grid lines
    for (let x = startX - 1000; x <= endX + 1000; x += gridSize * 2) {
      lines.push(
        <Line
          key={`iso1-${x}`}
          points={[x, startY, x + (endY - startY) * 1.732, endY]}
          stroke={theme.subGridColor}
          strokeWidth={0.5}
          opacity={0.35}
        />,
        <Line
          key={`iso2-${x}`}
          points={[x, startY, x - (endY - startY) * 1.732, endY]}
          stroke={theme.subGridColor}
          strokeWidth={0.5}
          opacity={0.35}
        />,
      );
    }
  }

  return (
    <Layer listening={false}>
      {/* Background Fill */}
      <Rect
        x={-panX / scale - 500}
        y={-panY / scale - 500}
        width={width / scale + 1000}
        height={height / scale + 1000}
        fill={theme.bg}
      />
      {lines}

      {/* Origin Marker */}
      <Group x={0} y={0}>
        <Circle x={0} y={0} radius={4} fill={theme.subGridColor} opacity={0.8} />
        <Line points={[-10, 0, 10, 0]} stroke={theme.subGridColor} strokeWidth={1} opacity={0.8} />
        <Line points={[0, -10, 0, 10]} stroke={theme.subGridColor} strokeWidth={1} opacity={0.8} />
      </Group>
    </Layer>
  );
});

