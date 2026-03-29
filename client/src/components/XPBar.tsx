import React from 'react';
import { AnimatedNumber } from './AnimatedNumber';

interface XPBarProps {
  xp: number;
  level: number;
}

export function XPBar({ xp, level }: XPBarProps) {
  const xpInLevel = xp % 100;
  const percent = Math.min(100, xpInLevel);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
        <span className="bg-purple-500/30 px-2 py-0.5 rounded-full">Lv. <AnimatedNumber value={level} /></span>
      </div>
      <div className="flex-1 xp-bar">
        <div className="xp-bar-fill" style={{ width: `${percent}%`, transition: 'width var(--animation-speed) ease' }} />
      </div>
      <span className="text-xs text-gray-400"><AnimatedNumber value={xpInLevel} />/100 XP</span>
    </div>
  );
}
