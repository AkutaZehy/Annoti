package pack

import (
	"testing"

	"annoti/internal/models"
	"annoti/internal/storage"
)

func rootAnno(id, author, quote string, start, end int) models.Annotation {
	return models.Annotation{
		ID: id, AuthorName: author, Quote: quote,
		Anchor: models.TextAnchor{Type: "text", Start: start, End: end, Exact: quote},
	}
}

func replyAnno(id, parentID, author, body string, updatedAt int64) models.Annotation {
	return models.Annotation{
		ID: id, ParentID: parentID, AuthorName: author, Body: body,
		Anchor: models.TextAnchor{Type: "text"}, UpdatedAt: updatedAt,
	}
}

// 根批注按内容键去重；新的保留原 ID 导入；不同作者不去重。
func TestMergeImportRootsDedupeByKey(t *testing.T) {
	p := Pack{Format: FormatName, Version: Version}
	p.Annotations = []models.Annotation{
		rootAnno("old-1", "Akuta", "重复", 0, 2),  // 与本地同键 → 跳过
		rootAnno("old-2", "Akuta", "重复", 0, 2),  // 包内同键 → 跳过
		rootAnno("old-3", "Akuta", "新内容", 5, 8), // 新 → 原样导入
		rootAnno("old-4", "别人", "重复", 0, 2),     // 不同作者 → 导入
	}
	existing := []models.Annotation{rootAnno("local-1", "Akuta", "重复", 0, 2)}

	res := MergeImport(p, "doc-9", existing)
	if res.Added != 2 || res.Updated != 0 || len(res.Writes) != 2 {
		t.Fatalf("应新增 2 条: %+v", res)
	}
	byID := map[string]models.Annotation{}
	for _, a := range res.Writes {
		byID[a.ID] = a
	}
	if _, ok := byID["old-3"]; !ok {
		t.Fatalf("新根应保留原 ID 导入: %+v", res.Writes)
	}
	for _, a := range res.Writes {
		if a.DocumentID != "doc-9" || a.Anchor.Type != "text" {
			t.Fatalf("导入批注字段不符: %+v", a)
		}
	}
}

// 回复保留 ID；回复到"被去重跳过的根"时 ParentID 重映射到本地根。
func TestMergeImportReplyRemapsToExistingRoot(t *testing.T) {
	localRoot := rootAnno("local-root", "Akuta", "重复", 0, 2)
	p := Pack{Format: FormatName, Version: Version}
	p.Annotations = []models.Annotation{
		rootAnno("peer-root", "Akuta", "重复", 0, 2), // 与 local-root 同键 → 跳过并重映射
		replyAnno("peer-reply-1", "peer-root", "Bob", "同意", 10),
	}

	res := MergeImport(p, "doc-9", []models.Annotation{localRoot})
	if res.Added != 1 {
		t.Fatalf("只应导入回复本身: %+v", res)
	}
	if res.Writes[0].ID != "peer-reply-1" || res.Writes[0].ParentID != "local-root" {
		t.Fatalf("回复应保留 ID 且父引用重映射: %+v", res.Writes[0])
	}
}

// 回复 LWW：包内更新 → 原位更新并保留本地 CreatedAt；包内更旧 → 跳过。
func TestMergeImportReplyLWW(t *testing.T) {
	localR1 := replyAnno("r1", "root-1", "Bob", "旧内容", 100)
	localR1.CreatedAt = 50
	localR2 := replyAnno("r2", "root-1", "Bob", "本地已最新", 100)

	p := Pack{Format: FormatName, Version: Version}
	p.Annotations = []models.Annotation{
		rootAnno("root-1", "Akuta", "引文", 0, 2),
		replyAnno("r1", "root-1", "Bob", "新内容", 200),
		replyAnno("r2", "root-1", "Bob", "更旧被跳过", 50),
		replyAnno("r3", "root-1", "Bob", "新回复", 1),
	}

	res := MergeImport(p, "doc-9", []models.Annotation{
		rootAnno("root-1", "Akuta", "引文", 0, 2), localR1, localR2,
	})
	if res.Added != 1 || res.Updated != 1 {
		t.Fatalf("应 1 条新增(r3) + 1 条更新(r1): %+v", res)
	}
	if res.Writes[0].Body != "新内容" || res.Writes[0].CreatedAt != 50 {
		t.Fatalf("更新应保留本地 CreatedAt: %+v", res.Writes[0])
	}
	if res.Writes[1].ID != "r3" {
		t.Fatalf("新增应为 r3: %+v", res.Writes[1])
	}
}

// 孤儿回复（父既不在本地也不在包内）照常导入，交给 UI 标记。
func TestMergeImportOrphanReplyKept(t *testing.T) {
	p := Pack{Format: FormatName, Version: Version}
	p.Annotations = []models.Annotation{
		replyAnno("ghost-reply", "missing-root", "Bob", "回复丢失", 10),
	}
	res := MergeImport(p, "doc-9", nil)
	if res.Added != 1 || res.Writes[0].ParentID != "missing-root" {
		t.Fatalf("孤儿回复应照常导入: %+v", res)
	}
}

// 去重键回归：同作者同位置同引文才算重复。
func TestDedupeKeyShape(t *testing.T) {
	a := rootAnno("x", "Akuta", "引文", 3, 9)
	if got := storage.DedupeKey(a); got != "Akuta|引文|3|9" {
		t.Fatalf("键形状变化，需同步检查旧数据兼容: %q", got)
	}
}
