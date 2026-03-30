import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone, X, Edit3, Pin } from 'lucide-react';
import { servers as serversApi } from '../lib/api';
import { useWSStore } from '../stores/wsStore';

interface ServerAnnouncement {
  id: string;
  server_id: string;
  author_id: string;
  author_name: string;
  content: string;
  color: string;
  icon: string;
  active: boolean;
  pin_until?: string;
  created_at: string;
}

interface ServerAnnouncementBannerProps {
  serverId: string;
  canEdit: boolean;
  onEdit: () => void;
}

export function ServerAnnouncementBanner({ serverId, canEdit, onEdit }: ServerAnnouncementBannerProps) {
  const [announcement, setAnnouncement] = useState<ServerAnnouncement | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const { on } = useWSStore();

  const loadAnnouncement = useCallback(async () => {
    try {
      const data = await serversApi.getAnnouncement(serverId);
      setAnnouncement(data);
    } catch (err) {
      // No announcement is fine
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    loadAnnouncement();
  }, [loadAnnouncement]);

  useEffect(() => {
    const unsubNew = on('server_announcement_new', (msg) => {
      if (msg.payload?.server_id === serverId) {
        setAnnouncement(msg.payload);
        setDismissed(false);
      }
    });
    const unsubUpdated = on('server_announcement_updated', (msg) => {
      if (msg.payload?.server_id === serverId) {
        loadAnnouncement();
      }
    });
    const unsubDeleted = on('server_announcement_deleted', (msg) => {
      if (msg.payload?.server_id === serverId) {
        setAnnouncement(null);
      }
    });
    return () => {
      unsubNew();
      unsubUpdated();
      unsubDeleted();
    };
  }, [serverId, on, loadAnnouncement]);

  if (loading || !announcement || dismissed) {
    return null;
  }

  // Check if pinned and expired
  if (announcement.pin_until && new Date(announcement.pin_until) < new Date()) {
    return null;
  }

  return (
    <div
      className="relative px-4 py-3 mx-4 mt-4 rounded-xl border border-white/20 backdrop-blur-md animate-slide-down"
      style={{
        background: `linear-gradient(135deg, ${announcement.color}40 0%, ${announcement.color}20 100%)`,
        borderLeft: `4px solid ${announcement.color}`,
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{announcement.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
              Server Announcement
            </span>
            <span className="text-xs text-white/60">
              by {announcement.author_name}
            </span>
            {announcement.pin_until && (
              <span className="flex items-center gap-1 text-xs text-white/60">
                <Pin size={10} />
                Pinned
              </span>
            )}
          </div>
          <p className="text-sm text-white/90 whitespace-pre-wrap">{announcement.content}</p>
          <span className="text-[10px] text-white/50 mt-1 block">
            {new Date(announcement.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {canEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 text-white/60 hover:text-white hover:bg-white/20 rounded-lg transition-all-custom"
              title="Edit announcement"
            >
              <Edit3 size={14} />
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-white/60 hover:text-white hover:bg-white/20 rounded-lg transition-all-custom"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
