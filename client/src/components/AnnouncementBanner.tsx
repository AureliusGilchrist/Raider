import React, { useEffect, useState } from 'react';
import { X, Info, AlertTriangle, AlertOctagon } from 'lucide-react';
import { announcements as announcementsApi } from '../lib/api';
import type { Announcement } from '../lib/types';

export function AnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    announcementsApi.list().then(setItems).catch(() => {});
  }, []);

  const dismiss = async (id: string) => {
    setItems((prev) => prev.filter((a) => a.id !== id));
    await announcementsApi.dismiss(id).catch(() => {});
  };

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-0">
      {items.map((a) => (
        <div
          key={a.id}
          className={`flex items-center justify-between px-4 py-2 text-sm transition-all-custom ${
            a.type === 'critical'
              ? 'bg-red-500/20 border-b border-red-500/30 text-red-300'
              : a.type === 'warning'
              ? 'bg-amber-500/20 border-b border-amber-500/30 text-amber-300'
              : 'bg-blue-500/20 border-b border-blue-500/30 text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {a.type === 'critical' ? (
              <AlertOctagon size={16} />
            ) : a.type === 'warning' ? (
              <AlertTriangle size={16} />
            ) : (
              <Info size={16} />
            )}
            <span>{a.content}</span>
          </div>
          <button
            onClick={() => dismiss(a.id)}
            className="p-1 hover:bg-white/10 rounded transition-all-custom"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

interface UnencryptedWarningProps {
  visible: boolean;
}

export function UnencryptedWarning({ visible }: UnencryptedWarningProps) {
  if (!visible) return null;
  return (
    <div className="unencrypted-warning flex items-center justify-center gap-2">
      <AlertTriangle size={16} />
      <span>Warning: all messages you send are unencrypted until you shake the other person's hand</span>
    </div>
  );
}
