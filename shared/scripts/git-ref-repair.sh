#!/bin/sh
# git-ref-repair.sh — 修复被沙箱破坏的 Git 引用
#
# ─────────────────────────────────────────────────────────────────────────
# 背景
# ─────────────────────────────────────────────────────────────────────────
# 本环境（WorkBuddy 沙箱）拦截 git 进程对 .git/refs/ 下**子目录**的创建与重写。
# 症状：git 命令返回 0 且提交对象完好，但 ref 文件（乃至整个子目录）被删除。
#
# 实测对照（business-manager，2026-09-17）：
#   git branch probe-noslash            （已有目录下建**文件**） → OK 持久化
#   git branch foo/bar                  （建**子目录**）         → 失败，目录未创建
#   git update-ref refs/heads/aaa/bbb   （建**子目录**）         → 失败，目录未创建
#   git fetch                           （写 refs/remotes/origin/）→ 失败，整个目录被删
#   mkdir -p <dir> + 手写 ref 文件                              → OK，git 可正确解析
#
# 恢复来源：
#   - 本地分支 → .git/logs/<ref>（reflog 不受此故障影响）
#   - 远程跟踪 → `git ls-remote`（远程是权威来源）
#
# ─────────────────────────────────────────────────────────────────────────
# 用法
# ─────────────────────────────────────────────────────────────────────────
#   sh git-ref-repair.sh <branch>     修复本地分支 ref（从 reflog 恢复）
#   sh git-ref-repair.sh --remotes    重建全部 origin/* 跟踪引用（需网络）
#
# 建议：每个 git 写操作（commit / merge / checkout / fetch / push）后都执行一次。

set -e

MODE="$1"

if [ -z "$MODE" ]; then
  echo "用法:" >&2
  echo "  sh git-ref-repair.sh <branch>     修复本地分支 ref" >&2
  echo "  sh git-ref-repair.sh --remotes    重建 origin/* 跟踪引用" >&2
  exit 2
fi

GITDIR="$(git rev-parse --git-dir)"

# ── 模式 1：重建远程跟踪引用 ────────────────────────────────────────────
if [ "$MODE" = "--remotes" ]; then
  REMOTE="${2:-origin}"
  REFS="$(git ls-remote --heads "$REMOTE")"

  if [ -z "$REFS" ]; then
    echo "错误: git ls-remote 无输出（网络或认证问题？）" >&2
    exit 3
  fi

  # 预先建好所有需要的子目录（git 自己建不了）
  printf '%s\n' "$REFS" | while read -r _sha ref; do
    [ -z "$ref" ] && continue
    rel="${ref#refs/heads/}"
    case "$rel" in
      */*) mkdir -p "$GITDIR/refs/remotes/$REMOTE/${rel%/*}" ;;
    esac
  done

  # 逐个写回 ref 文件
  printf '%s\n' "$REFS" | while read -r sha ref; do
    [ -z "$ref" ] && continue
    rel="${ref#refs/heads/}"
    target="$GITDIR/refs/remotes/$REMOTE/$rel"
    printf '%s\n' "$sha" > "$target"
    echo "  $REMOTE/$rel -> $(printf '%.7s' "$sha")"
  done

  # 重建 HEAD 符号引用
  DEFAULT="$(git ls-remote --symref "$REMOTE" HEAD 2>/dev/null \
    | awk '/^ref:/ {sub("refs/heads/", "", $2); print $2; exit}')"
  [ -z "$DEFAULT" ] && DEFAULT="main"
  printf 'ref: refs/remotes/%s/%s\n' "$REMOTE" "$DEFAULT" \
    > "$GITDIR/refs/remotes/$REMOTE/HEAD"

  echo "已重建 $REMOTE 跟踪引用（HEAD -> $DEFAULT）"
  exit 0
fi

# ── 模式 2：修复本地分支 ref（默认）──────────────────────────────────────
BRANCH="$MODE"
REF="refs/heads/$BRANCH"
LOG="$GITDIR/logs/$REF"
TARGET="$GITDIR/$REF"

if [ ! -f "$LOG" ]; then
  echo "错误: 找不到 reflog: $LOG" >&2
  exit 3
fi

SHA="$(tail -n 1 "$LOG" | awk '{print $2}')"
if [ -z "$SHA" ] || [ "$SHA" = "0000000000000000000000000000000000000000" ]; then
  echo "错误: reflog 最后一行无有效 SHA" >&2
  exit 4
fi

mkdir -p "$(dirname "$TARGET")"
printf '%s\n' "$SHA" > "$TARGET"

echo "已修复 $REF -> $SHA"

if git rev-parse --verify --quiet "$BRANCH" >/dev/null; then
  echo "校验通过: $(git log -1 --format='%h %s' "$BRANCH")"
else
  echo "校验失败: git 仍无法解析 $BRANCH" >&2
  exit 5
fi
