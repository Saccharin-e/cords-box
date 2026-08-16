import React, { useRef, useEffect, useState } from 'react';

export type SliderProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: '%' | 'px' | 'x' | 'raw';
  accentColor: string;
  onChange: (val: number) => void;
  onCommit?: () => void;
  readoutColor?: string;
  containerStyle?: React.CSSProperties;
};

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = 'raw',
  accentColor,
  onChange,
  onCommit,
  readoutColor,
  containerStyle,
  ...props
}: SliderProps) {
  const [localVal, setLocalVal] = useState(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value);
    setLocalVal(val);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      onChange(val);
    });
  }

  function handleCommit() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    onChange(localVal);
    if (onCommit) onCommit();
  }
  
  const formattedValue = React.useMemo(() => {
    if (unit === '%') return `${Math.round(localVal * 100)}%`;
    if (unit === 'px') return `${localVal}px`;
    if (unit === 'x') return `${localVal}x`;
    return localVal;
  }, [localVal, unit]);

  return (
    <div style={{ marginTop: 8, ...containerStyle }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          marginBottom: 4,
          alignItems: 'center',
        }}
      >
        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{label}</span>
        <span
          className="inspector-mono"
          style={{ 
            color: readoutColor || accentColor, 
            fontWeight: 700 
          }}
        >
          {formattedValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localVal}
        onChange={handleChange}
        onPointerUp={handleCommit}
        onKeyUp={handleCommit}
        style={{ width: '100%', accentColor, cursor: 'pointer', ...props.style }}
        {...props}
      />
    </div>
  );
}
