package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"raider/db"
	"raider/middleware"
	"raider/models"

	"github.com/go-chi/chi/v5"
)

func SendMessage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req models.SendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Content == "" {
		jsonError(w, "Content is required", http.StatusBadRequest)
		return
	}

	msgID := generateID()
	_, err := db.DB.Exec(`INSERT INTO messages (id, channel_id, sender_id, recipient_id, server_id, content, encrypted, nonce)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		msgID, req.ChannelID, userID, req.RecipientID, req.ServerID, req.Content, req.Encrypted, req.Nonce)
	if err != nil {
		jsonError(w, "Failed to send message", http.StatusInternalServerError)
		return
	}

	// Update stats
	db.DB.Exec("UPDATE user_stats SET messages_sent = messages_sent + 1 WHERE user_id = ?", userID)
	addXP(userID, 1)

	// Get sender info
	var senderName, senderAvatar string
	db.DB.QueryRow("SELECT username, avatar_url FROM users WHERE id = ?", userID).Scan(&senderName, &senderAvatar)

	msg := models.Message{
		ID:           msgID,
		ChannelID:    req.ChannelID,
		SenderID:     userID,
		RecipientID:  req.RecipientID,
		ServerID:     req.ServerID,
		Content:      req.Content,
		Encrypted:    req.Encrypted,
		Nonce:        req.Nonce,
		SenderName:   senderName,
		SenderAvatar: senderAvatar,
	}

	// Broadcast via WebSocket
	if req.ChannelID != nil {
		Hub.BroadcastToChannel(*req.ChannelID, models.WSMessage{Type: "new_message", Payload: msg})
	} else if req.RecipientID != nil {
		Hub.SendToUser(*req.RecipientID, models.WSMessage{Type: "new_message", Payload: msg})
		Hub.SendToUser(userID, models.WSMessage{Type: "new_message", Payload: msg})
		// Notify the recipient
		preview := req.Content
		if len(preview) > 60 {
			preview = preview[:60] + "…"
		}
		CreateNotification(*req.RecipientID, "dm", "New message from "+senderName, preview, "/app/dm/"+userID)
	}

	jsonResponse(w, http.StatusCreated, msg)
}

func GetChannelMessages(w http.ResponseWriter, r *http.Request) {
	channelID := chi.URLParam(r, "channelID")

	rows, err := db.DB.Query(`SELECT m.id, m.channel_id, m.sender_id, m.recipient_id, m.server_id, m.content, m.encrypted, m.nonce, m.created_at,
		u.username, u.avatar_url
		FROM messages m JOIN users u ON m.sender_id = u.id
		WHERE m.channel_id = ?
		ORDER BY m.created_at ASC LIMIT 100`, channelID)
	if err != nil {
		jsonError(w, "Failed to fetch messages", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	messages := []models.Message{}
	for rows.Next() {
		var m models.Message
		rows.Scan(&m.ID, &m.ChannelID, &m.SenderID, &m.RecipientID, &m.ServerID, &m.Content, &m.Encrypted, &m.Nonce, &m.CreatedAt,
			&m.SenderName, &m.SenderAvatar)
		messages = append(messages, m)
	}

	jsonResponse(w, http.StatusOK, messages)
}

func GetDMMessages(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	otherUserID := chi.URLParam(r, "userID")

	rows, err := db.DB.Query(`SELECT m.id, m.channel_id, m.sender_id, m.recipient_id, m.server_id, m.content, m.encrypted, m.nonce, m.created_at,
		u.username, u.avatar_url
		FROM messages m JOIN users u ON m.sender_id = u.id
		WHERE ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))
		AND m.channel_id IS NULL
		ORDER BY m.created_at ASC LIMIT 100`,
		userID, otherUserID, otherUserID, userID)
	if err != nil {
		jsonError(w, "Failed to fetch messages", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	messages := []models.Message{}
	for rows.Next() {
		var m models.Message
		rows.Scan(&m.ID, &m.ChannelID, &m.SenderID, &m.RecipientID, &m.ServerID, &m.Content, &m.Encrypted, &m.Nonce, &m.CreatedAt,
			&m.SenderName, &m.SenderAvatar)
		messages = append(messages, m)
	}

	jsonResponse(w, http.StatusOK, messages)
}

func GetDMList(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := db.DB.Query(`SELECT DISTINCT
		CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END as other_id,
		u.username, u.display_name, u.avatar_url, u.avatar_type,
		(SELECT content FROM messages WHERE 
			((sender_id = ? AND recipient_id = u.id) OR (sender_id = u.id AND recipient_id = ?))
			AND channel_id IS NULL
			ORDER BY created_at DESC LIMIT 1) as last_message,
		(SELECT created_at FROM messages WHERE 
			((sender_id = ? AND recipient_id = u.id) OR (sender_id = u.id AND recipient_id = ?))
			AND channel_id IS NULL
			ORDER BY created_at DESC LIMIT 1) as last_message_at
		FROM messages m
		JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END
		WHERE (m.sender_id = ? OR m.recipient_id = ?) AND m.channel_id IS NULL
		GROUP BY other_id
		ORDER BY last_message_at DESC`,
		userID, userID, userID, userID, userID, userID, userID, userID)
	if err != nil {
		jsonError(w, "Failed to fetch DM list", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type DMContact struct {
		UserID        string  `json:"user_id"`
		Username      string  `json:"username"`
		DisplayName   string  `json:"display_name"`
		AvatarURL     string  `json:"avatar_url"`
		AvatarType    string  `json:"avatar_type"`
		LastMessage   *string `json:"last_message"`
		LastMessageAt *string `json:"last_message_at"`
	}

	contacts := []DMContact{}
	for rows.Next() {
		var c DMContact
		rows.Scan(&c.UserID, &c.Username, &c.DisplayName, &c.AvatarURL, &c.AvatarType, &c.LastMessage, &c.LastMessageAt)
		contacts = append(contacts, c)
	}

	jsonResponse(w, http.StatusOK, contacts)
}

func SearchUsers(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		jsonResponse(w, http.StatusOK, []interface{}{})
		return
	}

	// Strip leading @ if present
	cleanQuery := query
	if len(cleanQuery) > 0 && cleanQuery[0] == '@' {
		cleanQuery = cleanQuery[1:]
	}

	// Exact username match always shows (bypasses show_in_search)
	// Partial matches only show users with show_in_search enabled
	rows, err := db.DB.Query(`
		SELECT DISTINCT u.id, u.username, u.display_name, u.avatar_url, u.avatar_type, u.level, u.peer_id
		FROM users u
		LEFT JOIN user_settings us ON u.id = us.user_id
		WHERE u.username = ? COLLATE NOCASE
		UNION
		SELECT DISTINCT u.id, u.username, u.display_name, u.avatar_url, u.avatar_type, u.level, u.peer_id
		FROM users u
		LEFT JOIN user_settings us ON u.id = us.user_id
		WHERE (u.username LIKE ? OR u.display_name LIKE ?)
		AND COALESCE(us.show_in_search, 1) = 1
		LIMIT 20`,
		cleanQuery, "%"+cleanQuery+"%", "%"+cleanQuery+"%")
	if err != nil {
		jsonError(w, "Search failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type UserResult struct {
		ID          string `json:"id"`
		Username    string `json:"username"`
		DisplayName string `json:"display_name"`
		AvatarURL   string `json:"avatar_url"`
		AvatarType  string `json:"avatar_type"`
		Level       int    `json:"level"`
		PeerID      string `json:"peer_id"`
	}

	results := []UserResult{}
	for rows.Next() {
		var u UserResult
		rows.Scan(&u.ID, &u.Username, &u.DisplayName, &u.AvatarURL, &u.AvatarType, &u.Level, &u.PeerID)
		results = append(results, u)
	}

	jsonResponse(w, http.StatusOK, results)
}

// EditMessage lets the sender edit their own message content.
func EditMessage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	msgID := chi.URLParam(r, "id")

	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Content == "" {
		jsonError(w, "Content required", http.StatusBadRequest)
		return
	}

	var senderID string
	if err := db.DB.QueryRow("SELECT sender_id FROM messages WHERE id = ?", msgID).Scan(&senderID); err != nil {
		jsonError(w, "Message not found", http.StatusNotFound)
		return
	}
	if senderID != userID {
		jsonError(w, "Not your message", http.StatusForbidden)
		return
	}

	now := time.Now()
	db.DB.Exec("UPDATE messages SET content = ?, edited_at = ? WHERE id = ?", req.Content, now, msgID)

	var channelID, recipientID *string
	db.DB.QueryRow("SELECT channel_id, recipient_id FROM messages WHERE id = ?", msgID).Scan(&channelID, &recipientID)

	payload := map[string]interface{}{"id": msgID, "content": req.Content, "edited_at": now}
	if channelID != nil {
		Hub.BroadcastToChannel(*channelID, models.WSMessage{Type: "message_edit", Payload: payload})
	} else if recipientID != nil {
		Hub.SendToUser(*recipientID, models.WSMessage{Type: "message_edit", Payload: payload})
		Hub.SendToUser(userID, models.WSMessage{Type: "message_edit", Payload: payload})
	}

	jsonResponse(w, http.StatusOK, map[string]string{"status": "edited"})
}

// DeleteMessage lets the sender or a server moderator delete a message.
func DeleteMessage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	msgID := chi.URLParam(r, "id")

	var senderID string
	var channelID, recipientID, serverID *string
	if err := db.DB.QueryRow(
		"SELECT sender_id, channel_id, recipient_id, server_id FROM messages WHERE id = ?", msgID,
	).Scan(&senderID, &channelID, &recipientID, &serverID); err != nil {
		jsonError(w, "Message not found", http.StatusNotFound)
		return
	}

	canDelete := senderID == userID
	if !canDelete && serverID != nil {
		canDelete = hasServerPermission(*serverID, userID, PermissionManageMessages)
	}
	if !canDelete {
		jsonError(w, "No permission", http.StatusForbidden)
		return
	}

	db.DB.Exec("DELETE FROM messages WHERE id = ?", msgID)

	payload := map[string]string{"id": msgID}
	if channelID != nil {
		Hub.BroadcastToChannel(*channelID, models.WSMessage{Type: "message_delete", Payload: payload})
	} else if recipientID != nil {
		Hub.SendToUser(*recipientID, models.WSMessage{Type: "message_delete", Payload: payload})
		Hub.SendToUser(senderID, models.WSMessage{Type: "message_delete", Payload: payload})
	}

	jsonResponse(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// PurgeUserMessages deletes up to 100 recent messages from a target user in a server.
// Requires PermissionManageMessages.
func PurgeUserMessages(w http.ResponseWriter, r *http.Request) {
	moderatorID := middleware.GetUserID(r)
	serverID := chi.URLParam(r, "serverID")
	targetUserID := chi.URLParam(r, "userID")

	if !hasServerPermission(serverID, moderatorID, PermissionManageMessages) {
		jsonError(w, "No permission", http.StatusForbidden)
		return
	}

	rows, err := db.DB.Query(
		`SELECT id, channel_id FROM messages WHERE sender_id = ? AND server_id = ? ORDER BY created_at DESC LIMIT 100`,
		targetUserID, serverID,
	)
	if err != nil {
		jsonError(w, "Query failed", http.StatusInternalServerError)
		return
	}

	type msgRow struct{ id, channelID string }
	var batch []msgRow
	for rows.Next() {
		var m msgRow
		var ch *string
		rows.Scan(&m.id, &ch)
		if ch != nil {
			m.channelID = *ch
		}
		batch = append(batch, m)
	}
	rows.Close()

	channelIDs := map[string][]string{}
	for _, m := range batch {
		db.DB.Exec("DELETE FROM messages WHERE id = ?", m.id)
		if m.channelID != "" {
			channelIDs[m.channelID] = append(channelIDs[m.channelID], m.id)
		}
	}
	for chID, ids := range channelIDs {
		Hub.BroadcastToChannel(chID, models.WSMessage{
			Type:    "messages_purge",
			Payload: map[string]interface{}{"message_ids": ids, "user_id": targetUserID},
		})
	}

	createAuditLog(serverID, moderatorID, 50, targetUserID, "messages",
		map[string]interface{}{"count": len(batch)}, "purge")

	jsonResponse(w, http.StatusOK, map[string]interface{}{"deleted": len(batch)})
}
