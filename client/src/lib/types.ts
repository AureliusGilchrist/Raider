export interface User {
  id: string;
  username: string;
  email?: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  avatar_type: string;
  banner_url: string;
  banner_type: string;
  gender?: string;
  gender_custom?: string;
  pronouns?: string;
  languages: string;
  public_key?: number[];
  key_iterations: number;
  peer_id: string;
  advanced_mode: boolean;
  xp: number;
  level: number;
  status: string;
  status_message: string;
  created_at: string;
  last_seen: string;
  is_following?: boolean;
}

export interface UserSettings {
  user_id: string;
  show_gender: boolean;
  show_pronouns: boolean;
  show_languages: boolean;
  show_servers: boolean;
  show_stats: boolean;
  show_online_status: boolean;
  show_bio: boolean;
  show_level: boolean;
  glass_effect: boolean;
  gradient_bg: boolean;
  gradient_color1: string;
  gradient_color2: string;
  gradient_color3: string;
  animation_speed: string;
  theme: string;
  font_size: string;
  reduced_motion: boolean;
  high_contrast: boolean;
  notification_dms: boolean;
  notification_servers: boolean;
  notification_calls: boolean;
  notification_sounds: boolean;
  auto_lock_minutes: number;
  two_factor_enabled: boolean;
  advanced_ui: boolean;
  custom_css: string;
  accent_color: string;
  show_banner: boolean;
  show_in_search: boolean;
  ringtone: string;
}

export interface UserStats {
  user_id: string;
  messages_sent: number;
  posts_created: number;
  upvotes_received: number;
  handshakes_made: number;
  calls_joined: number;
  servers_joined: number;
  followers_count: number;
  following_count: number;
  days_active: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string;
}

export interface Handshake {
  id: string;
  initiator_id: string;
  responder_id: string;
  status: string;
  initiated_at: string;
  completed_at?: string;
  last_renewed?: string;
  initiator_name?: string;
  responder_name?: string;
}

export interface Server {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  owner_id: string;
  public_key?: number[];
  member_count: number;
  created_at: string;
  role?: string;
  handshake_token?: string;
}

export interface Channel {
  id: string;
  server_id: string;
  name: string;
  type: string;
  position: number;
  created_at: string;
}

export interface Message {
  id: string;
  channel_id?: string;
  sender_id: string;
  recipient_id?: string;
  server_id?: string;
  content: string;
  encrypted: boolean;
  nonce?: number[];
  created_at: string;
  edited_at?: string;
  sender_name?: string;
  sender_avatar?: string;
  reply_to_id?: string;
  reply_to?: {
    id: string;
    sender_name: string;
    content: string;
  };
}

export interface Post {
  id: string;
  author_id: string;
  server_id?: string;
  title: string;
  content: string;
  media_url?: string;
  media_urls?: string[];
  upvotes: number;
  downvotes: number;
  comment_count: number;
  created_at: string;
  edited_at?: string;
  author_name?: string;
  author_avatar?: string;
  user_vote: number;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id?: string;
  content: string;
  upvotes: number;
  created_at: string;
  author_name?: string;
}

export interface CallSession {
  id: string;
  creator_id: string;
  server_id?: string;
  channel_id?: string;
  active: boolean;
  created_at: string;
  ended_at?: string;
  creator_name?: string;
  participant_count?: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement_type: string;
  requirement_value: number;
}

export interface DMContact {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  avatar_type: string;
  last_message?: string;
  last_message_at?: string;
}

export interface Share {
  id: string;
  user_id: string;
  share_type: 'post' | 'message';
  post_id?: string;
  message_id?: string;
  comment: string;
  original_server_id?: string;
  created_at: string;
  sharer_name?: string;
  sharer_avatar?: string;
  post?: Post;
  message?: Message;
}

export interface Announcement {
  id: string;
  author_id: string;
  server_id?: string;
  content: string;
  type: 'info' | 'warning' | 'critical';
  active: boolean;
  created_at: string;
  expires_at?: string;
}

export interface ServerSettings {
  server_id: string;
  afk_channel_id: string;
  afk_timeout: number;
  system_channel_id: string;
  system_channel_flags: number;
  default_message_notifications: number;
  verification_level: number;
  explicit_content_filter: number;
  mfa_level: number;
  widget_enabled: boolean;
  widget_channel_id: string;
  community_enabled: boolean;
  rules_channel_id: string;
  public_updates_channel_id: string;
  welcome_screen_enabled: boolean;
  welcome_screen_description: string;
  splash_url: string;
  banner_url: string;
  discovery_splash_url: string;
}

export interface WSMessage {
  type: string;
  payload: any;
}

export const GENDER_OPTIONS_BASIC = [
  'Male',
  'Female',
  'Non-binary',
  'Prefer not to say',
];

export const GENDER_OPTIONS_ADVANCED = [
  'Male',
  'Female',
  'Non-binary',
  'Transgender Male',
  'Transgender Female',
  'Genderqueer',
  'Genderfluid',
  'Agender',
  'Bigender',
  'Pangender',
  'Demigender',
  'Demiboy',
  'Demigirl',
  'Neutrois',
  'Androgynous',
  'Two-Spirit',
  'Third Gender',
  'Questioning',
  'Custom',
  'Prefer not to say',
];

export const LANGUAGE_OPTIONS = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Russian', 'Chinese (Mandarin)', 'Chinese (Cantonese)', 'Japanese',
  'Korean', 'Arabic', 'Hindi', 'Bengali', 'Turkish', 'Vietnamese',
  'Thai', 'Dutch', 'Polish', 'Swedish', 'Norwegian', 'Danish',
  'Finnish', 'Greek', 'Hebrew', 'Indonesian', 'Malay', 'Filipino',
  'Czech', 'Romanian', 'Hungarian', 'Ukrainian', 'Persian', 'Swahili',
  'Yoruba', 'Zulu', 'Sign Language (ASL)', 'Sign Language (BSL)',
];

export const PRONOUN_OPTIONS = [
  'he/him', 'she/her', 'they/them', 'he/they', 'she/they',
  'ze/zir', 'xe/xem', 'ey/em', 'any pronouns', 'ask me',
];
