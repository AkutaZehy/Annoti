# Annoti

Annoti 是一个基于 Tauri 的本地文档批注工具，支持 Markdown/HTML 渲染、固定宽度文本模式、深色/浅色主题切换以及灵活的排版配置。

## 功能特性

### 文档批注
- **高亮批注**：在文档中选择文本进行高亮批注，支持自定义高亮颜色和样式
- **便签系统**：为高亮内容添加便签，支持拖拽移动和自由调整大小
- **导入导出**：支持单独或批量导出/导入批注，便于分享和备份

### 文档渲染模式
- **Original 预设**：Markdown HTML 渲染模式，支持标准 Markdown 语法
- **Fixed 预设**：固定宽度文本模式，专为纯文本设计
  - 支持 CJK（中/日/韩）字符宽度检测
  - 可配置行宽、Tab 展开、行号显示
- **Pro 模式**：自定义 CSS 覆盖，完全控制渲染样式

### 主题系统
- **深色/浅色模式**：一键切换，支持自定义颜色方案
- **完整配色**：覆盖背景、文本、强调色、代码块、表格等

### 排版配置
- **字体设置**：字体家族、字号、字重、行高
- **段落间距**：可配置的段间距和标题边距
- **列表样式**：项目符号和缩进设置
- **代码块**：代码字体、背景色、圆角
- **引用块**：左边框、颜色设置
- **链接样式**：颜色和下划线配置
- **表格样式**：边框、表头背景、斑马纹

### 窗口管理
- 记住窗口大小、位置和最大化状态
- 首次运行自动计算 80% 屏幕大小并居中

## 安装

### 系统要求
- Windows 10/11
- Rust 1.70+

### 安装步骤

1. 确保已安装 Rust 和 Cargo：
   ```bash
   rustc --version
   cargo --version
   ```

2. 克隆项目并安装依赖：
   ```bash
   git clone https://github.com/你的用户名/Annoti.git
   cd Annoti
   pnpm install
   ```

3. 构建并运行开发版本：
   ```bash
   pnpm tauri dev
   ```

4. 构建发布版本：
   ```bash
   pnpm tauri build
   ```

   构建完成后，安装包位于：
   ```
   src-tauri/target/release/bundle/msi/Annoti_0.1.0_x64.msi
   ```

### 使用 MSI 安装包

1. 双击 `Annoti_0.1.0_x64.msi` 运行安装程序
2. 按照安装向导提示完成安装
3. 安装完成后，在开始菜单或桌面找到 Annoti 图标启动

## 卸载

**重要说明**：由于 Windows MSI 安装程序的限制，当前版本存在以下卸载问题：

1. **配置文件残留**：卸载程序无法自动删除用户配置文件
2. **数据库残留**：SQLite 数据库文件不会被清理

### 完整卸载步骤

1. 通过 Windows 设置或控制面板卸载 Annoti
2. 手动删除配置文件目录：
   ```
   %APPDATA%\Annoti\
   ```

   该目录包含：
   - `data.db` - SQLite 数据库（文档、批注、用户数据）
   - `settings.json` - 应用设置
   - `ui_settings.json` - UI 设置（窗口状态、主题偏好等）
   - `typography.yaml` - 排版配置

## 技术栈

- **前端**：Vue 3 + TypeScript + Vite
- **后端**：Tauri 2 + Rust
- **数据库**：SQLite (rusqlite)
- **样式**：CSS + CSS Variables

## 目录结构

```
Annoti/
├── src/                    # 前端源码
│   ├── components/         # Vue 组件
│   ├── composables/        # Vue 组合式函数
│   ├── styles/             # CSS 样式
│   ├── types/              # TypeScript 类型定义
│   └── utils/              # 工具函数
├── src-tauri/              # Tauri 后端源码
│   ├── src/
│   │   ├── db.rs          # 数据库操作
│   │   ├── lib.rs         # Tauri 命令定义
│   │   └── main.rs        # 程序入口
│   └── Cargo.toml         # Rust 依赖配置
└── package.json           # Node.js 依赖配置
```

## 贡献

**暂时关闭**：本项目目前暂停接受贡献。

这是一个个人兴趣爱好项目，由于时间和精力有限，暂不接收：
- Pull Request
- Issue 报告
- 功能请求

## 许可证

MIT License

## 致谢

- [Tauri](https://tauri.app/) - 构建跨平台桌面应用
- [Vue.js](https://vuejs.org/) - 前端框架
- [SQLite](https://www.sqlite.org/) - 轻量级数据库
