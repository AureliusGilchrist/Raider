package replication

import (
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"raider/db"
)

// Config holds replication settings from environment variables.
type Config struct {
	Mode       string // "primary", "replica", or "" (disabled)
	APIKey     string // shared secret for authenticating replication requests
	PrimaryURL string // URL of the primary (used by replicas)
	SyncSecs   int    // seconds between incremental syncs (default 30)
}

var (
	cfg     Config
	cfgOnce sync.Once
)

// GetConfig reads replication config from env vars (once).
func GetConfig() Config {
	cfgOnce.Do(func() {
		cfg.Mode = os.Getenv("REPL_MODE")       // "primary" | "replica" | ""
		cfg.APIKey = os.Getenv("REPL_API_KEY")   // shared secret
		cfg.PrimaryURL = os.Getenv("REPL_PRIMARY_URL") // e.g. http://primary:8080
		cfg.SyncSecs = 30
		if s := os.Getenv("REPL_SYNC_SECS"); s != "" {
			if v, err := strconv.Atoi(s); err == nil && v > 0 {
				cfg.SyncSecs = v
			}
		}
	})
	return cfg
}

// Enabled returns true if replication is configured.
func Enabled() bool {
	c := GetConfig()
	return c.Mode == "primary" || c.Mode == "replica"
}

// ValidateAPIKey checks the bearer token against the configured key using constant-time comparison.
func ValidateAPIKey(r *http.Request) bool {
	c := GetConfig()
	if c.APIKey == "" {
		return false
	}
	token := r.Header.Get("X-Repl-Key")
	return subtle.ConstantTimeCompare([]byte(token), []byte(c.APIKey)) == 1
}

// InitSchema creates the replication_log table if the node is a primary.
func InitSchema() {
	c := GetConfig()
	if c.Mode != "primary" {
		return
	}

	schema := `
	CREATE TABLE IF NOT EXISTS replication_log (
		seq INTEGER PRIMARY KEY AUTOINCREMENT,
		table_name TEXT NOT NULL,
		row_key TEXT NOT NULL,
		action TEXT NOT NULL,
		payload TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_repl_log_seq ON replication_log(seq);
	`
	if _, err := db.DB.Exec(schema); err != nil {
		log.Printf("[replication] failed to create replication_log: %v", err)
	}

	installTriggers()
	log.Println("[replication] primary mode: change tracking enabled")
}

// installTriggers adds INSERT/UPDATE/DELETE triggers on core tables to populate replication_log.
func installTriggers() {
	tables := []struct {
		name string
		pk   string // primary key column
	}{
		{"users", "id"},
		{"messages", "id"},
		{"posts", "id"},
		{"comments", "id"},
		{"servers", "id"},
		{"channels", "id"},
		{"server_members", "server_id || ':' || user_id"},
		{"server_roles", "id"},
		{"server_settings", "server_id"},
		{"group_chats", "id"},
		{"group_messages", "id"},
		{"notifications", "id"},
	}

	for _, t := range tables {
		// INSERT trigger
		db.DB.Exec(fmt.Sprintf(`
			CREATE TRIGGER IF NOT EXISTS repl_ins_%s AFTER INSERT ON %s
			BEGIN
				INSERT INTO replication_log (table_name, row_key, action, payload)
				VALUES ('%s', NEW.%s, 'INSERT', '{}');
			END;
		`, t.name, t.name, t.name, t.pk))

		// UPDATE trigger
		db.DB.Exec(fmt.Sprintf(`
			CREATE TRIGGER IF NOT EXISTS repl_upd_%s AFTER UPDATE ON %s
			BEGIN
				INSERT INTO replication_log (table_name, row_key, action, payload)
				VALUES ('%s', NEW.%s, 'UPDATE', '{}');
			END;
		`, t.name, t.name, t.name, t.pk))

		// DELETE trigger
		db.DB.Exec(fmt.Sprintf(`
			CREATE TRIGGER IF NOT EXISTS repl_del_%s AFTER DELETE ON %s
			BEGIN
				INSERT INTO replication_log (table_name, row_key, action, payload)
				VALUES ('%s', OLD.%s, 'DELETE', '{}');
			END;
		`, t.name, t.name, t.name, t.pk))
	}
}

// ChangeEntry represents one row in the replication log.
type ChangeEntry struct {
	Seq       int64  `json:"seq"`
	Table     string `json:"table"`
	RowKey    string `json:"row_key"`
	Action    string `json:"action"`
	CreatedAt string `json:"created_at"`
}

// GetChangesSince returns change log entries after the given sequence number.
func GetChangesSince(since int64, limit int) ([]ChangeEntry, error) {
	if limit <= 0 || limit > 10000 {
		limit = 1000
	}
	rows, err := db.DB.Query(
		`SELECT seq, table_name, row_key, action, created_at FROM replication_log WHERE seq > ? ORDER BY seq ASC LIMIT ?`,
		since, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []ChangeEntry
	for rows.Next() {
		var e ChangeEntry
		if err := rows.Scan(&e.Seq, &e.Table, &e.RowKey, &e.Action, &e.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// LatestSeq returns the highest sequence number in the replication log.
func LatestSeq() (int64, error) {
	var seq sql.NullInt64
	err := db.DB.QueryRow(`SELECT MAX(seq) FROM replication_log`).Scan(&seq)
	if err != nil {
		return 0, err
	}
	if !seq.Valid {
		return 0, nil
	}
	return seq.Int64, nil
}

// HandleSnapshot streams the full SQLite database file to the response.
// The primary creates a consistent backup using SQLite's backup API via VACUUM INTO.
func HandleSnapshot(w http.ResponseWriter, r *http.Request) {
	if !ValidateAPIKey(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	tmpDir := os.TempDir()
	snapPath := filepath.Join(tmpDir, fmt.Sprintf("raider_snapshot_%d.db", time.Now().UnixNano()))
	defer os.Remove(snapPath)

	// Use VACUUM INTO for a consistent point-in-time copy
	if _, err := db.DB.Exec(`VACUUM INTO ?`, snapPath); err != nil {
		http.Error(w, "snapshot failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	f, err := os.Open(snapPath)
	if err != nil {
		http.Error(w, "open snapshot failed", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	stat, _ := f.Stat()
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment; filename=raider_snapshot.db")
	w.Header().Set("Content-Length", strconv.FormatInt(stat.Size(), 10))
	io.Copy(w, f)
}

// HandleChanges returns change log entries as JSON since a given sequence number.
func HandleChanges(w http.ResponseWriter, r *http.Request) {
	if !ValidateAPIKey(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	sinceStr := r.URL.Query().Get("since")
	since, _ := strconv.ParseInt(sinceStr, 10, 64)

	limitStr := r.URL.Query().Get("limit")
	limit, _ := strconv.Atoi(limitStr)
	if limit <= 0 {
		limit = 1000
	}

	entries, err := GetChangesSince(since, limit)
	if err != nil {
		http.Error(w, "query failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	seq, _ := LatestSeq()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"changes":    entries,
		"latest_seq": seq,
	})
}

// HandleStatus returns the replication status of this node.
func HandleStatus(w http.ResponseWriter, r *http.Request) {
	if !ValidateAPIKey(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	c := GetConfig()
	resp := map[string]any{
		"mode": c.Mode,
		"time": time.Now().UTC().Format(time.RFC3339),
	}

	if c.Mode == "primary" {
		seq, _ := LatestSeq()
		resp["latest_seq"] = seq
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// StartReplicaSync begins the background sync loop on a replica node.
func StartReplicaSync() {
	c := GetConfig()
	if c.Mode != "replica" {
		return
	}
	if c.PrimaryURL == "" || c.APIKey == "" {
		log.Println("[replication] replica mode requires REPL_PRIMARY_URL and REPL_API_KEY")
		return
	}

	go func() {
		log.Printf("[replication] replica mode: syncing from %s every %ds", c.PrimaryURL, c.SyncSecs)

		// Initial full snapshot if local DB is empty
		var count int
		if err := db.DB.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&count); err != nil || count == 0 {
			log.Println("[replication] empty database, pulling initial snapshot...")
			if err := pullSnapshot(c); err != nil {
				log.Printf("[replication] initial snapshot failed: %v", err)
			}
		}

		ticker := time.NewTicker(time.Duration(c.SyncSecs) * time.Second)
		defer ticker.Stop()

		var lastSeq int64
		for range ticker.C {
			if err := pullChanges(c, &lastSeq); err != nil {
				log.Printf("[replication] sync error: %v", err)
			}
		}
	}()
}

func pullSnapshot(c Config) error {
	req, err := http.NewRequest("GET", c.PrimaryURL+"/api/replication/snapshot", nil)
	if err != nil {
		return err
	}
	req.Header.Set("X-Repl-Key", c.APIKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("snapshot returned %d", resp.StatusCode)
	}

	// Write snapshot to a temp file then replace
	dataDir := "./data"
	tmpPath := filepath.Join(dataDir, "raider_replica_tmp.db")
	defer os.Remove(tmpPath)

	f, err := os.Create(tmpPath)
	if err != nil {
		return fmt.Errorf("create temp: %w", err)
	}

	if _, err := io.Copy(f, resp.Body); err != nil {
		f.Close()
		return fmt.Errorf("copy snapshot: %w", err)
	}
	f.Close()

	// Close current DB, replace file, reopen
	db.Close()
	dbPath := filepath.Join(dataDir, "raider.db")
	if err := os.Rename(tmpPath, dbPath); err != nil {
		return fmt.Errorf("replace db: %w", err)
	}

	db.Init()
	log.Println("[replication] snapshot restored successfully")
	return nil
}

func pullChanges(c Config, lastSeq *int64) error {
	url := fmt.Sprintf("%s/api/replication/changes?since=%d&limit=5000", c.PrimaryURL, *lastSeq)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("X-Repl-Key", c.APIKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("changes returned %d", resp.StatusCode)
	}

	var result struct {
		Changes   []ChangeEntry `json:"changes"`
		LatestSeq int64         `json:"latest_seq"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("decode: %w", err)
	}

	if len(result.Changes) == 0 {
		return nil
	}

	// If there are changes and we're behind by a lot, do a full snapshot instead
	if result.LatestSeq-*lastSeq > 10000 {
		log.Println("[replication] too far behind, pulling full snapshot")
		return pullSnapshot(c)
	}

	// For incremental changes, we log them but the real application
	// would need row-level replication. For now, if changes detected,
	// pull a fresh snapshot to stay consistent.
	log.Printf("[replication] %d changes detected (seq %d → %d), syncing snapshot",
		len(result.Changes), *lastSeq, result.LatestSeq)

	if err := pullSnapshot(c); err != nil {
		return err
	}
	*lastSeq = result.LatestSeq
	return nil
}
