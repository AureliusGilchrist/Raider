import React, { useEffect, useState, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { GlassPanel } from '../../components/GlassPanel';
import { Avatar } from '../../components/Avatar';
import { useAuthStore } from '../../stores/authStore';
import { posts as postsApi, shares as sharesApi, uploads as uploadsApi } from '../../lib/api';
import type { Post, Share, Comment } from '../../lib/types';
import { ArrowUp, ArrowDown, MessageCircle, Plus, Send, Share2, X, Repeat2, Pencil, Trash2, Check, HelpCircle, Image as ImageIcon } from 'lucide-react';
import { FormattedText } from '../../components/FormattedText';
import { FormatHelper } from '../../components/FormatHelper';
import { useWSStore } from '../../stores/wsStore';
import { MediaViewer } from '../../components/MediaViewer';

function InlineComments({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    postsApi.comments(postId).then(setComments).catch(() => {}).finally(() => setLoading(false));
  }, [postId]);

  const handleAdd = async () => {
    if (!newComment.trim()) return;
    try {
      const c = await postsApi.createComment(postId, { content: newComment });
      setComments((prev) => [...prev, c]);
      setNewComment('');
    } catch {}
  };

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      {loading ? (
        <p className="text-xs text-gray-500">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-500 mb-2">No comments yet.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-2 max-h-48 overflow-y-auto">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <span className="text-xs font-semibold text-indigo-300 shrink-0">{c.author_name}</span>
              <p className="text-xs text-gray-300"><FormattedText text={c.content} /></p>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 text-xs !py-1.5 !px-2.5"
        />
        <button onClick={handleAdd} className="btn btn-primary !py-1.5 !px-2.5 text-xs">
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

// Module-level guard — persists across navigation so mid-flight votes can't be
// double-submitted by quickly leaving and returning to the page.
const inFlightVotes = new Set<string>();

export function TimelinePage() {
  const { user: me } = useAuthStore();
  const { on } = useWSStore();
  const [items, setItems] = useState<Post[]>([]);
  const [sharedItems, setSharedItems] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [algorithm, setAlgorithm] = useState<'for-you' | 'chronological'>('for-you');
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [shareTarget, setShareTarget] = useState<{ type: 'post'; id: string } | null>(null);
  const [shareComment, setShareComment] = useState('');
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [votingPosts, setVotingPosts] = useState<Set<string>>(new Set());
  const votingPostsRef = useRef(inFlightVotes);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      postsApi.timeline(algorithm).catch(() => []),
      sharesApi.timeline().catch(() => []),
    ]).then(([posts, shares]) => {
      setItems(posts || []);
      setSharedItems(shares || []);
    }).finally(() => setLoading(false));
  }, [algorithm]);

  // WebSocket listeners for real-time updates
  useEffect(() => {
    const unsubNewPost = on('new_post', (msg) => {
      const post = msg.payload as Post;
      setItems((prev) => {
        if (prev.some((p) => p.id === post.id)) return prev;
        return [post, ...prev];
      });
    });

    const unsubVote = on('post_vote_update', (msg) => {
      const { post_id, upvotes, downvotes } = msg.payload;
      setItems((prev) =>
        prev.map((p) => (p.id === post_id ? { ...p, upvotes, downvotes } : p))
      );
    });

    const unsubComment = on('post_comment', (msg) => {
      const { post_id, comment_count } = msg.payload;
      setItems((prev) =>
        prev.map((p) => (p.id === post_id ? { ...p, comment_count } : p))
      );
    });

    return () => {
      unsubNewPost();
      unsubVote();
      unsubComment();
    };
  }, [on]);

  const handleVote = async (postId: string, vote: number) => {
    if (votingPostsRef.current.has(postId)) return;
    votingPostsRef.current.add(postId);
    setVotingPosts(new Set(votingPostsRef.current));
    try {
      await postsApi.vote(postId, vote);
      setItems((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const oldVote = p.user_vote;
          const newVote = oldVote === vote ? 0 : vote;
          let upvotes = p.upvotes;
          let downvotes = p.downvotes;
          if (oldVote === 1) upvotes--;
          if (oldVote === -1) downvotes--;
          if (newVote === 1) upvotes++;
          if (newVote === -1) downvotes++;
          return { ...p, upvotes, downvotes, user_vote: newVote };
        })
      );
    } catch {}
    votingPostsRef.current.delete(postId);
    setVotingPosts(new Set(votingPostsRef.current));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      // Upload media files first
      const mediaUrls: string[] = [];
      for (const file of mediaFiles) {
        const uploadRes = await uploadsApi.upload(file);
        if (uploadRes?.url) mediaUrls.push(uploadRes.url);
      }
      const post = await postsApi.create({ title, content, media_urls: mediaUrls });
      setItems((prev) => [post, ...prev]);
      setTitle('');
      setContent('');
      setMediaFiles([]);
      setShowCreate(false);
    } catch {}
  };

  const handleShare = async () => {
    if (!shareTarget) return;
    try {
      await sharesApi.create({
        share_type: shareTarget.type,
        post_id: shareTarget.type === 'post' ? shareTarget.id : undefined,
        comment: shareComment,
      });
      const shares = await sharesApi.timeline().catch(() => []);
      setSharedItems(shares || []);
      setShareTarget(null);
      setShareComment('');
    } catch {}
  };

  const handleEdit = async (postId: string) => {
    if (!editTitle.trim()) return;
    try {
      await postsApi.edit(postId, { title: editTitle, content: editContent });
      setItems((prev) =>
        prev.map((p) => p.id === postId ? { ...p, title: editTitle, content: editContent, edited_at: new Date().toISOString() } : p)
      );
      setEditingPost(null);
    } catch {}
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Delete this post?')) return;
    try {
      await postsApi.delete(postId);
      setItems((prev) => prev.filter((p) => p.id !== postId));
    } catch {}
  };

  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId); else next.add(postId);
      return next;
    });
  };

  // Merge posts and shares into a single sorted feed
  type FeedItem = { type: 'post'; data: Post; sortTime: number } | { type: 'share'; data: Share; sortTime: number };
  const feed: FeedItem[] = [
    ...items.map((p) => ({ type: 'post' as const, data: p, sortTime: new Date(p.created_at).getTime() })),
    ...sharedItems.map((s) => ({ type: 'share' as const, data: s, sortTime: new Date(s.created_at).getTime() })),
  ].sort((a, b) => b.sortTime - a.sortTime);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Timeline</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-white/10 rounded-lg p-1">
            <button
              onClick={() => setAlgorithm('for-you')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all-custom ${
                algorithm === 'for-you' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              For You
            </button>
            <button
              onClick={() => setAlgorithm('chronological')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all-custom ${
                algorithm === 'chronological' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Latest
            </button>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="btn btn-primary">
            <Plus size={16} /> Post
          </button>
        </div>
      </div>

      {showCreate && (
        <GlassPanel className="p-4 mb-6 animate-slide-up">
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <textarea
              placeholder="What's on your mind?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
            />
            {mediaFiles.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {mediaFiles.map((f, i) => (
                  <div key={i} className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300 flex items-center gap-1">
                    {f.name}
                    <button onClick={() => setMediaFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-gray-500 hover:text-red-400">×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FormatHelper />
                <label className="p-2 rounded hover:bg-white/10 cursor-pointer text-gray-400 hover:text-white transition-all-custom">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setMediaFiles((prev) => [...prev, ...files].slice(0, 4));
                    }}
                  />
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </label>
              </div>
              <button type="submit" className="btn btn-primary">
                <Send size={14} /> Post
              </button>
            </div>
          </form>
        </GlassPanel>
      )}

      {/* Share dialog */}
      {shareTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <GlassPanel className="p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Share2 size={18} /> Share to Home
              </h3>
              <button onClick={() => { setShareTarget(null); setShareComment(''); }} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <textarea
              placeholder="Add a comment (optional)..."
              value={shareComment}
              onChange={(e) => setShareComment(e.target.value)}
              rows={2}
              className="w-full mb-3"
            />
            <button onClick={handleShare} className="btn btn-primary w-full">
              <Share2 size={14} /> Share
            </button>
          </GlassPanel>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading...</div>
      ) : feed.length === 0 ? (
        <GlassPanel className="p-8 text-center text-gray-400">
          <p>No posts yet. Shake someone's hand to see their timeline!</p>
        </GlassPanel>
      ) : (
        <div className="flex flex-col gap-4">
          {feed.map((item) => {
            if (item.type === 'share') {
              const s = item.data;
              return (
                <GlassPanel key={`share-${s.id}`} className="p-4 animate-fade-in">
                  <div className="flex items-center gap-2 mb-3 text-xs text-gray-400">
                    <Repeat2 size={14} className="text-green-400" />
                    <Avatar url={s.sharer_avatar || ''} type="image" size={18} />
                    <Link to="/app/profile/$userId" params={{ userId: s.user_id }} className="text-indigo-300 hover:underline">
                      {s.sharer_name || 'Someone'}
                    </Link>
                    <span>shared {s.share_type === 'post' ? 'a post' : 'a message'}</span>
                    <span className="text-gray-600">{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                  {s.comment && <p className="text-gray-300 text-sm mb-3">"{s.comment}"</p>}

                  {s.post && (
                    <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar url={s.post.author_avatar || ''} type="image" size={20} />
                        <Link to="/app/profile/$userId" params={{ userId: s.post.author_id }} className="text-xs text-indigo-300 hover:underline">
                          {s.post.author_name || 'Unknown'}
                        </Link>
                        {s.post.edited_at && <span className="text-[10px] text-gray-600">(Edited)</span>}
                      </div>
                      <h4 className="text-white font-semibold text-sm">{s.post.title}</h4>
                      <p className="text-gray-400 text-xs mt-1"><FormattedText text={s.post.content} /></p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span><ArrowUp size={12} className="inline" /> {s.post.upvotes - s.post.downvotes}</span>
                        <button
                          onClick={() => toggleComments(s.post!.id)}
                          className="flex items-center gap-1 hover:text-indigo-400 transition-all-custom cursor-pointer"
                        >
                          <MessageCircle size={12} /> {s.post.comment_count} comments
                        </button>
                      </div>
                      {expandedComments.has(s.post.id) && <InlineComments postId={s.post.id} />}
                    </div>
                  )}

                  {s.message && (
                    <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar url={s.message.sender_avatar || ''} type="image" size={20} />
                        <span className="text-xs text-indigo-300">{s.message.sender_name || 'Unknown'}</span>
                      </div>
                      <p className="text-gray-300 text-sm"><FormattedText text={s.message.content} /></p>
                    </div>
                  )}
                </GlassPanel>
              );
            }

            const post = item.data as Post;
            const isOwn = me?.id === post.author_id;
            const isEditing = editingPost === post.id;
            return (
              <GlassPanel key={post.id} className="p-4 animate-fade-in">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => handleVote(post.id, 1)}
                      disabled={votingPosts.has(post.id)}
                      className={`p-1 rounded hover:bg-white/10 transition-all-custom ${votingPosts.has(post.id) ? 'opacity-50 cursor-not-allowed' : ''} ${
                        post.user_vote === 1 ? 'text-indigo-400' : 'text-gray-500'
                      }`}
                    >
                      <ArrowUp size={18} />
                    </button>
                    <span className="text-sm font-bold text-white">
                      {post.upvotes - post.downvotes}
                    </span>
                    <button
                      onClick={() => handleVote(post.id, -1)}
                      disabled={votingPosts.has(post.id)}
                      className={`p-1 rounded hover:bg-white/10 transition-all-custom ${votingPosts.has(post.id) ? 'opacity-50 cursor-not-allowed' : ''} ${
                        post.user_vote === -1 ? 'text-red-400' : 'text-gray-500'
                      }`}
                    >
                      <ArrowDown size={18} />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar url={post.author_avatar || ''} type="image" size={24} />
                      <Link
                        to="/app/profile/$userId"
                        params={{ userId: post.author_id }}
                        className="text-sm text-indigo-300 hover:underline"
                      >
                        {post.author_name || 'Unknown'}
                      </Link>
                      <span className="text-xs text-gray-500">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                      {post.edited_at && <span className="text-[10px] text-gray-600">(Edited)</span>}
                      {isOwn && !isEditing && (
                        <div className="ml-auto flex gap-1">
                          <button
                            onClick={() => { setEditingPost(post.id); setEditTitle(post.title); setEditContent(post.content); }}
                            className="p-1 text-gray-500 hover:text-indigo-400 transition-all-custom"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(post.id)}
                            className="p-1 text-gray-500 hover:text-red-400 transition-all-custom"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex flex-col gap-2 mt-1">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="text-sm"
                        />
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={2}
                          className="text-sm"
                        />
                        <div className="flex gap-2 self-end">
                          <button onClick={() => setEditingPost(null)} className="btn btn-glass text-xs !py-1 !px-3">
                            <X size={12} /> Cancel
                          </button>
                          <button onClick={() => handleEdit(post.id)} className="btn btn-primary text-xs !py-1 !px-3">
                            <Check size={12} /> Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-white font-semibold mb-1">{post.title}</h3>
                        <p className="text-gray-300 text-sm"><FormattedText text={post.content} /></p>
                        {post.media_urls && post.media_urls.length > 0 && <MediaViewer urls={post.media_urls} />}
                      </>
                    )}

                    <div className="flex items-center gap-4 mt-3 text-gray-500 text-xs">
                      <button
                        onClick={() => toggleComments(post.id)}
                        className="flex items-center gap-1 hover:text-indigo-400 transition-all-custom cursor-pointer"
                      >
                        <MessageCircle size={14} /> {post.comment_count} comments
                      </button>
                      <button
                        onClick={() => setShareTarget({ type: 'post', id: post.id })}
                        className="flex items-center gap-1 hover:text-green-400 transition-all-custom"
                      >
                        <Share2 size={14} /> Share
                      </button>
                    </div>

                    {expandedComments.has(post.id) && <InlineComments postId={post.id} />}
                  </div>
                </div>
              </GlassPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
