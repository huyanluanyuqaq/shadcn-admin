# TASK-048 — 客户/订阅列表默认每页 100 行

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-048
Title: 客户/订阅列表默认每页 100 行
Workflow: feature
Status: DONE
Priority: P2
Owner: workbuddy-agent
Owner Since: 2026-10-23T09:44:00+08:00
Assigned Role: developer
Created: 2026-10-23T09:44:00+08:00
Updated: 2026-10-23T10:02:00+08:00
Branch: feature/TASK-048-table-page-size-100
Requires Human Approval: true
```

---

## Objective

客户管理（`/customers`）与订阅管理（`/subscriptions`）两个列表页的**默认每页行数由 10 改为 100**，
且分页组件的展示值与下拉候选同步一致，两处行为相同。

---

## Background

两个列表均为**服务端分页**（`manualPagination`）：`pageSize` 由组件内 `useState` 持有，
直接进入 `CustomerListParams` / `SubscriptionListParams` 并拼接为 `/api/...?page&pageSize`。
分页条 `DataTablePagination` 的「每页行数」候选是**共享硬编码列表** `[10,20,30,40,50]`，
因此只改状态初值会造成「值为 100、候选里没有 100」的错位：Radix Select 找不到匹配项，
显示退化到 placeholder，且用户切走后再也无法选回 100。

服务端上限为 `pageSize ≤ 200`（`shared/src/schema/common.ts:12`），100 在契约内，无需放宽校验。

---

## Scope

- 两个表格的 `PaginationState` 初值 `pageSize: 10 → 100`
- 分页组件候选行数列表补入 `100`
- 两个表格测试文件新增「默认每页行数」断言

## Non-Scope

- 日志 / 邮箱 / 通知 / 套餐四个列表的默认值（仍为 10 / 20，走 `useTableUrlState`，与本任务无关）
- 服务端分页契约、`useTableUrlState` 的 `defaultPageSize`
- 会员偏好持久化（记住用户自选的行数）

---

## Requirements

1. 进入两个页面时，分页状态初值为 `pageSize = 100`，首个列表请求带 `pageSize=100`。
2. 分页条「每页行数」显示 100，下拉候选中包含 100。
3. 两处改动口径完全一致，不得只改其一。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 不引入新依赖；不新增抽象（无共享常量、无 prop 透传） |
| 兼容 | 不改变 API 契约；不动其他列表页默认值 |
| 数据 | 验证使用临时快照库（`VACUUM INTO`），**不得写入 `server/data/app.db`** |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| 无 | - | - |

---

## Acceptance Criteria

- [x] AC-1: `customers-table.tsx` 的 `PaginationState` 初值 `pageSize = 100`
- [x] AC-2: `subscriptions-table.tsx` 的 `PaginationState` 初值 `pageSize = 100`
- [x] AC-3: `DataTablePagination` 候选行数含 100，且初始触发值显示 100
- [x] AC-4: 浏览器实测两个页面首屏均渲染 100 行、共 2 页、第 2 页 26 行（快照库 126 条）
- [x] AC-5: 两个页面 API 请求均为 `?page=1&pageSize=100`
- [x] AC-6: `eslint` / `prettier --check` / `tsc -b` 全通过；两个表格测试文件 16 用例通过

---

## File Scope

```yaml
File Scope:
  - src/features/customers/components/customers-table.tsx
  - src/features/customers/components/customers-table.test.tsx
  - src/features/subscriptions/components/subscriptions-table.tsx
  - src/features/subscriptions/components/subscriptions-table.test.tsx
  - src/components/data-table/pagination.tsx
Non-Scope (files):
  - src/hooks/use-table-url-state.ts
  - server/**
  - shared/**
```

---

## Implementation Plan

1. 改两个表格的 `useState<PaginationState>` 初值。
2. 分页组件候选列表补 100（`[10,20,30,40,50,100]`）。
3. 两个测试文件抽出 `setupListMocks()` 复用，并各加 2 条断言（请求参数 / 展示与候选）。
4. 起后端 + 前端，用 Playwright 在快照库上实测两页首屏行数与翻页行数。

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1/AC-2/AC-3 | 浏览器单测 | `pnpm exec vitest run --browser.headless src/features/customers/components/customers-table.test.tsx src/features/subscriptions/components/subscriptions-table.test.tsx` |
| AC-4/AC-5 | 浏览器实测 | `DATABASE_URL=E:/AiData/verify-page-size.db` 起后端 + `pnpm dev`，Playwright 脚本（`E:/AiData/verify-page-size-rows.cjs`） |
| AC-6 | 静态门禁 | `pnpm exec eslint <5 files>` / `pnpm exec prettier --check <5 files>` / `pnpm exec tsc -b` |

实测数据（快照库：126 条客户 / 126 条订阅）：

| 页面 | 每页行数展示 | 首屏行数 | 页码 | 第 2 页行数 | 请求 |
|------|------------|---------|------|-----------|------|
| `/customers` | 100 | 100 | 第 1 页，共 2 页 | 26 | `?page=1&pageSize=100` |
| `/subscriptions` | 100 | 100 | 第 1 页，共 2 页 | 26 | `?page=1&pageSize=100` |

---

## Current State

> **2026-10-31 · `DONE`（`tasks/done/`）—— 终态。** PR #23 已由主控位按人类授权执行 rebase-merge
> （`2026-10-23T02:05:24Z`，`d229ce1`）；`Merge Record` 九要素由 TASK-050 于 2026-10-31 按 D13-C 回填。
> ⚠️ 下方「等待独立审查」**始终未满足**（A3 断档）—— 已在该档案 `Merge Record` 审查记录行如实登记。

实现与验证已完成，已提交交接 `HANDOFF-001`，等待独立审查。截图证据在 `E:/AiData/shadcn-pagesize/`（工作区外，不入库）。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/features/customers/components/customers-table.tsx` | 修改 | `pageSize` 初值 10 → 100 |
| `src/features/subscriptions/components/subscriptions-table.tsx` | 修改 | `pageSize` 初值 10 → 100 |
| `src/components/data-table/pagination.tsx` | 修改 | 候选行数补 100 |
| `src/features/customers/components/customers-table.test.tsx` | 修改 | 提取 `setupListMocks()`；新增 2 条默认行数断言 |
| `src/features/subscriptions/components/subscriptions-table.test.tsx` | 修改 | 同上 |
| `tasks/review/TASK-048-table-page-size-100/TASK.md` | 新增 | 任务档案（唯一事实来源） |
| `tasks/review/TASK-048-table-page-size-100/handoffs/HANDOFF-001-developer-to-reviewer.md` | 新增 | 交付交接（含测试原始输出与取证） |

---

## Known Issues

1. **共享副效应**：`DataTablePagination` 被日志/邮箱/通知/套餐四个列表复用，
   补入 100 后这四个页面的下拉也会出现 100 选项（默认值未变）。这是「只加一项、不改默认」的最小做法；
   若要求四页候选保持原样，需改为 prop 透传，本任务未做。
2. 分页组件仍以 `table.getState().pagination.pageSize` 渲染 `SelectValue` 的 `placeholder`，
   当页面默认值不在候选列表内时会静默退化为 placeholder 展示（本次已通过补候选消除，未修复该通用缺陷）。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | developer | reviewer | 2026-10-23 | 交付「默认每页 100 行」实现、单测（16 通过）与浏览器端到端取证 |

**最新 Handoff：** `handoffs/HANDOFF-001-developer-to-reviewer.md`
**Next Action：** 无（终态）。PR #23 已于 `2026-10-23T02:05:24Z` 由主控位按人类授权执行 rebase-merge
（`d229ce1`）；`Merge Record` 由 **TASK-050 于 2026-10-31 按 D13-C 回填**（九要素实测值）。
⚠️ 原 Next Action 所要求的「独立审查」**始终未发生**（A3 断档，见 `Merge Record` 审查记录行）——
如实保留该缺口，不补写、不伪造。本档案随之归档至 `tasks/done/`，`Status: DONE`。

---

## Merge Record

> **由 TASK-050（备份导入与恢复）于 2026-10-31 按 D13-C 选项 C 回填。**
> 九要素全部为 `gh api` / DockerHub Tags API **实测值**（复现命令见各单元格内注释）。
> ⚠️ 原档案「PR 待回填（未推送，分支仅存在于本地）」与实测不符 —— PR **#23 确已存在并已合并**，
> 已按实测更正（此更正本身即 TASK-047 所终结的「档案失真」类问题，不沿用自述）。

| 要素 | 值 |
|------|-----|
| PR | #23（base `main`，标题 `feat(TASK-048): 客户/订阅列表默认每页 100 行`；实测 `gh api repos/:owner/:repo/pulls/23`） |
| 合并策略 | rebase-merge（`AGENTS.md` §14.2 默认；3 个原提交线性追加，无额外 merge commit） |
| 提交数 | **3**（实测 `gh api repos/:owner/:repo/pulls/23/commits --jq 'length'` = 3） |
| merged_at | `2026-10-23T02:05:24Z`（实测 `gh api repos/:owner/:repo/pulls/23 --jq .merged_at`） |
| merge_commit_sha | `d229ce1b7fd08ccb3af9b0ed46f054d44ec5da74`（实测 `gh api …/pulls/23 --jq .merge_commit_sha`） |
| 合并后 CI run | `39887660914`（Continuous Integration，event=push，conclusion=success，created `2026-10-23T02:05:27Z`，实测 `gh run list --commit d229ce1…`） |
| 合并后 Docker run | `39887660904`（Build and Push Docker Image，success，created `2026-10-23T02:05:27Z`，与 CI 同批触发；同 head 上另有一个 `39888093628` 为 tag `v1.0.4` 触发的发布 run，非合并 run） |
| 镜像 tag | `sha-d229ce1`（DockerHub `nomorelatenights/subscription-admin`，Tags API 实测在位，digest `sha256:ebbdc32d8521…`，last_pushed `2026-10-23T02:16:30Z` —— 由 tag `v1.0.4` 的发布 run `39888093628` 产出）；该 head 另有版本 tag `v1.0.4` |
| 审查记录 | **无（A3 断档）**：`handoffs/` 仅 `HANDOFF-001-developer-to-reviewer.md`（执行位交付单），**不存在任何审查档**（既无独立审查，也无主控位审查）。**不补写、不伪造。** |

---

## Task Rules

- [补充] 验证只允许使用快照库（`VACUUM INTO` 到工作区外的 `E:/AiData/`），禁止向真实 `server/data/app.db` 写入测试行。

---

## Notes

- 为什么不用共享常量：其余四页默认值仍是 10 / 20，若命名 `DEFAULT_PAGE_SIZE = 100` 反而误导；
  在两处就地写值 + 补候选是最小且语义正确的方式。
- 为什么必须补候选而不只改初值：见 Background 的「值为 100、候选无 100」退化路径。
