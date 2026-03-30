package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"raider/db"
	"raider/middleware"

	"github.com/go-chi/chi/v5"
)

var allowedMimeTypes = map[string]bool{
	"image/png":      true,
	"image/jpeg":     true,
	"image/gif":      true,
	"image/webp":     true,
	"image/svg+xml":  true,
	"video/mp4":      true,
	"video/webm":     true,
	"video/x-matroska": true,
	"video/quicktime":   true,
}

const maxUploadSize = 50 * 1024 * 1024 // 50MB

func UploadFile(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		jsonError(w, "File too large (max 50MB)", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "Failed to read file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Check MIME type
	buff := make([]byte, 512)
	_, err = file.Read(buff)
	if err != nil {
		jsonError(w, "Failed to read file", http.StatusBadRequest)
		return
	}
	mimeType := http.DetectContentType(buff)

	// Also check extension for video types
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext == ".mkv" {
		mimeType = "video/x-matroska"
	} else if ext == ".mp4" {
		mimeType = "video/mp4"
	} else if ext == ".webm" {
		mimeType = "video/webm"
	} else if ext == ".mov" {
		mimeType = "video/quicktime"
	} else if ext == ".gif" {
		mimeType = "image/gif"
	}

	if !allowedMimeTypes[mimeType] {
		jsonError(w, fmt.Sprintf("File type not allowed: %s", mimeType), http.StatusBadRequest)
		return
	}

	// Reset file reader
	file.Seek(0, io.SeekStart)

	// Create upload directory
	uploadDir := filepath.Join(".", "uploads", userID)
	os.MkdirAll(uploadDir, 0755)

	// Generate filename
	fileID := generateID()
	filename := fileID + ext
	destPath := filepath.Join(uploadDir, filename)

	dest, err := os.Create(destPath)
	if err != nil {
		jsonError(w, "Failed to save file", http.StatusInternalServerError)
		return
	}
	defer dest.Close()

	size, err := io.Copy(dest, file)
	if err != nil {
		jsonError(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	// Record in DB
	_, err = db.DB.Exec(`INSERT INTO uploads (id, user_id, filename, mime_type, size, path) VALUES (?, ?, ?, ?, ?, ?)`,
		fileID, userID, header.Filename, mimeType, size, destPath)
	if err != nil {
		jsonError(w, "Failed to record upload", http.StatusInternalServerError)
		return
	}

	fileURL := fmt.Sprintf("/api/uploads/%s/%s", userID, filename)

	jsonResponse(w, http.StatusCreated, map[string]interface{}{
		"id":        fileID,
		"url":       fileURL,
		"mime_type": mimeType,
		"size":      size,
		"filename":  header.Filename,
	})
}

func SetAvatar(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		URL  string `json:"url"`
		Type string `json:"type"` // "image" or "video"
	}
	if err := parseJSON(r, &req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Type == "" {
		req.Type = "image"
	}

	db.DB.Exec("UPDATE users SET avatar_url = ?, avatar_type = ? WHERE id = ?", req.URL, req.Type, userID)
	jsonResponse(w, http.StatusOK, map[string]string{"status": "updated"})
}

func SetBanner(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		URL  string `json:"url"`
		Type string `json:"type"`
	}
	if err := parseJSON(r, &req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Type == "" {
		req.Type = "image"
	}

	db.DB.Exec("UPDATE users SET banner_url = ?, banner_type = ? WHERE id = ?", req.URL, req.Type, userID)
	jsonResponse(w, http.StatusOK, map[string]string{"status": "updated"})
}

func ServeUpload(w http.ResponseWriter, r *http.Request) {
	userIDParam := chi.URLParam(r, "userID")
	filename := chi.URLParam(r, "filename")

	// Prevent path traversal
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") || strings.Contains(filename, "\\") ||
		strings.Contains(userIDParam, "..") || strings.Contains(userIDParam, "/") || strings.Contains(userIDParam, "\\") {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	filePath := filepath.Join(".", "uploads", userIDParam, filename)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		http.NotFound(w, r)
		return
	}

	// Set appropriate headers for video streaming
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".mp4":
		w.Header().Set("Content-Type", "video/mp4")
	case ".webm":
		w.Header().Set("Content-Type", "video/webm")
	case ".mkv":
		w.Header().Set("Content-Type", "video/x-matroska")
	case ".mov":
		w.Header().Set("Content-Type", "video/quicktime")
	case ".gif":
		w.Header().Set("Content-Type", "image/gif")
	}

	http.ServeFile(w, r, filePath)
}

func parseJSON(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}
