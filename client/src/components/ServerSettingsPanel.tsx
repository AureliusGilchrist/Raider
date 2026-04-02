import React, { useState, useEffect } from 'react';
import { X, Settings, Shield, Bell, Users, Eye, Hash, Volume2, MessageSquare, Sparkles, Save, Loader2, Gavel, List, Link2, Zap, SmilePlus } from 'lucide-react';
import { servers as serversApi } from '../lib/api';
import type { Channel, ServerSettings } from '../lib/types';

interface ServerSettingsPanelProps {
  serverId: string;
  onClose: () => void;
  onOpenRoleManager?: () => void;
}

type SettingsTab = 'overview' | 'moderation' | 'notifications' | 'community' | 'widget' | 'roles' | 'emoji' | 'audit_log' | 'bans' | 'invites' | 'safety';

const VERIFICATION_LEVELS = [
  { value: 0, label: 'None', description: 'Unrestricted' },
  { value: 1, label: 'Low', description: 'Must have a verified email' },
  { value: 2, label: 'Medium', description: 'Must be registered for longer than 5 minutes' },
  { value: 3, label: 'High', description: 'Must be a member of this server for longer than 10 minutes' },
  { value: 4, label: 'Highest', description: 'Must have a verified phone number' },
];

const EXPLICIT_CONTENT_FILTER_LEVELS = [
  { value: 0, label: 'Disabled', description: 'Do not scan any media content' },
  { value: 1, label: 'Members Without Roles', description: 'Scan media from members without a role' },
  { value: 2, label: 'All Members', description: 'Scan media from all members' },
];

const NOTIFICATION_LEVELS = [
  { value: 0, label: 'All Messages', description: 'Members will be notified for every message' },
  { value: 1, label: 'Only @Mentions', description: 'Members will only be notified when mentioned' },
  { value: 2, label: 'Nothing', description: 'Members will not receive any notifications' },
];

const AFK_TIMEOUT_OPTIONS = [
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
];

export function ServerSettingsPanel({ serverId, onClose, onOpenRoleManager }: ServerSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('overview');
  const [settings, setSettings] = useState<ServerSettings | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [bans, setBans] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [serverId]);

  const loadData = async () => {
    try {
      const [settingsData, channelsData] = await Promise.all([
        serversApi.getSettings(serverId),
        serversApi.channels(serverId),
      ]);
      setSettings(settingsData);
      setChannels(channelsData || []);
      // Load additional data (non-blocking)
      serversApi.auditLogs(serverId).then(setAuditLogs).catch(() => {});
      serversApi.bans(serverId).then(setBans).catch(() => {});
      serversApi.invites(serverId).then(setInvites).catch(() => {});
    } catch {
      setError('Failed to load server settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await serversApi.updateSettings(serverId, settings);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save settings. You may not have the Manage Server permission.');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof ServerSettings>(key: K, value: ServerSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setSaved(false);
  };

  const textChannels = channels.filter((c) => c.type === 'text');
  const voiceChannels = channels.filter((c) => c.type === 'voice');

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Settings size={16} /> },
    { id: 'moderation', label: 'Moderation', icon: <Shield size={16} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    { id: 'community', label: 'Community', icon: <Users size={16} /> },
    { id: 'widget', label: 'Widget', icon: <Eye size={16} /> },
    { id: 'roles', label: 'Roles', icon: <Shield size={16} /> },
    { id: 'emoji', label: 'Emoji', icon: <SmilePlus size={16} /> },
    { id: 'audit_log', label: 'Audit Log', icon: <List size={16} /> },
    { id: 'bans', label: 'Bans', icon: <Gavel size={16} /> },
    { id: 'invites', label: 'Invites', icon: <Link2 size={16} /> },
    { id: 'safety', label: 'Safety', icon: <Zap size={16} /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="glass rounded-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings size={20} /> Server Settings
          </h2>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-xs text-green-400 animate-fade-in">Settings saved!</span>
            )}
            {error && (
              <span className="text-xs text-red-400">{error}</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="btn btn-primary px-3 py-1.5 text-sm flex items-center gap-1.5"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
              <X size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar tabs */}
          <div className="w-44 border-r border-white/10 p-2 space-y-1 shrink-0 overflow-y-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-white/15 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="animate-spin text-gray-400" size={24} />
              </div>
            ) : !settings ? (
              <p className="text-gray-400 text-center">Failed to load settings</p>
            ) : (
              <>
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                        <Hash size={16} /> System Channel
                      </h3>
                      <p className="text-xs text-gray-500 mb-2">
                        The channel where system messages are sent (e.g., member join, boost events).
                      </p>
                      <select
                        value={settings.system_channel_id}
                        onChange={(e) => updateSetting('system_channel_id', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                      >
                        <option value="">No system channel</option>
                        {textChannels.map((ch) => (
                          <option key={ch.id} value={ch.id}># {ch.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                        <input
                          type="checkbox"
                          checked={!(settings.system_channel_flags & 1)}
                          onChange={(e) => {
                            const flags = e.target.checked
                              ? settings.system_channel_flags & ~1
                              : settings.system_channel_flags | 1;
                            updateSetting('system_channel_flags', flags);
                          }}
                          className="rounded bg-white/10 border-white/20"
                        />
                        Send a random welcome message when someone joins
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={!(settings.system_channel_flags & 2)}
                          onChange={(e) => {
                            const flags = e.target.checked
                              ? settings.system_channel_flags & ~2
                              : settings.system_channel_flags | 2;
                            updateSetting('system_channel_flags', flags);
                          }}
                          className="rounded bg-white/10 border-white/20"
                        />
                        Send a message when someone boosts this server
                      </label>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                        <Volume2 size={16} /> AFK Channel
                      </h3>
                      <p className="text-xs text-gray-500 mb-2">
                        Move members to this voice channel when they are idle.
                      </p>
                      <select
                        value={settings.afk_channel_id}
                        onChange={(e) => updateSetting('afk_channel_id', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white mb-3"
                      >
                        <option value="">No AFK channel</option>
                        {voiceChannels.map((ch) => (
                          <option key={ch.id} value={ch.id}>🔊 {ch.name}</option>
                        ))}
                      </select>

                      <h4 className="text-sm text-gray-300 mb-1">AFK Timeout</h4>
                      <select
                        value={settings.afk_timeout}
                        onChange={(e) => updateSetting('afk_timeout', parseInt(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                      >
                        {AFK_TIMEOUT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                        <Sparkles size={16} /> Server Branding
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">
                        Customize your server's appearance with banner and splash images.
                      </p>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Server Banner URL</label>
                          <input
                            type="text"
                            value={settings.banner_url}
                            onChange={(e) => updateSetting('banner_url', e.target.value)}
                            placeholder="https://example.com/banner.png"
                            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                          />
                          {settings.banner_url && (
                            <img src={settings.banner_url} alt="Banner preview" className="mt-2 rounded-lg max-h-24 object-cover w-full" />
                          )}
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Invite Splash URL</label>
                          <input
                            type="text"
                            value={settings.splash_url}
                            onChange={(e) => updateSetting('splash_url', e.target.value)}
                            placeholder="https://example.com/splash.png"
                            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Discovery Splash URL</label>
                          <input
                            type="text"
                            value={settings.discovery_splash_url}
                            onChange={(e) => updateSetting('discovery_splash_url', e.target.value)}
                            placeholder="https://example.com/discovery.png"
                            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'moderation' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                        <Shield size={16} /> Verification Level
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">
                        Set the criteria members must meet before they can send messages.
                      </p>
                      <div className="space-y-2">
                        {VERIFICATION_LEVELS.map((level) => (
                          <label
                            key={level.value}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                              settings.verification_level === level.value
                                ? 'border-indigo-500 bg-indigo-500/10'
                                : 'border-white/10 hover:border-white/20 bg-white/5'
                            }`}
                          >
                            <input
                              type="radio"
                              name="verification_level"
                              value={level.value}
                              checked={settings.verification_level === level.value}
                              onChange={() => updateSetting('verification_level', level.value)}
                              className="mt-0.5"
                            />
                            <div>
                              <span className="text-sm text-white font-medium">{level.label}</span>
                              <p className="text-xs text-gray-500">{level.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                        <Eye size={16} /> Explicit Content Filter
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">
                        Automatically scan and delete media containing explicit content.
                      </p>
                      <div className="space-y-2">
                        {EXPLICIT_CONTENT_FILTER_LEVELS.map((level) => (
                          <label
                            key={level.value}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                              settings.explicit_content_filter === level.value
                                ? 'border-indigo-500 bg-indigo-500/10'
                                : 'border-white/10 hover:border-white/20 bg-white/5'
                            }`}
                          >
                            <input
                              type="radio"
                              name="explicit_content_filter"
                              value={level.value}
                              checked={settings.explicit_content_filter === level.value}
                              onChange={() => updateSetting('explicit_content_filter', level.value)}
                              className="mt-0.5"
                            />
                            <div>
                              <span className="text-sm text-white font-medium">{level.label}</span>
                              <p className="text-xs text-gray-500">{level.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <h3 className="text-white font-semibold mb-1">2FA Requirement</h3>
                      <p className="text-xs text-gray-500 mb-2">
                        Require members with moderation powers to have two-factor authentication enabled.
                      </p>
                      <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={settings.mfa_level === 1}
                          onChange={(e) => updateSetting('mfa_level', e.target.checked ? 1 : 0)}
                          className="rounded bg-white/10 border-white/20"
                        />
                        Require 2FA for moderator actions
                      </label>
                    </div>
                  </div>
                )}

                {activeTab === 'notifications' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                        <Bell size={16} /> Default Notification Settings
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">
                        This sets the default notification level for all new members.
                      </p>
                      <div className="space-y-2">
                        {NOTIFICATION_LEVELS.map((level) => (
                          <label
                            key={level.value}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                              settings.default_message_notifications === level.value
                                ? 'border-indigo-500 bg-indigo-500/10'
                                : 'border-white/10 hover:border-white/20 bg-white/5'
                            }`}
                          >
                            <input
                              type="radio"
                              name="default_notifications"
                              value={level.value}
                              checked={settings.default_message_notifications === level.value}
                              onChange={() => updateSetting('default_message_notifications', level.value)}
                              className="mt-0.5"
                            />
                            <div>
                              <span className="text-sm text-white font-medium">{level.label}</span>
                              <p className="text-xs text-gray-500">{level.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'community' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                        <Sparkles size={16} /> Community Features
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">
                        Enable community features like a welcome screen, server discovery, and more.
                      </p>
                      <label className="flex items-center gap-2 text-sm text-gray-300 mb-4">
                        <input
                          type="checkbox"
                          checked={settings.community_enabled}
                          onChange={(e) => updateSetting('community_enabled', e.target.checked)}
                          className="rounded bg-white/10 border-white/20"
                        />
                        Enable Community
                      </label>
                      <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 text-sm text-white">
                              Allow guests
                              <span
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px] text-gray-300"
                                title="Let signed-out visitors or non-members view what a lowest-rank guest would normally be allowed to view."
                              >
                                ?
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">If enabled, guests can view the same server surfaces a guest-level member would normally be allowed to see.</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={Boolean(settings.allow_guests)}
                            onChange={(e) => updateSetting('allow_guests', e.target.checked)}
                            className="mt-1 rounded bg-white/10 border-white/20"
                          />
                        </div>
                      </div>
                    </div>

                    {settings.community_enabled && (
                      <>
                        <div className="border-t border-white/10 pt-4">
                          <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                            <Hash size={16} /> Rules Channel
                          </h3>
                          <p className="text-xs text-gray-500 mb-2">
                            The channel where your server rules are displayed.
                          </p>
                          <select
                            value={settings.rules_channel_id}
                            onChange={(e) => updateSetting('rules_channel_id', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                          >
                            <option value="">No rules channel</option>
                            {textChannels.map((ch) => (
                              <option key={ch.id} value={ch.id}># {ch.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                            <MessageSquare size={16} /> Public Updates Channel
                          </h3>
                          <p className="text-xs text-gray-500 mb-2">
                            The channel where community updates from the platform are posted.
                          </p>
                          <select
                            value={settings.public_updates_channel_id}
                            onChange={(e) => updateSetting('public_updates_channel_id', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                          >
                            <option value="">No updates channel</option>
                            {textChannels.map((ch) => (
                              <option key={ch.id} value={ch.id}># {ch.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="border-t border-white/10 pt-4">
                          <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                            <Users size={16} /> Welcome Screen
                          </h3>
                          <p className="text-xs text-gray-500 mb-2">
                            Show new members a welcome screen with a description and suggested channels.
                          </p>
                          <label className="flex items-center gap-2 text-sm text-gray-300 mb-3">
                            <input
                              type="checkbox"
                              checked={settings.welcome_screen_enabled}
                              onChange={(e) => updateSetting('welcome_screen_enabled', e.target.checked)}
                              className="rounded bg-white/10 border-white/20"
                            />
                            Enable Welcome Screen
                          </label>

                          {settings.welcome_screen_enabled && (
                            <div>
                              <label className="text-sm text-gray-300 mb-1 block">Welcome Description</label>
                              <textarea
                                value={settings.welcome_screen_description}
                                onChange={(e) => updateSetting('welcome_screen_description', e.target.value)}
                                placeholder="Write a description for the welcome screen..."
                                rows={3}
                                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white resize-none"
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'widget' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                        <Eye size={16} /> Server Widget
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">
                        Allow others to embed a widget showing server info on their website.
                      </p>
                      <label className="flex items-center gap-2 text-sm text-gray-300 mb-4">
                        <input
                          type="checkbox"
                          checked={settings.widget_enabled}
                          onChange={(e) => updateSetting('widget_enabled', e.target.checked)}
                          className="rounded bg-white/10 border-white/20"
                        />
                        Enable Server Widget
                      </label>

                      {settings.widget_enabled && (
                        <div>
                          <h4 className="text-sm text-gray-300 mb-1">Widget Invite Channel</h4>
                          <p className="text-xs text-gray-500 mb-2">
                            The channel the widget invite link will direct users to.
                          </p>
                          <select
                            value={settings.widget_channel_id}
                            onChange={(e) => updateSetting('widget_channel_id', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                          >
                            <option value="">No invite channel</option>
                            {textChannels.map((ch) => (
                              <option key={ch.id} value={ch.id}># {ch.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'roles' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                        <Shield size={16} /> Roles
                      </h3>
                      <p className="text-sm text-gray-400 mb-4">
                        Open the full role tools here or from the server sidebar.
                      </p>
                      <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                        <p className="text-xs text-gray-500">
                          💡 The Role Manager provides full role creation, editing, permission assignment, and member role management. Look for the shield icon in the server sidebar.
                        </p>
                        <button onClick={onOpenRoleManager} className="btn btn-primary mt-3 text-sm">
                          <Shield size={14} /> Open Role Manager
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'emoji' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                        <SmilePlus size={16} /> Server Emoji
                      </h3>
                      <p className="text-xs text-gray-500 mb-4">
                        Upload custom emojis for your server members to use.
                      </p>
                      <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center">
                        <SmilePlus size={32} className="mx-auto text-gray-500 mb-2" />
                        <p className="text-sm text-gray-400 mb-2">Custom emoji uploads coming soon</p>
                        <p className="text-xs text-gray-600">Drag and drop images here or click to upload</p>
                        <button className="btn btn-glass text-sm mt-4" disabled>
                          Upload Emoji
                        </button>
                      </div>
                      <div className="mt-4 p-3 bg-white/5 rounded-lg">
                        <p className="text-xs text-gray-500">
                          📝 Custom emojis must be under 256KB and in PNG, JPG, or GIF format. Animated emojis are supported.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'audit_log' && (
                  <div className="space-y-4">
                    <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                      <List size={16} /> Audit Log
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                      View recent actions taken by members and moderators.
                    </p>
                    <div className="max-h-[50vh] overflow-y-auto space-y-2">
                      {auditLogs.length === 0 ? (
                        <div className="text-center py-8">
                          <List size={24} className="mx-auto text-gray-600 mb-2" />
                          <p className="text-sm text-gray-500">No audit log entries found</p>
                        </div>
                      ) : (
                        auditLogs.map((entry, i) => (
                          <div key={entry.id || i} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/5">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                              <List size={14} className="text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white">
                                <span className="font-medium">{entry.user?.username || entry.user_id || 'Unknown'}</span>
                                {' '}
                                <span className="text-gray-400">{entry.action_type || entry.action || 'performed an action'}</span>
                                {entry.target && (
                                  <span className="text-gray-500"> on {entry.target}</span>
                                )}
                              </p>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'bans' && (
                  <div className="space-y-4">
                    <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                      <Gavel size={16} /> Banned Members
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                      View and manage banned members.
                    </p>
                    {bans.length === 0 ? (
                      <div className="text-center py-8">
                        <Gavel size={24} className="mx-auto text-gray-600 mb-2" />
                        <p className="text-sm text-gray-500">No bans</p>
                        <p className="text-xs text-gray-600 mt-1">This server has no banned members.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {bans.map((ban, i) => (
                          <div key={ban.id || i} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5">
                            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                              <Gavel size={14} className="text-red-400" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-white font-medium">{ban.user?.username || ban.username || ban.user_id || 'Unknown User'}</p>
                              {ban.reason && <p className="text-xs text-gray-500">Reason: {ban.reason}</p>}
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  await serversApi.unban(serverId, ban.user_id || ban.user?.id);
                                  setBans(bans.filter((_, idx) => idx !== i));
                                } catch {}
                              }}
                              className="px-2 py-1 text-xs bg-white/5 hover:bg-green-500/20 text-gray-400 hover:text-green-400 rounded transition-colors"
                              title="Unban"
                            >
                              Unban
                            </button>
                            <p className="text-xs text-gray-600">
                              {ban.created_at ? new Date(ban.created_at).toLocaleDateString() : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'invites' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        <Link2 size={16} /> Server Invites
                      </h3>
                      <button
                        onClick={async () => {
                          try {
                            await serversApi.createInvite(serverId);
                            const updated = await serversApi.invites(serverId);
                            setInvites(updated);
                          } catch {}
                        }}
                        className="btn btn-primary text-sm px-3 py-1.5"
                      >
                        Create Invite
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Manage invite links for this server.
                    </p>
                    {invites.length === 0 ? (
                      <div className="text-center py-8">
                        <Link2 size={24} className="mx-auto text-gray-600 mb-2" />
                        <p className="text-sm text-gray-500">No active invites</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {invites.map((inv, i) => (
                          <div key={inv.code || i} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5">
                            <div className="flex-1">
                              <p className="text-sm text-indigo-300 font-mono">{inv.code || 'invite-code'}</p>
                              <p className="text-xs text-gray-500">
                                Uses: {inv.uses ?? 0}{inv.max_uses ? ` / ${inv.max_uses}` : ''}
                                {inv.inviter?.username && ` • By ${inv.inviter.username}`}
                                {inv.expires_at && ` • Expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                              </p>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  await serversApi.deleteInvite(inv.code);
                                  setInvites(invites.filter(x => x.code !== inv.code));
                                } catch {}
                              }}
                              className="p-1.5 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors"
                              title="Revoke invite"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'safety' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                        <Zap size={16} /> Auto-Moderation
                      </h3>
                      <p className="text-xs text-gray-500 mb-4">
                        Configure automatic moderation to keep your server safe.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                        <div>
                          <p className="text-sm text-white">Slowmode</p>
                          <p className="text-xs text-gray-500">Rate-limit messages per channel</p>
                        </div>
                        <select 
                          className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-sm text-white"
                          value={settings.default_slowmode ?? 0}
                          onChange={(e) => updateSetting('default_slowmode', parseInt(e.target.value))}
                        >
                          <option value="0">Off</option>
                          <option value="5">5 seconds</option>
                          <option value="10">10 seconds</option>
                          <option value="30">30 seconds</option>
                          <option value="60">1 minute</option>
                          <option value="300">5 minutes</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                        <div>
                          <p className="text-sm text-white">Anti-Spam</p>
                          <p className="text-xs text-gray-500">Detect and remove spam messages</p>
                        </div>
                        <span className="text-xs text-gray-600 italic">Coming Soon</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                        <div>
                          <p className="text-sm text-white">Anti-Raid</p>
                          <p className="text-xs text-gray-500">Detect rapid mass joins</p>
                        </div>
                        <span className="text-xs text-gray-600 italic">Coming Soon</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                        <div>
                          <p className="text-sm text-white">Block Links</p>
                          <p className="text-xs text-gray-500">Prevent posting of external links</p>
                        </div>
                        <span className="text-xs text-gray-600 italic">Coming Soon</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                        <div>
                          <p className="text-sm text-white">Mention Spam Protection</p>
                          <p className="text-xs text-gray-500">Limit excessive @mentions</p>
                        </div>
                        <span className="text-xs text-gray-600 italic">Coming Soon</span>
                      </div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg mt-4">
                      <p className="text-xs text-gray-500">
                        ⚠️ Auto-moderation settings are conceptual and will be connected to backend functionality in a future update.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
