package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"raider/db"
	"raider/middleware"

	"github.com/go-chi/chi/v5"
)

// KickMember kicks a member from the server
func KickMember(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	targetUserID := chi.URLParam(r, "userID")
	moderatorID := middleware.GetUserID(r)

	// Check permission (KickMembers)
	if !hasServerPermission(serverID, moderatorID, PermissionKickMembers) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	// Cannot kick owner
	var ownerID string
	db.DB.QueryRow("SELECT owner_id FROM servers WHERE id = ?", serverID).Scan(&ownerID)
	if ownerID == targetUserID {
		jsonError(w, "Cannot kick owner", http.StatusBadRequest)
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	// Remove from server
	db.DB.Exec("DELETE FROM server_members WHERE server_id = ? AND user_id = ?", serverID, targetUserID)
	db.DB.Exec("UPDATE servers SET member_count = member_count - 1 WHERE id = ?", serverID)

	// Audit log
	createAuditLog(serverID, moderatorID, 30, targetUserID, "member", nil, req.Reason)

	jsonResponse(w, http.StatusOK, map[string]string{"status": "kicked"})
}

// BanMember bans a member from the server
func BanMember(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	targetUserID := chi.URLParam(r, "userID")
	moderatorID := middleware.GetUserID(r)

	if !hasServerPermission(serverID, moderatorID, PermissionBanMembers) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	// Cannot ban owner
	var ownerID string
	db.DB.QueryRow("SELECT owner_id FROM servers WHERE id = ?", serverID).Scan(&ownerID)
	if ownerID == targetUserID {
		jsonError(w, "Cannot ban owner", http.StatusBadRequest)
		return
	}

	var req struct {
		Reason   string `json:"reason"`
		Duration int    `json:"duration_minutes"` // 0 = permanent
	}
	json.NewDecoder(r.Body).Decode(&req)

	// Remove from server if member
	db.DB.Exec("DELETE FROM server_members WHERE server_id = ? AND user_id = ?", serverID, targetUserID)
	db.DB.Exec("UPDATE servers SET member_count = member_count - 1 WHERE id = ?", serverID)

	// Add to bans
	var expiresAt interface{}
	if req.Duration > 0 {
		expiresAt = time.Now().Add(time.Duration(req.Duration) * time.Minute)
	}

	db.DB.Exec(`INSERT OR REPLACE INTO server_bans (server_id, user_id, moderator_id, reason, expires_at)
		VALUES (?, ?, ?, ?, ?)`, serverID, targetUserID, moderatorID, req.Reason, expiresAt)

	// Audit log
	createAuditLog(serverID, moderatorID, 32, targetUserID, "member", map[string]interface{}{"expires": req.Duration}, req.Reason)

	jsonResponse(w, http.StatusOK, map[string]string{"status": "banned"})
}

// UnbanMember unbans a user
func UnbanMember(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	targetUserID := chi.URLParam(r, "userID")
	moderatorID := middleware.GetUserID(r)

	if !hasServerPermission(serverID, moderatorID, PermissionBanMembers) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	db.DB.Exec("DELETE FROM server_bans WHERE server_id = ? AND user_id = ?", serverID, targetUserID)

	createAuditLog(serverID, moderatorID, 33, targetUserID, "member", nil, "")

	jsonResponse(w, http.StatusOK, map[string]string{"status": "unbanned"})
}

// TimeoutMember puts a member in timeout (soft mute)
func TimeoutMember(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	targetUserID := chi.URLParam(r, "userID")
	moderatorID := middleware.GetUserID(r)

	if !hasServerPermission(serverID, moderatorID, PermissionMuteMembers) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	var req struct {
		Reason   string `json:"reason"`
		Duration int    `json:"duration_minutes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Duration <= 0 {
		jsonError(w, "Duration required", http.StatusBadRequest)
		return
	}

	expiresAt := time.Now().Add(time.Duration(req.Duration) * time.Minute)
	muteID := generateID()

	db.DB.Exec(`INSERT INTO server_mutes (id, server_id, user_id, moderator_id, reason, expires_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		muteID, serverID, targetUserID, moderatorID, req.Reason, expiresAt)

	createAuditLog(serverID, moderatorID, 22, targetUserID, "member", map[string]interface{}{"expires": req.Duration}, req.Reason)

	jsonResponse(w, http.StatusOK, map[string]string{"status": "muted"})
}

// RemoveTimeout removes a timeout
func RemoveTimeout(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	muteID := chi.URLParam(r, "muteID")
	moderatorID := middleware.GetUserID(r)

	if !hasServerPermission(serverID, moderatorID, PermissionMuteMembers) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	db.DB.Exec("DELETE FROM server_mutes WHERE id = ? AND server_id = ?", muteID, serverID)

	jsonResponse(w, http.StatusOK, map[string]string{"status": "unmuted"})
}

// GetServerBans returns list of banned users
func GetServerBans(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	userID := middleware.GetUserID(r)

	if !hasServerPermission(serverID, userID, PermissionBanMembers) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	rows, err := db.DB.Query(`SELECT b.user_id, b.moderator_id, b.reason, b.created_at, b.expires_at,
		u.username, u.avatar_url
		FROM server_bans b
		JOIN users u ON b.user_id = u.id
		WHERE b.server_id = ?
		ORDER BY b.created_at DESC`, serverID)
	if err != nil {
		jsonError(w, "Failed to fetch bans", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type BanInfo struct {
		UserID     string    `json:"user_id"`
		Username   string    `json:"username"`
		AvatarURL  string    `json:"avatar_url"`
		Reason     string    `json:"reason"`
		CreatedAt  time.Time `json:"created_at"`
		ExpiresAt  *time.Time `json:"expires_at,omitempty"`
		ModeratorID string   `json:"moderator_id"`
	}

	bans := []BanInfo{}
	for rows.Next() {
		var b BanInfo
		var expiresAt interface{}
		rows.Scan(&b.UserID, &b.ModeratorID, &b.Reason, &b.CreatedAt, &expiresAt, &b.Username, &b.AvatarURL)
		if t, ok := expiresAt.(time.Time); ok {
			b.ExpiresAt = &t
		}
		bans = append(bans, b)
	}

	jsonResponse(w, http.StatusOK, bans)
}

// GetAuditLogs returns server audit logs
func GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	userID := middleware.GetUserID(r)

	if !hasServerPermission(serverID, userID, PermissionViewAuditLog) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	rows, err := db.DB.Query(`SELECT a.id, a.user_id, a.action_type, a.target_id, a.target_type,
		a.changes, a.reason, a.created_at, u.username
		FROM server_audit_logs a
		LEFT JOIN users u ON a.user_id = u.id
		WHERE a.server_id = ?
		ORDER BY a.created_at DESC LIMIT 100`, serverID)
	if err != nil {
		jsonError(w, "Failed to fetch audit logs", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type AuditLog struct {
		ID         string          `json:"id"`
		UserID     string          `json:"user_id"`
		Username   string          `json:"username"`
		ActionType int             `json:"action_type"`
		TargetID   string          `json:"target_id"`
		TargetType string          `json:"target_type"`
		Changes    json.RawMessage `json:"changes"`
		Reason     string          `json:"reason"`
		CreatedAt  time.Time       `json:"created_at"`
	}

	logs := []AuditLog{}
	for rows.Next() {
		var log AuditLog
		var changes string
		rows.Scan(&log.ID, &log.UserID, &log.ActionType, &log.TargetID, &log.TargetType, &changes, &log.Reason, &log.CreatedAt, &log.Username)
		log.Changes = json.RawMessage(changes)
		logs = append(logs, log)
	}

	jsonResponse(w, http.StatusOK, logs)
}
