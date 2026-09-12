// Package encoding 将任意文本文件字节解码为 UTF-8 字符串。
// 判定顺序：BOM 声明（UTF-8/UTF-16）→ UTF-8 有效性 → GB18030 回退。
// GB18030 向下兼容 GBK/GB2312，覆盖中文 Windows 上常见的 ANSI 编码文本
// （V2 支持 csv 等格式后，Excel 导出的 GBK 文件是常态而非例外）。
package encoding

import (
	"unicode/utf8"

	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/unicode"
)

// Decode 把原始文件字节转为 UTF-8 文本。
func Decode(raw []byte) string {
	// UTF-8 BOM
	if len(raw) >= 3 && raw[0] == 0xEF && raw[1] == 0xBB && raw[2] == 0xBF {
		return string(raw[3:])
	}
	// UTF-16 LE/BE BOM
	if len(raw) >= 2 && raw[0] == 0xFF && raw[1] == 0xFE {
		return decodeUTF16(raw[2:], unicode.LittleEndian)
	}
	if len(raw) >= 2 && raw[0] == 0xFE && raw[1] == 0xFF {
		return decodeUTF16(raw[2:], unicode.BigEndian)
	}
	// 合法 UTF-8（含 ASCII 与空文件）直接通过
	if utf8.Valid(raw) {
		return string(raw)
	}
	// GB18030 回退；解码器对非法字节做替换而非报错，返回值总是可用
	out, err := simplifiedchinese.GB18030.NewDecoder().Bytes(raw)
	if err != nil {
		return string(raw)
	}
	return string(out)
}

func decodeUTF16(raw []byte, bo unicode.Endianness) string {
	out, err := unicode.UTF16(bo, unicode.IgnoreBOM).NewDecoder().Bytes(raw)
	if err != nil {
		return string(raw)
	}
	return string(out)
}
