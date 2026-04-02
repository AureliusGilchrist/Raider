import { create } from 'zustand';
import { settings as settingsApi } from '../lib/api';
import type { UserSettings } from '../lib/types';

const THEME_TEXT_COLORS: Record<string, [string, string, string, string]> = {
  default: ['#f5f5ff', '#d7d8f5', '#b2b6d8', '#8b93b6'],
  sunset: ['#fff0df', '#f6ceb4', '#dfad93', '#b57f64'],
  midnight: ['#eef3ff', '#c9d5ff', '#95a7eb', '#6677b8'],
  neon: ['#e9fff4', '#b7fdd1', '#67d9a6', '#46a98c'],
  space: ['#eef3ff', '#ced9ff', '#a0b3ee', '#6d7fb9'],
  ocean: ['#eefcff', '#bcecff', '#78cde5', '#4d8fab'],
  deep_sea: ['#d8f4ff', '#94daff', '#5fb2d2', '#3f738f'],
  aurora: ['#f5fff9', '#ccffef', '#91e8de', '#6aa5ad'],
  matrix: ['#d7ffd8', '#9cf4a7', '#63d57e', '#3d8f59'],
  sakura: ['#fff4fb', '#ffd0e4', '#e79dbf', '#a56b87'],
  firefly: ['#efffea', '#c8e8b0', '#8dbd6a', '#5f8a45'],
  cyberpunk: ['#e0fffc', '#a8fff0', '#60d4c8', '#38a095'],
  snowfall: ['#f0f5ff', '#c8d8f0', '#8fa8d0', '#6080a8'],
  retrowave: ['#ffecf5', '#ffc0dd', '#e080b0', '#b05888'],
  thunderstorm: ['#e8f0ff', '#b8d0f0', '#80a0d0', '#5878a8'],
  enchanted: ['#f0e8ff', '#d0b8f0', '#a080d0', '#7858a8'],
  custom_special: ['#f6f7ff', '#dcdff3', '#acb3d7', '#7985ad'],
  light_lavender: ['#2d2350', '#4a3b7a', '#6b5a9e', '#8e7fba'],
  light_peach: ['#4a2520', '#7a3d30', '#a05540', '#bf7560'],
  light_mint: ['#1a3a2a', '#2d5a42', '#3f7a5a', '#5a9a75'],
  light_sky: ['#1a2a4a', '#2d4070', '#3f5a96', '#5a78b5'],
  light_sunrise: ['#4a2010', '#7a3820', '#a05030', '#c06a40'],
  light_garden: ['#1a3a1a', '#2d5a2d', '#3f7a3f', '#5a9a5a'],
  light_cloud: ['#2a2a3a', '#40405a', '#5a5a7a', '#75759a'],
  light_blossom: ['#4a1a30', '#7a2d50', '#a03f6a', '#c05a85'],
  light_ocean: ['#103040', '#1a4a5a', '#2a6575', '#3a8090'],
  light_honey: ['#3a2a10', '#5a4020', '#7a5a30', '#9a7540'],
};

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
    const root = document.documentElement;

    // Glass effect
    body.classList.toggle('no-glass', !s.glass_effect);

    // Gradient background
    body.classList.toggle('no-gradient', !s.gradient_bg);
    if (s.gradient_bg) {
      root.style.setProperty('--gradient-1', s.gradient_color1);
      root.style.setProperty('--gradient-2', s.gradient_color2);
      root.style.setProperty('--gradient-3', s.gradient_color3);
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
    root.style.setProperty('--accent-color', s.accent_color);
    const hexRgb = (h: string) => {
      const c = h.replace('#', '');
      return `${parseInt(c.slice(0,2),16)}, ${parseInt(c.slice(2,4),16)}, ${parseInt(c.slice(4,6),16)}`;
    };
    root.style.setProperty('--accent-rgb', hexRgb(s.accent_color));
    // Compute lighter hover variant from accent
    const ac = s.accent_color.replace('#', '');
    const lighten = (v: number) => Math.min(255, v + 40);
    root.style.setProperty('--accent-hover', `#${[0,2,4].map(i => lighten(parseInt(ac.slice(i,i+2),16)).toString(16).padStart(2,'0')).join('')}`);

    const customThemeRaw = localStorage.getItem('raider_custom_theme');
    let customTheme: any = null;
    try {
      customTheme = customThemeRaw ? JSON.parse(customThemeRaw) : null;
    } catch {
      customTheme = null;
    }
    const textColors = s.color_scheme === 'custom_special' && Array.isArray(customTheme?.textColors)
      ? customTheme.textColors
      : THEME_TEXT_COLORS[s.color_scheme] || THEME_TEXT_COLORS.default;

    root.style.setProperty('--theme-text-1', textColors[0]);
    root.style.setProperty('--theme-text-2', textColors[1]);
    root.style.setProperty('--theme-text-3', textColors[2]);
    root.style.setProperty('--theme-text-4', textColors[3]);
    root.style.setProperty('--theme-text-1-rgb', hexRgb(textColors[0]));
    root.style.setProperty('--theme-text-2-rgb', hexRgb(textColors[1]));

    if (customTheme?.backgroundUrl) {
      root.style.setProperty('--custom-theme-image', `url(${customTheme.backgroundUrl})`);
    } else {
      root.style.removeProperty('--custom-theme-image');
    }
    root.style.setProperty('--custom-theme-overlay', String(customTheme?.overlay ?? 0.26));

    // Animated themes
    const animatedThemes = ['space', 'ocean', 'aurora', 'matrix', 'sakura', 'deep_sea', 'firefly', 'cyberpunk', 'snowfall', 'retrowave', 'thunderstorm', 'enchanted', 'neon', 'sunset', 'midnight', 'custom_special', 'light_lavender', 'light_peach', 'light_mint', 'light_sky', 'light_sunrise', 'light_garden', 'light_cloud', 'light_blossom', 'light_ocean', 'light_honey'];
    animatedThemes.forEach(t => body.classList.remove(`${t}-theme`));
    if (animatedThemes.includes(s.color_scheme)) {
      body.classList.add(`${s.color_scheme}-theme`);
    }

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
