import React, { useState } from 'react';

interface StatusIndicatorProps {
  status: string;
  statusMessage?: string;
  size?: number;
  className?: string;
}

const statusColors: Record<string, string> = {
  online: '#22c55e',    // green
  away: '#eab308',      // yellow
  busy: '#ef4444',      // red
  streaming: '#a855f7', // purple
  invisible: '#9ca3af', // gray
  offline: '#6b7280',   // dark gray
};

const statusLabels: Record<string, string> = {
  online: 'Online',
  away: 'Away',
  busy: 'Do Not Disturb',
  streaming: 'Streaming',
  invisible: 'Invisible',
  offline: 'Offline',
};

export function StatusIndicator({ status, statusMessage, size = 10, className = '' }: StatusIndicatorProps) {
  const color = statusColors[status] || statusColors.offline;
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-block">
      <span
        className={`inline-block rounded-full border-2 border-[#0a0a1e] ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          boxShadow: `0 0 4px ${color}`,
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      />
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded whitespace-nowrap z-50 pointer-events-none">
          <span className="font-medium">{statusLabels[status] || status}</span>
          {statusMessage && (
            <span className="block text-gray-300 max-w-[150px] truncate">{statusMessage}</span>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/90" />
        </div>
      )}
    </div>
  );
}
