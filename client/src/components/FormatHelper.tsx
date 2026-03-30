import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface FormatHelperProps {
  className?: string;
}

export function FormatHelper({ className = '' }: FormatHelperProps) {
  const [show, setShow] = useState(false);

  const formats = [
    { syntax: '_text_', result: 'Italic', example: '_hello_' },
    { syntax: '*text*', result: 'Bold', example: '*hello*' },
    { syntax: '__text__', result: 'Underline', example: '__hello__' },
    { syntax: '~~text~~', result: 'Strikethrough', example: '~~hello~~' },
    { syntax: '`code`', result: 'Inline Code', example: '`hello`' },
    { syntax: '||text||', result: 'Spoiler', example: '||hello||' },
  ];

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShow(!show)}
        className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-all-custom"
        title="Formatting help"
      >
        <HelpCircle size={16} />
      </button>

      {show && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShow(false)}
          />
          <div className="absolute right-0 bottom-full mb-2 w-64 glass rounded-lg p-3 z-50 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white">Formatting</span>
              <button
                onClick={() => setShow(false)}
                className="p-0.5 rounded hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-1.5">
              {formats.map((f) => (
                <div key={f.syntax} className="flex items-center justify-between text-xs">
                  <code className="px-1.5 py-0.5 bg-white/10 rounded text-indigo-300 font-mono">
                    {f.syntax}
                  </code>
                  <span className="text-gray-400">{f.result}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
