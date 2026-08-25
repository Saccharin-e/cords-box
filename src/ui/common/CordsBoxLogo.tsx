export function CordsBoxLogo({
  size = 28,
  className = '',
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      style={{ flexShrink: 0, ...style }}
    >
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="5"
        fill="#121215"
        stroke="#3f3f46"
        strokeWidth="1.5"
      />
      <path
        d="M 6 10 C 14 4, 18 20, 26 14 C 20 28, 8 18, 16 10 C 24 2, 28 22, 22 26"
        stroke="#d97706"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M 10 26 C 4 18, 22 8, 14 24 C 28 12, 10 6, 26 22"
        stroke="#0284c7"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.9"
      />
      <circle cx="6" cy="10" r="1.5" fill="#d97706" />
      <circle cx="22" cy="26" r="1.5" fill="#d97706" />
      <circle cx="10" cy="26" r="1.5" fill="#0284c7" />
      <circle cx="26" cy="22" r="1.5" fill="#0284c7" />
    </svg>
  );
}
