import { create } from 'zustand';
import type { WSMessage } from '../lib/types';

type WSHandler = (msg: WSMessage) => void;

interface WSState {
  ws: WebSocket | null;
  connected: boolean;
  handlers: Map<string, WSHandler[]>;
  connect: (token: string) => void;
  disconnect: () => void;
  send: (msg: WSMessage) => void;
  on: (type: string, handler: WSHandler) => () => void;
}

export const useWSStore = create<WSState>((set, get) => ({
  ws: null,
  connected: false,
  handlers: new Map(),

  connect: (token: string) => {
    const existing = get().ws;
    if (existing) existing.close();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws?token=${token}`);

    ws.onopen = () => set({ connected: true });
    ws.onclose = () => {
      set({ connected: false, ws: null });
      // Auto-reconnect after 3s
      setTimeout(() => {
        const t = localStorage.getItem('raider_token');
        if (t) get().connect(t);
      }, 3000);
    };
    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        const handlers = get().handlers.get(msg.type) || [];
        handlers.forEach((h) => h(msg));
      } catch { /* ignore parse errors */ }
    };

    set({ ws });
  },

  disconnect: () => {
    const ws = get().ws;
    if (ws) ws.close();
    set({ ws: null, connected: false });
  },

  send: (msg: WSMessage) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  },

  on: (type: string, handler: WSHandler) => {
    const handlers = get().handlers;
    const list = handlers.get(type) || [];
    list.push(handler);
    handlers.set(type, list);
    set({ handlers: new Map(handlers) });

    // Return unsubscribe function
    return () => {
      const current = get().handlers.get(type) || [];
      const filtered = current.filter((h) => h !== handler);
      get().handlers.set(type, filtered);
    };
  },
}));
