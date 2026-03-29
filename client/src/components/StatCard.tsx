import React from 'react';
import { AnimatedNumber } from './AnimatedNumber';

interface StatCardProps {
  icon: string;
  label: string;
  value: number | string;
  className?: string;
}

export function StatCard({ icon, label, value, className = '' }: StatCardProps) {
  return (
    <div className={`glass-light rounded-lg p-3 flex flex-col items-center gap-1 transition-all-custom hover:scale-105 ${className}`}>
      <span className="text-xl">{icon}</span>
      <AnimatedNumber value={value} className="text-lg font-bold text-white" />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}
