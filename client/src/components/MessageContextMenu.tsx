import React, { useEffect, useRef } from 'react';
import {
  Copy, Edit2, Trash2, Reply, Flag, Pin, Share2,
  UserX, Clock, Ban, Shield, Hash, AtSign, MoreHorizontal,
} from 'lucide-react';

export interface ContextMenuItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  separator?: boolean;
}

interface MessageContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  items: ContextMenuItem[];
}

export function MessageContextMenu({ x, y, onClose, items }: MessageContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Keep menu inside viewport
  const menuW = 210;
  const menuH = items.length * 34 + 12;
  const adjX = Math.min(x, window.innerWidth - menuW - 8);
  const adjY = Math.min(y, window.innerHeight - menuH - 8);

  return (
    <div
      ref={ref}
      className="fixed z-[9999] py-1.5 rounded-xl overflow-hidden select-none"
      style={{
        left: adjX,
        top: adjY,
        minWidth: menuW,
        background: 'rgba(8, 8, 24, 0.78)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255,255,255,0.13)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {item.separator && i > 0 && (
            <div className="mx-2 my-1 h-px bg-white/10" />
          )}
          <button
            className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-sm transition-colors text-left ${
              item.danger
                ? 'text-red-400 hover:text-red-300 hover:bg-red-500/15'
                : 'text-gray-200 hover:bg-white/10'
            }`}
            onClick={() => { item.onClick(); onClose(); }}
          >
            <span className="shrink-0 opacity-60 w-4 flex items-center justify-center">
              {item.icon}
            </span>
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

// Re-export icons so callers can use them without importing lucide themselves
export { Copy, Edit2, Trash2, Reply, Flag, Pin, Share2, UserX, Clock, Ban, Shield, Hash, AtSign, MoreHorizontal };
