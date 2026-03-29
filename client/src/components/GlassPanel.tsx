import React from 'react';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'light' | 'heavy';
  onClick?: () => void;
}

export function GlassPanel({ children, className = '', variant = 'default', onClick }: GlassPanelProps) {
  const base = variant === 'light' ? 'glass-light' : variant === 'heavy' ? 'glass-heavy' : 'glass';
  return (
    <div
      className={`${base} rounded-xl transition-all-custom ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
