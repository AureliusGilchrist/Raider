import React from 'react';

interface AvatarProps {
  url: string;
  type: string;
  size?: number;
  className?: string;
}

export function Avatar({ url, type, size = 40, className = '' }: AvatarProps) {
  const sizeStyle = { width: size, height: size, minWidth: size, minHeight: size };

  if (!url) {
    return (
      <div
        className={`rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold ${className}`}
        style={sizeStyle}
      >
        ?
      </div>
    );
  }

  if (type === 'video' || url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mkv') || url.endsWith('.mov')) {
    // Render video at a higher internal resolution to avoid pixelation at small sizes
    const minRender = 96;
    const renderSize = Math.max(size, minRender);
    const scale = size / renderSize;

    return (
      <div
        className={`rounded-full overflow-hidden shrink-0 ${className}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
      >
        <video
          src={url}
          className="object-cover pointer-events-none"
          style={{
            width: renderSize,
            height: renderSize,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
          autoPlay
          loop
          muted
          playsInline
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
        />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="avatar"
      className={`rounded-full object-cover ${className}`}
      style={{ ...sizeStyle, imageRendering: size < 48 ? 'auto' : undefined }}
    />
  );
}
