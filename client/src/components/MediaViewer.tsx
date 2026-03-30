import React from 'react';

interface MediaViewerProps {
  urls: string[];
  className?: string;
}

export function MediaViewer({ urls, className = '' }: MediaViewerProps) {
  if (!urls || urls.length === 0) return null;

  const isVideo = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase();
    return ['mp4', 'webm', 'mov', 'mkv'].includes(ext || '');
  };

  const isImage = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(ext || '');
  };

  const renderMedia = (url: string, index: number) => {
    if (isVideo(url)) {
      return (
        <div key={index} className="relative rounded-lg overflow-hidden bg-black/50">
          <video
            src={url}
            controls
            className="w-full max-h-96 object-contain"
            preload="metadata"
          />
        </div>
      );
    }

    if (isImage(url)) {
      return (
        <div key={index} className="relative rounded-lg overflow-hidden">
          <img
            src={url}
            alt="Post media"
            className="w-full max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(url, '_blank')}
          />
        </div>
      );
    }

    return null;
  };

  // Single media - full width
  if (urls.length === 1) {
    return <div className={`mt-2 ${className}`}>{renderMedia(urls[0], 0)}</div>;
  }

  // Multiple media - grid layout
  return (
    <div className={`mt-2 grid gap-2 ${urls.length === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'} ${className}`}>
      {urls.slice(0, 4).map((url, i) => renderMedia(url, i))}
      {urls.length > 4 && (
        <div className="relative rounded-lg overflow-hidden bg-black/50 flex items-center justify-center">
          <span className="text-white font-bold text-lg">+{urls.length - 4}</span>
        </div>
      )}
    </div>
  );
}
