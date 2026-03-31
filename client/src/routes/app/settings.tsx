import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { GlassPanel } from '../../components/GlassPanel';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';
import { auth as authApi, twofa as twofaApi } from '../../lib/api';
import type { UserSettings } from '../../lib/types';
import { GENDER_OPTIONS_BASIC, GENDER_OPTIONS_ADVANCED, PRONOUN_OPTIONS, LANGUAGE_OPTIONS } from '../../lib/types';
import {
  User, Shield, Palette, Bell, Eye, Monitor, Save, X, Headphones,
} from 'lucide-react';

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-start justify-between py-2.5 gap-4">
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

const BASIC_SCHEMES = [
  { id: 'default',  name: 'Default',  colors: ['#0d0c2e', '#1a0e45', '#130530'] },
  { id: 'sunset',   name: 'Sunset',   colors: ['#1c0500', '#280800', '#1a0400'] },
  { id: 'midnight', name: 'Midnight', colors: ['#050418', '#080730', '#06051f'] },
  { id: 'neon',     name: 'Neon',     colors: ['#010a04', '#001a08', '#000d10'] },
] as const;

const SPECIAL_SCHEMES = [
  { id: 'space',      name: '🚀 Space',      colors: ['#0b0d21', '#1a0a2e', '#0d1b3e'] },
  { id: 'ocean',      name: '🌊 Ocean',      colors: ['#0a192f', '#006994', '#004d7a'] },
  { id: 'deep_sea',   name: '🦑 Deep Sea',   colors: ['#010a14', '#002040', '#003060'] },
  { id: 'aurora',     name: '🌌 Aurora',     colors: ['#0a0a1a', '#00ff80', '#00c8ff'] },
  { id: 'matrix',     name: '💻 Matrix',     colors: ['#0a0a0a', '#005000', '#00ff00'] },
  { id: 'sakura',     name: '🌸 Sakura',     colors: ['#1a0f1f', '#ffb6c1', '#ff69b4'] },
  { id: 'black_hole', name: '🕳️ Black Hole', colors: ['#000000', '#0a0005', '#050010'] },
] as const;

const COLOR_SCHEMES = [...BASIC_SCHEMES, ...SPECIAL_SCHEMES];

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
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [genderCustom, setGenderCustom] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [advancedMode, setAdvancedMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [languages, setLanguages] = useState<string[]>([]);
  const [twoFASetup, setTwoFASetup] = useState<{ secret: string; url: string } | null>(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFADisableCode, setTwoFADisableCode] = useState('');
  const [twoFAError, setTwoFAError] = useState('');
  const [lightMode, setLightMode] = useState(() => localStorage.getItem('raider_light_mode') === 'true');

  const toggleLightMode = (v: boolean) => {
    setLightMode(v);
    localStorage.setItem('raider_light_mode', String(v));
    document.body.classList.toggle('light-mode', v);
  };

  // Apply light mode on mount
  useEffect(() => {
    document.body.classList.toggle('light-mode', lightMode);
  }, []);

  useEffect(() => { fetchSettings(); }, []);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setBio(user.bio || '');
      setGender(user.gender || '');
      setGenderCustom(user.gender_custom || '');
      setPronouns(user.pronouns || '');
      setAdvancedMode(user.advanced_mode || false);
      try { setLanguages(JSON.parse(user.languages || '[]')); } catch { setLanguages([]); }
    }
  }, [user]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updated = await authApi.updateProfile({
        display_name: displayName, bio, gender,
        gender_custom: genderCustom, pronouns, advanced_mode: advancedMode,
        languages: JSON.stringify(languages),
      });
      setUser(updated);
    } catch {}
    setSaving(false);
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

  const genderOptions = advancedMode ? GENDER_OPTIONS_ADVANCED : GENDER_OPTIONS_BASIC;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      <div className="flex gap-6">
        <div className="w-48 shrink-0">
          <div className="flex flex-col gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate({ to: '/app/settings/$tab', params: { tab: t.id } })}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all-custom ${
                  tab === t.id ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
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
                  <label className="text-sm text-gray-400 mb-1 block">Bio</label>
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full" />
                </div>
                <Toggle checked={advancedMode} onChange={setAdvancedMode} label="Advanced gender options (LGBTQIA+)" />
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Gender</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full">
                    <option value="">Select...</option>
                    {genderOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Custom gender description</label>
                  <input
                    type="text"
                    placeholder="Describe your gender freely…"
                    value={genderCustom}
                    onChange={(e) => setGenderCustom(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Pronouns</label>
                  <select value={pronouns} onChange={(e) => setPronouns(e.target.value)} className="w-full">
                    <option value="">Select...</option>
                    {PRONOUN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
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
              <Toggle checked={settings.reduced_motion} onChange={(v) => update({ reduced_motion: v })} label="Reduced motion" />
              <Toggle checked={settings.high_contrast} onChange={(v) => update({ high_contrast: v })} label="High contrast" />
              <div className="mt-4">
                <label className="text-sm text-gray-400 mb-2 block">Color Scheme</label>

                {/* Basic presets */}
                <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1.5">Basic</p>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {BASIC_SCHEMES.map((scheme) => (
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
                      <div className="flex gap-0.5">
                        {scheme.colors.map((c, i) => (
                          <div key={i} className="w-4 h-4 rounded-full" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <span className="text-[10px] text-gray-400 truncate w-full text-center">{scheme.name}</span>
                    </button>
                  ))}
                </div>

                {/* Animated special themes */}
                <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1.5">✨ Special</p>
                <div className="grid grid-cols-4 gap-2">
                  {SPECIAL_SCHEMES.map((scheme) => (
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
                      <div className="flex gap-0.5">
                        {scheme.colors.map((c, i) => (
                          <div key={i} className="w-4 h-4 rounded-full" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <span className="text-[10px] text-gray-400 truncate w-full text-center">{scheme.name}</span>
                    </button>
                  ))}
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
    </div>
  );
}
