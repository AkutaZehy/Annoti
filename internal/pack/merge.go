package pack

import (
	"annoti/internal/models"
	"annoti/internal/storage"
)

// MergeResult 合并结果：Writes 是需要落库的批注（新增或更新），
// Added/Updated 分别计入导入结果的两类计数。
type MergeResult struct {
	Writes  []models.Annotation
	Added   int
	Updated int
}

// MergeImport 将导入包合并进当前文档（格式 v2，讨论串感知）。
//
// 根批注（ParentID 为空）：按 DedupeKey（作者|引文|位置）去重；
// 与本地重复的跳过，新的以**原 ID** 导入——讨论串链接依赖 ID 不变。
// 回复：按 ID 去重；本地已有且包内 updated_at 更新 → 原位更新（LWW），
// 否则跳过；本地没有 → 以原 ID 新增。
// 被跳过的重复根，其包内回复的 ParentID 会重映射到本地对应根的 ID。
// 孤儿回复（父不在本地也不在包内）照常导入，由 UI 标记"回复丢失"，
// 与锚点失效"标记不删"同一哲学。
func MergeImport(p Pack, docID string, existing []models.Annotation) MergeResult {
	existingByKey := make(map[string]string, len(existing)) // DedupeKey → 本地 ID
	existingByID := make(map[string]models.Annotation, len(existing))
	for _, a := range existing {
		existingByKey[storage.DedupeKey(a)] = a.ID
		existingByID[a.ID] = a
	}

	remap := make(map[string]string) // 包内根 ID → 落地后的本地 ID
	var res MergeResult

	// 第一遍：根批注
	for _, a := range p.Annotations {
		if a.ParentID != "" {
			continue
		}
		key := storage.DedupeKey(a)
		if localID, dup := existingByKey[key]; dup {
			remap[a.ID] = localID
			continue
		}
		if _, idTaken := existingByID[a.ID]; idTaken {
			// 同 ID 但内容键不同（罕见）：视为重复，跳过避免覆盖
			remap[a.ID] = a.ID
			continue
		}
		existingByKey[key] = a.ID
		existingByID[a.ID] = a
		remap[a.ID] = a.ID
		res.Writes = append(res.Writes, rebind(a, docID))
		res.Added++
	}

	// 第二遍：回复
	for _, a := range p.Annotations {
		if a.ParentID == "" {
			continue
		}
		if mapped, ok := remap[a.ParentID]; ok {
			a.ParentID = mapped
		}
		a.DocumentID = docID
		if local, known := existingByID[a.ID]; known {
			if a.UpdatedAt > local.UpdatedAt {
				a.CreatedAt = local.CreatedAt
				res.Writes = append(res.Writes, a)
				res.Updated++
			}
			continue
		}
		existingByID[a.ID] = a
		res.Writes = append(res.Writes, rebind(a, docID))
		res.Added++
	}
	return res
}

// rebind 保留原 ID 与时间戳，仅改归属文档并补锚点类型。
func rebind(a models.Annotation, docID string) models.Annotation {
	if a.Anchor.Type == "" {
		a.Anchor.Type = models.AnchorTypeText
	}
	a.DocumentID = docID
	return a
}
