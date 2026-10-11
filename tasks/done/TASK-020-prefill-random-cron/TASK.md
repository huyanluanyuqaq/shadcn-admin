# TASK-020 — 新建客户预填随机同步周期

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-020
Title: 新建客户预填随机同步周期
Workflow: feature
Status: DONE
Priority: P3
Owner: workbuddy
Owner Since: 2026-10-11
Assigned Role: developer
Created: 2026-10-11
Updated: 2026-10-11
Branch: feat/TASK-020-prefill-random-cron
Requires Human Approval: false
```

> **分支叠栈说明**：本任务叠栈在 `feat/TASK-019-random-daily-cron`
> （「每天随机时间」按钮，尚未合并 main）之上——预填值复用其
> `randomDailyCronExpr()`。合并顺序：TASK-019 → TASK-020。

---

## Objective

新建客户对话框打开时，「同步周期」字段直接预填一个「每天随机时间」的
cron 表达式（`分 时 * * *`），取代固定默认 `0 */6 * * *`（每 6 小时）。
把每个新订阅的同步时刻打散到一天中的随机时间，避免所有订阅整点集中
触发上游；用户也可用 TASK-019 的「每天随机时间」按钮随时重摇一个。

---

## Background

- 用户原话：「直接新建客户的时候就预填入随机时间值吧」。
- TASK-019 已提供 `randomDailyCronExpr()` 与「每天随机时间」按钮，但
  新建默认值仍是 `0 */6 * * *`——不点按钮就还是固定每 6 小时。
- `emptyCustomerForm()` 仅作用于**新建**路径（对话框 defaultValues 与
  open 时 reset）；编辑路径走 `toCustomerForm()`（回落 DEFAULT_CRON，
  命中匹配订阅后由 `subscriptionFieldsFrom` 覆盖为订阅现值），不受影响。
- `buildSubscriptionInput` 的「留空回落 DEFAULT_CRON」语义不变（用户
  手动清空字段时仍回落每 6 小时）。

## Scope

- `src/features/customers/data/schema.ts`：`emptyCustomerForm()` 的
  `subscriptionCronExpr` 由 `DEFAULT_CRON` 改为 `randomDailyCronExpr()`。
- `src/features/customers/data/schema.test.ts`：补 1 例锁定预填形态。
- `src/features/customers/components/customers-action-dialog.test.tsx`：
  修订 TASK-019 用例的默认值假设（原断言 `'0 */6 * * *'`），补 1 例
  新建预填用例。

## Non-Scope

- 不动 `toCustomerForm` 的 DEFAULT_CRON 回落（编辑未命中订阅时的
  兜底，保持可预期）。
- 不动 `buildSubscriptionInput` 的留空回落与 CRON_HINT / DEFAULT_CRON
  （订阅管理页共用）。
- 不动订阅管理页（subscriptions-action-dialog）同名字段默认值。
- **不含「订阅保存后反向同步客户」**——那属于用户第二项提案
  （订阅→客户方向），范围待与用户确认后另立任务。

---

## Requirements

1. 新建客户对话框打开时，同步周期输入框值为 `分 时 * * *`
   （分 0-59、时 0-23），非 `0 */6 * * *`。
2. 编辑客户行为不变：`toCustomerForm` 回落 DEFAULT_CRON，命中匹配
   订阅后由 `subscriptionFieldsFrom` 覆盖。
3. 用户清空字段保存时仍回落 `0 */6 * * *`（buildSubscriptionInput
   既有语义）。
4. TASK-019 按钮行为不变（重摇、不提交表单）。

## Acceptance Criteria

- [x] AC-1: `emptyCustomerForm().subscriptionCronExpr` 匹配
      `/^\d{1,2} \d{1,2} \* \* \*$/`（schema 单测实证，10 次采样）。
- [x] AC-2: 组件测试实证新建对话框同步周期默认值为合法每日 cron
      且 ≠ `0 */6 * * *`；TASK-019 按钮用例适配后通过。
- [x] AC-3: `pnpm test` 全量（197/197）/ `pnpm lint` / `pnpm format:check` /
      `tsc -b` 全绿；`vite build` 通过（见 Notes 环境坑）。
- [x] AC-4: 隔离冒烟 133/133（3002 实例，无回归）。

---

## Implementation Plan

1. `schema.ts`：`emptyCustomerForm()` 改调 `randomDailyCronExpr()`
   （同文件函数声明， hoisted；加注释说明仅新建路径）。
2. `schema.test.ts`：补 `emptyCustomerForm` 预填 describe。
3. `customers-action-dialog.test.tsx`：TASK-019 用例默认值断言改为
   模式匹配；新增「新建预填随机」用例。
4. 验证 + 冒烟 + 归档提交。

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1/AC-2 | 单测 + 组件测试 | `pnpm test src/features/customers` |
| AC-3 | 自动化 | `pnpm test && pnpm lint && pnpm format:check` |
| AC-4 | 冒烟 | 隔离实例（快照 + 3002）跑 smoke |

---

## Current State

> 2026-10-11：实现完成并归档。
>
> **实现**：`emptyCustomerForm()` 的 `subscriptionCronExpr` 由
> `DEFAULT_CRON` 改为 `randomDailyCronExpr()`（同文件 hoisted 函数声明），
> 加注释说明仅新建路径生效。编辑路径（`toCustomerForm` 回落
> DEFAULT_CRON + `subscriptionFieldsFrom` 覆盖）与留空回落
> （`buildSubscriptionInput`）均未动。
>
> **测试**：`schema.test.ts` 补 1 例（10 次采样锁定预填形态）；
> `customers-action-dialog.test.tsx` 修订 TASK-019 用例默认值假设
> （`toBe('0 */6 * * *')` → 模式匹配）并补 1 例新建预填用例。
>
> **验证**：客户模块 49/49；全量 197/197（较 TASK-019 的 195 +2）；
> lint / format:check / tsc -b 全过；`vite build --no-emptyOutDir`
> 通过；隔离冒烟 133/133（未碰 3000 真实实例）。

---

## Changed Files

| 文件 | 变更 |
|------|------|
| `src/features/customers/data/schema.ts` | `emptyCustomerForm()` 预填 `randomDailyCronExpr()` |
| `src/features/customers/data/schema.test.ts` | 补 1 例预填断言 |
| `src/features/customers/components/customers-action-dialog.test.tsx` | 修订 TASK-019 用例 + 补 1 例预填用例 |

---

## Known Issues

无。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 1 | workbuddy | human | 2026-10-11 | 实现+验证+归档完成，待人类批准合并推送 main |
| 2 | human | workbuddy | 2026-10-11 | 批准合并（「提交」）→ 已 ff 合并 main 并推送 origin，分支已删 |

---

## 合并前检查单

- [x] `pnpm test` 全绿（197/197，合并前复跑确认）
- [x] `pnpm lint` / `pnpm format:check` 通过
- [x] `tsc -b` 通过
- [x] 隔离冒烟 133/133（3002 实例，未污染 3000 真实数据）
- [x] 任务文档归档至 `tasks/done/`
- [x] **人类批准后**：ff 合并 main + 推送 origin + 删分支（2026-10-11 完成）

---

## Task Rules

- 只改新建路径（`emptyCustomerForm`）；编辑路径与留空回落语义不变。
- 复用 TASK-019 的 `randomDailyCronExpr()`，不新造随机逻辑。

---

## Notes

- 对话框两处调用 `emptyCustomerForm()`（defaultValues 与 open reset），
  每次打开都是新随机值——符合「新建时预填」预期。
- 与用户第二项提案（订阅→客户反向同步）解耦；后者待范围确认后另立
  TASK-021。
- **环境坑（本次修正历史记忆）**：`pnpm build` 的 vite prepare-out-dir
  清空 `dist/assets`（72+ 文件）会被 safe-delete 守卫以
  `SAFE_DELETE_BULK_CONFIRM_REQUIRED`（阈值 50）拦截——**vite 自清
  outDir 同样走 rmSync shim，并非「不被拦」**。解法：
  `npx vite build --no-emptyOutDir`（覆盖写入，不清空；dist 已被
  .gitignore，陈旧 hash 文件无害）。
