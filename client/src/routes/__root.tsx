import React, { useEffect } from 'react';
import { Outlet } from '@tanstack/react-router';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useWSStore } from '../stores/wsStore';

export function RootLayout() {
  const { token, fetchMe } = useAuthStore();
  const { fetch: fetchSettings } = useSettingsStore();
  const { connect } = useWSStore();

  useEffect(() => {
    if (token) {
      fetchMe();
      fetchSettings();
      connect(token);
    }
  }, [token]);

  // Suppress the default browser context menu everywhere.
  // Elements that use a custom context menu should handle contextmenu themselves.
  useEffect(() => {
    const suppress = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', suppress);
    return () => document.removeEventListener('contextmenu', suppress);
  }, []);

  return <Outlet />;
}
