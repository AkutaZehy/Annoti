#!/usr/bin/env bash
# ============================================================================
# scripts/release.sh — Annoti 出包流水线
# ============================================================================
# 用法：
#   scripts/release.sh --dry-run
#       全流程演练：质量门 → 构建 → 冒烟 → 打包。不推送、不发布，
#       产物留在 build/dist/ 供人工检查。
#
#   scripts/release.sh --notes <发布说明.md> [--prerelease]
#       正式发布。前置条件（人工完成，见 doc/RELEASE.md）：
#         1) winres/winres.json 版本块、wails.json info、README 已更新
#         2) go-winres make --arch amd64 重新生成 rsrc_windows_amd64.syso 并已提交
#         3) git tag -a vX.Y.Z -m "..." 且已推送（tag 是版本号唯一事实来源）
#         4) HEAD 恰好在 tag 上（main 出新版 / release/v1 出补丁）
#
# 依赖：git, go, pnpm, gh, powershell, go-winres（默认 %USERPROFILE%\go\bin）
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MODE="release"
NOTES_FILE=""
PRERELEASE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) MODE="dry" ;;
    --notes) NOTES_FILE="${2:?--notes 需要文件参数}"; shift ;;
    --prerelease) PRERELEASE=1 ;;
    *) echo "✗ 未知参数: $1"; exit 2 ;;
  esac
  shift
done

if [[ "$MODE" == "dry" ]]; then
  echo "============================================================"
  echo " DRY-RUN 演练：不推送、不创建 Release"
  echo "============================================================"
fi

# ---------------------------------------------------------------- [1/9] 预检
echo "==> [1/9] 预检"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$MODE" == "release" ]]; then
  case "$BRANCH" in
    main|release/*) ;;
    *) echo "✗ 发布必须在 main 或 release/* 上（当前分支：$BRANCH）"; exit 1 ;;
  esac
fi
if [[ -n "$(git status --porcelain)" ]]; then
  if [[ "$MODE" == "release" ]]; then
    echo "✗ 工作区不干净，先提交或清理："
    git status --porcelain
    exit 1
  fi
  echo "⚠ 工作区不干净（dry-run 继续）："
  git status --porcelain
fi

# ------------------------------------------------------------ [2/9] 版本来源
echo "==> [2/9] 读取版本（tag 是唯一事实来源）"
# 用 node 解析而非 powershell：后者对 UTF-8 无 BOM 文件按 ANSI 读，中文值会破坏 JSON
VER="$(node -p "require('./winres/winres.json').RT_VERSION['#1']['0000'].info['0409'].ProductVersion")"
if [[ -z "$VER" ]]; then
  echo "✗ 未能从 winres/winres.json 读取 ProductVersion"
  exit 1
fi
TAG_EXPECTED="v$VER"
echo "    winres ProductVersion = $VER"

# ------------------------------------------------------------ [3/9] tag 校验
echo "==> [3/9] tag 校验"
if [[ "$MODE" == "release" ]]; then
  TAG_ACTUAL="$(git describe --exact-match --tags HEAD 2>/dev/null || true)"
  if [[ "$TAG_ACTUAL" != "$TAG_EXPECTED" ]]; then
    echo "✗ HEAD 不在 tag $TAG_EXPECTED 上（实际：${TAG_ACTUAL:-无}）"
    echo "  正确顺序：版本收口提交 → git tag -a → push → 再运行本脚本"
    exit 1
  fi
  if ! git ls-remote --tags origin "refs/tags/$TAG_EXPECTED" | grep -q "$TAG_EXPECTED"; then
    echo "✗ tag $TAG_EXPECTED 尚未推送到 origin"
    exit 1
  fi
  echo "    HEAD = $TAG_ACTUAL @ $BRANCH"
else
  echo "    （dry-run 跳过 tag 强校验）"
fi

# ---------------------------------------------------------- [4/9] 文档同步检查
echo "==> [4/9] 文档同步检查"
if ! grep -q "$VER" README.md; then
  echo "⚠ README.md 未提及版本 $VER —— 请确认文档是否需要随版本更新"
else
  echo "    README.md 已含版本 $VER"
fi

# ---------------------------------------------------------------- [5/9] 质量门
echo "==> [5/9] 质量门（go test / vitest / eslint / vue-tsc + vite build）"
go test ./...
(cd frontend && pnpm install --frozen-lockfile && pnpm test && pnpm exec eslint . && pnpm build)

# ------------------------------------------------------- [6/9] 版本资源同步检查
echo "==> [6/9] 版本资源同步检查（go-winres make）"
GO_WINRES="$(command -v go-winres || echo "$HOME/go/bin/go-winres.exe")"
if [[ ! -x "$GO_WINRES" ]]; then
  echo "✗ 找不到 go-winres（预期 $HOME/go/bin/go-winres.exe）"
  exit 1
fi
# 注意：是 make（读 winres.json 全量生成），不是 simply（简化模式，不带版本信息）
"$GO_WINRES" make --arch amd64
if [[ -n "$(git status --porcelain -- rsrc_windows_amd64.syso)" ]]; then
  if [[ "$MODE" == "release" ]]; then
    echo "✗ rsrc_windows_amd64.syso 与 winres/winres.json 不同步。"
    echo "  请运行 go-winres simply 重新生成、提交、重打 tag 后再发布。"
    exit 1
  fi
  echo "⚠ syso 相对 winres.json 有差异（dry-run 已还原）"
  git checkout -- rsrc_windows_amd64.syso
else
  echo "    syso 与 winres.json 同步"
fi

# ------------------------------------------------------------------ [7/9] 构建
echo "==> [7/9] 构建 annoti.exe"
go build -tags desktop,production -trimpath -ldflags "-s -w -H windowsgui" -o build/bin/annoti.exe .

# ------------------------------------------------------------------ [8/9] 冒烟
echo "==> [8/9] 冒烟（版本资源嵌入 + 启动窗口标题）"
mkdir -p build/dist
cat > build/dist/smoke.ps1 <<'PS1'
param([string]$ExePath,[string]$ExpectedVersion,[string]$ExpectedTitle)
$ErrorActionPreference='Stop'
$pv=(Get-Item -LiteralPath $ExePath).VersionInfo.ProductVersion
if($pv -ne $ExpectedVersion){Write-Output "FAIL 版本: exe='$pv' 期望='$ExpectedVersion'";exit 1}
$p=Start-Process -FilePath $ExePath -PassThru
$title=''
try{
  for($i=0;$i -lt 20;$i++){
    Start-Sleep -Milliseconds 500
    $p.Refresh()
    if($p.HasExited){Write-Output "FAIL 进程提前退出 code=$($p.ExitCode)";exit 1}
    if($p.MainWindowTitle){$title=$p.MainWindowTitle;break}
  }
}finally{
  if(-not $p.HasExited){Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue}
}
if(-not $title){Write-Output 'FAIL 主窗口未出现（缺构建标签的典型症状）';exit 1}
if($ExpectedTitle -and $title -ne $ExpectedTitle){Write-Output "FAIL 窗口标题 '$title' != '$ExpectedTitle'";exit 1}
Write-Output "OK version=$pv title=$title"
PS1
EXE_WINPATH="$(cygpath -w "$PWD/build/bin/annoti.exe")"
powershell -NoProfile -ExecutionPolicy Bypass -File "build/dist/smoke.ps1" \
  -ExePath "$EXE_WINPATH" -ExpectedVersion "$VER" -ExpectedTitle "Annoti"

# ------------------------------------------------------------------ [9/9] 打包
echo "==> [9/9] 打包"
STAGE="build/dist/Annoti_${VER}"
ZIP="build/dist/Annoti_${VER}_windows_amd64.zip"
rm -rf "$STAGE"
mkdir -p "$STAGE"
cp build/bin/annoti.exe README.md LICENSE "$STAGE/"
powershell -NoProfile -Command "Compress-Archive -Path 'build/dist/Annoti_${VER}' -DestinationPath 'build/dist/Annoti_${VER}_windows_amd64.zip' -Force"
(cd build/dist && sha256sum "Annoti_${VER}/annoti.exe" "Annoti_${VER}_windows_amd64.zip" > SHA256SUMS.txt)

# ------------------------------------------------------------------- 发布/收尾
if [[ "$MODE" == "dry" ]]; then
  echo "============================================================"
  echo " DRY-RUN 完成。产物（仅本地，未发布）："
  echo "   $ZIP"
  echo "   build/dist/SHA256SUMS.txt"
  echo " 正式发布（tag 已推送后）："
  echo "   scripts/release.sh --notes <中文发布说明.md>"
  echo "============================================================"
else
  if [[ -z "$NOTES_FILE" ]]; then
    echo "✗ 正式发布需要 --notes <发布说明文件>（中文，Markdown）"
    exit 1
  fi
  if [[ ! -f "$NOTES_FILE" ]]; then
    echo "✗ 发布说明不存在：$NOTES_FILE"
    exit 1
  fi
  GH_ARGS=(gh release create "$TAG_EXPECTED" "$ZIP" "build/dist/SHA256SUMS.txt" --title "$TAG_EXPECTED" --notes-file "$NOTES_FILE")
  if [[ -n "$PRERELEASE" || "$VER" == *-* ]]; then
    GH_ARGS+=(--prerelease)
  fi
  "${GH_ARGS[@]}"
  echo "✓ Release $TAG_EXPECTED 已创建。请到 GitHub 检查附件与发布说明。"
fi
