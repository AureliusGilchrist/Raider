import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

interface PageTransitionProps {
  children: React.ReactNode;
  transitionKey: string;
}

export function PageTransition({ children, transitionKey }: PageTransitionProps) {
  const { settings } = useSettingsStore();
  const [phase, setPhase] = useState<'enter' | 'active'>('enter');
  const [currentKey, setCurrentKey] = useState(transitionKey);
  const [displayChildren, setDisplayChildren] = useState(children);

  const disabled = settings?.reduced_motion || settings?.animation_speed === 'none';

  useEffect(() => {
    if (transitionKey !== currentKey) {
      setPhase('enter');
      setCurrentKey(transitionKey);
      setDisplayChildren(children);
    }
  }, [transitionKey, children]);

  useEffect(() => {
    if (disabled) {
      setPhase('active');
      return;
    }
    if (phase === 'enter') {
      const timer = requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase('active'));
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [phase, disabled]);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <div
      className={`page-transition ${phase === 'enter' ? 'page-enter' : 'page-enter-active'}`}
      style={{ height: '100%' }}
    >
      {displayChildren}
    </div>
  );
}
