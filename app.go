package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"annoti/internal/encoding"
	"annoti/internal/models"
	"annoti/internal/pack"
	"annoti/internal/storage"
)

// App 是绑定给前端的唯一服务对象。
type App struct {
	ctx      context.Context
	store    *storage.Store
	settings *storage.SettingsStore
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	store, err := storage.Open()
	if err != nil {
		runtime.LogErrorf(ctx, "存储初始化失败: %v", err)
	}
	a.store = store
	a.settings = storage.NewSettingsStore(store.Dir())

	if w := a.settings.LoadWindow(); w != nil {
		runtime.WindowSetSize(ctx, w.Width, w.Height)
		runtime.WindowSetPosition(ctx, w.X, w.Y)
		if w.Maximized {
			runtime.WindowMaximise(ctx)
		}
	}
}

func (a *App) shutdown(ctx context.Context) {
	w, h := runtime.WindowGetSize(ctx)
	x, y := runtime.WindowGetPosition(ctx)
	_ = a.settings.SaveWindow(storage.WindowState{
		Width: w, Height: h, X: x, Y: y,
		Maximized: runtime.WindowIsMaximised(ctx),
	})
	if a.store != nil {
		_ = a.store.Close()
	}
}

// OpenDocument 弹出文件对话框并打开文档。
// 返回 nil（无错误）表示用户取消。
func (a *App) OpenDocument() (*models.Document, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "打开文档",
		Filters: []runtime.FileFilter{
			{DisplayName: "文档 (*.md; *.txt; *.html; *.json; *.xml; *.csv)", Pattern: "*.md;*.txt;*.html;*.htm;*.json;*.xml;*.csv"},
			{DisplayName: "所有文件 (*.*)", Pattern: "*.*"},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("打开文件对话框失败: %w", err)
	}
	if path == "" {
		return nil, nil // 用户取消
	}
	return a.loadDocument(path)
}

// loadDocument 读取文件并登记入库。
// 编码自动检测（UTF-8/UTF-16/GB18030），内容以 UTF-8 交给前端渲染。
func (a *App) loadDocument(path string) (*models.Document, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("读取文件失败: %w", err)
	}
	content := encoding.Decode(raw)

	doc, err := a.store.UpsertDocument(path, []byte(content))
	if err != nil {
		return nil, fmt.Errorf("登记文档失败: %w", err)
	}
	doc.Content = content
	return &doc, nil
}

// OpenDocumentPath 按已知路径打开文档（启动时恢复上次文档用）。
// 返回 nil 表示文件不存在或路径为空，前端应静默忽略。
func (a *App) OpenDocumentPath(path string) (*models.Document, error) {
	if path == "" {
		return nil, nil
	}
	if _, err := os.Stat(path); err != nil {
		return nil, nil
	}
	return a.loadDocument(path)
}

// LoadAnnotations 返回文档的全部批注。
func (a *App) LoadAnnotations(docID string) ([]models.Annotation, error) {
	return a.store.ListAnnotations(docID)
}

// SaveAnnotation 新建（ID 为空）或更新批注，返回落库后的版本。
func (a *App) SaveAnnotation(anno models.Annotation) (models.Annotation, error) {
	now := time.Now().UnixMilli()
	if anno.ID == "" {
		anno.ID = "anno-" + uuid.NewString()
		anno.CreatedAt = now
	}
	anno.UpdatedAt = now
	anno.Anchor.Type = models.AnchorTypeText
	if err := a.store.SaveAnnotation(&anno); err != nil {
		return models.Annotation{}, fmt.Errorf("保存批注失败: %w", err)
	}
	return anno, nil
}

// DeleteAnnotation 删除批注。
func (a *App) DeleteAnnotation(id string) error {
	return a.store.DeleteAnnotation(id)
}

// ImportResult 导入结果摘要。
type ImportResult struct {
	Imported     int  `json:"imported"`
	Updated      int  `json:"updated"` // 按 LWW 原位更新的已有批注（回复合并）
	Skipped      int  `json:"skipped"`
	ChecksumSame bool `json:"checksumSame"` // 导入包与当前文档是否同源
}

// ExportAnnotations 将文档全部批注导出为 .annoti.json；返回保存路径，空串表示取消。
func (a *App) ExportAnnotations(docID string) (string, error) {
	doc, ok, err := a.store.GetDocumentByID(docID)
	if err != nil {
		return "", fmt.Errorf("查询文档失败: %w", err)
	}
	if !ok {
		return "", fmt.Errorf("文档不存在: %s", docID)
	}
	annos, err := a.store.ListAnnotations(docID)
	if err != nil {
		return "", err
	}

	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "导出批注",
		DefaultFilename: strings.TrimSuffix(doc.Name, filepath.Ext(doc.Name)) + ".annoti.json",
		Filters: []runtime.FileFilter{
			{DisplayName: "Annoti 批注包 (*.annoti.json)", Pattern: "*.annoti.json;*.json"},
		},
	})
	if err != nil {
		return "", fmt.Errorf("保存文件对话框失败: %w", err)
	}
	if path == "" {
		return "", nil // 用户取消
	}

	data, err := json.MarshalIndent(pack.Build(doc, annos), "", "  ")
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(path, append(data, '\n'), 0o644); err != nil {
		return "", fmt.Errorf("写入文件失败: %w", err)
	}
	return path, nil
}

// ImportAnnotations 从 .annoti.json 导入批注到当前文档（自动去重）。
func (a *App) ImportAnnotations(docID string) (*ImportResult, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "导入批注",
		Filters: []runtime.FileFilter{
			{DisplayName: "Annoti 批注包 (*.annoti.json; *.json)", Pattern: "*.annoti.json;*.json"},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("打开文件对话框失败: %w", err)
	}
	if path == "" {
		return nil, nil // 用户取消
	}

	doc, ok, err := a.store.GetDocumentByID(docID)
	if err != nil || !ok {
		return nil, fmt.Errorf("当前文档未登记: %s", docID)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("读取批注文件失败: %w", err)
	}
	p, err := pack.Parse(data)
	if err != nil {
		return nil, err
	}

	existing, err := a.store.ListAnnotations(docID)
	if err != nil {
		return nil, err
	}
	res := pack.MergeImport(p, docID, existing)
	for i := range res.Writes {
		if _, err := a.SaveAnnotation(res.Writes[i]); err != nil {
			return nil, err
		}
	}
	return &ImportResult{
		Imported:     res.Added,
		Updated:      res.Updated,
		Skipped:      len(p.Annotations) - res.Added - res.Updated,
		ChecksumSame: p.Document.Checksum == doc.Checksum,
	}, nil
}

// OpenExternal 用系统默认浏览器打开外部链接（文档内 <a> 不在应用内导航）。
func (a *App) OpenExternal(url string) error {
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		return fmt.Errorf("仅支持 http(s) 链接: %s", url)
	}
	runtime.BrowserOpenURL(a.ctx, url)
	return nil
}

// GetUI 返回前端 UI 设置 JSON（空串表示无记录）。
func (a *App) GetUI() (string, error) {
	return a.settings.LoadUI()
}

// SetUI 保存前端 UI 设置 JSON。
func (a *App) SetUI(ui string) error {
	return a.settings.SaveUI(ui)
}

// OpenDataDir 在资源管理器中打开数据目录。
func (a *App) OpenDataDir() error {
	if err := exec.Command("explorer", a.store.Dir()).Start(); err != nil {
		return fmt.Errorf("无法打开数据目录: %w", err)
	}
	return nil
}
