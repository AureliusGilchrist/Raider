import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useWSStore } from '../stores/wsStore';

interface TypingIndicatorProps {
  /** For DMs: the other user's ID. For channels: omit this. */
  recipientId?: string;
  /** For channels: the channel ID. For DMs: omit this. */
  channelId?: string;
}

interface Typer {
  username: string;
  expiresAt: number;
}

export function TypingIndicator({ recipientId, channelId }: TypingIndicatorProps) {
  const { on } = useWSStore();
  const [typers, setTypers] = useState<Map<string, Typer>>(new Map());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up expired typers every 500ms
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTypers((prev) => {
        const now = Date.now();
        const next = new Map(prev);
        let changed = false;
        for (const [id, t] of next) {
          if (t.expiresAt < now) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Listen for typing events
  useEffect(() => {
    const unsub = on('typing', (msg) => {
      const p = msg.payload;
      if (!p) return;

      // Filter: only show typing for this conversation
      if (recipientId && p.context === 'dm' && p.user_id === recipientId) {
        setTypers((prev) => {
          const next = new Map(prev);
          next.set(p.user_id, { username: p.username || 'Someone', expiresAt: Date.now() + 3000 });
          return next;
        });
      } else if (channelId && p.context === 'channel' && p.channel_id === channelId) {
        setTypers((prev) => {
          const next = new Map(prev);
          next.set(p.user_id, { username: p.username || 'Someone', expiresAt: Date.now() + 3000 });
          return next;
        });
      }
    });
    return unsub;
  }, [recipientId, channelId]);

  const names = Array.from(typers.values()).map((t) => t.username);
  if (names.length === 0) return null;

  let text: string;
  if (names.length === 1) {
    text = `${names[0]} is typing`;
  } else if (names.length === 2) {
    text = `${names[0]} and ${names[1]} are typing`;
  } else {
    text = `${names[0]} and ${names.length - 1} others are typing`;
  }

  return (
    <div className="px-4 py-1.5 text-xs text-indigo-300 flex items-center gap-2 animate-fade-in">
      <span className="flex gap-0.5">
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </span>
      <span>{text}</span>
    </div>
  );
}

/**
 * Hook to emit typing events with debounce.
 * Call `emitTyping()` on each keystroke — it auto-throttles to one event per 2s.
 */
export function useTypingEmitter(opts: { recipientId?: string; channelId?: string }) {
  const { send } = useWSStore();
  const lastSent = useRef(0);

  const emitTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSent.current < 2000) return;
    lastSent.current = now;

    send({
      type: 'typing',
      payload: {
        recipient_id: opts.recipientId || '',
        channel_id: opts.channelId || '',
      },
    });
  }, [opts.recipientId, opts.channelId, send]);

  return emitTyping;
}
