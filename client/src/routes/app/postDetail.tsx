import React, { useEffect, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { GlassPanel } from '../../components/GlassPanel';
import { Avatar } from '../../components/Avatar';
import { useAuthStore } from '../../stores/authStore';
import { posts as postsApi } from '../../lib/api';
import type { Post, Comment } from '../../lib/types';
import { ArrowUp, ArrowDown, MessageCircle, ArrowLeft, Share2, Send, Pencil, Trash2, Check, X } from 'lucide-react';
import { FormattedText } from '../../components/FormattedText';
import { FormatHelper } from '../../components/FormatHelper';
import { MediaViewer } from '../../components/MediaViewer';
import { useWSStore } from '../../stores/wsStore';
import { raiderConfirm } from '../../components/CustomPopup';
import { formatDistanceToNow } from '../../lib/dateUtils';

function buildTree(flat: Comment[]) {
  const map = new Map<string, Comment & { children: Comment[] }>();
  const roots: (Comment & { children: Comment[] })[] = [];
  flat.forEach(c => map.set(c.id, { ...c, children: [] }));
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

function CommentNode({ node, postId, depth }: { node: Comment & { children: Comment[] }; postId: string; depth: number }) {
  const { user: me } = useAuthStore();
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');

  const handleReply = async () => {
    if (!replyText.trim()) return;
    try {
      await postsApi.createComment(postId, { content: replyText, parent_id: node.id });
      setReplyText('');
      setReplying(false);
    } catch {}
  };

  const handleVote = async (vote: number) => {
    try {
      await postsApi.voteComment(postId, node.id, vote);
    } catch {}
  };

  return (
    <div className={depth > 0 ? 'ml-6 border-l border-white/10 pl-3' : ''}>
      <div className="py-2">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <span className="text-gray-300 font-medium">{node.author_name}</span>
          <span>·</span>
          <span>{formatDistanceToNow(node.created_at)}</span>
        </div>
        <p className="text-sm text-gray-300"><FormattedText text={node.content} /></p>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <button onClick={() => handleVote(node.user_vote === 1 ? 0 : 1)} className={`flex items-center gap-0.5 hover:text-green-400 ${node.user_vote === 1 ? 'text-green-400' : ''}`}>
            <ArrowUp size={12} /> {node.upvotes}
          </button>
          <button onClick={() => handleVote(node.user_vote === -1 ? 0 : -1)} className={`flex items-center gap-0.5 hover:text-red-400 ${node.user_vote === -1 ? 'text-red-400' : ''}`}>
            <ArrowDown size={12} /> {node.downvotes}
          </button>
          <button onClick={() => setReplying(!replying)} className="hover:text-indigo-400">Reply</button>
        </div>
        {replying && (
          <div className="flex gap-2 mt-2">
            <input
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleReply()}
              placeholder="Write a reply..."
              className="flex-1 text-sm"
            />
            <button onClick={handleReply} className="btn btn-primary text-xs !py-1 !px-2">
              <Send size={12} />
            </button>
          </div>
        )}
      </div>
      {node.children.map(child => (
        <CommentNode key={child.id} node={child as any} postId={postId} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function PostDetailPage() {
  const { postId } = useParams({ strict: false }) as { postId: string };
  const { user: me } = useAuthStore();
  const { on } = useWSStore();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [showHelper, setShowHelper] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [postData, commentData] = await Promise.all([
          postsApi.get(postId),
          postsApi.comments(postId),
        ]);
        if (!cancelled) {
          setPost(postData);
          setComments(commentData || []);
        }
      } catch (err) {
        console.error('Failed to load post', postId, err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [postId]);

  // Real-time comment updates
  useEffect(() => {
    const unsub1 = on('post_comment', (msg) => {
      const { post_id, comment } = msg.payload;
      if (post_id !== postId || !comment) return;
      setComments(prev => prev.some(c => c.id === comment.id) ? prev : [...prev, comment]);
    });
    const unsub2 = on('comment_edited', (msg) => {
      const { post_id, comment } = msg.payload;
      if (post_id !== postId) return;
      setComments(prev => prev.map(c => c.id === comment.id ? { ...c, content: comment.content, edited_at: comment.edited_at } : c));
    });
    const unsub3 = on('comment_deleted', (msg) => {
      const { post_id, comment_id } = msg.payload;
      if (post_id !== postId) return;
      setComments(prev => prev.filter(c => c.id !== comment_id));
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [on, postId]);

  const handleVote = async (vote: number) => {
    if (!post) return;
    try {
      const res = await postsApi.vote(postId, vote);
      setPost({ ...post, upvotes: res.upvotes, downvotes: res.downvotes, user_vote: res.user_vote });
    } catch {}
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const c = await postsApi.createComment(postId, { content: newComment });
      setComments(prev => [...prev, c]);
      setNewComment('');
    } catch {}
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${postId}`);
    } catch {}
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-gray-500 text-center py-12">Loading post...</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-gray-500 text-center py-12">Post not found</div>
      </div>
    );
  }

  const tree = buildTree(comments);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Link to="/app/timeline" className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-4 transition-all-custom">
        <ArrowLeft size={16} /> Back to Timeline
      </Link>

      <GlassPanel className="p-6">
        {/* Author */}
        <div className="flex items-start gap-3 mb-4">
          <Avatar url={post.author_avatar || ''} type="image" size={40} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{post.author_name}</span>
              <span className="text-gray-500 text-xs">{formatDistanceToNow(post.created_at)}</span>
              {post.edited_at && <span className="text-gray-600 text-[10px]">(edited)</span>}
            </div>
          </div>
        </div>

        {/* Post content */}
        <h2 className="text-xl font-bold text-white mb-2">{post.title}</h2>
        <div className="text-gray-300 mb-4"><FormattedText text={post.content} /></div>
        {post.media_urls && post.media_urls.length > 0 && (
          <div className="mb-4"><MediaViewer urls={post.media_urls} /></div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 text-gray-500 text-sm border-t border-white/10 pt-3">
          <button onClick={() => handleVote(post.user_vote === 1 ? 0 : 1)} className={`flex items-center gap-1 hover:text-green-400 transition-all-custom ${post.user_vote === 1 ? 'text-green-400' : ''}`}>
            <ArrowUp size={16} /> {post.upvotes}
          </button>
          <button onClick={() => handleVote(post.user_vote === -1 ? 0 : -1)} className={`flex items-center gap-1 hover:text-red-400 transition-all-custom ${post.user_vote === -1 ? 'text-red-400' : ''}`}>
            <ArrowDown size={16} /> {post.downvotes}
          </button>
          <span className="flex items-center gap-1">
            <MessageCircle size={16} /> {comments.length}
          </span>
          <button onClick={handleCopy} className="flex items-center gap-1 hover:text-indigo-400 transition-all-custom">
            <Share2 size={16} /> Copy Link
          </button>
        </div>
      </GlassPanel>

      {/* Comments Section */}
      <GlassPanel className="p-6 mt-4">
        <h3 className="text-white font-semibold mb-4">Comments ({comments.length})</h3>

        {/* Add comment */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <input
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddComment()}
              placeholder="Add a comment..."
              className="w-full text-sm"
            />
          </div>
          <button onClick={() => setShowHelper(!showHelper)} className="btn btn-glass text-xs !py-1 !px-2">
            Aa
          </button>
          <button onClick={handleAddComment} className="btn btn-primary text-xs !py-1 !px-2">
            <Send size={14} />
          </button>
        </div>
        {showHelper && <FormatHelper />}

        {/* Comment tree */}
        {tree.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No comments yet. Be the first!</p>
        ) : (
          <div className="space-y-1">
            {tree.map(node => (
              <CommentNode key={node.id} node={node} postId={postId} depth={0} />
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
