package storage

import (
	"testing"

	"annoti/internal/models"
)

// newTestStore 在临时目录中打开 Store，不触碰真实用户数据。
func newTestStore(t *testing.T) *Store {
	t.Helper()
	store, err := OpenAt(t.TempDir())
	if err != nil {
		t.Fatalf("OpenAt: %v", err)
	}
	t.Cleanup(func() { store.Close() })
	return store
}

func TestUpsertDocumentRoundtrip(t *testing.T) {
	store := newTestStore(t)

	doc, err := store.UpsertDocument(`C:\docs\a.md`, []byte("hello 世界"))
	if err != nil {
		t.Fatalf("UpsertDocument: %v", err)
	}
	if doc.ID == "" || doc.Changed {
		t.Fatalf("首次登记应生成 ID 且 Changed=false，得到 %+v", doc)
	}
	if doc.Name != "a.md" {
		t.Fatalf("Name = %q, want a.md", doc.Name)
	}

	// 内容不变：Changed 应为 false，ID 不变
	doc2, err := store.UpsertDocument(`C:\docs\a.md`, []byte("hello 世界"))
	if err != nil {
		t.Fatalf("UpsertDocument(2): %v", err)
	}
	if doc2.ID != doc.ID || doc2.Changed {
		t.Fatalf("同内容重复登记不应换 ID 或报 Changed: %+v", doc2)
	}

	// 内容变化：Changed 应为 true
	doc3, err := store.UpsertDocument(`C:\docs\a.md`, []byte("hello 新世界"))
	if err != nil {
		t.Fatalf("UpsertDocument(3): %v", err)
	}
	if doc3.ID != doc.ID || !doc3.Changed {
		t.Fatalf("内容变化应报 Changed=true: %+v", doc3)
	}

	got, ok, err := store.GetDocumentByID(doc.ID)
	if err != nil || !ok {
		t.Fatalf("GetDocumentByID: ok=%v err=%v", ok, err)
	}
	if got.Name != "a.md" {
		t.Fatalf("Name = %q, want a.md", got.Name)
	}
}

func TestAnnotationCRUD(t *testing.T) {
	store := newTestStore(t)
	doc, err := store.UpsertDocument(`C:\docs\b.txt`, []byte("正文内容"))
	if err != nil {
		t.Fatalf("UpsertDocument: %v", err)
	}

	a := mkAnnotation(doc.ID, "anno-1", "正文", 0, 2)
	if err := store.SaveAnnotation(&a); err != nil {
		t.Fatalf("SaveAnnotation: %v", err)
	}

	list, err := store.ListAnnotations(doc.ID)
	if err != nil {
		t.Fatalf("ListAnnotations: %v", err)
	}
	if len(list) != 1 || list[0].ID != "anno-1" || list[0].Anchor.Exact != "正文" {
		t.Fatalf("读取结果不符: %+v", list)
	}
	if list[0].ParentID != "" {
		t.Fatalf("ParentID 默认应为空, 得到 %q", list[0].ParentID)
	}

	// 更新
	a.Body = "更新后的批注"
	a.Resolved = true
	if err := store.SaveAnnotation(&a); err != nil {
		t.Fatalf("SaveAnnotation(update): %v", err)
	}
	list, _ = store.ListAnnotations(doc.ID)
	if len(list) != 1 || list[0].Body != "更新后的批注" || !list[0].Resolved {
		t.Fatalf("更新未生效: %+v", list)
	}

	// 删除
	if err := store.DeleteAnnotation("anno-1"); err != nil {
		t.Fatalf("DeleteAnnotation: %v", err)
	}
	list, _ = store.ListAnnotations(doc.ID)
	if len(list) != 0 {
		t.Fatalf("删除后应无批注, 剩 %d 条", len(list))
	}
}

// 删除根批注必须级联清除全部后代（DeleteAnnotation 的递归语句；
// 外键 pragma 未开，schema 的 ON DELETE CASCADE 不生效）。
func TestDeleteAnnotationCascades(t *testing.T) {
	store := newTestStore(t)
	doc, err := store.UpsertDocument(`C:\docs\thread.md`, []byte("正文"))
	if err != nil {
		t.Fatalf("UpsertDocument: %v", err)
	}

	root := mkAnnotation(doc.ID, "anno-root", "根引文", 0, 3)
	if err := store.SaveAnnotation(&root); err != nil {
		t.Fatalf("SaveAnnotation(root): %v", err)
	}
	child := mkAnnotation(doc.ID, "anno-child", "", 0, 0)
	child.ParentID = "anno-root"
	if err := store.SaveAnnotation(&child); err != nil {
		t.Fatalf("SaveAnnotation(child): %v", err)
	}
	grand := mkAnnotation(doc.ID, "anno-grand", "", 0, 0)
	grand.ParentID = "anno-child"
	if err := store.SaveAnnotation(&grand); err != nil {
		t.Fatalf("SaveAnnotation(grand): %v", err)
	}

	if err := store.DeleteAnnotation("anno-root"); err != nil {
		t.Fatalf("DeleteAnnotation: %v", err)
	}
	list, err := store.ListAnnotations(doc.ID)
	if err != nil {
		t.Fatalf("ListAnnotations: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("删除根后应级联清除整棵子树, 剩 %d 条: %+v", len(list), list)
	}
}

// 孤儿回复（ParentID 悬空）必须能落库：导入契约"标记不删"
// （pack.MergeImport，UI 标"回复丢失"）依赖这一点，
// 这也正是不开 foreign_keys pragma 的原因。
func TestOrphanReplyAllowed(t *testing.T) {
	store := newTestStore(t)
	doc, _ := store.UpsertDocument(`C:\docs\orphan.md`, []byte("正文"))

	orphan := mkAnnotation(doc.ID, "ghost-reply", "", 0, 0)
	orphan.ParentID = "missing-root"
	if err := store.SaveAnnotation(&orphan); err != nil {
		t.Fatalf("孤儿回复应能落库（UI 标记回复丢失）: %v", err)
	}
	list, err := store.ListAnnotations(doc.ID)
	if err != nil || len(list) != 1 || list[0].ParentID != "missing-root" {
		t.Fatalf("读取结果不符: %+v (%v)", list, err)
	}
}

func TestExistingDedupeKeys(t *testing.T) {
	store := newTestStore(t)
	doc, _ := store.UpsertDocument(`C:\docs\c.md`, []byte("重复文本测试"))

	a := mkAnnotation(doc.ID, "anno-a", "重复", 0, 2)
	a.AuthorName = "Akuta"
	_ = store.SaveAnnotation(&a)
	b := mkAnnotation(doc.ID, "anno-b", "文本", 2, 4)
	b.AuthorName = "别人"
	_ = store.SaveAnnotation(&b)

	keys, err := store.ExistingDedupeKeys(doc.ID)
	if err != nil {
		t.Fatalf("ExistingDedupeKeys: %v", err)
	}
	if len(keys) != 2 {
		t.Fatalf("应有 2 个去重键, 得 %d", len(keys))
	}
	if _, ok := keys[DedupeKey(a)]; !ok {
		t.Fatalf("缺少 anno-a 的键")
	}
}

func mkAnnotation(docID, id, quote string, start, end int) models.Annotation {
	return models.Annotation{
		ID:         id,
		DocumentID: docID,
		AuthorID:   "local",
		AuthorName: "Me",
		Quote:      quote,
		Anchor: models.TextAnchor{
			Type: models.AnchorTypeText, Start: start, End: end,
			Exact: quote,
		},
	}
}
