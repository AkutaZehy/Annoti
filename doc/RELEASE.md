# 发布与分支模型

Annoti 各代（V1/V2/V3…）是**故意不兼容的独立稳定产品**。产品的"独立稳定"由 GitHub Release
承载，不由分支承载；分支只服务代码维护。

## 分支模型

```
archive/1.0.0-dev-tauri  ●──────────────────────  化石线：换栈旧世界，永不再动
main                     ●──●──●──●──●──▶         现役开发线：永远开发下一代
release/v1                      (自 v1.0.0-delta 切)  V1 维护线：只收补丁，出 v1.0.x
tags                        v1.0.0-delta      v2.0.0-beta … v2.0.0
```

- **main**：现役开发线，永远是最新代。不设长期 feature 分支；高风险改动开短命分支。
- **release/&lt;代&gt;**：维护线。**切换时机 = main 即将落下一代第一个提交之前**，自对应 tag 切出。
  用途：上一代发现致命 bug 时在此修复 → 出补丁 tag（v1.0.1…）→ 顺手 cherry-pick 回 main。
  支持期限：只收致命 bug，下一代正式版发布后冻结。
- **archive/\***：只留给整体换技术栈的化石。同栈续命走 release/\*，换栈归档走 archive/\*。
- **tag 纪律**：一律 annotated tag；公开后永不强移（强移只属于"刚发布一小时内发现构建损坏且
  无人拉取"的窗口期，见 v1.0.0-delta 事故）。

## 代际 = major，全载体同步

| 载体 | V1（现状） | V2 |
|---|---|---|
| git tag / Release | v1.0.0-delta | v2.0.0-beta → v2.0.0 |
| winres ProductVersion | 1.0.0-delta | 2.0.0-xxx |
| .annoti.json format | version: 1 | version: 2 |
| 数据目录 | %APPDATA%\AnnotiV1 | %APPDATA%\AnnotiV2 |
| 维护分支 | release/v1 | V3 开工时切 release/v2 |

换代不带升级器，各装各的（数据目录隔离，可并排安装）；`.annoti.json` 只单向导入（上一代导出
可进下一代，反向不保证）。

## 出包流程（scripts/release.sh）

版本号的唯一事实来源是 git tag。正式发布前的人工准备：

```bash
# 1. 版本收口：更新 winres/winres.json（fixed + 0409/2052 两语言块）、wails.json info、README
# 2. 重新生成版本资源并提交（脚本会校验 syso 与 winres.json 同步）：
#    图标源是 winres/icon.png（≤256x256，自 build/appicon.png 缩制，已入仓）
go-winres make --arch amd64
# 3. 提交 → 打 tag → 推送：
git add -A && git commit -m "release: vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main --follow-tags
# 4. 写中文发布说明（Markdown，路径任意，如 build/dist/notes.md）
# 5. 发布（构建标签、冒烟、打包均由脚本固定）：
scripts/release.sh --notes build/dist/notes.md
```

脚本流水线：预检（干净工作区 / main 或 release/\* 分支 / HEAD 恰在 tag 上 / tag 已推送）→
版本一致性 → 文档检查 → 质量门（go test、vitest、eslint、vue-tsc+vite build）→ syso 同步校验 →
`go build -tags desktop,production -trimpath -ldflags "-s -w -H windowsgui"` → 冒烟 → 打包 →
`gh release create`。

关键不变量：

- **前端构建必须在 go build 之前**——`//go:embed all:frontend/dist`，顺序错了打包旧前端且无报错；
  脚本已固定顺序。
- **syso 必须与 winres.json 同步**——脚本重新生成后比对工作区，不同步即中止（dry-run 自动还原）。
- **冒烟** = exe 的 `VersionInfo.ProductVersion` 与 tag 一致 + 启动后主窗口标题为 `Annoti`
  （缺构建标签的坏构建弹错误对话框，标题对不上）。**脚本通过后仍需人工双击确认一次再发布**
  （v1.0.0-delta 事故教训）。
- 产物：`build/dist/Annoti_<版本>_windows_amd64.zip`（zip 内含 `Annoti_<版本>/` 顶层目录：
  exe + README + LICENSE，配合各代并排安装）+ `SHA256SUMS.txt`（"签名文件"）。版本带 `-`
  后缀（如 -beta、-delta）自动标记为 prerelease，或显式传 `--prerelease`。

演练：`scripts/release.sh --dry-run` 跑完整流水线但不推送、不发布，产物留 build/dist/ 检查。

## 历史事故备忘

- **v1.0.0-delta 首版损坏**（2026-09-12）：手工 go build 漏了 `-tags desktop,production`，用户启动
  即弹 "Wails applications will not build…"。教训：构建命令写死在脚本、发布前必须冒烟 + 人工双击。
- 同一事故的连锁：tag 强移重发、release 资产 clobber 重传——由此确立"tag 公开后不强移"纪律。
- **go-winres 子命令选错**（2026-09-13 出包流水线搭建时发现）：`simply` 是简化模式，产出的 syso
  **不含 winres.json 的版本信息**（exe 属性版本为空）；必须用 `make`。且 `make` 只认 PNG/JPG
  （≤256x256），winres.json 引用 .ico 会报 `image: unknown format`——图标源定为 winres/icon.png。
  `build/windows/icon.ico` 是 wails build 自用产物，与发布 syso 无关。
