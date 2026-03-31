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

	visibility := req.Visibility
	if visibility == "" {
		visibility = "followers"
	}
	if visibility != "followers" && visibility != "logged_in" && visibility != "public" {
		jsonError(w, "Invalid visibility", http.StatusBadRequest)
		return
	}
	allowShare := true
	if req.AllowShare != nil {
		allowShare = *req.AllowShare
	}
	allowPublicComments := true
	if req.AllowPublicComments != nil {
		allowPublicComments = *req.AllowPublicComments
	}

	postID := generateID()
	_, err := db.DB.Exec(`INSERT INTO posts (id, author_id, server_id, title, content, media_url, visibility, allow_share, allow_public_comments)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		postID, userID, req.ServerID, req.Title, req.Content, req.MediaURL, visibility, allowShare, allowPublicComments)
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
		Visibility:   visibility,
		AllowShare:   allowShare,
		AllowPublicComments: allowPublicComments,
		AuthorName:   authorName,
		AuthorAvatar: authorAvatar,
	}

	// Broadcast new post to all connected users
	Hub.Broadcast(models.WSMessage{
		Type:    "new_post",
		Payload: post,
	})

	jsonResponse(w, http.StatusCreated, post)
}

func GetTimeline(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	algorithm := r.URL.Query().Get("algorithm") // "chronological" or "for-you"

	var posts []models.Post

	if algorithm == "for-you" {
		posts = getAlgorithmicFeed(userID)
	} else {
		posts = getChronologicalFeed(userID)
	}

	// Fallback: if personal feed is empty, include popular posts from everyone
	if len(posts) == 0 {
		posts = getPopularPosts(userID, 20)
	}

	// Always ensure there's SOMETHING to show - include trending if still empty
	if len(posts) == 0 {
		posts = getTrendingPosts(userID, 20)
	}

	jsonResponse(w, http.StatusOK, posts)
}

func getChronologicalFeed(userID string) []models.Post {
	rows, err := db.DB.Query(`SELECT p.id, p.author_id, p.server_id, p.title, p.content, p.media_url, p.visibility, p.allow_share, p.allow_public_comments, p.upvotes, p.downvotes, p.comment_count, p.created_at, p.edited_at,
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
		return nil
	}
	defer rows.Close()

	posts := []models.Post{}
	for rows.Next() {
		var p models.Post
		rows.Scan(&p.ID, &p.AuthorID, &p.ServerID, &p.Title, &p.Content, &p.MediaURL, &p.Visibility, &p.AllowShare, &p.AllowPublicComments, &p.Upvotes, &p.Downvotes, &p.CommentCount, &p.CreatedAt, &p.EditedAt,
			&p.AuthorName, &p.AuthorAvatar, &p.UserVote)
		posts = append(posts, p)
	}
	return posts
}

func getAlgorithmicFeed(userID string) []models.Post {
	// Algorithm: score = (upvotes * 2) + (comment_count * 3) + (recency_bonus)
	// Recency bonus: posts from last 24h get +50, last week +20, last month +5
	rows, err := db.DB.Query(`SELECT p.id, p.author_id, p.server_id, p.title, p.content, p.media_url, p.visibility, p.allow_share, p.allow_public_comments, p.upvotes, p.downvotes, p.comment_count, p.created_at, p.edited_at,
		u.username, u.avatar_url,
		COALESCE((SELECT vote FROM post_votes WHERE post_id = p.id AND user_id = ?), 0) as user_vote,
		-- Calculate engagement score
		((p.upvotes - p.downvotes) * 2 + p.comment_count * 3 +
		CASE 
			WHEN p.created_at > datetime('now', '-1 day') THEN 50
			WHEN p.created_at > datetime('now', '-7 days') THEN 20
			WHEN p.created_at > datetime('now', '-30 days') THEN 5
			ELSE 0
		END) as score
		FROM posts p
		JOIN users u ON p.author_id = u.id
		WHERE p.server_id IS NULL
		AND (p.author_id = ? OR p.author_id IN (
			SELECT CASE WHEN initiator_id = ? THEN responder_id ELSE initiator_id END
			FROM handshakes WHERE (initiator_id = ? OR responder_id = ?) AND status = 'completed'
		))
		ORDER BY score DESC, p.created_at DESC LIMIT 50`,
		userID, userID, userID, userID, userID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	posts := []models.Post{}
	for rows.Next() {
		var p models.Post
		var score int
		rows.Scan(&p.ID, &p.AuthorID, &p.ServerID, &p.Title, &p.Content, &p.MediaURL, &p.Visibility, &p.AllowShare, &p.AllowPublicComments, &p.Upvotes, &p.Downvotes, &p.CommentCount, &p.CreatedAt, &p.EditedAt,
			&p.AuthorName, &p.AuthorAvatar, &p.UserVote, &score)
		posts = append(posts, p)
	}
	return posts
}

func getPopularPosts(userID string, limit int) []models.Post {
	// Get most popular posts from everyone (fallback when personal feed is empty)
	rows, err := db.DB.Query(`SELECT p.id, p.author_id, p.server_id, p.title, p.content, p.media_url, p.visibility, p.allow_share, p.allow_public_comments, p.upvotes, p.downvotes, p.comment_count, p.created_at, p.edited_at,
		u.username, u.avatar_url,
		COALESCE((SELECT vote FROM post_votes WHERE post_id = p.id AND user_id = ?), 0) as user_vote
		FROM posts p
		JOIN users u ON p.author_id = u.id
		WHERE p.server_id IS NULL
		ORDER BY (p.upvotes - p.downvotes) DESC LIMIT ?`,
		userID, limit)
	if err != nil {
		return nil
	}
	defer rows.Close()

	posts := []models.Post{}
	for rows.Next() {
		var p models.Post
		rows.Scan(&p.ID, &p.AuthorID, &p.ServerID, &p.Title, &p.Content, &p.MediaURL, &p.Visibility, &p.AllowShare, &p.AllowPublicComments, &p.Upvotes, &p.Downvotes, &p.CommentCount, &p.CreatedAt, &p.EditedAt,
			&p.AuthorName, &p.AuthorAvatar, &p.UserVote)
		posts = append(posts, p)
	}
	return posts
}

func getTrendingPosts(userID string, limit int) []models.Post {
	// Get recent posts with any engagement (last resort fallback)
	rows, err := db.DB.Query(`SELECT p.id, p.author_id, p.server_id, p.title, p.content, p.media_url, p.visibility, p.allow_share, p.allow_public_comments, p.upvotes, p.downvotes, p.comment_count, p.created_at, p.edited_at,
		u.username, u.avatar_url,
		COALESCE((SELECT vote FROM post_votes WHERE post_id = p.id AND user_id = ?), 0) as user_vote
		FROM posts p
		JOIN users u ON p.author_id = u.id
		WHERE p.server_id IS NULL
		AND p.created_at > datetime('now', '-7 days')
		ORDER BY p.created_at DESC LIMIT ?`,
		userID, limit)
	if err != nil {
		return nil
	}
	defer rows.Close()

	posts := []models.Post{}
	for rows.Next() {
		var p models.Post
		rows.Scan(&p.ID, &p.AuthorID, &p.ServerID, &p.Title, &p.Content, &p.MediaURL, &p.Visibility, &p.AllowShare, &p.AllowPublicComments, &p.Upvotes, &p.Downvotes, &p.CommentCount, &p.CreatedAt, &p.EditedAt,
			&p.AuthorName, &p.AuthorAvatar, &p.UserVote)
		posts = append(posts, p)
	}
	return posts
}

func GetServerPosts(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	serverID := chi.URLParam(r, "serverID")

	rows, err := db.DB.Query(`SELECT p.id, p.author_id, p.server_id, p.title, p.content, p.media_url, p.visibility, p.allow_share, p.allow_public_comments, p.upvotes, p.downvotes, p.comment_count, p.created_at, p.edited_at,
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
		rows.Scan(&p.ID, &p.AuthorID, &p.ServerID, &p.Title, &p.Content, &p.MediaURL, &p.Visibility, &p.AllowShare, &p.AllowPublicComments, &p.Upvotes, &p.Downvotes, &p.CommentCount, &p.CreatedAt, &p.EditedAt,
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

	var postAuthorID string
	if err := db.DB.QueryRow("SELECT author_id FROM posts WHERE id = ?", postID).Scan(&postAuthorID); err != nil {
		jsonError(w, "Post not found", http.StatusNotFound)
		return
	}

	// Read existing vote inside a transaction so concurrent requests can't both
	// see "no vote" and both INSERT.
	tx, err := db.DB.Begin()
	if err != nil {
		jsonError(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var existingVote int
	existingErr := tx.QueryRow("SELECT vote FROM post_votes WHERE post_id = ? AND user_id = ?", postID, userID).Scan(&existingVote)

	// Track whether this is a net new upvote so we award XP/stats exactly once.
	var awardUpvote bool

	if existingErr == nil {
		// User already voted
		if existingVote == req.Vote {
			// Toggle off — remove vote
			tx.Exec("DELETE FROM post_votes WHERE post_id = ? AND user_id = ?", postID, userID)
			if req.Vote == 1 {
				tx.Exec("UPDATE posts SET upvotes = MAX(0, upvotes - 1) WHERE id = ?", postID)
			} else {
				tx.Exec("UPDATE posts SET downvotes = MAX(0, downvotes - 1) WHERE id = ?", postID)
			}
			// Undo previous upvote stat if applicable
			if existingVote == 1 {
				var authorID string
				tx.QueryRow("SELECT author_id FROM posts WHERE id = ?", postID).Scan(&authorID)
				tx.Exec("UPDATE user_stats SET upvotes_received = MAX(0, upvotes_received - 1) WHERE user_id = ?", authorID)
			}
		} else {
			// Change vote direction
			tx.Exec("UPDATE post_votes SET vote = ? WHERE post_id = ? AND user_id = ?", req.Vote, postID, userID)
			if req.Vote == 1 {
				tx.Exec("UPDATE posts SET upvotes = upvotes + 1, downvotes = MAX(0, downvotes - 1) WHERE id = ?", postID)
				awardUpvote = true
			} else {
				tx.Exec("UPDATE posts SET upvotes = MAX(0, upvotes - 1), downvotes = downvotes + 1 WHERE id = ?", postID)
				// Undo the previous upvote stat
				var authorID string
				tx.QueryRow("SELECT author_id FROM posts WHERE id = ?", postID).Scan(&authorID)
				tx.Exec("UPDATE user_stats SET upvotes_received = MAX(0, upvotes_received - 1) WHERE user_id = ?", authorID)
			}
		}
	} else {
		// No existing vote — cast a new one
		_, insertErr := tx.Exec("INSERT OR IGNORE INTO post_votes (post_id, user_id, vote) VALUES (?, ?, ?)", postID, userID, req.Vote)
		if insertErr != nil {
			jsonError(w, "Database error", http.StatusInternalServerError)
			return
		}
		if req.Vote == 1 {
			tx.Exec("UPDATE posts SET upvotes = upvotes + 1 WHERE id = ?", postID)
			awardUpvote = true
		} else {
			tx.Exec("UPDATE posts SET downvotes = downvotes + 1 WHERE id = ?", postID)
		}
	}

	if err := tx.Commit(); err != nil {
		jsonError(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Award XP / stats only for a net-new upvote
	if awardUpvote && postAuthorID != userID {
		var authorID string
		db.DB.QueryRow("SELECT author_id FROM posts WHERE id = ?", postID).Scan(&authorID)
		db.DB.Exec("UPDATE user_stats SET upvotes_received = upvotes_received + 1 WHERE user_id = ?", authorID)
		addXP(authorID, 2)
	}

	// Broadcast vote update
	var upvotes, downvotes int
	db.DB.QueryRow("SELECT upvotes, downvotes FROM posts WHERE id = ?", postID).Scan(&upvotes, &downvotes)
	Hub.Broadcast(models.WSMessage{
		Type: "post_vote_update",
		Payload: map[string]interface{}{
			"post_id":   postID,
			"upvotes":   upvotes,
			"downvotes": downvotes,
		},
	})

	jsonResponse(w, http.StatusOK, map[string]string{"status": "voted"})
}

func canViewPost(p *models.Post, viewerID string) bool {
	if viewerID == p.AuthorID {
		return true
	}
	switch p.Visibility {
	case "public":
		return true
	case "logged_in":
		return viewerID != ""
	default:
		if viewerID == "" {
			return false
		}
		var follows int
		db.DB.QueryRow("SELECT COUNT(*) FROM followers WHERE follower_id = ? AND following_id = ?", viewerID, p.AuthorID).Scan(&follows)
		return follows > 0
	}
}

func getPostByID(postID, viewerID string) (*models.Post, bool, error) {
	var p models.Post
	err := db.DB.QueryRow(`SELECT p.id, p.author_id, p.server_id, p.title, p.content, p.media_url,
		p.visibility, p.allow_share, p.allow_public_comments,
		p.upvotes, p.downvotes, p.comment_count, p.created_at, p.edited_at,
		u.username, u.avatar_url,
		COALESCE((SELECT vote FROM post_votes WHERE post_id = p.id AND user_id = ?), 0)
		FROM posts p JOIN users u ON p.author_id = u.id
		WHERE p.id = ?`, viewerID, postID).Scan(
		&p.ID, &p.AuthorID, &p.ServerID, &p.Title, &p.Content, &p.MediaURL,
		&p.Visibility, &p.AllowShare, &p.AllowPublicComments,
		&p.Upvotes, &p.Downvotes, &p.CommentCount, &p.CreatedAt, &p.EditedAt,
		&p.AuthorName, &p.AuthorAvatar, &p.UserVote)
	if err != nil {
		return nil, false, err
	}

	if p.ServerID != nil && *p.ServerID != "" {
		var allowGuests int
		db.DB.QueryRow("SELECT COALESCE(allow_guests, 0) FROM server_settings WHERE server_id = ?", *p.ServerID).Scan(&allowGuests)
		if viewerID != "" {
			var memberCount int
			db.DB.QueryRow("SELECT COUNT(*) FROM server_members WHERE server_id = ? AND user_id = ?", *p.ServerID, viewerID).Scan(&memberCount)
			if memberCount == 0 && allowGuests == 0 {
				return nil, false, nil
			}
		} else if allowGuests == 0 {
			return nil, false, nil
		}
		return &p, true, nil
	}

	if !canViewPost(&p, viewerID) {
		return nil, false, nil
	}
	return &p, true, nil
}

func GetPublicPost(w http.ResponseWriter, r *http.Request) {
	postID := chi.URLParam(r, "postID")
	viewerID := middleware.GetOptionalUserID(r)

	p, ok, err := getPostByID(postID, viewerID)
	if err != nil {
		jsonError(w, "Post not found", http.StatusNotFound)
		return
	}
	if !ok {
		jsonError(w, "Not allowed to view this post", http.StatusForbidden)
		return
	}

	jsonResponse(w, http.StatusOK, p)
}

func GetPublicPostComments(w http.ResponseWriter, r *http.Request) {
	postID := chi.URLParam(r, "postID")
	viewerID := middleware.GetOptionalUserID(r)

	p, ok, err := getPostByID(postID, viewerID)
	if err != nil {
		jsonError(w, "Post not found", http.StatusNotFound)
		return
	}
	if !ok {
		jsonError(w, "Not allowed to view this post", http.StatusForbidden)
		return
	}
	if viewerID == "" && !p.AllowPublicComments {
		jsonError(w, "Comments require a signed-in account for this post", http.StatusForbidden)
		return
	}

	rows, err := db.DB.Query(`SELECT c.id, c.post_id, c.author_id, c.parent_id, c.content, c.upvotes, c.downvotes, c.created_at, c.edited_at,
		u.username,
		COALESCE((SELECT value FROM comment_votes WHERE comment_id = c.id AND user_id = ?), 0)
		FROM comments c JOIN users u ON c.author_id = u.id
		WHERE c.post_id = ?
		ORDER BY c.created_at ASC`, viewerID, postID)
	if err != nil {
		jsonError(w, "Failed to fetch comments", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	comments := []models.Comment{}
	for rows.Next() {
		var c models.Comment
		rows.Scan(&c.ID, &c.PostID, &c.AuthorID, &c.ParentID, &c.Content, &c.Upvotes, &c.Downvotes, &c.CreatedAt, &c.EditedAt, &c.AuthorName, &c.UserVote)
		comments = append(comments, c)
	}

	jsonResponse(w, http.StatusOK, comments)
}

func GetComments(w http.ResponseWriter, r *http.Request) {
	postID := chi.URLParam(r, "postID")
	userID := middleware.GetUserID(r)

	rows, err := db.DB.Query(`SELECT c.id, c.post_id, c.author_id, c.parent_id, c.content, c.upvotes, c.downvotes, c.created_at, c.edited_at,
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
		rows.Scan(&c.ID, &c.PostID, &c.AuthorID, &c.ParentID, &c.Content, &c.Upvotes, &c.Downvotes, &c.CreatedAt, &c.EditedAt, &c.AuthorName)
		comments = append(comments, c)
	}

	// Attach per-user vote values
	if userID != "" && len(comments) > 0 {
		voteRows, err := db.DB.Query(
			`SELECT comment_id, value FROM comment_votes WHERE user_id = ? AND comment_id IN (SELECT id FROM comments WHERE post_id = ?)`,
			userID, postID)
		if err == nil {
			defer voteRows.Close()
			voteMap := map[string]int{}
			for voteRows.Next() {
				var cid string
				var val int
				voteRows.Scan(&cid, &val)
				voteMap[cid] = val
			}
			for i := range comments {
				comments[i].UserVote = voteMap[comments[i].ID]
			}
		}
	}

	jsonResponse(w, http.StatusOK, comments)
}

func VoteComment(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	commentID := chi.URLParam(r, "commentID")

	var req struct {
		Value int `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || (req.Value != 1 && req.Value != -1 && req.Value != 0) {
		jsonError(w, "Invalid vote value", http.StatusBadRequest)
		return
	}

	// Get existing vote
	var existing int
	db.DB.QueryRow("SELECT value FROM comment_votes WHERE comment_id = ? AND user_id = ?", commentID, userID).Scan(&existing)

	if req.Value == 0 || req.Value == existing {
		// Remove vote
		db.DB.Exec("DELETE FROM comment_votes WHERE comment_id = ? AND user_id = ?", commentID, userID)
		if existing == 1 {
			db.DB.Exec("UPDATE comments SET upvotes = MAX(0, upvotes - 1) WHERE id = ?", commentID)
		} else if existing == -1 {
			db.DB.Exec("UPDATE comments SET downvotes = MAX(0, downvotes - 1) WHERE id = ?", commentID)
		}
	} else {
		// Upsert vote
		db.DB.Exec("INSERT INTO comment_votes (comment_id, user_id, value) VALUES (?, ?, ?) ON CONFLICT(comment_id, user_id) DO UPDATE SET value = excluded.value",
			commentID, userID, req.Value)
		// Adjust counts based on previous vote
		if existing == 1 {
			db.DB.Exec("UPDATE comments SET upvotes = MAX(0, upvotes - 1) WHERE id = ?", commentID)
		} else if existing == -1 {
			db.DB.Exec("UPDATE comments SET downvotes = MAX(0, downvotes - 1) WHERE id = ?", commentID)
		}
		if req.Value == 1 {
			db.DB.Exec("UPDATE comments SET upvotes = upvotes + 1 WHERE id = ?", commentID)
		} else {
			db.DB.Exec("UPDATE comments SET downvotes = downvotes + 1 WHERE id = ?", commentID)
		}
	}

	var c models.Comment
	db.DB.QueryRow("SELECT upvotes, downvotes FROM comments WHERE id = ?", commentID).Scan(&c.Upvotes, &c.Downvotes)
	userVote := 0
	if req.Value != existing {
		userVote = req.Value
	}
	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"upvotes":   c.Upvotes,
		"downvotes": c.Downvotes,
		"user_vote": userVote,
	})
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

	// Broadcast new comment
	var commentCount int
	db.DB.QueryRow("SELECT comment_count FROM posts WHERE id = ?", postID).Scan(&commentCount)
	Hub.Broadcast(models.WSMessage{
		Type: "post_comment",
		Payload: map[string]interface{}{
			"post_id":       postID,
			"comment":       comment,
			"comment_count": commentCount,
		},
	})

	// Notify the post author (if not self)
	var postAuthorID string
	db.DB.QueryRow("SELECT author_id FROM posts WHERE id = ?", postID).Scan(&postAuthorID)
	if postAuthorID != userID {
		preview := req.Content
		if len(preview) > 60 {
			preview = preview[:60] + "…"
		}
		CreateNotification(postAuthorID, "comment", authorName+" commented on your post", preview, "/app/timeline")
	}
	// If it's a reply, notify the parent comment author
	if req.ParentID != nil {
		var parentAuthorID string
		db.DB.QueryRow("SELECT author_id FROM comments WHERE id = ?", *req.ParentID).Scan(&parentAuthorID)
		if parentAuthorID != userID && parentAuthorID != postAuthorID {
			CreateNotification(parentAuthorID, "reply", authorName+" replied to your comment", req.Content, "/app/timeline")
		}
	}

	jsonResponse(w, http.StatusCreated, comment)
}

func EditComment(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	commentID := chi.URLParam(r, "commentID")

	var authorID string
	err := db.DB.QueryRow("SELECT author_id FROM comments WHERE id = ?", commentID).Scan(&authorID)
	if err != nil {
		jsonError(w, "Comment not found", http.StatusNotFound)
		return
	}
	if authorID != userID {
		jsonError(w, "Not authorized", http.StatusForbidden)
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Content == "" {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	_, err = db.DB.Exec("UPDATE comments SET content = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ?", req.Content, commentID)
	if err != nil {
		jsonError(w, "Failed to edit comment", http.StatusInternalServerError)
		return
	}

	var c models.Comment
	db.DB.QueryRow("SELECT id, post_id, author_id, parent_id, content, upvotes, downvotes, created_at, edited_at FROM comments WHERE id = ?", commentID).
		Scan(&c.ID, &c.PostID, &c.AuthorID, &c.ParentID, &c.Content, &c.Upvotes, &c.Downvotes, &c.CreatedAt, &c.EditedAt)
	db.DB.QueryRow("SELECT username FROM users WHERE id = ?", userID).Scan(&c.AuthorName)

	Hub.Broadcast(models.WSMessage{
		Type: "comment_edited",
		Payload: map[string]interface{}{
			"post_id": c.PostID,
			"comment": c,
		},
	})

	jsonResponse(w, http.StatusOK, c)
}

func DeleteComment(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	commentID := chi.URLParam(r, "commentID")

	var authorID, postID string
	err := db.DB.QueryRow("SELECT author_id, post_id FROM comments WHERE id = ?", commentID).Scan(&authorID, &postID)
	if err != nil {
		jsonError(w, "Comment not found", http.StatusNotFound)
		return
	}
	if authorID != userID {
		jsonError(w, "Not authorized", http.StatusForbidden)
		return
	}

	_, err = db.DB.Exec("DELETE FROM comments WHERE id = ?", commentID)
	if err != nil {
		jsonError(w, "Failed to delete comment", http.StatusInternalServerError)
		return
	}
	db.DB.Exec("UPDATE posts SET comment_count = MAX(0, comment_count - 1) WHERE id = ?", postID)

	Hub.Broadcast(models.WSMessage{
		Type: "comment_deleted",
		Payload: map[string]interface{}{
			"post_id":    postID,
			"comment_id": commentID,
		},
	})

	jsonResponse(w, http.StatusOK, map[string]string{"status": "deleted"})
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

func GetUserActivity(w http.ResponseWriter, r *http.Request) {
	targetID := chi.URLParam(r, "userID")

	rows, err := db.DB.Query(`
		SELECT day, SUM(cnt) as total FROM (
			SELECT DATE(created_at) as day, COUNT(*) as cnt FROM posts WHERE author_id = ? GROUP BY day
			UNION ALL
			SELECT DATE(created_at) as day, COUNT(*) as cnt FROM comments WHERE author_id = ? GROUP BY day
		) GROUP BY day ORDER BY day ASC`, targetID, targetID)
	if err != nil {
		jsonError(w, "Failed to fetch activity", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type ActivityDay struct {
		Date  string `json:"date"`
		Count int    `json:"count"`
	}

	activity := []ActivityDay{}
	for rows.Next() {
		var a ActivityDay
		rows.Scan(&a.Date, &a.Count)
		activity = append(activity, a)
	}

	jsonResponse(w, http.StatusOK, activity)
}
