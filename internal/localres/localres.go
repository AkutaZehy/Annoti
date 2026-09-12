// Package localres 提供本地资源端点：把 /local/<base64url(绝对路径)>
// 的请求映射到磁盘文件，用于渲染 Markdown 引用的本地图片。
// 只放行常见图片扩展名，且要求绝对路径，防止被当作任意文件读取通道。
package localres

import (
	"encoding/base64"
	"net/http"
	"path/filepath"
	"strings"
)

// Prefix 是前端改写图片 src 使用的路径前缀。
const Prefix = "/local/"

var allowedExt = map[string]bool{
	".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".webp": true,
	".svg": true, ".bmp": true, ".avif": true, ".ico": true,
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
		if !allowedExt[strings.ToLower(filepath.Ext(path))] {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		http.ServeFile(w, r, path)
	})
}
