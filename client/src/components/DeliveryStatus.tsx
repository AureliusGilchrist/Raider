import React from 'react';

interface DeliveryStatusProps {
  status: 'sending' | 'sent' | 'delivered' | 'read';
  className?: string;
}

export function DeliveryStatus({ status, className = '' }: DeliveryStatusProps) {
  const statusConfig = {
    sending: { color: '#9ca3af', label: 'Sending' },
    sent: { color: '#6b7280', label: 'Sent' },
    delivered: { color: '#22c55e', label: 'Delivered' },
    read: { color: '#3b82f6', label: 'Read' },
  };

  const config = statusConfig[status];

  return (
    <span className={`text-[10px] ${className}`} style={{ color: config.color }}>
      {status === 'sending' && (
        <span className="inline-block w-2 h-2 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      )}
      {status === 'sent' && '✓'}
      {status === 'delivered' && '✓✓'}
      {status === 'read' && <span className="text-blue-400">✓✓</span>}
    </span>
  );
}
