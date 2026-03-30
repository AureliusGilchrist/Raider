package handlers

import (
	"encoding/json"
	"net/http"

	"raider/db"
	"raider/middleware"
	"raider/models"

	"github.com/go-chi/chi/v5"
)

func ShareContent(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		ShareType string  `json:"share_type"` // "post" or "message"
		PostID    *string `json:"post_id"`
		MessageID *string `json:"message_id"`
		Comment   string  `json:"comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.ShareType != "post" && req.ShareType != "message" {
		jsonError(w, "share_type must be 'post' or 'message'", http.StatusBadRequest)
		return
	}

	var originalServerID *string

	if req.ShareType == "post" {
		if req.PostID == nil || *req.PostID == "" {
			jsonError(w, "post_id is required for post shares", http.StatusBadRequest)
			return
		}

		// Check the post exists and get its server_id
		var authorID string
		var serverID *string
		err := db.DB.QueryRow("SELECT author_id, server_id FROM posts WHERE id = ?", *req.PostID).Scan(&authorID, &serverID)
		if err != nil {
			jsonError(w, "Post not found", http.StatusNotFound)
			return
		}
		originalServerID = serverID

		// If it's a server post, check sharing permissions
		if serverID != nil && *serverID != "" {
			// 1. Check user is a member of the server
			var memberCount int
			db.DB.QueryRow("SELECT COUNT(*) FROM server_members WHERE server_id = ? AND user_id = ?",
				*serverID, userID).Scan(&memberCount)
			if memberCount == 0 {
				jsonError(w, "You must be a member of the server to share its content", http.StatusForbidden)
				return
			}

			// 2. Check server allows sharing
			var allowSharing bool
			db.DB.QueryRow("SELECT allow_sharing FROM servers WHERE id = ?", *serverID).Scan(&allowSharing)
			if !allowSharing {
				jsonError(w, "This server does not allow sharing content outside", http.StatusForbidden)
				return
			}
		} else {
			// Personal post — user must have a handshake with the author (or be the author)
			if authorID != userID {
				var hsCount int
				db.DB.QueryRow(`SELECT COUNT(*) FROM handshakes
					WHERE ((initiator_id = ? AND responder_id = ?) OR (initiator_id = ? AND responder_id = ?))
					AND status = 'completed'`,
					userID, authorID, authorID, userID).Scan(&hsCount)
				if hsCount == 0 {
					jsonError(w, "You need a handshake with this user to share their post", http.StatusForbidden)
					return
				}
			}
		}
	}

	if req.ShareType == "message" {
		if req.MessageID == nil || *req.MessageID == "" {
			jsonError(w, "message_id is required for message shares", http.StatusBadRequest)
			return
		}

		// Get the message
		var senderID string
		var channelID, serverID, recipientID *string
		err := db.DB.QueryRow("SELECT sender_id, channel_id, server_id, recipient_id FROM messages WHERE id = ?",
			*req.MessageID).Scan(&senderID, &channelID, &serverID, &recipientID)
		if err != nil {
			jsonError(w, "Message not found", http.StatusNotFound)
			return
		}

		if serverID != nil && *serverID != "" {
			originalServerID = serverID

			// Server message — check membership + allow_sharing
			var memberCount int
			db.DB.QueryRow("SELECT COUNT(*) FROM server_members WHERE server_id = ? AND user_id = ?",
				*serverID, userID).Scan(&memberCount)
			if memberCount == 0 {
				jsonError(w, "You must be a member of the server to share its messages", http.StatusForbidden)
				return
			}

			var allowSharing bool
			db.DB.QueryRow("SELECT allow_sharing FROM servers WHERE id = ?", *serverID).Scan(&allowSharing)
			if !allowSharing {
				jsonError(w, "This server does not allow sharing content outside", http.StatusForbidden)
				return
			}
		} else if recipientID != nil {
			// DM message — only sender or recipient can share, and they need a handshake
			if senderID != userID && (recipientID == nil || *recipientID != userID) {
				jsonError(w, "You can only share messages you sent or received", http.StatusForbidden)
				return
			}

			// Determine the other party
			otherID := senderID
			if senderID == userID && recipientID != nil {
				otherID = *recipientID
			}

			var hsCount int
			db.DB.QueryRow(`SELECT COUNT(*) FROM handshakes
				WHERE ((initiator_id = ? AND responder_id = ?) OR (initiator_id = ? AND responder_id = ?))
				AND status = 'completed'`,
				userID, otherID, otherID, userID).Scan(&hsCount)
			if hsCount == 0 {
				jsonError(w, "You need a handshake with this user to share DM content", http.StatusForbidden)
				return
			}
		}
	}

	shareID := generateID()
	_, err := db.DB.Exec(`INSERT INTO shares (id, user_id, share_type, post_id, message_id, comment, original_server_id)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		shareID, userID, req.ShareType, req.PostID, req.MessageID, req.Comment, originalServerID)
	if err != nil {
		jsonError(w, "Failed to share content", http.StatusInternalServerError)
		return
	}

	addXP(userID, 5)

	jsonResponse(w, http.StatusCreated, map[string]string{"id": shareID, "status": "shared"})
}

func GetMyShares(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := db.DB.Query(`SELECT s.id, s.user_id, s.share_type, s.post_id, s.message_id, s.comment,
		s.original_server_id, s.created_at, u.username, u.avatar_url
		FROM shares s JOIN users u ON s.user_id = u.id
		WHERE s.user_id = ?
		ORDER BY s.created_at DESC LIMIT 50`, userID)
	if err != nil {
		jsonError(w, "Failed to fetch shares", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	shares := []models.Share{}
	for rows.Next() {
		var s models.Share
		rows.Scan(&s.ID, &s.UserID, &s.ShareType, &s.PostID, &s.MessageID, &s.Comment,
			&s.OriginalServerID, &s.CreatedAt, &s.SharerName, &s.SharerAvatar)

		resolveShareContent(&s, userID)
		shares = append(shares, s)
	}

	jsonResponse(w, http.StatusOK, shares)
}

func GetTimelineShares(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	// Get shares from users we have handshakes with, plus our own
	rows, err := db.DB.Query(`SELECT s.id, s.user_id, s.share_type, s.post_id, s.message_id, s.comment,
		s.original_server_id, s.created_at, u.username, u.avatar_url
		FROM shares s JOIN users u ON s.user_id = u.id
		WHERE s.user_id = ? OR s.user_id IN (
			SELECT CASE WHEN initiator_id = ? THEN responder_id ELSE initiator_id END
			FROM handshakes WHERE (initiator_id = ? OR responder_id = ?) AND status = 'completed'
		)
		ORDER BY s.created_at DESC LIMIT 50`,
		userID, userID, userID, userID)
	if err != nil {
		jsonError(w, "Failed to fetch shares", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	shares := []models.Share{}
	for rows.Next() {
		var s models.Share
		rows.Scan(&s.ID, &s.UserID, &s.ShareType, &s.PostID, &s.MessageID, &s.Comment,
			&s.OriginalServerID, &s.CreatedAt, &s.SharerName, &s.SharerAvatar)

		// Visibility check: if shared content is from a server, viewer must be a member
		if s.OriginalServerID != nil && *s.OriginalServerID != "" {
			var isMember int
			db.DB.QueryRow("SELECT COUNT(*) FROM server_members WHERE server_id = ? AND user_id = ?",
				*s.OriginalServerID, userID).Scan(&isMember)
			if isMember == 0 {
				// Viewer isn't in the server — skip this share
				continue
			}
		}

		resolveShareContent(&s, userID)
		if s.Post == nil && s.Message == nil {
			continue // content was deleted
		}
		shares = append(shares, s)
	}

	jsonResponse(w, http.StatusOK, shares)
}

func DeleteShare(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		ShareID string `json:"share_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Only owner can delete
	var ownerID string
	err := db.DB.QueryRow("SELECT user_id FROM shares WHERE id = ?", req.ShareID).Scan(&ownerID)
	if err != nil {
		jsonError(w, "Share not found", http.StatusNotFound)
		return
	}
	if ownerID != userID {
		jsonError(w, "Not authorized", http.StatusForbidden)
		return
	}

	db.DB.Exec("DELETE FROM shares WHERE id = ?", req.ShareID)
	jsonResponse(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func VoteShare(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	shareID := chi.URLParam(r, "shareID")

	var req models.VoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Vote != 1 && req.Vote != -1 {
		jsonError(w, "Vote must be 1 or -1", http.StatusBadRequest)
		return
	}

	// Check existing vote
	var existingVote int
	err := db.DB.QueryRow("SELECT vote FROM share_votes WHERE share_id = ? AND user_id = ?", shareID, userID).Scan(&existingVote)
	if err == nil {
		if existingVote == req.Vote {
			db.DB.Exec("DELETE FROM share_votes WHERE share_id = ? AND user_id = ?", shareID, userID)
			db.DB.Exec("UPDATE shares SET upvotes = upvotes - ? WHERE id = ?", req.Vote, shareID)
		} else {
			db.DB.Exec("UPDATE share_votes SET vote = ? WHERE share_id = ? AND user_id = ?", req.Vote, shareID, userID)
			db.DB.Exec("UPDATE shares SET upvotes = upvotes + ?, downvotes = downvotes + ? WHERE id = ?", 
				req.Vote, -existingVote, shareID)
		}
	} else {
		db.DB.Exec("INSERT INTO share_votes (share_id, user_id, vote) VALUES (?, ?, ?)", shareID, userID, req.Vote)
		db.DB.Exec("UPDATE shares SET upvotes = upvotes + ? WHERE id = ?", req.Vote, shareID)
	}

	jsonResponse(w, http.StatusOK, map[string]string{"status": "voted"})
}

// resolveShareContent loads the embedded post or message for a share
func resolveShareContent(s *models.Share, viewerID string) {
	if s.ShareType == "post" && s.PostID != nil {
		var p models.Post
		err := db.DB.QueryRow(`SELECT p.id, p.author_id, p.server_id, p.title, p.content, p.media_url,
			p.upvotes, p.downvotes, p.comment_count, p.created_at, u.username, u.avatar_url,
			COALESCE((SELECT vote FROM post_votes WHERE post_id = p.id AND user_id = ?), 0)
			FROM posts p JOIN users u ON p.author_id = u.id WHERE p.id = ?`,
			viewerID, *s.PostID).Scan(
			&p.ID, &p.AuthorID, &p.ServerID, &p.Title, &p.Content, &p.MediaURL,
			&p.Upvotes, &p.Downvotes, &p.CommentCount, &p.CreatedAt,
			&p.AuthorName, &p.AuthorAvatar, &p.UserVote)
		if err == nil {
			s.Post = &p
		}
	} else if s.ShareType == "message" && s.MessageID != nil {
		var m models.Message
		err := db.DB.QueryRow(`SELECT m.id, m.channel_id, m.sender_id, m.recipient_id, m.server_id,
			m.content, m.encrypted, m.created_at, u.username, u.avatar_url
			FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?`,
			*s.MessageID).Scan(
			&m.ID, &m.ChannelID, &m.SenderID, &m.RecipientID, &m.ServerID,
			&m.Content, &m.Encrypted, &m.CreatedAt, &m.SenderName, &m.SenderAvatar)
		if err == nil {
			s.Message = &m
		}
	}
}
