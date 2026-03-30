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

var allowedOrigins = map[string]bool{
	"http://localhost:3000":   true,
	"http://localhost:5173":   true,
	"http://127.0.0.1:3000":  true,
	"http://127.0.0.1:5173":  true,
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true // Allow non-browser clients
		}
		return allowedOrigins[origin]
	},
}

// wsClient wraps a websocket connection with a per-connection write mutex.
// gorilla/websocket requires serialized writes; without this, concurrent
// BroadcastToServer / SendToUser calls on the same conn cause ECONNABORTED.
type wsClient struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (c *wsClient) write(data []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.conn.WriteMessage(websocket.TextMessage, data)
}

func (c *wsClient) close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.conn.Close()
}

type WSHub struct {
	mu            sync.RWMutex
	connections   map[string]*wsClient
	channels      map[string]map[string]bool
	calls         map[string]map[string]bool
	voiceChannels map[string]map[string]bool
	groups        map[string]map[string]bool
}

var Hub = &WSHub{
	connections:   make(map[string]*wsClient),
	channels:      make(map[string]map[string]bool),
	calls:         make(map[string]map[string]bool),
	voiceChannels: make(map[string]map[string]bool),
	groups:        make(map[string]map[string]bool),
}

func (h *WSHub) SendToUser(userID string, msg models.WSMessage) {
	h.mu.RLock()
	client, ok := h.connections[userID]
	h.mu.RUnlock()
	if ok {
		data, _ := json.Marshal(msg)
		client.write(data)
	}
}

func (h *WSHub) Broadcast(msg models.WSMessage) {
	data, _ := json.Marshal(msg)
	h.mu.RLock()
	clients := make([]*wsClient, 0, len(h.connections))
	for _, c := range h.connections {
		clients = append(clients, c)
	}
	h.mu.RUnlock()
	for _, c := range clients {
		c.write(data)
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
		client, ok := h.connections[userID]
		h.mu.RUnlock()
		if ok {
			client.write(data)
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
		client, ok := h.connections[userID]
		h.mu.RUnlock()
		if ok {
			client.write(data)
		}
	}
}

// BroadcastToServer sends a message to every member of a server who is connected.
func (h *WSHub) BroadcastToServer(serverID string, msg models.WSMessage) {
	rows, err := db.DB.Query("SELECT user_id FROM server_members WHERE server_id = ?", serverID)
	if err != nil {
		return
	}
	defer rows.Close()
	data, _ := json.Marshal(msg)
	for rows.Next() {
		var uid string
		rows.Scan(&uid)
		h.mu.RLock()
		client, ok := h.connections[uid]
		h.mu.RUnlock()
		if ok {
			client.write(data)
		}
	}
}

func (h *WSHub) BroadcastToGroup(groupID string, msg models.WSMessage) {
	h.mu.RLock()
	users, ok := h.groups[groupID]
	h.mu.RUnlock()
	if !ok {
		return
	}
	data, _ := json.Marshal(msg)
	for userID := range users {
		h.mu.RLock()
		client, ok := h.connections[userID]
		h.mu.RUnlock()
		if ok {
			client.write(data)
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
		old.close()
	}
	Hub.connections[userID] = &wsClient{conn: conn}
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
		for gID, users := range Hub.groups {
			delete(users, userID)
			if len(users) == 0 {
				delete(Hub.groups, gID)
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

	case "set_status":
		if payload, ok := msg.Payload.(map[string]interface{}); ok {
			status, _ := payload["status"].(string)
			statusMessage, _ := payload["status_message"].(string)

			// Update DB
			db.DB.Exec("UPDATE users SET status = ?, status_message = ? WHERE id = ?", status, statusMessage, userID)

			// Get user info for broadcast
			var username string
			db.DB.QueryRow("SELECT username FROM users WHERE id = ?", userID).Scan(&username)

			// Broadcast to all connected users (status is public)
			Hub.mu.RLock()
			recipients := make([]string, 0, len(Hub.connections))
			for uid := range Hub.connections {
				if uid != userID {
					recipients = append(recipients, uid)
				}
			}
			Hub.mu.RUnlock()
			for _, uid := range recipients {
				Hub.SendToUser(uid, models.WSMessage{
					Type: "status_change",
					Payload: map[string]interface{}{
						"user_id":        userID,
						"username":       username,
						"status":         status,
						"status_message": statusMessage,
					},
				})
			}
		}

	case "join_voice":
		if payload, ok := msg.Payload.(map[string]interface{}); ok {
			channelID, _ := payload["channel_id"].(string)
			serverID, _ := payload["server_id"].(string)
			
			Hub.mu.Lock()
			// Track user in voice channel
			if Hub.voiceChannels[channelID] == nil {
				Hub.voiceChannels[channelID] = make(map[string]bool)
			}
			Hub.voiceChannels[channelID][userID] = true
			
			// Snapshot participants while holding lock
			participants := []string{}
			voiceUIDs := make([]string, 0, len(Hub.voiceChannels[channelID]))
			for uid := range Hub.voiceChannels[channelID] {
				participants = append(participants, uid)
				voiceUIDs = append(voiceUIDs, uid)
			}
			Hub.mu.Unlock()
			
			for _, uid := range voiceUIDs {
				Hub.SendToUser(uid, models.WSMessage{
					Type: "voice_participants",
					Payload: map[string]interface{}{
						"channel_id":   channelID,
						"server_id":    serverID,
						"participants": participants,
					},
				})
			}
		}

	case "leave_voice":
		if payload, ok := msg.Payload.(map[string]interface{}); ok {
			channelID, _ := payload["channel_id"].(string)
			
			Hub.mu.Lock()
			if Hub.voiceChannels[channelID] != nil {
				delete(Hub.voiceChannels[channelID], userID)
			}
			// Snapshot remaining participants
			participants := []string{}
			voiceUIDs := []string{}
			for uid := range Hub.voiceChannels[channelID] {
				participants = append(participants, uid)
				voiceUIDs = append(voiceUIDs, uid)
			}
			Hub.mu.Unlock()
			
			for _, uid := range voiceUIDs {
				Hub.SendToUser(uid, models.WSMessage{
					Type: "voice_participants",
					Payload: map[string]interface{}{
						"channel_id":   channelID,
						"participants": participants,
					},
				})
			}
		}

	case "join_group":
		if payload, ok := msg.Payload.(map[string]interface{}); ok {
			groupID, _ := payload["group_id"].(string)
			
			Hub.mu.Lock()
			if Hub.groups[groupID] == nil {
				Hub.groups[groupID] = make(map[string]bool)
			}
			Hub.groups[groupID][userID] = true
			Hub.mu.Unlock()
		}

	case "leave_group":
		if payload, ok := msg.Payload.(map[string]interface{}); ok {
			groupID, _ := payload["group_id"].(string)
			
			Hub.mu.Lock()
			if Hub.groups[groupID] != nil {
				delete(Hub.groups[groupID], userID)
			}
			Hub.mu.Unlock()
		}
	}
}
