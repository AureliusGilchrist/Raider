import React, { useState, useEffect, useRef } from 'react';
import { Users, Send, X, Plus, UserMinus, Trash2, MoreVertical } from 'lucide-react';
import { groups as groupsApi } from '../lib/api';
import { raiderConfirm } from './CustomPopup';
import { useAuthStore } from '../stores/authStore';
import { useWSStore } from '../stores/wsStore';
import { Avatar } from './Avatar';
import { GlassPanel } from './GlassPanel';
import { FormattedText } from './FormattedText';

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  encrypted: boolean;
  created_at: string;
  edited_at?: string;
  sender_name?: string;
  sender_avatar?: string;
}

interface GroupChatProps {
  groupId: string;
  onBack?: () => void;
}

export function GroupChat({ groupId, onBack }: GroupChatProps) {
  const { user: me } = useAuthStore();
  const { send, on } = useWSStore();
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadGroup();
    
    // Join WebSocket room
    send({ type: 'join_group', payload: { group_id: groupId } });
    
    return () => {
      send({ type: 'leave_group', payload: { group_id: groupId } });
    };
  }, [groupId]);

  useEffect(() => {
    const unsub = on('group_message', (msg) => {
      if (msg.payload?.group_id === groupId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.payload.id)) return prev;
          return [...prev, msg.payload];
        });
      }
    });
    return unsub;
  }, [on, groupId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadGroup = async () => {
    try {
      const [groupData, msgs] = await Promise.all([
        groupsApi.get(groupId),
        groupsApi.messages(groupId),
      ]);
      setGroup(groupData.group);
      setMembers(groupData.members);
      setMessages(msgs);
      setIsCreator(groupData.group.creator_id === me?.id);
    } catch (err) {
      console.error('Failed to load group:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    try {
      await groupsApi.sendMessage(groupId, input);
      setInput('');
    } catch (err) {
      console.error('Failed to send:', err);
    }
  };

  const handleLeave = async () => {
    if (!(await raiderConfirm('Leave this group chat?'))) return;
    try {
      await groupsApi.leave(groupId);
      onBack?.();
    } catch (err) {
      console.error('Failed to leave:', err);
    }
  };

  const handleDelete = async () => {
    if (!(await raiderConfirm('Delete this group chat? This cannot be undone.'))) return;
    try {
      await groupsApi.delete(groupId);
      onBack?.();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!(await raiderConfirm('Remove this member?'))) return;
    try {
      await groupsApi.removeMember(groupId, userId);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch (err) {
      console.error('Failed to remove:', err);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">Loading...</div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg text-gray-400">
              <X size={18} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Users size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold">{group?.name}</h2>
              <p className="text-xs text-gray-400">{members.length} members</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="p-2 hover:bg-white/10 rounded-lg text-gray-400"
          >
            <Users size={18} />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMembers(false)}
              className="p-2 hover:bg-white/10 rounded-lg text-gray-400"
            >
              <MoreVertical size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Members sidebar */}
      {showMembers && (
        <div className="absolute right-0 top-16 bottom-0 w-64 glass-light border-l border-white/10 z-10">
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">Members ({members.length})</h3>
            <button onClick={() => setShowMembers(false)} className="p-1 hover:bg-white/10 rounded">
              <X size={14} className="text-gray-400" />
            </button>
          </div>
          <div className="overflow-y-auto p-2 space-y-1">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5">
                <Avatar url={member.avatar_url} type={member.avatar_type} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{member.display_name || member.username}</p>
                  {member.id === group?.creator_id && (
                    <span className="text-[10px] text-indigo-400">Creator</span>
                  )}
                </div>
                {isCreator && member.id !== me?.id && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="p-1.5 text-red-400 hover:bg-red-500/20 rounded"
                  >
                    <UserMinus size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!isCreator && (
            <div className="p-3 border-t border-white/10">
              <button
                onClick={handleLeave}
                className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-red-400 hover:bg-red-500/20"
              >
                <X size={16} /> Leave Group
              </button>
            </div>
          )}
          {isCreator && (
            <div className="p-3 border-t border-white/10">
              <button
                onClick={handleDelete}
                className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-red-400 hover:bg-red-500/20"
              >
                <Trash2 size={16} /> Delete Group
              </button>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.sender_id === me?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] ${isMe ? 'bg-indigo-500/30' : 'bg-white/10'} rounded-2xl px-4 py-2`}>
                {!isMe && (
                  <p className="text-xs text-indigo-300 mb-1">{msg.sender_name}</p>
                )}
                <p className="text-sm text-gray-200"><FormattedText text={msg.content} /></p>
                <p className="text-[10px] text-gray-500 mt-1 text-right">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={`p-4 border-t border-white/10 ${(() => { const fx = localStorage.getItem('raider_chatbar_effect'); return fx && fx !== 'none' ? `chatbar-effect-${fx}` : ''; })()}`}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1"
          />
          <button onClick={handleSend} className="btn btn-primary px-4">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
