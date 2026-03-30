package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"

	"raider/crypto"
	"raider/db"
	"raider/middleware"
	"raider/models"

	"golang.org/x/crypto/bcrypt"
)

func Register(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Username == "" || req.Email == "" || req.Password == "" {
		jsonError(w, "Username, email and password are required", http.StatusBadRequest)
		return
	}
	if len(req.Username) > 32 {
		jsonError(w, "Username must be under 32 characters", http.StatusBadRequest)
		return
	}
	if len(req.Password) < 8 {
		jsonError(w, "Password must be at least 8 characters", http.StatusBadRequest)
		return
	}

	if req.KeyIterations < 128 || req.KeyIterations > 8192 {
		req.KeyIterations = 128
	}

	// Check if user exists
	var exists int
	db.DB.QueryRow("SELECT COUNT(*) FROM users WHERE username = ? OR email = ?", req.Username, req.Email).Scan(&exists)
	if exists > 0 {
		jsonError(w, "Username or email already taken", http.StatusConflict)
		return
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	// Generate quantum-resistant keypair
	pubKey, privKey, err := crypto.GenerateKeyPair(req.KeyIterations)
	if err != nil {
		jsonError(w, "Failed to generate keypair", http.StatusInternalServerError)
		return
	}

	// Generate salt for private key encryption
	salt := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		jsonError(w, "Failed to generate salt", http.StatusInternalServerError)
		return
	}

	// Encrypt private key with user's password
	encPrivKey, err := crypto.EncryptPrivateKey(privKey, req.Password, req.KeyIterations, salt)
	if err != nil {
		jsonError(w, "Failed to encrypt private key", http.StatusInternalServerError)
		return
	}

	// Generate IDs
	userID := generateID()
	peerID, _ := crypto.GeneratePeerID()

	// Insert user
	_, err = db.DB.Exec(`INSERT INTO users (id, username, email, password_hash, public_key, encrypted_private_key, key_iterations, key_salt, peer_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		userID, req.Username, req.Email, string(hash), pubKey, encPrivKey, req.KeyIterations, salt, peerID)
	if err != nil {
		jsonError(w, "Failed to create user", http.StatusInternalServerError)
		return
	}

	// Create default settings
	db.DB.Exec("INSERT INTO user_settings (user_id) VALUES (?)", userID)

	// Create stats
	db.DB.Exec("INSERT INTO user_stats (user_id) VALUES (?)", userID)

	// Generate JWT
	token, err := middleware.GenerateToken(userID)
	if err != nil {
		jsonError(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	user := models.User{
		ID:            userID,
		Username:      req.Username,
		Email:         req.Email,
		PeerID:        peerID,
		KeyIterations: req.KeyIterations,
		PublicKey:     pubKey,
		Level:         1,
	}

	jsonResponse(w, http.StatusCreated, models.AuthResponse{Token: token, User: user})
}

func Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var user models.User
	var passwordHash string
	err := db.DB.QueryRow(`SELECT id, username, email, password_hash, display_name, bio, avatar_url, avatar_type,
		banner_url, banner_type, gender, gender_custom, pronouns, languages, public_key, key_iterations, peer_id, advanced_mode, xp, level, card_artwork_url
		FROM users WHERE email = ?`, req.Email).Scan(
		&user.ID, &user.Username, &user.Email, &passwordHash, &user.DisplayName, &user.Bio,
		&user.AvatarURL, &user.AvatarType, &user.BannerURL, &user.BannerType,
		&user.Gender, &user.GenderCustom, &user.Pronouns,
		&user.Languages, &user.PublicKey, &user.KeyIterations, &user.PeerID, &user.AdvancedMode,
		&user.XP, &user.Level, &user.CardArtworkURL)
	if err != nil {
		jsonError(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		jsonError(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Check if 2FA is enabled
	var twoFactorEnabled bool
	var twoFactorSecret string
	db.DB.QueryRow("SELECT COALESCE(us.two_factor_enabled, 0), COALESCE(u.two_factor_secret, '') FROM users u LEFT JOIN user_settings us ON u.id = us.user_id WHERE u.id = ?", user.ID).Scan(&twoFactorEnabled, &twoFactorSecret)
	if twoFactorEnabled && twoFactorSecret != "" {
		// 2FA is required - return a partial response requiring 2FA verification
		jsonResponse(w, http.StatusOK, map[string]interface{}{
			"requires_2fa": true,
			"user_id":      user.ID,
		})
		return
	}

	// Update last seen
	db.DB.Exec("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?", user.ID)

	token, err := middleware.GenerateToken(user.ID)
	if err != nil {
		jsonError(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, models.AuthResponse{Token: token, User: user})
}

func GetMe(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var user models.User
	err := db.DB.QueryRow(`SELECT id, username, email, display_name, bio, avatar_url, avatar_type,
		banner_url, banner_type, gender, gender_custom, pronouns, languages, public_key, key_iterations, peer_id, advanced_mode, xp, level, status, status_message, card_artwork_url
		FROM users WHERE id = ?`, userID).Scan(
		&user.ID, &user.Username, &user.Email, &user.DisplayName, &user.Bio,
		&user.AvatarURL, &user.AvatarType, &user.BannerURL, &user.BannerType,
		&user.Gender, &user.GenderCustom, &user.Pronouns,
		&user.Languages, &user.PublicKey, &user.KeyIterations, &user.PeerID, &user.AdvancedMode,
		&user.XP, &user.Level, &user.Status, &user.StatusMessage, &user.CardArtworkURL)
	if err != nil {
		jsonError(w, "User not found", http.StatusNotFound)
		return
	}

	jsonResponse(w, http.StatusOK, user)
}

func UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req models.UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Input validation
	if req.DisplayName != nil && len(*req.DisplayName) > 100 {
		jsonError(w, "Display name must be under 100 characters", http.StatusBadRequest)
		return
	}
	if req.Bio != nil && len(*req.Bio) > 2000 {
		jsonError(w, "Bio must be under 2000 characters", http.StatusBadRequest)
		return
	}
	if req.Gender != nil && len(*req.Gender) > 50 {
		jsonError(w, "Gender must be under 50 characters", http.StatusBadRequest)
		return
	}
	if req.GenderCustom != nil && len(*req.GenderCustom) > 50 {
		jsonError(w, "Custom gender must be under 50 characters", http.StatusBadRequest)
		return
	}
	if req.StatusMessage != nil && len(*req.StatusMessage) > 200 {
		jsonError(w, "Status message must be under 200 characters", http.StatusBadRequest)
		return
	}

	if req.DisplayName != nil {
		db.DB.Exec("UPDATE users SET display_name = ? WHERE id = ?", *req.DisplayName, userID)
	}
	if req.Bio != nil {
		db.DB.Exec("UPDATE users SET bio = ? WHERE id = ?", *req.Bio, userID)
	}
	if req.Gender != nil {
		db.DB.Exec("UPDATE users SET gender = ? WHERE id = ?", *req.Gender, userID)
	}
	if req.GenderCustom != nil {
		db.DB.Exec("UPDATE users SET gender_custom = ? WHERE id = ?", *req.GenderCustom, userID)
	}
	if req.Pronouns != nil {
		db.DB.Exec("UPDATE users SET pronouns = ? WHERE id = ?", *req.Pronouns, userID)
	}
	if req.Languages != nil {
		db.DB.Exec("UPDATE users SET languages = ? WHERE id = ?", *req.Languages, userID)
	}
	if req.AdvancedMode != nil {
		db.DB.Exec("UPDATE users SET advanced_mode = ? WHERE id = ?", *req.AdvancedMode, userID)
	}
	if req.BannerURL != nil {
		db.DB.Exec("UPDATE users SET banner_url = ? WHERE id = ?", *req.BannerURL, userID)
	}
	if req.BannerType != nil {
		db.DB.Exec("UPDATE users SET banner_type = ? WHERE id = ?", *req.BannerType, userID)
	}
	if req.Status != nil {
		db.DB.Exec("UPDATE users SET status = ? WHERE id = ?", *req.Status, userID)
	}
	if req.StatusMessage != nil {
		db.DB.Exec("UPDATE users SET status_message = ? WHERE id = ?", *req.StatusMessage, userID)
	}
	if req.CardArtworkURL != nil {
		db.DB.Exec("UPDATE users SET card_artwork_url = ? WHERE id = ?", *req.CardArtworkURL, userID)
	}

	// Return updated user
	GetMe(w, r)
}

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
