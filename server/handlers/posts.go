package handlers

import (
	"encoding/json"
	"net/http"

	"raider/db"
	"raider/middleware"
	"raider/models"

	"github.com/go-chi/chi/v5"
)

func CreatePost(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req models.CreatePostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Title == "" || req.Content == "" {
		jsonError(w, "Title and content are required", http.StatusBadRequest)
		return
	}

	postID := generateID()
	_, err := db.DB.Exec(`INSERT INTO posts (id, author_id, server_id, title, content, media_url) VALUES (?, ?, ?, ?, ?, ?)`,
		postID, userID, req.ServerID, req.Title, req.Content, req.MediaURL)
	if err != nil {
		jsonError(w, "Failed to create post", http.StatusInternalServerError)
		return
	}

	db.DB.Exec("UPDATE user_stats SET posts_created = posts_created + 1 WHERE user_id = ?", userID)
	addXP(userID, 10)

	var authorName, authorAvatar string
	db.DB.QueryRow("SELECT username, avatar_url FROM users WHERE id = ?", userID).Scan(&authorName, &authorAvatar)

	post := models.Post{
		ID:           postID,
		AuthorID:     userID,
		ServerID:     req.ServerID,
		Title:        req.Title,
		Content:      req.Content,
		MediaURL:     req.MediaURL,
		AuthorName:   authorName,
		AuthorAvatar: authorAvatar,
	}

	jsonResponse(w, http.StatusCreated, post)
}

func GetTimeline(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	// Get posts from users we have handshakes with, plus our own
	rows, err := db.DB.Query(`SELECT p.id, p.author_id, p.server_id, p.title, p.content, p.media_url, p.upvotes, p.downvotes, p.comment_count, p.created_at, p.edited_at,
		u.username, u.avatar_url,
		COALESCE((SELECT vote FROM post_votes WHERE post_id = p.id AND user_id = ?), 0) as user_vote
		FROM posts p
		JOIN users u ON p.author_id = u.id
		WHERE p.server_id IS NULL
		AND (p.author_id = ? OR p.author_id IN (
			SELECT CASE WHEN initiator_id = ? THEN responder_id ELSE initiator_id END
			FROM handshakes WHERE (initiator_id = ? OR responder_id = ?) AND status = 'completed'
		))
		ORDER BY p.created_at DESC LIMIT 50`,
		userID, userID, userID, userID, userID)
	if err != nil {
		jsonError(w, "Failed to fetch timeline", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	posts := []models.Post{}
	for rows.Next() {
		var p models.Post
		rows.Scan(&p.ID, &p.AuthorID, &p.ServerID, &p.Title, &p.Content, &p.MediaURL, &p.Upvotes, &p.Downvotes, &p.CommentCount, &p.CreatedAt, &p.EditedAt,
			&p.AuthorName, &p.AuthorAvatar, &p.UserVote)
		posts = append(posts, p)
	}

	jsonResponse(w, http.StatusOK, posts)
}

func GetServerPosts(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	serverID := chi.URLParam(r, "serverID")

	rows, err := db.DB.Query(`SELECT p.id, p.author_id, p.server_id, p.title, p.content, p.media_url, p.upvotes, p.downvotes, p.comment_count, p.created_at, p.edited_at,
		u.username, u.avatar_url,
		COALESCE((SELECT vote FROM post_votes WHERE post_id = p.id AND user_id = ?), 0) as user_vote
		FROM posts p JOIN users u ON p.author_id = u.id
		WHERE p.server_id = ?
		ORDER BY p.created_at DESC LIMIT 50`, userID, serverID)
	if err != nil {
		jsonError(w, "Failed to fetch posts", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	posts := []models.Post{}
	for rows.Next() {
		var p models.Post
		rows.Scan(&p.ID, &p.AuthorID, &p.ServerID, &p.Title, &p.Content, &p.MediaURL, &p.Upvotes, &p.Downvotes, &p.CommentCount, &p.CreatedAt, &p.EditedAt,
			&p.AuthorName, &p.AuthorAvatar, &p.UserVote)
		posts = append(posts, p)
	}

	jsonResponse(w, http.StatusOK, posts)
}

func VotePost(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	postID := chi.URLParam(r, "postID")

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
	err := db.DB.QueryRow("SELECT vote FROM post_votes WHERE post_id = ? AND user_id = ?", postID, userID).Scan(&existingVote)
	if err == nil {
		if existingVote == req.Vote {
			// Remove vote
			db.DB.Exec("DELETE FROM post_votes WHERE post_id = ? AND user_id = ?", postID, userID)
			if req.Vote == 1 {
				db.DB.Exec("UPDATE posts SET upvotes = upvotes - 1 WHERE id = ?", postID)
			} else {
				db.DB.Exec("UPDATE posts SET downvotes = downvotes - 1 WHERE id = ?", postID)
			}
		} else {
			// Change vote
			db.DB.Exec("UPDATE post_votes SET vote = ? WHERE post_id = ? AND user_id = ?", req.Vote, postID, userID)
			if req.Vote == 1 {
				db.DB.Exec("UPDATE posts SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE id = ?", postID)
			} else {
				db.DB.Exec("UPDATE posts SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE id = ?", postID)
			}
		}
	} else {
		db.DB.Exec("INSERT INTO post_votes (post_id, user_id, vote) VALUES (?, ?, ?)", postID, userID, req.Vote)
		if req.Vote == 1 {
			db.DB.Exec("UPDATE posts SET upvotes = upvotes + 1 WHERE id = ?", postID)
		} else {
			db.DB.Exec("UPDATE posts SET downvotes = downvotes + 1 WHERE id = ?", postID)
		}
	}

	// Update author stats
	var authorID string
	db.DB.QueryRow("SELECT author_id FROM posts WHERE id = ?", postID).Scan(&authorID)
	if req.Vote == 1 {
		db.DB.Exec("UPDATE user_stats SET upvotes_received = upvotes_received + 1 WHERE user_id = ?", authorID)
		addXP(authorID, 2)
	}

	jsonResponse(w, http.StatusOK, map[string]string{"status": "voted"})
}

func GetComments(w http.ResponseWriter, r *http.Request) {
	postID := chi.URLParam(r, "postID")

	rows, err := db.DB.Query(`SELECT c.id, c.post_id, c.author_id, c.parent_id, c.content, c.upvotes, c.created_at,
		u.username
		FROM comments c JOIN users u ON c.author_id = u.id
		WHERE c.post_id = ?
		ORDER BY c.created_at ASC`, postID)
	if err != nil {
		jsonError(w, "Failed to fetch comments", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	comments := []models.Comment{}
	for rows.Next() {
		var c models.Comment
		rows.Scan(&c.ID, &c.PostID, &c.AuthorID, &c.ParentID, &c.Content, &c.Upvotes, &c.CreatedAt, &c.AuthorName)
		comments = append(comments, c)
	}

	jsonResponse(w, http.StatusOK, comments)
}

func CreateComment(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	postID := chi.URLParam(r, "postID")

	var req struct {
		Content  string  `json:"content"`
		ParentID *string `json:"parent_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	commentID := generateID()
	db.DB.Exec(`INSERT INTO comments (id, post_id, author_id, parent_id, content) VALUES (?, ?, ?, ?, ?)`,
		commentID, postID, userID, req.ParentID, req.Content)
	db.DB.Exec("UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?", postID)
	addXP(userID, 3)

	var authorName string
	db.DB.QueryRow("SELECT username FROM users WHERE id = ?", userID).Scan(&authorName)

	comment := models.Comment{
		ID:         commentID,
		PostID:     postID,
		AuthorID:   userID,
		ParentID:   req.ParentID,
		Content:    req.Content,
		AuthorName: authorName,
	}

	jsonResponse(w, http.StatusCreated, comment)
}

func EditPost(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	postID := chi.URLParam(r, "postID")

	// Verify ownership
	var authorID string
	err := db.DB.QueryRow("SELECT author_id FROM posts WHERE id = ?", postID).Scan(&authorID)
	if err != nil {
		jsonError(w, "Post not found", http.StatusNotFound)
		return
	}
	if authorID != userID {
		jsonError(w, "Not authorized", http.StatusForbidden)
		return
	}

	var req struct {
		Title   string `json:"title"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	_, err = db.DB.Exec("UPDATE posts SET title = ?, content = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ?",
		req.Title, req.Content, postID)
	if err != nil {
		jsonError(w, "Failed to edit post", http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, map[string]string{"status": "edited"})
}

func DeletePost(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	postID := chi.URLParam(r, "postID")

	// Verify ownership
	var authorID string
	err := db.DB.QueryRow("SELECT author_id FROM posts WHERE id = ?", postID).Scan(&authorID)
	if err != nil {
		jsonError(w, "Post not found", http.StatusNotFound)
		return
	}
	if authorID != userID {
		jsonError(w, "Not authorized", http.StatusForbidden)
		return
	}

	db.DB.Exec("DELETE FROM post_votes WHERE post_id = ?", postID)
	db.DB.Exec("DELETE FROM comments WHERE post_id = ?", postID)
	db.DB.Exec("DELETE FROM shares WHERE post_id = ?", postID)
	_, err = db.DB.Exec("DELETE FROM posts WHERE id = ?", postID)
	if err != nil {
		jsonError(w, "Failed to delete post", http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, map[string]string{"status": "deleted"})
}
