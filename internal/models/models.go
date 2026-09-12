// Package models 定义前后端共享的数据结构。
// JSON tag 即 Wails TS bindings 生成的字段名，修改需同步前端。
package models

// TextAnchor 描述批注在文档文本流中的位置。
// Start/End 为渲染文本的 UTF-16 code unit 偏移；
// Exact/Prefix/Suffix 保存引文上下文，用于文档变化后的模糊重定位。
type TextAnchor struct {
	Type   string `json:"type"`
	Start  int    `json:"start"`
	End    int    `json:"end"`
	Exact  string `json:"exact"`
	Prefix string `json:"prefix"`
	Suffix string `json:"suffix"`
}

const AnchorTypeText = "text"

// Annotation 一条批注。ParentID 为 V2 讨论串预留。
type Annotation struct {
	ID         string     `json:"id"`
	DocumentID string     `json:"documentId"`
	ParentID   string     `json:"parentId,omitempty"`
	AuthorID   string     `json:"authorId"`
	AuthorName string     `json:"authorName"`
	Quote      string     `json:"quote"`
	Body       string     `json:"body"`
	Anchor     TextAnchor `json:"anchor"`
	Color      string     `json:"color,omitempty"`
	Resolved   bool       `json:"resolved"`
	CreatedAt  int64      `json:"createdAt"`
	UpdatedAt  int64      `json:"updatedAt"`
}

// Document 已打开文档的元数据。Content 仅在打开时随响应携带，不落库。
type Document struct {
	ID        string `json:"id"`
	Path      string `json:"path"`
	Name      string `json:"name"`
	Checksum  string `json:"checksum"`
	Size      int64  `json:"size"`
	Changed   bool   `json:"changed"` // 与上次打开相比内容是否变化
	Content   string `json:"content"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}
