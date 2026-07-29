/**
 * ComponentNode — Realistic Photorealistic Component Renderers (DIYLC-style).
 *
 * Renders physical guitar components as their real-world counterparts:
 * - Pickups: Single Coil (flatwork + 6 pole pieces) & Humbucker (dual bobbins + screws/slugs)
 * - Potentiometers: CTS-style metal casing, phenolic lug board, brass shaft & solder eyelets
 * - Switches: Oak Grigsby blade wafer switches, Gibson-style 3-way toggle & blue DPDT mini-toggle
 * - Passives: Orange Drop capacitors with lead wires & color-coded axial resistors
 * - Output Jack: 1/4" Switchcraft jack plate with tip contact spring arm & sleeve ring
 */

import { Group, Rect, Circle, Text, Line, Path } from 'react-konva';
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
      {/* Glow highlight box when selected */}
      {isSelected && (
        <Rect
          x={-4}
          y={-4}
          width={shape.width + 8}
          height={shape.height + 8}
          cornerRadius={10}
          stroke={accentColor}
          strokeWidth={2}
          shadowColor={accentColor}
          shadowBlur={16}
          shadowOpacity={0.8}
        />
      )}

      {/* Realistic Component Graphics based on Type */}
      {renderPhysicalComponent(instance.type, shape.width, shape.height, instance.label)}

      {/* Lug anchor interactive dots */}
      {shape.lugs.map((lug) => {
        const abs = getLugAbsolutePosition(shape, lug, 0, 0);
        return (
          <Group key={lug.id}>
            {/* Outer lug ring */}
            <Circle
              x={abs.x}
              y={abs.y}
              radius={8}
              fill="transparent"
              stroke={accentColor}
              strokeWidth={1}
              opacity={wiringMode ? 0.8 : 0.2}
            />
            {/* Solder eyelet inner hole */}
            <Circle
              x={abs.x}
              y={abs.y}
              radius={4.5}
              fill={wiringMode ? accentColor : '#09090b'}
              stroke={accentColor}
              strokeWidth={1.5}
              shadowColor={accentColor}
              shadowBlur={wiringMode ? 10 : 3}
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
            {/* Lug text label */}
            <Text
              x={abs.x - 18}
              y={abs.y + 6}
              width={36}
              text={lug.label}
              fontSize={7}
              fontFamily="'JetBrains Mono', monospace"
              fontStyle="bold"
              fill={wiringMode ? '#ff8c00' : '#a1a1aa'}
              align="center"
              listening={false}
            />
          </Group>
        );
      })}
    </Group>
  );
}

/* ─── Photorealistic Graphic Renderers ───────────────────────────────────── */

function renderPhysicalComponent(type: string, width: number, height: number, label: string) {
  switch (type) {
    case 'pickup_single_coil':
      return <SingleCoilGraphics width={width} height={height} label={label} />;

    case 'pickup_humbucker':
      return <HumbuckerGraphics width={width} height={height} label={label} />;

    case 'pot_volume':
    case 'pot_tone':
    case 'pot_blend':
      return <PotentiometerGraphics width={width} height={height} label={label} type={type} />;

    case 'pot_concentric':
      return <ConcentricPotGraphics width={width} height={height} label={label} />;

    case 'switch_3way':
      return <ToggleSwitchGraphics width={width} height={height} label={label} />;

    case 'switch_4way':
    case 'switch_5way':
      return <BladeSwitchGraphics width={width} height={height} label={label} type={type} />;

    case 'switch_dpdt':
      return <DPDTSwitchGraphics width={width} height={height} label={label} />;

    case 'capacitor':
      return <CapacitorGraphics width={width} height={height} label={label} />;

    case 'resistor':
      return <ResistorGraphics width={width} height={height} label={label} />;

    case 'output_jack':
      return <OutputJackGraphics width={width} height={height} label={label} />;

    default:
      return (
        <Rect
          width={width}
          height={height}
          cornerRadius={6}
          fill="#18181b"
          stroke="#3f3f46"
          strokeWidth={1}
        />
      );
  }
}

/* ── 1. Single Coil Pickup (Fender-style Flatwork) ────────────────────────── */
function SingleCoilGraphics({ width, height }: { width: number; height: number; label: string }) {
  const poleSpacing = 16;
  const startX = width / 2 - (2.5 * poleSpacing);
  const poleY = height / 2 - 4;

  return (
    <Group>
      {/* Fiberboard Base Flatwork */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height - 8}
        cornerRadius={24}
        fill="#18181b"
        stroke="#27272a"
        strokeWidth={1.5}
        shadowColor="#000"
        shadowBlur={8}
        shadowOpacity={0.6}
      />
      {/* Black Bobbin Top Plate */}
      <Rect
        x={8}
        y={4}
        width={width - 16}
        height={height - 16}
        cornerRadius={16}
        fill="#09090b"
        stroke="#18181b"
        strokeWidth={1}
      />
      {/* 6 Alnico Pole Pieces */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Group key={i} x={startX + i * poleSpacing} y={poleY}>
          <Circle radius={5.5} fill="#d4d4d8" stroke="#71717a" strokeWidth={1} />
          <Circle radius={4} fill="#e4e4e7" opacity={0.9} />
        </Group>
      ))}
      {/* Bottom Solder Eyelet Pads */}
      <Circle x={width * 0.35} y={height - 10} radius={4} fill="#451a03" stroke="#d97706" strokeWidth={1} />
      <Circle x={width * 0.65} y={height - 10} radius={4} fill="#451a03" stroke="#d97706" strokeWidth={1} />
    </Group>
  );
}

/* ── 2. Humbucker Pickup (Gibson-style Dual Bobbin) ──────────────────────── */
function HumbuckerGraphics({ width, height }: { width: number; height: number; label: string }) {
  const poleSpacing = 16;
  const startX = width / 2 - (2.5 * poleSpacing);

  return (
    <Group>
      {/* Brass Baseplate Side Feet */}
      <Rect x={2} y={height / 2 - 8} width={8} height={16} fill="#b45309" cornerRadius={2} />
      <Rect x={width - 10} y={height / 2 - 8} width={8} height={16} fill="#b45309" cornerRadius={2} />

      {/* Main Base Housing */}
      <Rect
        x={8}
        y={2}
        width={width - 16}
        height={height - 12}
        cornerRadius={6}
        fill="#09090b"
        stroke="#27272a"
        strokeWidth={1.5}
        shadowColor="#000"
        shadowBlur={10}
      />

      {/* Slug Coil Bobbin (Top) */}
      <Rect x={12} y={6} width={width - 24} height={22} cornerRadius={4} fill="#18181b" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Circle key={`slug-${i}`} x={startX + i * poleSpacing} y={17} radius={4.5} fill="#e4e4e7" stroke="#71717a" strokeWidth={1} />
      ))}

      {/* Screw Coil Bobbin (Bottom) */}
      <Rect x={12} y={30} width={width - 24} height={22} cornerRadius={4} fill="#18181b" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Group key={`screw-${i}`} x={startX + i * poleSpacing} y={41}>
          <Circle radius={4.5} fill="#e4e4e7" stroke="#71717a" strokeWidth={1} />
          {/* Screw slot */}
          <Line points={[-3, 0, 3, 0]} stroke="#3f3f46" strokeWidth={1} />
        </Group>
      ))}

      {/* Cloth Tape Wrapping Border */}
      <Rect x={10} y={4} width={width - 20} height={height - 16} stroke="#3f3f46" strokeWidth={1} dash={[4, 2]} />
    </Group>
  );
}

/* ── 3. Potentiometer (CTS 24mm Style) ─────────────────────────────────────── */
function PotentiometerGraphics({
  width,
  height,
  type,
}: {
  width: number;
  height: number;
  label: string;
  type: string;
}) {
  const cx = width / 2;
  const cy = height * 0.4;
  const radius = 28;

  return (
    <Group>
      {/* Phenolic Brown Lug Wafer Board at Bottom */}
      <Rect
        x={cx - 32}
        y={cy + 10}
        width={64}
        height={height - cy - 14}
        cornerRadius={4}
        fill="#78350f"
        stroke="#451a03"
        strokeWidth={1.5}
      />

      {/* Metallic Silver Circular Pot Casing */}
      <Circle
        x={cx}
        y={cy}
        radius={radius}
        fill="#27272a"
        stroke="#71717a"
        strokeWidth={2}
        shadowColor="#000"
        shadowBlur={10}
        shadowOpacity={0.7}
      />
      <Circle x={cx} y={cy} radius={radius - 4} fill="#18181b" stroke="#3f3f46" strokeWidth={1} />

      {/* Central Brass Shaft */}
      <Circle x={cx} y={cy} radius={10} fill="#b45309" stroke="#f59e0b" strokeWidth={1.5} />
      <Circle x={cx} y={cy} radius={6} fill="#d97706" />
      <Line points={[cx - 6, cy, cx + 6, cy]} stroke="#78350f" strokeWidth={1.5} />

      {/* Type Indicator Ring */}
      <Text
        x={cx - 24}
        y={cy - 20}
        width={48}
        text={type === 'pot_volume' ? 'VOL' : type === 'pot_tone' ? 'TONE' : 'BLND'}
        fontSize={8}
        fontFamily="'JetBrains Mono', monospace"
        fontStyle="bold"
        fill="#d4d4d8"
        align="center"
      />
    </Group>
  );
}

/* ── 4. Concentric Dual Potentiometer ─────────────────────────────────────── */
function ConcentricPotGraphics({ width, height }: { width: number; height: number; label: string }) {
  const cx = width / 2;

  return (
    <Group>
      {/* Upper Phenolic Wafer */}
      <Rect x={cx - 34} y={38} width={68} height={18} fill="#78350f" cornerRadius={3} />
      {/* Lower Phenolic Wafer */}
      <Rect x={cx - 34} y={height - 32} width={68} height={20} fill="#78350f" cornerRadius={3} />

      {/* Outer Metal Pot Can (Top Pot) */}
      <Circle x={cx} y={32} radius={26} fill="#27272a" stroke="#71717a" strokeWidth={2} />
      {/* Inner Metal Pot Can (Bottom Pot) */}
      <Circle x={cx} y={75} radius={24} fill="#18181b" stroke="#52525b" strokeWidth={2} />

      {/* Concentric Shaft (Inner + Outer Collar) */}
      <Circle x={cx} y={32} radius={12} fill="#d97706" stroke="#b45309" strokeWidth={1.5} />
      <Circle x={cx} y={32} radius={6} fill="#f59e0b" />
    </Group>
  );
}

/* ── 5. 3-Way Toggle Switch (Gibson Switchcraft-style) ─────────────────────── */
function ToggleSwitchGraphics({ width, height }: { width: number; height: number; label: string }) {
  const cx = width / 2;

  return (
    <Group>
      {/* Switch Body Metal Frame */}
      <Rect
        x={12}
        y={20}
        width={width - 24}
        height={height - 35}
        cornerRadius={6}
        fill="#18181b"
        stroke="#52525b"
        strokeWidth={1.5}
        shadowColor="#000"
        shadowBlur={8}
      />

      {/* Threaded Nickel Bezel Ring */}
      <Circle x={cx} y={24} radius={14} fill="#27272a" stroke="#a1a1aa" strokeWidth={2} />
      <Circle x={cx} y={24} radius={10} fill="#09090b" />

      {/* Cream / Ivory Toggle Tip */}
      <Rect x={cx - 4} y={4} width={8} height={20} cornerRadius={4} fill="#fef08a" stroke="#ca8a04" strokeWidth={1} />

      {/* Leaf Spring Contact Arms */}
      <Line points={[24, 45, 34, 60]} stroke="#a1a1aa" strokeWidth={2} />
      <Line points={[width - 24, 45, width - 34, 60]} stroke="#a1a1aa" strokeWidth={2} />
    </Group>
  );
}

/* ── 6. 4-Way & 5-Way Blade Switch (Oak Grigsby-style Wafer) ───────────────── */
function BladeSwitchGraphics({
  width,
  height,
  type,
}: {
  width: number;
  height: number;
  label: string;
  type: string;
}) {
  return (
    <Group>
      {/* Steel Chassis Mounting Plate */}
      <Rect
        x={6}
        y={4}
        width={width - 12}
        height={22}
        cornerRadius={4}
        fill="#27272a"
        stroke="#71717a"
        strokeWidth={1.5}
      />
      {/* Screw Holes */}
      <Circle x={14} y={15} radius={3.5} fill="#09090b" stroke="#71717a" strokeWidth={1} />
      <Circle x={width - 14} y={15} radius={3.5} fill="#09090b" stroke="#71717a" strokeWidth={1} />

      {/* Central Black Blade Tip */}
      <Rect x={width / 2 - 5} y={0} width={10} height={16} cornerRadius={2} fill="#09090b" stroke="#3f3f46" strokeWidth={1} />

      {/* Phenolic PCB Wafer Board */}
      <Rect
        x={10}
        y={28}
        width={width - 20}
        height={height - 36}
        cornerRadius={4}
        fill="#78350f"
        stroke="#451a03"
        strokeWidth={1.5}
      />

      {/* Printed Circuit Traces */}
      <Line points={[20, 48, width - 20, 48]} stroke="#d97706" strokeWidth={2} dash={[6, 3]} />
      <Text
        x={12}
        y={32}
        width={width - 24}
        text={type === 'switch_4way' ? 'OAK GRIGSBY 4-WAY' : 'OAK GRIGSBY 5-WAY'}
        fontSize={8}
        fontFamily="'JetBrains Mono', monospace"
        fontStyle="bold"
        fill="#fde047"
        align="center"
      />
    </Group>
  );
}

/* ── 7. DPDT Mini Toggle Switch (Blue Resin Box) ──────────────────────────── */
function DPDTSwitchGraphics({ width, height }: { width: number; height: number; label: string }) {
  const cx = width / 2;

  return (
    <Group>
      {/* Blue Epoxy Resin Casing */}
      <Rect
        x={8}
        y={16}
        width={width - 16}
        height={height - 24}
        cornerRadius={4}
        fill="#1e40af"
        stroke="#3b82f6"
        strokeWidth={1.5}
        shadowColor="#000"
        shadowBlur={10}
      />

      {/* Threaded Metallic Bushing & Lever */}
      <Circle x={cx} y={16} radius={10} fill="#3f3f46" stroke="#9ca3af" strokeWidth={1.5} />
      <Rect x={cx - 3} y={2} width={6} height={16} cornerRadius={3} fill="#e5e7eb" stroke="#6b7280" strokeWidth={1} />

      {/* Epoxy Seal Grid Markings */}
      <Rect x={14} y={26} width={width - 28} height={height - 38} stroke="#1d4ed8" strokeWidth={1} dash={[4, 2]} />
    </Group>
  );
}

/* ── 8. Orange Drop Capacitor ─────────────────────────────────────────────── */
function CapacitorGraphics({ width, height }: { width: number; height: number; label: string }) {
  const cx = width / 2;
  const cy = height / 2;

  return (
    <Group>
      {/* Silver Axial Lead Wires */}
      <Line points={[4, cy, width - 4, cy]} stroke="#9ca3af" strokeWidth={2} />

      {/* Bright Orange Drop Radial Body */}
      <Rect
        x={cx - 24}
        y={cy - 16}
        width={48}
        height={32}
        cornerRadius={14}
        fill="#ea580c"
        stroke="#f97316"
        strokeWidth={2}
        shadowColor="#ea580c"
        shadowBlur={12}
        shadowOpacity={0.6}
      />
      {/* Specular Shine Highlight */}
      <Path
        data={`M ${cx - 18} ${cy - 10} Q ${cx} ${cy - 14} ${cx + 18} ${cy - 10}`}
        stroke="#ffedd5"
        strokeWidth={2}
        opacity={0.7}
      />

      <Text
        x={cx - 22}
        y={cy - 5}
        width={44}
        text=".022µF"
        fontSize={8}
        fontFamily="'JetBrains Mono', monospace"
        fontStyle="bold"
        fill="#fff"
        align="center"
      />
    </Group>
  );
}

/* ── 9. Color-Coded Resistor ──────────────────────────────────────────────── */
function ResistorGraphics({ width, height }: { width: number; height: number; label: string }) {
  const cx = width / 2;
  const cy = height / 2;
  const bodyW = 52;
  const bodyH = 20;

  return (
    <Group>
      {/* Silver Axial Lead Wires */}
      <Line points={[4, cy, width - 4, cy]} stroke="#9ca3af" strokeWidth={2} />

      {/* Beige/Tan Cylindrical Resistor Body */}
      <Rect
        x={cx - bodyW / 2}
        y={cy - bodyH / 2}
        width={bodyW}
        height={bodyH}
        cornerRadius={8}
        fill="#d4b996"
        stroke="#a3e635"
        strokeWidth={1}
        shadowColor="#000"
        shadowBlur={6}
      />

      {/* 4 Resistor Color Bands (Yellow, Violet, Orange, Gold for 47kΩ) */}
      <Rect x={cx - 18} y={cy - bodyH / 2} width={5} height={bodyH} fill="#eab308" /> {/* Yellow (4) */}
      <Rect x={cx - 8} y={cy - bodyH / 2} width={5} height={bodyH} fill="#7c3aed" />  {/* Violet (7) */}
      <Rect x={cx + 2} y={cy - bodyH / 2} width={5} height={bodyH} fill="#ea580c" />  {/* Orange (kΩ) */}
      <Rect x={cx + 14} y={cy - bodyH / 2} width={5} height={bodyH} fill="#eab308" /> {/* Gold (5%) */}
    </Group>
  );
}

/* ── 10. 1/4" Switchcraft Output Jack ─────────────────────────────────────── */
function OutputJackGraphics({ width, height }: { width: number; height: number; label: string }) {
  const cx = width * 0.4;
  const cy = height / 2;

  return (
    <Group>
      {/* Nickel Octagonal Base Nut */}
      <Circle x={cx} y={cy} radius={26} fill="#27272a" stroke="#a1a1aa" strokeWidth={2} />
      <Circle x={cx} y={cy} radius={18} fill="#18181b" stroke="#52525b" strokeWidth={1.5} />
      <Circle x={cx} y={cy} radius={10} fill="#09090b" />

      {/* Bent Metallic Tip Spring Contact Arm */}
      <Path
        data={`M ${cx + 12} ${cy - 12} L ${width - 16} ${cy - 18} L ${width - 16} ${cy - 14}`}
        stroke="#d4d4d8"
        strokeWidth={3.5}
      />

      {/* Ground Sleeve Ring */}
      <Circle x={width - 16} y={cy + 18} radius={6} fill="#27272a" stroke="#71717a" strokeWidth={1.5} />
    </Group>
  );
}
