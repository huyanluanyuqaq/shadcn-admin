# TASK-019 — 客户对话框同步周期新增「每天随机时间」按钮

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-019
Title: 客户对话框同步周期新增「每天随机时间」按钮
Workflow: feature
Status: DONE
Priority: P3
Owner: workbuddy
Owner Since: 2026-10-11
Assigned Role: developer
Created: 2026-10-11
Updated: 2026-10-11
Branch: feat/TASK-019-random-daily-cron
Requires Human Approval: false
```

---

## Objective

新增客户（及编辑客户）对话框第三部分「订阅配置」的**同步周期**字段旁，
新增一个「每天随机时间」按钮：点击后生成一个「每天随机时刻执行一次」的
cron 表达式（`分 时 * * *`，分钟 0-59、小时 0-23 均匀随机）并填入输入框，
把订阅同步打散到一天中的随机时刻，避免所有订阅整点集中触发上游。

---

## Background

- 用户原话：「将新增客户页面的同步周期再添加一个每天随机时间的按钮」。
- 现状：`subscriptionCronExpr` 是纯文本输入 + CRON_HINT 说明，默认
  `0 */6 * * *`（每 6 小时）。用户想要一键生成每日随机时刻，而非手搓
  cron 或接受固定默认值。
- 调度器（`server/src/services/scheduler.ts`，croner）对非法表达式
  try/catch 记日志跳过——生成的表达式必须合法；`M H * * *` 数值段恒合法。
- 参照：同对话框「订阅链接」字段已有「拉取订阅更新」按钮（flex 行内
  outline 按钮 + shrink-0），视觉与交互模式直接复用。

## Scope

- `src/features/customers/data/schema.ts`：新增纯函数
  `randomDailyCronExpr()`（生成 `分 时 * * *`，可单测）。
- `src/features/customers/components/customers-action-dialog.tsx`：
  同步周期字段输入框右侧加「每天随机时间」按钮（`type='button'`，
  点击 `field.onChange(randomDailyCronExpr())`，重复点击重新随机）。
- 测试：`schema.test.ts` 补函数单测（格式/取值范围/随机性）；
  `customers-action-dialog.test.tsx` 补组件用例（点击后输入框值为
  合法每日 cron 且不同于默认值）。

## Non-Scope

- **不动订阅管理页**（`subscriptions-action-dialog.tsx`）的同名字段——
  用户只要求新增客户页面；如需 parity 另立任务。
- 不改 CRON_HINT / DEFAULT_CRON（两者被订阅管理页共用，改会造成歧义）。
- 不改后端调度、校验、DB（`cronExpr` 校验为 `min(1)`，无需收紧）。

---

## Requirements

1. 按钮位于同步周期输入框同一行右侧，outline 样式，图标 + 文案
   「每天随机时间」，`type='button'` 不触发表单提交。
2. 点击后输入框值变为 `分 时 * * *`（分 0-59、时 0-23 整数），
   每次点击重新随机；输入框仍受 FormControl label 关联（TASK-018）。
3. 生成函数为纯函数并单测覆盖；组件测试覆盖点击行为。

---

## Acceptance Criteria

- [x] AC-1: 点击「每天随机时间」→ 同步周期输入框值匹配
      `/^\d{1,2} \d{1,2} \* \* \*$/` 且分钟 ∈ [0,59]、小时 ∈ [0,23]，
      与默认值 `0 */6 * * *` 不同（组件测试实证）。
- [x] AC-2: 连续多次点击均生成合法值（单测 300 次采样：范围校验 +
      随机性覆盖 ≥12 小时 / ≥15 分钟 + 恒不等于 DEFAULT_CRON）。
- [x] AC-3: `pnpm test`（195/195）/ `pnpm lint` / `pnpm format:check` /
      `tsc -b` 全绿。
- [x] AC-4: 隔离冒烟 133/133（3002 实例，无回归）。

---

## Implementation Plan

1. `schema.ts` 加 `randomDailyCronExpr()`（放 `resolveAutoTrafficGb`
   附近，与既有纯函数为邻）。
2. 对话框字段改 flex 行：FormControl(Input) + Button，参照订阅链接
   字段的「拉取订阅更新」结构；import lucide `Shuffle` 图标。
3. 单测 + 组件测试。
4. 验证 + 归档提交。

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
> **实现**：
> - `customers/data/schema.ts` 新增纯函数 `randomDailyCronExpr()`：
>   `分 时 * * *`（分 0-59、时 0-23 均匀随机），数值两段恒为 croner
>   合法表达式。
> - `customers-action-dialog.tsx` 同步周期字段改 flex 行（参照订阅
>   链接字段结构）：FormControl(Input) + outline 按钮「每天随机时间」
>   （Shuffle 图标，`type='button'`，点击 `field.onChange(...)`，
>   重复点击重新随机）。FormControl 仍是 Input 直接父级，TASK-018
>   的 label 关联不受影响。
> - CRON_HINT / DEFAULT_CRON 未动（订阅管理页共用，避免歧义）。
>
> **测试**：`schema.test.ts` 补 2 例（300 次采样范围校验 + 随机性
> 覆盖 + 恒不等于默认值）；`customers-action-dialog.test.tsx` 补 1 例
> （默认值 → 点击 → 合法每日 cron → 不误提交 → 再次点击仍合法）。
>
> **验证**：客户模块 47/47；全量 195/195；lint / format:check /
> tsc -b 全过；隔离冒烟 133/133（未碰 3000 真实实例）。

---

## Changed Files

| 文件 | 变更 |
|------|------|
| `src/features/customers/data/schema.ts` | 新增纯函数 `randomDailyCronExpr()`（`分 时 * * *` 随机） |
| `src/features/customers/components/customers-action-dialog.tsx` | 同步周期字段改 flex 行，新增「每天随机时间」按钮（Shuffle 图标 + type='button'） |
| `src/features/customers/data/schema.test.ts` | 补 2 例单测（范围/随机性/≠默认值） |
| `src/features/customers/components/customers-action-dialog.test.tsx` | 补 1 例组件测试（点击生成合法 cron 且不提交表单） |

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

- [x] `pnpm test` 全绿（195/195，合并前复跑 197/197 确认）
- [x] `pnpm lint` / `pnpm format:check` 通过
- [x] `tsc -b` 通过
- [x] 隔离冒烟 133/133（3002 实例，未污染 3000 真实数据）
- [x] 任务文档归档至 `tasks/done/`
- [x] **人类批准后**：ff 合并 main + 推送 origin + 删分支（2026-10-11 完成）

---

## Task Rules

- 按钮必须 `type='button'`——在 form 内默认 type 会触发提交。
- 随机函数保持纯函数（无 Date/环境依赖之外的副作用），放
  `customers/data/schema.ts` 便于单测。
- 不动订阅管理页同名字段（Non-Scope）。

---

## Notes

- 与 TASK-018（FormControl 关联）同文件相邻字段，注意包裹结构不被
  flex 行破坏：FormControl 仍是 Input 的直接父级。
