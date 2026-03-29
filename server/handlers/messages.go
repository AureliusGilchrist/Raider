package handlers

import (
	"encoding/json"
	"net/http"

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
