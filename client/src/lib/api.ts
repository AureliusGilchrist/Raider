const BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('raider_token');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }

  return res.json();
}

// Auth
export const auth = {
  register: (data: { username: string; email: string; password: string; key_iterations: number }) =>
    request<{ token: string; user: any }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request<any>('/me'),
  updateProfile: (data: any) => request<any>('/me', { method: 'PUT', body: JSON.stringify(data) }),
};

// Settings
export const settings = {
  get: () => request<any>('/settings'),
  update: (data: any) => request<any>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
};

// Stats
export const stats = {
  get: (userId?: string) => request<any>(`/stats${userId ? `?user_id=${userId}` : ''}`),
  badges: (userId?: string) => request<any[]>(`/badges/user${userId ? `?user_id=${userId}` : ''}`),
  serverActivity: (userId?: string) => request<any[]>(`/stats/server-activity${userId ? `?user_id=${userId}` : ''}`),
  allBadges: () => request<any[]>('/badges'),
};

// Handshakes
export const handshakes = {
  list: () => request<any[]>('/handshakes'),
  initiate: (targetUserId: string) =>
    request<any>('/handshakes', { method: 'POST', body: JSON.stringify({ target_user_id: targetUserId }) }),
  accept: (handshakeId: string) =>
    request<any>('/handshakes/accept', { method: 'POST', body: JSON.stringify({ handshake_id: handshakeId }) }),
  reject: (handshakeId: string) =>
    request<any>('/handshakes/reject', { method: 'POST', body: JSON.stringify({ handshake_id: handshakeId }) }),
  check: (targetId: string) => request<any>(`/handshakes/check?target=${targetId}`),
};

// Servers
export const servers = {
  list: () => request<any[]>('/servers'),
  get: (id: string) => request<any>(`/servers/${id}`),
  create: (data: { name: string; description: string }) =>
    request<any>('/servers', { method: 'POST', body: JSON.stringify(data) }),
  join: (id: string) => request<any>(`/servers/${id}/join`, { method: 'POST' }),
  leave: (id: string) => request<any>(`/servers/${id}/leave`, { method: 'POST' }),
  discover: (q?: string, sort?: 'popular' | 'relevant') => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (sort) params.set('sort', sort);
    return request<any[]>(`/servers/discover?${params.toString()}`);
  },
  channels: (id: string) => request<any[]>(`/servers/${id}/channels`),
  createChannel: (id: string, data: { name: string; type: string }) =>
    request<any>(`/servers/${id}/channels`, { method: 'POST', body: JSON.stringify(data) }),
  members: (id: string) => request<any[]>(`/servers/${id}/members`),
  posts: (id: string) => request<any[]>(`/servers/${id}/posts`),
  update: (id: string, data: any) => request<any>(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/servers/${id}`, { method: 'DELETE' }),
  // Roles
  roles: (id: string) => request<any[]>(`/servers/${id}/roles`),
  createRole: (id: string, data: any) => request<any>(`/servers/${id}/roles`, { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, roleId: string, data: any) => request<any>(`/servers/${id}/roles/${roleId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRole: (id: string, roleId: string) => request<any>(`/servers/${id}/roles/${roleId}`, { method: 'DELETE' }),
  // Server Announcements
  getAnnouncement: (id: string) => request<any>(`/servers/${id}/announcement`),
  getAnnouncements: (id: string) => request<any[]>(`/servers/${id}/announcements`),
  createAnnouncement: (id: string, data: any) => request<any>(`/servers/${id}/announcements`, { method: 'POST', body: JSON.stringify(data) }),
  updateAnnouncement: (id: string, annId: string, data: any) => request<any>(`/servers/${id}/announcements/${annId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAnnouncement: (id: string, annId: string) => request<any>(`/servers/${id}/announcements/${annId}`, { method: 'DELETE' }),
  // Server Settings
  getSettings: (id: string) => request<any>(`/servers/${id}/settings`),
  updateSettings: (id: string, data: any) => request<any>(`/servers/${id}/settings`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Messages
export const messages = {
  send: (data: any) => request<any>('/messages', { method: 'POST', body: JSON.stringify(data) }),
  channel: (channelId: string) => request<any[]>(`/messages/channel/${channelId}`),
  dm: (userId: string) => request<any[]>(`/messages/dm/${userId}`),
  dmList: () => request<any[]>('/messages/dm'),
};

// Group Chats
export const groups = {
  list: () => request<any[]>('/groups'),
  get: (groupId: string) => request<any>(`/groups/${groupId}`),
  create: (data: { name: string; members: string[] }) => request<any>('/groups', { method: 'POST', body: JSON.stringify(data) }),
  addMember: (groupId: string, userId: string) => request<any>(`/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
  removeMember: (groupId: string, userId: string) => request<any>(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
  leave: (groupId: string) => request<any>(`/groups/${groupId}/leave`, { method: 'POST' }),
  delete: (groupId: string) => request<any>(`/groups/${groupId}`, { method: 'DELETE' }),
  messages: (groupId: string) => request<any[]>(`/groups/${groupId}/messages`),
  sendMessage: (groupId: string, content: string) => request<any>(`/groups/${groupId}/messages`, { method: 'POST', body: JSON.stringify({ content, encrypted: false }) }),
};

// Posts
export const posts = {
  timeline: (algorithm?: 'chronological' | 'for-you') => {
    const params = algorithm ? `?algorithm=${algorithm}` : '';
    return request<any[]>(`/posts/timeline${params}`);
  },
  create: (data: any) => request<any>('/posts', { method: 'POST', body: JSON.stringify(data) }),
  vote: (postId: string, vote: number) =>
    request<any>(`/posts/${postId}/vote`, { method: 'POST', body: JSON.stringify({ vote }) }),
  edit: (postId: string, data: { title: string; content: string }) =>
    request<any>(`/posts/${postId}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (postId: string) =>
    request<any>(`/posts/${postId}`, { method: 'DELETE' }),
  comments: (postId: string) => request<any[]>(`/posts/${postId}/comments`),
  createComment: (postId: string, data: { content: string; parent_id?: string }) =>
    request<any>(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify(data) }),
};

// Calls
export const calls = {
  create: (data: any) => request<any>('/calls', { method: 'POST', body: JSON.stringify(data) }),
  list: () => request<any[]>('/calls'),
  join: (id: string) => request<any>(`/calls/${id}/join`, { method: 'POST' }),
  leave: (id: string) => request<any>(`/calls/${id}/leave`, { method: 'POST' }),
  end: (id: string) => request<any>(`/calls/${id}/end`, { method: 'POST' }),
  signal: (data: any) => request<any>('/calls/signal', { method: 'POST', body: JSON.stringify(data) }),
};

// Users
export const users = {
  search: (q: string) => request<any[]>(`/users/search?q=${encodeURIComponent(q)}`),
  profile: (userId?: string) => request<any>(`/profile${userId ? `?user_id=${userId}` : ''}`),
  follow: (targetId: string) =>
    request<any>('/follow', { method: 'POST', body: JSON.stringify({ target_id: targetId }) }),
  unfollow: (targetId: string) =>
    request<any>('/unfollow', { method: 'POST', body: JSON.stringify({ target_id: targetId }) }),
};

// Shares
export const shares = {
  create: (data: { share_type: string; post_id?: string; message_id?: string; comment?: string }) =>
    request<any>('/shares', { method: 'POST', body: JSON.stringify(data) }),
  mine: () => request<any[]>('/shares'),
  timeline: () => request<any[]>('/shares/timeline'),
  delete: (shareId: string) =>
    request<any>('/shares', { method: 'DELETE', body: JSON.stringify({ share_id: shareId }) }),
};

// Announcements
export const announcements = {
  list: () => request<any[]>('/announcements'),
  create: (data: { content: string; type: string; server_id?: string; expires_at?: string }) =>
    request<any>('/announcements', { method: 'POST', body: JSON.stringify(data) }),
  dismiss: (id: string) => request<any>(`/announcements/${id}/dismiss`, { method: 'POST' }),
  delete: (id: string) => request<any>(`/announcements/${id}`, { method: 'DELETE' }),
};

// Uploads
export const uploads = {
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<any>('/upload', { method: 'POST', body: form });
  },
  setAvatar: (url: string, type: string) =>
    request<any>('/avatar', { method: 'POST', body: JSON.stringify({ url, type }) }),
  setBanner: (url: string, type: string) =>
    request<any>('/banner', { method: 'POST', body: JSON.stringify({ url, type }) }),
};
