/**
 * ComponentNode — Realistic Photorealistic Component Renderers (DIYLC-style).
 *
 * Renders physical guitar components as recognizable, high-contrast real-world counterparts:
 * - Pickups: Single Coil (Cream/White cover + 6 Alnico poles) & Humbucker (Chrome cover / Zebra bobbins)
 * - Potentiometers: Metallic CTS casing with brass shaft, phenolic lug board & silver solder lugs
 * - Switches: Oak Grigsby blade switch wafer, Gibson 3-way toggle & Royal Blue DPDT mini-toggle
 * - Passives: 715P Orange Drop capacitors & 4-band axial resistors with silver leads
 * - Output Jack: 1/4" Switchcraft jack plate with tip contact spring arm & sleeve ground lug
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

      {/* Selection Highlight Glow */}
      {isSelected && (
        <Rect
          x={-3}
          y={-3}
          width={shape.width + 6}
          height={shape.height + 6}
          cornerRadius={10}
          stroke={accentColor}
          strokeWidth={2}
          shadowColor={accentColor}
          shadowBlur={12}
          shadowOpacity={0.8}
        />
      )}

      {/* Realistic Component Graphics based on Type */}
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

      {/* Lug Anchor Dots & Eyelets */}
      {shape.lugs.map((lug) => {
        const abs = getLugAbsolutePosition(shape, lug, 0, 0);
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
              opacity={wiringMode ? 0.9 : 0.3}
            />
            {/* Metallic solder eyelet dot */}
            <Circle
              x={abs.x}
              y={abs.y}
              radius={4.5}
              fill={wiringMode ? accentColor : '#27272a'}
              stroke="#e4e4e7"
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
            {/* Lug Label Text */}
            <Text
              x={abs.x - 24}
              y={abs.y + 6}
              width={48}
              text={lug.label}
              fontSize={7}
              fontFamily="'JetBrains Mono', monospace"
              fontStyle="bold"
              fill={wiringMode ? '#38bdf8' : '#cbd5e1'}
              align="center"
              shadowColor="#000"
              shadowBlur={3}
              shadowOpacity={0.9}
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
      return <PotentiometerGraphics width={width} height={height} type={type} />;

    case 'pot_concentric':
      return <ConcentricPotGraphics width={width} height={height} />;

    case 'switch_3way':
      return <ToggleSwitchGraphics width={width} height={height} />;

    case 'switch_4way':
    case 'switch_5way':
      return <BladeSwitchGraphics width={width} height={height} type={type} />;

    case 'switch_dpdt':
      return <DPDTSwitchGraphics width={width} height={height} />;

    case 'capacitor':
      return <CapacitorGraphics width={width} height={height} />;

    case 'resistor':
      return <ResistorGraphics width={width} height={height} />;

    case 'output_jack':
      return <OutputJackGraphics width={width} height={height} />;

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

/* ── 1. Single Coil Pickup (Fender Cream/White Cover) ─────────────────────── */
function SingleCoilGraphics({ width, height }: { width: number; height: number; label: string }) {
  const poleSpacing = 16;
  const startX = width / 2 - (2.5 * poleSpacing);
  const poleY = height / 2;

  return (
    <Group>
      {/* Black Fiberboard Baseplate */}
      <Rect
        x={2}
        y={4}
        width={width - 4}
        height={height - 12}
        cornerRadius={24}
        fill="#09090b"
        stroke="#27272a"
        strokeWidth={1.5}
      />

      {/* Vintage Cream Pickup Cover Body */}
      <Rect
        x={8}
        y={8}
        width={width - 16}
        height={height - 20}
        cornerRadius={16}
        fill="#fef08a"
        stroke="#ca8a04"
        strokeWidth={1.5}
        shadowColor="#000"
        shadowBlur={6}
      />
      {/* Cover Bevel Highlight */}
      <Rect
        x={11}
        y={11}
        width={width - 22}
        height={height - 26}
        cornerRadius={13}
        stroke="#fef9c3"
        strokeWidth={1}
        opacity={0.7}
      />

      {/* 6 Alnico Pole Piece Magnets */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Group key={i} x={startX + i * poleSpacing} y={poleY}>
          <Circle radius={5.5} fill="#71717a" stroke="#3f3f46" strokeWidth={1} />
          <Circle radius={4} fill="#e4e4e7" />
          <Circle radius={2} fill="#f4f4f5" />
        </Group>
      ))}

      {/* Solder Eyelet Terminal Pads */}
      <Circle x={width * 0.35} y={height - 8} radius={4} fill="#78350f" stroke="#d97706" strokeWidth={1} />
      <Circle x={width * 0.65} y={height - 8} radius={4} fill="#78350f" stroke="#d97706" strokeWidth={1} />
    </Group>
  );
}

/* ── 2. Humbucker Pickup (Gibson Nickel Cover / Zebra) ───────────────────── */
function HumbuckerGraphics({ width, height }: { width: number; height: number; label: string }) {
  const poleSpacing = 16;
  const startX = width / 2 - (2.5 * poleSpacing);

  return (
    <Group>
      {/* Brass Baseplate Mounting Ears */}
      <Rect x={0} y={height / 2 - 9} width={10} height={18} fill="#b45309" stroke="#78350f" strokeWidth={1} cornerRadius={2} />
      <Circle x={5} y={height / 2} radius={2.5} fill="#09090b" />
      <Rect x={width - 10} y={height / 2 - 9} width={10} height={18} fill="#b45309" stroke="#78350f" strokeWidth={1} cornerRadius={2} />
      <Circle x={width - 5} y={height / 2} radius={2.5} fill="#09090b" />

      {/* Chrome Cover Main Body */}
      <Rect
        x={8}
        y={4}
        width={width - 16}
        height={height - 14}
        cornerRadius={6}
        fill="#e4e4e7"
        stroke="#9ca3af"
        strokeWidth={1.5}
        shadowColor="#000"
        shadowBlur={8}
      />
      {/* Chrome Metallic Specular Shine */}
      <Rect
        x={12}
        y={8}
        width={width - 24}
        height={height - 22}
        cornerRadius={4}
        fill="#f4f4f5"
        stroke="#d4d4d8"
        strokeWidth={1}
      />

      {/* Slug Bobbin Pole Dots (Top) */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Circle key={`slug-${i}`} x={startX + i * poleSpacing} y={18} radius={4.5} fill="#a1a1aa" stroke="#52525b" strokeWidth={1} />
      ))}

      {/* Screw Bobbin Slotted Pole Screws (Bottom) */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Group key={`screw-${i}`} x={startX + i * poleSpacing} y={38}>
          <Circle radius={4.5} fill="#d4d4d8" stroke="#52525b" strokeWidth={1} />
          <Line points={[-3, 0, 3, 0]} stroke="#3f3f46" strokeWidth={1.5} />
        </Group>
      ))}
    </Group>
  );
}

/* ── 3. Potentiometer (CTS 24mm Silver Metal Can + Shaft) ──────────────────── */
function PotentiometerGraphics({
  width,
  height,
  type,
}: {
  width: number;
  height: number;
  type: string;
}) {
  const cx = width / 2;
  const cy = height * 0.42;
  const radius = 30;

  return (
    <Group>
      {/* Phenolic Brown Lug Board at Bottom */}
      <Rect
        x={cx - 34}
        y={cy + 8}
        width={68}
        height={height - cy - 12}
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
        fill="#e4e4e7"
        stroke="#9ca3af"
        strokeWidth={2}
        shadowColor="#000"
        shadowBlur={8}
      />
      <Circle x={cx} y={cy} radius={radius - 4} fill="#d4d4d8" stroke="#a1a1aa" strokeWidth={1} />

      {/* Central Brass Shaft */}
      <Circle x={cx} y={cy} radius={11} fill="#b45309" stroke="#f59e0b" strokeWidth={1.5} />
      <Circle x={cx} y={cy} radius={7} fill="#d97706" />
      <Line points={[cx - 7, cy, cx + 7, cy]} stroke="#78350f" strokeWidth={1.5} />

      {/* Type Tag */}
      <Text
        x={cx - 24}
        y={cy - 22}
        width={48}
        text={type === 'pot_volume' ? 'VOL 250K' : type === 'pot_tone' ? 'TONE 500K' : 'BLEND'}
        fontSize={7}
        fontFamily="'JetBrains Mono', monospace"
        fontStyle="bold"
        fill="#27272a"
        align="center"
      />
    </Group>
  );
}

/* ── 4. Concentric Dual Potentiometer ─────────────────────────────────────── */
function ConcentricPotGraphics({ width, height }: { width: number; height: number }) {
  const cx = width / 2;

  return (
    <Group>
      {/* Phenolic Wafers */}
      <Rect x={cx - 34} y={36} width={68} height={18} fill="#78350f" cornerRadius={3} />
      <Rect x={cx - 34} y={height - 30} width={68} height={20} fill="#78350f" cornerRadius={3} />

      {/* Metal Pot Cans */}
      <Circle x={cx} y={32} radius={26} fill="#e4e4e7" stroke="#9ca3af" strokeWidth={2} />
      <Circle x={cx} y={75} radius={24} fill="#d4d4d8" stroke="#71717a" strokeWidth={2} />

      {/* Concentric Shaft */}
      <Circle x={cx} y={32} radius={12} fill="#d97706" stroke="#b45309" strokeWidth={1.5} />
      <Circle x={cx} y={32} radius={6} fill="#f59e0b" />
    </Group>
  );
}

/* ── 5. 3-Way Toggle Switch (Gibson Switchcraft-style) ─────────────────────── */
function ToggleSwitchGraphics({ width, height }: { width: number; height: number }) {
  const cx = width / 2;

  return (
    <Group>
      {/* Metal Frame Housing */}
      <Rect
        x={12}
        y={20}
        width={width - 24}
        height={height - 32}
        cornerRadius={6}
        fill="#27272a"
        stroke="#71717a"
        strokeWidth={1.5}
        shadowColor="#000"
        shadowBlur={8}
      />

      {/* Threaded Nickel Ring */}
      <Circle x={cx} y={24} radius={15} fill="#d4d4d8" stroke="#a1a1aa" strokeWidth={2} />
      <Circle x={cx} y={24} radius={10} fill="#18181b" />

      {/* Ivory Toggle Tip Knob */}
      <Rect x={cx - 5} y={4} width={10} height={20} cornerRadius={4} fill="#fef08a" stroke="#ca8a04" strokeWidth={1.5} />

      {/* Leaf Contact Springs */}
      <Line points={[24, 45, 34, 60]} stroke="#e4e4e7" strokeWidth={2} />
      <Line points={[width - 24, 45, width - 34, 60]} stroke="#e4e4e7" strokeWidth={2} />
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
  type: string;
}) {
  return (
    <Group>
      {/* Steel Mounting Flange Plate */}
      <Rect
        x={6}
        y={12}
        width={width - 12}
        height={22}
        cornerRadius={4}
        fill="#d4d4d8"
        stroke="#9ca3af"
        strokeWidth={1.5}
      />
      {/* Screw Holes */}
      <Circle x={14} y={23} radius={3.5} fill="#18181b" stroke="#71717a" strokeWidth={1} />
      <Circle x={width - 14} y={23} radius={3.5} fill="#18181b" stroke="#71717a" strokeWidth={1} />

      {/* Central Black Tip Lever */}
      <Rect x={width / 2 - 5} y={2} width={10} height={18} cornerRadius={2} fill="#09090b" stroke="#3f3f46" strokeWidth={1} />

      {/* Phenolic PCB Wafer Board */}
      <Rect
        x={10}
        y={34}
        width={width - 20}
        height={height - 40}
        cornerRadius={4}
        fill="#78350f"
        stroke="#451a03"
        strokeWidth={1.5}
      />

      {/* Printed Circuit Traces */}
      <Line points={[20, 52, width - 20, 52]} stroke="#f59e0b" strokeWidth={2} dash={[6, 3]} />
      <Text
        x={12}
        y={38}
        width={width - 24}
        text={type === 'switch_4way' ? 'OAK GRIGSBY 4-WAY' : 'OAK GRIGSBY 5-WAY'}
        fontSize={8}
        fontFamily="'JetBrains Mono', monospace"
        fontStyle="bold"
        fill="#fef08a"
        align="center"
      />
    </Group>
  );
}

/* ── 7. DPDT Mini Toggle Switch (Royal Blue Resin Box) ─────────────────────── */
function DPDTSwitchGraphics({ width, height }: { width: number; height: number }) {
  const cx = width / 2;

  return (
    <Group>
      {/* Royal Blue Epoxy Resin Box */}
      <Rect
        x={8}
        y={16}
        width={width - 16}
        height={height - 22}
        cornerRadius={4}
        fill="#1d4ed8"
        stroke="#60a5fa"
        strokeWidth={1.5}
        shadowColor="#000"
        shadowBlur={8}
      />

      {/* Threaded Metallic Collar & Toggle Lever */}
      <Circle x={cx} y={16} radius={11} fill="#52525b" stroke="#d4d4d8" strokeWidth={1.5} />
      <Rect x={cx - 3.5} y={2} width={7} height={16} cornerRadius={3.5} fill="#f4f4f5" stroke="#9ca3af" strokeWidth={1} />

      {/* Epoxy Grid Frame */}
      <Rect x={14} y={26} width={width - 28} height={height - 36} stroke="#3b82f6" strokeWidth={1} dash={[4, 2]} />
    </Group>
  );
}

/* ── 8. Orange Drop Capacitor (715P 200V) ──────────────────────────────────── */
function CapacitorGraphics({ width, height }: { width: number; height: number }) {
  const cx = width / 2;
  const cy = height / 2;

  return (
    <Group>
      {/* Silver Axial Lead Wires */}
      <Line points={[4, cy, width - 4, cy]} stroke="#d4d4d8" strokeWidth={2.5} />

      {/* Vibrant Orange Drop Body */}
      <Rect
        x={cx - 26}
        y={cy - 16}
        width={52}
        height={32}
        cornerRadius={14}
        fill="#ea580c"
        stroke="#f97316"
        strokeWidth={2}
        shadowColor="#ea580c"
        shadowBlur={10}
        shadowOpacity={0.6}
      />
      {/* Specular Highlight Arc */}
      <Path
        data={`M ${cx - 20} ${cy - 10} Q ${cx} ${cy - 15} ${cx + 20} ${cy - 10}`}
        stroke="#ffedd5"
        strokeWidth={2}
        opacity={0.8}
      />

      <Text
        x={cx - 24}
        y={cy - 5}
        width={48}
        text=".022µF 200V"
        fontSize={7}
        fontFamily="'JetBrains Mono', monospace"
        fontStyle="bold"
        fill="#ffffff"
        align="center"
      />
    </Group>
  );
}

/* ── 9. Color-Coded Resistor ──────────────────────────────────────────────── */
function ResistorGraphics({ width, height }: { width: number; height: number }) {
  const cx = width / 2;
  const cy = height / 2;
  const bodyW = 54;
  const bodyH = 20;

  return (
    <Group>
      {/* Silver Axial Lead Wires */}
      <Line points={[4, cy, width - 4, cy]} stroke="#d4d4d8" strokeWidth={2.5} />

      {/* Vintage Tan Cylindrical Body */}
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

      {/* 4 Color Bands (Yellow 4, Violet 7, Orange k, Gold 5% = 47kΩ) */}
      <Rect x={cx - 18} y={cy - bodyH / 2} width={5} height={bodyH} fill="#facc15" />
      <Rect x={cx - 8} y={cy - bodyH / 2} width={5} height={bodyH} fill="#8b5cf6" />
      <Rect x={cx + 2} y={cy - bodyH / 2} width={5} height={bodyH} fill="#ea580c" />
      <Rect x={cx + 14} y={cy - bodyH / 2} width={5} height={bodyH} fill="#facc15" />
    </Group>
  );
}

/* ── 10. 1/4" Switchcraft Output Jack ─────────────────────────────────────── */
function OutputJackGraphics({ width, height }: { width: number; height: number }) {
  const cx = width * 0.4;
  const cy = height / 2;

  return (
    <Group>
      {/* Nickel Octagonal Base Nut */}
      <Circle x={cx} y={cy} radius={26} fill="#d4d4d8" stroke="#9ca3af" strokeWidth={2} />
      <Circle x={cx} y={cy} radius={18} fill="#27272a" stroke="#52525b" strokeWidth={1.5} />
      <Circle x={cx} y={cy} radius={10} fill="#09090b" />

      {/* Bent Metallic Tip Spring Contact Arm */}
      <Path
        data={`M ${cx + 12} ${cy - 12} L ${width - 16} ${cy - 18} L ${width - 16} ${cy - 14}`}
        stroke="#e4e4e7"
        strokeWidth={3.5}
      />

      {/* Ground Sleeve Terminal Ring */}
      <Circle x={width - 16} y={cy + 18} radius={6} fill="#52525b" stroke="#a1a1aa" strokeWidth={1.5} />
    </Group>
  );
}
