#!/usr/bin/env python3
"""audit-project.py — 项目级框架合规审计。

对单个项目检查框架资产的在位性、一致性、任务档案规范性与安全问题。
**本地可跑、无网络、只报告不修改。**

用法：
  python shared/scripts/audit-project.py                    # 审计所有 projects/*
  python shared/scripts/audit-project.py --project <name>   # 审计单个项目
  python shared/scripts/audit-project.py --json

退出码：存在 FAIL 时为 1，否则为 0。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

PASS, FAIL, WARN, SKIP = "PASS", "FAIL", "WARN", "SKIP"

_SCRIPT = Path(__file__).resolve()
# 兼容两种布局：
#   <repo>/shared/scripts/audit-project.py  -> repo 根在上两级
#   <repo>/scripts/audit-project.py         -> repo 根在上一级
REPO_ROOT = _SCRIPT.parent.parent
if _SCRIPT.parent.parent.name == "shared":
    REPO_ROOT = _SCRIPT.parent.parent.parent
# Workspace 模式下的 projects 目录（仅当本脚本位于 agent-framework 时有效）
PROJECTS_DIR = REPO_ROOT.parent / "projects"


def central_version_file(audit_root: Path) -> Path | None:
    """定位中央规范的 framework-version.json（可能不存在于 Standalone 模式）。"""
    for cand in (
        audit_root.parent.parent / "agent-framework" / "framework-version.json",
        audit_root.parent / "agent-framework" / "framework-version.json",
    ):
        if cand.is_file():
            return cand
    return None

EXPECTED_SPECS = [
    "collaboration.md", "git.md", "github.md",
    "quality.md", "rule-precedence.md", "permissions.md", "change-safety.md",
]
LEGACY_DIRS = [".agents", "templates"]  # 迁移后应已不存在
TASK_STATES = {"backlog": {"BACKLOG", "READY"},
               "active": {"ACTIVE", "DESIGN", "BLOCKED", "CHANGES_REQUESTED",
                          "TEST_FAILED", "REQUIREMENT_CHANGED"},
               "review": {"REVIEW"}, "done": {"DONE", "CANCELLED"}}
ALL_STATES = set().union(*TASK_STATES.values())
SECRET_PATTERNS = [
    (r"ghp_[A-Za-z0-9]{20,}", "GitHub PAT"),
    (r"github_pat_[A-Za-z0-9_]{20,}", "GitHub fine-grained PAT"),
    (r"AKIA[0-9A-Z]{16}", "AWS access key"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "private key"),
    (r"sk-[A-Za-z0-9]{24,}", "generic secret"),
]
PLACEHOLDER_RE = re.compile(r"\{\{[A-Za-z0-9_]+\}\}")
WORKFLOW_DIR = ".github/workflows"


class Result:
    def __init__(self, cid, status, msg, detail=None):
        self.cid, self.status, self.msg, self.detail = cid, status, msg, detail or []

    def render(self):
        icon = {PASS: "[PASS]", FAIL: "[FAIL]", WARN: "[WARN]", SKIP: "[SKIP]"}[self.status]
        out = f"{icon} {self.cid}  {self.msg}"
        for d in self.detail[:10]:
            out += f"\n         - {d}"
        return out


def read(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return ""


# --------------------------------------------------------------------------- #

def a1_assets(root: Path) -> Result:
    d = root / ".agent-framework"
    if not d.is_dir():
        return Result("A1", FAIL, f"缺少 .agent-framework/ 目录", [str(d)])
    missing = [f for f in EXPECTED_SPECS if not (d / f).is_file()]
    if missing:
        return Result("A1", FAIL, f".agent-framework/ 缺少 {len(missing)} 个规范文件", missing)
    vf = root / "framework-version.json"
    if not vf.is_file():
        return Result("A1", FAIL, "缺少 framework-version.json")
    return Result("A1", PASS, f".agent-framework/ 7 篇规范 + framework-version.json 均在位")


def a2_version(root: Path) -> Result:
    try:
        proj = json.loads((root / "framework-version.json").read_text(encoding="utf-8"))
    except FileNotFoundError:
        return Result("A2", SKIP, "缺少 framework-version.json")
    except json.JSONDecodeError as e:
        return Result("A2", FAIL, f"framework-version.json 不是合法 JSON：{e}")

    central_file = central_version_file(root)
    if central_file is None or central_file.resolve() == (root / "framework-version.json").resolve():
        return Result("A2", WARN, f"无法定位中央规范版本文件，仅校验本项目版本 v{proj.get('version')} 格式合法",
                      ["Standalone 模式下无法与中央仓比对版本"])
    try:
        central = json.loads(central_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        return Result("A2", WARN, f"中央版本文件不可读：{e}")
    if proj.get("source") != central.get("source"):
        return Result("A2", WARN, "source 与中央仓不一致",
                      [f"项目={proj.get('source')}", f"中央={central.get('source')}"])
    if proj.get("version") != central.get("version"):
        return Result("A2", WARN, f"版本落后：项目 v{proj.get('version')} < 中央 v{central.get('version')}",
                      ["运行 shared/scripts/sync-framework.py --project <name> 升级"])
    return Result("A2", PASS, f"版本一致 v{proj.get('version')}")


def a3_no_legacy(root: Path) -> Result:
    found = [d for d in LEGACY_DIRS if (root / d).is_dir()]
    if found:
        return Result("A3", WARN, f"仍存在迁移前目录：{found}",
                      ["确认内容已由 .agent-framework/ 取代后删除"])
    return Result("A3", PASS, "无迁移前遗留目录")


def a4_task_consistency(root: Path) -> Result:
    problems, checked = [], 0
    for state, allowed in TASK_STATES.items():
        base = root / "tasks" / state
        if not base.is_dir():
            continue
        for d in sorted(base.iterdir()):
            if not d.is_dir():
                continue
            tf = d / "TASK.md"
            if not tf.is_file():
                continue
            checked += 1
            text = read(tf)
            m = re.search(r"^Status:\s*([A-Z_]+)", text, re.M)
            if not m:
                problems.append(f"{d.name}: 无 Status 字段")
                continue
            st = m.group(1)
            if st not in ALL_STATES:
                problems.append(f"{d.name}: 非法状态 {st}")
            elif st not in allowed:
                problems.append(f"{d.name}: Status={st} 但位于 tasks/{state}/")
            if not re.search(r"^Owner:", text, re.M):
                problems.append(f"{d.name}: 无 Owner 字段")
    if not checked:
        return Result("A4", SKIP, "未找到任务档案")
    if problems:
        return Result("A4", FAIL, f"{len(problems)} 处状态/字段问题（共 {checked} 个档案）", problems)
    return Result("A4", PASS, f"{checked} 个档案的 Status 与目录一致、Owner 齐全")


# A5 编号豁免清单。
# 纪律：每条必须带【理由】与【登记日期】；审计输出会报告豁免情况。
# 新增豁免需人类批准 —— 不得为了让门禁变绿而随意登记。
DUPLICATE_ID_EXEMPTIONS = {
    "045": {
        "reason": "TASK-045-docker-pipeline-hardening 与 TASK-045-review-record-naming "
                  "编号撞车，2026-10-21 裁决允许共存（承自原 F9 门禁 HD-1 白名单）",
        "date": "2026-10-21",
    },
}


def a5_task_ids(root: Path) -> Result:
    ids: dict[str, list[str]] = {}
    base = root / "tasks"
    if not base.is_dir():
        return Result("A5", SKIP, "无 tasks/ 目录")
    for tf in sorted(base.rglob("TASK.md")):
        m = re.match(r"TASK-(\d+)-", tf.parent.name)
        if m:
            ids.setdefault(m.group(1), []).append(tf.parent.name)
    if not ids:
        return Result("A5", SKIP, "未找到可解析编号的任务档案")

    dupes = {k: v for k, v in ids.items() if len(v) > 1}
    unexempted = {k: v for k, v in dupes.items() if k not in DUPLICATE_ID_EXEMPTIONS}
    nums = sorted(int(k) for k in ids)
    gaps = [n for n in range(nums[0], nums[-1] + 1) if str(n).zfill(3) not in ids]

    detail = []
    if unexempted:
        detail.append(f"未登记的编号重复：{unexempted}")
    for k in dupes:
        if k in DUPLICATE_ID_EXEMPTIONS:
            e = DUPLICATE_ID_EXEMPTIONS[k]
            detail.append(f"编号 {k} 重复（已登记豁免 {e['date']}）：{e['reason']}")
    if gaps:
        detail.append(f"编号断档 {gaps}（任务取消/合并/移除可致，WARN 不阻断）")

    if unexempted:
        return Result("A5", FAIL, f"{len(unexempted)} 组未登记的编号重复", detail)
    if gaps or dupes:
        return Result("A5", WARN,
                      f"编号唯一（{len(ids)} 个）；断档 {len(gaps)} 处、已登记豁免 {len(dupes)} 组",
                      detail)
    return Result("A5", PASS, f"{len(ids)} 个编号唯一且无断档（{nums[0]:03d}–{nums[-1]:03d}）")


def a6_secrets(root: Path) -> Result:
    targets = [p for p in root.rglob("*")
               if p.is_file() and "node_modules" not in p.parts and ".git" not in p.parts
               and p.suffix in {".md", ".py", ".ts", ".tsx", ".js", ".json", ".yml", ".yaml", ".sh", ".env"}]
    found = []
    for p in targets:
        for i, line in enumerate(read(p).splitlines(), 1):
            for pat, name in SECRET_PATTERNS:
                if re.search(pat, line):
                    found.append(f"{p.relative_to(root)}:{i} {name}")
    if found:
        return Result("A6", FAIL, f"{len(found)} 处疑似明文密钥", found)
    return Result("A6", PASS, f"未发现明文密钥（扫描 {len(targets)} 个文件）")


def a7_placeholders(root: Path) -> Result:
    targets = []
    if (root / ".agent-framework").is_dir():
        targets += [p for p in (root / ".agent-framework").rglob("*.md")]
    # 只查项目根的 AGENTS.md；templates/ 是模板，本就应含占位符，故排除
    targets += [p for p in root.glob("AGENTS.md")]
    found = []
    for p in targets:
        for i, line in enumerate(read(p).splitlines(), 1):
            if PLACEHOLDER_RE.search(line):
                found.append(f"{p.relative_to(root)}:{i}")
    if found:
        return Result("A7", WARN, f"{len(found)} 处占位符残留", found)
    return Result("A7", PASS, f"无占位符残留（检查 {len(targets)} 个文件）")


def a8_workflows(root: Path) -> Result:
    wd = root / WORKFLOW_DIR
    if not wd.is_dir():
        return Result("A8", SKIP, "无 .github/workflows/")
    bad, checked = [], 0
    for f in sorted(wd.glob("*.yml")):
        checked += 1
        text = read(f)
        if not re.search(r"^on:", text, re.M):
            bad.append(f"{f.name}: 无 on: 触发器")
        if not re.search(r"^\s*permissions:", text, re.M):
            bad.append(f"{f.name}: 无 permissions: 声明（违反最小权限）")
    if bad:
        return Result("A8", FAIL, f"{len(bad)} 处不合格（共 {checked} 个工作流）", bad)
    return Result("A8", PASS, f"{checked} 个工作流均已声明 on 与 permissions")


def a9_pr_template(root: Path) -> Result:
    pt = root / ".github" / "PULL_REQUEST_TEMPLATE.md"
    if not pt.is_file():
        return Result("A9", WARN, "缺少 PR 模板")
    required = ["关联任务", "变更摘要", "测试结果", "回滚方案", "遗留问题"]
    missing = [k for k in required if k not in read(pt)]
    if missing:
        return Result("A9", FAIL, f"PR 模板缺少字段：{missing}")
    return Result("A9", PASS, "PR 模板覆盖必需字段")


CHECKS = [a1_assets, a2_version, a3_no_legacy, a4_task_consistency,
          a5_task_ids, a6_secrets, a7_placeholders, a8_workflows, a9_pr_template]


def audit_project(root: Path) -> list[Result]:
    if not root.is_dir():
        return [Result("A0", FAIL, f"项目目录不存在：{root}")]
    return [c(root) for c in CHECKS]


def main() -> int:
    ap = argparse.ArgumentParser(description="项目级框架合规审计")
    ap.add_argument("--project", help="只审计指定项目")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    if args.project:
        if not PROJECTS_DIR.is_dir():
            print(f"未找到 projects 目录：{PROJECTS_DIR}", file=sys.stderr)
            return 1
        roots = [PROJECTS_DIR / args.project]
    elif REPO_ROOT.parent.name == "projects":
        # 项目内运行：审计本仓库自身
        roots = [REPO_ROOT]
        print(f"模式：项目内审计（{REPO_ROOT.name}）")
    elif PROJECTS_DIR.is_dir():
        # Workspace 模式：审计全部项目
        roots = sorted(q for q in PROJECTS_DIR.iterdir()
                       if q.is_dir() and (q / ".git").is_dir())
        print(f"模式：Workspace 审计（{PROJECTS_DIR}）")
    else:
        # Standalone 兜底：审计本仓库自身
        roots = [REPO_ROOT]
        print(f"模式：Standalone 审计（{REPO_ROOT.name}）")
    if not roots:
        print("未找到可审计的项目", file=sys.stderr)
        return 1

    all_results, worst = [], PASS
    order = {FAIL: 0, WARN: 1, SKIP: 2, PASS: 3}
    for root in roots:
        rs = audit_project(root)
        all_results.append((root.name, rs))
        for r in rs:
            if order[r.status] < order[worst]:
                worst = r.status

    if args.json:
        print(json.dumps(
            {name: [{"id": r.cid, "status": r.status, "msg": r.msg, "detail": r.detail} for r in rs]
             for name, rs in all_results}, indent=2, ensure_ascii=False))
    else:
        for name, rs in all_results:
            print(f"\n########## {name} ##########")
            for r in rs:
                print(r.render())
        print("\n" + "=" * 60)
        counts = {s: sum(1 for _, rs in all_results for r in rs if r.status == s)
                  for s in (PASS, FAIL, WARN, SKIP)}
        print(f"PASS={counts[PASS]}  FAIL={counts[FAIL]}  WARN={counts[WARN]}  SKIP={counts[SKIP]}")
    return 1 if worst == FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
