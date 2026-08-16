import React, { useEffect } from 'react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(9, 9, 11, 0.75)',
        backdropFilter: 'blur(10px)',
        fontFamily: "'Inter', sans-serif",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: 420,
          maxWidth: '92vw',
          backgroundColor: '#18181b',
          border: '1px solid #3f3f46',
          borderRadius: 12,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f4f4f5',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #27272a',
            background: 'linear-gradient(180deg, #27272a 0%, #18181b 100%)',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: isDestructive ? '#ef4444' : '#f4f4f5' }}>
            {title}
          </h2>
        </div>
        
        <div style={{ padding: '24px', fontSize: 14, color: '#d4d4d8', lineHeight: 1.5 }}>
          {message}
        </div>

        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#121215',
            borderTop: '1px solid #27272a',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
          }}
        >
          <Button variant="secondary" onClick={onCancel} style={{ minWidth: 80 }}>
            {cancelLabel}
          </Button>
          <Button variant={isDestructive ? 'danger' : 'primary'} onClick={onConfirm} style={{ minWidth: 80 }}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
