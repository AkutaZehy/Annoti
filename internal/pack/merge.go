package pack

import (
	"time"

	"annoti/internal/models"
	"annoti/internal/storage"
)

// MergeImport 将导入包合并进当前文档：按 DedupeKey 去重，
// 保留新条目并重置 ID/归属/时间戳。返回实际新增的批注。
func MergeImport(p Pack, docID string, existing map[string]struct{}, nowMs int64) []models.Annotation {
	fresh := make([]models.Annotation, 0, len(p.Annotations))
	for _, a := range p.Annotations {
		if a.Anchor.Type == "" {
			a.Anchor.Type = models.AnchorTypeText
		}
		key := storage.DedupeKey(a)
		if _, dup := existing[key]; dup {
			continue
		}
		existing[key] = struct{}{} // 包内部也可能有重复
		a.ID = ""
		a.DocumentID = docID
		a.CreatedAt = nowMs
		a.UpdatedAt = nowMs
		fresh = append(fresh, a)
	}
	return fresh
}

// Now 便于测试注入时间。
var Now = func() int64 { return time.Now().UnixMilli() }
