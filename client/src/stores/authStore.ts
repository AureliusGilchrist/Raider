import { create } from 'zustand';
import { auth as authApi } from '../lib/api';
import type { User } from '../lib/types';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<any>;
  register: (username: string, email: string, password: string, keyIterations: number) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('raider_token'),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await authApi.login({ email, password });
      if (res.requires_2fa) {
        set({ loading: false, error: null });
        return res;
      }
      localStorage.setItem('raider_token', res.token);
      set({ user: res.user, token: res.token, loading: false });
      return res;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  register: async (username, email, password, keyIterations) => {
    set({ loading: true, error: null });
    try {
      const res = await authApi.register({ username, email, password, key_iterations: keyIterations });
      localStorage.setItem('raider_token', res.token);
      set({ user: res.user, token: res.token, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('raider_token');
    set({ user: null, token: null });
  },

  fetchMe: async () => {
    try {
      const user = await authApi.me();
      set({ user });
    } catch {
      localStorage.removeItem('raider_token');
      set({ user: null, token: null });
    }
  },

  setUser: (user) => set({ user }),
  clearError: () => set({ error: null }),
}));
