import { create } from 'zustand';
import { settings as settingsApi } from '../lib/api';
import type { UserSettings } from '../lib/types';

interface SettingsState {
  settings: UserSettings | null;
  loading: boolean;
  fetch: () => Promise<void>;
  update: (s: Partial<UserSettings>) => Promise<void>;
  applyToDOM: (s: UserSettings) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const s = await settingsApi.get();
      set({ settings: s, loading: false });
      get().applyToDOM(s);
    } catch {
      set({ loading: false });
    }
  },

  update: async (partial) => {
    const current = get().settings;
    if (!current) return;
    const merged = { ...current, ...partial };
    set({ settings: merged });
    get().applyToDOM(merged);
    try {
      await settingsApi.update(merged);
    } catch { /* revert on error could be added */ }
  },

  applyToDOM: (s: UserSettings) => {
    const body = document.body;

    // Glass effect
    body.classList.toggle('no-glass', !s.glass_effect);

    // Gradient background
    body.classList.toggle('no-gradient', !s.gradient_bg);
    if (s.gradient_bg) {
      document.documentElement.style.setProperty('--gradient-1', s.gradient_color1);
      document.documentElement.style.setProperty('--gradient-2', s.gradient_color2);
      document.documentElement.style.setProperty('--gradient-3', s.gradient_color3);
    }

    // Animation speed
    body.classList.remove('animation-slow', 'animation-normal', 'animation-fast', 'animation-none');
    body.classList.add(`animation-${s.animation_speed}`);

    // Reduced motion
    body.classList.toggle('reduced-motion', s.reduced_motion);

    // High contrast
    body.classList.toggle('high-contrast', s.high_contrast);

    // Font size
    body.classList.remove('font-small', 'font-medium', 'font-large');
    body.classList.add(`font-${s.font_size}`);

    // Accent color
    document.documentElement.style.setProperty('--accent-color', s.accent_color);

    // Space theme
    body.classList.toggle('space-theme', s.color_scheme === 'space');

    // Custom CSS
    let styleEl = document.getElementById('raider-custom-css');
    if (s.custom_css) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'raider-custom-css';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = s.custom_css;
    } else if (styleEl) {
      styleEl.remove();
    }
  },
}));
