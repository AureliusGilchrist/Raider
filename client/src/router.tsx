import { createRouter, createRootRoute, createRoute, redirect, Outlet } from '@tanstack/react-router';
import React from 'react';
import { RootLayout } from './routes/__root';
import { AuthPage } from './routes/index';
import { AppLayout } from './routes/app';
import { TimelinePage } from './routes/app/timeline';
import { ProfilePage } from './routes/app/profile';
import { ServersPage } from './routes/app/servers';
import { ServerPage } from './routes/app/server';
import { DMListPage } from './routes/app/dm';
import { DMConversationPage } from './routes/app/dmConversation';
import { SettingsPage } from './routes/app/settings';
import { CallPage } from './routes/app/call';
import { GroupsPage } from './routes/app/groups';
import { NotificationsPage } from './routes/app/notifications';

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: AuthPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: AppLayout,
  beforeLoad: () => {
    const token = localStorage.getItem('raider_token');
    if (!token) throw redirect({ to: '/' });
  },
});

const timelineRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/timeline',
  component: TimelinePage,
});

const profileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/profile/$userId',
  component: ProfilePage,
});

const serversRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/servers',
  component: ServersPage,
});

const serverRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/server/$serverId',
  component: ServerPage,
});

const dmRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/dm',
  component: DMListPage,
});

const dmConversationRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/dm/$userId',
  component: DMConversationPage,
});

const groupsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/groups',
  component: GroupsPage,
});

const notificationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/notifications',
  component: NotificationsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings',
  beforeLoad: () => { throw redirect({ to: '/app/settings/profile' }); },
  component: () => null,
});

const settingsTabRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings/$tab',
  component: SettingsPage,
});

const callRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/call/$callId',
  component: CallPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  appRoute.addChildren([
    timelineRoute,
    profileRoute,
    serversRoute,
    serverRoute,
    dmRoute,
    dmConversationRoute,
    groupsRoute,
    notificationsRoute,
    settingsRoute,
    settingsTabRoute,
    callRoute,
  ]),
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
