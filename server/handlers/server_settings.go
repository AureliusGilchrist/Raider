package handlers

import (
	"encoding/json"
	"net/http"

	"raider/db"
	"raider/middleware"
	"raider/models"

	"github.com/go-chi/chi/v5"
)

func GetServerSettings(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	userID := middleware.GetUserID(r)

	// Check membership
	var exists int
	db.DB.QueryRow("SELECT COUNT(*) FROM server_members WHERE server_id = ? AND user_id = ?", serverID, userID).Scan(&exists)
	if exists == 0 {
		jsonError(w, "Not a member of this server", http.StatusForbidden)
		return
	}

	var s models.ServerSettings
	err := db.DB.QueryRow(`SELECT server_id, afk_channel_id, afk_timeout, system_channel_id,
		system_channel_flags, default_message_notifications, verification_level,
		explicit_content_filter, mfa_level, widget_enabled, widget_channel_id,
		community_enabled, rules_channel_id, public_updates_channel_id,
		welcome_screen_enabled, welcome_screen_description, splash_url, banner_url, discovery_splash_url
		FROM server_settings WHERE server_id = ?`, serverID).Scan(
		&s.ServerID, &s.AFKChannelID, &s.AFKTimeout, &s.SystemChannelID,
		&s.SystemChannelFlags, &s.DefaultMessageNotifications, &s.VerificationLevel,
		&s.ExplicitContentFilter, &s.MFALevel, &s.WidgetEnabled, &s.WidgetChannelID,
		&s.CommunityEnabled, &s.RulesChannelID, &s.PublicUpdatesChannelID,
		&s.WelcomeScreenEnabled, &s.WelcomeScreenDescription, &s.SplashURL, &s.BannerURL, &s.DiscoverySplashURL)
	if err != nil {
		// Create default settings if not found
		db.DB.Exec("INSERT OR IGNORE INTO server_settings (server_id) VALUES (?)", serverID)
		s = models.ServerSettings{
			ServerID:   serverID,
			AFKTimeout: 300,
		}
	}

	jsonResponse(w, http.StatusOK, s)
}

func UpdateServerSettings(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	userID := middleware.GetUserID(r)

	// Check MANAGE_GUILD permission
	if !hasServerPermission(serverID, userID, PermissionManageGuild) {
		jsonError(w, "Missing permission: Manage Server", http.StatusForbidden)
		return
	}

	var s models.ServerSettings
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate verification_level (0-4)
	if s.VerificationLevel < 0 || s.VerificationLevel > 4 {
		jsonError(w, "Verification level must be between 0 and 4", http.StatusBadRequest)
		return
	}

	// Validate explicit_content_filter (0-2)
	if s.ExplicitContentFilter < 0 || s.ExplicitContentFilter > 2 {
		jsonError(w, "Explicit content filter must be between 0 and 2", http.StatusBadRequest)
		return
	}

	// Validate default_message_notifications (0-2)
	if s.DefaultMessageNotifications < 0 || s.DefaultMessageNotifications > 2 {
		jsonError(w, "Default message notifications must be between 0 and 2", http.StatusBadRequest)
		return
	}

	// Validate afk_timeout (positive)
	if s.AFKTimeout < 0 {
		s.AFKTimeout = 300
	}

	_, err := db.DB.Exec(`INSERT INTO server_settings (server_id, afk_channel_id, afk_timeout, system_channel_id,
		system_channel_flags, default_message_notifications, verification_level,
		explicit_content_filter, mfa_level, widget_enabled, widget_channel_id,
		community_enabled, rules_channel_id, public_updates_channel_id,
		welcome_screen_enabled, welcome_screen_description, splash_url, banner_url, discovery_splash_url)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(server_id) DO UPDATE SET
		afk_channel_id=?, afk_timeout=?, system_channel_id=?,
		system_channel_flags=?, default_message_notifications=?, verification_level=?,
		explicit_content_filter=?, mfa_level=?, widget_enabled=?, widget_channel_id=?,
		community_enabled=?, rules_channel_id=?, public_updates_channel_id=?,
		welcome_screen_enabled=?, welcome_screen_description=?, splash_url=?, banner_url=?, discovery_splash_url=?`,
		serverID, s.AFKChannelID, s.AFKTimeout, s.SystemChannelID,
		s.SystemChannelFlags, s.DefaultMessageNotifications, s.VerificationLevel,
		s.ExplicitContentFilter, s.MFALevel, s.WidgetEnabled, s.WidgetChannelID,
		s.CommunityEnabled, s.RulesChannelID, s.PublicUpdatesChannelID,
		s.WelcomeScreenEnabled, s.WelcomeScreenDescription, s.SplashURL, s.BannerURL, s.DiscoverySplashURL,
		// ON CONFLICT update values
		s.AFKChannelID, s.AFKTimeout, s.SystemChannelID,
		s.SystemChannelFlags, s.DefaultMessageNotifications, s.VerificationLevel,
		s.ExplicitContentFilter, s.MFALevel, s.WidgetEnabled, s.WidgetChannelID,
		s.CommunityEnabled, s.RulesChannelID, s.PublicUpdatesChannelID,
		s.WelcomeScreenEnabled, s.WelcomeScreenDescription, s.SplashURL, s.BannerURL, s.DiscoverySplashURL)
	if err != nil {
		jsonError(w, "Failed to update server settings", http.StatusInternalServerError)
		return
	}

	// Create audit log
	createAuditLog(serverID, userID, 1, serverID, "server", map[string]interface{}{
		"settings_updated": true,
	}, "Server settings updated")

	s.ServerID = serverID
	jsonResponse(w, http.StatusOK, s)
}
