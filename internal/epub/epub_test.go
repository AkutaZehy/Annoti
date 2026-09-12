package epub

import (
	"archive/zip"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// 构造一个最小 EPUB 容器：含子目录文件与正常条目。
func writeEpub(t *testing.T, path string, files map[string]string) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	w := zip.NewWriter(f)
	for name, body := range files {
		entry, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := entry.Write([]byte(body)); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
}

func TestExtractRoundTrip(t *testing.T) {
	libraryRootOverride = t.TempDir()
	defer func() { libraryRootOverride = "" }()
	src := filepath.Join(t.TempDir(), "book.epub")
	writeEpub(t, src, map[string]string{
		"META-INF/container.xml":  `<container/>`,
		"OEBPS/content.opf":       `<package/>`,
		"OEBPS/text/chapter1.xml": "<html></html>",
	})

	dir, err := Extract(src)
	if err != nil {
		t.Fatalf("Extract: %v", err)
	}
	if !filepath.IsAbs(dir) {
		t.Fatalf("应返回绝对路径: %q", dir)
	}
	for _, rel := range []string{
		filepath.Join("META-INF", "container.xml"),
		filepath.Join("OEBPS", "text", "chapter1.xml"),
	} {
		body, err := os.ReadFile(filepath.Join(dir, rel))
		if err != nil {
			t.Fatalf("解包产物缺失 %s: %v", rel, err)
		}
		if len(body) == 0 {
			t.Fatalf("%s 内容为空", rel)
		}
	}

	// 缓存命中：再次解包返回同一目录
	dir2, err := Extract(src)
	if err != nil || dir2 != dir {
		t.Fatalf("重复解包应命中缓存: %q vs %q (%v)", dir2, dir, err)
	}
}

// zip-slip 防护采用"前导斜杠钳制"：路径里的 .. 在虚拟根内折叠，
// 任何条目都落在解包目录之内，容器外的文件系统不受影响。
func TestExtractClampsUnsafeNames(t *testing.T) {
	root := t.TempDir()
	libraryRootOverride = root
	defer func() { libraryRootOverride = "" }()
	src := filepath.Join(root, "evil.epub")
	f, err := os.Create(src)
	if err != nil {
		t.Fatal(err)
	}
	w := zip.NewWriter(f)
	for _, name := range []string{"ok.txt", `..\..\evil.txt`, "a/../../b.txt"} {
		entry, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = entry.Write([]byte("x"))
	}
	_ = w.Close()
	_ = f.Close()

	dir, err := Extract(src)
	if err != nil {
		t.Fatalf("Extract: %v", err)
	}
	if !strings.HasPrefix(dir, root) {
		t.Fatalf("解包目录应在注入的 library 根下: %q", dir)
	}
	// 根目录下不得出现逃逸文件
	for _, escaped := range []string{filepath.Join(root, "evil.txt"), filepath.Join(root, "b.txt")} {
		if _, err := os.Stat(escaped); !os.IsNotExist(err) {
			t.Fatalf("条目逃逸到解包目录之外: %s", escaped)
		}
	}
}

func TestSafeJoinClampsInsideDir(t *testing.T) {
	dir := filepath.Join(string(filepath.Separator), "tmp", "lib", "abc")
	for _, name := range []string{"../../etc/passwd", `..\..\x`, "/abs.txt", "a/../../b"} {
		got, err := safeJoin(dir, name)
		if err != nil {
			t.Fatalf("%q 不应报错: %v", name, err)
		}
		if !strings.HasPrefix(got, dir+string(filepath.Separator)) {
			t.Fatalf("%q 应被钳制在目录内: %q", name, got)
		}
	}
}
