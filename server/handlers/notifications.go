package handlers

import (
	"net/http"
	"time"

	"raider/db"
	"raider/middleware"
	"raider/models"

	"github.com/go-chi/chi/v5"
)

// CreateNotification stores a notification and pushes it live via WebSocket.
// It respects the recipient's notification preferences.
func CreateNotification(recipientID, notifType, title, body, link string) {
	var allowed bool
	switch notifType {
	case "dm":
		db.DB.QueryRow("SELECT notification_dms FROM user_settings WHERE user_id = ?", recipientID).Scan(&allowed)
	case "follow":
		db.DB.QueryRow("SELECT notification_follows FROM user_settings WHERE user_id = ?", recipientID).Scan(&allowed)
	case "handshake":
		db.DB.QueryRow("SELECT notification_handshakes FROM user_settings WHERE user_id = ?", recipientID).Scan(&allowed)
	case "comment", "reply":
		db.DB.QueryRow("SELECT notification_comments FROM user_settings WHERE user_id = ?", recipientID).Scan(&allowed)
	case "mention":
		db.DB.QueryRow("SELECT notification_mentions FROM user_settings WHERE user_id = ?", recipientID).Scan(&allowed)
	case "call":
		db.DB.QueryRow("SELECT notification_calls FROM user_settings WHERE user_id = ?", recipientID).Scan(&allowed)
	case "post_vote":
		db.DB.QueryRow("SELECT notification_post_votes FROM user_settings WHERE user_id = ?", recipientID).Scan(&allowed)
	case "group_message":
		db.DB.QueryRow("SELECT notification_group_messages FROM user_settings WHERE user_id = ?", recipientID).Scan(&allowed)
	default:
		allowed = true
	}

	if !allowed {
		return
	}

	id := generateID()
	_, err := db.DB.Exec(
		`INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?, ?)`,
		id, recipientID, notifType, title, body, link)
	if err != nil {
		return
	}

	n := models.Notification{
		ID:        id,
		UserID:    recipientID,
		Type:      notifType,
		Title:     title,
		Body:      body,
		Link:      link,
		Read:      false,
		CreatedAt: time.Now(),
	}
	Hub.SendToUser(recipientID, models.WSMessage{Type: "new_notification", Payload: n})
}

func GetNotifications(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := db.DB.Query(
		`SELECT id, user_id, type, title, body, link, read, created_at
		 FROM notifications WHERE user_id = ?
		 ORDER BY created_at DESC LIMIT 100`, userID)
	if err != nil {
		jsonResponse(w, http.StatusOK, []models.Notification{})
		return
	}
	defer rows.Close()

	notifs := []models.Notification{}
	for rows.Next() {
		var n models.Notification
		rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Body, &n.Link, &n.Read, &n.CreatedAt)
		notifs = append(notifs, n)
	}
	jsonResponse(w, http.StatusOK, notifs)
}

func GetUnreadNotificationCount(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var count int
	db.DB.QueryRow("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read = 0", userID).Scan(&count)
	jsonResponse(w, http.StatusOK, map[string]int{"count": count})
}

func MarkNotificationRead(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	id := chi.URLParam(r, "id")
	db.DB.Exec("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?", id, userID)
	jsonResponse(w, http.StatusOK, map[string]string{"status": "ok"})
}

func MarkAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	db.DB.Exec("UPDATE notifications SET read = 1 WHERE user_id = ?", userID)
	jsonResponse(w, http.StatusOK, map[string]string{"status": "ok"})
}

func DeleteNotification(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	id := chi.URLParam(r, "id")
	db.DB.Exec("DELETE FROM notifications WHERE id = ? AND user_id = ?", id, userID)
	jsonResponse(w, http.StatusOK, map[string]string{"status": "ok"})
}

func ClearAllNotifications(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	db.DB.Exec("DELETE FROM notifications WHERE user_id = ?", userID)
	jsonResponse(w, http.StatusOK, map[string]string{"status": "ok"})
}
