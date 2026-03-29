import React, { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number | string;
  className?: string;
}

export function AnimatedNumber({ value, className = '' }: AnimatedNumberProps) {
  // Extract numeric part and suffix (e.g. "5d" → 5, "d")
  const strVal = String(value);
  const match = strVal.match(/^(-?\d+\.?\d*)(.*)/);
  const target = match ? parseFloat(match[1]) : 0;
  const suffix = match ? match[2] : strVal;
  const isNumeric = match !== null && !isNaN(target);

  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!isNumeric || target === 0) {
      setDisplay(target);
      return;
    }

    // Read --animation-speed CSS variable (e.g. "0.3s", "0.6s", "0s")
    const computedSpeed = getComputedStyle(document.documentElement).getPropertyValue('--animation-speed')?.trim();
    let baseMs = 300;
    if (computedSpeed) {
      const parsed = parseFloat(computedSpeed);
      if (!isNaN(parsed)) baseMs = parsed * 1000;
    }

    // Skip animation if speed is 0 or reduced motion
    if (baseMs === 0 || document.body.classList.contains('reduced-motion') || document.body.classList.contains('animation-none')) {
      setDisplay(target);
      return;
    }

    const duration = baseMs * 3; // scale up for visual effect
    setDisplay(0);
    startRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplay(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, isNumeric]);

  if (!isNumeric) return <span className={className}>{value}</span>;

  return <span className={className}>{display}{suffix}</span>;
}
