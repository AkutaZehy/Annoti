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
