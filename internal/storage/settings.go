package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
)

var errInvalidUI = errors.New("UI 设置不是合法 JSON")

// WindowState 窗口几何状态，由 Go 侧在启动/退出时读写。
type WindowState struct {
	Width     int  `json:"width"`
	Height    int  `json:"height"`
	X         int  `json:"x"`
	Y         int  `json:"y"`
	Maximized bool `json:"maximized"`
}

// settingsFile settings.json 的磁盘结构。
// "ui" 是前端持有的不透明 JSON 块（主题、侧栏宽度、作者名等），
// Go 不解释其内容，只负责存取 —— 前后端互不侵入。
type settingsFile struct {
	Window *WindowState    `json:"window,omitempty"`
	UI     json.RawMessage `json:"ui,omitempty"`
}

// SettingsStore settings.json 的独立读写器（与 DB 无关，单独加锁）。
type SettingsStore struct {
	mu   sync.Mutex
	path string
}

func NewSettingsStore(dir string) *SettingsStore {
	return &SettingsStore{path: filepath.Join(dir, "settings.json")}
}

func (s *SettingsStore) load() (settingsFile, error) {
	var cfg settingsFile
	data, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		return cfg, nil
	}
	if err != nil {
		return cfg, err
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return settingsFile{}, err
	}
	return cfg, nil
}

func (s *SettingsStore) save(cfg settingsFile) error {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, data, 0o644)
}

// LoadWindow 读取窗口状态，无记录返回 nil。
func (s *SettingsStore) LoadWindow() *WindowState {
	s.mu.Lock()
	defer s.mu.Unlock()
	cfg, err := s.load()
	if err != nil || cfg.Window == nil {
		return nil
	}
	return cfg.Window
}

// SaveWindow 仅更新窗口字段，保留 ui 块。
func (s *SettingsStore) SaveWindow(w WindowState) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cfg, err := s.load()
	if err != nil {
		cfg = settingsFile{}
	}
	cfg.Window = &w
	return s.save(cfg)
}

// LoadUI 返回前端 UI 设置 JSON 字符串，无记录返回空串。
func (s *SettingsStore) LoadUI() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cfg, err := s.load()
	if err != nil {
		return "", err
	}
	return string(cfg.UI), nil
}

// SaveUI 仅更新 ui 块，保留窗口字段。
func (s *SettingsStore) SaveUI(ui string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cfg, err := s.load()
	if err != nil {
		cfg = settingsFile{}
	}
	if ui == "" {
		cfg.UI = nil
	} else {
		if !json.Valid([]byte(ui)) {
			return errInvalidUI
		}
		cfg.UI = json.RawMessage(ui)
	}
	return s.save(cfg)
}

func checksumHex(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])
}
