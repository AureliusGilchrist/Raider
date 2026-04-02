import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GlassPanel } from './GlassPanel';
import { X } from 'lucide-react';

type PopupType = 'alert' | 'confirm' | 'prompt';

interface PopupConfig {
  type: PopupType;
  title?: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (value: string | boolean | null) => void;
}

let showPopupGlobal: ((config: Omit<PopupConfig, 'resolve'>) => Promise<string | boolean | null>) | null = null;

export function raiderAlert(message: string, title?: string): Promise<boolean> {
  if (!showPopupGlobal) { alert(message); return Promise.resolve(true); }
  return showPopupGlobal({ type: 'alert', message, title }) as Promise<boolean>;
}

export function raiderConfirm(message: string, title?: string): Promise<boolean> {
  if (!showPopupGlobal) return Promise.resolve(confirm(message));
  return showPopupGlobal({ type: 'confirm', message, title }) as Promise<boolean>;
}

export function raiderPrompt(message: string, defaultValue?: string, title?: string): Promise<string | null> {
  if (!showPopupGlobal) return Promise.resolve(prompt(message, defaultValue));
  return showPopupGlobal({ type: 'prompt', message, title, defaultValue }) as Promise<string | null>;
}

export function CustomPopupProvider({ children }: { children: React.ReactNode }) {
  const [popup, setPopup] = useState<PopupConfig | null>(null);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const showPopup = useCallback((config: Omit<PopupConfig, 'resolve'>) => {
    return new Promise<string | boolean | null>((resolve) => {
      setPopup({ ...config, resolve });
      if (config.type === 'prompt') {
        setInputValue(config.defaultValue || '');
      }
    });
  }, []);

  useEffect(() => {
    showPopupGlobal = showPopup;
    return () => { showPopupGlobal = null; };
  }, [showPopup]);

  useEffect(() => {
    if (popup?.type === 'prompt') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [popup]);

  const handleConfirm = () => {
    if (!popup) return;
    if (popup.type === 'prompt') {
      popup.resolve(inputValue);
    } else {
      popup.resolve(true);
    }
    setPopup(null);
  };

  const handleCancel = () => {
    if (!popup) return;
    if (popup.type === 'alert') {
      popup.resolve(true);
    } else if (popup.type === 'confirm') {
      popup.resolve(false);
    } else {
      popup.resolve(null);
    }
    setPopup(null);
  };

  return (
    <>
      {children}
      {popup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fade-in" onClick={handleCancel}>
          <GlassPanel className="p-6 w-full max-w-sm mx-4 animate-slide-up" onClick={() => {}}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-sm">
                {popup.title || (popup.type === 'alert' ? 'Notice' : popup.type === 'confirm' ? 'Confirm' : 'Input')}
              </h3>
              <button onClick={handleCancel} className="text-gray-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <p className="text-gray-300 text-sm mb-4">{popup.message}</p>
            {popup.type === 'prompt' && (
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') handleCancel(); }}
                placeholder={popup.placeholder || ''}
                className="w-full mb-4 text-sm"
              />
            )}
            <div className="flex justify-end gap-2">
              {popup.type !== 'alert' && (
                <button onClick={handleCancel} className="btn btn-glass text-xs !py-1.5 !px-4">
                  {popup.cancelLabel || 'Cancel'}
                </button>
              )}
              <button onClick={handleConfirm} className="btn btn-primary text-xs !py-1.5 !px-4">
                {popup.confirmLabel || 'OK'}
              </button>
            </div>
          </GlassPanel>
        </div>
      )}
    </>
  );
}
