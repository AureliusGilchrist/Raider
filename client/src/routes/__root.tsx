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

  return <Outlet />;
}
