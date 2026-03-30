package handlers

import (
	"encoding/json"
	"net/http"

	"raider/db"
	"raider/middleware"
	"raider/models"

	"github.com/go-chi/chi/v5"
)

// Permission bitmasks (Discord-compatible)
const (
	PermissionCreateInstantInvite = 0x00000001
	PermissionKickMembers         = 0x00000002
	PermissionBanMembers          = 0x00000004
	PermissionAdministrator       = 0x00000008
	PermissionManageChannels      = 0x00000010
	PermissionManageGuild         = 0x00000020
	PermissionAddReactions        = 0x00000040
	PermissionViewAuditLog        = 0x00000080
	PermissionPrioritySpeaker     = 0x00000100
	PermissionStream              = 0x00000200
	PermissionViewChannel         = 0x00000400
	PermissionSendMessages        = 0x00000800
	PermissionSendTTSMessages     = 0x00001000
	PermissionManageMessages      = 0x00002000
	PermissionEmbedLinks        = 0x00004000
	PermissionAttachFiles       = 0x00008000
	PermissionReadMessageHistory = 0x00010000
	PermissionMentionEveryone   = 0x00020000
	PermissionUseExternalEmojis = 0x00040000
	PermissionViewGuildInsights = 0x00080000
	PermissionConnect           = 0x00100000
	PermissionSpeak             = 0x00200000
	PermissionMuteMembers       = 0x00400000
	PermissionDeafenMembers     = 0x00800000
	PermissionMoveMembers       = 0x01000000
	PermissionUseVAD              = 0x02000000
	PermissionChangeNickname    = 0x04000000
	PermissionManageNicknames   = 0x08000000
	PermissionManageRoles       = 0x10000000
	PermissionManageWebhooks    = 0x20000000
	PermissionManageEmojis      = 0x40000000
	PermissionUseSlashCommands  = 0x80000000
)

// GetServerRoles returns all roles for a server
func GetServerRoles(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	userID := middleware.GetUserID(r)

	// Check membership
	var memberCount int
	db.DB.QueryRow("SELECT COUNT(*) FROM server_members WHERE server_id = ? AND user_id = ?", serverID, userID).Scan(&memberCount)
	if memberCount == 0 {
		jsonError(w, "Not a member", http.StatusForbidden)
		return
	}

	rows, err := db.DB.Query(`SELECT id, server_id, name, color, position, hoist, mentionable, permissions
		FROM server_roles WHERE server_id = ? ORDER BY position DESC`, serverID)
	if err != nil {
		jsonError(w, "Failed to fetch roles", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	roles := []models.ServerRole{}
	for rows.Next() {
		var role models.ServerRole
		rows.Scan(&role.ID, &role.ServerID, &role.Name, &role.Color, &role.Position, &role.Hoist, &role.Mentionable, &role.Permissions)
		roles = append(roles, role)
	}

	jsonResponse(w, http.StatusOK, roles)
}

// CreateRole creates a new role
func CreateRole(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	userID := middleware.GetUserID(r)

	// Check permissions (ManageRoles)
	if !hasServerPermission(serverID, userID, PermissionManageRoles) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	var req struct {
		Name        string `json:"name"`
		Color       string `json:"color"`
		Hoist       bool   `json:"hoist"`
		Mentionable bool   `json:"mentionable"`
		Permissions int    `json:"permissions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		req.Name = "new role"
	}

	// Get max position
	var maxPosition int
	db.DB.QueryRow("SELECT COALESCE(MAX(position), 0) FROM server_roles WHERE server_id = ?", serverID).Scan(&maxPosition)

	roleID := generateID()
	_, err := db.DB.Exec(`INSERT INTO server_roles (id, server_id, name, color, position, hoist, mentionable, permissions)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		roleID, serverID, req.Name, req.Color, maxPosition+1, req.Hoist, req.Mentionable, req.Permissions)
	if err != nil {
		jsonError(w, "Failed to create role", http.StatusInternalServerError)
		return
	}

	// Audit log
	createAuditLog(serverID, userID, 50, roleID, "role", map[string]interface{}{"name": req.Name}, "")

	role := models.ServerRole{
		ID:          roleID,
		ServerID:    serverID,
		Name:        req.Name,
		Color:       req.Color,
		Position:    maxPosition + 1,
		Hoist:         req.Hoist,
		Mentionable:   req.Mentionable,
		Permissions:   req.Permissions,
	}

	jsonResponse(w, http.StatusCreated, role)
}

// UpdateRole updates a role
func UpdateRole(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	roleID := chi.URLParam(r, "roleID")
	userID := middleware.GetUserID(r)

	if !hasServerPermission(serverID, userID, PermissionManageRoles) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	var req struct {
		Name        *string `json:"name"`
		Color       *string `json:"color"`
		Hoist       *bool   `json:"hoist"`
		Mentionable *bool   `json:"mentionable"`
		Permissions *int    `json:"permissions"`
		Position    *int    `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.Name != nil {
		db.DB.Exec("UPDATE server_roles SET name = ? WHERE id = ?", *req.Name, roleID)
	}
	if req.Color != nil {
		db.DB.Exec("UPDATE server_roles SET color = ? WHERE id = ?", *req.Color, roleID)
	}
	if req.Hoist != nil {
		db.DB.Exec("UPDATE server_roles SET hoist = ? WHERE id = ?", *req.Hoist, roleID)
	}
	if req.Mentionable != nil {
		db.DB.Exec("UPDATE server_roles SET mentionable = ? WHERE id = ?", *req.Mentionable, roleID)
	}
	if req.Permissions != nil {
		db.DB.Exec("UPDATE server_roles SET permissions = ? WHERE id = ?", *req.Permissions, roleID)
	}
	if req.Position != nil {
		db.DB.Exec("UPDATE server_roles SET position = ? WHERE id = ?", *req.Position, roleID)
	}

	createAuditLog(serverID, userID, 51, roleID, "role", req, "")

	jsonResponse(w, http.StatusOK, map[string]string{"status": "updated"})
}

// DeleteRole deletes a role
func DeleteRole(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	roleID := chi.URLParam(r, "roleID")
	userID := middleware.GetUserID(r)

	if !hasServerPermission(serverID, userID, PermissionManageRoles) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	// Cannot delete @everyone (we'll treat the lowest position role as @everyone)
	var position int
	db.DB.QueryRow("SELECT position FROM server_roles WHERE id = ?", roleID).Scan(&position)

	db.DB.Exec("DELETE FROM server_member_roles WHERE role_id = ?", roleID)
	db.DB.Exec("DELETE FROM server_roles WHERE id = ?", roleID)

	createAuditLog(serverID, userID, 52, roleID, "role", nil, "")

	jsonResponse(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// AssignRole assigns a role to a member
func AssignRole(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	userID := middleware.GetUserID(r)

	if !hasServerPermission(serverID, userID, PermissionManageRoles) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	var req struct {
		UserID string `json:"user_id"`
		RoleID string `json:"role_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Check if already has role
	var exists int
	db.DB.QueryRow("SELECT COUNT(*) FROM server_member_roles WHERE server_id = ? AND user_id = ? AND role_id = ?",
		serverID, req.UserID, req.RoleID).Scan(&exists)
	if exists > 0 {
		jsonError(w, "User already has this role", http.StatusConflict)
		return
	}

	db.DB.Exec("INSERT INTO server_member_roles (server_id, user_id, role_id) VALUES (?, ?, ?)",
		serverID, req.UserID, req.RoleID)

	createAuditLog(serverID, userID, 35, req.UserID, "member", map[string]interface{}{"role_id": req.RoleID}, "")

	jsonResponse(w, http.StatusOK, map[string]string{"status": "assigned"})
}

// RemoveRole removes a role from a member
func RemoveRole(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	userID := middleware.GetUserID(r)

	if !hasServerPermission(serverID, userID, PermissionManageRoles) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	var req struct {
		UserID string `json:"user_id"`
		RoleID string `json:"role_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request", http.StatusBadRequest)
		return
	}

	db.DB.Exec("DELETE FROM server_member_roles WHERE server_id = ? AND user_id = ? AND role_id = ?",
		serverID, req.UserID, req.RoleID)

	createAuditLog(serverID, userID, 35, req.UserID, "member", map[string]interface{}{"role_id": req.RoleID, "action": "remove"}, "")

	jsonResponse(w, http.StatusOK, map[string]string{"status": "removed"})
}

// GetMemberRoles returns all roles for a member
func GetMemberRoles(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	targetUserID := chi.URLParam(r, "userID")
	requesterID := middleware.GetUserID(r)

	// Check membership
	var memberCount int
	db.DB.QueryRow("SELECT COUNT(*) FROM server_members WHERE server_id = ? AND user_id = ?", serverID, requesterID).Scan(&memberCount)
	if memberCount == 0 {
		jsonError(w, "Not a member", http.StatusForbidden)
		return
	}

	rows, err := db.DB.Query(`SELECT r.id, r.server_id, r.name, r.color, r.position, r.hoist, r.mentionable, r.permissions
		FROM server_roles r
		JOIN server_member_roles mr ON r.id = mr.role_id
		WHERE mr.server_id = ? AND mr.user_id = ?
		ORDER BY r.position DESC`, serverID, targetUserID)
	if err != nil {
		jsonError(w, "Failed to fetch roles", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	roles := []models.ServerRole{}
	for rows.Next() {
		var role models.ServerRole
		rows.Scan(&role.ID, &role.ServerID, &role.Name, &role.Color, &role.Position, &role.Hoist, &role.Mentionable, &role.Permissions)
		roles = append(roles, role)
	}

	jsonResponse(w, http.StatusOK, roles)
}

// hasServerPermission checks if user has a specific permission
func hasServerPermission(serverID, userID string, permission int) bool {
	// Owner always has all permissions
	var ownerID string
	db.DB.QueryRow("SELECT owner_id FROM servers WHERE id = ?", serverID).Scan(&ownerID)
	if ownerID == userID {
		return true
	}

	// Check role permissions
	var totalPerms int
	row := db.DB.QueryRow(`SELECT COALESCE(SUM(r.permissions), 0)
		FROM server_roles r
		JOIN server_member_roles mr ON r.id = mr.role_id
		WHERE mr.server_id = ? AND mr.user_id = ?`, serverID, userID)
	row.Scan(&totalPerms)

	// Check for Administrator permission
	if totalPerms&PermissionAdministrator != 0 {
		return true
	}

	return totalPerms&permission != 0
}

// createAuditLog creates an audit log entry
func createAuditLog(serverID, userID string, actionType int, targetID, targetType string, changes interface{}, reason string) {
	changesJSON, _ := json.Marshal(changes)
	logID := generateID()
	db.DB.Exec(`INSERT INTO server_audit_logs (id, server_id, user_id, action_type, target_id, target_type, changes, reason)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		logID, serverID, userID, actionType, targetID, targetType, string(changesJSON), reason)
}
