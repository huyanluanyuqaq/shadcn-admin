#!/usr/bin/env python3
"""
create_from_template.py — 从模板仓库快速创建新项目并接入 GitHub

用法:
    方式 A：命令行参数
        python shared/scripts/create_from_template.py my-project \
            --github-user huyanluanyuqaq \
            --repo my-project \
            [--target /path/to/projects] \
            [--description "项目描述"] \
            [--tech-stack "技术栈"] \
            [--owner "负责人"] \
            [--yes] \
            [--no-push]

    方式 B：交互式输入
        python shared/scripts/create_from_template.py --interactive

行为:
    1. 校验项目名（slug 格式：小写字母、数字、连字符）
    2. 复制模板仓库到目标目录（默认 <target>/<name>）
    3. 替换已知占位符（项目名、描述、技术栈、日期等）
    4. 初始化 Git 仓库 + 首次提交
    5. 配置 GitHub 远程地址（git@github.com:<user>/<repo>.git）
    6. 可选：自动推送到 GitHub（默认开启，--no-push 禁用）
    7. 打印后续步骤与手动操作清单

设计原则:
    - 模板仓库即本仓库（脚本位于模板仓库的 shared/scripts/ 下）
    - 目标项目独立 Git，与模板仓库无关
    - 默认 SSH 远程地址；如需 HTTPS 请手动改 remote
    - 推送前检查目标 GitHub 仓库是否存在（gh api），不存在则提示先建仓
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

# ---------------------------------------------------------------------------
# 路径约定：脚本位于 <template>/shared/scripts/ 下
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
TEMPLATE_ROOT = SCRIPT_DIR.parent.parent  # _workspace-template/
TEMPLATE_ASSETS = [
    ".agents",
    "templates",
    "shared",
    "AGENTS.md",
    "README.md",
    ".gitignore",
]

SLUG_RE = re.compile(r"^_?[a-z0-9]+(?:-[a-z0-9]+)*$")


def fail(msg: str) -> None:
    print(f"[ERROR] {msg}", file=sys.stderr)
    sys.exit(1)


def to_title(slug: str) -> str:
    return " ".join(word.capitalize() for word in slug.lstrip("_").split("-"))


def validate_name(name: str) -> None:
    if not SLUG_RE.match(name):
        fail(
            f"项目名 '{name}' 非法。\n"
            "  要求：小写字母 / 数字 / 连字符；可选前导下划线。\n"
            "  示例：my-project, api-gateway, _template-test"
        )
    if name.startswith("_") and name == "_":
        fail("项目名不得仅为下划线。")


def check_preconditions(target: Path) -> None:
    if not TEMPLATE_ROOT.is_dir():
        fail(f"模板仓库不存在：{TEMPLATE_ROOT}")
    if target.exists():
        fail(
            f"目标目录已存在：{target}\n"
            "  为避免覆盖，脚本不会继续。请换一个项目名，或手动处理。"
        )


def copy_template(target: Path) -> None:
    """复制模板仓库的框架资产到目标目录。"""
    for asset in TEMPLATE_ASSETS:
        src = TEMPLATE_ROOT / asset
        dst = target / asset
        if not src.exists():
            fail(f"模板资产缺失：{src}")
        if src.is_dir():
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)


def substitute_placeholders(target: Path, placeholders: dict[str, str]) -> int:
    """替换目标文件中的占位符。返回修改的文件数。"""
    changed = 0
    for path in target.rglob("*"):
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue

        original = text
        for key, value in placeholders.items():
            text = text.replace("{{" + key + "}}", value)

        if text != original:
            path.write_text(text, encoding="utf-8")
            changed += 1
    return changed


def init_git(target: Path) -> str:
    """初始化 Git 仓库并完成首次提交。返回当前 HEAD。"""
    subprocess.run(["git", "init", "-q"], cwd=target, check=True)
    subprocess.run(["git", "add"] + TEMPLATE_ASSETS, cwd=target, check=True)
    subprocess.run(
        ["git", "commit", "-q", "-m", "chore: initial project from workspace template"],
        cwd=target,
        check=True,
    )
    head = subprocess.check_output(
        ["git", "rev-parse", "--short", "HEAD"], cwd=target, text=True
    ).strip()
    return head


def github_repo_exists(github_user: str, repo: str) -> bool:
    """检查 GitHub 仓库是否已存在（通过 gh api）。"""
    try:
        subprocess.run(
            ["gh", "api", f"repos/{github_user}/{repo}"],
            check=True,
            capture_output=True,
            timeout=10,
        )
        return True
    except subprocess.CalledProcessError:
        return False
    except FileNotFoundError:
        print("  [warn] 未找到 gh CLI，跳过远端仓库存在性检查")
        return False
    except subprocess.TimeoutExpired:
        print("  [warn] gh api 超时，跳过远端仓库存在性检查")
        return False


def setup_remote(target: Path, github_user: str, repo: str) -> None:
    """配置 GitHub 远程地址（SSH）。"""
    remote_url = f"git@github.com:{github_user}/{repo}.git"
    subprocess.run(["git", "remote", "add", "origin", remote_url], cwd=target, check=True)
    print(f"  [ok] 远程地址已配置：{remote_url}")


def push_to_remote(target: Path) -> None:
    """推送到 GitHub 远端（当前分支 → main）。"""
    subprocess.run(["git", "branch", "-M", "main"], cwd=target, check=True)
    subprocess.run(["git", "push", "-u", "origin", "main"], cwd=target, check=True)
    print("  [ok] 已推送到 GitHub（main）")


def print_next_steps(
    name: str, target: Path, github_user: str, repo: str, pushed: bool
) -> None:
    rel = target.resolve()
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
    print(f"  2. 在 projects/README.md 的项目清单中登记该项目。")
    print()
    print(f"  3. 编写需求与架构：")
    print(f"       {rel}/docs/requirements/")
    print(f"       {rel}/docs/architecture/")
    print()
    print(f"  4. 创建第一个 Task：")
    print(f"       mkdir -p {rel}/tasks/backlog/TASK-001-<slug>/handoffs")
    print(f"       cp templates/task/TASK.md \\")
    print(f"          {rel}/tasks/backlog/TASK-001-<slug>/TASK.md")
    print()
    print(f"  5. 让 Agent 开始工作：先读 AGENTS.md，再读项目 AGENTS.md，再读 TASK.md。")
    print()
    if not pushed:
        print(f"  [待推送] 手动推送到 GitHub：")
        print(f"       cd {rel}")
        print(f"       git remote add origin git@github.com:{github_user}/{repo}.git")
        print(f"       git push -u origin main")
    print()


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="从模板仓库创建新项目并接入 GitHub",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "示例:\n"
            "  python create_from_template.py my-project \\\n"
            "      --github-user huyanluanyuqaq \\\n"
            "      --repo my-project\n"
            "\n"
            "  python create_from_template.py --interactive\n"
        ),
    )
    parser.add_argument("name", nargs="?", help="项目名（slug 格式，如 my-project）")
    parser.add_argument("--target", default=".", help="目标父目录（默认当前目录）")
    parser.add_argument("--github-user", default="", help="GitHub 用户名/组织名")
    parser.add_argument("--repo", default="", help="GitHub 仓库名（默认与项目名相同）")
    parser.add_argument("--description", "-d", default="", help="项目一句话描述")
    parser.add_argument("--tech-stack", "-t", default="", help="技术栈，如 'Python, FastAPI'")
    parser.add_argument("--owner", "-o", default="", help="负责人")
    parser.add_argument("--yes", "-y", action="store_true", help="跳过确认提示")
    parser.add_argument("--no-push", action="store_true", help="不自动推送到 GitHub")
    parser.add_argument("--interactive", "-i", action="store_true", help="交互式输入模式")
    return parser.parse_args(argv)


def interactive_input(args: argparse.Namespace) -> argparse.Namespace:
    """交互式收集缺失的参数。"""
    print("=== 从模板仓库创建新项目 ===\n")

    if not args.name:
        args.name = input("项目名（slug，如 my-project）：").strip()
    if not args.github_user:
        args.github_user = input("GitHub 用户名/组织名：").strip()
    if not args.repo:
        args.repo = input(f"GitHub 仓库名（默认 {args.name}）：").strip() or args.name
    if not args.description:
        args.description = input("项目描述（可选）：").strip()
    if not args.tech_stack:
        args.tech_stack = input("技术栈（可选）：").strip()
    if not args.owner:
        args.owner = input("负责人（可选）：").strip()

    return args


def main(argv: list[str]) -> int:
    args = parse_args(argv)

    # 交互式模式
    if args.interactive:
        args = interactive_input(args)

    # 校验必填参数
    if not args.name:
        fail("缺少项目名。使用 --interactive 或提供 <name> 参数。")
    if not args.github_user:
        fail("缺少 GitHub 用户名。使用 --interactive 或提供 --github-user。")
    if not args.repo:
        args.repo = args.name

    validate_name(args.name)
    name: str = args.name
    github_user: str = args.github_user
    repo: str = args.repo
    target_parent = Path(args.target).resolve()
    target = target_parent / name

    check_preconditions(target)

    # 占位符
    placeholders = {
        "PROJECT_NAME": to_title(name),
        "PROJECT_DESCRIPTION": args.description or "{{PROJECT_DESCRIPTION}}",
        "TECH_STACK": args.tech_stack or "{{TECH_STACK}}",
        "project-slug": name,
        "owner": args.owner or "{{OWNER}}",
        "YYYY-MM-DD": date.today().isoformat(),
        "0.1.0": "0.1.0",
    }

    # 确认
    if not args.yes:
        print(f"将从模板仓库创建项目：")
        print(f"  项目名：{name}")
        print(f"  目标：{target}")
        print(f"  GitHub：{github_user}/{repo}")
        print(f"  自动推送：{'是' if not args.no_push else '否'}")
        confirm = input("\n确认？[Y/n] ").strip().lower()
        if confirm and confirm != "y":
            print("已取消")
            return 0

    # 1. 复制模板
    print(f"\n[1/5] 复制模板资产 → {target}")
    copy_template(target)
    print(f"  [ok] 已复制 {len(TEMPLATE_ASSETS)} 项资产")

    # 2. 替换占位符
    print("[2/5] 替换占位符")
    changed = substitute_placeholders(target, placeholders)
    print(f"  [ok] 已替换 {changed} 个文件")

    # 3. Git 初始化
    print("[3/5] 初始化 Git 仓库")
    head = init_git(target)
    print(f"  [ok] 首次提交完成（HEAD: {head}）")

    # 4. 配置远程
    print("[4/5] 配置 GitHub 远程地址")
    setup_remote(target, github_user, repo)

    # 5. 推送
    pushed = False
    if not args.no_push:
        print("[5/5] 推送到 GitHub")
        # 检查仓库是否存在
        if github_repo_exists(github_user, repo):
            try:
                push_to_remote(target)
                pushed = True
            except subprocess.CalledProcessError as exc:
                print(f"  [warn] 推送失败：{exc}")
                print("  请检查 SSH 密钥和仓库权限后手动推送：")
                print(f"    cd {target}")
                print(f"    git push -u origin main")
        else:
            print(f"  [warn] GitHub 仓库 {github_user}/{repo} 不存在")
            print("  请先在 GitHub 创建仓库（建议 private），然后手动推送：")
            print(f"    cd {target}")
            print(f"    git remote set-url origin git@github.com:{github_user}/{repo}.git")
            print(f"    git push -u origin main")
    else:
        print("[5/5] 跳过自动推送（--no-push）")

    print_next_steps(name, target, github_user, repo, pushed)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
