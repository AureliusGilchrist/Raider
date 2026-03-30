package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"raider/crypto"
	"raider/db"
	"raider/middleware"

	"github.com/go-chi/chi/v5"
)

// generateInviteCode creates a random invite code
func generateInviteCode() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// CreateInvite creates a new invite for a server
func CreateInvite(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	userID := middleware.GetUserID(r)

	// Check permission (CreateInstantInvite)
	if !hasServerPermission(serverID, userID, PermissionCreateInstantInvite) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	var req struct {
		ChannelID string `json:"channel_id"`
		MaxUses   int    `json:"max_uses"`
		MaxAge    int    `json:"max_age_seconds"` // 0 = never expires
		Temporary bool   `json:"temporary"`       // Grant temporary membership
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request", http.StatusBadRequest)
		return
	}

	code := generateInviteCode()
	var expiresAt interface{}
	if req.MaxAge > 0 {
		expiresAt = time.Now().Add(time.Duration(req.MaxAge) * time.Second)
	}

	_, err := db.DB.Exec(`INSERT INTO server_invites (code, server_id, channel_id, inviter_id, max_uses, max_age, temporary, expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		code, serverID, req.ChannelID, userID, req.MaxUses, req.MaxAge, req.Temporary, expiresAt)
	if err != nil {
		jsonError(w, "Failed to create invite", http.StatusInternalServerError)
		return
	}

	createAuditLog(serverID, userID, 60, code, "invite", map[string]interface{}{"channel_id": req.ChannelID}, "")

	invite := map[string]interface{}{
		"code":       code,
		"server_id":  serverID,
		"channel_id": req.ChannelID,
		"inviter_id": userID,
		"max_uses":   req.MaxUses,
		"max_age":    req.MaxAge,
		"temporary":  req.Temporary,
		"uses":       0,
	}
	jsonResponse(w, http.StatusCreated, invite)
}

// GetServerInvites returns all invites for a server
func GetServerInvites(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	userID := middleware.GetUserID(r)

	// Need ManageChannels to view all invites
	if !hasServerPermission(serverID, userID, PermissionManageChannels) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	rows, err := db.DB.Query(`SELECT i.code, i.server_id, i.channel_id, i.inviter_id, i.uses, i.max_uses,
		i.max_age, i.temporary, i.created_at, i.expires_at, u.username as inviter_name
		FROM server_invites i
		JOIN users u ON i.inviter_id = u.id
		WHERE i.server_id = ?
		ORDER BY i.created_at DESC`, serverID)
	if err != nil {
		jsonError(w, "Failed to fetch invites", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	invites := []map[string]interface{}{}
	for rows.Next() {
		var code, serverID2, channelID, inviterID, inviterName string
		var uses, maxUses, maxAge, temporary int
		var createdAt, expiresAt interface{}
		rows.Scan(&code, &serverID2, &channelID, &inviterID, &uses, &maxUses,
			&maxAge, &temporary, &createdAt, &expiresAt, &inviterName)
		invites = append(invites, map[string]interface{}{
			"code":         code,
			"server_id":    serverID2,
			"channel_id":   channelID,
			"inviter_id":   inviterID,
			"uses":         uses,
			"max_uses":     maxUses,
			"max_age":      maxAge,
			"temporary":    temporary,
			"created_at":   createdAt,
			"expires_at":   expiresAt,
			"inviter_name": inviterName,
		})
	}

	jsonResponse(w, http.StatusOK, invites)
}

// DeleteInvite deletes an invite
func DeleteInvite(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	userID := middleware.GetUserID(r)

	var serverID string
	db.DB.QueryRow("SELECT server_id FROM server_invites WHERE code = ?", code).Scan(&serverID)

	if !hasServerPermission(serverID, userID, PermissionManageChannels) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	db.DB.Exec("DELETE FROM server_invites WHERE code = ?", code)

	createAuditLog(serverID, userID, 62, code, "invite", nil, "")

	jsonResponse(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// UseInvite handles joining a server via invite
func UseInvite(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	userID := middleware.GetUserID(r)

	// Get invite details
	var serverID, channelID string
	var maxUses, uses int
	var expiresAt interface{}
	var temporary int
	err := db.DB.QueryRow(`SELECT server_id, channel_id, max_uses, uses, expires_at, temporary
		FROM server_invites WHERE code = ?`, code).Scan(&serverID, &channelID, &maxUses, &uses, &expiresAt, &temporary)
	if err != nil {
		jsonError(w, "Invalid invite", http.StatusNotFound)
		return
	}

	// Check if expired
	if t, ok := expiresAt.(time.Time); ok && time.Now().After(t) {
		jsonError(w, "Invite expired", http.StatusGone)
		return
	}

	// Check max uses
	if maxUses > 0 && uses >= maxUses {
		jsonError(w, "Invite max uses reached", http.StatusGone)
		return
	}

	// Check if already member
	var memberCount int
	db.DB.QueryRow("SELECT COUNT(*) FROM server_members WHERE server_id = ? AND user_id = ?", serverID, userID).Scan(&memberCount)
	if memberCount > 0 {
		jsonError(w, "Already a member", http.StatusConflict)
		return
	}

	// Check if banned
	var banCount int
	db.DB.QueryRow("SELECT COUNT(*) FROM server_bans WHERE server_id = ? AND user_id = ?", serverID, userID).Scan(&banCount)
	if banCount > 0 {
		jsonError(w, "You are banned from this server", http.StatusForbidden)
		return
	}

	// Get server's public key
	var serverPubKey []byte
	db.DB.QueryRow("SELECT public_key FROM servers WHERE id = ?", serverID).Scan(&serverPubKey)

	// Get user's public key
	var userPubKey []byte
	db.DB.QueryRow("SELECT public_key FROM users WHERE id = ?", userID).Scan(&userPubKey)

	// Generate handshake token (server handshake)
	token := crypto.GenerateHandshakeToken(userPubKey, serverPubKey)

	// Add member
	db.DB.Exec(`INSERT INTO server_members (server_id, user_id, handshake_token) VALUES (?, ?, ?)`,
		serverID, userID, token)
	db.DB.Exec("UPDATE servers SET member_count = member_count + 1 WHERE id = ?", serverID)

	// Update invite uses
	db.DB.Exec("UPDATE server_invites SET uses = uses + 1 WHERE code = ?", code)

	// Auto-delete if max uses reached
	if maxUses > 0 && uses+1 >= maxUses {
		db.DB.Exec("DELETE FROM server_invites WHERE code = ?", code)
	}

	jsonResponse(w, http.StatusOK, map[string]string{
		"status":          "joined",
		"server_id":       serverID,
		"handshake_token": token,
	})
}

// GetInvite returns invite details (for preview)
func GetInvite(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")

	var serverID, serverName, serverIcon string
	var memberCount int
	var inviterName string

	row := db.DB.QueryRow(`SELECT i.server_id, s.name, s.icon_url, s.member_count, u.username
		FROM server_invites i
		JOIN servers s ON i.server_id = s.id
		JOIN users u ON i.inviter_id = u.id
		WHERE i.code = ?`, code)
	if err := row.Scan(&serverID, &serverName, &serverIcon, &memberCount, &inviterName); err != nil {
		jsonError(w, "Invalid invite", http.StatusNotFound)
		return
	}

	invite := map[string]interface{}{
		"code":         code,
		"server": map[string]interface{}{
			"id":           serverID,
			"name":         serverName,
			"icon_url":     serverIcon,
			"member_count": memberCount,
		},
		"inviter": map[string]interface{}{
			"username": inviterName,
		},
	}

	jsonResponse(w, http.StatusOK, invite)
}
