import React, { useEffect, useState, useRef } from 'react';
import { useParams } from '@tanstack/react-router';
import { GlassPanel } from '../../components/GlassPanel';
import { Avatar } from '../../components/Avatar';
import { Banner } from '../../components/Banner';
import { XPBar } from '../../components/XPBar';
import { StatCard } from '../../components/StatCard';
import { useAuthStore } from '../../stores/authStore';
import { users, stats as statsApi, handshakes, uploads, posts as postsApi } from '../../lib/api';
import type { User, UserStats, Post } from '../../lib/types';
import {
  UserPlus, UserMinus, MessageSquare, Handshake, Camera, ImagePlus,
  ArrowUp, ArrowDown, MessageCircle,
} from 'lucide-react';

export function ProfilePage() {
  const { userId } = useParams({ strict: false }) as { userId: string };
  const { user: me } = useAuthStore();
  const isOwnProfile = me?.id === userId;

  const [profile, setProfile] = useState<(User & { is_following: boolean }) | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [serverActivity, setServerActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasHandshake, setHasHandshake] = useState(false);

  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      users.profile(userId),
      statsApi.get(userId),
      statsApi.badges(userId),
      postsApi.timeline(),
      handshakes.check(userId).catch(() => ({ has_handshake: false })),
      statsApi.serverActivity(userId).catch(() => []),
    ]).then(([p, s, b, posts, hs, sa]) => {
      setProfile(p);
      setUserStats(s);
      setUserBadges(b || []);
      setUserPosts((posts || []).filter((post: Post) => post.author_id === userId));
      setHasHandshake(hs?.has_handshake || false);
      setServerActivity(sa || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  const handleFollow = async () => {
    if (!profile) return;
    if (profile.is_following) {
      await users.unfollow(userId);
      setProfile({ ...profile, is_following: false });
    } else {
      await users.follow(userId);
      setProfile({ ...profile, is_following: true });
    }
  };

  const handleHandshake = async () => {
    try {
      await handshakes.initiate(userId);
      setHasHandshake(true);
    } catch {}
  };

  const handleFileUpload = async (file: File, target: 'avatar' | 'banner') => {
    try {
      const res = await uploads.upload(file);
      const isVideo = file.type.startsWith('video/') || file.name.endsWith('.mkv');
      const type = isVideo ? 'video' : 'image';
      if (target === 'avatar') {
        await uploads.setAvatar(res.url, type);
      } else {
        await uploads.setBanner(res.url, type);
      }
      // Refresh profile
      const p = await users.profile(userId);
      setProfile(p);
    } catch {}
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="flex items-center justify-center h-full text-gray-400">User not found</div>;
  }

  return (
    <div className="animate-fade-in h-full overflow-y-auto">
      {/* Hidden file inputs */}
      <input
        ref={avatarInput}
        type="file"
        accept="image/*,video/mp4,video/webm,video/x-matroska,video/quicktime,.mkv,.mov,.gif"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'avatar')}
      />
      <input
        ref={bannerInput}
        type="file"
        accept="image/*,video/mp4,video/webm,video/x-matroska,video/quicktime,.mkv,.mov,.gif"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'banner')}
      />

      {/* Full-width Banner */}
      <Banner
        url={profile.banner_url}
        type={profile.banner_type}
        editable={isOwnProfile}
        onUpload={() => bannerInput.current?.click()}
        height="h-64"
      />

      {/* Profile content area */}
      <div className="relative">
        {/* Avatar row — overlaps banner */}
        <div className="px-6 -mt-16 flex items-end justify-between">
          <div className="relative group">
            <div className="ring-4 ring-[#0a0a1e] rounded-full">
              <Avatar url={profile.avatar_url} type={profile.avatar_type} size={120} />
            </div>
            {isOwnProfile && (
              <button
                onClick={() => avatarInput.current?.click()}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all-custom"
              >
                <Camera size={28} className="text-white" />
              </button>
            )}
          </div>

          {/* Action buttons aligned right */}
          {!isOwnProfile && (
            <div className="flex gap-2 mb-2">
              <button onClick={handleFollow} className={`btn ${profile.is_following ? 'btn-glass' : 'btn-primary'}`}>
                {profile.is_following ? <UserMinus size={16} /> : <UserPlus size={16} />}
                <span className="hidden sm:inline">{profile.is_following ? 'Unfollow' : 'Follow'}</span>
              </button>
              {!hasHandshake && (
                <button onClick={handleHandshake} className="btn btn-glass">
                  <Handshake size={16} />
                  <span className="hidden sm:inline">Handshake</span>
                </button>
              )}
              <button className="btn btn-glass">
                <MessageSquare size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Name / info — below avatar */}
        <div className="px-6 mt-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white truncate">
              {profile.display_name || profile.username}
            </h1>
            {profile.level > 0 && (
              <span className="bg-purple-500/30 text-purple-300 text-xs px-2 py-0.5 rounded-full font-semibold">
                Lv. {profile.level}
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm">@{profile.username}</p>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {profile.pronouns && (
              <span className="text-xs text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full">
                {profile.pronouns}
              </span>
            )}
            {profile.gender && (
              <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-gray-300">
                {profile.gender === 'Custom' ? profile.gender_custom : profile.gender}
              </span>
            )}
            {profile.languages && profile.languages !== '[]' && (
              <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-gray-300">
                {JSON.parse(profile.languages).join(', ')}
              </span>
            )}
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-gray-300 mt-3 text-sm leading-relaxed max-w-2xl">{profile.bio}</p>
          )}

          {/* XP Bar */}
          {profile.level > 0 && (
            <div className="mt-4 max-w-md">
              <XPBar xp={profile.xp} level={profile.level} />
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 mt-6" />

        {/* Stats + Badges + Posts in two-column layout */}
        <div className="px-6 py-6 flex gap-6 flex-col lg:flex-row">
          {/* Left column: Stats + Badges */}
          <div className="lg:w-80 shrink-0 flex flex-col gap-4">
            {/* Stats */}
            {userStats && (
              <GlassPanel className="p-4">
                <h2 className="text-sm font-semibold text-gray-400 mb-3">Stats</h2>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard icon="💬" label="Messages" value={userStats.messages_sent} />
                  <StatCard icon="📝" label="Posts" value={userStats.posts_created} />
                  <StatCard icon="⬆️" label="Upvotes" value={userStats.upvotes_received} />
                  <StatCard icon="🤝" label="Handshakes" value={userStats.handshakes_made} />
                  <StatCard icon="📞" label="Calls" value={userStats.calls_joined} />
                  <StatCard icon="🏠" label="Servers" value={userStats.servers_joined} />
                  <StatCard icon="👥" label="Followers" value={userStats.followers_count} />
                  <StatCard icon="🔥" label="Streak" value={`${userStats.current_streak}d`} />
                </div>
              </GlassPanel>
            )}

            {/* Badges */}
            {userBadges.length > 0 && (
              <GlassPanel className="p-4">
                <h2 className="text-sm font-semibold text-gray-400 mb-3">Badges</h2>
                <div className="flex flex-wrap gap-2">
                  {userBadges.map((b: any) => (
                    <div
                      key={b.badge_id}
                      className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 transition-all-custom hover:bg-white/10"
                      title={b.description}
                    >
                      <span className="text-lg">{b.icon}</span>
                      <div>
                        <p className="text-xs font-medium text-white">{b.name}</p>
                        <p className="text-[10px] text-gray-500">{b.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            )}

            {/* Server Activity */}
            {serverActivity.length > 0 && (
              <GlassPanel className="p-4">
                <h2 className="text-sm font-semibold text-gray-400 mb-3">Server Activity</h2>
                <div className="flex flex-col gap-2">
                  {serverActivity.map((sa: any) => (
                    <div key={sa.server_id} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/30 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {sa.server_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{sa.server_name}</p>
                        <p className="text-[10px] text-gray-500">{sa.message_count} messages</p>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            )}
          </div>

          {/* Right column: Posts */}
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Recent Posts</h2>
            {userPosts.length === 0 ? (
              <GlassPanel className="p-6 text-center text-gray-500 text-sm">
                No posts yet
              </GlassPanel>
            ) : (
              <div className="flex flex-col gap-3">
                {userPosts.map((post) => (
                  <GlassPanel key={post.id} className="p-4">
                    <h3 className="text-white font-semibold mb-1">{post.title}</h3>
                    <p className="text-gray-300 text-sm">{post.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <ArrowUp size={12} /> {post.upvotes - post.downvotes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={12} /> {post.comment_count}
                      </span>
                      <span>{new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                  </GlassPanel>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
