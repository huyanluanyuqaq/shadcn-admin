# TASK-022 — 「拉取订阅更新」预览流量回填订阅流量上限

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-022
Title: 「拉取订阅更新」预览流量回填订阅流量上限
Workflow: feature
Status: DONE
Priority: P3
Owner: workbuddy
Owner Since: 2026-10-11
Assigned Role: developer
Created: 2026-10-11
Updated: 2026-10-11
Branch: feat/TASK-022-preview-backfill-traffic-total
Requires Human Approval: false
```

---

## Objective

客户对话框第三部分「订阅流量上限（GB）」的填充链路与用户预期不符：
预览拉取（「拉取订阅更新」按钮）拿到的上游流量目前只喂给第二部分的
「月流量」自动填充，**不回填订阅流量上限**——未登记链接的新客户点完
按钮，到期时间有了，流量上限仍是空的。

修复：预览成功后把 `preview.trafficTotal` 回填到
`subscriptionTrafficTotalGb`（GB 换算口径与 `subscriptionFieldsFrom`
一致）。

---

## Background

- 2026-10-11 用户核对表单联动逻辑时确认的预期：
  - 第二部分「月流量」← 第一部分套餐信息自动填充（已成立，
    `resolveAutoTrafficGb`：套餐优先、订阅兜底、仅空值填）；
  - 第三部分「订阅流量上限」← 从订阅链接获取的流量信息。
- 现状（代码取证，`customers-action-dialog.tsx` `handleFetchPreview`
  318-343 行）：预览只 `setValue('subscriptionExpireAt', ...)` +
  `setUrlPreview(...)`；`urlPreview.traffic` 仅参与月流量自动填充。
  `subscriptionTrafficTotalGb` 无任何自动填充 effect，仅在编辑模式
  命中已登记订阅（`subscriptionFieldsFrom`）或「选择已有订阅」
  （`applySubscription`）时回填存量值。
- **用户决策（2026-10-11）**：预览流量回填采用
  **① 覆盖语义**（按钮以链接为准，与到期时间现有行为一致——
  到期时间就是拉一次覆盖一次）；**② 上游未返回流量时保持原值不动**
  （空值保存 = 「不限」，不能猜）。

---

## Scope

- `src/features/customers/data/schema.ts`：新增导出
  `formatTrafficTotalGb(bytes)`（null/undefined → `''`，否则
  `String(Number((bytes / GB).toFixed(2)))`）；`subscriptionFieldsFrom`
  改为复用该函数（口径单一来源，行为不变）。
- `src/features/customers/components/customers-action-dialog.tsx`：
  `handleFetchPreview` 预览成功后，`preview.trafficTotal != null` 时
  `form.setValue('subscriptionTrafficTotalGb', ...)`。
- 测试：`schema.test.ts` 补换算函数单测；
  `customers-action-dialog.test.tsx` 补 3 例组件用例
  （回填 / 覆盖已有值 / 拉空不动）。

---

## Non-Scope

- 不动「月流量」自动填充链路（`resolveAutoTrafficGb` + 空值守卫）——
  用户已确认现状符合预期。
- 不动 toast 文案（字段可见回填即反馈；避免扩大行为面）。
- 不动订阅管理页（subscriptions-action-dialog）与同步引擎。
- 不做「预览流量 → 联动改月流量已填值」——月流量空值守卫保持现状。

---

## Requirements

1. 预览成功且 `trafficTotal` 非空 → 「订阅流量上限（GB）」输入框值
   变为对应 GB 字符串（两位小数内舍去尾零，如 `10`、`1.54`）。
2. 覆盖语义：框内已有值（手填或既往预览）时同样被新预览值替换。
3. 上游未返回流量（`trafficTotal` 为 null/undefined）→ 框内值保持
   不变，不清空（空 = 「不限」的保存语义不能猜）。
4. GB 换算与 `subscriptionFieldsFrom` 同一函数，两处口径一致。

---

## Acceptance Criteria

- [x] AC-1: 组件测试——预览返回流量 → 订阅流量上限回填；
      已有值被覆盖；返回空 → 原值不动（3 例实证）。
- [x] AC-2: `formatTrafficTotalGb` 单测覆盖 null/undefined/0/整数/
      小数舍入。
- [x] AC-3: `pnpm test` 全量（204/204）/ `pnpm lint` /
      `pnpm format:check` / `tsc -b` / `vite build` 全绿。
- [x] AC-4: 隔离冒烟无回归（139/139，3002 实例）。

---

## Implementation Plan

1. `schema.ts`：加 `formatTrafficTotalGb`，`subscriptionFieldsFrom`
   复用之。
2. `customers-action-dialog.tsx`：`handleFetchPreview` 回填
   （import 新函数）。
3. 测试：单测 + 3 例组件用例（`useSubscriptionPreview` mock 改为
   hoisted 共享可配置）。
4. 验证 + 冒烟 + 归档提交。

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1/AC-2 | 单测 + 组件测试 | `pnpm test src/features/customers` |
| AC-3 | 自动化 | `pnpm test && pnpm lint && pnpm format:check && npx tsc -b && npx vite build --no-emptyOutDir` |
| AC-4 | 冒烟 | 隔离实例（快照 + 3002）跑 smoke |

---

## Current State

> 2026-10-11：实现完成并归档。
>
> **实现**：
> - `schema.ts`：新增导出 `formatTrafficTotalGb(bytes)`——
>   null/undefined → `''`，否则 `String(Number((bytes / GB).toFixed(2)))`；
>   `subscriptionFieldsFrom` 改为复用（两处口径永久一致）。
> - `customers-action-dialog.tsx`：`handleFetchPreview` 在
>   `setUrlPreview` + 到期时间回填之后，`preview.trafficTotal != null`
>   时 `form.setValue('subscriptionTrafficTotalGb', ...)`——
>   覆盖语义（按钮以链接为准），拉空不动。
>
> **测试**：`schema.test.ts` 补 1 个 describe 4 例（空值/0/换算/与
> subscriptionFieldsFrom 同口径）；`customers-action-dialog.test.tsx`
> 的 preview mock 由匿名内联改为 hoisted 共享
> （`subscriptionPreview`），补 3 例组件用例（回填 / 覆盖 /
> 拉空不动）。
>
> **验证**：客户模块 56/56（49+4+3）；全量 204/204（较合并后
> 197 +7）；lint / format:check / tsc -b / vite build
> （--no-emptyOutDir）全过；隔离冒烟 139/139（3002，未碰 3000）。

---

## Changed Files

| 文件 | 变更 |
|------|------|
| `src/features/customers/data/schema.ts` | 新增 `formatTrafficTotalGb()`；`subscriptionFieldsFrom` 复用 |
| `src/features/customers/components/customers-action-dialog.tsx` | `handleFetchPreview` 回填订阅流量上限（覆盖语义，拉空不动） |
| `src/features/customers/data/schema.test.ts` | 补换算函数单测 |
| `src/features/customers/components/customers-action-dialog.test.tsx` | 补 3 例组件用例 |

---

## Known Issues

无。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 1 | workbuddy | human | 2026-10-11 | 待实现完成后提交人类批准 |

---

## 合并前检查单

- [x] `pnpm test` 全绿（204/204）
- [x] `pnpm lint` / `pnpm format:check` 通过
- [x] `tsc -b` / `vite build` 通过
- [x] 隔离冒烟 139/139（3002 实例，未污染 3000 真实数据）
- [x] 任务文档归档至 `tasks/done/`
- [ ] **人类批准后**：ff 合并 main + 推送 origin + 删分支

---

## Task Rules

- 回填只认 `preview.trafficTotal != null`——拉不到流量是「不知道」
  不是「没有」，绝不清空（空值保存 = 不限）。
- 覆盖不做「已填值守卫」——与月流量的空值守卫刻意不同：月流量有
  套餐/订阅双来源需护住手动值，本字段唯一有意义来源就是链接本身。
- GB 换算只此一份实现（`formatTrafficTotalGb`），不得在两处各写
  `bytes / GB`。

---

## Notes

- 用户原始诉求（2026-10-11）：「第三部分订阅链接中的订阅流量上限
  应该是从订阅链接中获取到的流量信息」——本任务闭合未登记链接的
  缺口；已登记链接的存量回填本就成立。
- 附带收益：`formatTrafficTotalGb` 抽出后，
  `subscriptionFieldsFrom` 与预览回填口径永久一致，未来改舍入规则
  只需改一处。
