# TASK-057 — 门禁实证与证据链收口（traceability 拦截实证 + 审查记录入库 + D13-C 回填）

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-057
Title: 门禁实证与证据链收口
Workflow: maintenance
Status: BACKLOG
Priority: P1
Owner: ""
Owner Since: ""
Assigned Role: developer
Created: 2026-11-02T21:50:00+08:00
Updated: 2026-11-02T21:50:00+08:00
Branch: ""
Requires Human Approval: true
```

## Objective

把 2026-11-02 一批协作体系整改留下的**证据链缺口**补满：新门禁 `traceability` 取得「红灯确实能拦截合并」的
端到端实证，未入库的审查记录进入版本控制，并按 D13-C 清偿 TASK-055 的 Merge Record 欠账。

## Background

- PR #29 新增 `traceability` 作业，PR #31 由主控位把它加入分支保护必需检查
  （`contexts` = `["audit", "install-lint-build", "traceability"]`，2026-11-02 实测）。
  但它作为**必需检查**的强制力尚无实证：能力记录 §4 的 V4 式拦截实证
  （探针 PR + `mergeable_state: blocked` + `PUT /pulls/N/merge` 返回 HTTP 405 + `main` 未变动）
  目前**只有 `install-lint-build` 一例**（探针 PR #3，2026-10-14）。
  「作业会跑」不等于「作业能拦」—— 后者才是门禁的定义（`docs/agent-collaboration.md` §4）。
- 三份主控位审查记录未入库：`tasks/review/TASK-055-…/handoffs/2026-11-02-coordinator-review-round3.md`、
  `tasks/done/TASK-056-…/handoffs/2026-11-02-coordinator-review.md` 与 `-round2.md`
  （后者两份已随 PR #31 的 `git mv` 到位，round3 未跟踪）。
- 按 D13-C 选项 C，TASK-055 的 `## Merge Record` 应由**下一个任务**回填。TASK-056 是下一个任务但未做
  （TASK-055 `Known Issues` 5 已登记「欠账滚过三轮、根因未消除」）。本任务作为再下一个任务，**必须清偿**。

## Scope

| 组 | 内容 | 是否需要平台动作 |
|----|------|------------------|
| **E（实证）** | 探针 PR 使 `traceability` 红灯 → 实测 `mergeable_state` / 合并被 405 拒绝 / `main` 未变动 | 是（开探针 PR，需人类授权） |
| **D（档案）** | 能力记录 §4 新增 V5 条目并贴原始输出；§2/§3 同步 | 否 |
| **A（归档）** | 未入库审查记录纳入版本控制 | 否 |
| **W（回写）** | 按 D13-C 回填 TASK-055 的 Merge Record 九要素 + `Status → DONE` + `git mv` 至 `done/` | 否 |

## Non-Scope

- **不修 smoke.ts 的 14 项失败**（TASK-058）。
- **不改 `templates/` 或 `.agents/`**（框架快照只读，`AGENTS.md` §10；SHA 映射表制度化属 TASK-059）。
- **不动分支保护的其它字段**（`strict` / `enforce_admins` / 批准数一律保持现状）。
- **不删探针 PR 之外的历史记录**；探针 PR 用后按既有惯例保留并在能力记录中登记。

## Requirements

1. 实证必须满足 V4 同款四要素：探针 PR 的 `traceability` 红灯 → `mergeable_state: blocked` →
   `PUT /repos/:owner/:repo/pulls/<N>/merge` 返回 **HTTP 405** 且 message 指名 `traceability` →
   合并前后 `main` HEAD 不变。四者缺一即不构成实证。
2. 探针 PR 的构造必须**故意违规**（缺 `Refs` footer，或引用不存在的 `TASK-NNN`），
   并在档案中写明构造方式与清理方式。**不得**用改产品代码的方式制造红灯。
3. 平台改动的**前后值都要留原始输出**（TASK-056 F-1 的教训：前值不可得时必须如实写「未取证」，不得填空）。
4. TASK-055 的 Merge Record 九要素全部按 `gh api` / DockerHub Tags API **实测**，附复现命令；
   因 rebase 改写 SHA，须附「审查时 SHA → main 上 SHA」映射表，判据方法按 TASK-056 先例
   （基点半移 → `patch-id --stable`）而非 TASK-055 的「tree 相同」。
5. 不得为让门禁变绿而删测试、放宽断言或改 `scripts/audit-repo.py` 的豁免清单。

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 仅 Python 标准库 + git + `gh`；不引新依赖 |
| 兼容 | 不改任何运行时行为；`ci.yml` / `docker.yml` 一行不动 |
| 安全 | 不写凭据；探针 PR 不得含密钥或无关改动 |
| 流程 | 开探针 PR 前须取得人类授权（`change-safety.md`）；每提交 footer 含 `Refs: TASK-057` |

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| `traceability` 已在必需检查中 | blocks | 已完成（2026-11-02，`contexts` 含三项） |
| 人类授权开探针 PR | external | 待授权 |

## Acceptance Criteria

- [ ] AC-1: 探针 PR 上 `traceability` 红灯，且 `gh pr view <N> --json mergeable,mergeStateStatus`
      实测 `mergeable_state` 含 `blocked` / `mergeStateStatus` 为 `BLOCKED`（或等价值）。
- [ ] AC-2: `gh api -X PUT repos/:owner/:repo/pulls/<N>/merge` 返回 **HTTP 405**，
      message 指名 `Required status check "traceability"`；原始输出贴入能力记录 §4 新增的 V5 条目。
- [ ] AC-3: 合并尝试前后 `git rev-parse origin/main` 相同（`main` 未变动）。
- [ ] AC-4: 三份未入库审查记录全部在 `git ls-files` 中可见，且内容与主控位交付时逐字一致。
- [ ] AC-5: TASK-055 的 Merge Record 九要素填实测值、`Status: DONE`、位于 `tasks/done/`；
      `tasks/review/` 下不再有 TASK-055；`audit-repo.py` 保持 `PASS=9 FAIL=0`。
- [ ] AC-6: `audit-repo.py` → `PASS=9 FAIL=0 WARN=0`；`prettier --check .` 退出码 0；
      `audit_framework.py` → `PASS=13 FAIL=0`。

## File Scope

```yaml
File Scope:
  - docs/operations/github-capability.md
  - docs/operations/negative-assertion-review.md
  - tasks/review/TASK-055-archive-backfill-and-email-binding-residuals/**
  - tasks/done/TASK-055-archive-backfill-and-email-binding-residuals/**
  - tasks/done/TASK-056-collaboration-upgrade/handoffs/**
  - tasks/backlog/TASK-057-*/**   → tasks/active/… → tasks/review/…
Non-Scope (files):
  - .github/workflows/**
  - .agents/**
  - templates/**
  - scripts/audit-repo.py
  - shared/scripts/**
  - src/**, server/**, shared/src/**
```

## Implementation Plan

1. 从 `main` 切分支；`git status` 确认干净。
2. **先做 A 组**（审查记录入库，风险最低）。
3. **再做 W 组**：实测九要素 → 回填 TASK-055 → `Status: DONE` → `git mv` → 每步跑一次 `audit-repo.py`。
4. **再做 D 组**：能力记录 §4 新增 V5 占位（待实证后填）。
5. **最后做 E 组**：取得人类授权 → 开探针 PR → 实测四要素 → 回填 V5 → 关闭/保留探针 PR 并登记。
6. 全量门禁 → 提交（建议 2~3 个）→ 推分支 → 开 PR → 交主控位审查。

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 | 平台实测 | `gh pr view <N> --json mergeable,mergeStateStatus,statusCheckRollup` |
| AC-2 | 平台实测 | `gh api -X PUT repos/:owner/:repo/pulls/<N>/merge`（记录 HTTP 状态与 body） |
| AC-3 | git 实测 | 合并尝试前后各跑一次 `git rev-parse origin/main` |
| AC-4 | git 实测 | `git ls-files \| grep coordinator-review-round3` 等三条 |
| AC-5 | 文本 + 脚本 | `grep -c` 九要素非「待回填」；`ls tasks/done/TASK-055*`；`python scripts/audit-repo.py` |
| AC-6 | 门禁 | 三条命令逐一记录退出码 |

## Current State

**BACKLOG（2026-11-02 登记，未开始）。** 等待执行位领取。

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| — | — | 尚未开始 |

## Known Issues

1. **探针 PR 是一次「故意违规」的公开交付请求**。它会被 `traceability` 拦住（这正是要证的），
   但历史上会留下一个红 PR。处置方式（保留并登记 vs 关闭）需在档案中写明，**不得**删除后不留痕。
2. **「门禁能拦截」对 `install-lint-build` 已有实证（V4，探针 PR #3，2026-10-14），
   对 `audit` 与 `traceability` 均无。** 本任务只补 `traceability`；`audit` 的拦截实证仍缺，
   登记为后续项（同一手法可复用）。

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| — | — | — | — | 尚未开始 |

**最新 Handoff：** 无
**Next Action：** 执行位领取后先做 A 组（审查记录入库），再做 W 组；E 组须先取得人类授权。

## Merge Record

> **本节不随「Pass/收尾」填写。** 按 D13-C 选项 C（`.agents/rules/github.md` §2 / §6、
> `AGENTS.md` §14.2），本表由**下一个任务**在回收本任务归档时回填；
> 在此之前任务保持 `Status = REVIEW`、留在 `tasks/review/`（机制，非遗漏）。
> **禁止在本任务内自我回写**（那会造成档案与提交历史不一致）。
> 回填时九要素必须填实测值（可被 `gh api` / Tags API 复现），不得沿用档案自述；
> 无合并前独立审查档时，「审查记录」行须如实写「无（A3 断档）」，**不得补写、不得伪造**。

| 要素 | 值 |
|------|-----|
| PR | 待回填 |
| 合并策略 | rebase-merge（`AGENTS.md` §14.2 默认） |
| 提交数 | 待回填 |
| merged_at | 待回填 |
| merge_commit_sha | 待回填 |
| 合并后 CI run | 待回填 |
| 合并后 Docker run | 待回填 |
| 镜像 tag | 待回填 |
| 审查记录 | 待回填 |

## Task Rules

- [增强] **平台改动的前后值都必须留原始输出**；前值不可得时必须如实写「未取证」，
  不得以推测值填空（TASK-056 F-1 教训）。
- [补充] 探针 PR 属高风险平台动作，**开之前必须取得人类授权**。
- [补充] 本任务同时承担 D13-C 规定的「回填上一个任务（TASK-055）Merge Record」职责，
  这是**规定动作而非可选**；漏做即构成 TASK-055 `Known Issues` 5 所记的同类欠账。

## Notes

- 三项待办的来源：2026-11-02 主控位对 PR #31 的审查结论 §5/§7，以及 TASK-055 `Known Issues` 5。
- 场景 F（`docs/operations/collaboration-scenarios.md`）已指出「SHA 映射表」缺制度要求；
  其制度化归 **TASK-059**，本任务只在回填 TASK-055 时按先例附映射表。
