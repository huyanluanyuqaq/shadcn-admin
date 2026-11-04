# TASK-062 — 补回审计脚本丢失的门禁能力（A10–A13）

> **本文件是 Task 的唯一事实来源。**

---

## Meta

```yaml
Task ID: TASK-062
Title: 补回审计脚本丢失的门禁能力（A10-A13）
Workflow: maintenance
Status: ACTIVE
Priority: P1
Level: M
Owner: "Coordinator"
Owner Since: "2026-11-04T00:00:00+08:00"
Assigned Role: developer
Created: 2026-11-04
Updated: 2026-11-04
Branch: "chore/framework-restore-gates"
Requires Human Approval: false
```

## Objective

框架收敛为 v2.0.0 时，新审计脚本 `audit-project.py` 只实现了 9 项检查。
经与旧 `audit-repo.py`（F1–F10）逐条实证对照，发现**丢失 4 项、收窄 2 项**。
本任务补回丢失项并恢复被收窄的部分。

## Background

PR #43（TASK-061）把框架资产从「自持 36 篇副本」改为「中央仓只读副本」，
同时用 `audit-project.py`（A1–A9）取代了 `audit-repo.py`（F1–F10）与
`audit_framework.py`（A1–A13）。主控位在合并留证中指出门禁被整体更换且
无法逐条对照。逐条核实后确认属实。

## Scope

| 组 | 内容 |
|---|---|
| **A（补回）** | 新增 A10 规范内容一致性 / A11 必需检查名一致性 / A12 文档链接有效性 / A13 L 级 Merge Record |
| **B（恢复）** | A6 明文密钥恢复两级判定；A9 PR 模板字段 5 → 10 |
| **C（同步机制）** | `sync-framework.py` 同步范围加入 `shared/scripts/audit-project.py`；dry-run 不再要求干净工作区 |
| **D（连带）** | 中央仓 `.agents/` 6 篇行尾归一化；补 TASK-061 的 Merge Record；`AGENTS.md` 补规范引用表 |

## Non-Scope

- 不修改任何受保护规则的内容
- 不动 `tasks/**` 历史档案（TASK-061 的 Merge Record 除外，它是本任务的直接对象）
- 不动业务代码、CI 触发条件
- 不提交任何未跟踪文件

## Acceptance Criteria

- [x] AC-1 旧 F1–F10 与新 A1–A13 有逐条对照记录，无未说明的丢失
- [x] AC-2 A10 能检出「项目规范与中央仓内容不一致」（实测：构造差异可报 FAIL）
- [x] AC-3 A11 能检出「AGENTS.md 声明的必需检查在工作流中不存在」
- [x] AC-4 A12 能检出「AGENTS.md 未引用某篇规范」与「相对链接目标不存在」
- [x] AC-5 A13 只强检 `Level: L` 的档案；非 L 级不强检
- [x] AC-6 A6 恢复 hard=FAIL / suspect=WARN 两级
- [x] AC-7 A9 恢复 10 个必需字段
- [x] AC-8 审计在 shadcn-admin 上实跑：PASS=11 WARN=2 FAIL=0，exit 0
- [x] AC-9 中央仓已推送，本地/远端一致
- [ ] AC-10 CI 的 `audit` 作业在新脚本下通过

## Requirements

1. 新检查必须能**真正报 FAIL**，不能是永远 PASS 的空壳。每项的判据须可复现。
2. A10 的行尾差异**不算**内容差异（否则 git checkout 的行尾归一化会造成永久假红）。
3. A11 是「注释/文档漂移」的防线，判据为「AGENTS.md 声明的作业名必须存在于工作流」。
4. A13 不得复活 D13-C；只检查 L 级任务的 Merge Record 章节是否存在。
5. 同步范围加入审计脚本，否则门禁自身会漂移（这正是 F10 丢失的根因）。

## File Scope

```
shared/scripts/audit-project.py
shared/scripts/sync-framework.py        # 仅中央仓
AGENTS.md
tasks/review/TASK-061-adopt-agent-framework/TASK.md   # 补 Merge Record
tasks/active/TASK-062-restore-audit-gates/**
```

## Non-Scope (files)

```
tasks/**（除上述两项外）
src/**  server/**  shared/src/**  package.json  pnpm-lock.yaml
.agent-framework/**          # 由同步机制更新，不手改
```

## Task Rules

- [补充] 未跟踪文件一律不提交（`tasks/done/TASK-060-.../2026-11-04-coordinator-review-pr42.md`、
  `tasks/review/TASK-061-.../handoffs/`），是否入库由人类决定。

## Verification Plan

| 项 | 方式 | 结果 |
|---|---|---|
| 逐条对照 | 旧 F1–F10 vs 新 A1–A13 | 丢失 4 / 收窄 2 / 新增 3，已全部记录 |
| 项目内审计 | `python shared/scripts/audit-project.py` | PASS=11 WARN=2 FAIL=0 |
| dry-run | `sync-framework.py --all --dry-run` | 正常预览（不再被工作区检查阻挡） |
| CI | PR 的 `audit` 作业 | 待跑 |

## Known Issues

1. **A6 有 1 处 WARN**：`server/scripts/smoke.ts:803` 匹配 `password: 'definitely-wrong'`。
   这是测试固件，非真实凭据。两级判定已正确地将其降为 WARN。是否要为测试固件
   增加豁免，需人类决定。
2. **A5 有 1 处 WARN**：TASK-045 编号重复（已登记豁免）+ TASK-038 断号。历史遗留。
3. **`ci.yml` 中 `traceability` 的注释仍写「尚未成为门禁」**，实际已是必需检查。
   A11 只管「声明的作业名是否存在」，不管注释语义 —— 这条漂移 A11 抓不到，需人工修。

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | coordinator | developer | 2026-11-04 | 任务创建：按实证对照结果补回丢失门禁 |

---

*本文件是项目级任务记录。修改前请确认不削弱受保护规则。*
