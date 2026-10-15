# TASK-036 — 设计稿滞后断言补记与时点快照限定 + clerk 死代码清理

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-036
Title: 设计稿滞后断言补记与时点快照限定 + clerk 死代码清理
Workflow: docs
Status: ACTIVE
Priority: P2
Owner: 执行位（本会话）
Owner Since: 2026-10-15
Assigned Role: architect（口径判定）+ developer（落实）；审查由新实例 Reviewer 承担
Created: 2026-10-15
Updated: 2026-10-15
Branch: chore/TASK-036-doc-sync-and-clerk-cleanup
Requires Human Approval: false
```

---

## Objective

设计稿滞后断言补记与时点快照限定 + clerk 死代码清理 + D13-C 承载 TASK-032 归档回写。

---

## Background

- 来源：TASK-032（`tasks/review/TASK-032-fix-stale-assertions/`）建立的「否定性 / 时点性断言复核机制」
  在框架设计稿（`.agents/proposals/dual-agent-github-collaboration-design-v1-draft.md`，不在 Git 内）
  上暴露同类问题：阶段 4 验收制度已被 PR #4–#8 五次真实交付实证，但设计稿未留「状态」行（文档滞后）；
  §17 / §17.1 / §18.1 三处「远端现仅剩 `main`」式**时点快照**以现在时陈述，未加限定语
  （每完成一个任务，交付分支会暂时增加、合并删分支后恢复）。
- TASK-032 的 `Known Issues` D1 登记了 `src/assets/clerk-*.tsx` 死代码「待后续任务清理」——
  本任务即该后续任务（`src/**` 首次进入本类任务的 File Scope）。
- 按 D13 裁决 C：本任务的交付请求**同时承载 TASK-032 的归档回写**（见 `rules/github.md` §6）。

---

## Scope

- 设计稿 `.agents/proposals/dual-agent-github-collaboration-design-v1-draft.md`：
  §15 阶段 4 表补「状态」行；§17 决策表 D12 行、§17.1 裁决记录 D12 行、§18.1 漂移表第 6 行
  的时点快照表述加限定语（三要素：时点 / 动态预期 / 定性）。
- 仓库 `shadcn-admin`：删除 `src/assets/clerk-full-logo.tsx`、`src/assets/clerk-logo.tsx`；
  同步 `AGENTS.md` §13.3 与 `docs/operations/negative-assertion-review.md` §4 D1 的断言。
- 按 D13-C 承载 TASK-032 归档回写：`Status → DONE`、回填 `Merge Record`、移入 `tasks/done/`。

## Non-Scope

- 不动 `docs/architecture/overview.md` 任何 clerk 表述（H 类历史快照，文件头已声明保留）。
- 不动 `src/components/layout/data/sidebar-data.ts:25` 的历史注释。
- 不动 README、`.github/` 上游资产。
- 不合并 PR（合并不经执行位；留用户授权）。

---

## Requirements

1. §15 阶段 4 表新增「状态」行：判定 = ✅ 实质已完成（补记日期 2026-10-15），
   证据逐项对应 PR #4–#8 五次真实交付；「动作」「验收」两行原文一字不改。
2. 三处时点快照加限定语（① 时点 = 2026-10-15 D12 执行时；② 动态预期 = 此后每个新任务的
   交付分支会暂时增加、合并并删分支后恢复；③ 定性 = 时点快照非永久断言，引用前重测）。
3. clerk 两资产删除前后各留一份 grep 输出；删除前 grep 必须为空（assets 外零引用）。
4. `AGENTS.md` §13.3 与 `negative-assertion-review.md` §4 D1 的断言同步更新，
   **不得留下新的过时断言**（TASK-032 机制）。
5. TASK-032 归档回写五要素齐全（PR 号 / 策略 / 提交范围 / 合并标识 / CI / 审查 / 归档）。
6. 每个提交 footer 含 `Refs: TASK-036`（修正 TASK-032 未加 footer 的流程偏差）；
   提交只用显式路径 `git add`（`.workbuddy/` 未跟踪）。

---

## Acceptance Criteria

- [ ] AC-1: 设计稿 §15 阶段 4 表含「状态」行，五项验收标准逐项对应 PR #4–#8 实证；
      「动作」「验收」原文未改。
- [ ] AC-2: §17 D12、§17.1 D12、§18.1 第 6 行三处快照均含三要素限定语；
      §17 主表 D12 行的范围外纳入在 Known Issues 登记为 R1。
- [ ] AC-3: clerk 两资产已删；删除前后 grep 输出各留一份；`AGENTS.md` §13.3 与
      `negative-assertion-review.md` §4 D1 断言已同步；构建未破坏。
- [ ] AC-4: TASK-032 档案 `Status: DONE`、位于 `tasks/done/`、`Merge Record` 五要素回填，
      Known Issues 与过程披露原文保留。
- [ ] AC-5: `audit_framework.py` PASS=13 FAIL=0；`pnpm build` / `pnpm lint` /
      `pnpm format:check` 全过；PR 创建后 `gh pr checks` 双绿。
- [ ] AC-6: 本档案交付时位于 `tasks/review/`，`Status: REVIEW（…归档回写按 D13-C 待下一个任务补记）`，
      Merge Record 留白；提交全部含 `Refs: TASK-036` footer。

---

## File Scope

```yaml
File Scope:
  - .agents/proposals/dual-agent-github-collaboration-design-v1-draft.md   # 非 Git（工作空间根），仅文件改动
  - AGENTS.md                              # 仅 §13.3 遗留死代码一句
  - docs/operations/negative-assertion-review.md   # 仅 §4 D1 行
  - src/assets/clerk-full-logo.tsx         # 删除
  - src/assets/clerk-logo.tsx              # 删除
  - tasks/backlog/TASK-036-doc-sync-and-clerk-cleanup/**   # 本任务档案（提交审查时迁入 review/）
  - tasks/review/TASK-036-doc-sync-and-clerk-cleanup/**    # 迁移目标
  # D13-C：本任务交付请求须一并补记 TASK-032 的归档回写（含目录迁移）
  - tasks/review/TASK-032-fix-stale-assertions/**          # Status→DONE + 回写 Merge Record
  - tasks/done/TASK-032-fix-stale-assertions/**            # 迁移目标（含 handoffs/）
Non-Scope (files):
  - docs/architecture/overview.md          # H 类历史快照，禁改
  - src/components/layout/data/sidebar-data.ts             # 历史注释，禁改
  - README.md
  - .github/**
```

---

## Implementation Plan

| # | 步骤 | 产出 |
|---|------|------|
| 1 | 自 `main`（`f212b7c`）派生分支 `chore/TASK-036-doc-sync-and-clerk-cleanup`，先推远端 | 远端分支对象 |
| 2 | 建 backlog 档案并提交（`Refs: TASK-036`） | commit 1 |
| 3 | 设计稿 AC-1（§15 状态行）+ AC-2（三处限定语） | 文件改动（非 Git） |
| 4 | `audit_framework.py` 基线复核 | PASS=13 FAIL=0 |
| 5 | clerk 删除前 grep → 删除 → 删除后 grep；同步 AGENTS.md / 复核清单 | commit 2 |
| 6 | `pnpm build` / `pnpm lint` / `pnpm format:check` | 全绿输出 |
| 7 | TASK-032 归档回写 + 迁移 | commit 3 |
| 8 | 本档案 Current State / Verification / Known Issues 回填 + 迁 review/ + handoff | commit 4 |
| 9 | 推送、建 PR、`gh pr checks` 双绿留痕 | PR 编号 |

---

## Current State

（实施完毕后回填。）

---

## Verification

（实施完毕后附原始命令输出。）

---

## Known Issues

（实施完毕后登记，含 R1 范围外纳入披露与 D1 上游差异取舍。）

---

## Merge Record

**（按 D13-C，本项在下一个任务出现之前保持空白；届时由该任务的交付请求补记。）**
