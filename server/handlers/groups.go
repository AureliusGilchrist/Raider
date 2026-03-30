package handlers

import (
	"encoding/json"
	"net/http"

	"raider/db"
	"raider/middleware"
	"raider/models"

	"github.com/go-chi/chi/v5"
)

const MaxGroupChatMembers = 52

// GetGroupChats returns all group chats the user is in
func GetGroupChats(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := db.DB.Query(`SELECT g.id, g.name, g.icon_url, g.creator_id, g.member_count, g.created_at,
		u.username as creator_name
		FROM group_chats g
		JOIN group_chat_members gm ON g.id = gm.group_id
		JOIN users u ON g.creator_id = u.id
		WHERE gm.user_id = ?
		ORDER BY g.created_at DESC`, userID)
	if err != nil {
		jsonError(w, "Failed to fetch group chats", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	groups := []map[string]interface{}{}
	for rows.Next() {
		var id, name, iconURL, creatorID, creatorName string
		var memberCount int
		var createdAt interface{}
		rows.Scan(&id, &name, &iconURL, &creatorID, &memberCount, &createdAt, &creatorName)
		groups = append(groups, map[string]interface{}{
			"id": id, "name": name, "icon_url": iconURL, "creator_id": creatorID,
			"member_count": memberCount, "created_at": createdAt, "creator_name": creatorName,
		})
	}

	jsonResponse(w, http.StatusOK, groups)
}

// GetGroupChat returns details of a specific group chat
func GetGroupChat(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	groupID := chi.URLParam(r, "groupID")

	// Check membership
	var memberCount int
	db.DB.QueryRow("SELECT COUNT(*) FROM group_chat_members WHERE group_id = ? AND user_id = ?", groupID, userID).Scan(&memberCount)
	if memberCount == 0 {
		jsonError(w, "Not a member", http.StatusForbidden)
		return
	}

	// Get group details
	var gID, gName, gIconURL, gCreatorID, gCreatorName string
	var gMemberCount int
	var gCreatedAt interface{}
	err := db.DB.QueryRow(`SELECT g.id, g.name, g.icon_url, g.creator_id, g.member_count, g.created_at,
		u.username as creator_name
		FROM group_chats g
		JOIN users u ON g.creator_id = u.id
		WHERE g.id = ?`, groupID).Scan(
		&gID, &gName, &gIconURL, &gCreatorID, &gMemberCount, &gCreatedAt, &gCreatorName)
	if err != nil {
		jsonError(w, "Group not found", http.StatusNotFound)
		return
	}
	group := map[string]interface{}{
		"id":           gID,
		"name":         gName,
		"icon_url":     gIconURL,
		"creator_id":   gCreatorID,
		"member_count": gMemberCount,
		"created_at":   gCreatedAt,
		"creator_name": gCreatorName,
	}

	// Get members
	memberRows, err := db.DB.Query(`SELECT u.id, u.username, u.display_name, u.avatar_url, u.avatar_type, u.status, u.status_message,
		gm.joined_at
		FROM group_chat_members gm
		JOIN users u ON gm.user_id = u.id
		WHERE gm.group_id = ?
		ORDER BY gm.joined_at ASC`, groupID)
	if err != nil {
		jsonError(w, "Failed to fetch members", http.StatusInternalServerError)
		return
	}
	defer memberRows.Close()

	members := []map[string]interface{}{}
	for memberRows.Next() {
		var id, username, displayName, avatarURL, avatarType, status, statusMessage string
		var joinedAt interface{}
		memberRows.Scan(&id, &username, &displayName, &avatarURL, &avatarType, &status, &statusMessage, &joinedAt)
		members = append(members, map[string]interface{}{
			"id": id, "username": username, "display_name": displayName,
			"avatar_url": avatarURL, "avatar_type": avatarType,
			"status": status, "status_message": statusMessage,
			"joined_at": joinedAt,
		})
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"group":   group,
		"members": members,
	})
}

// CreateGroupChat creates a new group chat
func CreateGroupChat(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		Name    string   `json:"name"`
		Members []string `json:"members"` // User IDs to add (must have handshake)
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		jsonError(w, "Name required", http.StatusBadRequest)
		return
	}

	// Total members = creator + requested members
	totalMembers := 1 + len(req.Members)
	if totalMembers < 2 {
		jsonError(w, "Group chat requires at least 2 members", http.StatusBadRequest)
		return
	}
	if totalMembers > MaxGroupChatMembers {
		jsonError(w, "Group chat max is 52 members", http.StatusBadRequest)
		return
	}

	// Validate all members have handshake with creator
	for _, memberID := range req.Members {
		var hsCount int
		db.DB.QueryRow(`SELECT COUNT(*) FROM handshakes
			WHERE ((initiator_id = ? AND responder_id = ?) OR (initiator_id = ? AND responder_id = ?))
			AND status = 'completed'`,
			userID, memberID, memberID, userID).Scan(&hsCount)
		if hsCount == 0 {
			jsonError(w, "Can only add users you have a handshake with", http.StatusForbidden)
			return
		}
	}

	// Create group
	groupID := generateID()
	_, err := db.DB.Exec(`INSERT INTO group_chats (id, name, creator_id, member_count) VALUES (?, ?, ?, ?)`,
		groupID, req.Name, userID, totalMembers)
	if err != nil {
		jsonError(w, "Failed to create group", http.StatusInternalServerError)
		return
	}

	// Add creator
	db.DB.Exec(`INSERT INTO group_chat_members (group_id, user_id) VALUES (?, ?)`, groupID, userID)

	// Add members
	for _, memberID := range req.Members {
		db.DB.Exec(`INSERT INTO group_chat_members (group_id, user_id) VALUES (?, ?)`, groupID, memberID)
	}

	group := map[string]interface{}{
		"id":           groupID,
		"name":         req.Name,
		"icon_url":     "",
		"creator_id":   userID,
		"member_count": totalMembers,
	}

	jsonResponse(w, http.StatusCreated, group)
}

// AddGroupMember adds a member to a group chat
func AddGroupMember(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	groupID := chi.URLParam(r, "groupID")

	var req struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Check if user is creator (only creator can add members)
	var creatorID string
	var memberCount int
	db.DB.QueryRow("SELECT creator_id, member_count FROM group_chats WHERE id = ?", groupID).Scan(&creatorID, &memberCount)
	if creatorID != userID {
		jsonError(w, "Only creator can add members", http.StatusForbidden)
		return
	}

	if memberCount >= MaxGroupChatMembers {
		jsonError(w, "Group is full (max 52)", http.StatusBadRequest)
		return
	}

	// Check handshake
	var hsCount int
	db.DB.QueryRow(`SELECT COUNT(*) FROM handshakes
		WHERE ((initiator_id = ? AND responder_id = ?) OR (initiator_id = ? AND responder_id = ?))
		AND status = 'completed'`,
		userID, req.UserID, req.UserID, userID).Scan(&hsCount)
	if hsCount == 0 {
		jsonError(w, "Can only add users you have a handshake with", http.StatusForbidden)
		return
	}

	// Check if already member
	var exists int
	db.DB.QueryRow("SELECT COUNT(*) FROM group_chat_members WHERE group_id = ? AND user_id = ?", groupID, req.UserID).Scan(&exists)
	if exists > 0 {
		jsonError(w, "Already a member", http.StatusConflict)
		return
	}

	// Add member
	db.DB.Exec(`INSERT INTO group_chat_members (group_id, user_id) VALUES (?, ?)`, groupID, req.UserID)
	db.DB.Exec(`UPDATE group_chats SET member_count = member_count + 1 WHERE id = ?`, groupID)

	jsonResponse(w, http.StatusOK, map[string]string{"status": "added"})
}

// RemoveGroupMember removes a member (or self-leave)
func RemoveGroupMember(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	groupID := chi.URLParam(r, "groupID")
	targetUserID := chi.URLParam(r, "userID")

	// Check if user is creator
	var creatorID string
	db.DB.QueryRow("SELECT creator_id FROM group_chats WHERE id = ?", groupID).Scan(&creatorID)

	// Can remove self or creator can remove anyone
	if targetUserID != userID && creatorID != userID {
		jsonError(w, "Only creator can remove members", http.StatusForbidden)
		return
	}

	// Cannot remove creator
	if targetUserID == creatorID {
		jsonError(w, "Creator cannot be removed", http.StatusBadRequest)
		return
	}

	db.DB.Exec(`DELETE FROM group_chat_members WHERE group_id = ? AND user_id = ?`, groupID, targetUserID)
	db.DB.Exec(`UPDATE group_chats SET member_count = member_count - 1 WHERE id = ?`, groupID)

	jsonResponse(w, http.StatusOK, map[string]string{"status": "removed"})
}

// LeaveGroupChat allows a member to leave
func LeaveGroupChat(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	groupID := chi.URLParam(r, "groupID")

	// Check if creator (creator can't leave, must delete)
	var creatorID string
	db.DB.QueryRow("SELECT creator_id FROM group_chats WHERE id = ?", groupID).Scan(&creatorID)
	if creatorID == userID {
		jsonError(w, "Creator must delete the group", http.StatusBadRequest)
		return
	}

	db.DB.Exec(`DELETE FROM group_chat_members WHERE group_id = ? AND user_id = ?`, groupID, userID)
	db.DB.Exec(`UPDATE group_chats SET member_count = member_count - 1 WHERE id = ?`, groupID)

	jsonResponse(w, http.StatusOK, map[string]string{"status": "left"})
}

// DeleteGroupChat deletes the entire group (creator only)
func DeleteGroupChat(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	groupID := chi.URLParam(r, "groupID")

	var creatorID string
	db.DB.QueryRow("SELECT creator_id FROM group_chats WHERE id = ?", groupID).Scan(&creatorID)
	if creatorID != userID {
		jsonError(w, "Only creator can delete", http.StatusForbidden)
		return
	}

	db.DB.Exec(`DELETE FROM group_chats WHERE id = ?`, groupID)

	jsonResponse(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// GetGroupMessages returns messages for a group chat
func GetGroupMessages(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	groupID := chi.URLParam(r, "groupID")

	// Check membership
	var memberCount int
	db.DB.QueryRow("SELECT COUNT(*) FROM group_chat_members WHERE group_id = ? AND user_id = ?", groupID, userID).Scan(&memberCount)
	if memberCount == 0 {
		jsonError(w, "Not a member", http.StatusForbidden)
		return
	}

	rows, err := db.DB.Query(`SELECT m.id, m.group_id, m.sender_id, m.content, m.encrypted, m.created_at, m.edited_at,
		u.username as sender_name, u.avatar_url as sender_avatar
		FROM group_messages m
		JOIN users u ON m.sender_id = u.id
		WHERE m.group_id = ?
		ORDER BY m.created_at DESC LIMIT 100`, groupID)
	if err != nil {
		jsonError(w, "Failed to fetch messages", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	messages := []models.GroupMessage{}
	for rows.Next() {
		var msg models.GroupMessage
		rows.Scan(&msg.ID, &msg.GroupID, &msg.SenderID, &msg.Content, &msg.Encrypted, &msg.CreatedAt, &msg.EditedAt,
			&msg.SenderName, &msg.SenderAvatar)
		messages = append(messages, msg)
	}

	// Reverse to get oldest first
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	jsonResponse(w, http.StatusOK, messages)
}

// SendGroupMessage sends a message to a group chat
func SendGroupMessage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	groupID := chi.URLParam(r, "groupID")

	var req struct {
		Content   string `json:"content"`
		Encrypted bool   `json:"encrypted"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Content == "" {
		jsonError(w, "Content required", http.StatusBadRequest)
		return
	}

	// Check membership
	var memberCount int
	db.DB.QueryRow("SELECT COUNT(*) FROM group_chat_members WHERE group_id = ? AND user_id = ?", groupID, userID).Scan(&memberCount)
	if memberCount == 0 {
		jsonError(w, "Not a member", http.StatusForbidden)
		return
	}

	msgID := generateID()
	_, err := db.DB.Exec(`INSERT INTO group_messages (id, group_id, sender_id, content, encrypted) VALUES (?, ?, ?, ?, ?)`,
		msgID, groupID, userID, req.Content, req.Encrypted)
	if err != nil {
		jsonError(w, "Failed to send message", http.StatusInternalServerError)
		return
	}

	// Get sender info
	var senderName, senderAvatar string
	db.DB.QueryRow("SELECT username, avatar_url FROM users WHERE id = ?", userID).Scan(&senderName, &senderAvatar)

	msg := models.GroupMessage{
		ID:           msgID,
		GroupID:      groupID,
		SenderID:     userID,
		Content:      req.Content,
		Encrypted:    req.Encrypted,
		SenderName:   senderName,
		SenderAvatar: senderAvatar,
	}

	// Broadcast to all members via WebSocket
	Hub.BroadcastToGroup(groupID, models.WSMessage{
		Type:    "group_message",
		Payload: msg,
	})

	jsonResponse(w, http.StatusCreated, msg)
}
