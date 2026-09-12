// Package pack 定义批注的导入导出交换格式（.annoti.json）。
// 该格式只用于交换：数据库才是唯一事实源。
package pack

import (
	"encoding/json"
	"fmt"
	"time"

	"annoti/internal/models"
)

const (
	FormatName = "annoti-annotations"
	Version    = 1
)

// DocumentRef 导出包中携带的源文档指纹。
type DocumentRef struct {
	Name     string `json:"name"`
	Checksum string `json:"checksum"`
}

// Pack 交换文件结构。
type Pack struct {
	Format      string             `json:"format"`
	Version     int                `json:"version"`
	ExportedAt  int64              `json:"exportedAt"`
	Document    DocumentRef        `json:"document"`
	Annotations []models.Annotation `json:"annotations"`
}

// Build 由当前文档与批注列表构造导出包。
func Build(doc models.Document, annos []models.Annotation) Pack {
	return Pack{
		Format:      FormatName,
		Version:     Version,
		ExportedAt:  time.Now().UnixMilli(),
		Document:    DocumentRef{Name: doc.Name, Checksum: doc.Checksum},
		Annotations: annos,
	}
}

// Parse 校验并解析交换文件。
func Parse(data []byte) (Pack, error) {
	var p Pack
	if err := json.Unmarshal(data, &p); err != nil {
		return Pack{}, fmt.Errorf("无法解析批注文件: %w", err)
	}
	if p.Format != FormatName {
		return Pack{}, fmt.Errorf("不认识的批注文件格式: %q", p.Format)
	}
	if p.Version > Version {
		return Pack{}, fmt.Errorf("批注文件版本 v%d 高于当前支持的 v%d", p.Version, Version)
	}
	return p, nil
}
