package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"raider/db"
	"raider/middleware"
	"raider/models"

	"github.com/go-chi/chi/v5"
)

func CreateCall(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		ServerID    *string  `json:"server_id"`
		ChannelID   *string  `json:"channel_id"`
		TargetID    *string  `json:"target_id"`
		RingTargets []string `json:"ring_targets"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ringTargetsJSON, _ := json.Marshal(req.RingTargets)

	callID := generateID()
	_, err := db.DB.Exec(`INSERT INTO call_sessions (id, creator_id, server_id, channel_id, ring_targets) VALUES (?, ?, ?, ?, ?)`,
		callID, userID, req.ServerID, req.ChannelID, string(ringTargetsJSON))
	if err != nil {
		jsonError(w, "Failed to create call", http.StatusInternalServerError)
		return
	}

	// Add creator as participant
	db.DB.Exec(`INSERT INTO call_participants (call_id, user_id) VALUES (?, ?)`, callID, userID)
	db.DB.Exec("UPDATE user_stats SET calls_joined = calls_joined + 1 WHERE user_id = ?", userID)
	addXP(userID, 5)

	// Fetch creator display name for the incoming_call notification
	var creatorName string
	db.DB.QueryRow(
		`SELECT COALESCE(NULLIF(display_name,''), username) FROM users WHERE id = ?`, userID,
	).Scan(&creatorName)

	call := models.CallSession{
		ID:          callID,
		CreatorID:   userID,
		ServerID:    req.ServerID,
		ChannelID:   req.ChannelID,
		RingTargets: req.RingTargets,
		Active:      true,
	}

	// Notification payload includes the creator's name so the recipient can display it
	notifPayload := map[string]interface{}{
		"id":           callID,
		"creator_id":   userID,
		"creator_name": creatorName,
		"server_id":    req.ServerID,
		"channel_id":   req.ChannelID,
		"active":       true,
	}

	// Notify target user(s) for DM or selected group members
	if req.TargetID != nil {
		// DM call – ring the single target
		Hub.SendToUser(*req.TargetID, models.WSMessage{
			Type:    "incoming_call",
			Payload: notifPayload,
		})
	} else if len(req.RingTargets) > 0 {
		// Group call with explicit ring targets – only ring selected users
		for _, targetID := range req.RingTargets {
			if targetID != userID {
				Hub.SendToUser(targetID, models.WSMessage{
					Type:    "incoming_call",
					Payload: notifPayload,
				})
			}
		}
	} else if req.ServerID != nil && req.ChannelID != nil {
		// Group/channel call with no explicit ring targets – ring all server members
		rows, err := db.DB.Query(
			`SELECT user_id FROM server_members WHERE server_id = ? AND user_id != ?`,
			req.ServerID, userID,
		)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var memberID string
				if rows.Scan(&memberID) == nil {
					Hub.SendToUser(memberID, models.WSMessage{
						Type:    "incoming_call",
						Payload: notifPayload,
					})
				}
			}
		}
	}

	jsonResponse(w, http.StatusCreated, call)
}

func JoinCall(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	callID := chi.URLParam(r, "callID")

	// Check call exists and is active
	var active bool
	err := db.DB.QueryRow("SELECT active FROM call_sessions WHERE id = ?", callID).Scan(&active)
	if err != nil {
		jsonError(w, "Call not found", http.StatusNotFound)
		return
	}
	if !active {
		jsonError(w, "Call has ended", http.StatusBadRequest)
		return
	}

	// Add participant (upsert - they may be rejoining)
	db.DB.Exec(`INSERT OR REPLACE INTO call_participants (call_id, user_id, left_at) VALUES (?, ?, NULL)`, callID, userID)
	db.DB.Exec("UPDATE user_stats SET calls_joined = calls_joined + 1 WHERE user_id = ?", userID)
	addXP(userID, 5)

	// Notify other participants
	Hub.BroadcastToCall(callID, models.WSMessage{
		Type: "user_joined_call",
		Payload: map[string]string{
			"user_id": userID,
			"call_id": callID,
		},
	})

	jsonResponse(w, http.StatusOK, map[string]string{"status": "joined", "call_id": callID})
}

func LeaveCall(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	callID := chi.URLParam(r, "callID")

	// Mark participant as left (but don't end the call - it stays as a server/room)
	db.DB.Exec("UPDATE call_participants SET left_at = CURRENT_TIMESTAMP WHERE call_id = ? AND user_id = ?", callID, userID)

	// Notify others
	Hub.BroadcastToCall(callID, models.WSMessage{
		Type: "user_left_call",
		Payload: map[string]string{
			"user_id": userID,
			"call_id": callID,
		},
	})

	// Check if anyone is still in the call
	var activeCount int
	db.DB.QueryRow("SELECT COUNT(*) FROM call_participants WHERE call_id = ? AND left_at IS NULL", callID).Scan(&activeCount)

	// Call persists even if empty (like a server) - only end explicitly
	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"status":             "left",
		"active_participants": activeCount,
	})
}

func EndCall(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	callID := chi.URLParam(r, "callID")

	// Only creator can end
	var creatorID string
	db.DB.QueryRow("SELECT creator_id FROM call_sessions WHERE id = ?", callID).Scan(&creatorID)
	if creatorID != userID {
		jsonError(w, "Only the creator can end the call", http.StatusForbidden)
		return
	}

	db.DB.Exec("UPDATE call_sessions SET active = 0, ended_at = CURRENT_TIMESTAMP WHERE id = ?", callID)
	db.DB.Exec("UPDATE call_participants SET left_at = CURRENT_TIMESTAMP WHERE call_id = ? AND left_at IS NULL", callID)

	Hub.BroadcastToCall(callID, models.WSMessage{
		Type:    "call_ended",
		Payload: map[string]string{"call_id": callID},
	})

	jsonResponse(w, http.StatusOK, map[string]string{"status": "ended"})
}

func GetActiveCalls(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := db.DB.Query(`SELECT cs.id, cs.creator_id, cs.server_id, cs.channel_id, cs.created_at,
		u.username as creator_name,
		(SELECT COUNT(*) FROM call_participants WHERE call_id = cs.id AND left_at IS NULL) as participant_count
		FROM call_sessions cs
		JOIN users u ON cs.creator_id = u.id
		WHERE cs.active = 1 AND (
			cs.creator_id = ? OR
			cs.server_id IN (SELECT server_id FROM server_members WHERE user_id = ?) OR
			cs.id IN (SELECT call_id FROM call_participants WHERE user_id = ?)
		)
		ORDER BY cs.created_at DESC`, userID, userID, userID)
	if err != nil {
		jsonError(w, "Failed to fetch calls", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type CallInfo struct {
		ID               string  `json:"id"`
		CreatorID        string  `json:"creator_id"`
		ServerID         *string `json:"server_id"`
		ChannelID        *string `json:"channel_id"`
		CreatedAt        string  `json:"created_at"`
		CreatorName      string  `json:"creator_name"`
		ParticipantCount int     `json:"participant_count"`
	}

	calls := []CallInfo{}
	for rows.Next() {
		var c CallInfo
		rows.Scan(&c.ID, &c.CreatorID, &c.ServerID, &c.ChannelID, &c.CreatedAt, &c.CreatorName, &c.ParticipantCount)
		calls = append(calls, c)
	}

	jsonResponse(w, http.StatusOK, calls)
}

// WebRTC signaling - relay SDP/ICE through server to hide IPs
func SignalWebRTC(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var signal struct {
		CallID   string      `json:"call_id"`
		TargetID string      `json:"target_id"`
		Type     string      `json:"type"` // offer, answer, ice-candidate
		Data     interface{} `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&signal); err != nil {
		jsonError(w, "Invalid signal", http.StatusBadRequest)
		return
	}

	// For ICE candidates, strip host and srflx candidates to prevent IP leakage.
	// Only relay-type candidates (from a TURN server) are forwarded.
	// If no TURN server is configured, all candidates are dropped here to avoid exposing IPs.
	filteredData := signal.Data
	if signal.Type == "ice-candidate" {
		if candidateMap, ok := signal.Data.(map[string]interface{}); ok {
			candidate, _ := candidateMap["candidate"].(string)
			// Drop host (direct IP) and srflx (server-reflexive / public IP) candidates.
			// Only forward relay candidates sourced from a TURN server.
			if strings.Contains(candidate, " host ") || strings.Contains(candidate, " srflx ") {
				// Silently drop to prevent IP leakage
				jsonResponse(w, http.StatusOK, map[string]string{"status": "dropped"})
				return
			}
			filteredData = candidateMap
		}
	}

	// Relay signal to target user
	Hub.SendToUser(signal.TargetID, models.WSMessage{
		Type: "webrtc_signal",
		Payload: map[string]interface{}{
			"from":    userID,
			"call_id": signal.CallID,
			"type":    signal.Type,
			"data":    filteredData,
		},
	})

	jsonResponse(w, http.StatusOK, map[string]string{"status": "relayed"})
}
