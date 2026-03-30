package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"raider/crypto"
	"raider/db"
	"raider/middleware"
	"raider/models"

	"github.com/go-chi/chi/v5"
)

func CreateServer(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req models.CreateServerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		jsonError(w, "Server name is required", http.StatusBadRequest)
		return
	}

	// Generate server keypair
	pubKey, _, err := crypto.GenerateKeyPair(128)
	if err != nil {
		jsonError(w, "Failed to generate server keys", http.StatusInternalServerError)
		return
	}

	serverID := generateID()
	_, err = db.DB.Exec(`INSERT INTO servers (id, name, description, owner_id, public_key, member_count) VALUES (?, ?, ?, ?, ?, 1)`,
		serverID, req.Name, req.Description, userID, pubKey)
	if err != nil {
		jsonError(w, "Failed to create server", http.StatusInternalServerError)
		return
	}

	// Get user's public key for handshake token
	var userPubKey []byte
	db.DB.QueryRow("SELECT public_key FROM users WHERE id = ?", userID).Scan(&userPubKey)
	token := crypto.GenerateHandshakeToken(userPubKey, pubKey)

	// Add owner as member
	db.DB.Exec(`INSERT INTO server_members (server_id, user_id, role, handshake_token) VALUES (?, ?, 'owner', ?)`,
		serverID, userID, token)

	// Create default channel
	channelID := generateID()
	db.DB.Exec(`INSERT INTO channels (id, server_id, name, type, position) VALUES (?, ?, 'general', 'text', 0)`,
		channelID, serverID)

	// Update stats
	db.DB.Exec("UPDATE user_stats SET servers_joined = servers_joined + 1 WHERE user_id = ?", userID)
	addXP(userID, 25)

	server := models.Server{
		ID:           serverID,
		Name:         req.Name,
		Description:  req.Description,
		OwnerID:      userID,
		PublicKey:    pubKey,
		MemberCount:  1,
		AllowSharing: true,
	}

	jsonResponse(w, http.StatusCreated, server)
}

func GetServers(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := db.DB.Query(`SELECT s.id, s.name, s.description, s.icon_url, s.owner_id, s.member_count, s.allow_sharing, s.created_at,
		sm.role, sm.handshake_token
		FROM servers s
		JOIN server_members sm ON s.id = sm.server_id
		WHERE sm.user_id = ?
		ORDER BY s.name`, userID)
	if err != nil {
		jsonError(w, "Failed to fetch servers", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type ServerWithRole struct {
		models.Server
		Role           string `json:"role"`
		HandshakeToken string `json:"handshake_token"`
	}

	servers := []ServerWithRole{}
	for rows.Next() {
		var s ServerWithRole
		rows.Scan(&s.ID, &s.Name, &s.Description, &s.IconURL, &s.OwnerID, &s.MemberCount, &s.AllowSharing, &s.CreatedAt,
			&s.Role, &s.HandshakeToken)
		servers = append(servers, s)
	}

	jsonResponse(w, http.StatusOK, servers)
}

func GetServer(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")

	var server models.Server
	err := db.DB.QueryRow(`SELECT id, name, description, icon_url, owner_id, member_count, allow_sharing, created_at
		FROM servers WHERE id = ?`, serverID).Scan(
		&server.ID, &server.Name, &server.Description, &server.IconURL, &server.OwnerID, &server.MemberCount, &server.AllowSharing, &server.CreatedAt)
	if err != nil {
		jsonError(w, "Server not found", http.StatusNotFound)
		return
	}

	jsonResponse(w, http.StatusOK, server)
}

func JoinServer(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	serverID := chi.URLParam(r, "serverID")

	// Check if already a member
	var exists int
	db.DB.QueryRow("SELECT COUNT(*) FROM server_members WHERE server_id = ? AND user_id = ?", serverID, userID).Scan(&exists)
	if exists > 0 {
		jsonError(w, "Already a member", http.StatusConflict)
		return
	}

	// Get server's public key
	var serverPubKey []byte
	err := db.DB.QueryRow("SELECT public_key FROM servers WHERE id = ?", serverID).Scan(&serverPubKey)
	if err != nil {
		jsonError(w, "Server not found", http.StatusNotFound)
		return
	}

	// Get user's public key
	var userPubKey []byte
	db.DB.QueryRow("SELECT public_key FROM users WHERE id = ?", userID).Scan(&userPubKey)

	// Generate handshake token (server handshake)
	token := crypto.GenerateHandshakeToken(userPubKey, serverPubKey)

	_, err = db.DB.Exec(`INSERT INTO server_members (server_id, user_id, role, handshake_token) VALUES (?, ?, 'member', ?)`,
		serverID, userID, token)
	if err != nil {
		jsonError(w, "Failed to join server", http.StatusInternalServerError)
		return
	}

	db.DB.Exec("UPDATE servers SET member_count = member_count + 1 WHERE id = ?", serverID)
	db.DB.Exec("UPDATE user_stats SET servers_joined = servers_joined + 1 WHERE user_id = ?", userID)
	addXP(userID, 10)

	jsonResponse(w, http.StatusOK, map[string]string{
		"status":          "joined",
		"handshake_token": token,
	})
}

func LeaveServer(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	serverID := chi.URLParam(r, "serverID")

	// Check if owner
	var ownerID string
	db.DB.QueryRow("SELECT owner_id FROM servers WHERE id = ?", serverID).Scan(&ownerID)
	if ownerID == userID {
		jsonError(w, "Owner cannot leave server. Transfer ownership first.", http.StatusBadRequest)
		return
	}

	db.DB.Exec("DELETE FROM server_members WHERE server_id = ? AND user_id = ?", serverID, userID)
	db.DB.Exec("UPDATE servers SET member_count = member_count - 1 WHERE id = ?", serverID)

	jsonResponse(w, http.StatusOK, map[string]string{"status": "left"})
}

func GetChannels(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")

	rows, err := db.DB.Query(`SELECT id, server_id, name, type, position, created_at FROM channels WHERE server_id = ? ORDER BY position`, serverID)
	if err != nil {
		jsonError(w, "Failed to fetch channels", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	channels := []models.Channel{}
	for rows.Next() {
		var c models.Channel
		rows.Scan(&c.ID, &c.ServerID, &c.Name, &c.Type, &c.Position, &c.CreatedAt)
		channels = append(channels, c)
	}

	jsonResponse(w, http.StatusOK, channels)
}

func CreateChannel(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	serverID := chi.URLParam(r, "serverID")

	// Check if user is owner or admin
	var role string
	err := db.DB.QueryRow("SELECT role FROM server_members WHERE server_id = ? AND user_id = ?", serverID, userID).Scan(&role)
	if err != nil || (role != "owner" && role != "admin") {
		jsonError(w, "Not authorized", http.StatusForbidden)
		return
	}

	var req models.CreateChannelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Type == "" {
		req.Type = "text"
	}

	channelID := generateID()
	_, err = db.DB.Exec(`INSERT INTO channels (id, server_id, name, type) VALUES (?, ?, ?, ?)`,
		channelID, serverID, req.Name, req.Type)
	if err != nil {
		jsonError(w, "Failed to create channel", http.StatusInternalServerError)
		return
	}

	channel := models.Channel{ID: channelID, ServerID: serverID, Name: req.Name, Type: req.Type}
	jsonResponse(w, http.StatusCreated, channel)
}

func GetServerMembers(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")

	rows, err := db.DB.Query(`SELECT u.id, u.username, u.display_name, u.avatar_url, u.avatar_type, u.level, sm.role
		FROM users u JOIN server_members sm ON u.id = sm.user_id
		WHERE sm.server_id = ?
		ORDER BY sm.role, u.username`, serverID)
	if err != nil {
		jsonError(w, "Failed to fetch members", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Member struct {
		ID          string `json:"id"`
		Username    string `json:"username"`
		DisplayName string `json:"display_name"`
		AvatarURL   string `json:"avatar_url"`
		AvatarType  string `json:"avatar_type"`
		Level       int    `json:"level"`
		Role        string `json:"role"`
	}

	members := []Member{}
	for rows.Next() {
		var m Member
		rows.Scan(&m.ID, &m.Username, &m.DisplayName, &m.AvatarURL, &m.AvatarType, &m.Level, &m.Role)
		members = append(members, m)
	}

	jsonResponse(w, http.StatusOK, members)
}

func DiscoverServers(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	q := r.URL.Query().Get("q")
	sort := r.URL.Query().Get("sort") // "popular" or "relevant"

	var rows *sql.Rows
	var err error

	if q != "" {
		// Search mode - match name/description, order by member_count for relevance
		searchTerm := "%" + q + "%"
		rows, err = db.DB.Query(`SELECT id, name, description, icon_url, owner_id, member_count, allow_sharing, created_at
			FROM servers
			WHERE (name LIKE ? OR description LIKE ?)
			AND id NOT IN (SELECT server_id FROM server_members WHERE user_id = ?)
			ORDER BY member_count DESC LIMIT 50`, searchTerm, searchTerm, userID)
	} else if sort == "relevant" {
		// Relevance - could use more sophisticated scoring later
		rows, err = db.DB.Query(`SELECT id, name, description, icon_url, owner_id, member_count, allow_sharing, created_at
			FROM servers
			WHERE id NOT IN (SELECT server_id FROM server_members WHERE user_id = ?)
			ORDER BY member_count DESC, created_at DESC LIMIT 50`, userID)
	} else {
		// Default: popular (by member_count)
		rows, err = db.DB.Query(`SELECT id, name, description, icon_url, owner_id, member_count, allow_sharing, created_at
			FROM servers
			WHERE id NOT IN (SELECT server_id FROM server_members WHERE user_id = ?)
			ORDER BY member_count DESC LIMIT 50`, userID)
	}

	if err != nil {
		jsonError(w, "Failed to discover servers", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	servers := []models.Server{}
	for rows.Next() {
		var s models.Server
		rows.Scan(&s.ID, &s.Name, &s.Description, &s.IconURL, &s.OwnerID, &s.MemberCount, &s.AllowSharing, &s.CreatedAt)
		servers = append(servers, s)
	}

	jsonResponse(w, http.StatusOK, servers)
}

func UpdateServer(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	serverID := chi.URLParam(r, "serverID")

	// Check if owner
	var ownerID string
	err := db.DB.QueryRow("SELECT owner_id FROM servers WHERE id = ?", serverID).Scan(&ownerID)
	if err != nil {
		jsonError(w, "Server not found", http.StatusNotFound)
		return
	}
	if ownerID != userID {
		jsonError(w, "Only owner can update server", http.StatusForbidden)
		return
	}

	var req struct {
		Name            *string `json:"name"`
		Description     *string `json:"description"`
		IconURL         *string `json:"icon_url"`
		IsPrivate       *bool   `json:"is_private"`
		AllowSharing    *bool   `json:"allow_sharing"`
		AntispamEnabled *bool   `json:"antispam_enabled"`
		SlowmodeSeconds *int    `json:"slowmode_seconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name != nil {
		db.DB.Exec("UPDATE servers SET name = ? WHERE id = ?", *req.Name, serverID)
	}
	if req.Description != nil {
		db.DB.Exec("UPDATE servers SET description = ? WHERE id = ?", *req.Description, serverID)
	}
	if req.IconURL != nil {
		db.DB.Exec("UPDATE servers SET icon_url = ? WHERE id = ?", *req.IconURL, serverID)
	}

	jsonResponse(w, http.StatusOK, map[string]string{"status": "updated"})
}

func DeleteServer(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	serverID := chi.URLParam(r, "serverID")

	// Check if owner
	var ownerID string
	err := db.DB.QueryRow("SELECT owner_id FROM servers WHERE id = ?", serverID).Scan(&ownerID)
	if err != nil {
		jsonError(w, "Server not found", http.StatusNotFound)
		return
	}
	if ownerID != userID {
		jsonError(w, "Only owner can delete server", http.StatusForbidden)
		return
	}

	// Delete server and all related data (cascade handles members, channels, etc)
	db.DB.Exec("DELETE FROM servers WHERE id = ?", serverID)

	jsonResponse(w, http.StatusOK, map[string]string{"status": "deleted"})
}
