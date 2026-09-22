// Package storage 提供 SQLite 持久化。
// 所有方法内部加锁：modernc sqlite 连接不可并发使用，而 Wails 绑定方法
// 运行在各自 goroutine 中。
package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	_ "modernc.org/sqlite"

	"annoti/internal/models"

	"github.com/google/uuid"
)

// Store 封装数据库连接与配置文件路径。
type Store struct {
	mu  sync.Mutex
	db  *sql.DB
	dir string // 数据目录（annoti.db 与 settings.json 所在处）
}

// Open 在用户配置目录下初始化数据目录与数据库 schema。
func Open() (*Store, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return nil, fmt.Errorf("无法定位用户配置目录: %w", err)
	}
	return OpenAt(filepath.Join(base, "AnnotiV2"))
}

// OpenAt 在指定目录初始化存储（测试用）。
func OpenAt(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("无法创建数据目录: %w", err)
	}

	// busy_timeout: 多语句快速连发时避免 SQLITE_BUSY。
	// 刻意不开 foreign_keys pragma：孤儿回复以悬空 parent_id 落库是既有
	// 导入契约（pack.MergeImport"标记不删"，UI 标"回复丢失"），外键强制
	// 会拒绝这类插入。删除级联由 DeleteAnnotation 的递归语句保证。
	db, err := sql.Open("sqlite", filepath.Join(dir, "annoti.db")+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, err
	}
	s := &Store{db: db, dir: dir}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

// Dir 返回数据目录路径（用于"打开数据目录"等功能）。
func (s *Store) Dir() string { return s.dir }

func (s *Store) migrate() error {
	// 表上的 REFERENCES/ON DELETE CASCADE 依赖连接级 foreign_keys pragma，
	// 本包刻意不开（孤儿回复需要悬空 parent_id，见 OpenAt），
	// 子树删除级联由 DeleteAnnotation 的递归语句保证。
	if _, err := s.db.Exec(`
CREATE TABLE IF NOT EXISTS documents (
	id          TEXT PRIMARY KEY,
	path        TEXT NOT NULL UNIQUE,
	name        TEXT NOT NULL,
	checksum    TEXT NOT NULL,
	size        INTEGER NOT NULL,
	created_at  INTEGER NOT NULL,
	updated_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS annotations (
	id          TEXT PRIMARY KEY,
	document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
	parent_id   TEXT REFERENCES annotations(id) ON DELETE CASCADE,
	author_id   TEXT NOT NULL,
	author_name TEXT NOT NULL,
	quote       TEXT NOT NULL,
	body        TEXT NOT NULL DEFAULT '',
	anchor      TEXT NOT NULL,
	color       TEXT NOT NULL DEFAULT '',
	resolved    INTEGER NOT NULL DEFAULT 0,
	created_at  INTEGER NOT NULL,
	updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_annotations_doc ON annotations(document_id);
CREATE INDEX IF NOT EXISTS idx_annotations_parent ON annotations(parent_id);
`); err != nil {
		return err
	}
	// schema 版本标记：V2（讨论串激活，无破坏性列变更）
	_, err := s.db.Exec(`PRAGMA user_version = 2`)
	return err
}

// SchemaVersion 返回当前库的 user_version。
func (s *Store) SchemaVersion() (int, error) {
	var v int
	err := s.db.QueryRow(`PRAGMA user_version`).Scan(&v)
	return v, err
}

func now() int64 { return time.Now().UnixMilli() }

// UpsertDocument 按路径登记文档，返回元数据与 checksum 变化标记。
func (s *Store) UpsertDocument(path string, content []byte) (models.Document, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	checksum := checksumHex(content)
	size := int64(len(content))
	doc := models.Document{
		Path:      path,
		Name:      filepath.Base(path),
		Checksum:  checksum,
		Size:      size,
		UpdatedAt: now(),
	}

	var (
		id        string
		oldSum    string
		createdAt int64
	)
	err := s.db.QueryRow(`SELECT id, checksum, created_at FROM documents WHERE path = ?`, path).
		Scan(&id, &oldSum, &createdAt)
	switch {
	case err == sql.ErrNoRows:
		doc.ID = uuid.NewString()
		doc.CreatedAt = doc.UpdatedAt
		_, err = s.db.Exec(`INSERT INTO documents (id, path, name, checksum, size, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			doc.ID, doc.Path, doc.Name, doc.Checksum, doc.Size, doc.CreatedAt, doc.UpdatedAt)
		if err != nil {
			return models.Document{}, err
		}
	case err != nil:
		return models.Document{}, err
	default:
		doc.ID = id
		doc.CreatedAt = createdAt
		doc.Changed = oldSum != checksum
		_, err = s.db.Exec(`UPDATE documents SET checksum = ?, size = ?, updated_at = ? WHERE id = ?`,
			checksum, size, doc.UpdatedAt, doc.ID)
		if err != nil {
			return models.Document{}, err
		}
	}
	return doc, nil
}

// GetDocument 按路径查询已登记文档，不存在返回 false。
func (s *Store) GetDocument(path string) (models.Document, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var d models.Document
	err := s.db.QueryRow(`SELECT id, path, name, checksum, size, created_at, updated_at
		FROM documents WHERE path = ?`, path).
		Scan(&d.ID, &d.Path, &d.Name, &d.Checksum, &d.Size, &d.CreatedAt, &d.UpdatedAt)
	if err == sql.ErrNoRows {
		return models.Document{}, false, nil
	}
	if err != nil {
		return models.Document{}, false, err
	}
	return d, true, nil
}

// GetDocumentByID 按主键查询文档元数据。
func (s *Store) GetDocumentByID(id string) (models.Document, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var d models.Document
	err := s.db.QueryRow(`SELECT id, path, name, checksum, size, created_at, updated_at
		FROM documents WHERE id = ?`, id).
		Scan(&d.ID, &d.Path, &d.Name, &d.Checksum, &d.Size, &d.CreatedAt, &d.UpdatedAt)
	if err == sql.ErrNoRows {
		return models.Document{}, false, nil
	}
	if err != nil {
		return models.Document{}, false, err
	}
	return d, true, nil
}

// ListAnnotations 返回某文档的全部批注（含 V2 讨论串的子批注）。
func (s *Store) ListAnnotations(docID string) ([]models.Annotation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rows, err := s.db.Query(`SELECT id, document_id, COALESCE(parent_id, ''), author_id, author_name,
		quote, body, anchor, color, resolved, created_at, updated_at
		FROM annotations WHERE document_id = ? ORDER BY created_at ASC`, docID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Annotation, 0, 16)
	for rows.Next() {
		a, err := scanAnnotation(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, rows.Err()
}

// SaveAnnotation 新建或更新一条批注：ID 为空则生成，时间戳由调用方填好。
func (s *Store) SaveAnnotation(a *models.Annotation) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	anchorJSON, err := json.Marshal(a.Anchor)
	if err != nil {
		return err
	}
	parentID := a.ParentID
	var parentArg interface{}
	if parentID == "" {
		parentArg = nil
	} else {
		parentArg = parentID
	}

	_, err = s.db.Exec(`INSERT INTO annotations
		(id, document_id, parent_id, author_id, author_name, quote, body, anchor, color, resolved, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			parent_id = excluded.parent_id,
			author_id = excluded.author_id,
			author_name = excluded.author_name,
			quote = excluded.quote,
			body = excluded.body,
			anchor = excluded.anchor,
			color = excluded.color,
			resolved = excluded.resolved,
			updated_at = excluded.updated_at`,
		a.ID, a.DocumentID, parentArg, a.AuthorID, a.AuthorName, a.Quote, a.Body,
		string(anchorJSON), a.Color, a.Resolved, a.CreatedAt, a.UpdatedAt)
	return err
}

// DeleteAnnotation 删除批注及其全部后代（整棵子树级联）。
// 级联由递归语句完成：外键 pragma 刻意未开（见 OpenAt），
// schema 里的 ON DELETE CASCADE 不生效，残留的子回复会成为
// 父链悬空的"回复丢失"幽灵。
func (s *Store) DeleteAnnotation(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.db.Exec(`
WITH RECURSIVE doomed(id) AS (
	SELECT ?
	UNION
	SELECT a.id FROM annotations a JOIN doomed d ON a.parent_id = d.id
)
DELETE FROM annotations WHERE id IN (SELECT id FROM doomed)`, id)
	return err
}

// DedupeKey 生成导入去重键：同作者对同一段文字（位置+内容）的批注视为重复。
// 区域批注追加框的归一化坐标参与区分，避免同一块上的多个框互相吞并。
func DedupeKey(a models.Annotation) string {
	key := a.AuthorName + "|" + a.Quote + "|" + strconv.Itoa(a.Anchor.Start) + "|" + strconv.Itoa(a.Anchor.End)
	if r := a.Anchor.Region; r != nil {
		key += fmt.Sprintf("|r:%.4f,%.4f,%.4f,%.4f,%s", r.X, r.Y, r.W, r.H, r.Img)
	}
	return key
}

// ExistingDedupeKeys 返回文档现有批注的去重键集合。
func (s *Store) ExistingDedupeKeys(docID string) (map[string]struct{}, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rows, err := s.db.Query(`SELECT author_name, quote, anchor FROM annotations WHERE document_id = ?`, docID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	keys := make(map[string]struct{})
	for rows.Next() {
		var authorName, quote, anchorJSON string
		if err := rows.Scan(&authorName, &quote, &anchorJSON); err != nil {
			return nil, err
		}
		var anchor models.TextAnchor
		if err := json.Unmarshal([]byte(anchorJSON), &anchor); err != nil {
			continue
		}
		keys[DedupeKey(models.Annotation{
			AuthorName: authorName,
			Quote:      quote,
			Anchor:     anchor,
		})] = struct{}{}
	}
	return keys, rows.Err()
}

type rowScanner interface{ Scan(dest ...any) error }

func scanAnnotation(row rowScanner) (models.Annotation, error) {
	var a models.Annotation
	var anchorJSON string
	var resolved int
	if err := row.Scan(&a.ID, &a.DocumentID, &a.ParentID, &a.AuthorID, &a.AuthorName,
		&a.Quote, &a.Body, &anchorJSON, &a.Color, &resolved, &a.CreatedAt, &a.UpdatedAt); err != nil {
		return a, err
	}
	a.Resolved = resolved != 0
	if err := json.Unmarshal([]byte(anchorJSON), &a.Anchor); err != nil {
		return a, fmt.Errorf("批注 %s 锚点损坏: %w", a.ID, err)
	}
	return a, nil
}
