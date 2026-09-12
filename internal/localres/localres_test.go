package localres

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func serve(t *testing.T, token string) *httptest.ResponseRecorder {
	t.Helper()
	rr := httptest.NewRecorder()
	Handler().ServeHTTP(rr, httptest.NewRequest("GET", "/local/"+token, nil))
	return rr
}

func TestHandlerServesLocalImage(t *testing.T) {
	dir := t.TempDir()
	pic := filepath.Join(dir, "pic.png")
	if err := os.WriteFile(pic, []byte{0x89, 'P', 'N', 'G', '\r', '\n'}, 0o644); err != nil {
		t.Fatal(err)
	}
	token := base64.RawURLEncoding.EncodeToString([]byte(pic))
	rr := serve(t, token)
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rr.Code)
	}
	if got := rr.Body.String(); got != string([]byte{0x89, 'P', 'N', 'G', '\r', '\n'}) {
		t.Fatalf("body mismatch: %q", got)
	}
}

func TestHandlerRejects(t *testing.T) {
	dir := t.TempDir()
	pic := filepath.Join(dir, "pic.png")
	_ = os.WriteFile(pic, []byte("x"), 0o644)
	secret := filepath.Join(dir, "notes.txt")
	_ = os.WriteFile(secret, []byte("secret"), 0o644)

	cases := []struct {
		name string
		path string
		want int
	}{
		{"非图片扩展名", secret, 403},
		{"目录穿越", filepath.Join(dir, "sub", "..", "..", "pic.png"), 404}, // Clean 后仍存在 → 但不在盘符外；用相对路径测
		{"坏 token", "%00garbage!!", 404},
		{"空 token", "", 404},
	}
	for _, c := range cases {
		rr := serve(t, base64.RawURLEncoding.EncodeToString([]byte(c.path)))
		if rr.Code == http.StatusOK {
			t.Errorf("%s: 不应放行 (got 200)", c.name)
		}
	}

	// 相对路径必须拒绝
	rr := serve(t, base64.RawURLEncoding.EncodeToString([]byte("relative/pic.png")))
	if rr.Code != http.StatusForbidden {
		t.Fatalf("相对路径 status = %d, want 403", rr.Code)
	}
	// 非 /local 前缀 404
	rr = httptest.NewRecorder()
	Handler().ServeHTTP(rr, httptest.NewRequest("GET", "/other/x", nil))
	if rr.Code != http.StatusNotFound {
		t.Fatalf("其他前缀 status = %d, want 404", rr.Code)
	}
}
