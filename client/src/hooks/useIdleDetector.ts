import { useEffect, useRef, useCallback } from 'react';

interface IdleOptions {
  onIdle: () => void;
  onActive: () => void;
  idleTimeMs?: number;
}

export function useIdleDetector({ onIdle, onActive, idleTimeMs = 10 * 60 * 1000 }: IdleOptions) {
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIdleRef = useRef(false);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    if (isIdleRef.current) {
      isIdleRef.current = false;
      onActive();
    }

    idleTimerRef.current = setTimeout(() => {
      isIdleRef.current = true;
      onIdle();
    }, idleTimeMs);
  }, [onIdle, onActive, idleTimeMs]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];

    const handleActivity = () => {
      resetIdleTimer();
    };

    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Start the idle timer
    resetIdleTimer();

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [resetIdleTimer]);

  return { resetIdleTimer };
}
