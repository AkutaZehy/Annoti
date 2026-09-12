package encoding

import (
	"testing"

	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/unicode"
)

func TestDecode(t *testing.T) {
	// 造一份 GBK 字节："中文内容"
	gbk, err := simplifiedchinese.GBK.NewEncoder().Bytes([]byte("中文内容"))
	if err != nil {
		t.Fatal(err)
	}
	// 造一份 UTF-16LE："AB"
	u16, err := unicode.UTF16(unicode.LittleEndian, unicode.IgnoreBOM).NewEncoder().Bytes([]byte("AB"))
	if err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		name string
		in   []byte
		want string
	}{
		{"空文件", nil, ""},
		{"纯 ASCII", []byte("hello"), "hello"},
		{"UTF-8 中文", []byte("中文"), "中文"},
		{"UTF-8 BOM", []byte{0xEF, 0xBB, 0xBF, 0xE4, 0xB8, 0xAD}, "中"},
		{"GBK 中文", gbk, "中文内容"},
		{"UTF-16LE BOM", append([]byte{0xFF, 0xFE}, u16...), "AB"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Decode(c.in); got != c.want {
				t.Fatalf("Decode(% x) = %q, want %q", c.in, got, c.want)
			}
		})
	}
}
