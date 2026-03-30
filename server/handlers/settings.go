package handlers

import (
	"encoding/json"
	"net/http"

	"raider/db"
	"raider/middleware"
	"raider/models"
)

func GetSettings(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var s models.UserSettings
	err := db.DB.QueryRow(`SELECT user_id, show_gender, show_pronouns, show_languages, show_servers,
		show_stats, show_online_status, show_bio, show_level, glass_effect, gradient_bg,
		gradient_color1, gradient_color2, gradient_color3, animation_speed, theme, font_size,
		reduced_motion, high_contrast, notification_dms, notification_servers, notification_calls,
		notification_sounds, auto_lock_minutes, two_factor_enabled, advanced_ui, custom_css, accent_color, show_banner, show_in_search, ringtone
		FROM user_settings WHERE user_id = ?`, userID).Scan(
		&s.UserID, &s.ShowGender, &s.ShowPronouns, &s.ShowLanguages, &s.ShowServers,
		&s.ShowStats, &s.ShowOnlineStatus, &s.ShowBio, &s.ShowLevel, &s.GlassEffect, &s.GradientBG,
		&s.GradientColor1, &s.GradientColor2, &s.GradientColor3, &s.AnimationSpeed, &s.Theme, &s.FontSize,
		&s.ReducedMotion, &s.HighContrast, &s.NotificationDMs, &s.NotificationServers, &s.NotificationCalls,
		&s.NotificationSounds, &s.AutoLockMinutes, &s.TwoFactorEnabled, &s.AdvancedUI, &s.CustomCSS, &s.AccentColor, &s.ShowBanner, &s.ShowInSearch, &s.Ringtone)
	if err != nil {
		// Create default settings if not found
		db.DB.Exec("INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)", userID)
		s = models.UserSettings{
			UserID:              userID,
			ShowGender:          true,
			ShowPronouns:        true,
			ShowLanguages:       true,
			ShowServers:         true,
			ShowStats:           true,
			ShowOnlineStatus:    true,
			ShowBio:             true,
			ShowLevel:           true,
			GlassEffect:         true,
			GradientBG:          true,
			GradientColor1:      "#6366f1",
			GradientColor2:      "#8b5cf6",
			GradientColor3:      "#a855f7",
			AnimationSpeed:      "normal",
			Theme:               "dark",
			FontSize:            "medium",
			NotificationDMs:     true,
			NotificationServers: true,
			NotificationCalls:   true,
			NotificationSounds:  true,
			AccentColor:         "#6366f1",
			ShowBanner:          true,
			ShowInSearch:        true,
			Ringtone:            "default",
		}
	}

	jsonResponse(w, http.StatusOK, s)
}

func UpdateSettings(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var s models.UserSettings
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	_, err := db.DB.Exec(`INSERT INTO user_settings (user_id, show_gender, show_pronouns, show_languages, show_servers,
		show_stats, show_online_status, show_bio, show_level, glass_effect, gradient_bg,
		gradient_color1, gradient_color2, gradient_color3, animation_speed, theme, font_size,
		reduced_motion, high_contrast, notification_dms, notification_servers, notification_calls,
		notification_sounds, auto_lock_minutes, two_factor_enabled, advanced_ui, custom_css, accent_color, show_banner, show_in_search, ringtone)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
		show_gender=?, show_pronouns=?, show_languages=?, show_servers=?,
		show_stats=?, show_online_status=?, show_bio=?, show_level=?, glass_effect=?, gradient_bg=?,
		gradient_color1=?, gradient_color2=?, gradient_color3=?, animation_speed=?, theme=?, font_size=?,
		reduced_motion=?, high_contrast=?, notification_dms=?, notification_servers=?, notification_calls=?,
		notification_sounds=?, auto_lock_minutes=?, two_factor_enabled=?, advanced_ui=?, custom_css=?, accent_color=?, show_banner=?, show_in_search=?, ringtone=?`,
		userID, s.ShowGender, s.ShowPronouns, s.ShowLanguages, s.ShowServers,
		s.ShowStats, s.ShowOnlineStatus, s.ShowBio, s.ShowLevel, s.GlassEffect, s.GradientBG,
		s.GradientColor1, s.GradientColor2, s.GradientColor3, s.AnimationSpeed, s.Theme, s.FontSize,
		s.ReducedMotion, s.HighContrast, s.NotificationDMs, s.NotificationServers, s.NotificationCalls,
		s.NotificationSounds, s.AutoLockMinutes, s.TwoFactorEnabled, s.AdvancedUI, s.CustomCSS, s.AccentColor, s.ShowBanner, s.ShowInSearch, s.Ringtone,
		// ON CONFLICT update values
		s.ShowGender, s.ShowPronouns, s.ShowLanguages, s.ShowServers,
		s.ShowStats, s.ShowOnlineStatus, s.ShowBio, s.ShowLevel, s.GlassEffect, s.GradientBG,
		s.GradientColor1, s.GradientColor2, s.GradientColor3, s.AnimationSpeed, s.Theme, s.FontSize,
		s.ReducedMotion, s.HighContrast, s.NotificationDMs, s.NotificationServers, s.NotificationCalls,
		s.NotificationSounds, s.AutoLockMinutes, s.TwoFactorEnabled, s.AdvancedUI, s.CustomCSS, s.AccentColor, s.ShowBanner, s.ShowInSearch, s.Ringtone)
	if err != nil {
		jsonError(w, "Failed to update settings", http.StatusInternalServerError)
		return
	}

	s.UserID = userID
	jsonResponse(w, http.StatusOK, s)
}

func GetUserStats(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	targetID := r.URL.Query().Get("user_id")
	if targetID == "" {
		targetID = userID
	}

	var stats models.UserStats
	err := db.DB.QueryRow(`SELECT user_id, messages_sent, posts_created, upvotes_received,
		handshakes_made, calls_joined, servers_joined, followers_count, following_count,
		days_active, current_streak, longest_streak, last_active_date
		FROM user_stats WHERE user_id = ?`, targetID).Scan(
		&stats.UserID, &stats.MessagesSent, &stats.PostsCreated, &stats.UpvotesReceived,
		&stats.HandshakesMade, &stats.CallsJoined, &stats.ServersJoined, &stats.FollowersCount,
		&stats.FollowingCount, &stats.DaysActive, &stats.CurrentStreak, &stats.LongestStreak,
		&stats.LastActiveDate)
	if err != nil {
		jsonError(w, "Stats not found", http.StatusNotFound)
		return
	}

	jsonResponse(w, http.StatusOK, stats)
}

func GetUserBadges(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	targetID := r.URL.Query().Get("user_id")
	if targetID == "" {
		targetID = userID
	}

	rows, err := db.DB.Query(`SELECT ub.badge_id, ub.earned_at, b.name, b.description, b.icon
		FROM user_badges ub JOIN badges b ON ub.badge_id = b.id
		WHERE ub.user_id = ?
		ORDER BY ub.earned_at DESC`, targetID)
	if err != nil {
		jsonError(w, "Failed to fetch badges", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type BadgeEntry struct {
		BadgeID     string `json:"badge_id"`
		EarnedAt    string `json:"earned_at"`
		Name        string `json:"name"`
		Description string `json:"description"`
		Icon        string `json:"icon"`
	}

	badges := []BadgeEntry{}
	for rows.Next() {
		var b BadgeEntry
		rows.Scan(&b.BadgeID, &b.EarnedAt, &b.Name, &b.Description, &b.Icon)
		badges = append(badges, b)
	}

	jsonResponse(w, http.StatusOK, badges)
}

func GetAllBadges(w http.ResponseWriter, r *http.Request) {
	rows, err := db.DB.Query(`SELECT id, name, description, icon, requirement_type, requirement_value FROM badges`)
	if err != nil {
		jsonError(w, "Failed to fetch badges", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	badges := []models.Badge{}
	for rows.Next() {
		var b models.Badge
		rows.Scan(&b.ID, &b.Name, &b.Description, &b.Icon, &b.RequirementType, &b.RequirementValue)
		badges = append(badges, b)
	}

	jsonResponse(w, http.StatusOK, badges)
}

func FollowUser(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		TargetID string `json:"target_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.TargetID == userID {
		jsonError(w, "Cannot follow yourself", http.StatusBadRequest)
		return
	}

	_, err := db.DB.Exec("INSERT OR IGNORE INTO followers (follower_id, following_id) VALUES (?, ?)", userID, req.TargetID)
	if err != nil {
		jsonError(w, "Failed to follow", http.StatusInternalServerError)
		return
	}

	db.DB.Exec("UPDATE user_stats SET following_count = following_count + 1 WHERE user_id = ?", userID)
	db.DB.Exec("UPDATE user_stats SET followers_count = followers_count + 1 WHERE user_id = ?", req.TargetID)
	addXP(userID, 5)

	jsonResponse(w, http.StatusOK, map[string]string{"status": "followed"})
}

func UnfollowUser(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var req struct {
		TargetID string `json:"target_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	db.DB.Exec("DELETE FROM followers WHERE follower_id = ? AND following_id = ?", userID, req.TargetID)
	db.DB.Exec("UPDATE user_stats SET following_count = MAX(0, following_count - 1) WHERE user_id = ?", userID)
	db.DB.Exec("UPDATE user_stats SET followers_count = MAX(0, followers_count - 1) WHERE user_id = ?", req.TargetID)

	jsonResponse(w, http.StatusOK, map[string]string{"status": "unfollowed"})
}

func GetServerActivity(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	targetID := r.URL.Query().Get("user_id")
	if targetID == "" {
		targetID = userID
	}

	rows, err := db.DB.Query(`SELECT s.id, s.name, s.icon_url, COUNT(m.id) as msg_count
		FROM servers s
		JOIN server_members sm ON s.id = sm.server_id
		LEFT JOIN messages m ON m.server_id = s.id AND m.sender_id = ?
		WHERE sm.user_id = ?
		GROUP BY s.id
		ORDER BY msg_count DESC`, targetID, targetID)
	if err != nil {
		jsonError(w, "Failed to fetch server activity", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type ServerActivity struct {
		ServerID     string `json:"server_id"`
		ServerName   string `json:"server_name"`
		IconURL      string `json:"icon_url"`
		MessageCount int    `json:"message_count"`
	}

	results := []ServerActivity{}
	for rows.Next() {
		var sa ServerActivity
		rows.Scan(&sa.ServerID, &sa.ServerName, &sa.IconURL, &sa.MessageCount)
		results = append(results, sa)
	}

	jsonResponse(w, http.StatusOK, results)
}

func GetProfile(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	targetID := r.URL.Query().Get("user_id")
	if targetID == "" {
		targetID = userID
	}

	var user models.User
	err := db.DB.QueryRow(`SELECT id, username, display_name, bio, avatar_url, avatar_type,
		banner_url, banner_type, gender, gender_custom, pronouns, languages, public_key, peer_id, advanced_mode, xp, level, created_at
		FROM users WHERE id = ?`, targetID).Scan(
		&user.ID, &user.Username, &user.DisplayName, &user.Bio, &user.AvatarURL, &user.AvatarType,
		&user.BannerURL, &user.BannerType, &user.Gender, &user.GenderCustom, &user.Pronouns, &user.Languages, &user.PublicKey,
		&user.PeerID, &user.AdvancedMode, &user.XP, &user.Level, &user.CreatedAt)
	if err != nil {
		jsonError(w, "User not found", http.StatusNotFound)
		return
	}

	// Check privacy settings if viewing another user
	if targetID != userID {
		var settings models.UserSettings
		db.DB.QueryRow(`SELECT show_gender, show_pronouns, show_languages, show_bio, show_level, show_banner
			FROM user_settings WHERE user_id = ?`, targetID).Scan(
			&settings.ShowGender, &settings.ShowPronouns, &settings.ShowLanguages, &settings.ShowBio, &settings.ShowLevel, &settings.ShowBanner)

		if !settings.ShowBanner {
			user.BannerURL = ""
			user.BannerType = ""
		}
		if !settings.ShowGender {
			user.Gender = ""
			user.GenderCustom = ""
		}
		if !settings.ShowPronouns {
			user.Pronouns = ""
		}
		if !settings.ShowLanguages {
			user.Languages = "[]"
		}
		if !settings.ShowBio {
			user.Bio = ""
		}
		if !settings.ShowLevel {
			user.Level = 0
			user.XP = 0
		}
	}

	// Check if current user follows target
	var isFollowing int
	db.DB.QueryRow("SELECT COUNT(*) FROM followers WHERE follower_id = ? AND following_id = ?", userID, targetID).Scan(&isFollowing)

	type ProfileResponse struct {
		models.User
		IsFollowing bool `json:"is_following"`
	}

	jsonResponse(w, http.StatusOK, ProfileResponse{User: user, IsFollowing: isFollowing > 0})
}
