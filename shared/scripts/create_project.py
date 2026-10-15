#!/usr/bin/env python3
"""
create_project.py — 从 templates/project/ 创建新项目

用法:
    python shared/scripts/create_project.py <project-name> \
        [--description "..."] [--tech-stack "..."] [--owner "..."] [--git]

行为:
    1. 校验项目名（slug 格式：小写字母、数字、连字符）
    2. 检查目标目录不存在
    3. 复制 templates/project/ → projects/<name>/
    4. 替换已知占位符（{{PROJECT_NAME}} 等）
    5. 可选：git init + 首次提交
    6. 打印后续步骤

设计原则:
    - 简单、可靠、无副作用（不覆盖已存在目录）
    - 只替换"可自动填充"的占位符，保留需人工填写的（如 {{test command}}）
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

# --- 定位 Workspace 根目录（本文件位于 shared/scripts/ 下） ---
SCRIPT_DIR = Path(__file__).resolve().parent
WORKSPACE_ROOT = SCRIPT_DIR.parent.parent
TEMPLATE_DIR = WORKSPACE_ROOT / "templates" / "project"
PROJECTS_DIR = WORKSPACE_ROOT / "projects"

SLUG_RE = re.compile(r"^_?[a-z0-9]+(?:-[a-z0-9]+)*$")

# 可自动填充的占位符 → 值（在 main() 中填充）
AUTO_PLACEHOLDERS: dict[str, str] = {}


def fail(msg: str) -> None:
    print(f"[ERROR] {msg}", file=sys.stderr)
    sys.exit(1)


def to_title(slug: str) -> str:
    """my-project → My Project；_template-test → Template Test"""
    return " ".join(word.capitalize() for word in slug.lstrip("_").split("-"))


def validate_name(name: str) -> None:
    if not SLUG_RE.match(name):
        fail(
            f"项目名 '{name}' 非法。\n"
            "  要求：小写字母 / 数字 / 连字符；可选前导下划线（用于测试/临时项目）。\n"
            "  示例：my-project, api-gateway, _template-test"
        )
    if name.startswith("_") and name == "_":
        fail("项目名不得仅为下划线。")


def check_preconditions(target: Path) -> None:
    if not TEMPLATE_DIR.is_dir():
        fail(f"模板目录不存在：{TEMPLATE_DIR}")
    if target.exists():
        fail(
            f"目标目录已存在：{target}\n"
            "  为避免覆盖，脚本不会继续。请换一个项目名，或手动处理。"
        )


def copy_template(target: Path) -> None:
    shutil.copytree(TEMPLATE_DIR, target)


def substitute_placeholders(target: Path) -> int:
    """替换文件中的已知占位符。返回修改的文件数。"""
    changed = 0
    for path in target.rglob("*"):
        if not path.is_file():
            continue
        # 跳过二进制文件
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue

        original = text
        for key, value in AUTO_PLACEHOLDERS.items():
            text = text.replace("{{" + key + "}}", value)

        if text != original:
            path.write_text(text, encoding="utf-8")
            changed += 1
    return changed


def init_git(target: Path) -> None:
    try:
        subprocess.run(["git", "init", "-q"], cwd=target, check=True)
        subprocess.run(["git", "add", "-A"], cwd=target, check=True)
        subprocess.run(
            ["git", "commit", "-q", "-m", "chore: initial project scaffold"],
            cwd=target,
            check=True,
        )
        print("  [ok] Git 仓库已初始化并完成首次提交")
    except FileNotFoundError:
        print("  [warn] 未找到 git，跳过仓库初始化")
    except subprocess.CalledProcessError as exc:
        print(f"  [warn] Git 初始化失败：{exc}")


def print_next_steps(name: str, target: Path) -> None:
    rel = target.relative_to(WORKSPACE_ROOT)
    print()
    print("=" * 64)
    print(f"项目 '{name}' 创建成功：{rel}")
    print("=" * 64)
    print()
    print("后续步骤：")
    print()
    print(f"  1. 填写项目入口（替换剩余 {{{{...}}}} 占位符）：")
    print(f"       {rel}/AGENTS.md")
    print(f"       {rel}/README.md")
    print()
    print("  2. 在 projects/README.md 的项目清单中登记该项目。")
    print()
    print("  3. 编写需求与架构：")
    print(f"       {rel}/docs/requirements/")
    print(f"       {rel}/docs/architecture/")
    print()
    print("  4. 创建第一个 Task：")
    print(f"       mkdir -p {rel}/tasks/backlog/TASK-001-<slug>/handoffs")
    print(f"       cp templates/task/TASK.md "
          f"{rel}/tasks/backlog/TASK-001-<slug>/TASK.md")
    print()
    print("  5. 让 Agent 开始工作：先读 AGENTS.md，再读项目 AGENTS.md，再读 TASK.md。")
    print()


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="从 templates/project/ 创建新项目",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("name", help="项目名（slug 格式，如 my-project）")
    parser.add_argument("--description", "-d", default="", help="项目一句话描述")
    parser.add_argument("--tech-stack", "-t", default="", help="技术栈，如 'Python, FastAPI'")
    parser.add_argument("--owner", "-o", default="", help="负责人")
    parser.add_argument("--git", action="store_true", help="初始化 Git 仓库并首次提交")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    name: str = args.name

    validate_name(name)
    target = PROJECTS_DIR / name
    check_preconditions(target)

    description = args.description or f"{{{{PROJECT_DESCRIPTION}}}}"
    tech_stack = args.tech_stack or f"{{{{TECH_STACK}}}}"

    AUTO_PLACEHOLDERS.update(
        {
            "PROJECT_NAME": to_title(name),
            "PROJECT_DESCRIPTION": description,
            "TECH_STACK": tech_stack,
            "project-slug": name,
            "owner": args.owner or "{{OWNER}}",
            "YYYY-MM-DD": date.today().isoformat(),
            "0.1.0": "0.1.0",
        }
    )

    print(f"从模板创建项目：{name}")
    print(f"  模板：{TEMPLATE_DIR.relative_to(WORKSPACE_ROOT)}")
    print(f"  目标：{target.relative_to(WORKSPACE_ROOT)}")

    copy_template(target)
    print("  [ok] 模板已复制")

    changed = substitute_placeholders(target)
    print(f"  [ok] 已替换占位符（{changed} 个文件）")

    if args.git:
        init_git(target)

    print_next_steps(name, target)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
