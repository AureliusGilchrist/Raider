import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from '@tanstack/react-router';
import { GlassPanel } from '../../components/GlassPanel';
import { Avatar } from '../../components/Avatar';
import { UnencryptedWarning } from '../../components/AnnouncementBanner';
import { messages as messagesApi, handshakes, users as usersApi, calls as callsApi } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useWSStore } from '../../stores/wsStore';
import type { Message } from '../../lib/types';
import { Send, ArrowLeft, Phone } from 'lucide-react';
import { TypingIndicator, useTypingEmitter } from '../../components/TypingIndicator';
import { FormattedText } from '../../components/FormattedText';
import { FormatHelper } from '../../components/FormatHelper';

export function DMConversationPage() {
  const { userId } = useParams({ strict: false }) as { userId: string };
  const { user: me } = useAuthStore();
  const { on } = useWSStore();
  const navigate = useNavigate();
  const emitTyping = useTypingEmitter({ recipientId: userId });

  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [hasHandshake, setHasHandshake] = useState(true);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      messagesApi.dm(userId).catch(() => []),
      usersApi.profile(userId).catch(() => null),
      handshakes.check(userId).catch(() => ({ has_handshake: false })),
    ]).then(([m, u, hs]) => {
      setMsgs(m || []);
      setOtherUser(u);
      setHasHandshake(hs?.has_handshake || false);
    }).finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    const unsub = on('new_message', (msg) => {
      const p = msg.payload;
      if (p && !p.channel_id && (p.sender_id === userId || p.recipient_id === userId)) {
        setMsgs((prev) => {
          if (prev.some((m) => m.id === p.id)) return prev;
          return [...prev, p];
        });
      }
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const handleSend = async () => {
    if (!input.trim()) return;
    try {
      await messagesApi.send({ content: input, recipient_id: userId, encrypted: hasHandshake });
      setInput('');
    } catch {}
  };

  const handleStartCall = async () => {
    try {
      const call = await callsApi.create({ target_id: userId });
      navigate({ to: '/app/call/$callId', params: { callId: call.id } });
    } catch {}
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <Link to="/app/dm" className="text-gray-400 hover:text-white transition-all-custom">
          <ArrowLeft size={20} />
        </Link>
        {otherUser && (
          <Link to="/app/profile/$userId" params={{ userId }} className="flex items-center gap-2 hover:opacity-80 transition-all-custom flex-1 min-w-0">
            <Avatar url={otherUser.avatar_url || ''} type={otherUser.avatar_type || 'image'} size={32} />
            <div>
              <p className="text-sm font-medium text-white">{otherUser.display_name || otherUser.username}</p>
              <p className="text-xs text-gray-500">@{otherUser.username}</p>
            </div>
          </Link>
        )}
        <button
          onClick={handleStartCall}
          className="w-9 h-9 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center hover:bg-green-500/40 transition-all-custom shrink-0"
          title="Start voice call"
        >
          <Phone size={16} />
        </button>
      </div>

      {/* Unencrypted warning */}
      <UnencryptedWarning visible={!hasHandshake} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading...</div>
        ) : msgs.length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-sm">
            No messages yet. Say hi!
          </div>
        ) : (
          msgs.map((msg, i) => {
            const isMe = msg.sender_id === me?.id;
            const prev = i > 0 ? msgs[i - 1] : null;
            const grouped = prev && prev.sender_id === msg.sender_id &&
              new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${grouped ? '' : 'mt-2'}`}>
                <div className={`max-w-[75%] px-4 ${grouped ? 'py-0.5' : 'py-2.5 rounded-2xl'} ${
                  isMe
                    ? `bg-indigo-500/30 border border-indigo-500/20 ${grouped ? 'rounded-lg' : 'rounded-br-md'}`
                    : `glass-light ${grouped ? 'rounded-lg' : 'rounded-bl-md'}`
                }`}>
                  <FormattedText text={msg.content} className="text-sm text-gray-200" />
                  {!grouped && (
                    <span className="text-[10px] text-gray-500 mt-1 block text-right">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={`Message ${otherUser?.display_name || otherUser?.username || 'user'}...`}
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
        <TypingIndicator recipientId={userId} />
      </div>
    </div>
  );
}
