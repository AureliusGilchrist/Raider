import React from 'react';
import { ImagePlus } from 'lucide-react';

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
      <div className={`banner-surface w-full ${height} bg-gradient-to-r from-indigo-600/40 via-purple-600/40 to-pink-600/40 relative ${className}`}>
        {editable && (
          <button
            onClick={onUpload}
            className="absolute bottom-3 right-3 h-10 w-10 rounded-full btn btn-glass !p-0 z-30"
            title="Upload banner"
          >
            <ImagePlus size={16} />
          </button>
        )}
      </div>
    );
  }

  const isVideo = type === 'video' || url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mkv');

  return (
    <div className={`banner-surface w-full ${height} relative overflow-hidden ${className}`}>
      {isVideo ? (
        <video
          src={url}
          className="w-full h-full object-cover pointer-events-none"
          autoPlay
          loop
          muted
          playsInline
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
        />
      ) : (
        <img src={url} alt="banner" className="w-full h-full object-cover" />
      )}
      {editable && (
          <button
            onClick={onUpload}
            className="absolute bottom-3 right-3 h-10 w-10 rounded-full btn btn-glass !p-0 z-30"
            title="Change banner"
          >
            <ImagePlus size={16} />
          </button>
        )}
    </div>
  );
}
