import React from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { posts as postsApi } from '../lib/api';
import { GlassPanel } from '../components/GlassPanel';
import { Avatar } from '../components/Avatar';
import { MediaViewer } from '../components/MediaViewer';
import { FormattedText } from '../components/FormattedText';
import type { Comment, Post } from '../lib/types';
import { ArrowUp, MessageCircle } from 'lucide-react';

export function PublicPostPage() {
  const { postId } = useParams({ strict: false }) as { postId: string };
  const [post, setPost] = React.useState<Post | null>(null);
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [commentsError, setCommentsError] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setLoading(true);
    setError('');
    setCommentsError('');

    postsApi.public(postId)
      .then((data) => {
        setPost(data);
        return postsApi.publicComments(postId)
          .then((commentData) => setComments(commentData || []))
          .catch((err: Error) => setCommentsError(err.message || 'Comments are unavailable for this post.'));
      })
      .catch((err: Error) => setError(err.message || 'Unable to load this post.'))
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading post...</div>;
  }

  if (error || !post) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">{error || 'Post not found.'}</div>;
  }

  return (
    <div className="min-h-screen p-4 md:p-8 flex justify-center">
      <div className="w-full max-w-3xl space-y-4">
        <GlassPanel className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <Avatar url={post.author_avatar || ''} type="image" size={42} />
            <div className="min-w-0">
              <Link to="/app/profile/$userId" params={{ userId: post.author_id }} className="text-indigo-300 hover:underline font-medium">
                {post.author_name || 'Unknown'}
              </Link>
              <div className="text-xs text-gray-500">{new Date(post.created_at).toLocaleString()}</div>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">{post.title}</h1>
          <div className="text-gray-200 text-sm leading-relaxed">
            <FormattedText text={post.content} />
          </div>
          {post.media_urls && post.media_urls.length > 0 && <MediaViewer urls={post.media_urls} />}

          <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><ArrowUp size={12} /> {post.upvotes - post.downvotes}</span>
            <span className="flex items-center gap-1"><MessageCircle size={12} /> {post.comment_count} comments</span>
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold">Comments</h2>
            {commentsError && <span className="text-xs text-amber-400">{commentsError}</span>}
          </div>

          {!comments.length ? (
            <p className="text-sm text-gray-500">No visible comments.</p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-indigo-300">{comment.author_name || 'Unknown'}</span>
                    <span className="text-[10px] text-gray-600">{new Date(comment.created_at).toLocaleString()}</span>
                    {comment.edited_at && <span className="text-[10px] text-gray-600">(edited)</span>}
                  </div>
                  <div className="text-sm text-gray-200"><FormattedText text={comment.content} /></div>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}