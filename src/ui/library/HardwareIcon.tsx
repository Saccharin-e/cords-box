import { memo } from 'react';

interface Props {
  id: string;
}

export const HardwareIcon = memo(function HardwareIcon({ id }: Props) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {renderIconGraphic(id)}
    </svg>
  );
});

function renderIconGraphic(id: string) {
  switch (id) {
    case 'pickup_sc':
      return (
        <g>
          <rect
            x="3"
            y="10"
            width="34"
            height="20"
            rx="10"
            fill="#fef08a"
            stroke="#ca8a04"
            strokeWidth="1.5"
          />
          <rect
            x="6"
            y="13"
            width="28"
            height="14"
            rx="7"
            fill="#fef9c3"
            stroke="#eab308"
            strokeWidth="1"
          />
          <circle cx="10" cy="20" r="1.5" fill="#a1a1aa" stroke="#52525b" strokeWidth="0.5" />
          <circle cx="14" cy="20" r="1.5" fill="#a1a1aa" stroke="#52525b" strokeWidth="0.5" />
          <circle cx="18" cy="20" r="1.5" fill="#a1a1aa" stroke="#52525b" strokeWidth="0.5" />
          <circle cx="22" cy="20" r="1.5" fill="#a1a1aa" stroke="#52525b" strokeWidth="0.5" />
          <circle cx="26" cy="20" r="1.5" fill="#a1a1aa" stroke="#52525b" strokeWidth="0.5" />
          <circle cx="30" cy="20" r="1.5" fill="#a1a1aa" stroke="#52525b" strokeWidth="0.5" />
          <circle cx="14" cy="28" r="1" fill="#d4d4d8" stroke="#3f3f46" strokeWidth="0.5" />
          <circle cx="26" cy="28" r="1" fill="#d4d4d8" stroke="#3f3f46" strokeWidth="0.5" />
        </g>
      );
    case 'pickup_hb':
      return (
        <g>
          <rect
            x="3"
            y="8"
            width="34"
            height="24"
            rx="4"
            fill="#3f3f46"
            stroke="#18181b"
            strokeWidth="1.5"
          />
          <rect x="5" y="10" width="14" height="20" rx="3" fill="#18181b" />
          <rect x="21" y="10" width="14" height="20" rx="3" fill="#18181b" />
          <circle cx="12" cy="14" r="1.5" fill="#e4e4e7" />
          <circle cx="12" cy="20" r="1.5" fill="#e4e4e7" />
          <circle cx="12" cy="26" r="1.5" fill="#e4e4e7" />
          <circle cx="28" cy="14" r="1.5" fill="#a1a1aa" />
          <circle cx="28" cy="20" r="1.5" fill="#a1a1aa" />
          <circle cx="28" cy="26" r="1.5" fill="#a1a1aa" />
        </g>
      );
    case 'pot_volume':
    case 'pot_tone':
      return (
        <g>
          <circle cx="20" cy="18" r="13" fill="#71717a" stroke="#3f3f46" strokeWidth="1.5" />
          <circle cx="20" cy="18" r="8" fill="#a1a1aa" />
          <circle cx="20" cy="18" r="3.5" fill="#ca8a04" />
          <rect x="11" y="30" width="3" height="5" fill="#d4d4d8" rx="0.5" />
          <rect x="18.5" y="30" width="3" height="5" fill="#d4d4d8" rx="0.5" />
          <rect x="26" y="30" width="3" height="5" fill="#d4d4d8" rx="0.5" />
        </g>
      );
    case 'pot_blend':
      return (
        <g>
          <rect
            x="8"
            y="10"
            width="24"
            height="20"
            rx="4"
            fill="#71717a"
            stroke="#3f3f46"
            strokeWidth="1.5"
          />
          <circle cx="20" cy="18" r="9" fill="#52525b" />
          <circle cx="20" cy="18" r="3" fill="#ca8a04" />
          <rect x="10" y="29" width="3" height="5" fill="#d4d4d8" rx="0.5" />
          <rect x="18.5" y="29" width="3" height="5" fill="#d4d4d8" rx="0.5" />
          <rect x="27" y="29" width="3" height="5" fill="#d4d4d8" rx="0.5" />
        </g>
      );
    case 'pot_concentric':
      return (
        <g>
          <circle cx="20" cy="16" r="13" fill="#52525b" stroke="#27272a" strokeWidth="1.5" />
          <circle cx="20" cy="16" r="7" fill="#ca8a04" />
          <circle cx="20" cy="16" r="3.5" fill="#e4e4e7" />
          <rect x="10" y="28" width="20" height="5" rx="1" fill="#3f3f46" />
        </g>
      );
    case 'switch_3way':
      return (
        <g>
          <rect
            x="8"
            y="10"
            width="24"
            height="22"
            rx="4"
            fill="#27272a"
            stroke="#00e5ff"
            strokeWidth="1.5"
          />
          <circle cx="20" cy="20" r="5.5" fill="#e4e4e7" stroke="#71717a" strokeWidth="1" />
          <line
            x1="20"
            y1="20"
            x2="20"
            y2="5"
            stroke="#ca8a04"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <rect x="11" y="31" width="3" height="4" fill="#d4d4d8" rx="0.5" />
          <rect x="18.5" y="31" width="3" height="4" fill="#d4d4d8" rx="0.5" />
          <rect x="26" y="31" width="3" height="4" fill="#d4d4d8" rx="0.5" />
        </g>
      );
    case 'switch_4way':
    case 'switch_5way':
      return (
        <g>
          <rect
            x="4"
            y="10"
            width="32"
            height="18"
            rx="3"
            fill="#1e293b"
            stroke="#0284c7"
            strokeWidth="1.5"
          />
          <rect x="8" y="17" width="24" height="4" rx="1" fill="#0f172a" />
          <rect x="18" y="5" width="4" height="14" rx="1" fill="#ca8a04" />
          <circle cx="8" cy="30" r="1.2" fill="#d4d4d8" />
          <circle cx="16" cy="30" r="1.2" fill="#d4d4d8" />
          <circle cx="24" cy="30" r="1.2" fill="#d4d4d8" />
          <circle cx="32" cy="30" r="1.2" fill="#d4d4d8" />
        </g>
      );
    case 'switch_dpdt':
      return (
        <g>
          <rect
            x="9"
            y="8"
            width="22"
            height="24"
            rx="3"
            fill="#1d4ed8"
            stroke="#3b82f6"
            strokeWidth="1.5"
          />
          <circle cx="20" cy="18" r="4.5" fill="#93c5fd" />
          <line
            x1="20"
            y1="18"
            x2="20"
            y2="4"
            stroke="#ca8a04"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="14" cy="13" r="1" fill="#d4d4d8" />
          <circle cx="26" cy="13" r="1" fill="#d4d4d8" />
          <circle cx="14" cy="18" r="1" fill="#d4d4d8" />
          <circle cx="26" cy="18" r="1" fill="#d4d4d8" />
          <circle cx="14" cy="23" r="1" fill="#d4d4d8" />
          <circle cx="26" cy="23" r="1" fill="#d4d4d8" />
        </g>
      );
    case 'capacitor':
      return (
        <g>
          <line x1="2" y1="20" x2="8" y2="20" stroke="#e4e4e7" strokeWidth="1.5" />
          <line x1="32" y1="20" x2="38" y2="20" stroke="#e4e4e7" strokeWidth="1.5" />
          <rect
            x="7"
            y="12"
            width="26"
            height="16"
            rx="8"
            fill="#f97316"
            stroke="#c2410c"
            strokeWidth="1.5"
          />
          <rect x="11" y="15" width="18" height="10" rx="5" fill="#fdba74" />
        </g>
      );
    case 'resistor':
      return (
        <g>
          <line x1="2" y1="20" x2="8" y2="20" stroke="#e4e4e7" strokeWidth="1.5" />
          <line x1="32" y1="20" x2="38" y2="20" stroke="#e4e4e7" strokeWidth="1.5" />
          <rect
            x="8"
            y="13"
            width="24"
            height="14"
            rx="7"
            fill="#d1d5db"
            stroke="#9ca3af"
            strokeWidth="1.5"
          />
          <rect x="13" y="13" width="2" height="14" fill="#ef4444" />
          <rect x="18" y="13" width="2" height="14" fill="#3b82f6" />
          <rect x="23" y="13" width="2" height="14" fill="#eab308" />
          <rect x="28" y="13" width="2" height="14" fill="#ca8a04" />
        </g>
      );
    case 'output_jack':
      return (
        <g>
          <rect
            x="6"
            y="6"
            width="28"
            height="28"
            rx="4"
            fill="#a1a1aa"
            stroke="#52525b"
            strokeWidth="1.5"
          />
          <circle cx="20" cy="20" r="8" fill="#27272a" />
          <circle cx="20" cy="20" r="5" fill="#e4e4e7" />
          <path d="M 27 12 Q 32 16 32 20" stroke="#ca8a04" strokeWidth="2" fill="none" />
        </g>
      );
    case 'wire':
    case 'hookup_wire':
      return (
        <g>
          <path
            d="M 6 30 Q 12 8 20 20 T 34 10"
            stroke="#d97706"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="6" cy="30" r="2.5" fill="#f4f4f5" stroke="#d97706" strokeWidth="1" />
          <circle cx="34" cy="10" r="2.5" fill="#f4f4f5" stroke="#d97706" strokeWidth="1" />
        </g>
      );
    case 'shape_rect':
      return (
        <g>
          <rect
            x="6"
            y="8"
            width="28"
            height="24"
            rx="3"
            fill="rgba(168, 85, 247, 0.2)"
            stroke="#a855f7"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
        </g>
      );
    case 'shape_circle':
      return (
        <g>
          <circle
            cx="20"
            cy="20"
            r="13"
            fill="rgba(56, 189, 248, 0.2)"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
        </g>
      );
    case 'shape_line':
      return (
        <g>
          <line
            x1="6"
            y1="20"
            x2="34"
            y2="20"
            stroke="#e2e8f0"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        </g>
      );
    case 'shape_arrow':
      return (
        <g>
          <line x1="6" y1="20" x2="30" y2="20" stroke="#eab308" strokeWidth="2" />
          <polygon points="34,20 28,16 28,24" fill="#eab308" />
        </g>
      );
    default:
      return <rect x="5" y="5" width="30" height="30" fill="#3f3f46" rx="4" />;
  }
}
