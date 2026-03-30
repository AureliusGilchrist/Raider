package db

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func Init() {
	dataDir := "./data"
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		log.Fatal("Failed to create data dir:", err)
	}

	dbPath := filepath.Join(dataDir, "raider.db")
	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_foreign_keys=on")
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatal("Failed to ping database:", err)
	}

	migrate()
	log.Println("Database initialized at", dbPath)
}

func migrate() {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		email TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		display_name TEXT DEFAULT '',
		bio TEXT DEFAULT '',
		avatar_url TEXT DEFAULT '',
		avatar_type TEXT DEFAULT 'image',
		gender TEXT DEFAULT '',
		gender_custom TEXT DEFAULT '',
		pronouns TEXT DEFAULT '',
		languages TEXT DEFAULT '[]',
		public_key BLOB,
		encrypted_private_key BLOB,
		key_iterations INTEGER DEFAULT 128,
		key_salt BLOB,
		peer_id TEXT UNIQUE NOT NULL,
		banner_url TEXT DEFAULT '',
		banner_type TEXT DEFAULT 'image',
		advanced_mode INTEGER DEFAULT 0,
		xp INTEGER DEFAULT 0,
		level INTEGER DEFAULT 1,
		status TEXT DEFAULT 'online',
		status_message TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS user_settings (
		user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
		show_gender INTEGER DEFAULT 1,
		show_pronouns INTEGER DEFAULT 1,
		show_languages INTEGER DEFAULT 1,
		show_servers INTEGER DEFAULT 1,
		show_stats INTEGER DEFAULT 1,
		show_online_status INTEGER DEFAULT 1,
		show_bio INTEGER DEFAULT 1,
		show_level INTEGER DEFAULT 1,
		glass_effect INTEGER DEFAULT 1,
		gradient_bg INTEGER DEFAULT 1,
		gradient_color1 TEXT DEFAULT '#6366f1',
		gradient_color2 TEXT DEFAULT '#8b5cf6',
		gradient_color3 TEXT DEFAULT '#a855f7',
		animation_speed TEXT DEFAULT 'normal',
		theme TEXT DEFAULT 'dark',
		font_size TEXT DEFAULT 'medium',
		reduced_motion INTEGER DEFAULT 0,
		high_contrast INTEGER DEFAULT 0,
		notification_dms INTEGER DEFAULT 1,
		notification_servers INTEGER DEFAULT 1,
		notification_calls INTEGER DEFAULT 1,
		notification_sounds INTEGER DEFAULT 1,
		auto_lock_minutes INTEGER DEFAULT 0,
		two_factor_enabled INTEGER DEFAULT 0,
		advanced_ui INTEGER DEFAULT 0,
		custom_css TEXT DEFAULT '',
		accent_color TEXT DEFAULT '#6366f1',
		show_banner INTEGER DEFAULT 1,
		show_in_search INTEGER DEFAULT 1
	);

	CREATE TABLE IF NOT EXISTS user_stats (
		user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
		messages_sent INTEGER DEFAULT 0,
		posts_created INTEGER DEFAULT 0,
		upvotes_received INTEGER DEFAULT 0,
		handshakes_made INTEGER DEFAULT 0,
		calls_joined INTEGER DEFAULT 0,
		servers_joined INTEGER DEFAULT 0,
		followers_count INTEGER DEFAULT 0,
		following_count INTEGER DEFAULT 0,
		days_active INTEGER DEFAULT 0,
		current_streak INTEGER DEFAULT 0,
		longest_streak INTEGER DEFAULT 0,
		last_active_date TEXT DEFAULT ''
	);

	CREATE TABLE IF NOT EXISTS handshakes (
		id TEXT PRIMARY KEY,
		initiator_id TEXT NOT NULL REFERENCES users(id),
		responder_id TEXT NOT NULL REFERENCES users(id),
		status TEXT DEFAULT 'pending',
		shared_secret_hash TEXT,
		initiated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		completed_at DATETIME,
		last_renewed DATETIME,
		UNIQUE(initiator_id, responder_id)
	);

	CREATE TABLE IF NOT EXISTS servers (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT DEFAULT '',
		icon_url TEXT DEFAULT '',
		owner_id TEXT NOT NULL REFERENCES users(id),
		public_key BLOB,
		member_count INTEGER DEFAULT 0,
		allow_sharing INTEGER DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS server_members (
		server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		nickname TEXT DEFAULT '',
		joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (server_id, user_id)
	);

	-- Discord-like Roles System
	CREATE TABLE IF NOT EXISTS server_roles (
		id TEXT PRIMARY KEY,
		server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		color TEXT DEFAULT '#99AAB5',
		position INTEGER DEFAULT 0,
		hoist INTEGER DEFAULT 0,
		mentionable INTEGER DEFAULT 0,
		permissions INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	-- Role permissions bitmask (Discord-like)
	-- 0x00000001: CREATE_INSTANT_INVITE
	-- 0x00000002: KICK_MEMBERS
	-- 0x00000004: BAN_MEMBERS
	-- 0x00000008: ADMINISTRATOR
	-- 0x00000010: MANAGE_CHANNELS
	-- 0x00000020: MANAGE_GUILD
	-- 0x00000040: ADD_REACTIONS
	-- 0x00000080: VIEW_AUDIT_LOG
	-- 0x00000100: PRIORITY_SPEAKER
	-- 0x00000200: STREAM
	-- 0x00000400: VIEW_CHANNEL
	-- 0x00000800: SEND_MESSAGES
	-- 0x00001000: SEND_TTS_MESSAGES
	-- 0x00002000: MANAGE_MESSAGES
	-- 0x00004000: EMBED_LINKS
	-- 0x00008000: ATTACH_FILES
	-- 0x00010000: READ_MESSAGE_HISTORY
	-- 0x00020000: MENTION_EVERYONE
	-- 0x00040000: USE_EXTERNAL_EMOJIS
	-- 0x00080000: VIEW_GUILD_INSIGHTS
	-- 0x00100000: CONNECT
	-- 0x00200000: SPEAK
	-- 0x00400000: MUTE_MEMBERS
	-- 0x00800000: DEAFEN_MEMBERS
	-- 0x01000000: MOVE_MEMBERS
	-- 0x02000000: USE_VAD
	-- 0x04000000: CHANGE_NICKNAME
	-- 0x08000000: MANAGE_NICKNAMES
	-- 0x10000000: MANAGE_ROLES
	-- 0x20000000: MANAGE_WEBHOOKS
	-- 0x40000000: MANAGE_EMOJIS
	-- 0x80000000: USE_APPLICATION_COMMANDS

	CREATE TABLE IF NOT EXISTS server_member_roles (
		server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		role_id TEXT NOT NULL REFERENCES server_roles(id) ON DELETE CASCADE,
		PRIMARY KEY (server_id, user_id, role_id)
	);

	-- Channel Categories
	CREATE TABLE IF NOT EXISTS channel_categories (
		id TEXT PRIMARY KEY,
		server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		position INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	-- Update channels table to support categories
	CREATE TABLE IF NOT EXISTS channels (
		id TEXT PRIMARY KEY,
		server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
		parent_id TEXT REFERENCES channel_categories(id) ON DELETE SET NULL,
		name TEXT NOT NULL,
		type TEXT DEFAULT 'text',
		topic TEXT DEFAULT '',
		position INTEGER DEFAULT 0,
		nsfw INTEGER DEFAULT 0,
		bitrate INTEGER DEFAULT 64000,
		user_limit INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	-- Channel Permission Overwrites
	CREATE TABLE IF NOT EXISTS channel_permissions (
		channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
		target_id TEXT NOT NULL,
		target_type TEXT NOT NULL, -- 'role' or 'member'
		allow INTEGER DEFAULT 0,
		deny INTEGER DEFAULT 0,
		PRIMARY KEY (channel_id, target_id, target_type)
	);

	-- Server Invites
	CREATE TABLE IF NOT EXISTS server_invites (
		code TEXT PRIMARY KEY,
		server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
		channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
		inviter_id TEXT NOT NULL REFERENCES users(id),
		uses INTEGER DEFAULT 0,
		max_uses INTEGER DEFAULT 0,
		max_age INTEGER DEFAULT 86400,
		temporary INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		expires_at DATETIME
	);

	-- Server Moderation (Bans, Kicks, Timeouts)
	CREATE TABLE IF NOT EXISTS server_bans (
		server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		moderator_id TEXT NOT NULL REFERENCES users(id),
		reason TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		expires_at DATETIME,
		PRIMARY KEY (server_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS server_mutes (
		id TEXT PRIMARY KEY,
		server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
		user_id TEXT NOT NULL REFERENCES users(id),
		moderator_id TEXT NOT NULL REFERENCES users(id),
		reason TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		expires_at DATETIME
	);

	-- Audit Log
	CREATE TABLE IF NOT EXISTS server_audit_logs (
		id TEXT PRIMARY KEY,
		server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
		user_id TEXT REFERENCES users(id),
		action_type INTEGER NOT NULL,
		target_id TEXT,
		target_type TEXT,
		changes TEXT,
		reason TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	-- Audit log action types (Discord-like)
	-- 1: GUILD_UPDATE, 10: CHANNEL_CREATE, 11: CHANNEL_UPDATE, 12: CHANNEL_DELETE
	-- 20: CHANNEL_OVERWRITE_CREATE, 21: CHANNEL_OVERWRITE_UPDATE, 22: CHANNEL_OVERWRITE_DELETE
	-- 30: MEMBER_KICK, 31: MEMBER_PRUNE, 32: MEMBER_BAN_ADD, 33: MEMBER_BAN_REMOVE
	-- 34: MEMBER_UPDATE, 35: MEMBER_ROLE_UPDATE, 36: MEMBER_MOVE, 37: MEMBER_DISCONNECT
	-- 40: BOT_ADD, 50: ROLE_CREATE, 51: ROLE_UPDATE, 52: ROLE_DELETE
	-- 60: INVITE_CREATE, 61: INVITE_UPDATE, 62: INVITE_DELETE
	-- 72: MESSAGE_DELETE, 73: MESSAGE_BULK_DELETE, 74: MESSAGE_PIN, 75: MESSAGE_UNPIN
	-- 80: INTEGRATION_CREATE, 81: INTEGRATION_UPDATE, 82: INTEGRATION_DELETE
	-- 90: STAGE_INSTANCE_CREATE, 91: STAGE_INSTANCE_UPDATE, 92: STAGE_INSTANCE_DELETE
	-- 100: STICKER_CREATE, 101: STICKER_UPDATE, 102: STICKER_DELETE
	-- 110: SCHEDULED_EVENT_CREATE, 111: SCHEDULED_EVENT_UPDATE, 112: SCHEDULED_EVENT_DELETE
	-- 121: THREAD_CREATE, 122: THREAD_UPDATE, 123: THREAD_DELETE
	-- 140: VOICE_CHANNEL_STATUS_UPDATE

	-- Pinned Messages per Channel
	CREATE TABLE IF NOT EXISTS pinned_messages (
		channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
		message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
		pinned_by TEXT NOT NULL REFERENCES users(id),
		pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (channel_id, message_id)
	);

	-- Server Settings (enhanced)
	CREATE TABLE IF NOT EXISTS server_settings (
		server_id TEXT PRIMARY KEY REFERENCES servers(id) ON DELETE CASCADE,
		afk_channel_id TEXT,
		afk_timeout INTEGER DEFAULT 300,
		system_channel_id TEXT,
		system_channel_flags INTEGER DEFAULT 0,
		default_message_notifications INTEGER DEFAULT 0,
		verification_level INTEGER DEFAULT 0,
		explicit_content_filter INTEGER DEFAULT 0,
		mfa_level INTEGER DEFAULT 0,
		widget_enabled INTEGER DEFAULT 0,
		widget_channel_id TEXT,
		community_enabled INTEGER DEFAULT 0,
		rules_channel_id TEXT,
		public_updates_channel_id TEXT,
		welcome_screen_enabled INTEGER DEFAULT 0,
		welcome_screen_description TEXT DEFAULT '',
		splash_url TEXT DEFAULT '',
		banner_url TEXT DEFAULT '',
		discovery_splash_url TEXT DEFAULT ''
	);

	-- Welcome Screen Channels
	CREATE TABLE IF NOT EXISTS server_welcome_channels (
		id TEXT PRIMARY KEY,
		server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
		channel_id TEXT NOT NULL REFERENCES channels(id),
		description TEXT NOT NULL,
		emoji TEXT DEFAULT ''
	);

	-- Server Announcements (role-posted, banner-style)
	CREATE TABLE IF NOT EXISTS server_announcements (
		id TEXT PRIMARY KEY,
		server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
		author_id TEXT NOT NULL REFERENCES users(id),
		content TEXT NOT NULL,
		color TEXT DEFAULT '#6366f1',
		icon TEXT DEFAULT '📢',
		active INTEGER DEFAULT 1,
		pin_until DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	-- Group Chats (separate from servers and DMs)
	CREATE TABLE IF NOT EXISTS group_chats (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		icon_url TEXT DEFAULT '',
		creator_id TEXT NOT NULL REFERENCES users(id),
		member_count INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS group_chat_members (
		group_id TEXT NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (group_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS group_messages (
		id TEXT PRIMARY KEY,
		group_id TEXT NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
		sender_id TEXT NOT NULL REFERENCES users(id),
		content TEXT NOT NULL,
		encrypted INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		edited_at DATETIME
	);

	-- Permission for posting announcements (add to roles system)
	-- Using bit 0x100000000 (bit 32) for POST_ANNOUNCEMENTS

	CREATE TABLE IF NOT EXISTS messages (
		id TEXT PRIMARY KEY,
		channel_id TEXT,
		sender_id TEXT NOT NULL REFERENCES users(id),
		recipient_id TEXT,
		server_id TEXT,
		content TEXT NOT NULL,
		encrypted INTEGER DEFAULT 0,
		nonce BLOB,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		edited_at DATETIME
	);

	CREATE TABLE IF NOT EXISTS posts (
		id TEXT PRIMARY KEY,
		author_id TEXT NOT NULL REFERENCES users(id),
		server_id TEXT,
		title TEXT NOT NULL,
		content TEXT NOT NULL,
		media_url TEXT DEFAULT '',
		upvotes INTEGER DEFAULT 0,
		downvotes INTEGER DEFAULT 0,
		comment_count INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		edited_at DATETIME
	);

	CREATE TABLE IF NOT EXISTS post_votes (
		post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		vote INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (post_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS comments (
		id TEXT PRIMARY KEY,
		post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
		author_id TEXT NOT NULL REFERENCES users(id),
		parent_id TEXT,
		content TEXT NOT NULL,
		upvotes INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS call_sessions (
		id TEXT PRIMARY KEY,
		creator_id TEXT NOT NULL REFERENCES users(id),
		server_id TEXT,
		channel_id TEXT,
		active INTEGER DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		ended_at DATETIME
	);

	CREATE TABLE IF NOT EXISTS call_participants (
		call_id TEXT NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
		user_id TEXT NOT NULL REFERENCES users(id),
		joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		left_at DATETIME,
		PRIMARY KEY (call_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS followers (
		follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (follower_id, following_id)
	);

	CREATE TABLE IF NOT EXISTS badges (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT NOT NULL,
		icon TEXT NOT NULL,
		requirement_type TEXT NOT NULL,
		requirement_value INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS user_badges (
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		badge_id TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
		earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (user_id, badge_id)
	);

	CREATE TABLE IF NOT EXISTS announcements (
		id TEXT PRIMARY KEY,
		author_id TEXT NOT NULL REFERENCES users(id),
		server_id TEXT,
		content TEXT NOT NULL,
		type TEXT DEFAULT 'info',
		active INTEGER DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		expires_at DATETIME
	);

	CREATE TABLE IF NOT EXISTS announcement_dismissals (
		announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		dismissed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (announcement_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS shares (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		share_type TEXT NOT NULL,
		post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
		message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
		comment TEXT DEFAULT '',
		original_server_id TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS uploads (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id),
		filename TEXT NOT NULL,
		mime_type TEXT NOT NULL,
		size INTEGER NOT NULL,
		path TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	-- Seed default badges
	INSERT OR IGNORE INTO badges (id, name, description, icon, requirement_type, requirement_value) VALUES
		('first_message', 'First Message', 'Sent your first message', '💬', 'messages_sent', 1),
		('chatterbox', 'Chatterbox', 'Sent 100 messages', '🗣️', 'messages_sent', 100),
		('social_butterfly', 'Social Butterfly', 'Made 10 handshakes', '🤝', 'handshakes_made', 10),
		('first_post', 'First Post', 'Created your first post', '📝', 'posts_created', 1),
		('popular', 'Popular', 'Received 50 upvotes', '⬆️', 'upvotes_received', 50),
		('caller', 'Caller', 'Joined 10 calls', '📞', 'calls_joined', 10),
		('server_hopper', 'Server Hopper', 'Joined 5 servers', '🏠', 'servers_joined', 5),
		('week_streak', 'Week Streak', '7 day activity streak', '🔥', 'current_streak', 7),
		('month_streak', 'Month Streak', '30 day activity streak', '🌟', 'current_streak', 30),
		('influencer', 'Influencer', 'Gained 50 followers', '👥', 'followers_count', 50),
		('veteran', 'Veteran', 'Active for 30 days', '🎖️', 'days_active', 30),
		('level10', 'Level 10', 'Reached level 10', '🏆', 'level', 10);

	CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);
	CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
	CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
	CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
	CREATE INDEX IF NOT EXISTS idx_posts_server ON posts(server_id);
	CREATE INDEX IF NOT EXISTS idx_handshakes_users ON handshakes(initiator_id, responder_id);
	CREATE INDEX IF NOT EXISTS idx_server_members_user ON server_members(user_id);
	CREATE INDEX IF NOT EXISTS idx_shares_user ON shares(user_id);
	`

	_, err := DB.Exec(schema)
	if err != nil {
		log.Fatal("Migration failed:", err)
	}
	log.Println("Database migrations complete")
}

func Close() {
	if DB != nil {
		DB.Close()
	}
}
