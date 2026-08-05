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
 *
 * Performance: the grid pattern is rasterized once into an offscreen canvas tile
 * (per theme/style/size) and rendered as a single pattern-filled Rect, so pan/zoom
 * cost stays constant instead of regenerating O(1/scale²) Konva shapes per frame.
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

function mod(v: number, m: number): number {
  return ((v % m) + m) % m;
}

const patternCache = new Map<string, HTMLCanvasElement | null>();

/**
 * Best integer tile height H for the 30° isometric pattern so the vertical seam
 * offset (√3·H mod period) stays well under one pixel.
 */
function isoTileHeight(period: number): number {
  let bestH = Math.max(1, Math.round(period / Math.sqrt(3)));
  let bestResidual = Infinity;
  for (let k = 1; k <= 256; k++) {
    const h = Math.round((period * k) / Math.sqrt(3));
    const residual = Math.abs(Math.sqrt(3) * h - period * k);
    if (residual < bestResidual) {
      bestResidual = residual;
      bestH = h;
      if (residual < 0.1) break;
    }
  }
  return Math.max(bestH, 1);
}

/**
 * Rasterize the grid pattern for one (theme, style, size) combination into a
 * seamless tile. Features at the tile boundary are drawn at both 0 and the period
 * so canvas clipping reproduces the full stroke/arc across adjacent tiles.
 */
function buildGridPattern(
  themeMode: CanvasTheme,
  gridStyle: GridStyle,
  gridSize: number,
): HTMLCanvasElement | null {
  const key = `${themeMode}|${gridStyle}|${gridSize}`;
  const cached = patternCache.get(key);
  if (cached) return cached;

  const theme = THEME_CONFIGS[themeMode];
  const isIso = gridStyle === 'isometric';
  const period = isIso ? gridSize * 2 : gridSize * 5;
  const height = isIso ? isoTileHeight(period) : period;

  const canvas = document.createElement('canvas');
  canvas.width = period;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    patternCache.set(key, null);
    return null;
  }

  if (gridStyle === 'dots') {
    // 6×6 grid of dots (one extra row/column for seam wrap)
    for (let x = 0; x <= 5; x++) {
      for (let y = 0; y <= 5; y++) {
        const isMajor = x % 5 === 0 && y % 5 === 0;
        ctx.fillStyle = isMajor ? theme.gridColor : theme.subGridColor;
        ctx.globalAlpha = isMajor ? 0.65 : 0.4;
        ctx.beginPath();
        ctx.arc(x * gridSize, y * gridSize, isMajor ? 1.75 : 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (gridStyle === 'lines' || gridStyle === 'crosshatch') {
    // Vertical + horizontal lines, one extra line per axis for seam wrap
    for (let k = 0; k <= 5; k++) {
      const isMajor = k % 5 === 0;
      ctx.strokeStyle = isMajor ? theme.gridColor : theme.subGridColor;
      ctx.globalAlpha = isMajor ? 0.55 : 0.35;
      ctx.lineWidth = isMajor ? 1 : 0.5;
      const pos = k * gridSize;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, period);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(period, pos);
      ctx.stroke();
    }
  } else if (gridStyle === 'isometric') {
    // 30° lines: x = ±√3·y wrapped into the tile (seamless across tile edges)
    ctx.strokeStyle = theme.subGridColor;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 0.5;
    for (const slope of [1, -1]) {
      ctx.beginPath();
      for (let y = 0; y <= height; y++) {
        const x = mod(slope * Math.sqrt(3) * y, period);
        if (y === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  }

  patternCache.set(key, canvas);
  return canvas;
}

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

  const tile = buildGridPattern(themeMode, gridStyle, gridSize);
  const period = gridStyle === 'isometric' ? gridSize * 2 : gridSize * 5;
  const rectX = -panX / scale - 500;
  const rectY = -panY / scale - 500;
  const rectWidth = width / scale + 1000;
  const rectHeight = height / scale + 1000;

  return (
    <Layer listening={false}>
      {/* Background Fill */}
      <Rect x={rectX} y={rectY} width={rectWidth} height={rectHeight} fill={theme.bg} />

      {/* Grid Pattern — single tile, aligned to the world origin */}
      {tile && (
        <Rect
          x={rectX}
          y={rectY}
          width={rectWidth}
          height={rectHeight}
          fillPatternImage={tile as unknown as HTMLImageElement}
          fillPatternRepeat="repeat"
          fillPatternOffset={{ x: mod(rectX, period), y: mod(rectY, period) }}
        />
      )}

      {/* Origin Marker */}
      <Group x={0} y={0}>
        <Circle x={0} y={0} radius={4} fill={theme.subGridColor} opacity={0.8} />
        <Line points={[-10, 0, 10, 0]} stroke={theme.subGridColor} strokeWidth={1} opacity={0.8} />
        <Line points={[0, -10, 0, 10]} stroke={theme.subGridColor} strokeWidth={1} opacity={0.8} />
      </Group>
    </Layer>
  );
});
