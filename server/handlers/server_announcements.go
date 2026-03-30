package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"raider/db"
	"raider/middleware"

	"github.com/go-chi/chi/v5"
)

// PermissionPostAnnouncements - special permission for posting server announcements
const PermissionPostAnnouncements = 0x100000000

// GetServerAnnouncement returns the active announcement for a server
func GetServerAnnouncement(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	userID := middleware.GetUserID(r)

	// Check membership
	var memberCount int
	db.DB.QueryRow("SELECT COUNT(*) FROM server_members WHERE server_id = ? AND user_id = ?", serverID, userID).Scan(&memberCount)
	if memberCount == 0 {
		jsonError(w, "Not a member", http.StatusForbidden)
		return
	}

	var announcement struct {
		ID        string     `json:"id"`
		ServerID  string     `json:"server_id"`
		AuthorID  string     `json:"author_id"`
		AuthorName string    `json:"author_name"`
		Content   string     `json:"content"`
		Color     string     `json:"color"`
		Icon      string     `json:"icon"`
		Active    bool       `json:"active"`
		PinUntil  *time.Time `json:"pin_until,omitempty"`
		CreatedAt time.Time  `json:"created_at"`
		UpdatedAt time.Time  `json:"updated_at"`
	}

	err := db.DB.QueryRow(`SELECT a.id, a.server_id, a.author_id, u.username, a.content, a.color, a.icon, a.active, a.pin_until, a.created_at, a.updated_at
		FROM server_announcements a
		JOIN users u ON a.author_id = u.id
		WHERE a.server_id = ? AND a.active = 1
		AND (a.pin_until IS NULL OR a.pin_until > datetime('now'))
		ORDER BY a.created_at DESC LIMIT 1`, serverID).Scan(
		&announcement.ID, &announcement.ServerID, &announcement.AuthorID, &announcement.AuthorName,
		&announcement.Content, &announcement.Color, &announcement.Icon, &announcement.Active,
		&announcement.PinUntil, &announcement.CreatedAt, &announcement.UpdatedAt)

	if err != nil {
		// No active announcement - return empty
		jsonResponse(w, http.StatusOK, nil)
		return
	}

	jsonResponse(w, http.StatusOK, announcement)
}

// GetServerAnnouncementsHistory returns all announcements history
func GetServerAnnouncementsHistory(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	userID := middleware.GetUserID(r)

	// Check membership
	var memberCount int
	db.DB.QueryRow("SELECT COUNT(*) FROM server_members WHERE server_id = ? AND user_id = ?", serverID, userID).Scan(&memberCount)
	if memberCount == 0 {
		jsonError(w, "Not a member", http.StatusForbidden)
		return
	}

	rows, err := db.DB.Query(`SELECT a.id, a.server_id, a.author_id, u.username, a.content, a.color, a.icon, a.active, a.pin_until, a.created_at, a.updated_at
		FROM server_announcements a
		JOIN users u ON a.author_id = u.id
		WHERE a.server_id = ?
		ORDER BY a.created_at DESC LIMIT 50`, serverID)
	if err != nil {
		jsonError(w, "Failed to fetch announcements", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	announcements := []map[string]interface{}{}
	for rows.Next() {
		var a map[string]interface{}
		var pinUntil interface{}
		rows.Scan(&a["id"], &a["server_id"], &a["author_id"], &a["author_name"],
			&a["content"], &a["color"], &a["icon"], &a["active"],
			&pinUntil, &a["created_at"], &a["updated_at"])
		a["pin_until"] = pinUntil
		announcements = append(announcements, a)
	}

	jsonResponse(w, http.StatusOK, announcements)
}

// CreateServerAnnouncement creates a new server announcement
func CreateServerAnnouncement(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	userID := middleware.GetUserID(r)

	// Check if user has permission to post announcements
	// Owner always can, or check role permission
	var ownerID string
	db.DB.QueryRow("SELECT owner_id FROM servers WHERE id = ?", serverID).Scan(&ownerID)
	
	if ownerID != userID {
		// Check role permission
		var hasPerm int
		db.DB.QueryRow(`SELECT 1 FROM server_member_roles mr
			JOIN server_roles r ON mr.role_id = r.id
			WHERE mr.server_id = ? AND mr.user_id = ? AND (r.permissions & ?) != 0`,
			serverID, userID, PermissionPostAnnouncements).Scan(&hasPerm)
		if hasPerm == 0 {
			jsonError(w, "Missing permission to post announcements", http.StatusForbidden)
			return
		}
	}

	var req struct {
		Content  string `json:"content"`
		Color    string `json:"color"`
		Icon     string `json:"icon"`
		PinHours int    `json:"pin_hours"` // 0 = permanent
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Content == "" {
		jsonError(w, "Content required", http.StatusBadRequest)
		return
	}

	// Default values
	if req.Color == "" {
		req.Color = "#6366f1"
	}
	if req.Icon == "" {
		req.Icon = "📢"
	}

	// Deactivate previous announcements
	db.DB.Exec("UPDATE server_announcements SET active = 0 WHERE server_id = ?", serverID)

	// Create new announcement
	announcementID := generateID()
	var pinUntil interface{}
	if req.PinHours > 0 {
		pinUntil = time.Now().Add(time.Duration(req.PinHours) * time.Hour)
	}

	_, err := db.DB.Exec(`INSERT INTO server_announcements (id, server_id, author_id, content, color, icon, active, pin_until)
		VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
		announcementID, serverID, userID, req.Content, req.Color, req.Icon, pinUntil)
	if err != nil {
		jsonError(w, "Failed to create announcement", http.StatusInternalServerError)
		return
	}

	// Audit log
	createAuditLog(serverID, userID, 74, announcementID, "announcement", map[string]interface{}{"content_preview": req.Content[:min(50, len(req.Content))]}, "")

	// Get author name
	var authorName string
	db.DB.QueryRow("SELECT username FROM users WHERE id = ?", userID).Scan(&authorName)

	announcement := map[string]interface{}{
		"id":         announcementID,
		"server_id":  serverID,
		"author_id":  userID,
		"author_name": authorName,
		"content":    req.Content,
		"color":      req.Color,
		"icon":       req.Icon,
		"active":     true,
		"pin_until":  pinUntil,
		"created_at": time.Now(),
	}

	jsonResponse(w, http.StatusCreated, announcement)
}

// UpdateServerAnnouncement updates an announcement
func UpdateServerAnnouncement(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	announcementID := chi.URLParam(r, "announcementID")
	userID := middleware.GetUserID(r)

	// Check permission
	var ownerID string
	db.DB.QueryRow("SELECT owner_id FROM servers WHERE id = ?", serverID).Scan(&ownerID)
	
	if ownerID != userID {
		jsonError(w, "Only owner can edit announcements", http.StatusForbidden)
		return
	}

	var req struct {
		Content *string `json:"content"`
		Color   *string `json:"color"`
		Icon    *string `json:"icon"`
		Active  *bool   `json:"active"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if req.Content != nil {
		db.DB.Exec("UPDATE server_announcements SET content = ?, updated_at = datetime('now') WHERE id = ?", *req.Content, announcementID)
	}
	if req.Color != nil {
		db.DB.Exec("UPDATE server_announcements SET color = ?, updated_at = datetime('now') WHERE id = ?", *req.Color, announcementID)
	}
	if req.Icon != nil {
		db.DB.Exec("UPDATE server_announcements SET icon = ?, updated_at = datetime('now') WHERE id = ?", *req.Icon, announcementID)
	}
	if req.Active != nil {
		activeVal := 0
		if *req.Active {
			activeVal = 1
		}
		db.DB.Exec("UPDATE server_announcements SET active = ?, updated_at = datetime('now') WHERE id = ?", activeVal, announcementID)
	}

	createAuditLog(serverID, userID, 74, announcementID, "announcement", req, "")

	jsonResponse(w, http.StatusOK, map[string]string{"status": "updated"})
}

// DeleteServerAnnouncement removes an announcement
func DeleteServerAnnouncement(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	announcementID := chi.URLParam(r, "announcementID")
	userID := middleware.GetUserID(r)

	// Check permission
	var ownerID string
	db.DB.QueryRow("SELECT owner_id FROM servers WHERE id = ?", serverID).Scan(&ownerID)
	
	if ownerID != userID {
		jsonError(w, "Only owner can delete announcements", http.StatusForbidden)
		return
	}

	db.DB.Exec("DELETE FROM server_announcements WHERE id = ?", announcementID)

	createAuditLog(serverID, userID, 75, announcementID, "announcement", nil, "")

	jsonResponse(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
