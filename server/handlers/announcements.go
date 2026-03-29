package handlers

import (
	"encoding/json"
	"net/http"

	"raider/db"
	"raider/middleware"
	"raider/models"

	"github.com/go-chi/chi/v5"
)

func GetAnnouncements(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := db.DB.Query(`SELECT a.id, a.author_id, a.server_id, a.content, a.type, a.active, a.created_at, a.expires_at
		FROM announcements a
		WHERE a.active = 1
		AND (a.expires_at IS NULL OR a.expires_at > datetime('now'))
		AND a.id NOT IN (SELECT announcement_id FROM announcement_dismissals WHERE user_id = ?)
		ORDER BY a.created_at DESC`, userID)
	if err != nil {
		jsonError(w, "Failed to fetch announcements", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	announcements := []models.Announcement{}
	for rows.Next() {
		var a models.Announcement
		rows.Scan(&a.ID, &a.AuthorID, &a.ServerID, &a.Content, &a.Type, &a.Active, &a.CreatedAt, &a.ExpiresAt)
		announcements = append(announcements, a)
	}

	jsonResponse(w, http.StatusOK, announcements)
}

func CreateAnnouncement(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		Content   string  `json:"content"`
		Type      string  `json:"type"`
		ServerID  *string `json:"server_id"`
		ExpiresAt *string `json:"expires_at"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Content == "" {
		jsonError(w, "Content is required", http.StatusBadRequest)
		return
	}
	if req.Type == "" {
		req.Type = "info"
	}

	// If server_id is provided, check user is owner/admin
	if req.ServerID != nil {
		var role string
		err := db.DB.QueryRow("SELECT role FROM server_members WHERE server_id = ? AND user_id = ?",
			*req.ServerID, userID).Scan(&role)
		if err != nil || (role != "owner" && role != "admin") {
			jsonError(w, "Not authorized to create announcements for this server", http.StatusForbidden)
			return
		}
	}

	id := generateID()
	_, err := db.DB.Exec(`INSERT INTO announcements (id, author_id, server_id, content, type, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
		id, userID, req.ServerID, req.Content, req.Type, req.ExpiresAt)
	if err != nil {
		jsonError(w, "Failed to create announcement", http.StatusInternalServerError)
		return
	}

	a := models.Announcement{
		ID:        id,
		AuthorID:  userID,
		ServerID:  req.ServerID,
		Content:   req.Content,
		Type:      req.Type,
		Active:    true,
		ExpiresAt: req.ExpiresAt,
	}

	jsonResponse(w, http.StatusCreated, a)
}

func DismissAnnouncement(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	announcementID := chi.URLParam(r, "id")

	db.DB.Exec(`INSERT OR IGNORE INTO announcement_dismissals (announcement_id, user_id) VALUES (?, ?)`,
		announcementID, userID)

	jsonResponse(w, http.StatusOK, map[string]string{"status": "dismissed"})
}

func DeleteAnnouncement(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	announcementID := chi.URLParam(r, "id")

	// Check ownership
	var authorID string
	err := db.DB.QueryRow("SELECT author_id FROM announcements WHERE id = ?", announcementID).Scan(&authorID)
	if err != nil {
		jsonError(w, "Announcement not found", http.StatusNotFound)
		return
	}
	if authorID != userID {
		jsonError(w, "Not authorized", http.StatusForbidden)
		return
	}

	db.DB.Exec("UPDATE announcements SET active = 0 WHERE id = ?", announcementID)
	jsonResponse(w, http.StatusOK, map[string]string{"status": "deactivated"})
}
