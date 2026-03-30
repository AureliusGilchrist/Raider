package handlers

import (
	"encoding/json"
	"net/http"

	"raider/db"
	"raider/middleware"
	"raider/models"

	"github.com/go-chi/chi/v5"
)

// GetCategories returns all categories for a server
func GetCategories(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	userID := middleware.GetUserID(r)

	// Check membership
	var memberCount int
	db.DB.QueryRow("SELECT COUNT(*) FROM server_members WHERE server_id = ? AND user_id = ?", serverID, userID).Scan(&memberCount)
	if memberCount == 0 {
		jsonError(w, "Not a member", http.StatusForbidden)
		return
	}

	rows, err := db.DB.Query(`SELECT id, server_id, name, position
		FROM channel_categories WHERE server_id = ? ORDER BY position`, serverID)
	if err != nil {
		jsonError(w, "Failed to fetch categories", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	categories := []models.ChannelCategory{}
	for rows.Next() {
		var cat models.ChannelCategory
		rows.Scan(&cat.ID, &cat.ServerID, &cat.Name, &cat.Position)
		categories = append(categories, cat)
	}

	jsonResponse(w, http.StatusOK, categories)
}

// CreateCategory creates a new channel category
func CreateCategory(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	userID := middleware.GetUserID(r)

	if !hasServerPermission(serverID, userID, PermissionManageChannels) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		jsonError(w, "Name required", http.StatusBadRequest)
		return
	}

	var maxPos int
	db.DB.QueryRow("SELECT COALESCE(MAX(position), 0) FROM channel_categories WHERE server_id = ?", serverID).Scan(&maxPos)

	catID := generateID()
	db.DB.Exec(`INSERT INTO channel_categories (id, server_id, name, position) VALUES (?, ?, ?, ?)`,
		catID, serverID, req.Name, maxPos+1)

	createAuditLog(serverID, userID, 10, catID, "category", map[string]interface{}{"name": req.Name}, "")

	cat := models.ChannelCategory{
		ID:       catID,
		ServerID: serverID,
		Name:     req.Name,
		Position: maxPos + 1,
	}

	jsonResponse(w, http.StatusCreated, cat)
}

// UpdateCategory updates a category
func UpdateCategory(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	catID := chi.URLParam(r, "categoryID")
	userID := middleware.GetUserID(r)

	if !hasServerPermission(serverID, userID, PermissionManageChannels) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	var req struct {
		Name     *string `json:"name"`
		Position *int    `json:"position"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if req.Name != nil {
		db.DB.Exec("UPDATE channel_categories SET name = ? WHERE id = ?", *req.Name, catID)
	}
	if req.Position != nil {
		db.DB.Exec("UPDATE channel_categories SET position = ? WHERE id = ?", *req.Position, catID)
	}

	createAuditLog(serverID, userID, 11, catID, "category", req, "")

	jsonResponse(w, http.StatusOK, map[string]string{"status": "updated"})
}

// DeleteCategory deletes a category
func DeleteCategory(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "serverID")
	catID := chi.URLParam(r, "categoryID")
	userID := middleware.GetUserID(r)

	if !hasServerPermission(serverID, userID, PermissionManageChannels) {
		jsonError(w, "Missing permission", http.StatusForbidden)
		return
	}

	// Move channels to no category (parent_id = NULL)
	db.DB.Exec("UPDATE channels SET parent_id = NULL WHERE parent_id = ?", catID)
	db.DB.Exec("DELETE FROM channel_categories WHERE id = ?", catID)

	createAuditLog(serverID, userID, 12, catID, "category", nil, "")

	jsonResponse(w, http.StatusOK, map[string]string{"status": "deleted"})
}
