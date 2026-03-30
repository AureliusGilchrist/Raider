import React, { useEffect, useState } from 'react';
import { GlassPanel } from '../../components/GlassPanel';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';
import { auth as authApi } from '../../lib/api';
import type { UserSettings } from '../../lib/types';
import { GENDER_OPTIONS_BASIC, GENDER_OPTIONS_ADVANCED, PRONOUN_OPTIONS, LANGUAGE_OPTIONS } from '../../lib/types';
import {
  User, Shield, Palette, Bell, Eye, Monitor, Save,
} from 'lucide-react';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-300">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-all-custom relative ${checked ? 'bg-indigo-500' : 'bg-gray-600'}`}
      >
        <div
          className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all-custom"
          style={{ left: checked ? '22px' : '2px' }}
        />
      </button>
    </div>
  );
}

export function SettingsPage() {
  const { settings, fetch: fetchSettings, update } = useSettingsStore();
  const { user, setUser } = useAuthStore();
  const [tab, setTab] = useState('profile');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [genderCustom, setGenderCustom] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [advancedMode, setAdvancedMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setBio(user.bio || '');
      setGender(user.gender || '');
      setGenderCustom(user.gender_custom || '');
      setPronouns(user.pronouns || '');
      setAdvancedMode(user.advanced_mode || false);
    }
  }, [user]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updated = await authApi.updateProfile({
        display_name: displayName, bio, gender,
        gender_custom: genderCustom, pronouns, advanced_mode: advancedMode,
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
                onClick={() => setTab(t.id)}
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
                {gender === 'Custom' && (
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Custom Gender</label>
                    <input type="text" value={genderCustom} onChange={(e) => setGenderCustom(e.target.value)} className="w-full" />
                  </div>
                )}
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Pronouns</label>
                  <select value={pronouns} onChange={(e) => setPronouns(e.target.value)} className="w-full">
                    <option value="">Select...</option>
                    {PRONOUN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
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
            </GlassPanel>
          )}

          {/* Notifications Tab */}
          {tab === 'notifications' && settings && (
            <GlassPanel className="p-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Bell size={18} /> Notifications</h2>
              <Toggle checked={settings.notification_dms} onChange={(v) => update({ notification_dms: v })} label="DM notifications" />
              <Toggle checked={settings.notification_servers} onChange={(v) => update({ notification_servers: v })} label="Server notifications" />
              <Toggle checked={settings.notification_calls} onChange={(v) => update({ notification_calls: v })} label="Call notifications" />
              <Toggle checked={settings.notification_sounds} onChange={(v) => update({ notification_sounds: v })} label="Notification sounds" />
              <div className="mt-4">
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
            </GlassPanel>
          )}

          {/* Security Tab */}
          {tab === 'security' && settings && (
            <GlassPanel className="p-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Shield size={18} /> Security</h2>
              <Toggle checked={settings.two_factor_enabled} onChange={(v) => update({ two_factor_enabled: v })} label="Two-factor authentication" />
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
