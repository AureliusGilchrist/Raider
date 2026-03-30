import React from 'react';
import { Outlet, Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '../stores/authStore';
import { AnnouncementBanner } from '../components/AnnouncementBanner';
import { Avatar } from '../components/Avatar';
import { Home, MessageSquare, Users, Settings, LogOut, Search, Phone, Globe, UserCircle } from 'lucide-react';
import { StatusIndicator } from '../components/StatusIndicator';
import { useIdleDetector } from '../hooks/useIdleDetector';
import { useWSStore } from '../stores/wsStore';

export function AppLayout() {
  const { user, logout, setUser } = useAuthStore();
  const { send, on } = useWSStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showStatusMenu, setShowStatusMenu] = React.useState(false);
  const previousStatusRef = React.useRef<string>(user?.status || 'online');

  // Idle detection - auto set to away after 10 min
  useIdleDetector({
    idleTimeMs: 10 * 60 * 1000,
    onIdle: () => {
      if (user?.status === 'online') {
        previousStatusRef.current = 'online';
        send({ type: 'set_status', payload: { status: 'away', status_message: user?.status_message || '' } });
      }
    },
    onActive: () => {
      if (user?.status === 'away') {
        send({ type: 'set_status', payload: { status: previousStatusRef.current, status_message: user?.status_message || '' } });
      }
    },
  });

  // Listen for status changes from other users
  React.useEffect(() => {
    const unsub = on('status_change', (msg) => {
      // Could update a global status store here for other users' statuses
    });
    return unsub;
  }, [on]);

  const handleStatusChange = (newStatus: string) => {
    if (!user) return;
    previousStatusRef.current = newStatus;
    send({ type: 'set_status', payload: { status: newStatus, status_message: user.status_message || '' } });
    // Optimistically update local user
    setUser({ ...user, status: newStatus });
    setShowStatusMenu(false);
  };

  const handleLogout = () => {
    logout();
    navigate({ to: '/' });
  };

  const navItems = [
    { to: '/app/timeline', icon: <Home size={20} />, label: 'Timeline' },
    { to: '/app/dm', icon: <MessageSquare size={20} />, label: 'Messages' },
    { to: '/app/groups', icon: <Users size={20} />, label: 'Groups' },
    { to: '/app/servers', icon: <Globe size={20} />, label: 'Servers' },
    { to: '/app/settings', icon: <Settings size={20} />, label: 'Settings' },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AnnouncementBanner />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-16 lg:w-56 glass flex flex-col items-center lg:items-stretch py-4 gap-1 border-r border-white/10 shrink-0">
          {/* Logo */}
          <Link to="/app/timeline" className="flex items-center gap-2 px-3 py-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <span className="text-white font-bold hidden lg:block">Raider</span>
          </Link>

          {/* Nav items */}
          <nav className="flex flex-col gap-1 flex-1 w-full px-2">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-all-custom"
                activeProps={{ className: 'bg-white/20 text-white' }}
              >
                {item.icon}
                <span className="hidden lg:block text-sm">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* User section */}
          {user && (
            <div className="w-full border-t border-white/10 pt-3 px-2 mt-auto">
              <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider px-2 mb-1 hidden lg:block">Me</div>
              <Link
                to="/app/profile/$userId"
                params={{ userId: user.id }}
                className="flex items-center gap-2 px-2 py-2.5 rounded-lg hover:bg-white/10 transition-all-custom relative w-full"
              >
                <div className="relative shrink-0">
                  <Avatar url={user.avatar_url} type={user.avatar_type} size={36} />
                  <div className="absolute -bottom-0.5 -right-0.5">
                    <button
                      onClick={(e) => { e.preventDefault(); setShowStatusMenu(!showStatusMenu); }}
                      className="hover:scale-110 transition-transform"
                    >
                      <StatusIndicator status={user.status} statusMessage={user.status_message} size={12} />
                    </button>
                  </div>
                </div>
                <div className="hidden lg:flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium text-white truncate">{user.display_name || user.username}</span>
                  <span className="text-xs text-gray-400 truncate">@{user.username}</span>
                </div>
              </Link>
              {showStatusMenu && (
                <div className="absolute bottom-full left-2 right-2 mb-2 glass rounded-lg p-2 z-50 animate-fade-in">
                  {[['online', 'Online'], ['away', 'Away'], ['busy', 'Busy'], ['streaming', 'Streaming'], ['invisible', 'Invisible']].map(([status, label]) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-white/10 transition-all-custom ${user.status === status ? 'bg-white/10' : ''}`}
                    >
                      <StatusIndicator status={status} size={8} />
                      <span className="text-gray-200">{label}</span>
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all-custom w-full mt-1"
              >
                <LogOut size={18} />
                <span className="hidden lg:block text-sm">Logout</span>
              </button>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
