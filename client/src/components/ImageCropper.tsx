import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GlassPanel } from './GlassPanel';
import { Check, X, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageCropperProps {
  file: File;
  aspectRatio: number; // width / height, e.g. 1 for avatar, 3 for banner
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
}

export function ImageCropper({ file, aspectRatio, onCrop, onCancel }: ImageCropperProps) {
  const [imgSrc, setImgSrc] = useState('');
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    const img = new Image();
    img.onload = () => {
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      // Fit image so the crop window is filled
      const containerW = 500;
      const containerH = containerW / aspectRatio;
      const scaleW = containerW / img.naturalWidth;
      const scaleH = containerH / img.naturalHeight;
      setScale(Math.max(scaleW, scaleH));
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, aspectRatio]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { ...offset };
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({
      x: offsetStart.current.x + (e.clientX - dragStart.current.x),
      y: offsetStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, [dragging]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(prev => Math.max(0.1, Math.min(5, prev - e.deltaY * 0.001)));
  }, []);

  const cropW = 500;
  const cropH = cropW / aspectRatio;

  const handleCrop = useCallback(async () => {
    const canvas = document.createElement('canvas');
    const outW = Math.min(imgSize.w, aspectRatio >= 2 ? 1500 : 512);
    const outH = outW / aspectRatio;
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.src = imgSrc;
    });

    // Calculate the source rectangle from the current view
    const displayW = imgSize.w * scale;
    const displayH = imgSize.h * scale;
    const srcX = ((cropW / 2 - offset.x) - displayW / 2) / scale + imgSize.w / 2;
    const srcY = ((cropH / 2 - offset.y) - displayH / 2) / scale + imgSize.h / 2;
    const srcW = cropW / scale;
    const srcH = cropH / scale;

    ctx.drawImage(img, srcX - srcW / 2, srcY - srcH / 2, srcW, srcH, 0, 0, outW, outH);

    canvas.toBlob((blob) => {
      if (blob) {
        const cropped = new File([blob], file.name.replace(/\.[^.]+$/, '.png'), { type: 'image/png' });
        onCrop(cropped);
      }
    }, 'image/png');
  }, [imgSrc, imgSize, scale, offset, cropW, cropH, aspectRatio, file.name, onCrop]);

  const isVideo = file.type.startsWith('video/');

  // Skip cropper for video files
  if (isVideo) {
    onCrop(file);
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <GlassPanel className="p-6 max-w-[580px] w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Position & Crop</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-3">Drag to reposition. Scroll or use buttons to zoom.</p>

        {/* Crop viewport */}
        <div
          ref={containerRef}
          className="relative mx-auto overflow-hidden rounded-lg border-2 border-white/20 cursor-move select-none"
          style={{ width: cropW, height: cropH }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {imgSrc && (
            <img
              src={imgSrc}
              alt="Crop preview"
              className="absolute pointer-events-none"
              draggable={false}
              style={{
                width: imgSize.w * scale,
                height: imgSize.h * scale,
                left: `calc(50% + ${offset.x}px - ${(imgSize.w * scale) / 2}px)`,
                top: `calc(50% + ${offset.y}px - ${(imgSize.h * scale) / 2}px)`,
              }}
            />
          )}
          {/* Crop guide corners */}
          <div className="absolute inset-0 pointer-events-none border-2 border-white/30 rounded-lg" />
          <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-white/60 rounded-tl pointer-events-none" />
          <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-white/60 rounded-tr pointer-events-none" />
          <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-white/60 rounded-bl pointer-events-none" />
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-white/60 rounded-br pointer-events-none" />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setScale(s => Math.max(0.1, s - 0.1))} className="btn btn-glass !p-2">
              <ZoomOut size={16} />
            </button>
            <span className="text-xs text-gray-400 w-12 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(5, s + 0.1))} className="btn btn-glass !p-2">
              <ZoomIn size={16} />
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className="btn btn-glass">
              <X size={14} /> Cancel
            </button>
            <button onClick={handleCrop} className="btn btn-primary">
              <Check size={14} /> Apply
            </button>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
