import React, { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Avatar } from './Avatar';
import { StatusIndicator } from './StatusIndicator';
import { users, servers as serversApi, stats as statsApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { X, Globe, Shield, MessageSquare, ExternalLink } from 'lucide-react';

interface MemberProfileCardProps {
  memberId: string;
  serverId: string;
  onClose: () => void;
}

export function MemberProfileCard({ memberId, serverId, onClose }: MemberProfileCardProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [allRoles, setAllRoles] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      users.profile(memberId).catch(() => null),
      serversApi.memberRoles(serverId, memberId).catch(() => []),
      statsApi.get(memberId).catch(() => null),
      serversApi.roles(serverId).catch(() => []),
      serversApi.get(serverId).catch(() => null),
    ]).then(([p, r, s, allServerRoles, server]) => {
      setProfile(p);
      setRoles(r || []);
      setUserStats(s);
      setAllRoles(allServerRoles || []);
      setIsOwner(Boolean(server?.owner_id && server.owner_id === user?.id));
    }).finally(() => setLoading(false));
  }, [memberId, serverId, user?.id]);

  const refreshRoles = async () => {
    const updatedRoles = await serversApi.memberRoles(serverId, memberId).catch(() => []);
    setRoles(updatedRoles || []);
  };

  const handleAssignRole = async () => {
    if (!selectedRoleId) return;
    await serversApi.assignRole(serverId, memberId, selectedRoleId).catch(() => {});
    setSelectedRoleId('');
    refreshRoles();
  };

  const handleRemoveRole = async (roleId: string) => {
    await serversApi.removeRole(serverId, memberId, roleId).catch(() => {});
    refreshRoles();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
        <div className="glass p-6 rounded-xl w-80 text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
        <div className="glass p-6 rounded-xl w-80 text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-gray-400">User not found</p>
        </div>
      </div>
    );
  }

  const languages = (() => {
    try {
      const parsed = JSON.parse(profile.languages || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  })();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="glass rounded-xl w-80 overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Card Artwork / Banner */}
        <div className="relative h-28">
          {profile.card_artwork_url ? (
            <img src={profile.card_artwork_url} alt="" className="w-full h-full object-cover" />
          ) : profile.banner_url ? (
            <img src={profile.banner_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500" />
          )}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1 bg-black/40 rounded-full hover:bg-black/60 transition-all-custom"
          >
            <X size={14} className="text-white" />
          </button>
        </div>

        {/* Avatar */}
        <div className="px-4 -mt-10 relative z-10">
          <div className="ring-4 ring-[#1a1a2e] rounded-full inline-block">
            <Avatar url={profile.avatar_url} type={profile.avatar_type || 'image'} size={64} />
          </div>
        </div>

        {/* Info */}
        <div className="px-4 pt-2 pb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white truncate">
              {profile.display_name || profile.username}
            </h3>
            <StatusIndicator status={profile.status || 'offline'} statusMessage={profile.status_message} size={10} />
          </div>
          <p className="text-xs text-gray-400">@{profile.username}</p>

          {profile.bio && (
            <p className="text-xs text-gray-300 mt-2 line-clamp-2">{profile.bio}</p>
          )}

          {/* Roles */}
          {roles.length > 0 && (
            <div className="mt-3">
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
                <Shield size={10} /> Roles
              </h4>
              <div className="flex flex-wrap gap-1">
                {roles.map((role: any) => (
                  <button
                    key={role.id}
                    onClick={() => isOwner && handleRemoveRole(role.id)}
                    className="text-[10px] px-2 py-0.5 rounded-full border"
                    title={isOwner ? 'Remove role' : undefined}
                    style={{
                      borderColor: role.color || '#99AAB5',
                      color: role.color || '#99AAB5',
                      backgroundColor: (role.color || '#99AAB5') + '20',
                    }}
                  >
                    {role.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isOwner && (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase flex items-center gap-1 mb-2">
                <Shield size={10} /> Owner role controls
              </h4>
              <div className="flex gap-2">
                <select value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)} className="flex-1 text-xs">
                  <option value="">Choose role…</option>
                  {allRoles.filter((role: any) => !roles.some((ownedRole: any) => ownedRole.id === role.id)).map((role: any) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                <button onClick={handleAssignRole} className="btn btn-primary !px-3 !py-2 text-xs">Add</button>
              </div>
              <p className="text-[10px] text-gray-500 mt-2">As owner, you can click an existing role chip to remove it or use the selector to add one.</p>
            </div>
          )}

          {/* Languages */}
          {languages.length > 0 && (
            <div className="mt-3">
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
                <Globe size={10} /> Languages
              </h4>
              <div className="flex flex-wrap gap-1">
                {languages.map((lang: string) => (
                  <span key={lang} className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          {userStats && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <p className="text-xs font-bold text-white">{userStats.messages_sent || 0}</p>
                <p className="text-[10px] text-gray-500">Messages</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <p className="text-xs font-bold text-white">Lv.{profile.level || 1}</p>
                <p className="text-[10px] text-gray-500">Level</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <p className="text-xs font-bold text-white">{userStats.servers_joined || 0}</p>
                <p className="text-[10px] text-gray-500">Servers</p>
              </div>
            </div>
          )}

          {/* View Full Profile Button */}
          <button
            onClick={() => navigate({ to: '/app/profile/$userId', params: { userId: memberId } })}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-sm font-medium transition-all-custom"
          >
            <ExternalLink size={14} /> View Full Profile
          </button>
        </div>
      </div>
    </div>
  );
}
