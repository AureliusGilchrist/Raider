import React, { useState, useEffect } from 'react';
import { X, Users, Search, Check } from 'lucide-react';
import { groups as groupsApi, handshakes as handshakesApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { Avatar } from './Avatar';

interface CreateGroupDialogProps {
  onClose: () => void;
  onCreated: (groupId: string) => void;
}

export function CreateGroupDialog({ onClose, onCreated }: CreateGroupDialogProps) {
  const { user: me } = useAuthStore();
  const [name, setName] = useState('');
  const [handshakes, setHandshakes] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadHandshakes();
  }, []);

  const loadHandshakes = async () => {
    try {
      const data = await handshakesApi.list();
      // Get handshake partners
      const partners = data.map((h: any) => {
        const isInitiator = h.initiator_id === me?.id;
        return {
          id: isInitiator ? h.responder_id : h.initiator_id,
          username: isInitiator ? h.responder_username : h.initiator_username,
          display_name: isInitiator ? h.responder_display_name : h.initiator_display_name,
          avatar_url: isInitiator ? h.responder_avatar : h.initiator_avatar,
          avatar_type: isInitiator ? h.responder_avatar_type : h.initiator_avatar_type,
        };
      });
      setHandshakes(partners);
    } catch (err) {
      console.error('Failed to load handshakes:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }
    if (selectedMembers.size < 1) {
      setError('Select at least 1 member');
      return;
    }
    if (selectedMembers.size > 51) {
      setError('Maximum 52 members allowed (including you)');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const group = await groupsApi.create({
        name: name.trim(),
        members: Array.from(selectedMembers),
      });
      onCreated(group.id);
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const filteredHandshakes = handshakes.filter((h) =>
    (h.username?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (h.display_name?.toLowerCase() || '').includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="glass p-6 rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users size={20} /> Create Group Chat
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

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Group name */}
          <div>
            <label className="text-xs text-gray-400 uppercase font-medium mb-2 block">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name..."
              className="w-full"
              maxLength={50}
            />
          </div>

          {/* Member count */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">
              Selected: {selectedMembers.size + 1} / 52 members
            </span>
            {selectedMembers.size > 0 && (
              <button
                onClick={() => setSelectedMembers(new Set())}
                className="text-indigo-400 hover:text-indigo-300"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search handshakes..."
              className="w-full pl-9"
            />
          </div>

          {/* Handshake list */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {loading ? (
              <p className="text-gray-400 text-center py-4">Loading...</p>
            ) : filteredHandshakes.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                {search ? 'No matches found' : 'No handshakes yet. Make some first!'}
              </p>
            ) : (
              filteredHandshakes.map((h) => (
                <button
                  key={h.id}
                  onClick={() => toggleMember(h.id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all-custom ${
                    selectedMembers.has(h.id)
                      ? 'bg-indigo-500/20 border border-indigo-500/40'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <Avatar url={h.avatar_url} type={h.avatar_type} size={36} />
                  <div className="flex-1 text-left">
                    <p className="text-sm text-gray-200">{h.display_name || h.username}</p>
                    <p className="text-xs text-gray-500">@{h.username}</p>
                  </div>
                  {selectedMembers.has(h.id) && (
                    <Check size={16} className="text-indigo-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-4 pt-4 border-t border-white/10">
          <button onClick={onClose} className="btn btn-glass flex-1">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim() || selectedMembers.size === 0}
            className="btn btn-primary flex-1"
          >
            {creating ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}
