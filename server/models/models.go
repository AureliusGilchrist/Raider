package models

import "time"

type User struct {
	ID                  string    `json:"id"`
	Username            string    `json:"username"`
	Email               string    `json:"email,omitempty"`
	PasswordHash        string    `json:"-"`
	DisplayName         string    `json:"display_name"`
	Bio                 string    `json:"bio"`
	AvatarURL           string    `json:"avatar_url"`
	AvatarType          string    `json:"avatar_type"`
	BannerURL           string    `json:"banner_url"`
	BannerType          string    `json:"banner_type"`
	Gender              string    `json:"gender,omitempty"`
	GenderCustom        string    `json:"gender_custom,omitempty"`
	Pronouns            string    `json:"pronouns,omitempty"`
	Languages           string    `json:"languages"`
	PublicKey           []byte    `json:"public_key,omitempty"`
	EncryptedPrivateKey []byte    `json:"-"`
	KeyIterations       int       `json:"key_iterations"`
	KeySalt             []byte    `json:"-"`
	PeerID              string    `json:"peer_id"`
	AdvancedMode        bool      `json:"advanced_mode"`
	XP                  int       `json:"xp"`
	Level               int       `json:"level"`
	Status              string    `json:"status"`
	StatusMessage       string    `json:"status_message"`
	CardArtworkURL      string    `json:"card_artwork_url"`
	CreatedAt           time.Time `json:"created_at"`
	LastSeen            time.Time `json:"last_seen"`
}

type UserSettings struct {
	UserID              string `json:"user_id"`
	ShowGender          bool   `json:"show_gender"`
	ShowPronouns        bool   `json:"show_pronouns"`
	ShowLanguages       bool   `json:"show_languages"`
	ShowServers         bool   `json:"show_servers"`
	ShowStats           bool   `json:"show_stats"`
	ShowOnlineStatus    bool   `json:"show_online_status"`
	ShowBio             bool   `json:"show_bio"`
	ShowLevel           bool   `json:"show_level"`
	GlassEffect         bool   `json:"glass_effect"`
	GradientBG          bool   `json:"gradient_bg"`
	GradientColor1      string `json:"gradient_color1"`
	GradientColor2      string `json:"gradient_color2"`
	GradientColor3      string `json:"gradient_color3"`
	AnimationSpeed      string `json:"animation_speed"`
	Theme               string `json:"theme"`
	FontSize            string `json:"font_size"`
	ReducedMotion       bool   `json:"reduced_motion"`
	HighContrast        bool   `json:"high_contrast"`
	NotificationDMs     bool   `json:"notification_dms"`
	NotificationServers bool   `json:"notification_servers"`
	NotificationCalls   bool   `json:"notification_calls"`
	NotificationSounds  bool   `json:"notification_sounds"`
	AutoLockMinutes     int    `json:"auto_lock_minutes"`
	TwoFactorEnabled    bool   `json:"two_factor_enabled"`
	AdvancedUI          bool   `json:"advanced_ui"`
	CustomCSS           string `json:"custom_css"`
	AccentColor         string `json:"accent_color"`
	ShowBanner          bool   `json:"show_banner"`
	ShowInSearch        bool   `json:"show_in_search"`
	Ringtone            string `json:"ringtone"`
	ColorScheme         string `json:"color_scheme"`
}

type UserStats struct {
	UserID          string `json:"user_id"`
	MessagesSent    int    `json:"messages_sent"`
	PostsCreated    int    `json:"posts_created"`
	UpvotesReceived int    `json:"upvotes_received"`
	HandshakesMade  int    `json:"handshakes_made"`
	CallsJoined     int    `json:"calls_joined"`
	ServersJoined   int    `json:"servers_joined"`
	FollowersCount  int    `json:"followers_count"`
	FollowingCount  int    `json:"following_count"`
	DaysActive      int    `json:"days_active"`
	CurrentStreak   int    `json:"current_streak"`
	LongestStreak   int    `json:"longest_streak"`
	LastActiveDate  string `json:"last_active_date"`
}

type Handshake struct {
	ID           string     `json:"id"`
	InitiatorID  string     `json:"initiator_id"`
	ResponderID  string     `json:"responder_id"`
	Status       string     `json:"status"`
	InitiatedAt  time.Time  `json:"initiated_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
	LastRenewed  *time.Time `json:"last_renewed,omitempty"`
}

type Server struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	IconURL     string    `json:"icon_url"`
	OwnerID     string    `json:"owner_id"`
	PublicKey   []byte    `json:"public_key,omitempty"`
	MemberCount   int       `json:"member_count"`
	AllowSharing  bool      `json:"allow_sharing"`
	CreatedAt     time.Time `json:"created_at"`
}

type ServerMember struct {
	ServerID       string    `json:"server_id"`
	UserID         string    `json:"user_id"`
	Role           string    `json:"role"`
	HandshakeToken string    `json:"handshake_token"`
	JoinedAt       time.Time `json:"joined_at"`
}

type Channel struct {
	ID        string    `json:"id"`
	ServerID  string    `json:"server_id"`
	ParentID  *string   `json:"parent_id,omitempty"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Topic     string    `json:"topic"`
	Position  int       `json:"position"`
	CreatedAt time.Time `json:"created_at"`
}

type ChannelCategory struct {
	ID        string    `json:"id"`
	ServerID  string    `json:"server_id"`
	Name      string    `json:"name"`
	Position  int       `json:"position"`
	CreatedAt time.Time `json:"created_at"`
}

type ServerRole struct {
	ID          string    `json:"id"`
	ServerID    string    `json:"server_id"`
	Name        string    `json:"name"`
	Color       string    `json:"color"`
	Position    int       `json:"position"`
	Hoist       bool      `json:"hoist"`
	Mentionable bool      `json:"mentionable"`
	Permissions int       `json:"permissions"`
	CreatedAt   time.Time `json:"created_at"`
}

type GroupMessage struct {
	ID           string     `json:"id"`
	GroupID      string     `json:"group_id"`
	SenderID     string     `json:"sender_id"`
	Content      string     `json:"content"`
	Encrypted    bool       `json:"encrypted"`
	CreatedAt    time.Time  `json:"created_at"`
	EditedAt     *time.Time `json:"edited_at,omitempty"`
	SenderName   string     `json:"sender_name,omitempty"`
	SenderAvatar string     `json:"sender_avatar,omitempty"`
}

type Message struct {
	ID          string    `json:"id"`
	ChannelID   *string   `json:"channel_id,omitempty"`
	SenderID    string    `json:"sender_id"`
	RecipientID *string   `json:"recipient_id,omitempty"`
	ServerID    *string   `json:"server_id,omitempty"`
	Content     string    `json:"content"`
	Encrypted   bool      `json:"encrypted"`
	Nonce       []byte    `json:"nonce,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	EditedAt    *time.Time `json:"edited_at,omitempty"`
	SenderName  string    `json:"sender_name,omitempty"`
	SenderAvatar string   `json:"sender_avatar,omitempty"`
}

type Post struct {
	ID           string     `json:"id"`
	AuthorID     string     `json:"author_id"`
	ServerID     *string    `json:"server_id,omitempty"`
	Title        string     `json:"title"`
	Content      string     `json:"content"`
	MediaURL     string     `json:"media_url"`
	Upvotes      int        `json:"upvotes"`
	Downvotes    int        `json:"downvotes"`
	CommentCount int        `json:"comment_count"`
	CreatedAt    time.Time  `json:"created_at"`
	EditedAt     *time.Time `json:"edited_at,omitempty"`
	AuthorName   string     `json:"author_name,omitempty"`
	AuthorAvatar string     `json:"author_avatar,omitempty"`
	UserVote     int        `json:"user_vote"`
}

type Comment struct {
	ID        string    `json:"id"`
	PostID    string    `json:"post_id"`
	AuthorID  string    `json:"author_id"`
	ParentID  *string   `json:"parent_id,omitempty"`
	Content   string    `json:"content"`
	Upvotes   int       `json:"upvotes"`
	CreatedAt time.Time `json:"created_at"`
	AuthorName string   `json:"author_name,omitempty"`
}

type CallSession struct {
	ID          string     `json:"id"`
	CreatorID   string     `json:"creator_id"`
	ServerID    *string    `json:"server_id,omitempty"`
	ChannelID   *string    `json:"channel_id,omitempty"`
	RingTargets []string   `json:"ring_targets,omitempty"`
	Active      bool       `json:"active"`
	CreatedAt   time.Time  `json:"created_at"`
	EndedAt     *time.Time `json:"ended_at,omitempty"`
}

type CallParticipant struct {
	CallID   string     `json:"call_id"`
	UserID   string     `json:"user_id"`
	JoinedAt time.Time  `json:"joined_at"`
	LeftAt   *time.Time `json:"left_at,omitempty"`
}

type Badge struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Description      string `json:"description"`
	Icon             string `json:"icon"`
	RequirementType  string `json:"requirement_type"`
	RequirementValue int    `json:"requirement_value"`
}

type UserBadge struct {
	UserID   string    `json:"user_id"`
	BadgeID  string    `json:"badge_id"`
	EarnedAt time.Time `json:"earned_at"`
	Badge    *Badge    `json:"badge,omitempty"`
}

// Request/Response types

type RegisterRequest struct {
	Username      string `json:"username"`
	Email         string `json:"email"`
	Password      string `json:"password"`
	KeyIterations int    `json:"key_iterations"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type CreateServerRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type CreateChannelRequest struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type CreatePostRequest struct {
	Title    string  `json:"title"`
	Content  string  `json:"content"`
	ServerID *string `json:"server_id,omitempty"`
	MediaURL string  `json:"media_url"`
}

type SendMessageRequest struct {
	Content     string  `json:"content"`
	ChannelID   *string `json:"channel_id,omitempty"`
	RecipientID *string `json:"recipient_id,omitempty"`
	ServerID    *string `json:"server_id,omitempty"`
	Encrypted   bool    `json:"encrypted"`
	Nonce       []byte  `json:"nonce,omitempty"`
}

type HandshakeRequest struct {
	TargetUserID string `json:"target_user_id"`
}

type HandshakeAcceptRequest struct {
	HandshakeID string `json:"handshake_id"`
	PublicKey   []byte `json:"public_key"`
}

type UpdateProfileRequest struct {
	DisplayName   *string `json:"display_name,omitempty"`
	Bio           *string `json:"bio,omitempty"`
	Gender        *string `json:"gender,omitempty"`
	GenderCustom  *string `json:"gender_custom,omitempty"`
	Pronouns      *string `json:"pronouns,omitempty"`
	Languages     *string `json:"languages,omitempty"`
	AdvancedMode  *bool   `json:"advanced_mode,omitempty"`
	BannerURL     *string `json:"banner_url,omitempty"`
	BannerType    *string `json:"banner_type,omitempty"`
	Status        *string `json:"status,omitempty"`
	StatusMessage *string `json:"status_message,omitempty"`
	CardArtworkURL *string `json:"card_artwork_url,omitempty"`
}

type VoteRequest struct {
	Vote int `json:"vote"` // 1 or -1
}

type Announcement struct {
	ID        string  `json:"id"`
	AuthorID  string  `json:"author_id"`
	ServerID  *string `json:"server_id,omitempty"`
	Content   string  `json:"content"`
	Type      string  `json:"type"`
	Active    bool    `json:"active"`
	CreatedAt string  `json:"created_at"`
	ExpiresAt *string `json:"expires_at,omitempty"`
}

type Share struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	ShareType       string    `json:"share_type"`
	PostID          *string   `json:"post_id,omitempty"`
	MessageID       *string   `json:"message_id,omitempty"`
	Comment         string    `json:"comment"`
	OriginalServerID *string  `json:"original_server_id,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	SharerName      string    `json:"sharer_name,omitempty"`
	SharerAvatar    string    `json:"sharer_avatar,omitempty"`
	// Embedded content resolved at query time
	Post            *Post     `json:"post,omitempty"`
	Message         *Message  `json:"message,omitempty"`
}

type ServerSettings struct {
	ServerID                    string `json:"server_id"`
	AFKChannelID                string `json:"afk_channel_id"`
	AFKTimeout                  int    `json:"afk_timeout"`
	SystemChannelID             string `json:"system_channel_id"`
	SystemChannelFlags          int    `json:"system_channel_flags"`
	DefaultMessageNotifications int    `json:"default_message_notifications"`
	VerificationLevel           int    `json:"verification_level"`
	ExplicitContentFilter       int    `json:"explicit_content_filter"`
	MFALevel                    int    `json:"mfa_level"`
	WidgetEnabled               bool   `json:"widget_enabled"`
	WidgetChannelID             string `json:"widget_channel_id"`
	CommunityEnabled            bool   `json:"community_enabled"`
	RulesChannelID              string `json:"rules_channel_id"`
	PublicUpdatesChannelID      string `json:"public_updates_channel_id"`
	WelcomeScreenEnabled        bool   `json:"welcome_screen_enabled"`
	WelcomeScreenDescription    string `json:"welcome_screen_description"`
	SplashURL                   string `json:"splash_url"`
	BannerURL                   string `json:"banner_url"`
	DiscoverySplashURL          string `json:"discovery_splash_url"`
}

type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}
