package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"sync"
)

// IPMasker replaces real IPs with ephemeral peer IDs in all responses
type IPMasker struct {
	mu      sync.RWMutex
	mapping map[string]string
}

var masker = &IPMasker{
	mapping: make(map[string]string),
}

func PrivacyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Strip all IP-revealing headers
		r.Header.Del("X-Forwarded-For")
		r.Header.Del("X-Real-IP")
		r.Header.Del("Forwarded")

		// Replace RemoteAddr with masked ID
		maskedID := masker.getMaskedIP(r.RemoteAddr)
		r.Header.Set("X-Peer-ID", maskedID)

		// Set security headers
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss:; font-src 'self'")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(self), geolocation=()")
		w.Header().Set("X-Peer-ID", maskedID)

		// Never expose real IP
		w.Header().Del("X-Forwarded-For")
		w.Header().Del("X-Real-IP")

		next.ServeHTTP(w, r)
	})
}

func (m *IPMasker) getMaskedIP(realIP string) string {
	m.mu.RLock()
	if masked, ok := m.mapping[realIP]; ok {
		m.mu.RUnlock()
		return masked
	}
	m.mu.RUnlock()

	m.mu.Lock()
	defer m.mu.Unlock()

	// Double-check after acquiring write lock
	if masked, ok := m.mapping[realIP]; ok {
		return masked
	}

	b := make([]byte, 8)
	rand.Read(b)
	masked := "anon_" + hex.EncodeToString(b)
	m.mapping[realIP] = masked
	return masked
}
