import React from 'react';
import { Outlet, Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '../stores/authStore';
import { AnnouncementBanner } from '../components/AnnouncementBanner';
import { Avatar } from '../components/Avatar';
import {
  Home, MessageSquare, Users, Settings, LogOut, Search, Phone, Globe,
} from 'lucide-react';

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleLogout = () => {
    logout();
    navigate({ to: '/' });
  };

  const navItems = [
    { to: '/app/timeline', icon: <Home size={20} />, label: 'Timeline' },
    { to: '/app/dm', icon: <MessageSquare size={20} />, label: 'Messages' },
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
            <div className="border-t border-white/10 pt-3 px-2 mt-auto">
              <Link
                to="/app/profile/$userId"
                params={{ userId: user.id }}
                className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/10 transition-all-custom"
              >
                <Avatar url={user.avatar_url} type={user.avatar_type} size={32} />
                <div className="hidden lg:flex flex-col min-w-0">
                  <span className="text-sm font-medium text-white truncate">{user.display_name || user.username}</span>
                  <span className="text-xs text-gray-400 truncate">@{user.username}</span>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all-custom w-full mt-1"
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
