package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"raider/db"
	"raider/middleware"
	"raider/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type WSHub struct {
	mu          sync.RWMutex
	connections map[string]*websocket.Conn
	channels    map[string]map[string]bool
	calls       map[string]map[string]bool
}

var Hub = &WSHub{
	connections: make(map[string]*websocket.Conn),
	channels:    make(map[string]map[string]bool),
	calls:       make(map[string]map[string]bool),
}

func (h *WSHub) SendToUser(userID string, msg models.WSMessage) {
	h.mu.RLock()
	conn, ok := h.connections[userID]
	h.mu.RUnlock()
	if ok {
		data, _ := json.Marshal(msg)
		conn.WriteMessage(websocket.TextMessage, data)
	}
}

func (h *WSHub) BroadcastToChannel(channelID string, msg models.WSMessage) {
	h.mu.RLock()
	users, ok := h.channels[channelID]
	h.mu.RUnlock()
	if !ok {
		return
	}
	data, _ := json.Marshal(msg)
	for userID := range users {
		h.mu.RLock()
		conn, ok := h.connections[userID]
		h.mu.RUnlock()
		if ok {
			conn.WriteMessage(websocket.TextMessage, data)
		}
	}
}

func (h *WSHub) BroadcastToCall(callID string, msg models.WSMessage) {
	h.mu.RLock()
	users, ok := h.calls[callID]
	h.mu.RUnlock()
	if !ok {
		return
	}
	data, _ := json.Marshal(msg)
	for userID := range users {
		h.mu.RLock()
		conn, ok := h.connections[userID]
		h.mu.RUnlock()
		if ok {
			conn.WriteMessage(websocket.TextMessage, data)
		}
	}
}

func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	tokenStr := r.URL.Query().Get("token")
	if tokenStr == "" {
		http.Error(w, "Missing token", http.StatusUnauthorized)
		return
	}

	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return middleware.JWTSecret, nil
	})
	if err != nil || !token.Valid {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}
	claims := token.Claims.(jwt.MapClaims)
	userID := claims["user_id"].(string)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		return
	}

	Hub.mu.Lock()
	if old, ok := Hub.connections[userID]; ok {
		old.Close()
	}
	Hub.connections[userID] = conn
	Hub.mu.Unlock()

	log.Printf("WebSocket connected: %s", userID)
	db.DB.Exec("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?", userID)

	defer func() {
		Hub.mu.Lock()
		delete(Hub.connections, userID)
		for chID, users := range Hub.channels {
			delete(users, userID)
			if len(users) == 0 {
				delete(Hub.channels, chID)
			}
		}
		Hub.mu.Unlock()
		conn.Close()
		log.Printf("WebSocket disconnected: %s", userID)
	}()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var msg models.WSMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		handleWSMessage(userID, msg)
	}
}

func handleWSMessage(userID string, msg models.WSMessage) {
	switch msg.Type {
	case "join_channel":
		if payload, ok := msg.Payload.(map[string]interface{}); ok {
			channelID, _ := payload["channel_id"].(string)
			Hub.mu.Lock()
			if Hub.channels[channelID] == nil {
				Hub.channels[channelID] = make(map[string]bool)
			}
			Hub.channels[channelID][userID] = true
			Hub.mu.Unlock()
		}

	case "leave_channel":
		if payload, ok := msg.Payload.(map[string]interface{}); ok {
			channelID, _ := payload["channel_id"].(string)
			Hub.mu.Lock()
			if Hub.channels[channelID] != nil {
				delete(Hub.channels[channelID], userID)
			}
			Hub.mu.Unlock()
		}

	case "join_call":
		if payload, ok := msg.Payload.(map[string]interface{}); ok {
			callID, _ := payload["call_id"].(string)
			Hub.mu.Lock()
			if Hub.calls[callID] == nil {
				Hub.calls[callID] = make(map[string]bool)
			}
			Hub.calls[callID][userID] = true
			Hub.mu.Unlock()
		}

	case "leave_call":
		if payload, ok := msg.Payload.(map[string]interface{}); ok {
			callID, _ := payload["call_id"].(string)
			Hub.mu.Lock()
			if Hub.calls[callID] != nil {
				delete(Hub.calls[callID], userID)
			}
			Hub.mu.Unlock()
		}

	case "typing":
		if payload, ok := msg.Payload.(map[string]interface{}); ok {
			recipientID, _ := payload["recipient_id"].(string)
			channelID, _ := payload["channel_id"].(string)

			var username string
			db.DB.QueryRow("SELECT username FROM users WHERE id = ?", userID).Scan(&username)

			if recipientID != "" {
				Hub.SendToUser(recipientID, models.WSMessage{
					Type: "typing",
					Payload: map[string]interface{}{
						"user_id":  userID,
						"username": username,
						"context":  "dm",
					},
				})
			} else if channelID != "" {
				Hub.BroadcastToChannel(channelID, models.WSMessage{
					Type: "typing",
					Payload: map[string]interface{}{
						"user_id":    userID,
						"username":   username,
						"channel_id": channelID,
						"context":    "channel",
					},
				})
			}
		}

	case "webrtc_signal":
		if payload, ok := msg.Payload.(map[string]interface{}); ok {
			targetID, _ := payload["target_id"].(string)
			Hub.SendToUser(targetID, models.WSMessage{
				Type: "webrtc_signal",
				Payload: map[string]interface{}{
					"from": userID,
					"data": payload["data"],
					"type": payload["signal_type"],
				},
			})
		}
	}
}
