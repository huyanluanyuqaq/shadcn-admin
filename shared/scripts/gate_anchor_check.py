#!/usr/bin/env python3
"""gate_anchor_check.py — TASK-065 外部锚点：审计脚本基线校验（执行体）。

背景：A14（`shared/scripts/audit-project.py` 内的脚本一致性判据）是**自引用检查**
—— 其校验逻辑位于被 `sync-framework.py` 全量覆盖的同一文件内
（`SYNC_SCRIPTS = ["audit-project.py"]`，`shutil.copy2` 中央 -> 项目）。一旦同步
执行（或中央仓被回退），旧脚本连同 A14 一并覆盖回来：A14 不存在、无需报警，
且旧版中 `sk-` 模式位于 SUSPECT，A6 由 FAIL 静默降为 WARN（TASK-064 双审查实证）。

本脚本把校验逻辑移到**被校验文件之外**，是外部锚点的执行体：

- 校验逻辑不在 `shared/scripts/audit-project.py` 内（Requirements 1）；
- 本文件虽位于 `shared/scripts/`，但**显式排除于同步范围之外**：`sync-framework.py`
  的 `SYNC_SCRIPTS = ["audit-project.py"]` 只同步那一个文件，本文件不在其列
  （Requirements 2；真实同步前后字节不变的实测见 TASK-065 档案 AC-4 探针）。
  见证作业 `anchor-witness`（ci.yml）另以登记哈希看护本文件不被改写。

三重一致性（缺一即 FAIL，fail-closed）：
  1. 实际脚本哈希 == 工作流登记的期望哈希（`gate-anchor.yml` 的
     `EXPECTED_AUDIT_SCRIPT_SHA256`）—— 检出「脚本被同步回退 / 直接替换」；
  2. 基线文件哈希 == 期望哈希（`.github/gate-anchor-baseline.txt`）——
     检出「只篡改一处锚点配置」；
  3. 基线文件哈希 == 实际脚本哈希 —— 与 1/2 共同构成闭环。

用法：
  python3 shared/scripts/gate_anchor_check.py \
      --expected <64 位十六进制> \
      [--script shared/scripts/audit-project.py] \
      [--baseline .github/gate-anchor-baseline.txt]

退出码：0 = 三方一致；1 = 任一不一致、文件缺失或参数非法。
只读：不执行、不修改被校验脚本，只计算其字节哈希。
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
from pathlib import Path

HEX64 = re.compile(r"^[0-9a-f]{64}$")


def emit_error(msg: str) -> None:
    """CI 内输出 GitHub 注解，本地输出可读前缀。"""
    if os.environ.get("GITHUB_ACTIONS") == "true":
        print(f"::error::gate-anchor: {msg}")
    else:
        print(f"[FAIL] gate-anchor: {msg}")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_baseline_hash(path: Path) -> str | None:
    """取基线文件中第一个 64 位十六进制串（注释行不得含 64 位十六进制）。"""
    if not path.is_file():
        return None
    m = re.search(r"[0-9a-f]{64}", path.read_text(encoding="utf-8", errors="replace"))
    return m.group(0) if m else None


def main() -> int:
    ap = argparse.ArgumentParser(description="TASK-065 外部锚点：审计脚本基线校验")
    ap.add_argument("--script", default="shared/scripts/audit-project.py",
                    help="被校验的审计脚本路径")
    ap.add_argument("--baseline", default=".github/gate-anchor-baseline.txt",
                    help="基线文件路径（与工作流期望哈希交叉校验）")
    ap.add_argument("--expected", required=True,
                    help="工作流登记的期望 SHA-256（64 位十六进制）")
    args = ap.parse_args()

    failures: list[str] = []
    expected = args.expected.strip().lower()
    if not HEX64.match(expected):
        emit_error(f"期望哈希格式非法：{args.expected!r}（须为 64 位十六进制）")
        return 1

    # 1) 实际脚本哈希
    script = Path(args.script)
    actual: str | None = None
    if not script.is_file():
        emit_error(f"被校验脚本缺失：{script}（审计脚本被删除？锚点不执行脚本，只校验其在位与哈希）")
        failures.append("script-missing")
    else:
        actual = sha256_hex(script.read_bytes())
        if actual != expected:
            emit_error(
                "审计脚本与已批准基线不一致（疑似被同步回退或直接替换）："
                f"actual={actual} expected={expected}"
            )
            failures.append("script-hash-mismatch")

    # 2) 基线文件与期望哈希交叉校验（两处锚点配置必须一致）
    baseline = Path(args.baseline)
    base_hash = read_baseline_hash(baseline)
    if base_hash is None:
        emit_error(f"基线文件缺失或无可解析哈希：{baseline}")
        failures.append("baseline-unreadable")
    else:
        if base_hash != expected:
            emit_error(
                "锚点配置漂移：基线文件与工作流期望哈希不一致"
                f"（baseline={base_hash} expected={expected}）"
            )
            failures.append("baseline-config-drift")
        if actual is not None and base_hash != actual:
            emit_error(f"基线文件与脚本不一致（baseline={base_hash} actual={actual}）")
            failures.append("baseline-script-mismatch")

    if failures:
        print(f"gate-anchor FAIL：{len(failures)} 项不一致（{'; '.join(failures)}）")
        return 1
    print(f"gate-anchor PASS：审计脚本与已批准基线一致（sha256={actual}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
