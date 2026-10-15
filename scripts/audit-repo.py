#!/usr/bin/env python3
"""仓库级框架一致性审计（Repo Framework Audit）。

对**本仓库**的框架制品做只读、无网络、结果确定的检查，用于 CI 门禁。
它与随仓库版本化的框架自检 `shared/scripts/audit_framework.py` 分工：
本脚本是**仓库门禁**（目标稳定、随 CI 强制执行），后者是**框架全量自检**
（开发期本地运行）。门禁必须自持 —— 单独 clone 后无工作空间也能跑。

检查范围：交付请求模板字段、工作流触发与最小权限、占位符与明文密钥、
协作文档引用与链接、声明的必需检查名与作业名一致性，以及双 Agent
框架资产（`.agents/` / `templates/` / `shared/scripts/`）是否在位。

设计原则：
  - 只用标准库；不做 YAML 解析（避免引入依赖），只做文本与结构断言。
  - 只报告，不修改任何文件。
  - FAIL 表示「确定的问题」；WARN 表示「需人工复核」。
  - 不做需要网络的检查（如依赖漏洞审计）——那类检查会引入不可控噪声。

用法：
  python3 scripts/audit-repo.py
  python3 scripts/audit-repo.py --json

退出码：存在 FAIL 时为 1，否则为 0。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

PASS, FAIL, WARN = "PASS", "FAIL", "WARN"

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_DIR = ROOT / ".github" / "workflows"
PR_TEMPLATE = ROOT / ".github" / "PULL_REQUEST_TEMPLATE.md"
AGENTS_MD = ROOT / "AGENTS.md"

# F5 检查的框架文档（刻意不含历史遗留下来的其它文档，避免历史死链干扰本门禁）
FRAMEWORK_DOCS = [
    AGENTS_MD,
    PR_TEMPLATE,
    ROOT / "docs" / "agent-collaboration.md",
    ROOT / "docs" / "git-workflow.md",
    ROOT / "docs" / "operations" / "github-capability.md",
]

# F1：PR 模板必须覆盖的字段（来源 docs/agent-collaboration.md §5）
PR_REQUIRED_FIELDS = [
    "关联任务", "变更摘要", "包含范围", "排除范围", "测试结果",
    "未执行的测试", "兼容性", "回滚方案", "遗留问题", "自检",
]

# F4 明文密钥特征
SECRET_PATTERNS = [
    (r"ghp_[A-Za-z0-9]{20,}", "GitHub personal access token"),
    (r"github_pat_[A-Za-z0-9_]{20,}", "GitHub fine-grained token"),
    (r"gho_[A-Za-z0-9]{20,}", "GitHub OAuth token"),
    (r"AKIA[0-9A-Z]{16}", "AWS access key id"),
    (r"sk-[A-Za-z0-9]{24,}", "generic secret key"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "private key block"),
]
SUSPECT_PATTERNS = [
    (r"(?i)\b(password|passwd|secret|token)\s*[:=]\s*['\"][^'\"]{8,}['\"]", "疑似硬编码凭据"),
]

# F3 允许保留的占位符（非框架残留）
ALLOWED_PLACEHOLDERS = [
    (re.compile(r"\{\{version\}\}"), "docker/metadata-action 的 semver 版本模式"),
]

# F6 声明表：| `作业名` | `工作流路径` | ... |
DECLARED_CHECK_ROW = re.compile(
    r"^\|\s*`([A-Za-z0-9_][A-Za-z0-9_-]*)`\s*\|"
    r"\s*`([^`]+\.ya?ml)`\s*\|",
    re.M,
)


class Result:
    def __init__(self, code: str, status: str, detail: str = "", items=None):
        self.code = code
        self.status = status
        self.detail = detail
        self.items = items or []


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return ""


def rel(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def strip_github_expressions(text: str) -> str:
    """移除 ${{ ... }} 形式的平台表达式。"""
    out = re.sub(r"\$\{\{.*?\}\}", "", text, flags=re.S)
    for pattern, _ in ALLOWED_PLACEHOLDERS:
        out = pattern.sub("", out)
    return out


def workflow_job_names(text: str) -> list[str]:
    """从工作流文本中取出顶层 `jobs:` 下的一级作业名（按缩进判定）。"""
    jobs: list[str] = []
    in_jobs = False
    for line in text.splitlines():
        if re.match(r"^jobs:\s*$", line):
            in_jobs = True
            continue
        if in_jobs:
            if re.match(r"^\S", line):  # 回到顶层键，jobs 段结束
                break
            m = re.match(r"^ {2}([A-Za-z0-9_-]+):\s*$", line)
            if m:
                jobs.append(m.group(1))
    return jobs


def has_top_level_key(text: str, key: str) -> bool:
    return re.search(rf"^{re.escape(key)}:", text, flags=re.M) is not None


# --------------------------------------------------------------------------- #
# 检查项
# --------------------------------------------------------------------------- #

def check_f1(_root: Path) -> Result:
    """F1 PR 模板字段完整性。"""
    if not PR_TEMPLATE.exists():
        return Result("F1", FAIL, f"缺少交付请求模板：{rel(PR_TEMPLATE)}")
    text = read_text(PR_TEMPLATE)
    missing = [f for f in PR_REQUIRED_FIELDS if f not in text]
    if missing:
        return Result("F1", FAIL, f"模板缺少 {len(missing)} 个必需字段", missing)
    return Result("F1", PASS, f"覆盖全部 {len(PR_REQUIRED_FIELDS)} 个必需字段")


def check_f2(_root: Path) -> Result:
    """F2 工作流触发与最小权限声明。"""
    if not WORKFLOW_DIR.is_dir():
        return Result("F2", FAIL, f"目录不存在：{rel(WORKFLOW_DIR)}")
    bad: list[str] = []
    checked = 0
    for path in sorted(WORKFLOW_DIR.glob("*.y*ml")):
        text = read_text(path)
        if not text:
            continue
        checked += 1
        if not has_top_level_key(text, "on"):
            bad.append(f"{rel(path)}：缺少 `on:` 触发声明")
        # permissions 可声明在工作流级或作业级（单作业工作流的作业级声明同样有效，
        # 且粒度更细）。此处接受任一形式，但不接受"完全未声明"。
        if not re.search(r"^\s*permissions:", text, flags=re.M):
            bad.append(f"{rel(path)}：缺少 `permissions:` 最小权限声明（工作流级或作业级）")
    if bad:
        return Result("F2", FAIL, f"{len(bad)} 处不合格（共检查 {checked} 个工作流）", bad)
    return Result("F2", PASS, f"全部 {checked} 个工作流均已声明 on 与 permissions")


def check_f3(_root: Path) -> Result:
    """F3 框架制品无模板占位符残留。"""
    targets = [p for p in FRAMEWORK_DOCS if p.exists()]
    targets += [p for p in sorted(WORKFLOW_DIR.glob("*.y*ml")) if p.exists()]
    found: list[str] = []
    for path in targets:
        text = strip_github_expressions(read_text(path))
        for i, line in enumerate(text.splitlines(), start=1):
            if "{{" in line or "TODO-PLACEHOLDER" in line:
                found.append(f"{rel(path)}:{i}: {line.strip()[:80]}")
    if found:
        return Result("F3", FAIL, f"{len(found)} 处占位符残留", found)
    return Result("F3", PASS, f"无占位符残留（共检查 {len(targets)} 个文件）")


def check_f4(_root: Path) -> Result:
    """F4 框架制品无明文密钥。"""
    targets = [p for p in FRAMEWORK_DOCS if p.exists()]
    targets += [p for p in sorted(WORKFLOW_DIR.glob("*.y*ml")) if p.exists()]
    targets.append(ROOT / "scripts" / "audit-repo.py")
    hard: list[str] = []
    suspect: list[str] = []
    for path in targets:
        text = read_text(path)
        for pattern, label in SECRET_PATTERNS:
            for m in re.finditer(pattern, text):
                hard.append(f"{rel(path)}: {label}")
        for pattern, label in SUSPECT_PATTERNS:
            for m in re.finditer(pattern, text):
                suspect.append(f"{rel(path)}: {label}: {m.group(0)[:60]}")
    if hard:
        return Result("F4", FAIL, f"{len(hard)} 处明文密钥", hard)
    if suspect:
        return Result("F4", WARN, f"{len(suspect)} 处疑似凭据，需人工复核", suspect)
    return Result("F4", PASS, f"未发现明文密钥（共检查 {len(targets)} 个文件）")


def check_f5(_root: Path) -> Result:
    """F5 协作文档存在、被入口引用且内部链接有效。"""
    problems: list[str] = []

    for path in FRAMEWORK_DOCS:
        if not path.exists():
            problems.append(f"缺失框架文档：{rel(path)}")
    if problems:
        return Result("F5", FAIL, f"{len(problems)} 个问题", problems)

    agents = read_text(AGENTS_MD)
    for path in FRAMEWORK_DOCS[2:]:
        if rel(path) not in agents:
            problems.append(f"AGENTS.md 未引用：{rel(path)}")

    link_re = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
    for path in FRAMEWORK_DOCS:
        for raw in link_re.findall(read_text(path)):
            target = raw.strip()
            if target.startswith(("http://", "https://", "mailto:", "#")):
                continue
            target = target.split("#", 1)[0].strip()
            if not target:
                continue
            if not (path.parent / target).resolve().exists():
                problems.append(f"{rel(path)}：链接目标不存在 -> {raw}")

    if problems:
        return Result("F5", FAIL, f"{len(problems)} 个问题", problems)
    return Result("F5", PASS, f"{len(FRAMEWORK_DOCS)} 个框架文档存在、被引用且链接有效")


def check_f6(_root: Path) -> Result:
    """F6 声明的必需检查名与工作流实际作业名一致。"""
    if not AGENTS_MD.exists():
        return Result("F6", FAIL, "缺少 AGENTS.md")
    declared = DECLARED_CHECK_ROW.findall(read_text(AGENTS_MD))
    if not declared:
        return Result("F6", FAIL, "AGENTS.md 未声明必需检查（未找到「`作业名` | `工作流`」表行）")

    problems: list[str] = []
    for job, wf in declared:
        wf_path = ROOT / wf
        if not wf_path.exists():
            problems.append(f"声明的工作流不存在：{wf}（对应作业 {job}）")
            continue
        actual = workflow_job_names(read_text(wf_path))
        if job not in actual:
            problems.append(f"{wf} 中不存在作业 `{job}`（实际：{', '.join(actual) or '无'}）")
    if problems:
        return Result("F6", FAIL, f"{len(problems)} 处不一致", problems)
    return Result("F6", PASS, f"{len(declared)} 个必需检查名与工作流作业名一致")


def check_f7(_root: Path) -> Result:
    """F7 双 Agent 框架资产在位（TASK-039 接入后的门禁）。"""
    required = [
        ROOT / ".agents" / "roles",
        ROOT / ".agents" / "workflows",
        ROOT / ".agents" / "rules",
        ROOT / ".agents" / "protocols",
        ROOT / ".agents" / "rules" / "security.md",
        ROOT / ".agents" / "protocols" / "dual-agent-model.md",
        ROOT / "templates" / "task" / "TASK.md",
        ROOT / "templates" / "handoff" / "HANDOFF.md",
        ROOT / "templates" / "adr" / "ADR.md",
        ROOT / "templates" / "github" / "PULL_REQUEST_TEMPLATE.md",
        ROOT / "shared" / "scripts" / "audit_framework.py",
    ]
    missing = [rel(p) for p in required if not p.exists()]
    if missing:
        return Result("F7", FAIL, f"框架资产缺失 {len(missing)} 项", missing)
    return Result("F7", PASS, "双 Agent 框架资产在位（.agents/ 四目录 + templates/ 四模板 + shared/scripts 自检脚本）")


CHECKS = [check_f1, check_f2, check_f3, check_f4, check_f5, check_f6, check_f7]


def main() -> int:
    ap = argparse.ArgumentParser(description="仓库级框架一致性审计（只读、无网络）")
    ap.add_argument("--json", action="store_true", help="以 JSON 输出")
    args = ap.parse_args()

    results = [fn(ROOT) for fn in CHECKS]

    if args.json:
        print(json.dumps(
            {"root": ROOT.as_posix(),
             "results": [{"code": r.code, "status": r.status, "detail": r.detail, "items": r.items}
                         for r in results]},
            ensure_ascii=False, indent=2))
    else:
        print(f"仓库级框架审计 @ {ROOT.as_posix()}\n")
        for r in results:
            print(f"[{r.status}] {r.code}  {r.detail}")
            for item in r.items:
                print(f"        - {item}")
        counted = {s: sum(1 for r in results if r.status == s) for s in (PASS, FAIL, WARN)}
        print(f"\nPASS={counted[PASS]} FAIL={counted[FAIL]} WARN={counted[WARN]}")

    return 1 if any(r.status == FAIL for r in results) else 0


if __name__ == "__main__":
    sys.exit(main())
