import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Bell, MessageSquare, UserPlus, Handshake, MessageCircle, AtSign, Phone, Users, CheckCheck, Trash2, X, BellOff } from 'lucide-react';
import { notifications as notifApi } from '../../lib/api';
import { useWSStore } from '../../stores/wsStore';
import type { Notification } from '../../lib/types';
import { GlassPanel } from '../../components/GlassPanel';

function notifIcon(type: string) {
  switch (type) {
    case 'dm':           return <MessageSquare size={16} className="text-blue-400" />;
    case 'follow':       return <UserPlus size={16} className="text-green-400" />;
    case 'handshake':    return <Handshake size={16} className="text-indigo-400" />;
    case 'comment':      return <MessageCircle size={16} className="text-orange-400" />;
    case 'reply':        return <MessageCircle size={16} className="text-yellow-400" />;
    case 'mention':      return <AtSign size={16} className="text-yellow-400" />;
    case 'call':         return <Phone size={16} className="text-red-400" />;
    case 'group_message':return <Users size={16} className="text-purple-400" />;
    default:             return <Bell size={16} className="text-gray-400" />;
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TABS = ['All', 'Unread', 'DMs', 'Social', 'Mentions'] as const;
type Tab = typeof TABS[number];

function filterNotifs(notifs: Notification[], tab: Tab): Notification[] {
  switch (tab) {
    case 'Unread':   return notifs.filter(n => !n.read);
    case 'DMs':      return notifs.filter(n => n.type === 'dm' || n.type === 'group_message');
    case 'Social':   return notifs.filter(n => ['follow', 'handshake'].includes(n.type));
    case 'Mentions': return notifs.filter(n => ['mention', 'comment', 'reply'].includes(n.type));
    default:         return notifs;
  }
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const { on } = useWSStore();
  const [notifs, setNotifs] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<Tab>('All');

  React.useEffect(() => {
    notifApi.list().then(data => {
      setNotifs(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Live push new notifications
  React.useEffect(() => {
    const unsub = on('new_notification', (msg) => {
      setNotifs(prev => [msg.payload as Notification, ...prev]);
    });
    return unsub;
  }, [on]);

  const handleMarkRead = async (id: string) => {
    await notifApi.markRead(id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleDelete = async (id: string) => {
    await notifApi.delete(id);
    setNotifs(prev => prev.filter(n => n.id !== id));
  };

  const handleMarkAllRead = async () => {
    await notifApi.markAllRead();
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClearAll = async () => {
    await notifApi.clearAll();
    setNotifs([]);
  };

  const handleClick = (n: Notification) => {
    if (!n.read) handleMarkRead(n.id);
    if (n.link) navigate({ to: n.link as any });
  };

  const visible = filterNotifs(notifs, tab);
  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell size={22} className="text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          {unreadCount > 0 && (
            <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="btn btn-glass text-xs flex items-center gap-1.5"
            >
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
          {notifs.length > 0 && (
            <button
              onClick={handleClearAll}
              className="btn btn-glass text-xs flex items-center gap-1.5 text-red-400 hover:text-red-300"
            >
              <Trash2 size={13} /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex bg-white/10 rounded-lg p-1 mb-5 gap-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all-custom ${
              tab === t ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t}
            {t === 'Unread' && unreadCount > 0 && (
              <span className="ml-1.5 bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading…</div>
      ) : visible.length === 0 ? (
        <GlassPanel className="p-10 text-center">
          <BellOff size={36} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No notifications</p>
          <p className="text-gray-600 text-sm mt-1">
            {tab === 'Unread' ? "You're all caught up!" : "Nothing here yet."}
          </p>
        </GlassPanel>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map(n => (
            <GlassPanel
              key={n.id}
              className={`p-3 cursor-pointer hover:bg-white/5 transition-all-custom group ${
                !n.read ? 'border-l-2 border-indigo-500' : ''
              }`}
              onClick={() => handleClick(n)}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                  {notifIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <p className={`text-sm font-medium truncate ${n.read ? 'text-gray-300' : 'text-white'}`}>
                      {n.title}
                    </p>
                    <span className="text-[11px] text-gray-600 shrink-0">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{n.body}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all-custom shrink-0">
                  {!n.read && (
                    <button
                      onClick={e => { e.stopPropagation(); handleMarkRead(n.id); }}
                      className="p-1 text-gray-500 hover:text-indigo-400 transition-all-custom"
                      title="Mark read"
                    >
                      <CheckCheck size={13} />
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(n.id); }}
                    className="p-1 text-gray-500 hover:text-red-400 transition-all-custom"
                    title="Delete"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            </GlassPanel>
          ))}
        </div>
      )}
    </div>
  );
}
