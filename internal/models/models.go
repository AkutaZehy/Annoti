// Package models 定义前后端共享的数据结构。
// JSON tag 即 Wails TS bindings 生成的字段名，修改需同步前端。
package models

// RegionRect 区域批注的框：相对锚定目标（文本块内容包围盒或图片元素）的归一化坐标 0~1。
// 以可选 JSON 字段挂在 TextAnchor 上——旧版本反序列化时忽略未知字段，
// 因此不改动数据库表结构与批注包版本（v2 格式的加法扩展）。
type RegionRect struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	W float64 `json:"w"`
	H float64 `json:"h"`
	// Img 非空表示框在图片上，值为渲染时的 img src（同一文档下稳定）；
	// 为空且 Page=false 表示框在文本块上，位置经 Start/End 文本偏移间接锚定，抗回流。
	Img string `json:"img,omitempty"`
	// Page=true 表示自由框（叠加层语义）：相对文档内容列归一化，不锚定内容。
	// 扫描件 PDF 等无文本层的文档只有这一种锚定方式；文本回流时框随几何近似缩放。
	Page bool `json:"page,omitempty"`
}

const (
	AnchorTypeText   = "text"
	AnchorTypeRegion = "region"
)

// TextAnchor 描述批注在文档文本流中的位置。
// Start/End 为渲染文本的 UTF-16 code unit 偏移；
// Exact/Prefix/Suffix 保存引文上下文，用于文档变化后的模糊重定位。
// 区域批注（Type=region）复用 Start/End 保存所在块的文本范围。
type TextAnchor struct {
	Type   string      `json:"type"`
	Start  int         `json:"start"`
	End    int         `json:"end"`
	Exact  string      `json:"exact"`
	Prefix string      `json:"prefix"`
	Suffix string      `json:"suffix"`
	Region *RegionRect `json:"region,omitempty"`
}

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
	// LibraryPath 仅 EPUB：解包缓存目录（前端经 /local/ 抓取章节），其余格式为空。
	LibraryPath string `json:"libraryPath,omitempty"`
	CreatedAt   int64  `json:"createdAt"`
	UpdatedAt   int64  `json:"updatedAt"`
}
