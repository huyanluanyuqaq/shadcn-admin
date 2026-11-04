# TASK-061 — 接入 agent-framework v2.0.0 公共规范

> **本文件是 Task 的唯一事实来源。**

---

## Meta

```yaml
Task ID: TASK-061
Title: 接入 agent-framework v2.0.0 公共规范
Workflow: maintenance
Status: REVIEW
Priority: P1
Level: L
Owner: "Coordinator"
Owner Since: "2026-11-04T00:00:00+08:00"
Assigned Role: developer
Created: 2026-11-04
Updated: 2026-11-04
Branch: "chore/framework-sync-2.0.0"
Requires Human Approval: false
```

## Objective

把本项目的框架资产从「自持 36 篇副本」改为「中央规范仓只读副本」，消除双权威源，
并接入项目级框架合规审计。

## Background

Workspace 层完成框架收敛重构（`agent-framework` v2.0.0）：
36 篇规范收敛为 7 篇，8 角色收敛为三角色，引入任务分级 S/M/L。
本项目需同步接入，否则 `main` 上的旧副本与中央规范仓形成双权威源。

## Scope

| 组 | 内容 |
|---|---|
| **A（接入）** | 新增 `.agent-framework/`（7 篇）+ `framework-version.json` |
| **B（清理）** | 删除 `.agents/`(36) · `templates/`(32) · `scripts/audit-repo.py` · `shared/scripts/audit_framework.py` |
| **C（门禁）** | 新增 `shared/scripts/audit-project.py`（A1–A9）；`ci.yml` 的 `audit` 作业改跑它 |
| **D（文档）** | `AGENTS.md` 引用路径迁移与语义更新 |

## Non-Scope

- 不改 `tasks/**` 历史档案中的路径引用（遵循「不回溯重排历史档案」）
- 不动未跟踪文件 `tasks/review/TASK-060-.../2026-11-04-coordinator-review-pr42.md`
- 不改任何业务代码、技术配置、依赖

## Acceptance Criteria

- [x] AC-1 `.agent-framework/` 含 7 篇规范，且与中央仓逐字一致（MD5 校验）
- [x] AC-2 `framework-version.json` 记录 version=2.0.0、source、lastSyncedAt
- [x] AC-3 `.agents/`、`templates/`、`scripts/audit-repo.py`、`shared/scripts/audit_framework.py` 已删除
- [x] AC-4 `shared/scripts/audit-project.py` 在项目内模式实跑：PASS=8 WARN=1 FAIL=0（exit 0）
- [x] AC-5 CI 的 `audit` 作业通过
- [x] AC-6 CI 的 `install-lint-build` 与 `smoke` 作业通过（无 src/ 变更，回归无影响）
- [x] AC-7 `AGENTS.md` 无 `.agents/` 残留引用，新引用可解析
- [ ] AC-8 `traceability` 作业通过（每个提交含 `Refs: TASK-061`）
- [x] AC-9 `main` 未被修改；未跟踪的用户文件未被提交

## Requirements

### A 组
1. 7 篇规范必须与 `huyanluanyuqaq/agent-framework` 的 `.agents/` 逐字一致。
2. `framework-version.json` 字段：`framework` / `version` / `source` / `lastSyncedAt`。

### B 组
3. 删除的 4 项必须确认无活跃引用（已全仓检索：仅 CI 与 AGENTS.md 引用，均已改）。
4. `tasks/**` 历史档案中的旧路径引用**不修改**。

### C 组
5. `audit-project.py` 必须支持双模式：项目内运行审计自身；中央仓内运行审计全部项目。
6. CI `audit` 作业命令改为 `python3 shared/scripts/audit-project.py`。

### D 组
7. `AGENTS.md` 中 `.agents/*` 引用全部迁移到 `.agent-framework/*`。
8. D13-C「下一个任务回填 Merge Record」改为「同一 PR 内自填」，并说明废弃原因。

## File Scope

```
.agent-framework/**
framework-version.json
shared/scripts/audit-project.py
AGENTS.md
.github/workflows/ci.yml
tasks/review/TASK-061-adopt-agent-framework/**
```

## Non-Scope (files)

```
tasks/**（除 TASK-061 自身外）
src/**  server/**  shared/src/**  package.json  pnpm-lock.yaml
```

## Task Rules

- [补充] 删除历史档案中的失效路径引用不属于本任务范围（遵循「不回溯重排历史档案」）。

## Verification Plan

| 项 | 命令 / 方式 | 结果 |
|---|---|---|
| 规范一致性 | MD5 比对 7 篇 vs 中央仓 | 逐字一致 |
| 项目内审计 | `python shared/scripts/audit-project.py` | PASS=8 WARN=1 FAIL=0 |
| CI | PR #43 | audit ✅ / install-lint-build ✅ / smoke ✅ / traceability ❌→待修 |

## Known Issues

- TASK-045 编号重复（两个目录）—— 2026-10-21 已裁决共存，审计脚本中已登记豁免
- TASK-038 编号断号 —— 归档后移除所致，审计中为 WARN
- `ci.yml` 原注释称「traceability 尚未成为门禁」，实际已是必需检查 —— 注释与现实漂移，需修正

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | coordinator | developer | 2026-11-04 | 任务创建：按中央仓 v2.0.0 接入本项目 |

---

*本文件是项目级任务记录。修改前请确认不削弱受保护规则。*
