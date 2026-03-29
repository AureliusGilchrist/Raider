import React, { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { GlassPanel } from '../../components/GlassPanel';
import { servers as serversApi } from '../../lib/api';
import type { Server } from '../../lib/types';
import { Plus, Globe, Users, Search } from 'lucide-react';

export function ServersPage() {
  const [myServers, setMyServers] = useState<Server[]>([]);
  const [discover, setDiscover] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mine' | 'discover'>('mine');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    Promise.all([
      serversApi.list().catch(() => []),
      serversApi.discover().catch(() => []),
    ]).then(([mine, disc]) => {
      setMyServers(mine || []);
      setDiscover(disc || []);
    }).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const server = await serversApi.create({ name, description });
      setMyServers((prev) => [server, ...prev]);
      setName('');
      setDescription('');
      setShowCreate(false);
    } catch {}
  };

  const handleJoin = async (id: string) => {
    try {
      await serversApi.join(id);
      setDiscover((prev) => prev.filter((s) => s.id !== id));
      const updated = await serversApi.list().catch(() => []);
      setMyServers(updated || []);
    } catch {}
  };

  const list = tab === 'mine' ? myServers : discover;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Servers</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="btn btn-primary">
          <Plus size={16} /> Create
        </button>
      </div>

      {showCreate && (
        <GlassPanel className="p-4 mb-6 animate-slide-up">
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <input type="text" placeholder="Server name" value={name} onChange={(e) => setName(e.target.value)} required />
            <textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            <button type="submit" className="btn btn-primary self-end">Create Server</button>
          </form>
        </GlassPanel>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('mine')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all-custom ${tab === 'mine' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <Globe size={14} className="inline mr-1.5" /> My Servers
        </button>
        <button
          onClick={() => setTab('discover')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all-custom ${tab === 'discover' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <Search size={14} className="inline mr-1.5" /> Discover
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading...</div>
      ) : list.length === 0 ? (
        <GlassPanel className="p-8 text-center text-gray-400">
          {tab === 'mine' ? 'No servers yet. Create one or discover existing ones!' : 'No servers to discover right now.'}
        </GlassPanel>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((server) => (
            <GlassPanel key={server.id} className="p-4 animate-fade-in">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/50 to-purple-600/50 flex items-center justify-center text-xl font-bold text-white shrink-0">
                  {server.icon_url ? (
                    <img src={server.icon_url} alt="" className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    server.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold truncate">{server.name}</h3>
                  {server.description && <p className="text-gray-400 text-sm truncate">{server.description}</p>}
                  <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Users size={12} /> {server.member_count} members
                  </span>
                </div>
                {tab === 'mine' ? (
                  <Link to="/app/server/$serverId" params={{ serverId: server.id }} className="btn btn-glass text-sm">
                    Open
                  </Link>
                ) : (
                  <button onClick={() => handleJoin(server.id)} className="btn btn-primary text-sm">
                    Join
                  </button>
                )}
              </div>
            </GlassPanel>
          ))}
        </div>
      )}
    </div>
  );
}
