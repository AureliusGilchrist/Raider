package middleware

import (
	"net/http"
	"time"

	"github.com/go-chi/httprate"
)

// GeneralRateLimit limits general API requests per IP
func GeneralRateLimit() func(http.Handler) http.Handler {
	return httprate.LimitByIP(120, 1*time.Minute)
}

// AuthRateLimit limits authentication attempts per IP
func AuthRateLimit() func(http.Handler) http.Handler {
	return httprate.LimitByIP(10, 1*time.Minute)
}

// UploadRateLimit limits file uploads per IP
func UploadRateLimit() func(http.Handler) http.Handler {
	return httprate.LimitByIP(20, 1*time.Minute)
}

// WebSocketRateLimit limits WebSocket connection attempts per IP
func WebSocketRateLimit() func(http.Handler) http.Handler {
	return httprate.LimitByIP(5, 1*time.Minute)
}
