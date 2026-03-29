package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"raider/db"
	"raider/middleware"
	"raider/models"
)

func InitiateHandshake(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req models.HandshakeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.TargetUserID == userID {
		jsonError(w, "Cannot handshake with yourself", http.StatusBadRequest)
		return
	}

	// Check if target user exists
	var exists int
	db.DB.QueryRow("SELECT COUNT(*) FROM users WHERE id = ?", req.TargetUserID).Scan(&exists)
	if exists == 0 {
		jsonError(w, "User not found", http.StatusNotFound)
		return
	}

	// Check for existing handshake (in either direction)
	var existing string
	err := db.DB.QueryRow(`SELECT id FROM handshakes 
		WHERE ((initiator_id = ? AND responder_id = ?) OR (initiator_id = ? AND responder_id = ?))
		AND status = 'completed'
		AND last_renewed > datetime('now', '-7 days')`,
		userID, req.TargetUserID, req.TargetUserID, userID).Scan(&existing)
	if err == nil {
		jsonError(w, "Active handshake already exists (can renew after 7 days)", http.StatusConflict)
		return
	}

	// Check for pending handshake
	err = db.DB.QueryRow(`SELECT id FROM handshakes 
		WHERE ((initiator_id = ? AND responder_id = ?) OR (initiator_id = ? AND responder_id = ?))
		AND status = 'pending'`,
		userID, req.TargetUserID, req.TargetUserID, userID).Scan(&existing)
	if err == nil {
		jsonError(w, "Handshake already pending", http.StatusConflict)
		return
	}

	// Delete old expired handshakes between these users
	db.DB.Exec(`DELETE FROM handshakes 
		WHERE ((initiator_id = ? AND responder_id = ?) OR (initiator_id = ? AND responder_id = ?))`,
		userID, req.TargetUserID, req.TargetUserID, userID)

	id := generateID()
	_, err = db.DB.Exec(`INSERT INTO handshakes (id, initiator_id, responder_id, status) VALUES (?, ?, ?, 'pending')`,
		id, userID, req.TargetUserID)
	if err != nil {
		jsonError(w, "Failed to create handshake", http.StatusInternalServerError)
		return
	}

	hs := models.Handshake{
		ID:          id,
		InitiatorID: userID,
		ResponderID: req.TargetUserID,
		Status:      "pending",
		InitiatedAt: time.Now(),
	}

	// Notify via WebSocket
	Hub.SendToUser(req.TargetUserID, models.WSMessage{
		Type:    "handshake_request",
		Payload: hs,
	})

	jsonResponse(w, http.StatusCreated, hs)
}

func AcceptHandshake(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req models.HandshakeAcceptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Verify handshake exists and user is the responder
	var hs models.Handshake
	err := db.DB.QueryRow(`SELECT id, initiator_id, responder_id, status FROM handshakes WHERE id = ?`,
		req.HandshakeID).Scan(&hs.ID, &hs.InitiatorID, &hs.ResponderID, &hs.Status)
	if err != nil {
		jsonError(w, "Handshake not found", http.StatusNotFound)
		return
	}

	if hs.ResponderID != userID {
		jsonError(w, "Not authorized to accept this handshake", http.StatusForbidden)
		return
	}

	if hs.Status != "pending" {
		jsonError(w, "Handshake is not pending", http.StatusBadRequest)
		return
	}

	now := time.Now()
	_, err = db.DB.Exec(`UPDATE handshakes SET status = 'completed', completed_at = ?, last_renewed = ? WHERE id = ?`,
		now, now, hs.ID)
	if err != nil {
		jsonError(w, "Failed to accept handshake", http.StatusInternalServerError)
		return
	}

	// Update stats for both users
	db.DB.Exec("UPDATE user_stats SET handshakes_made = handshakes_made + 1 WHERE user_id = ?", userID)
	db.DB.Exec("UPDATE user_stats SET handshakes_made = handshakes_made + 1 WHERE user_id = ?", hs.InitiatorID)

	// Add XP
	addXP(userID, 50)
	addXP(hs.InitiatorID, 50)

	hs.Status = "completed"
	hs.CompletedAt = &now
	hs.LastRenewed = &now

	// Notify initiator
	Hub.SendToUser(hs.InitiatorID, models.WSMessage{
		Type:    "handshake_accepted",
		Payload: hs,
	})

	jsonResponse(w, http.StatusOK, hs)
}

func RejectHandshake(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		HandshakeID string `json:"handshake_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var responderID string
	err := db.DB.QueryRow("SELECT responder_id FROM handshakes WHERE id = ? AND status = 'pending'",
		req.HandshakeID).Scan(&responderID)
	if err != nil {
		jsonError(w, "Handshake not found", http.StatusNotFound)
		return
	}

	if responderID != userID {
		jsonError(w, "Not authorized", http.StatusForbidden)
		return
	}

	db.DB.Exec("UPDATE handshakes SET status = 'rejected' WHERE id = ?", req.HandshakeID)
	jsonResponse(w, http.StatusOK, map[string]string{"status": "rejected"})
}

func GetHandshakes(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := db.DB.Query(`SELECT h.id, h.initiator_id, h.responder_id, h.status, h.initiated_at, h.completed_at, h.last_renewed,
		u1.username as initiator_name, u2.username as responder_name
		FROM handshakes h
		JOIN users u1 ON h.initiator_id = u1.id
		JOIN users u2 ON h.responder_id = u2.id
		WHERE (h.initiator_id = ? OR h.responder_id = ?)
		ORDER BY h.initiated_at DESC`, userID, userID)
	if err != nil {
		jsonError(w, "Failed to fetch handshakes", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type HandshakeWithNames struct {
		models.Handshake
		InitiatorName string `json:"initiator_name"`
		ResponderName string `json:"responder_name"`
	}

	handshakes := []HandshakeWithNames{}
	for rows.Next() {
		var h HandshakeWithNames
		rows.Scan(&h.ID, &h.InitiatorID, &h.ResponderID, &h.Status, &h.InitiatedAt, &h.CompletedAt, &h.LastRenewed,
			&h.InitiatorName, &h.ResponderName)
		handshakes = append(handshakes, h)
	}

	jsonResponse(w, http.StatusOK, handshakes)
}

func CheckHandshake(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	targetID := r.URL.Query().Get("target")

	var status string
	err := db.DB.QueryRow(`SELECT status FROM handshakes 
		WHERE ((initiator_id = ? AND responder_id = ?) OR (initiator_id = ? AND responder_id = ?))
		AND status = 'completed'`,
		userID, targetID, targetID, userID).Scan(&status)

	if err != nil {
		jsonResponse(w, http.StatusOK, map[string]interface{}{
			"handshake_active": false,
			"encrypted":        false,
		})
		return
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"handshake_active": true,
		"encrypted":        true,
	})
}

func addXP(userID string, amount int) {
	db.DB.Exec("UPDATE users SET xp = xp + ? WHERE id = ?", amount, userID)
	// Level up check: level = xp / 100
	db.DB.Exec("UPDATE users SET level = MAX(1, xp / 100) WHERE id = ?", userID)
}
