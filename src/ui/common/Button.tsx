import React from 'react';

type BaseButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  variant?: 'primary' | 'secondary' | 'icon' | 'danger' | 'ghost';
  className?: string;
};

export type ButtonProps = BaseButtonProps &
  (
    | { variant: 'icon'; 'aria-label': string; title?: string } // Require aria-label for icon buttons
    | { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; 'aria-label'?: string }
  );

export function Button({
  variant = 'secondary',
  className = '',
  style,
  children,
  ...props
}: ButtonProps) {
  let baseClass = 'btn';

  if (variant === 'primary') baseClass += ' btn--primary';
  if (variant === 'secondary') baseClass += ' btn--secondary';
  if (variant === 'danger') baseClass += ' btn--danger';

  const iconStyle: React.CSSProperties =
    variant === 'icon'
      ? {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '4px',
        }
      : {};

  const ghostStyle: React.CSSProperties =
    variant === 'ghost'
      ? {
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }
      : {};

  return (
    <button
      className={`${variant !== 'icon' && variant !== 'ghost' ? baseClass : ''} ${className}`.trim()}
      style={{ ...iconStyle, ...ghostStyle, ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
