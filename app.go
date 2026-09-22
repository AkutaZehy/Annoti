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
	"annoti/internal/epub"
	"annoti/internal/models"
	"annoti/internal/pack"
	"annoti/internal/storage"
)

// App 是绑定给前端的唯一服务对象。
type App struct {
	ctx      context.Context
	store    *storage.Store
	settings *storage.SettingsStore
	initErr  error // 存储初始化失败的原因；非 nil 时绑定层拒绝服务
}

func NewApp() *App {
	return &App{}
}

// ready 返回存储就绪状态，初始化失败时绑定方法统一拒绝执行，
// 把启动期错误变成可读的返回值而不是 nil 指针崩溃。
func (a *App) ready() error {
	if a.initErr != nil {
		return a.initErr
	}
	if a.store == nil {
		return fmt.Errorf("存储尚未初始化")
	}
	return nil
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	store, err := storage.Open()
	if err != nil {
		a.initErr = fmt.Errorf("存储初始化失败: %w", err)
		runtime.LogErrorf(ctx, "%v", a.initErr)
		_, _ = runtime.MessageDialog(ctx, runtime.MessageDialogOptions{
			Type:    runtime.ErrorDialog,
			Title:   "Annoti 无法初始化存储",
			Message: a.initErr.Error() + "\n\n批注数据将无法读写。请检查数据目录（%APPDATA%\\AnnotiV2）的读写权限后重启应用。",
		})
		return // 优雅降级：窗口照常打开，绑定层经 ready() 报告同一错误
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

	// 拖拽文件到窗口打开：拖拽监听由前端 runtime OnFileDrop 注册
	// （不注册则 WebView2 默认导航到文件），经 OpenDocumentPath 绑定打开。
	// Go 侧不再订阅 wails:file-drop，避免双通道重复打开。
}

func (a *App) shutdown(ctx context.Context) {
	if a.settings != nil {
		w, h := runtime.WindowGetSize(ctx)
		x, y := runtime.WindowGetPosition(ctx)
		_ = a.settings.SaveWindow(storage.WindowState{
			Width: w, Height: h, X: x, Y: y,
			Maximized: runtime.WindowIsMaximised(ctx),
		})
	}
	if a.store != nil {
		_ = a.store.Close()
	}
}

// OpenDocument 弹出文件对话框并打开文档。
// 返回 nil（无错误）表示用户取消。
func (a *App) OpenDocument() (*models.Document, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "打开文档",
		Filters: []runtime.FileFilter{
			{DisplayName: "所有支持的文档 (*.md; *.txt; *.html; *.json; *.xml; *.csv; *.yaml; …)", Pattern: "*.md;*.markdown;*.txt;*.text;*.html;*.htm;*.json;*.xml;*.csv;*.tsv;*.epub;*.yaml;*.yml;*.toml;*.ini;*.cfg;*.conf;*.config;*.properties;*.env;*.rst;*.adoc;*.asciidoc;*.org;*.tex;*.latex;*.diff;*.patch;*.log;*.jsonl;*.ndjson"},
			{DisplayName: "文档 (*.md; *.txt; *.html; …)", Pattern: "*.md;*.markdown;*.txt;*.text;*.html;*.htm;*.json;*.xml;*.csv;*.tsv;*.epub"},
			{DisplayName: "配置与数据 (*.yaml; *.yml; *.toml; *.ini; *.jsonl; …)", Pattern: "*.yaml;*.yml;*.toml;*.ini;*.cfg;*.conf;*.config;*.properties;*.env;*.jsonl;*.ndjson"},
			{DisplayName: "标记与日志 (*.rst; *.adoc; *.org; *.tex; *.diff; *.log)", Pattern: "*.rst;*.adoc;*.asciidoc;*.org;*.tex;*.latex;*.diff;*.patch;*.log"},
			{DisplayName: "EPUB 电子书 (*.epub)", Pattern: "*.epub"},
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

func isEpub(path string) bool { return strings.EqualFold(filepath.Ext(path), ".epub") }

// loadDocument 读取文件并登记入库。
// 文本格式经编码自动检测（UTF-8/UTF-16/GB18030）转成 UTF-8 交给前端；
// EPUB 是二进制容器：不解码不进 Content，登记后解包到 library 缓存，
// 前端经 /local/ 抓取章节自行渲染。
func (a *App) loadDocument(path string) (*models.Document, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("读取文件失败: %w", err)
	}

	content := ""
	payload := raw
	if !isEpub(path) {
		content = encoding.Decode(raw)
		payload = []byte(content) // 校验和沿用解码后内容，保持与既有记录可比
	}

	doc, err := a.store.UpsertDocument(path, payload)
	if err != nil {
		return nil, fmt.Errorf("登记文档失败: %w", err)
	}
	doc.Content = content
	if isEpub(path) {
		dir, err := epub.Extract(path)
		if err != nil {
			runtime.LogWarningf(a.ctx, "EPUB 解包失败: %v", err)
		} else {
			doc.LibraryPath = dir
		}
	}
	return &doc, nil
}

// OpenDocumentPath 按已知路径打开文档（启动时恢复上次文档用）。
// 返回 nil 表示文件不存在或路径为空，前端应静默忽略。
func (a *App) OpenDocumentPath(path string) (*models.Document, error) {
	if path == "" {
		return nil, nil
	}
	if err := a.ready(); err != nil {
		return nil, err
	}
	if _, err := os.Stat(path); err != nil {
		return nil, nil
	}
	return a.loadDocument(path)
}

// LoadAnnotations 返回文档的全部批注。
func (a *App) LoadAnnotations(docID string) ([]models.Annotation, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	return a.store.ListAnnotations(docID)
}

// prepareAnnotation 落库前的统一准备：补 ID、盖时间戳、补锚点类型。
func prepareAnnotation(anno *models.Annotation) {
	now := time.Now().UnixMilli()
	if anno.ID == "" {
		anno.ID = "anno-" + uuid.NewString()
		anno.CreatedAt = now
	}
	anno.UpdatedAt = now
	if anno.Anchor.Type == "" {
		anno.Anchor.Type = models.AnchorTypeText // 区域批注自带 type=region，不覆盖
	}
}

// SaveAnnotation 新建（ID 为空）或更新批注，返回落库后的版本。
func (a *App) SaveAnnotation(anno models.Annotation) (models.Annotation, error) {
	if err := a.ready(); err != nil {
		return models.Annotation{}, err
	}
	prepareAnnotation(&anno)
	if err := a.store.SaveAnnotation(&anno); err != nil {
		return models.Annotation{}, fmt.Errorf("保存批注失败: %w", err)
	}
	return anno, nil
}

// DeleteAnnotation 删除批注。
func (a *App) DeleteAnnotation(id string) error {
	if err := a.ready(); err != nil {
		return err
	}
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
	if err := a.ready(); err != nil {
		return "", err
	}
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
	if err := a.ready(); err != nil {
		return nil, err
	}
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
		prepareAnnotation(&res.Writes[i])
	}
	// 单事务落库：任一条失败整体回滚，不留半截导入
	if err := a.store.SaveAnnotationsBatch(res.Writes); err != nil {
		return nil, fmt.Errorf("导入批注失败（已回滚）: %w", err)
	}
	return &ImportResult{
		Imported:     res.Added,
		Updated:      res.Updated,
		Skipped:      len(p.Annotations) - res.Added - res.Updated,
		ChecksumSame: p.Document.Checksum == doc.Checksum,
	}, nil
}

// openableFileExts：file: 链接允许交给系统处理的扩展名（防 ShellExecute
// 打开任意可执行文件；文档内链指向的通常是另一份文档或图片）。
var openableFileExts = map[string]bool{
	".md": true, ".markdown": true, ".txt": true, ".text": true,
	".html": true, ".htm": true, ".json": true, ".xml": true, ".csv": true,
	".epub": true,
	".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".webp": true,
	".svg": true, ".bmp": true, ".avif": true,
}

// OpenExternal 用系统默认浏览器打开外部链接（文档内 <a> 不在应用内导航——
// WebView 导航无法回退）。允许 http(s) 与 file:（file: 限白名单扩展名）。
func (a *App) OpenExternal(url string) error {
	switch {
	case strings.HasPrefix(url, "http://"), strings.HasPrefix(url, "https://"):
	case strings.HasPrefix(url, "file://"):
		ext := strings.ToLower(filepath.Ext(url))
		if !openableFileExts[ext] {
			return fmt.Errorf("不支持打开该类型的本地文件: %s", ext)
		}
	default:
		return fmt.Errorf("仅支持 http(s)/file 链接: %s", url)
	}
	runtime.BrowserOpenURL(a.ctx, url)
	return nil
}

// GetUI 返回前端 UI 设置 JSON（空串表示无记录）。
func (a *App) GetUI() (string, error) {
	if err := a.ready(); err != nil {
		return "", err
	}
	return a.settings.LoadUI()
}

// SetUI 保存前端 UI 设置 JSON。
func (a *App) SetUI(ui string) error {
	if err := a.ready(); err != nil {
		return err
	}
	return a.settings.SaveUI(ui)
}

// OpenDataDir 在资源管理器中打开数据目录。
func (a *App) OpenDataDir() error {
	if err := a.ready(); err != nil {
		return err
	}
	if err := exec.Command("explorer", a.store.Dir()).Start(); err != nil {
		return fmt.Errorf("无法打开数据目录: %w", err)
	}
	return nil
}
