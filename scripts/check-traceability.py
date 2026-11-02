#!/usr/bin/env python3
"""可追溯性检查：交付请求内的每个提交必须引用一个真实存在的 Task。

规则来源：
  - `.agents/rules/github.md` §3「每个提交的 footer 必须包含任务引用（如 `Refs: <task-id>`）」
  - `docs/git-workflow.md` §2「footer 必须包含任务引用：`Refs: TASK-<NNN>`」

为什么需要它（TASK-056 审计 F-4a）：该规则此前只靠约定，实测合规率 240/323，
最近 5 个提交中 4 个缺失。**没有判据的规则会自然退化。**

设计约束：
  - 只检查 `base..HEAD`，**不追溯历史**（历史有 83 个缺 Refs 的提交；追溯会要求改写历史，
    属 `.agents/rules/git.md` §6 的受保护操作）。
  - 只依赖 python 标准库与 git，不联网、不读环境变量中的凭据。
  - 判据是「存在性」而非「格式完美」：接受 `Refs: TASK-052` 与 `Refs: TASK-052, TASK-053`。

用法：
    python3 scripts/check-traceability.py                 # 默认以 origin/main 为基线
    python3 scripts/check-traceability.py --base main
    python3 scripts/check-traceability.py --base origin/main --verbose

退出码：0 = 全部合规；1 = 存在违规；2 = 无法执行（基线不可解析等）。
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TASKS_DIR = ROOT / "tasks"
STATE_DIRS = ("backlog", "active", "review", "done")

# 一个提交内可出现多个任务（例如按 D13-C 并入上一任务的归档回写）
REFS_RE = re.compile(r"Refs:\s*((?:TASK-\d{3}(?:\s*,\s*)?)+)", re.IGNORECASE)
TASK_ID_RE = re.compile(r"TASK-(\d{3})", re.IGNORECASE)


def git(*args: str) -> str:
    proc = subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8"
    )
    if proc.returncode != 0:
        raise SystemExit(
            "无法执行 git %s\n%s\n提示：浅克隆会导致基线不可解析，"
            "CI 中需 actions/checkout 的 fetch-depth: 0。" % (" ".join(args), proc.stderr.strip())
        )
    return proc.stdout


def resolve_base(base: str) -> str:
    for candidate in (base, f"origin/{base}"):
        proc = subprocess.run(
            ["git", "rev-parse", "--verify", "--quiet", f"{candidate}^{{commit}}"],
            cwd=ROOT, capture_output=True, text=True,
        )
        if proc.returncode == 0:
            return candidate
    raise SystemExit(
        f"基线不可解析：{base}（也尝试了 origin/{base}）。"
        "请在 CI 中设置 BASE_REF=origin/${{ github.base_ref }}，并使用 fetch-depth: 0。"
    )


def known_task_ids() -> set[str]:
    ids: set[str] = set()
    for state in STATE_DIRS:
        directory = TASKS_DIR / state
        if not directory.is_dir():
            continue
        for child in directory.iterdir():
            if not child.is_dir():
                continue
            match = TASK_ID_RE.match(child.name)
            if match:
                ids.add(f"TASK-{match.group(1)}")
    return ids


def commits_in_range(base: str) -> list[str]:
    out = git("rev-list", "--reverse", f"{base}..HEAD")
    return [line.strip() for line in out.splitlines() if line.strip()]


def message_of(sha: str) -> str:
    return git("log", "-1", "--format=%B", sha)


def main() -> int:
    parser = argparse.ArgumentParser(description="检查 base..HEAD 内每个提交是否引用真实任务")
    parser.add_argument("--base", default="origin/main", help="比较基线（默认 origin/main）")
    parser.add_argument("--verbose", action="store_true", help="打印每个提交的判定结果")
    args = parser.parse_args()

    base = resolve_base(args.base)
    commits = commits_in_range(base)

    if not commits:
        print(f"[traceability] {base}..HEAD 无提交，跳过检查。")
        return 0

    known = known_task_ids()
    if not known:
        print(f"[traceability] 在 {TASKS_DIR} 下未找到任何任务目录，拒绝通过（判据失效）。")
        return 2

    print(f"[traceability] 基线 {base}，待检 {len(commits)} 个提交，已知任务 {len(known)} 个。")

    problems: list[str] = []
    for sha in commits:
        message = message_of(sha)
        subject = message.splitlines()[0] if message else ""
        short = sha[:8]

        match = REFS_RE.search(message)
        if not match:
            problems.append(f"{short} 未在提交信息中引用任务（缺 `Refs: TASK-NNN`）：{subject}")
            continue

        ids = {f"TASK-{n}" for n in TASK_ID_RE.findall(match.group(1))}
        missing = sorted(i for i in ids if i not in known)
        if missing:
            problems.append(
                f"{short} 引用了不存在的任务 {', '.join(missing)}（{TASKS_DIR}/*/ 下无对应目录）：{subject}"
            )
            continue

        if args.verbose:
            print(f"  OK   {short} {', '.join(sorted(ids))}  {subject}")

    if problems:
        print("\n[traceability] FAIL —— 以下提交不满足可追溯要求：")
        for problem in problems:
            print(f"  - {problem}")
        print(
            "\n修正方式：`git commit --amend` 或 `git rebase -i` 补 footer（`Refs: TASK-NNN`），"
            "或在任务目录中补建对应任务。**不得**通过放宽本检查来变绿。"
        )
        return 1

    print(f"[traceability] PASS —— {len(commits)} 个提交均引用了真实存在的任务。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
