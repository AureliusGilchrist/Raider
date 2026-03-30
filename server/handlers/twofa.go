package handlers

import (
	"encoding/json"
	"net/http"

	"raider/db"
	"raider/middleware"

	"github.com/pquerna/otp/totp"
)

// Setup2FA generates a new TOTP secret and returns the provisioning URI
func Setup2FA(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	// Get username for the TOTP key
	var username string
	err := db.DB.QueryRow("SELECT username FROM users WHERE id = ?", userID).Scan(&username)
	if err != nil {
		jsonError(w, "User not found", http.StatusNotFound)
		return
	}

	// Generate a new TOTP key
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Raider",
		AccountName: username,
	})
	if err != nil {
		jsonError(w, "Failed to generate 2FA secret", http.StatusInternalServerError)
		return
	}

	// Store the secret temporarily (not yet enabled until verified)
	_, err = db.DB.Exec("UPDATE users SET two_factor_secret = ? WHERE id = ?", key.Secret(), userID)
	if err != nil {
		jsonError(w, "Failed to save 2FA secret", http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, map[string]string{
		"secret": key.Secret(),
		"url":    key.URL(),
	})
}

// Verify2FA verifies a TOTP code and enables 2FA if correct
func Verify2FA(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get the stored secret
	var secret string
	err := db.DB.QueryRow("SELECT two_factor_secret FROM users WHERE id = ?", userID).Scan(&secret)
	if err != nil || secret == "" {
		jsonError(w, "2FA not set up. Call setup first.", http.StatusBadRequest)
		return
	}

	// Validate the TOTP code
	valid := totp.Validate(req.Code, secret)
	if !valid {
		jsonError(w, "Invalid 2FA code", http.StatusUnauthorized)
		return
	}

	// Enable 2FA in user_settings
	db.DB.Exec(`UPDATE user_settings SET two_factor_enabled = 1 WHERE user_id = ?`, userID)

	jsonResponse(w, http.StatusOK, map[string]string{"status": "2fa_enabled"})
}

// Disable2FA disables 2FA after verifying the current code
func Disable2FA(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get the stored secret
	var secret string
	err := db.DB.QueryRow("SELECT two_factor_secret FROM users WHERE id = ?", userID).Scan(&secret)
	if err != nil || secret == "" {
		jsonError(w, "2FA not enabled", http.StatusBadRequest)
		return
	}

	// Validate the TOTP code
	valid := totp.Validate(req.Code, secret)
	if !valid {
		jsonError(w, "Invalid 2FA code", http.StatusUnauthorized)
		return
	}

	// Disable 2FA
	db.DB.Exec("UPDATE users SET two_factor_secret = '' WHERE id = ?", userID)
	db.DB.Exec("UPDATE user_settings SET two_factor_enabled = 0 WHERE user_id = ?", userID)

	jsonResponse(w, http.StatusOK, map[string]string{"status": "2fa_disabled"})
}

// Verify2FALogin verifies a TOTP code during login (called after password verification)
func Verify2FALogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID string `json:"user_id"`
		Code   string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get the stored secret
	var secret string
	err := db.DB.QueryRow("SELECT two_factor_secret FROM users WHERE id = ?", req.UserID).Scan(&secret)
	if err != nil || secret == "" {
		jsonError(w, "2FA not configured", http.StatusBadRequest)
		return
	}

	// Validate the TOTP code
	valid := totp.Validate(req.Code, secret)
	if !valid {
		jsonError(w, "Invalid 2FA code", http.StatusUnauthorized)
		return
	}

	// Update last seen
	db.DB.Exec("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?", req.UserID)

	// Generate JWT
	token, err := middleware.GenerateToken(req.UserID)
	if err != nil {
		jsonError(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// Fetch full user for response
	var user struct {
		ID            string `json:"id"`
		Username      string `json:"username"`
		Email         string `json:"email"`
		DisplayName   string `json:"display_name"`
		AvatarURL     string `json:"avatar_url"`
		AvatarType    string `json:"avatar_type"`
		Level         int    `json:"level"`
		XP            int    `json:"xp"`
		KeyIterations int    `json:"key_iterations"`
		PeerID        string `json:"peer_id"`
	}
	db.DB.QueryRow(`SELECT id, username, email, display_name, avatar_url, avatar_type, level, xp, key_iterations, peer_id
		FROM users WHERE id = ?`, req.UserID).Scan(
		&user.ID, &user.Username, &user.Email, &user.DisplayName,
		&user.AvatarURL, &user.AvatarType, &user.Level, &user.XP,
		&user.KeyIterations, &user.PeerID)

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"token": token,
		"user":  user,
	})
}
