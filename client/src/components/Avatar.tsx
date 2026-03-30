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
    return (
      <div
        className={`rounded-full overflow-hidden shrink-0 ${className}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
      >
        <video
          src={url}
          className="pointer-events-none"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
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
