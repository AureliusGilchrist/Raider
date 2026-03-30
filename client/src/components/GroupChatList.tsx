import React, { useState, useEffect } from 'react';
import { Users, Plus, MessageCircle } from 'lucide-react';
import { groups as groupsApi } from '../lib/api';
import { Avatar } from './Avatar';

interface GroupChatListProps {
  onSelectGroup: (groupId: string) => void;
  selectedGroupId?: string;
}

export function GroupChatList({ onSelectGroup, selectedGroupId }: GroupChatListProps) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await groupsApi.list();
      setGroups(data);
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-gray-400">Loading...</div>;
  }

  if (groups.length === 0) {
    return (
      <div className="p-4 text-center">
        <Users size={48} className="text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">No group chats yet</p>
        <p className="text-gray-500 text-xs mt-1">Create a group to start chatting with multiple people</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {groups.map((group) => (
        <button
          key={group.id}
          onClick={() => onSelectGroup(group.id)}
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all-custom ${
            selectedGroupId === group.id
              ? 'bg-white/15 text-white'
              : 'hover:bg-white/10 text-gray-300'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
            <Users size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="font-medium truncate">{group.name}</p>
            <p className="text-xs text-gray-500">{group.member_count} members</p>
          </div>
        </button>
      ))}
    </div>
  );
}
