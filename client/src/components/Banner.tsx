import React from 'react';

interface BannerProps {
  url: string;
  type: string;
  className?: string;
  editable?: boolean;
  onUpload?: () => void;
  height?: string;
}

export function Banner({ url, type, className = '', editable = false, onUpload, height = 'h-48' }: BannerProps) {
  if (!url) {
    return (
      <div className={`w-full ${height} bg-gradient-to-r from-indigo-600/40 via-purple-600/40 to-pink-600/40 relative ${className}`}>
        {editable && (
          <button
            onClick={onUpload}
            className="absolute bottom-3 right-3 btn btn-glass text-xs"
          >
            Upload Banner
          </button>
        )}
      </div>
    );
  }

  const isVideo = type === 'video' || url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mkv');

  return (
    <div className={`w-full ${height} relative overflow-hidden ${className}`}>
      {isVideo ? (
        <video
          src={url}
          className="w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <img src={url} alt="banner" className="w-full h-full object-cover" />
      )}
      {editable && (
        <button
          onClick={onUpload}
          className="absolute bottom-3 right-3 btn btn-glass text-xs"
        >
          Change Banner
        </button>
      )}
    </div>
  );
}
