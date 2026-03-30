package main

import (
	"log"
	"net/http"
	"os"

	"raider/db"
	"raider/handlers"
	"raider/middleware"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	db.Init()
	defer db.Close()

	os.MkdirAll("./uploads", 0755)

	r := chi.NewRouter()

	// Global middleware
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(middleware.PrivacyMiddleware)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"X-Peer-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Public routes
	r.Post("/api/auth/register", handlers.Register)
	r.Post("/api/auth/login", handlers.Login)

	// WebSocket (auth via query param)
	r.Get("/ws", handlers.HandleWebSocket)

	// File serving
	r.Get("/api/uploads/{userID}/{filename}", handlers.ServeUpload)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.AuthMiddleware)

		// User
		r.Get("/api/me", handlers.GetMe)
		r.Put("/api/me", handlers.UpdateProfile)
		r.Get("/api/profile", handlers.GetProfile)
		r.Get("/api/users/search", handlers.SearchUsers)

		// Settings
		r.Get("/api/settings", handlers.GetSettings)
		r.Put("/api/settings", handlers.UpdateSettings)

		// Stats & Gamification
		r.Get("/api/stats", handlers.GetUserStats)
		r.Get("/api/stats/server-activity", handlers.GetServerActivity)
		r.Get("/api/badges", handlers.GetAllBadges)
		r.Get("/api/badges/user", handlers.GetUserBadges)
		r.Post("/api/follow", handlers.FollowUser)
		r.Post("/api/unfollow", handlers.UnfollowUser)

		// Handshakes
		r.Get("/api/handshakes", handlers.GetHandshakes)
		r.Post("/api/handshakes", handlers.InitiateHandshake)
		r.Post("/api/handshakes/accept", handlers.AcceptHandshake)
		r.Post("/api/handshakes/reject", handlers.RejectHandshake)
		r.Get("/api/handshakes/check", handlers.CheckHandshake)

		// Servers
		r.Get("/api/servers", handlers.GetServers)
		r.Post("/api/servers", handlers.CreateServer)
		r.Get("/api/servers/discover", handlers.DiscoverServers)
		r.Get("/api/servers/{serverID}", handlers.GetServer)
		r.Put("/api/servers/{serverID}", handlers.UpdateServer)
		r.Delete("/api/servers/{serverID}", handlers.DeleteServer)
		r.Post("/api/servers/{serverID}/join", handlers.JoinServer)
		r.Post("/api/servers/{serverID}/leave", handlers.LeaveServer)
		r.Get("/api/servers/{serverID}/channels", handlers.GetChannels)
		r.Post("/api/servers/{serverID}/channels", handlers.CreateChannel)
		r.Get("/api/servers/{serverID}/members", handlers.GetServerMembers)
		r.Get("/api/servers/{serverID}/posts", handlers.GetServerPosts)

		// Server Settings
		r.Get("/api/servers/{serverID}/settings", handlers.GetServerSettings)
		r.Put("/api/servers/{serverID}/settings", handlers.UpdateServerSettings)

		// Discord-like Roles
		r.Get("/api/servers/{serverID}/roles", handlers.GetServerRoles)
		r.Post("/api/servers/{serverID}/roles", handlers.CreateRole)
		r.Put("/api/servers/{serverID}/roles/{roleID}", handlers.UpdateRole)
		r.Delete("/api/servers/{serverID}/roles/{roleID}", handlers.DeleteRole)
		r.Post("/api/servers/{serverID}/members/roles", handlers.AssignRole)
		r.Delete("/api/servers/{serverID}/members/roles", handlers.RemoveRole)
		r.Get("/api/servers/{serverID}/members/{userID}/roles", handlers.GetMemberRoles)

		// Discord-like Moderation
		r.Post("/api/servers/{serverID}/members/{userID}/kick", handlers.KickMember)
		r.Post("/api/servers/{serverID}/members/{userID}/ban", handlers.BanMember)
		r.Post("/api/servers/{serverID}/members/{userID}/unban", handlers.UnbanMember)
		r.Post("/api/servers/{serverID}/members/{userID}/timeout", handlers.TimeoutMember)
		r.Post("/api/servers/{serverID}/mutes/{muteID}/remove", handlers.RemoveTimeout)
		r.Get("/api/servers/{serverID}/bans", handlers.GetServerBans)
		r.Get("/api/servers/{serverID}/audit-logs", handlers.GetAuditLogs)

		// Discord-like Invites
		r.Post("/api/servers/{serverID}/invites", handlers.CreateInvite)
		r.Get("/api/servers/{serverID}/invites", handlers.GetServerInvites)
		r.Delete("/api/invites/{code}", handlers.DeleteInvite)
		r.Get("/api/invites/{code}", handlers.GetInvite)
		r.Post("/api/invites/{code}/use", handlers.UseInvite)

		// Discord-like Categories
		r.Get("/api/servers/{serverID}/categories", handlers.GetCategories)
		r.Post("/api/servers/{serverID}/categories", handlers.CreateCategory)
		r.Put("/api/servers/{serverID}/categories/{categoryID}", handlers.UpdateCategory)
		r.Delete("/api/servers/{serverID}/categories/{categoryID}", handlers.DeleteCategory)

		// Server Announcements
		r.Get("/api/servers/{serverID}/announcement", handlers.GetServerAnnouncement)
		r.Get("/api/servers/{serverID}/announcements", handlers.GetServerAnnouncementsHistory)
		r.Post("/api/servers/{serverID}/announcements", handlers.CreateServerAnnouncement)
		r.Put("/api/servers/{serverID}/announcements/{announcementID}", handlers.UpdateServerAnnouncement)
		r.Delete("/api/servers/{serverID}/announcements/{announcementID}", handlers.DeleteServerAnnouncement)

		// Messages
		r.Post("/api/messages", handlers.SendMessage)
		r.Get("/api/messages/channel/{channelID}", handlers.GetChannelMessages)
		r.Get("/api/messages/dm/{userID}", handlers.GetDMMessages)
		r.Get("/api/messages/dm", handlers.GetDMList)

		// Group Chats (separate from servers and DMs)
		r.Get("/api/groups", handlers.GetGroupChats)
		r.Post("/api/groups", handlers.CreateGroupChat)
		r.Get("/api/groups/{groupID}", handlers.GetGroupChat)
		r.Post("/api/groups/{groupID}/members", handlers.AddGroupMember)
		r.Delete("/api/groups/{groupID}/members/{userID}", handlers.RemoveGroupMember)
		r.Post("/api/groups/{groupID}/leave", handlers.LeaveGroupChat)
		r.Delete("/api/groups/{groupID}", handlers.DeleteGroupChat)
		r.Get("/api/groups/{groupID}/messages", handlers.GetGroupMessages)
		r.Post("/api/groups/{groupID}/messages", handlers.SendGroupMessage)

		// Posts
		r.Get("/api/posts/timeline", handlers.GetTimeline)
		r.Post("/api/posts", handlers.CreatePost)
		r.Put("/api/posts/{postID}", handlers.EditPost)
		r.Delete("/api/posts/{postID}", handlers.DeletePost)
		r.Post("/api/posts/{postID}/vote", handlers.VotePost)
		r.Get("/api/posts/{postID}/comments", handlers.GetComments)
		r.Post("/api/posts/{postID}/comments", handlers.CreateComment)

		// Calls
		r.Post("/api/calls", handlers.CreateCall)
		r.Get("/api/calls", handlers.GetActiveCalls)
		r.Post("/api/calls/{callID}/join", handlers.JoinCall)
		r.Post("/api/calls/{callID}/leave", handlers.LeaveCall)
		r.Post("/api/calls/{callID}/end", handlers.EndCall)
		r.Post("/api/calls/signal", handlers.SignalWebRTC)

		// Uploads
		r.Post("/api/upload", handlers.UploadFile)
		r.Post("/api/avatar", handlers.SetAvatar)
		r.Post("/api/banner", handlers.SetBanner)

		// Shares
		r.Post("/api/shares", handlers.ShareContent)
		r.Get("/api/shares", handlers.GetMyShares)
		r.Get("/api/shares/timeline", handlers.GetTimelineShares)
		r.Delete("/api/shares", handlers.DeleteShare)

		// Announcements
		r.Get("/api/announcements", handlers.GetAnnouncements)
		r.Post("/api/announcements", handlers.CreateAnnouncement)
		r.Post("/api/announcements/{id}/dismiss", handlers.DismissAnnouncement)
		r.Delete("/api/announcements/{id}", handlers.DeleteAnnouncement)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "6423"
	}

	log.Printf("Raider server starting on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}
