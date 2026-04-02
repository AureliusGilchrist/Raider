import React, { useState, useEffect } from 'react';
import { X, Megaphone, Clock, Palette } from 'lucide-react';
import { servers as serversApi } from '../lib/api';
import { raiderConfirm } from './CustomPopup';

interface ServerAnnouncementEditorProps {
  serverId: string;
  onClose: () => void;
  existingAnnouncement?: {
    id: string;
    content: string;
    color: string;
    icon: string;
  } | null;
}

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#a855f7', // Purple
];

const ICONS = ['📢', '📌', '🔔', '🎉', '⚠️', 'ℹ️', '🎊', '🚀', '💡', '🔥'];

export function ServerAnnouncementEditor({ serverId, onClose, existingAnnouncement }: ServerAnnouncementEditorProps) {
  const [content, setContent] = useState(existingAnnouncement?.content || '');
  const [color, setColor] = useState(existingAnnouncement?.color || '#6366f1');
  const [icon, setIcon] = useState(existingAnnouncement?.icon || '📢');
  const [pinHours, setPinHours] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const data = {
        content: content.trim(),
        color,
        icon,
        pin_hours: pinHours,
      };

      if (existingAnnouncement?.id) {
        await serversApi.updateAnnouncement(serverId, existingAnnouncement.id, data);
      } else {
        await serversApi.createAnnouncement(serverId, data);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingAnnouncement?.id) return;
    if (!(await raiderConfirm('Delete this announcement?'))) return;

    setSaving(true);
    try {
      await serversApi.deleteAnnouncement(serverId, existingAnnouncement.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="glass p-6 rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Megaphone size={20} />
            {existingAnnouncement ? 'Edit' : 'Post'} Server Announcement
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-all-custom">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Icon Selection */}
          <div>
            <label className="text-xs text-gray-400 uppercase font-medium mb-2 block">Icon</label>
            <div className="flex gap-2 flex-wrap">
              {ICONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={`w-10 h-10 rounded-lg text-xl transition-all-custom ${
                    icon === emoji ? 'bg-white/20 ring-2 ring-indigo-400' : 'hover:bg-white/10'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="text-xs text-gray-400 uppercase font-medium mb-2 block flex items-center gap-1">
              <Palette size={12} /> Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg transition-all-custom ${
                    color === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="text-xs text-gray-400 uppercase font-medium mb-2 block">Announcement Text</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your server announcement..."
              rows={4}
              className="w-full resize-none"
              maxLength={500}
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">{content.length}/500</span>
            </div>
          </div>

          {/* Pin Duration */}
          <div>
            <label className="text-xs text-gray-400 uppercase font-medium mb-2 block flex items-center gap-1">
              <Clock size={12} /> Pin Duration (optional)
            </label>
            <select
              value={pinHours}
              onChange={(e) => setPinHours(Number(e.target.value))}
              className="w-full"
            >
              <option value={0}>Permanent</option>
              <option value={1}>1 hour</option>
              <option value={6}>6 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>1 day</option>
              <option value={72}>3 days</option>
              <option value={168}>1 week</option>
            </select>
          </div>

          {/* Preview */}
          <div>
            <label className="text-xs text-gray-400 uppercase font-medium mb-2 block">Preview</label>
            <div
              className="p-4 rounded-lg border border-white/20"
              style={{
                background: `linear-gradient(135deg, ${color}40 0%, ${color}20 100%)`,
                borderLeft: `4px solid ${color}`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{icon}</span>
                <span className="text-xs font-semibold text-white/80 uppercase">Server Announcement</span>
              </div>
              <p className="text-sm text-white/90 whitespace-pre-wrap">
                {content || 'Your announcement will appear like this...'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          {existingAnnouncement?.id && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="btn bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/40"
            >
              Delete
            </button>
          )}
          <button onClick={onClose} className="btn btn-glass flex-1">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="btn btn-primary flex-1"
          >
            {saving ? 'Saving...' : existingAnnouncement ? 'Update' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
