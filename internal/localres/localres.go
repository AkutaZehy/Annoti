// Package localres 提供本地资源端点：把 /local/<base64url(绝对路径)>
// 的请求映射到磁盘文件，用于渲染 Markdown 引用的本地图片与 EPUB 解包产物。
// 目录外只放行常见图片扩展名与 .epub 文件；EPUB library 缓存目录内
// （解包产物含 xhtml/ncx/opf 等非图片文件）整体放行，防止被当作任意文件读取通道。
package localres

import (
	"encoding/base64"
	"net/http"
	"path/filepath"
	"strings"

	"annoti/internal/epub"
)

// Prefix 是前端改写图片 src 使用的路径前缀。
const Prefix = "/local/"

var allowedExt = map[string]bool{
	".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".webp": true,
	".svg": true, ".bmp": true, ".avif": true, ".ico": true,
	".epub": true,
}

// allowed 判断磁盘路径是否可放行：图片/.epub 扩展名，或位于 EPUB 解包缓存目录内。
func allowed(path string) bool {
	if allowedExt[strings.ToLower(filepath.Ext(path))] {
		return true
	}
	root, err := epub.LibraryRoot()
	if err != nil || root == "" {
		return false
	}
	return strings.HasPrefix(path, root+string(filepath.Separator))
}

// Handler 返回挂到 Wails AssetServer 的 fallthrough 处理器。
func Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, Prefix) {
			http.NotFound(w, r)
			return
		}
		token := strings.TrimPrefix(r.URL.Path, Prefix)
		if token == "" || strings.ContainsAny(token, "/\\") {
			http.NotFound(w, r)
			return
		}
		raw, err := base64.RawURLEncoding.DecodeString(token)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		path := filepath.Clean(string(raw))
		if !filepath.IsAbs(path) || strings.Contains(path, "..") {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		if !allowed(path) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		http.ServeFile(w, r, path)
	})
}
