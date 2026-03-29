import React, { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { GlassPanel } from '../../components/GlassPanel';
import { Avatar } from '../../components/Avatar';
import { messages as messagesApi, users as usersApi } from '../../lib/api';
import type { DMContact } from '../../lib/types';
import { Search, MessageSquare } from 'lucide-react';

export function DMListPage() {
  const [contacts, setContacts] = useState<DMContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    messagesApi.dmList().then(setContacts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await usersApi.search(searchQuery);
      setSearchResults(results || []);
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Messages</h1>

      {/* Search users */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search users to message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-9"
          />
        </div>
        <button onClick={handleSearch} className="btn btn-glass">Search</button>
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <GlassPanel className="p-3 mb-6 animate-slide-up">
          <p className="text-xs text-gray-500 mb-2">Search Results</p>
          <div className="flex flex-col gap-1">
            {searchResults.map((u: any) => (
              <Link
                key={u.id}
                to="/app/dm/$userId"
                params={{ userId: u.id }}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-all-custom"
              >
                <Avatar url={u.avatar_url || ''} type={u.avatar_type || 'image'} size={32} />
                <div>
                  <p className="text-sm text-white font-medium">{u.display_name || u.username}</p>
                  <p className="text-xs text-gray-500">@{u.username}</p>
                </div>
              </Link>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* DM contacts list */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading...</div>
      ) : contacts.length === 0 ? (
        <GlassPanel className="p-8 text-center text-gray-400">
          <MessageSquare size={32} className="mx-auto mb-3 opacity-50" />
          <p>No conversations yet. Search for a user to start messaging!</p>
        </GlassPanel>
      ) : (
        <div className="flex flex-col gap-2">
          {contacts.map((contact) => (
            <Link
              key={contact.user_id}
              to="/app/dm/$userId"
              params={{ userId: contact.user_id }}
              className="block"
            >
              <GlassPanel className="p-3 hover:bg-white/5 transition-all-custom cursor-pointer">
                <div className="flex items-center gap-3">
                  <Avatar url={contact.avatar_url} type={contact.avatar_type} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {contact.display_name || contact.username}
                    </p>
                    {contact.last_message && (
                      <p className="text-xs text-gray-500 truncate">{contact.last_message}</p>
                    )}
                  </div>
                  {contact.last_message_at && (
                    <span className="text-xs text-gray-600 shrink-0">
                      {new Date(contact.last_message_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </GlassPanel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
