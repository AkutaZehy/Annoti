// Package epub 把 .epub（ZIP 容器）解包到数据目录下的 library 缓存，
// 供前端经 /local/ 端点按 OPF spine 顺序抓取章节 XHTML。
// 解包是纯机械动作：容器/清单/导航的解析由前端 DOMParser 负责。
package epub

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	maxEntries    = 20000
	maxTotalBytes = 512 << 20 // 解压总量上限，防御异常体积的容器
)

// libraryRootOverride 测试注入用；为空时使用真实用户配置目录。
var libraryRootOverride string

// LibraryRoot 返回解包缓存根目录（%ConfigDir%/AnnotiV2/library）。
// localres 端点对该目录整体放行（目录外仍仅限图片与 .epub）。
func LibraryRoot() (string, error) {
	if libraryRootOverride != "" {
		return libraryRootOverride, nil
	}
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("无法定位用户配置目录: %w", err)
	}
	return filepath.Join(base, "AnnotiV2", "library"), nil
}

// Extract 把 path 解包到 library/<key>/ 并返回该目录。
// key 由 路径+大小+修改时间 派生：同书复用缓存，文件变化自动换新目录；
// 目录已存在即缓存命中，不重复解包。
func Extract(path string) (string, error) {
	info, err := os.Stat(path)
	if err != nil {
		return "", fmt.Errorf("读取文件失败: %w", err)
	}
	sum := sha256.Sum256([]byte(
		strings.ToLower(path) + "\x00" +
			strconv.FormatInt(info.Size(), 10) + "\x00" +
			strconv.FormatInt(info.ModTime().UnixNano(), 10),
	))
	root, err := LibraryRoot()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(root, hex.EncodeToString(sum[:8]))
	if st, err := os.Stat(dir); err == nil && st.IsDir() {
		return dir, nil
	}

	r, err := zip.OpenReader(path)
	if err != nil {
		return "", fmt.Errorf("无法读取 EPUB 容器: %w", err)
	}
	defer r.Close()
	if len(r.File) > maxEntries {
		return "", fmt.Errorf("EPUB 条目数超出限制 (%d)", len(r.File))
	}

	var total int64
	for _, f := range r.File {
		if f.FileInfo().IsDir() {
			continue
		}
		dest, err := safeJoin(dir, f.Name)
		if err == nil {
			// 限额按实际写入字节累计：zip 头部的 UncompressedSize64 可以谎报
			var n int64
			n, err = extractFile(f, dest, maxTotalBytes-total)
			total += n
		}
		if err != nil {
			// 失败不留半成品：目录存在即缓存命中，残次品会被当成好缓存
			_ = os.RemoveAll(dir)
			return "", err
		}
	}
	return dir, nil
}

// safeJoin 把 zip 内路径映射到 dir 下，拒绝绝对路径与 .. 穿越（zip-slip）。
func safeJoin(dir, name string) (string, error) {
	cleaned := filepath.Clean("/" + strings.ReplaceAll(name, "\\", "/"))
	joined := filepath.Join(dir, cleaned)
	if !strings.HasPrefix(joined, dir+string(filepath.Separator)) {
		return "", fmt.Errorf("EPUB 内非法路径: %q", name)
	}
	return joined, nil
}

// extractFile 写出单个条目，最多写 budget 字节（超出即报错）。
// 返回实际写入字节数，供调用方累计解压总量。
func extractFile(f *zip.File, dest string, budget int64) (int64, error) {
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return 0, err
	}
	src, err := f.Open()
	if err != nil {
		return 0, fmt.Errorf("EPUB 条目 %s 读取失败: %w", f.Name, err)
	}
	defer src.Close()

	dst, err := os.OpenFile(dest, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		return 0, err
	}
	defer dst.Close()
	// 多钳 1 字节：写满 budget 后源还有内容即超限
	n, err := io.Copy(dst, io.LimitReader(src, budget+1))
	if err != nil {
		return n, err
	}
	if n > budget {
		return n, fmt.Errorf("EPUB 解压后体积超出限制")
	}
	return n, nil
}
