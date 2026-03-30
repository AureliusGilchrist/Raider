import React, { useEffect, useState, useRef } from 'react';
import { useParams } from '@tanstack/react-router';
import { GlassPanel } from '../../components/GlassPanel';
import { Avatar } from '../../components/Avatar';
import { servers as serversApi, messages as messagesApi, shares as sharesApi } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useWSStore } from '../../stores/wsStore';
import type { Channel, Message } from '../../lib/types';
import { Hash, Volume2, Plus, Send, Users, Share2, X, Crown, Shield, User, Phone, Settings, Megaphone } from 'lucide-react';
import { StatusIndicator } from '../../components/StatusIndicator';
import { TypingIndicator, useTypingEmitter } from '../../components/TypingIndicator';
import { FormattedText } from '../../components/FormattedText';
import { FormatHelper } from '../../components/FormatHelper';
import { formatDateDivider, isDifferentDay } from '../../lib/dateUtils';
import { VoiceChannelPanel } from '../../components/VoiceChannel';
import { RoleManager } from '../../components/RoleManager';
import { ServerAnnouncementBanner } from '../../components/ServerAnnouncementBanner';
import { ServerAnnouncementEditor } from '../../components/ServerAnnouncementEditor';
import { ServerSettingsPanel } from '../../components/ServerSettingsPanel';

export function ServerPage() {
  const { serverId } = useParams({ strict: false }) as { serverId: string };
  const { user } = useAuthStore();
  const { send, on } = useWSStore();

  const [server, setServer] = useState<any>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [shareComment, setShareComment] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<string | null>(null);
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showAnnouncementEditor, setShowAnnouncementEditor] = useState(false);
  const emitTyping = useTypingEmitter({ channelId: activeChannel || undefined });
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevChannelRef = useRef<string | null>(null);

  const handleShareMessage = async () => {
    if (!shareMsg) return;
    try {
      await sharesApi.create({ share_type: 'message', message_id: shareMsg, comment: shareComment });
      setShareMsg(null);
      setShareComment('');
    } catch {}
  };

  useEffect(() => {
    Promise.all([
      serversApi.get(serverId).catch(() => null),
      serversApi.channels(serverId).catch(() => []),
      serversApi.members(serverId).catch(() => []),
    ]).then(([s, ch, m]) => {
      setServer(s);
      setChannels(ch || []);
      setMembers(m || []);
      if (ch && ch.length > 0) setActiveChannel(ch[0].id);
    });
  }, [serverId]);

  useEffect(() => {
    if (!activeChannel) return;
    // Leave previous channel
    if (prevChannelRef.current && prevChannelRef.current !== activeChannel) {
      send({ type: 'leave_channel', payload: { channel_id: prevChannelRef.current } });
    }
    prevChannelRef.current = activeChannel;

    messagesApi.channel(activeChannel).then(setMsgs).catch(() => {});
    send({ type: 'join_channel', payload: { channel_id: activeChannel } });

    const unsub = on('new_message', (msg) => {
      if (msg.payload?.channel_id === activeChannel) {
        setMsgs((prev) => {
          // Deduplicate by ID
          if (prev.some((m) => m.id === msg.payload.id)) return prev;
          return [...prev, msg.payload];
        });
      }
    });
    return () => {
      unsub();
    };
  }, [activeChannel]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  // Helper: should this message show a full header or be grouped?
  const shouldGroup = (msgs: Message[], index: number) => {
    if (index === 0) return false;
    const prev = msgs[index - 1];
    const curr = msgs[index];
    if (prev.sender_id !== curr.sender_id) return false;
    const gap = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime();
    return gap < 5 * 60 * 1000; // 5 minutes
  };

  const handleSend = async () => {
    if (!input.trim() || !activeChannel) return;
    try {
      await messagesApi.send({
        content: input,
        channel_id: activeChannel,
        server_id: serverId,
        encrypted: false,
        reply_to_id: replyTo?.id,
      });
      setInput('');
      setReplyTo(null);
    } catch {}
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    try {
      const ch = await serversApi.createChannel(serverId, { name: newChannelName, type: 'text' });
      setChannels((prev) => [...prev, ch]);
      setNewChannelName('');
      setShowCreateChannel(false);
    } catch {}
  };

  return (
    <div className="flex h-full relative">
      {/* Share dialog */}
      {shareMsg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <GlassPanel className="p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Share2 size={18} /> Share Message to Home
              </h3>
              <button onClick={() => { setShareMsg(null); setShareComment(''); }} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <textarea
              placeholder="Add a comment (optional)..."
              value={shareComment}
              onChange={(e) => setShareComment(e.target.value)}
              rows={2}
              className="w-full mb-3"
            />
            <button onClick={handleShareMessage} className="btn btn-primary w-full">
              <Share2 size={14} /> Share
            </button>
          </GlassPanel>
        </div>
      )}

      {/* Channel sidebar */}
      <div className="w-56 glass-light border-r border-white/10 flex flex-col shrink-0">
        <div className="p-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white truncate">{server?.name || 'Loading...'}</h2>
            {server?.owner_id === user?.id && (
              <div className="flex gap-1">
                <button
                  onClick={() => setShowAnnouncementEditor(true)}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-all-custom"
                  title="Post Announcement"
                >
                  <Megaphone size={14} />
                </button>
                <button
                  onClick={() => setShowRoleManager(true)}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-all-custom"
                  title="Manage Roles"
                >
                  <Shield size={14} />
                </button>
                <button
                  onClick={() => setShowServerSettings(true)}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-all-custom"
                  title="Server Settings"
                >
                  <Settings size={14} />
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{server?.description}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase">Channels</span>
            <button onClick={() => setShowCreateChannel(!showCreateChannel)} className="text-gray-500 hover:text-white">
              <Plus size={14} />
            </button>
          </div>

          {showCreateChannel && (
            <form onSubmit={handleCreateChannel} className="px-2 mb-2">
              <input
                type="text"
                placeholder="channel-name"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                className="w-full text-xs py-1 px-2"
                autoFocus
              />
            </form>
          )}

          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => {
                if (ch.type === 'voice') {
                  setActiveVoiceChannel(activeVoiceChannel === ch.id ? null : ch.id);
                } else {
                  setActiveChannel(ch.id);
                }
              }}
              className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-all-custom ${
                (ch.type === 'text' && activeChannel === ch.id) || (ch.type === 'voice' && activeVoiceChannel === ch.id)
                  ? 'bg-white/15 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {ch.type === 'voice' ? <Volume2 size={14} /> : <Hash size={14} />}
              <span className="truncate">{ch.name}</span>
              {ch.type === 'voice' && <span className="ml-auto text-[10px] text-green-400">●</span>}
            </button>
          ))}
        </div>

        {/* Members count */}
        <div className="p-3 border-t border-white/10 text-xs text-gray-500 flex items-center gap-1">
          <Users size={12} /> {members.length} members
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <ServerAnnouncementBanner
          serverId={serverId}
          canEdit={server?.owner_id === user?.id}
          onEdit={() => setShowAnnouncementEditor(true)}
        />
        {activeChannel ? (
          <>
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <Hash size={16} className="text-gray-400" />
              <span className="text-white font-medium text-sm">
                {channels.find((c) => c.id === activeChannel)?.name || ''}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col">
              {msgs.map((msg, i) => {
                const grouped = shouldGroup(msgs, i);
                const showDateDivider = i === 0 || isDifferentDay(msg.created_at, msgs[i - 1].created_at);
                return (
                  <>
                    {showDateDivider && (
                      <div key={`date-${msg.id}`} className="flex items-center gap-4 my-4">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-xs text-gray-500 font-medium">{formatDateDivider(msg.created_at)}</span>
                        <div className="flex-1 h-px bg-white/10" />
                      </div>
                    )}
                    <div key={msg.id} className={`flex items-start gap-3 group hover:bg-white/5 rounded px-2 ${grouped ? 'py-0.5' : 'pt-3 pb-0.5'}`}>
                    {grouped ? (
                      <div className="w-8 shrink-0 flex items-center justify-center">
                        <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-all-custom">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ) : (
                      <Avatar url={msg.sender_avatar || ''} type="image" size={32} />
                    )}
                    <div className="flex-1 min-w-0">
                      {!grouped && (
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-indigo-300">{msg.sender_name || 'Unknown'}</span>
                          <span className="text-xs text-gray-600">{new Date(msg.created_at).toLocaleTimeString()}</span>
                        </div>
                      )}
                      <FormattedText text={msg.content} className="text-sm text-gray-200" />
                      {msg.reply_to && (
                        <div className="mt-1 pl-2 border-l-2 border-indigo-500/50 text-xs text-gray-400">
                          <span className="text-indigo-300">Replying to {msg.reply_to.sender_name}:</span> {msg.reply_to.content.slice(0, 50)}...
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all-custom">
                      <button
                        onClick={() => setReplyTo(msg)}
                        className="p-1 text-gray-500 hover:text-indigo-400"
                        title="Reply"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
                      </button>
                      <button
                        onClick={() => setShareMsg(msg.id)}
                        className="p-1 text-gray-500 hover:text-green-400"
                        title="Share to home"
                      >
                        <Share2 size={14} />
                      </button>
                    </div>
                  </div>
                  </>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-white/10">
              {replyTo && (
                <div className="flex items-center justify-between mb-2 px-2 py-1 bg-white/5 rounded text-xs">
                  <span className="text-gray-400">Replying to <span className="text-indigo-300">{replyTo.sender_name}</span></span>
                  <button onClick={() => setReplyTo(null)} className="text-gray-500 hover:text-white"><X size={12} /></button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={`Message #${channels.find((c) => c.id === activeChannel)?.name || 'channel'}...`}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); emitTyping(); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="flex-1"
                />
                <FormatHelper />
                <button onClick={handleSend} className="btn btn-primary px-3">
                  <Send size={16} />
                </button>
              </div>
              <TypingIndicator channelId={activeChannel || undefined} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a channel to start chatting
          </div>
        )}
      </div>
      {/* Members sidebar */}
      <div className="w-56 glass-light border-l border-white/10 flex flex-col shrink-0">
        <div className="p-3 border-b border-white/10">
          <h2 className="text-sm font-semibold text-gray-400">Members</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {/* Group by role */}
          {['owner', 'admin', 'moderator', 'member'].map((role) => {
            const roleMembers = members.filter((m) => m.role === role || (role === 'member' && !['owner', 'admin', 'moderator'].includes(m.role)));
            if (roleMembers.length === 0) return null;
            return (
              <div key={role}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-1">
                  {role} — {roleMembers.length}
                </h3>
                {roleMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-all-custom">
                    <div className="relative">
                      <Avatar url={member.avatar_url || ''} type={member.avatar_type || 'image'} size={28} />
                      <div className="absolute -bottom-0.5 -right-0.5">
                        <StatusIndicator status={member.status || 'offline'} statusMessage={member.status_message} size={8} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{member.display_name || member.username}</p>
                      {member.status_message && (
                        <p className="text-[10px] text-gray-500 truncate">{member.status_message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Voice Channel Panel */}
      {activeVoiceChannel && (
        <VoiceChannelPanel
          channelId={activeVoiceChannel}
          serverId={serverId}
          onClose={() => setActiveVoiceChannel(null)}
        />
      )}

      {/* Role Manager Modal */}
      {showRoleManager && (
        <RoleManager serverId={serverId} onClose={() => setShowRoleManager(false)} />
      )}

      {/* Server Settings Modal */}
      {showServerSettings && (
        <ServerSettingsPanel serverId={serverId} onClose={() => setShowServerSettings(false)} />
      )}

      {/* Announcement Editor Modal */}
      {showAnnouncementEditor && (
        <ServerAnnouncementEditor
          serverId={serverId}
          onClose={() => setShowAnnouncementEditor(false)}
        />
      )}
    </div>
  );
}
