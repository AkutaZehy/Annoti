package pack

import (
	"encoding/json"
	"testing"

	"annoti/internal/models"
)

func TestPackRoundtrip(t *testing.T) {
	doc := models.Document{ID: "d1", Name: "文章.md", Checksum: "abc123"}
	annos := []models.Annotation{{
		ID: "anno-1", DocumentID: "d1", AuthorID: "local", AuthorName: "Akuta",
		Quote: "一段引文", Body: "**批注**正文",
		Anchor: models.TextAnchor{Type: "text", Start: 4, End: 9, Exact: "一段引文"},
	}}

	data, err := json.Marshal(Build(doc, annos))
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	p, err := Parse(data)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if p.Format != FormatName || p.Version != Version || p.Document.Checksum != "abc123" {
		t.Fatalf("往返字段不符: %+v", p)
	}
	if len(p.Annotations) != 1 || p.Annotations[0].Body != "**批注**正文" {
		t.Fatalf("批注往返不符: %+v", p.Annotations)
	}
}

func TestParseRejectsForeignFormat(t *testing.T) {
	if _, err := Parse([]byte(`{"format":"something-else","version":1}`)); err == nil {
		t.Fatalf("应拒绝未知格式")
	}
	if _, err := Parse([]byte(`{"format":"annoti-annotations","version":99}`)); err == nil {
		t.Fatalf("应拒绝更高版本")
	}
	if _, err := Parse([]byte(`not json`)); err == nil {
		t.Fatalf("应拒绝非法 JSON")
	}
}

func TestMergeImportDedupesAndResets(t *testing.T) {
	p := Pack{
		Format: FormatName, Version: Version,
		Document: DocumentRef{Name: "a.md", Checksum: "cs"},
		Annotations: []models.Annotation{
			{ID: "old-1", AuthorName: "Akuta", Quote: "重复", Anchor: models.TextAnchor{Start: 0, End: 2, Exact: "重复"}},
			{ID: "old-2", AuthorName: "Akuta", Quote: "重复", Anchor: models.TextAnchor{Start: 0, End: 2, Exact: "重复"}}, // 包内重复
			{ID: "old-3", AuthorName: "Akuta", Quote: "新内容", Anchor: models.TextAnchor{Start: 5, End: 8, Exact: "新内容"}},
			{ID: "old-4", AuthorName: "别人", Quote: "重复", Anchor: models.TextAnchor{Start: 0, End: 2, Exact: "重复"}}, // 不同作者不去重
		},
	}
	existing := map[string]struct{}{
		"Akuta|重复|0|2": {},
	}

	fresh := MergeImport(p, "doc-9", existing, 42)
	if len(fresh) != 2 {
		t.Fatalf("应导入 2 条, 得 %d: %+v", len(fresh), fresh)
	}
	for _, a := range fresh {
		if a.ID != "" || a.DocumentID != "doc-9" || a.CreatedAt != 42 || a.Anchor.Type != "text" {
			t.Fatalf("导入批注未重置: %+v", a)
		}
	}
}
