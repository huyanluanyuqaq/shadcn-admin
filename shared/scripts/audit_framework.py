#!/usr/bin/env python3
"""框架自检（Framework Audit）。

对 Workspace 的规则、协议、模板做**本地可跑、无网络**的一致性检查。

设计原则：
  - 只用标准库。缺可选依赖时降级并**明确报告跳过**，不假装检查过。
  - 只报告，不修改任何文件。
  - FAIL 表示「确定的问题」；WARN 表示「需人工复核」。

用法：
  python shared/scripts/audit_framework.py
  python shared/scripts/audit_framework.py --root E:/NDLDSN-WORKSPACE
  python shared/scripts/audit_framework.py --json
  python shared/scripts/audit_framework.py --only A6,A7

退出码：存在 FAIL 时为 1，否则为 0。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

PASS, FAIL, WARN, SKIP = "PASS", "FAIL", "WARN", "SKIP"

IGNORE_DIRS = {".git", "node_modules", "dist", "build", ".next", "coverage", ".venv", "venv"}

# A9 的状态词表白名单（来源：.agents/protocols/task-lifecycle.md §3）
KNOWN_STATES = {
    "BACKLOG", "READY", "ACTIVE", "DESIGN", "BLOCKED",
    "CHANGES_REQUESTED", "TEST_FAILED", "REQUIREMENT_CHANGED",
    "REVIEW", "DONE", "CANCELLED",
}

# A6 的检查范围刻意不含 templates/（模板本就应含占位符）与 projects/（项目自有内容）

# A7 明文密钥特征
SECRET_PATTERNS = [
    (r"ghp_[A-Za-z0-9]{20,}", "GitHub personal access token"),
    (r"github_pat_[A-Za-z0-9_]{20,}", "GitHub fine-grained token"),
    (r"gho_[A-Za-z0-9]{20,}", "GitHub OAuth token"),
    (r"AKIA[0-9A-Z]{16}", "AWS access key id"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "private key block"),
    (r"sk-[A-Za-z0-9]{24,}", "generic secret key"),
    (r"(?i)\b(password|passwd|secret|token)\s*[:=]\s*['\"][^'\"]{8,}['\"]", "hardcoded credential"),
]

# A13 PR 模板必须覆盖的字段（来源：github-collaboration.md §6）
PR_REQUIRED_FIELDS = [
    "关联任务", "变更摘要", "包含范围", "排除范围",
    "测试结果", "未执行的测试", "兼容性", "回滚方案", "遗留问题", "自检",
]


# --------------------------------------------------------------------------- #
# 工具
# --------------------------------------------------------------------------- #

def iter_files(root: Path, suffixes: tuple[str, ...]):
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if any(part in IGNORE_DIRS for part in p.parts):
            continue
        if p.suffix.lower() in suffixes:
            yield p


def rel(root: Path, p: Path) -> str:
    try:
        return p.relative_to(root).as_posix()
    except ValueError:
        return p.as_posix()


def read_text(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return ""


def strip_github_expressions(text: str) -> str:
    """移除 ${{ ... }} 形式的平台表达式，避免与模板占位符混淆。"""
    return re.sub(r"\$\{\{.*?\}\}", "", text, flags=re.S)


def normalize_placeholders(text: str) -> str:
    """把 {{...}} 归一化为合法标量，使含占位符的 YAML 仍可做结构解析。"""
    return re.sub(r"\{\{[^{}]*\}\}", "PLACEHOLDER", text)


def in_workspace_scope(root: Path, p: Path) -> bool:
    """工作空间级检查范围。

    只看规范与模板文件（.agents/、templates/、shared/ 与根目录文件），
    不含 projects/（项目自有内容）与备份目录（历史快照）。
    """
    r = rel(root, p)
    if r.startswith(("projects/", ".workbuddy-ai/", ".claude/", ".workbuddy/", ".git/",
                     ".agents/proposals/")):
        return False  # 项目自有内容、备份快照、未生效的设计草案
    return r.startswith((".agents/", "shared/", "templates/")) or "/" not in r


def is_repo_path(raw: str) -> bool:
    """判断反引号中的内容是否为「工作空间内的资产路径」。

    只认三类：`../` 开头的同级/上级引用，以及 `.agents/`、`templates/`、`shared/` 开头的路径。
    项目内路径（`docs/`、`tasks/`、`handoffs/`、`.github/`）与示例路径不在此校验。
    """
    if any(ch in raw for ch in ("<", ">", "{", "}", "*", "^", "\\", "[", "]")):
        return False
    if raw.startswith("../"):
        return True
    return raw.startswith((".agents/", "templates/", "shared/"))


class Result:
    def __init__(self, code: str, status: str, detail: str = "", items: list[str] | None = None):
        self.code = code
        self.status = status
        self.detail = detail
        self.items = items or []


# --------------------------------------------------------------------------- #
# 检查项
# --------------------------------------------------------------------------- #

def check_a1(root: Path) -> Result:
    """A1 文档内部链接有效性（限工作空间级文件）。"""
    broken: list[str] = []
    checked = 0
    pat = re.compile(r"(?<!\!)\[[^\]]*\]\(([^)\s]+)\)")
    for f in iter_files(root, (".md",)):
        if not in_workspace_scope(root, f):
            continue
        text = read_text(f)
        for m in pat.finditer(text):
            target = m.group(1).split("#")[0].strip()
            if not target or target.startswith(("http://", "https://", "mailto:", "#", "data:", "<", "/")):
                continue
            if "://" in target or any(ch in target for ch in "{}*[]^\\"):
                continue
            checked += 1
            if (f.parent / target).exists() or (root / target).exists():
                continue
            broken.append(f"{rel(root, f)} -> {target}")
    if broken:
        return Result("A1", FAIL, f"{len(broken)} 个失效链接（共检查 {checked} 个）", broken[:20])
    return Result("A1", PASS, f"无失效链接（共检查 {checked} 个）")


def check_a2(root: Path) -> Result:
    """A2 路径引用一致性：工作空间级文档中提到的仓库内路径应存在。"""
    missing: list[str] = []
    checked = 0
    pat = re.compile(r"`([^`\n]+\.(?:md|yml|yaml|py|sh|json))`")
    for f in iter_files(root, (".md",)):
        if not in_workspace_scope(root, f):
            continue
        if rel(root, f).startswith("templates/"):
            continue  # 模板中的路径是给目标项目用的，不在此校验
        for m in pat.finditer(read_text(f)):
            raw = m.group(1).strip()
            if not is_repo_path(raw):
                continue
            checked += 1
            if (root / raw).exists() or (f.parent / raw).exists():
                continue
            missing.append(f"{rel(root, f)} -> {raw}")
    if missing:
        return Result("A2", FAIL, f"{len(missing)} 处引用指向不存在的路径（共检查 {checked} 处）", missing[:20])
    return Result("A2", PASS, f"引用路径均存在（共检查 {checked} 处）")


def check_a3(root: Path) -> Result:
    """A3 YAML 可解析。"""
    try:
        import yaml  # type: ignore
    except ImportError:
        return Result("A3", SKIP, "未安装 PyYAML，跳过（请人工确认 YAML 合法性）")
    bad: list[str] = []
    files = list(iter_files(root / "templates", (".yml", ".yaml")))
    for f in files:
        # 模板含 {{...}} 占位符，先归一化为合法标量再做结构解析
        candidate = normalize_placeholders(read_text(f))
        try:
            yaml.safe_load(candidate)
        except Exception as e:  # noqa: BLE001
            bad.append(f"{rel(root, f)}: {type(e).__name__}: {e}")
    if not files:
        return Result("A3", SKIP, "未找到 YAML 文件")
    if bad:
        return Result("A3", FAIL, f"{len(bad)} 个 YAML 无法解析", bad[:20])
    return Result("A3", PASS, f"{len(files)} 个 YAML 均可解析（占位符已归一化）")


def check_a4(root: Path) -> Result:
    """A4 模板包内容与设计一致。"""
    gh = root / "templates" / "github"
    problems: list[str] = []
    required = ["PULL_REQUEST_TEMPLATE.md", "workflows/ci-node-pnpm.yml", "workflows/ci-generic.yml"]
    for name in required:
        if not (gh / name).exists():
            problems.append(f"缺少 {name}")
    forbidden = ["CODEOWNERS", "ISSUE_TEMPLATE"]
    for name in forbidden:
        if (gh / name).exists():
            problems.append(f"不应存在 {name}（无对应强制机制）")
    if problems:
        return Result("A4", FAIL, "模板包与设计不一致", problems)
    return Result("A4", PASS, "模板包内容正确（含 PR 模板，不含 CODEOWNERS / Issue 模板）")


def check_a5(root: Path) -> Result:
    """A5 工作流的触发条件与最小权限。"""
    wf_dir = root / "templates" / "github" / "workflows"
    problems: list[str] = []
    files = list(iter_files(wf_dir, (".yml", ".yaml"))) if wf_dir.exists() else []
    if not files:
        return Result("A5", SKIP, "未找到工作流模板")
    for f in files:
        t = read_text(f)
        if not re.search(r"^on:", t, re.M):
            problems.append(f"{rel(root, f)}: 缺少 on:")
        if not re.search(r"^permissions:", t, re.M):
            problems.append(f"{rel(root, f)}: 缺少 permissions:")
        if "pull_request" not in t:
            problems.append(f"{rel(root, f)}: 未在 pull_request 上触发（检查将无法构成门禁）")
    if problems:
        return Result("A5", FAIL, "工作流定义不符合要求", problems)
    return Result("A5", PASS, f"{len(files)} 个工作流模板触发与权限均合规")


def check_a6(root: Path) -> Result:
    """A6 占位符残留（仅工作空间规范文件：.agents/ 与根 AGENTS.md）。"""
    hits: list[str] = []
    checked = 0
    pat = re.compile(r"\{\{\s*[A-Za-z_][A-Za-z0-9_.\- ]*\}\}")
    targets: list[Path] = []
    agents_dir = root / ".agents"
    if agents_dir.exists():
        targets += [p for p in agents_dir.rglob("*.md") if p.is_file()]
    targets.append(root / "AGENTS.md")
    for f in targets:
        if not f.exists() or any(part in IGNORE_DIRS for part in f.parts):
            continue
        checked += 1
        text = strip_github_expressions(read_text(f))
        for line_no, line in enumerate(text.splitlines(), 1):
            for m in pat.finditer(line):
                hits.append(f"{rel(root, f)}:{line_no}: {m.group(0)}")
    if hits:
        return Result("A6", FAIL, f"{len(hits)} 处未替换的占位符", hits[:20])
    return Result("A6", PASS, f"规范文件中无未替换占位符（检查 {checked} 个文件）")


def check_a7(root: Path) -> Result:
    """A7 明文密钥扫描。"""
    hits: list[str] = []
    for f in iter_files(root, (".md", ".yml", ".yaml", ".json", ".py", ".sh", ".txt")):
        text = read_text(f)
        for line_no, line in enumerate(text.splitlines(), 1):
            for pat, label in SECRET_PATTERNS:
                if re.search(pat, line):
                    hits.append(f"{rel(root, f)}:{line_no}: {label}")
    if hits:
        return Result("A7", FAIL, f"{len(hits)} 处疑似明文凭据", hits[:20])
    return Result("A7", PASS, "未发现明文凭据特征")


def check_a8(root: Path) -> Result:
    """A8 能力矩阵与规则的一致性（弱检查）。"""
    cap = root / ".agents" / "protocols" / "github-capability-matrix.md"
    rule = root / ".agents" / "rules" / "github.md"
    missing: list[str] = []
    if not cap.exists():
        missing.append("缺少 .agents/protocols/github-capability-matrix.md")
    else:
        t = read_text(cap)
        for kw in ["不允许绕过", "自我批准", "未实测", "制度"]:
            if kw not in t:
                missing.append(f"github-capability-matrix.md 缺少关键概念: {kw}")
    if not rule.exists():
        missing.append("缺少 .agents/rules/github.md")
    if missing:
        return Result("A8", FAIL, "能力矩阵或规则不完整", missing)
    return Result("A8", PASS, "能力矩阵包含强制力边界、自锁风险与实测要求")


def check_a9(root: Path) -> Result:
    """A9 状态词表一致性。"""
    suspicious: list[str] = []
    targets = [
        root / ".agents" / "protocols" / "dual-agent-model.md",
        root / ".agents" / "protocols" / "github-collaboration.md",
        root / ".agents" / "protocols" / "github-capability-matrix.md",
        root / ".agents" / "rules" / "github.md",
    ]
    allow = {"I1", "I2", "C1", "C12", "L1", "L2", "L3", "PR", "CI", "GH", "API", "URL", "OK",
             "N1", "N2", "N3", "ADR", "V1", "V2", "V3", "V4", "V5"}
    pat = re.compile(r"`([A-Z][A-Z_]{2,})`")
    for f in targets:
        if not f.exists():
            continue
        for line_no, line in enumerate(read_text(f).splitlines(), 1):
            for m in pat.finditer(line):
                token = m.group(1)
                if token in KNOWN_STATES or token in allow:
                    continue
                suspicious.append(f"{rel(root, f)}:{line_no}: {token}")
    if suspicious:
        return Result("A9", WARN, f"{len(suspicious)} 个大写标识符不在已知状态词表内，请人工确认", suspicious[:20])
    return Result("A9", PASS, "未发现越界状态命名")


def check_a10(root: Path) -> Result:
    """A10 规则引用完整性：协议/规则之间的交叉引用应可解析。"""
    missing: list[str] = []
    ref_pat = re.compile(r"`((?:\.\./)*(?:[a-zA-Z0-9_\-]+/)*[a-zA-Z0-9_\-]+\.md)`")
    for sub in ("protocols", "rules"):
        d = root / ".agents" / sub
        if not d.exists():
            continue
        for f in d.glob("*.md"):
            for m in ref_pat.finditer(read_text(f)):
                raw = m.group(1)
                if not is_repo_path(raw):
                    continue  # 纯文件名、项目内路径与示例不在此校验
                if (f.parent / raw).exists() or (root / raw).exists():
                    continue
                missing.append(f"{rel(root, f)} -> {raw}")
    if missing:
        return Result("A10", FAIL, f"{len(missing)} 处交叉引用无法解析", missing[:20])
    return Result("A10", PASS, "协议与规则间的交叉引用均可解析")


def check_a11(root: Path) -> Result:
    """A11 CI 作业名与文档声明的必需检查名一致。"""
    wf_dir = root / "templates" / "github" / "workflows"
    problems: list[str] = []
    files = list(iter_files(wf_dir, (".yml", ".yaml"))) if wf_dir.exists() else []
    if not files:
        return Result("A11", SKIP, "未找到工作流模板")
    for f in files:
        t = read_text(f)
        if not re.search(r"^\s{2}(verify)\s*:", t, re.M):
            problems.append(f"{rel(root, f)}: 缺少固定作业名 verify")
    if problems:
        return Result("A11", FAIL, "工作流作业名与文档约定不一致", problems)
    return Result("A11", PASS, "工作流均使用固定作业名 verify（与必需检查约定一致）")


def check_a12(root: Path) -> Result:
    """A12 审查制度的可执行性。"""
    collab = root / ".agents" / "protocols" / "github-collaboration.md"
    dual = root / ".agents" / "protocols" / "dual-agent-model.md"
    problems: list[str] = []
    if not collab.exists():
        problems.append("缺少 github-collaboration.md")
    else:
        t = read_text(collab)
        for kw in ["回写", "handoffs/", "不同的会话或实例"]:
            if kw not in t:
                problems.append(f"github-collaboration.md 缺少强制条款: {kw}")
    if not dual.exists():
        problems.append("缺少 dual-agent-model.md")
    else:
        t = read_text(dual)
        for kw in ["实现者 ≠ 批准者", "平台不强制", "自我审查"]:
            if kw not in t:
                problems.append(f"dual-agent-model.md 缺少强制条款: {kw}")
    if problems:
        return Result("A12", FAIL, "审查制度缺少可执行条款", problems)
    return Result("A12", PASS, "审查回写与独立性披露条款齐备")


def check_a13(root: Path) -> Result:
    """A13 交付请求模板字段覆盖。"""
    tpl = root / "templates" / "github" / "PULL_REQUEST_TEMPLATE.md"
    if not tpl.exists():
        return Result("A13", FAIL, "缺少交付请求模板")
    text = read_text(tpl)
    missing = [f for f in PR_REQUIRED_FIELDS if f not in text]
    if missing:
        return Result("A13", FAIL, f"模板缺少 {len(missing)} 个必备字段", missing)
    return Result("A13", PASS, f"模板覆盖全部 {len(PR_REQUIRED_FIELDS)} 类必备字段")


CHECKS = [
    check_a1, check_a2, check_a3, check_a4, check_a5, check_a6, check_a7,
    check_a8, check_a9, check_a10, check_a11, check_a12, check_a13,
]


# --------------------------------------------------------------------------- #
# 入口
# --------------------------------------------------------------------------- #

def main() -> int:
    ap = argparse.ArgumentParser(description="Workspace 框架自检（只读、无网络）")
    ap.add_argument("--root", default=None, help="工作空间根目录")
    ap.add_argument("--json", action="store_true", help="以 JSON 输出")
    ap.add_argument("--only", default=None, help="只运行指定检查，如 A6,A7")
    args = ap.parse_args()

    root = Path(args.root).resolve() if args.root else Path(__file__).resolve().parents[2]
    if not root.exists():
        print(f"[ERROR] 根目录不存在: {root}", file=sys.stderr)
        return 2

    only = {s.strip().upper() for s in args.only.split(",")} if args.only else None
    results: list[Result] = []
    for fn in CHECKS:
        code = fn.__doc__.split()[0]  # type: ignore[union-attr]
        if only and code not in only:
            continue
        try:
            results.append(fn(root))
        except Exception as e:  # noqa: BLE001
            results.append(Result(code, FAIL, f"检查内部错误: {type(e).__name__}: {e}"))

    if args.json:
        print(json.dumps(
            {"root": root.as_posix(),
             "results": [{"code": r.code, "status": r.status, "detail": r.detail, "items": r.items}
                         for r in results]},
            ensure_ascii=False, indent=2))
    else:
        print(f"框架自检 · 根目录: {root.as_posix()}")
        print("-" * 72)
        for r in results:
            print(f"[{r.status:<4}] {r.code}  {r.detail}")
            for it in r.items:
                print(f"         · {it}")
        print("-" * 72)
        counts = {s: sum(1 for r in results if r.status == s) for s in (PASS, FAIL, WARN, SKIP)}
        print(f"PASS={counts[PASS]}  FAIL={counts[FAIL]}  WARN={counts[WARN]}  SKIP={counts[SKIP]}")

    return 1 if any(r.status == FAIL for r in results) else 0


if __name__ == "__main__":
    sys.exit(main())
