import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from '@tanstack/react-router';
import { GlassPanel } from '../../components/GlassPanel';
import { Avatar } from '../../components/Avatar';
import { Banner } from '../../components/Banner';
import { ImageCropper } from '../../components/ImageCropper';
import { XPBar } from '../../components/XPBar';
import { StatCard } from '../../components/StatCard';
import { FormattedText } from '../../components/FormattedText';
import { useAuthStore } from '../../stores/authStore';
import { useWSStore } from '../../stores/wsStore';
import { users, stats as statsApi, handshakes, uploads, posts as postsApi } from '../../lib/api';
import type { User, UserStats, Post, Comment } from '../../lib/types';
import {
  UserPlus, UserMinus, MessageSquare, Handshake, Camera, ImagePlus,
  ArrowUp, ArrowDown, MessageCircle, CalendarDays, Send, X, Pencil, Trash2, Check,
} from 'lucide-react';
import { raiderConfirm } from '../../components/CustomPopup';

// ── Activity Heatmap Popup ──────────────────────────────────────────────────
function ActivityHeatmapPopup({
  data,
  joined,
  onClose,
}: {
  data: { date: string; count: number }[];
  joined: Date;
  onClose: () => void;
}) {
  const activityMap = new Map(data.map(d => [d.date, d.count]));

  // Build a 52-week grid ending today, aligned to Sunday columns
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 52 * 7);
  start.setDate(start.getDate() - start.getDay()); // rewind to Sunday

  const weeks: Array<Array<Date | null>> = [];
  const cur = new Date(start);
  while (cur <= today) {
    const week: Array<Date | null> = [];
    for (let d = 0; d < 7; d++) {
      week.push(cur <= today ? new Date(cur) : null);
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  // Month labels
  const monthLabels: { label: string; wi: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const first = week.find(Boolean);
    if (first) {
      const m = first.getMonth();
      if (m !== lastMonth) {
        monthLabels.push({ label: first.toLocaleString('default', { month: 'short' }), wi });
        lastMonth = m;
      }
    }
  });

  const CELL = 11;
  const GAP = 2;
  const STEP = CELL + GAP;
  const DAY_LABELS = ['', 'M', '', 'W', '', 'F', ''];

  const cellColor = (day: Date | null) => {
    if (!day) return 'transparent';
    const iso = day.toISOString().split('T')[0];
    if (day < joined) return 'rgba(255,255,255,0.04)';
    const count = activityMap.get(iso) || 0;
    if (!count) return 'rgba(255,255,255,0.08)';
    if (count <= 2) return 'rgba(99,102,241,0.40)';
    if (count <= 5) return 'rgba(99,102,241,0.65)';
    return 'rgba(99,102,241,0.95)';
  };

  const totalW = weeks.length * STEP + 28; // 28 = day-label column

  return (
    <div
      id="activity-heatmap-popup"
      className="glass rounded-xl shadow-2xl border border-white/10 overflow-hidden"
      style={{ width: Math.min(totalW + 32, window.innerWidth - 24) }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-300">Activity — last 52 weeks</span>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xs px-1 leading-none">✕</button>
        </div>

        {/* Month labels */}
        <div className="relative h-4 mb-1" style={{ paddingLeft: 28 }}>
          {monthLabels.map(({ label, wi }) => (
            <span
              key={`${label}-${wi}`}
              className="absolute text-[10px] text-gray-500"
              style={{ left: 28 + wi * STEP }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div className="flex" style={{ overflowX: 'auto' }}>
          {/* Day-of-week labels */}
          <div className="flex flex-col shrink-0" style={{ gap: GAP, marginRight: GAP, width: 16 }}>
            {DAY_LABELS.map((lbl, i) => (
              <div key={i} style={{ height: CELL, lineHeight: `${CELL}px` }} className="text-[9px] text-gray-600 text-right">
                {lbl}
              </div>
            ))}
          </div>
          {/* Week columns */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col shrink-0" style={{ gap: GAP, marginRight: GAP }}>
              {week.map((day, di) => {
                const iso = day ? day.toISOString().split('T')[0] : '';
                const count = iso ? (activityMap.get(iso) || 0) : 0;
                return (
                  <div
                    key={di}
                    title={day ? `${day.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}: ${count} activit${count === 1 ? 'y' : 'ies'}` : ''}
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 2,
                      background: cellColor(day),
                      flexShrink: 0,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-1 mt-2">
          <span className="text-[10px] text-gray-500">Less</span>
          {[0, 0.4, 0.65, 0.95].map((op, i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: op === 0 ? 'rgba(255,255,255,0.08)' : `rgba(99,102,241,${op})`,
              }}
            />
          ))}
          <span className="text-[10px] text-gray-500">More</span>
        </div>
      </div>
    </div>
  );
}
// ───────────────────────────────────────────────────────────────────────────

// ── Thread node colours by depth ──────────────────────────────────
const DEPTH_COLORS = [
  'border-indigo-500/60',
  'border-purple-500/60',
  'border-cyan-500/60',
  'border-emerald-500/60',
  'border-rose-500/60',
];

interface CommentNode extends Comment {
  children: CommentNode[];
}

function buildTree(flat: Comment[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  flat.forEach(c => map.set(c.id, { ...c, children: [] }));
  const roots: CommentNode[] = [];
  flat.forEach(c => {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

// ── Reddit-style comment thread ──────────────────────────────────────────
function ProfileCommentThread({
  node, postId, depth, meId, onAdd, onVote, onEdit, onDelete,
}: {
  node: CommentNode; postId: string; depth: number; meId: string;
  onAdd: (c: Comment) => void;
  onVote: (commentId: string, upvotes: number, downvotes: number, userVote: number) => void;
  onEdit: (commentId: string, content: string, editedAt: string) => void;
  onDelete: (commentId: string) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [voting, setVoting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(node.content);
  const borderColor = DEPTH_COLORS[depth % DEPTH_COLORS.length];

  const handleReply = async () => {
    const text = replyText.trim();
    if (!text) return;
    try {
      const c = await postsApi.createComment(postId, { content: text, parent_id: node.id });
      onAdd(c);
      setReplyText('');
      setReplying(false);
    } catch {}
  };

  const handleVote = async (value: number) => {
    if (voting) return;
    const next = node.user_vote === value ? 0 : value;
    setVoting(true);
    try {
      const res = await postsApi.voteComment(postId, node.id, next);
      onVote(node.id, res.upvotes, res.downvotes, res.user_vote);
    } catch {} finally { setVoting(false); }
  };

  const handleEdit = async () => {
    const text = editText.trim();
    if (!text || text === node.content) { setEditing(false); return; }
    try {
      const res = await postsApi.editComment(postId, node.id, text);
      onEdit(node.id, res.content ?? text, res.edited_at ?? new Date().toISOString());
      setEditing(false);
    } catch {}
  };

  const handleDelete = async () => {
    if (!(await raiderConfirm('Delete this comment?'))) return;
    try {
      await postsApi.deleteComment(postId, node.id);
      onDelete(node.id);
    } catch {}
  };

  const score = node.upvotes - node.downvotes;

  return (
    <div className={`flex gap-0 ${depth > 0 ? 'mt-2' : 'mt-3'}`}>
      {depth > 0 && (
        <button
          onClick={() => setCollapsed(v => !v)}
          className="shrink-0 w-4 mr-2 flex justify-center cursor-pointer group"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <div className={`w-0.5 h-full rounded-full ${borderColor} group-hover:opacity-100 opacity-50 transition-opacity`} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-indigo-300 truncate">{node.author_name ?? 'Unknown'}</span>
          <span className="text-[10px] text-gray-600 shrink-0">
            {new Date(node.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>
        {!collapsed && (
          <>
            {editing ? (
              <div className="flex gap-1.5 mb-2">
                <input autoFocus type="text" value={editText} onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') setEditing(false); }}
                  className="flex-1 text-xs !py-1 !px-2" />
                <button onClick={handleEdit} className="btn btn-primary !py-1 !px-2 text-xs"><Check size={11} /></button>
                <button onClick={() => setEditing(false)} className="btn btn-glass !py-1 !px-2 text-xs"><X size={11} /></button>
              </div>
            ) : (
              <p className="text-xs text-gray-300 leading-relaxed mb-1.5">
                <FormattedText text={node.content} />
                {node.edited_at && <span className="text-[10px] text-gray-600 ml-1">(edited)</span>}
              </p>
            )}
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center gap-1">
                <button onClick={() => handleVote(1)} disabled={voting}
                  className={`p-0.5 rounded transition-colors ${node.user_vote === 1 ? 'text-orange-400' : 'text-gray-500 hover:text-orange-400'}`}>
                  <ArrowUp size={12} />
                </button>
                <span className={`text-[11px] font-medium min-w-[14px] text-center ${score > 0 ? 'text-orange-400' : score < 0 ? 'text-blue-400' : 'text-gray-500'}`}>{score}</span>
                <button onClick={() => handleVote(-1)} disabled={voting}
                  className={`p-0.5 rounded transition-colors ${node.user_vote === -1 ? 'text-blue-400' : 'text-gray-500 hover:text-blue-400'}`}>
                  <ArrowDown size={12} />
                </button>
              </div>
              <button onClick={() => setReplying(v => !v)} className="text-[11px] text-gray-500 hover:text-indigo-400 transition-colors font-medium">Reply</button>
              {meId === node.author_id && !editing && (
                <>
                  <button onClick={() => { setEditText(node.content); setEditing(true); }} className="text-[11px] text-gray-600 hover:text-indigo-400 transition-colors" title="Edit"><Pencil size={11} /></button>
                  <button onClick={handleDelete} className="text-[11px] text-gray-600 hover:text-red-400 transition-colors" title="Delete"><Trash2 size={11} /></button>
                </>
              )}
              {node.children.length > 0 && (
                <button onClick={() => setCollapsed(v => !v)} className="text-[11px] text-gray-600 hover:text-gray-300 transition-colors">
                  {collapsed ? `▶ ${node.children.length} replies` : '▼ hide'}
                </button>
              )}
            </div>
            {replying && (
              <div className="flex gap-1.5 mb-2">
                <input autoFocus type="text" placeholder={`Reply to ${node.author_name ?? 'comment'}…`}
                  value={replyText} onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReply()} className="flex-1 text-xs !py-1 !px-2" />
                <button onClick={handleReply} className="btn btn-primary !py-1 !px-2 text-xs"><Send size={11} /></button>
                <button onClick={() => setReplying(false)} className="btn btn-glass !py-1 !px-2 text-xs"><X size={11} /></button>
              </div>
            )}
            {node.children.map(child => (
              <ProfileCommentThread key={child.id} node={child} postId={postId} depth={depth + 1} meId={meId}
                onAdd={onAdd} onVote={onVote} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </>
        )}
        {collapsed && node.children.length > 0 && (
          <button onClick={() => setCollapsed(false)} className="text-[11px] text-gray-600 hover:text-gray-300 transition-colors">
            ▶ {node.children.length} {node.children.length === 1 ? 'reply' : 'replies'} hidden
          </button>
        )}
      </div>
    </div>
  );
}

// ── Profile Post Card with reddit-like threaded comments ────────────────
function ProfilePostCard({ post, meId }: { post: Post; meId: string }) {
  const { on } = useWSStore();
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');

  const toggleComments = async () => {
    if (!expanded && comments.length === 0) {
      setLoadingComments(true);
      try {
        const data = await postsApi.comments(post.id);
        setComments(data || []);
      } catch {}
      setLoadingComments(false);
    }
    setExpanded(!expanded);
  };

  // Real-time WS updates
  useEffect(() => {
    if (!expanded) return;
    const unsubNew = on('post_comment', (msg) => {
      const { post_id, comment } = msg.payload;
      if (post_id !== post.id || !comment) return;
      setComments(prev => prev.some(c => c.id === comment.id) ? prev : [...prev, comment]);
    });
    const unsubEdited = on('comment_edited', (msg) => {
      const { post_id, comment } = msg.payload;
      if (post_id !== post.id) return;
      setComments(prev => prev.map(c => c.id === comment.id ? { ...c, content: comment.content, edited_at: comment.edited_at } : c));
    });
    const unsubDeleted = on('comment_deleted', (msg) => {
      const { post_id, comment_id } = msg.payload;
      if (post_id !== post.id) return;
      setComments(prev => prev.filter(c => c.id !== comment_id));
    });
    return () => { unsubNew(); unsubEdited(); unsubDeleted(); };
  }, [on, post.id, expanded]);

  const handleAdd = (c: Comment) => setComments(prev => [...prev, c]);
  const handleVote = (commentId: string, upvotes: number, downvotes: number, userVote: number) =>
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, upvotes, downvotes, user_vote: userVote } : c));
  const handleEdit = (commentId: string, content: string, editedAt: string) =>
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, content, edited_at: editedAt } : c));
  const handleDelete = (commentId: string) =>
    setComments(prev => prev.filter(c => c.id !== commentId));

  const handleTopLevel = async () => {
    const text = newComment.trim();
    if (!text) return;
    try {
      const c = await postsApi.createComment(post.id, { content: text });
      setComments(prev => [...prev, c]);
      setNewComment('');
    } catch {}
  };

  const tree = buildTree(comments);

  return (
    <GlassPanel className="p-4">
      <h3 className="text-white font-semibold mb-1">{post.title}</h3>
      <p className="text-gray-300 text-sm"><FormattedText text={post.content} /></p>
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <ArrowUp size={12} /> {post.upvotes - post.downvotes}
        </span>
        <button onClick={toggleComments} className="flex items-center gap-1 hover:text-gray-300 transition-colors">
          <MessageCircle size={12} /> {post.comment_count}
        </button>
        <span>{new Date(post.created_at).toLocaleDateString()}</span>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/10">
          {loadingComments ? (
            <p className="text-xs text-gray-500">Loading comments…</p>
          ) : tree.length === 0 ? (
            <p className="text-xs text-gray-500 mb-2">No comments yet. Be the first!</p>
          ) : (
            <div className="flex flex-col mb-3 max-h-[480px] overflow-y-auto pr-1">
              {tree.map(node => (
                <ProfileCommentThread key={node.id} node={node} postId={post.id} depth={0} meId={meId}
                  onAdd={handleAdd} onVote={handleVote} onEdit={handleEdit} onDelete={handleDelete} />
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <input type="text" placeholder="Write a comment…" value={newComment}
              onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleTopLevel()}
              className="flex-1 text-xs !py-1.5 !px-2.5" />
            <button onClick={handleTopLevel} className="btn btn-primary !py-1.5 !px-2.5 text-xs"><Send size={12} /></button>
          </div>
        </div>
      )}
    </GlassPanel>
  );
}
// ───────────────────────────────────────────────────────────────────────────

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
  const [cropFile, setCropFile] = useState<{ file: File; target: 'avatar' | 'banner' } | null>(null);

  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const heatmapBtnRef = useRef<HTMLButtonElement>(null);

  const [activityOpen, setActivityOpen] = useState(false);
  const [activityData, setActivityData] = useState<{ date: string; count: number }[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);

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

  const openHeatmap = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (activityOpen) {
      setActivityOpen(false);
      setPopupPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const estimatedW = Math.min(window.innerWidth * 0.9, 760);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - estimatedW - 8));
    const top = rect.bottom + 8;
    setPopupPos({ top, left });
    if (!activityLoaded) {
      try {
        const data = await users.activity(userId);
        setActivityData(data || []);
        setActivityLoaded(true);
      } catch {}
    }
    setActivityOpen(true);
  }, [activityOpen, activityLoaded, userId]);

  useEffect(() => {
    if (!activityOpen) return;
    const handler = (ev: MouseEvent) => {
      const popup = document.getElementById('activity-heatmap-popup');
      if (
        popup && !popup.contains(ev.target as Node) &&
        !heatmapBtnRef.current?.contains(ev.target as Node)
      ) {
        setActivityOpen(false);
        setPopupPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activityOpen]);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="flex items-center justify-center h-full text-gray-400">User not found</div>;
  }

  return (
    <div className="animate-fade-in h-full overflow-y-auto">
      {/* Hidden file inputs */}      <input
        ref={avatarInput}
        type="file"
        accept="image/*,video/mp4,video/webm,video/x-matroska,video/quicktime,.mkv,.mov,.gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            if (f.type.startsWith('video/') || f.name.endsWith('.gif')) {
              handleFileUpload(f, 'avatar');
            } else {
              setCropFile({ file: f, target: 'avatar' });
            }
          }
          e.target.value = '';
        }}
      />
      <input
        ref={bannerInput}
        type="file"
        accept="image/*,video/mp4,video/webm,video/x-matroska,video/quicktime,.mkv,.mov,.gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            if (f.type.startsWith('video/') || f.name.endsWith('.gif')) {
              handleFileUpload(f, 'banner');
            } else {
              setCropFile({ file: f, target: 'banner' });
            }
          }
          e.target.value = '';
        }}
      />

      {/* Image Cropper Modal */}
      {cropFile && (
        <ImageCropper
          file={cropFile.file}
          aspectRatio={cropFile.target === 'avatar' ? 1 : 3}
          onCrop={(croppedFile) => {
            handleFileUpload(croppedFile, cropFile.target);
            setCropFile(null);
          }}
          onCancel={() => setCropFile(null)}
        />
      )}

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
        <div className="px-6 -mt-16 flex items-end justify-between relative z-10">
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
                {profile.gender}
              </span>
            )}
            {profile.sexuality && (
              <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-gray-300">
                {profile.sexuality}
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

          {/* Joined date */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
            <CalendarDays size={12} />
            <span>Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            <button
              ref={heatmapBtnRef}
              onClick={openHeatmap}
              className="ml-1 p-0.5 rounded hover:bg-white/10 transition-colors"
              title="View activity heatmap"
            >
              <CalendarDays size={13} className="text-indigo-400 hover:text-indigo-300" />
            </button>
          </div>

          {/* XP Bar */}
          {profile.level > 0 && (
            <div className="mt-4 max-w-md">
              <XPBar xp={profile.xp} level={profile.level} />
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 mt-6" />

        {/* Three-column fullscreen layout: Stats | Posts | Badges */}
        <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] xl:grid-cols-[320px_1fr_320px] gap-6">
          {/* Left column: Stats + Server Activity */}
          <div className="flex flex-col gap-4">
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

          {/* Center column: Posts with reddit-like comments */}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Recent Posts</h2>
            {userPosts.length === 0 ? (
              <GlassPanel className="p-6 text-center text-gray-500 text-sm">
                No posts yet
              </GlassPanel>
            ) : (
              <div className="flex flex-col gap-3">
                {userPosts.map((post) => (
                  <ProfilePostCard key={post.id} post={post} meId={me?.id ?? ''} />
                ))}
              </div>
            )}
          </div>

          {/* Right column: Badges */}
          <div className="flex flex-col gap-4">
            {userBadges.length > 0 && (
              <GlassPanel className="p-4">
                <h2 className="text-sm font-semibold text-gray-400 mb-3">Badges</h2>
                <div className="flex flex-col gap-2">
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

            {/* No badges placeholder */}
            {userBadges.length === 0 && (
              <GlassPanel className="p-4 text-center">
                <h2 className="text-sm font-semibold text-gray-400 mb-2">Badges</h2>
                <p className="text-xs text-gray-500">No badges earned yet</p>
              </GlassPanel>
            )}
          </div>
        </div>
      </div>

      {/* Activity heatmap floating popup */}
      {activityOpen && popupPos && (
        <div
          style={{ position: 'fixed', top: popupPos.top, left: popupPos.left, zIndex: 9999 }}
        >
          <ActivityHeatmapPopup
            data={activityData}
            joined={new Date(profile.created_at)}
            onClose={() => { setActivityOpen(false); setPopupPos(null); }}
          />
        </div>
      )}
    </div>
  );
}
