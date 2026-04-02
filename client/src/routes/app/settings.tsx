import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { GlassPanel } from '../../components/GlassPanel';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';
import { auth as authApi, twofa as twofaApi, uploads } from '../../lib/api';
import type { UserSettings } from '../../lib/types';
import { LANGUAGE_OPTIONS } from '../../lib/types';
import {
  User, Shield, Palette, Bell, Eye, Monitor, Save, X, Headphones, Settings2, Download, Share2,
} from 'lucide-react';

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-start justify-between py-3.5 gap-4">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-300 block">{label}</span>
        {description && <span className="text-xs text-gray-500 mt-0.5 block">{description}</span>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-all-custom relative shrink-0 mt-0.5 ${checked ? 'bg-indigo-500' : 'bg-gray-600'}`}
      >
        <div
          className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all-custom"
          style={{ left: checked ? '22px' : '2px' }}
        />
      </button>
    </div>
  );
}

const DARK_BASIC_SCHEMES = [
  { id: 'default',  name: 'Void Indigo',  colors: ['#0d0c2e', '#1a0e45', '#130530'] },
  { id: 'sunset',   name: 'Ember Dusk',   colors: ['#1c0500', '#280800', '#1a0400'] },
  { id: 'midnight', name: 'Abyssal Night', colors: ['#050418', '#080730', '#06051f'] },
  { id: 'neon',     name: 'Toxic Glow',     colors: ['#010a04', '#001a08', '#000d10'] },
] as const;

const DARK_SPECIAL_SCHEMES = [
  { id: 'space',      name: '🚀 Space',      colors: ['#0b0d21', '#1a0a2e', '#0d1b3e'] },
  { id: 'ocean',      name: '🌊 Ocean',      colors: ['#0a192f', '#006994', '#004d7a'] },
  { id: 'deep_sea',   name: '🦑 Deep Sea',   colors: ['#010a14', '#002040', '#003060'] },
  { id: 'aurora',     name: '🌌 Aurora',     colors: ['#0a0a1a', '#00ff80', '#00c8ff'] },
  { id: 'matrix',     name: '💻 Matrix',     colors: ['#0a0a0a', '#005000', '#00ff00'] },
  { id: 'sakura',     name: '🌸 Sakura',     colors: ['#1a0f1f', '#ffb6c1', '#ff69b4'] },
  { id: 'firefly',    name: '🪲 Firefly',    colors: ['#0a0f08', '#1a2510', '#0d1a08'] },
  { id: 'cyberpunk',  name: '🌆 Cyberpunk',  colors: ['#0a0012', '#1a0030', '#050018'] },
  { id: 'snowfall',   name: '❄️ Snowfall',   colors: ['#0e1525', '#1a2540', '#151e35'] },
  { id: 'retrowave',  name: '🌇 Retrowave',  colors: ['#0a0020', '#200040', '#0f0028'] },
  { id: 'thunderstorm', name: '⛈️ Thunderstorm', colors: ['#06080f', '#0c1020', '#0a0e1a'] },
  { id: 'enchanted',    name: '🔮 Enchanted',    colors: ['#060214', '#0a0520', '#04100c'] },
  { id: 'custom_special', name: '🎞️ Custom Special', colors: ['#10131f', '#18233d', '#111726'] },
] as const;

const LIGHT_BASIC_SCHEMES = [
  { id: 'light_lavender', name: 'Lavender Mist', colors: ['#d0cff5', '#e8d5f5', '#f0d5eb'] },
  { id: 'light_peach', name: 'Peach Cream', colors: ['#fde8d0', '#fad5c0', '#f5c8b0'] },
  { id: 'light_mint', name: 'Mint Frost', colors: ['#c8f0e0', '#d0ece5', '#b8e8d8'] },
  { id: 'light_sky', name: 'Sky Wash', colors: ['#c5ddf0', '#d0e4f8', '#c0d8f5'] },
] as const;

const LIGHT_SPECIAL_SCHEMES = [
  { id: 'light_sunrise', name: '🌅 Sunrise', colors: ['#fff5e0', '#ffe0c0', '#ffd0a0'] },
  { id: 'light_garden', name: '🌿 Garden', colors: ['#e8f5e0', '#d0ecc0', '#c0e8a8'] },
  { id: 'light_cloud', name: '☁️ Cloud', colors: ['#eef0f8', '#e0e4f0', '#d5daea'] },
  { id: 'light_blossom', name: '🌺 Blossom', colors: ['#fce8f0', '#f8d0e0', '#f0c0d5'] },
  { id: 'light_ocean', name: '🏖️ Coast', colors: ['#e0f4f8', '#c8ecf5', '#b0e0f0'] },
  { id: 'light_honey', name: '🍯 Honey', colors: ['#fdf0d0', '#fae8b8', '#f5e0a0'] },
] as const;

const BASIC_SCHEMES = DARK_BASIC_SCHEMES;
const SPECIAL_SCHEMES = DARK_SPECIAL_SCHEMES;

const COLOR_SCHEMES = [...DARK_BASIC_SCHEMES, ...DARK_SPECIAL_SCHEMES, ...LIGHT_BASIC_SCHEMES, ...LIGHT_SPECIAL_SCHEMES];

type CustomThemeConfig = {
  backgroundUrl: string;
  backgroundType: 'image' | 'video';
  overlay: number;
  textColors: [string, string, string, string];
};

const DEFAULT_CUSTOM_THEME: CustomThemeConfig = {
  backgroundUrl: '',
  backgroundType: 'image',
  overlay: 0.26,
  textColors: ['#f6f7ff', '#dcdff3', '#acb3d7', '#7985ad'],
};

function readCustomThemeConfig(): CustomThemeConfig {
  try {
    return { ...DEFAULT_CUSTOM_THEME, ...(JSON.parse(localStorage.getItem('raider_custom_theme') || '{}')) };
  } catch {
    return DEFAULT_CUSTOM_THEME;
  }
}

function AudioSettings() {
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedOutput, setSelectedOutput] = useState(localStorage.getItem('raider_audio_output') || 'default');
  const [selectedInput, setSelectedInput] = useState(localStorage.getItem('raider_audio_input') || 'default');
  const [masterVolume, setMasterVolume] = useState(Number(localStorage.getItem('raider_audio_volume') || '100'));
  const [micVolume, setMicVolume] = useState(Number(localStorage.getItem('raider_mic_volume') || '100'));
  const [noiseSuppression, setNoiseSuppression] = useState(localStorage.getItem('raider_noise_suppression') !== 'false');
  const [echoCancellation, setEchoCancellation] = useState(localStorage.getItem('raider_echo_cancellation') !== 'false');
  const [autoGainControl, setAutoGainControl] = useState(localStorage.getItem('raider_auto_gain') !== 'false');
  const [hearMyself, setHearMyself] = useState(localStorage.getItem('raider_hear_myself') === 'true');
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const hearMyselfCtxRef = useRef<AudioContext | null>(null);
  const hearMyselfStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    async function loadDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
        const devices = await navigator.mediaDevices.enumerateDevices();
        setOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
        setInputDevices(devices.filter(d => d.kind === 'audioinput'));
      } catch { /* permission denied */ }
    }
    loadDevices();
    return () => {
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animFrameRef.current);
      hearMyselfCtxRef.current?.close();
      hearMyselfStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const saveSetting = (key: string, value: string) => localStorage.setItem(key, value);

  const toggleHearMyself = async () => {
    if (hearMyself) {
      hearMyselfCtxRef.current?.close();
      hearMyselfCtxRef.current = null;
      hearMyselfStreamRef.current?.getTracks().forEach(t => t.stop());
      hearMyselfStreamRef.current = null;
      setHearMyself(false);
      saveSetting('raider_hear_myself', 'false');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedInput !== 'default' ? { exact: selectedInput } : undefined,
          noiseSuppression,
          echoCancellation,
          autoGainControl,
        },
      });
      hearMyselfStreamRef.current = stream;
      const ctx = new AudioContext();
      hearMyselfCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(ctx.destination);
      setHearMyself(true);
      saveSetting('raider_hear_myself', 'true');
    } catch { /* mic access denied */ }
  };

  const toggleMicTest = async () => {
    if (micTesting) {
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
      cancelAnimationFrame(animFrameRef.current);
      setMicLevel(0);
      setMicTesting(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedInput !== 'default' ? { exact: selectedInput } : undefined,
          noiseSuppression,
          echoCancellation,
          autoGainControl,
        },
      });
      micStreamRef.current = stream;
      setMicTesting(true);
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setMicLevel(Math.min(100, (avg / 128) * 100));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* mic access denied */ }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm text-gray-400 mb-1 block">Output Device (Speakers)</label>
        <select
          value={selectedOutput}
          onChange={(e) => { setSelectedOutput(e.target.value); saveSetting('raider_audio_output', e.target.value); }}
          className="w-full"
        >
          <option value="default">System Default</option>
          {outputDevices.map(d => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0, 8)}`}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm text-gray-400 mb-1 block">Input Device (Microphone)</label>
        <select
          value={selectedInput}
          onChange={(e) => { setSelectedInput(e.target.value); saveSetting('raider_audio_input', e.target.value); }}
          className="w-full"
        >
          <option value="default">System Default</option>
          {inputDevices.map(d => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 8)}`}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm text-gray-400 mb-1 block">Master Volume: {masterVolume}%</label>
        <input type="range" min={0} max={100} value={masterVolume} onChange={(e) => { const v = Number(e.target.value); setMasterVolume(v); saveSetting('raider_audio_volume', String(v)); }} className="w-full accent-indigo-500" />
      </div>
      <div>
        <label className="text-sm text-gray-400 mb-1 block">Microphone Volume: {micVolume}%</label>
        <input type="range" min={0} max={100} value={micVolume} onChange={(e) => { const v = Number(e.target.value); setMicVolume(v); saveSetting('raider_mic_volume', String(v)); }} className="w-full accent-indigo-500" />
      </div>
      <div className="border-t border-white/10 pt-4 space-y-1">
        <Toggle checked={noiseSuppression} onChange={(v) => { setNoiseSuppression(v); saveSetting('raider_noise_suppression', String(v)); }} label="Noise Suppression" />
        <Toggle checked={echoCancellation} onChange={(v) => { setEchoCancellation(v); saveSetting('raider_echo_cancellation', String(v)); }} label="Echo Cancellation" />
        <Toggle checked={autoGainControl} onChange={(v) => { setAutoGainControl(v); saveSetting('raider_auto_gain', String(v)); }} label="Auto Gain Control" />
        <Toggle checked={hearMyself} onChange={() => toggleHearMyself()} label="Hear Myself (Mic Monitoring)" />
      </div>
      <div className="border-t border-white/10 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-300">Microphone Test</span>
          <button onClick={toggleMicTest} className={`btn text-sm px-4 py-1.5 ${micTesting ? 'btn-danger' : 'btn-primary'}`}>
            {micTesting ? 'Stop Test' : 'Test Mic'}
          </button>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${micLevel}%`,
              background: micLevel > 80 ? '#ef4444' : micLevel > 50 ? '#f59e0b' : '#22c55e',
            }}
          />
        </div>
        {micTesting && <p className="text-xs text-gray-500 mt-1">Speak into your microphone to test the input level.</p>}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { settings, fetch: fetchSettings, update } = useSettingsStore();
  const { user, setUser } = useAuthStore();
  const { tab: urlTab } = useParams({ strict: false }) as { tab?: string };
  const tab = urlTab ?? 'profile';
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [sexuality, setSexuality] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [advancedMode, setAdvancedMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [languages, setLanguages] = useState<string[]>([]);
  const [twoFASetup, setTwoFASetup] = useState<{ secret: string; url: string } | null>(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFADisableCode, setTwoFADisableCode] = useState('');
  const [twoFAError, setTwoFAError] = useState('');
  const [lightMode, setLightMode] = useState(() => localStorage.getItem('raider_light_mode') === 'true');
  const [themeTools, setThemeTools] = useState<'custom_special' | null>(null);
  const [customTheme, setCustomTheme] = useState<CustomThemeConfig>(() => readCustomThemeConfig());
  const [chatbarEffect, setChatbarEffect] = useState(() => localStorage.getItem('raider_chatbar_effect') || 'none');

  // Creative appearance options
  const [messageDensity, setMessageDensity] = useState(() => localStorage.getItem('raider_msg_density') || 'default');
  const [chatBubbleStyle, setChatBubbleStyle] = useState(() => localStorage.getItem('raider_bubble_style') || 'flat');
  const [uiRoundness, setUiRoundness] = useState(() => localStorage.getItem('raider_ui_roundness') || 'default');
  const [avatarShape, setAvatarShape] = useState(() => localStorage.getItem('raider_avatar_shape') || 'circle');
  const [scrollbarStyle, setScrollbarStyle] = useState(() => localStorage.getItem('raider_scrollbar') || 'default');
  const [panelOpacity, setPanelOpacity] = useState(() => Number(localStorage.getItem('raider_panel_opacity') || '15'));
  const [textGlow, setTextGlow] = useState(() => localStorage.getItem('raider_text_glow') || 'none');
  const [hoverEffect, setHoverEffect] = useState(() => localStorage.getItem('raider_hover_effect') || 'none');
  const [nameHighlight, setNameHighlight] = useState(() => localStorage.getItem('raider_name_highlight') || 'none');
  const [buttonStyle, setButtonStyle] = useState(() => localStorage.getItem('raider_button_style') || 'default');
  const [notifBadge, setNotifBadge] = useState(() => localStorage.getItem('raider_notif_badge') || 'count');
  const [timestampDisplay, setTimestampDisplay] = useState(() => localStorage.getItem('raider_timestamp') || 'full');
  const [glassBlur, setGlassBlur] = useState(() => Number(localStorage.getItem('raider_glass_blur') || '35'));
  const [sidebarWidth, setSidebarWidth] = useState(() => localStorage.getItem('raider_sidebar_width') || 'default');
  const [chatWidth, setChatWidth] = useState(() => localStorage.getItem('raider_chat_width') || 'default');
  const [cursorStyle, setCursorStyle] = useState(() => localStorage.getItem('raider_cursor_style') || 'default');
  const [sendBtnStyle, setSendBtnStyle] = useState(() => localStorage.getItem('raider_send_btn') || 'default');
  const [dividerStyle, setDividerStyle] = useState(() => localStorage.getItem('raider_divider_style') || 'default');

  const toggleLightMode = (v: boolean) => {
    setLightMode(v);
    localStorage.setItem('raider_light_mode', String(v));
    document.body.classList.toggle('light-mode', v);
  };

  // Apply light mode on mount
  useEffect(() => {
    document.body.classList.toggle('light-mode', lightMode);
  }, []);

  // Apply creative appearance options to DOM
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // Roundness
    const roundMap: Record<string, string> = { sharp: '0px', soft: '6px', default: '12px', round: '20px', pill: '999px' };
    root.style.setProperty('--ui-roundness', roundMap[uiRoundness] || '12px');

    // Panel opacity
    root.style.setProperty('--panel-opacity', String(panelOpacity / 100));

    // Glass blur
    root.style.setProperty('--glass-blur', `${glassBlur}px`);

    // Message density
    const densityMap: Record<string, string> = { compact: '2px', default: '8px', cozy: '14px' };
    root.style.setProperty('--msg-density', densityMap[messageDensity] || '8px');

    // Sidebar width
    const sidebarMap: Record<string, string> = { narrow: '220px', default: '280px', wide: '340px' };
    root.style.setProperty('--sidebar-width', sidebarMap[sidebarWidth] || '280px');

    // Chat width
    const chatMap: Record<string, string> = { narrow: '640px', default: '860px', wide: '1100px', full: '100%' };
    root.style.setProperty('--chat-width', chatMap[chatWidth] || '860px');

    // Apply class-based styles
    const classMap: Record<string, [string, string]> = {
      bubble: ['raider-bubble-', chatBubbleStyle],
      avatar: ['raider-avatar-', avatarShape],
      scrollbar: ['raider-scrollbar-', scrollbarStyle],
      glow: ['raider-glow-', textGlow],
      hover: ['raider-hover-', hoverEffect],
      name: ['raider-name-', nameHighlight],
      btn: ['raider-btn-', buttonStyle],
      badge: ['raider-badge-', notifBadge],
      timestamp: ['raider-ts-', timestampDisplay],
      density: ['raider-density-', messageDensity],
      cursor: ['raider-cursor-', cursorStyle],
      send: ['raider-send-', sendBtnStyle],
      divider: ['raider-divider-', dividerStyle],
    };

    for (const [prefix, [cls, val]] of Object.entries(classMap)) {
      body.className = body.className.replace(new RegExp(`raider-${prefix}-\\S+`, 'g'), '').trim();
      if (val !== 'default' && val !== 'none' && val !== 'flat' && val !== 'circle' && val !== 'count' && val !== 'full') {
        body.classList.add(`${cls}${val}`);
      }
    }
  }, [uiRoundness, panelOpacity, glassBlur, messageDensity, sidebarWidth, chatWidth,
      chatBubbleStyle, avatarShape, scrollbarStyle, textGlow, hoverEffect, nameHighlight,
      buttonStyle, notifBadge, timestampDisplay, cursorStyle, sendBtnStyle, dividerStyle]);

  useEffect(() => { fetchSettings(); }, []);

  const formLoadedRef = useRef(false);
  useEffect(() => {
    if (user && !formLoadedRef.current) {
      formLoadedRef.current = true;
      setDisplayName(user.display_name || '');
      setUsername(user.username || '');
      setBio(user.bio || '');
      setGender(user.gender || '');
      setSexuality(user.sexuality || '');
      setPronouns(user.pronouns || '');
      setAdvancedMode(user.advanced_mode || false);
      try { setLanguages(JSON.parse(user.languages || '[]')); } catch { setLanguages([]); }
    }
  }, [user]);

  const saveProfile = async () => {
    setSaving(true);
    setUsernameError('');
    try {
      const payload: Record<string, any> = {
        display_name: displayName, bio, gender, username,
        gender_custom: '', sexuality, pronouns, advanced_mode: advancedMode,
        languages: JSON.stringify(languages),
      };
      const updated = await authApi.updateProfile(payload);
      setUser(updated);
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('taken')) setUsernameError('Username is already taken');
      else if (msg.includes('Username')) setUsernameError(msg);
    }
    setSaving(false);
  };

  const refreshThemeDOM = () => {
    const current = useSettingsStore.getState().settings;
    if (current) useSettingsStore.getState().applyToDOM(current);
  };

  const saveCustomTheme = () => {
    localStorage.setItem('raider_custom_theme', JSON.stringify(customTheme));
    window.dispatchEvent(new Event('raider-custom-theme-updated'));
    refreshThemeDOM();
    setThemeTools(null);
  };

  const exportCustomTheme = () => {
    const blob = new Blob([JSON.stringify(customTheme, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'raider-custom-theme.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareCustomTheme = () => {
    const current = JSON.parse(localStorage.getItem('raider_theme_shop_customs') || '[]');
    current.unshift({
      id: String(Date.now()),
      name: `${user?.display_name || user?.username || 'Custom'} Theme`,
      config: customTheme,
    });
    localStorage.setItem('raider_theme_shop_customs', JSON.stringify(current.slice(0, 24)));
    window.dispatchEvent(new Event('raider-theme-shop-updated'));
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User size={16} /> },
    { id: 'privacy', label: 'Privacy', icon: <Eye size={16} /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    { id: 'audio', label: 'Audio', icon: <Headphones size={16} /> },
    { id: 'security', label: 'Security', icon: <Shield size={16} /> },
    { id: 'advanced', label: 'Advanced', icon: <Monitor size={16} /> },
  ];
  return (
    <div className="flex h-full">
      <div className="w-56 shrink-0 glass border-r border-white/10 flex flex-col">
        <h1 className="text-xl font-bold text-white px-5 pt-6 pb-4">Settings</h1>
        <div className="flex flex-col gap-1 px-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate({ to: '/app/settings/$tab', params: { tab: t.id } })}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all-custom ${
                tab === t.id ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className={tab === t.id ? 'settings-tab-icon-active' : 'settings-tab-icon'}>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
          {/* Profile Tab */}
          {tab === 'profile' && (
            <GlassPanel className="p-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><User size={18} /> Profile</h2>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Display Name</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">@ Handle</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value.replace(/[^a-zA-Z0-9_.]/g, '')); setUsernameError(''); }}
                      className="w-full !pl-7"
                      maxLength={30}
                    />
                  </div>
                  {usernameError && <p className="text-xs text-red-400 mt-1">{usernameError}</p>}
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Bio</label>
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Gender</label>
                  <input
                    type="text"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full"
                    placeholder="Describe your gender however you want"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Sexuality</label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={sexuality}
                    onChange={(e) => setSexuality(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Pronouns</label>
                  <input
                    type="text"
                    value={pronouns}
                    onChange={(e) => setPronouns(e.target.value)}
                    placeholder="e.g. he/him, she/her, they/them"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Languages</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {languages.map((lang) => (
                      <span key={lang} className="flex items-center gap-1 bg-indigo-500/20 text-indigo-300 text-xs px-2 py-1 rounded-full">
                        {lang}
                        <button onClick={() => setLanguages(languages.filter(l => l !== lang))} className="hover:text-white">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Type languages, comma-separated (e.g. English, French)…"
                    className="w-full mb-2"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        const val = (e.target as HTMLInputElement).value.replace(/,$/, '').trim();
                        if (val && !languages.includes(val)) setLanguages([...languages, val]);
                        (e.target as HTMLInputElement).value = '';
                        e.preventDefault();
                      }
                    }}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (!val) return;
                      const typed = val.split(',').map(l => l.trim()).filter(Boolean);
                      const toAdd = typed.filter(l => !languages.includes(l));
                      if (toAdd.length) setLanguages([...languages, ...toAdd]);
                      e.target.value = '';
                    }}
                  />
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !languages.includes(e.target.value)) {
                        setLanguages([...languages, e.target.value]);
                      }
                    }}
                    className="w-full"
                  >
                    <option value="">Or pick from list…</option>
                    {LANGUAGE_OPTIONS.filter(l => !languages.includes(l)).map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <button onClick={saveProfile} disabled={saving} className="btn btn-primary self-end">
                  <Save size={14} /> {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </GlassPanel>
          )}

          {/* Privacy Tab */}
          {tab === 'privacy' && settings && (
            <GlassPanel className="p-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Eye size={18} /> Privacy</h2>
              <Toggle checked={settings.show_gender} onChange={(v) => update({ show_gender: v })} label="Show gender on profile" />
              <Toggle checked={settings.show_pronouns} onChange={(v) => update({ show_pronouns: v })} label="Show pronouns on profile" />
              <Toggle checked={settings.show_languages} onChange={(v) => update({ show_languages: v })} label="Show languages on profile" />
              <Toggle checked={settings.show_bio} onChange={(v) => update({ show_bio: v })} label="Show bio on profile" />
              <Toggle checked={settings.show_level} onChange={(v) => update({ show_level: v })} label="Show level & XP on profile" />
              <Toggle checked={settings.show_banner} onChange={(v) => update({ show_banner: v })} label="Show banner on profile" />
              <Toggle checked={settings.show_servers} onChange={(v) => update({ show_servers: v })} label="Show servers on profile" />
              <Toggle checked={settings.show_stats} onChange={(v) => update({ show_stats: v })} label="Show stats on profile" />
              <Toggle checked={settings.show_online_status} onChange={(v) => update({ show_online_status: v })} label="Show online status" />
              <Toggle checked={settings.show_in_search} onChange={(v) => update({ show_in_search: v })} label="Show in search results" />
            </GlassPanel>
          )}

          {/* Appearance Tab */}
          {tab === 'appearance' && settings && (
            <GlassPanel className="p-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Palette size={18} /> Appearance</h2>
              <Toggle checked={lightMode} onChange={toggleLightMode} label="Light mode" description="Switch to a lighter color scheme for the UI" />
              <div className="border-t border-white/10 my-3" />
              <Toggle checked={settings.glass_effect} onChange={(v) => update({ glass_effect: v })} label="Glass effect (blur)" />
              <Toggle checked={settings.gradient_bg} onChange={(v) => update({ gradient_bg: v })} label="Gradient background" />
              {settings.gradient_bg && (
                <div className="flex gap-3 my-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Color 1</label>
                    <input type="color" value={settings.gradient_color1} onChange={(e) => update({ gradient_color1: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Color 2</label>
                    <input type="color" value={settings.gradient_color2} onChange={(e) => update({ gradient_color2: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Color 3</label>
                    <input type="color" value={settings.gradient_color3} onChange={(e) => update({ gradient_color3: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
                  </div>
                </div>
              )}
              <div className="mt-3">
                <label className="text-sm text-gray-400 mb-1 block">Accent Color</label>
                <input type="color" value={settings.accent_color} onChange={(e) => update({ accent_color: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
              </div>
              <div className="mt-3">
                <label className="text-sm text-gray-400 mb-1 block">Animation Speed</label>
                <select value={settings.animation_speed} onChange={(e) => update({ animation_speed: e.target.value })} className="w-full">
                  <option value="none">None</option>
                  <option value="fast">Fast</option>
                  <option value="normal">Normal</option>
                  <option value="slow">Slow</option>
                </select>
              </div>
              <div className="mt-3">
                <label className="text-sm text-gray-400 mb-1 block">Font Size</label>
                <select value={settings.font_size} onChange={(e) => update({ font_size: e.target.value })} className="w-full">
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
              <div className="mt-3">
                <label className="text-sm text-gray-400 mb-1 block">Chat Bar Effect</label>
                <select value={chatbarEffect} onChange={(e) => {
                  setChatbarEffect(e.target.value);
                  localStorage.setItem('raider_chatbar_effect', e.target.value);
                }} className="w-full">
                  <option value="none">None</option>
                  <option value="shine">✨ Shine</option>
                  <option value="glow">💜 Glow</option>
                  <option value="pulse">💫 Pulse</option>
                  <option value="rainbow">🌈 Rainbow</option>
                  <option value="border-glow">🔮 Border Glow</option>
                </select>
              </div>
              <Toggle checked={settings.reduced_motion} onChange={(v) => update({ reduced_motion: v })} label="Reduced motion" />
              <Toggle checked={settings.high_contrast} onChange={(v) => update({ high_contrast: v })} label="High contrast" />
              <div className="mt-4">
                <label className="text-sm text-gray-400 mb-2 block">Color Scheme</label>

                {/* Basic presets */}
                <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1.5">{lightMode ? '☀️ Light Basic' : '🌑 Dark Basic'}</p>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {(lightMode ? LIGHT_BASIC_SCHEMES : DARK_BASIC_SCHEMES).map((scheme) => (
                    <button
                      key={scheme.id}
                      onClick={() => {
                        update({
                          color_scheme: scheme.id,
                          gradient_color1: scheme.colors[0],
                          gradient_color2: scheme.colors[1],
                          gradient_color3: scheme.colors[2],
                          accent_color: scheme.colors[0],
                        });
                      }}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all-custom ${
                        settings.color_scheme === scheme.id ? 'bg-white/20 ring-2 ring-white/40' : 'hover:bg-white/10'
                      }`}
                      title={scheme.name}
                    >
                      <div className="w-full h-8 rounded-lg overflow-hidden" style={{ background: `linear-gradient(135deg, ${scheme.colors[0]}, ${scheme.colors[1]}, ${scheme.colors[2]})` }}>
                        <div className="w-full h-full flex items-end justify-center" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)' }}>
                          <div className="flex gap-1 mb-1">
                            {scheme.colors.map((c, i) => (
                              <div key={i} className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ backgroundColor: c }} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 truncate w-full text-center mt-1">{scheme.name}</span>
                    </button>
                  ))}
                </div>

                {/* Animated special themes */}
                <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1.5">{lightMode ? '☀️ Light Special' : '✨ Dark Special'}</p>
                <div className="grid grid-cols-4 gap-2">
                  {(lightMode ? LIGHT_SPECIAL_SCHEMES : DARK_SPECIAL_SCHEMES).map((scheme) => (
                    <div key={scheme.id} className={`rounded-lg transition-all-custom ${settings.color_scheme === scheme.id ? 'bg-white/20 ring-2 ring-white/40' : 'hover:bg-white/10'}`}>
                      <button
                        onClick={() => {
                          update({
                            color_scheme: scheme.id,
                            gradient_color1: scheme.colors[0],
                            gradient_color2: scheme.colors[1],
                            gradient_color3: scheme.colors[2],
                            accent_color: scheme.colors[0],
                          });
                        }}
                        className="flex w-full flex-col items-center gap-1 p-2"
                        title={scheme.name}
                      >
                        <div className="w-full h-8 rounded-lg overflow-hidden" style={{ background: `linear-gradient(135deg, ${scheme.colors[0]}, ${scheme.colors[1]}, ${scheme.colors[2]})` }}>
                          <div className="w-full h-full flex items-end justify-center" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)' }}>
                            <div className="flex gap-1 mb-1">
                              {scheme.colors.map((c, i) => (
                                <div key={i} className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ backgroundColor: c }} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400 truncate w-full text-center mt-1">{scheme.name}</span>
                      </button>
                      {scheme.id === 'custom_special' && (
                        <button
                          onClick={() => setThemeTools('custom_special')}
                          className="mx-auto mb-2 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-gray-300 hover:bg-white/10"
                        >
                          <Settings2 size={11} /> Configure
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </GlassPanel>
          )}

          {themeTools === 'custom_special' && (
            <GlassPanel className="p-6 animate-fade-in mt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Custom Special Theme</h3>
                <button onClick={() => setThemeTools(null)} className="text-gray-500 hover:text-white"><X size={16} /></button>
              </div>
              <div className="space-y-4">
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-sm text-gray-400 mb-1 block">Background URL</label>
                    <input value={customTheme.backgroundUrl} onChange={(e) => setCustomTheme({ ...customTheme, backgroundUrl: e.target.value })} className="w-full" placeholder="Image or video URL" />
                  </div>
                  <label className="btn btn-glass cursor-pointer">
                    Upload
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const uploaded = await uploads.upload(file);
                        setCustomTheme({
                          ...customTheme,
                          backgroundUrl: uploaded.url,
                          backgroundType: file.type.startsWith('video/') ? 'video' : 'image',
                        });
                      }}
                    />
                  </label>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Background type</label>
                  <select value={customTheme.backgroundType} onChange={(e) => setCustomTheme({ ...customTheme, backgroundType: e.target.value as 'image' | 'video' })}>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Overlay strength</label>
                  <input type="range" min={0} max={0.7} step={0.01} value={customTheme.overlay} onChange={(e) => setCustomTheme({ ...customTheme, overlay: Number(e.target.value) })} className="w-full accent-indigo-500" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Text colors</label>
                  <div className="flex gap-3">
                    {customTheme.textColors.map((color, index) => (
                      <div key={index}>
                        <label className="text-xs text-gray-500 block mb-1">Text {index + 1}</label>
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => {
                            const next = [...customTheme.textColors] as CustomThemeConfig['textColors'];
                            next[index] = e.target.value;
                            setCustomTheme({ ...customTheme, textColors: next });
                          }}
                          className="w-10 h-10 rounded cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={saveCustomTheme} className="btn btn-primary"><Save size={14} /> Save</button>
                  <button onClick={exportCustomTheme} className="btn btn-glass"><Download size={14} /> Export</button>
                  <button onClick={shareCustomTheme} className="btn btn-glass"><Share2 size={14} /> Share to shop</button>
                </div>
              </div>
            </GlassPanel>
          )}

          {/* Notifications Tab */}
          {tab === 'notifications' && settings && (
            <GlassPanel className="p-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Bell size={18} /> Notifications</h2>

              <div className="mb-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Messages</h3>
                <Toggle checked={settings.notification_dms} onChange={(v) => update({ notification_dms: v })} label="Direct messages" description="Notify when someone sends you a DM" />
                <Toggle checked={settings.notification_group_messages ?? true} onChange={(v) => update({ notification_group_messages: v })} label="Group messages" description="Notify for new group chat messages" />
                <Toggle checked={settings.notification_servers} onChange={(v) => update({ notification_servers: v })} label="Server messages" description="Notify for server channel activity" />
                <Toggle checked={settings.notification_mentions ?? true} onChange={(v) => update({ notification_mentions: v })} label="Mentions" description="Notify when someone @mentions you" />
              </div>

              <div className="mb-5 border-t border-white/10 pt-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Social</h3>
                <Toggle checked={settings.notification_follows ?? true} onChange={(v) => update({ notification_follows: v })} label="New followers" description="Notify when someone follows you" />
                <Toggle checked={settings.notification_handshakes ?? true} onChange={(v) => update({ notification_handshakes: v })} label="Handshake requests" description="Notify when someone requests a handshake" />
                <Toggle checked={settings.notification_comments ?? true} onChange={(v) => update({ notification_comments: v })} label="Comments & replies" description="Notify when someone comments on your posts or replies to you" />
                <Toggle checked={settings.notification_post_votes ?? false} onChange={(v) => update({ notification_post_votes: v })} label="Post votes" description="Notify when someone votes on your posts" />
              </div>

              <div className="mb-5 border-t border-white/10 pt-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Calls</h3>
                <Toggle checked={settings.notification_calls} onChange={(v) => update({ notification_calls: v })} label="Incoming calls" description="Notify for incoming voice/video calls" />
              </div>

              <div className="border-t border-white/10 pt-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Sound</h3>
                <Toggle checked={settings.notification_sounds} onChange={(v) => update({ notification_sounds: v })} label="Notification sounds" description="Play a sound for notifications" />
                <div className="mt-3">
                  <label className="text-sm text-gray-400 mb-1 block">Ringtone</label>
                  <select
                    value={settings.ringtone || 'default'}
                    onChange={(e) => update({ ringtone: e.target.value })}
                    className="w-full"
                  >
                    <option value="default">Default</option>
                    <option value="gentle">Gentle</option>
                    <option value="classic">Classic</option>
                    <option value="pulse">Pulse</option>
                    <option value="chime">Chime</option>
                  </select>
                </div>
              </div>
            </GlassPanel>
          )}

          {/* Audio Tab */}
          {tab === 'audio' && (
            <GlassPanel className="p-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Headphones size={18} /> Audio Settings</h2>
              <AudioSettings />
            </GlassPanel>
          )}

          {/* Security Tab */}
          {tab === 'security' && settings && (
            <GlassPanel className="p-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Shield size={18} /> Security</h2>
              <div className="border-b border-white/10 pb-4 mb-4">
                <h3 className="text-sm font-medium text-white mb-2">Two-Factor Authentication (2FA)</h3>
                {settings.two_factor_enabled ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-sm text-green-400">2FA is enabled</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter 2FA code to disable"
                        value={twoFADisableCode}
                        onChange={(e) => setTwoFADisableCode(e.target.value)}
                        maxLength={6}
                        className="flex-1 text-sm"
                      />
                      <button
                        onClick={async () => {
                          try {
                            setTwoFAError('');
                            await twofaApi.disable(twoFADisableCode);
                            setTwoFADisableCode('');
                            fetchSettings();
                          } catch (err: any) {
                            setTwoFAError(err.message || 'Invalid code');
                          }
                        }}
                        className="btn btn-glass text-sm"
                      >
                        Disable
                      </button>
                    </div>
                    {twoFAError && <p className="text-xs text-red-400 mt-1">{twoFAError}</p>}
                  </div>
                ) : twoFASetup ? (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):</p>
                    <div className="bg-white p-3 rounded-lg inline-block mb-3">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(twoFASetup.url)}`}
                        alt="2FA QR Code"
                        className="w-[180px] h-[180px]"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mb-1">Or enter this secret manually:</p>
                    <code className="block bg-white/10 px-3 py-2 rounded text-xs text-indigo-300 font-mono mb-3 select-all break-all">
                      {twoFASetup.secret}
                    </code>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter 6-digit code"
                        value={twoFACode}
                        onChange={(e) => setTwoFACode(e.target.value)}
                        maxLength={6}
                        className="flex-1 text-sm"
                      />
                      <button
                        onClick={async () => {
                          try {
                            setTwoFAError('');
                            await twofaApi.verify(twoFACode);
                            setTwoFASetup(null);
                            setTwoFACode('');
                            fetchSettings();
                          } catch (err: any) {
                            setTwoFAError(err.message || 'Invalid code');
                          }
                        }}
                        className="btn btn-primary text-sm"
                      >
                        Verify
                      </button>
                    </div>
                    {twoFAError && <p className="text-xs text-red-400 mt-1">{twoFAError}</p>}
                    <button onClick={() => { setTwoFASetup(null); setTwoFACode(''); setTwoFAError(''); }} className="text-xs text-gray-500 hover:text-white mt-2">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Add an extra layer of security with a TOTP authenticator app.</p>
                    <button
                      onClick={async () => {
                        try {
                          const setup = await twofaApi.setup();
                          setTwoFASetup(setup);
                        } catch {}
                      }}
                      className="btn btn-primary text-sm"
                    >
                      <Shield size={14} /> Enable 2FA
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-3">
                <label className="text-sm text-gray-400 mb-1 block">Auto-lock (minutes, 0 = off)</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={settings.auto_lock_minutes}
                  onChange={(e) => update({ auto_lock_minutes: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div className="mt-4 p-3 bg-white/5 rounded-lg">
                <p className="text-xs text-gray-400">Your keys use <span className="text-indigo-300 font-bold">{user?.key_iterations || 128}</span> iterations of quantum-resistant encryption.</p>
              </div>
            </GlassPanel>
          )}

          {/* Advanced Tab */}
          {tab === 'advanced' && settings && (
            <GlassPanel className="p-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Monitor size={18} /> Advanced</h2>
              <Toggle checked={settings.advanced_ui} onChange={(v) => update({ advanced_ui: v })} label="Advanced UI mode" />
              <div className="mt-3">
                <label className="text-sm text-gray-400 mb-1 block">Custom CSS</label>
                <textarea
                  value={settings.custom_css}
                  onChange={(e) => update({ custom_css: e.target.value })}
                  rows={6}
                  className="w-full font-mono text-xs"
                  placeholder="/* Your custom styles */"
                />
              </div>
            </GlassPanel>
          )}
      </div>
    </div>
  );
}
