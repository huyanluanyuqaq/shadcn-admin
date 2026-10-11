# TASK-014 — 刷新按钮全面审计与点击反馈修复

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-014
Title: 刷新按钮全面审计与点击反馈修复
Workflow: feature
Status: DONE
Priority: P2
Owner: workbuddy
Owner Since: 2026-10-11
Assigned Role: developer
Created: 2026-10-11
Updated: 2026-10-11
Branch: fix/TASK-014-refresh-button-feedback
Requires Human Approval: false
```

---

## Objective

用户原话：「查看系统所有页面的刷新按钮 是否有具体的作用，以及点击刷新按钮没有动画这点要修复一下」。

两件事：
1. **审计**：系统所有页面的刷新按钮是否都接真实数据刷新（不能有死按钮）。
2. **修复**：点击刷新按钮后无加载动画/无禁用态，补全一致的点击反馈。

---

## Background — 审计结论（2026-10-11 实测代码）

| 页面 | 刷新入口 | onClick 实际作用 | 点击动画 |
|------|---------|------------------|---------|
| 仪表盘 | 标题栏「刷新」 | `refetch()` 真实重新请求 stats | ✓ spin |
| 仪表盘 | 错误态「重试」 | `refetch()` | ✗ 无动画 |
| 日志 | 工具栏图标 | `refetch()` | ✓ |
| 日志 | 错误态「重试」 | `refetch()` | ✗ |
| 套餐 | 工具栏图标 | `refetch()` | ✓ |
| 套餐 | 错误态「重试」 | `refetch()` | ✗ |
| 邮箱 | 工具栏图标 | `refetch()` | ✓ |
| 邮箱 | 错误态「重试」 | `refetch()` | ✗ |
| 站内通知 | 工具栏图标 | `refetch()` | ✓ |
| 站内通知 | 错误态「重试」 | `refetch()` | ✗ |
| Webhooks | 工具栏图标 | `refetch()` | ✓ |
| Webhooks | 错误态「重试」 | `refetch()` | ✗ |
| Telegram 配置 | 标题栏「刷新」 | `configQuery.refetch()` | ✓ |
| 飞书配置 | 标题栏「刷新」 | `configQuery.refetch()` | ✓ |
| 客户管理 | **无工具栏刷新按钮** | 仅错误态「重试」（有图标无动画） | ✗ |
| 订阅管理 | **无工具栏刷新按钮** | 有「同步全部 / 重载调度」（均带动画，但语义是同步不是刷新） | ✗ |

结论：
- **现有刷新按钮全部接真实 TanStack Query `refetch()`，无死按钮**（8 个主刷新 + 8 个错误态重试均有效）。
- **动画缺口**：① 客户 / 订阅两个列表页缺工具栏刷新按钮（其余 5 个列表页均有，体验不一致）；
  ② 8 处错误态「重试」按钮无加载动画、无禁用态。
- 轮询类查询（铃铛角标 30s / Telegram 绑定状态 3s）与表格刷新无关，不影响动画判定。

---

## Scope

- 客户管理页：工具栏右侧新增刷新图标按钮（与日志 / 套餐同款实现）。
- 订阅管理页：同上。
- 8 处错误态「重试」按钮：统一补 RefreshCw 图标 + `isFetching` 时 `animate-spin` + `disabled`。
- 验证：typecheck / lint / format:check / build / 前端单测；冒烟不涉及（纯前端交互）。

## Non-Scope

- 不改既有 8 个主动画刷新按钮的实现（已正确）。
- 不改轮询策略、不改 DataTableToolbar 共享组件（各页自行组合，保持现有模式）。
- 不加骨架屏 / 进度条等其他反馈形式（只做图标旋转 + 禁用，与现有模式一致）。

---

## Requirements

1. 客户管理、订阅管理工具栏出现刷新图标按钮：`variant='outline'` `size='icon'`，
   `aria-label`/`title='刷新'`，点击 `refetch()`，`isFetching` 时图标 `animate-spin`
   且按钮 `disabled`。
2. 8 处错误态「重试」按钮：有图标的补动画，无图标的补图标；统一
   `disabled={isFetching}`。
3. 所有刷新按钮点击后有明确视觉反馈（旋转 / 禁用），与既有页面模式一致。

---

## Acceptance Criteria

- [x] AC-1: 客户 / 订阅页工具栏有刷新按钮，点击后图标旋转、按钮禁用，请求完成后恢复。
- [x] AC-2: 8 处错误态重试按钮全部有刷新图标 + 请求中动画 + 禁用。
- [x] AC-3: `pnpm build`（tsc -b + vite build）/ lint / format:check 通过。
- [x] AC-4: 前端单测全绿（改动为纯交互，预计无既有用例受影响）。

---

## File Scope

```yaml
File Scope:
  - src/features/customers/components/customers-table.tsx     # 工具栏刷新 + 错误态重试动画
  - src/features/subscriptions/components/subscriptions-table.tsx # 同上
  - src/features/logs/components/logs-table.tsx               # 错误态重试动画
  - src/features/plans/components/plans-table.tsx             # 错误态重试动画
  - src/features/emails/components/emails-table.tsx           # 错误态重试动画
  - src/features/notifications/components/notifications-table.tsx # 错误态重试动画
  - src/features/notifications/components/webhooks-table.tsx  # 错误态重试动画
  - src/features/dashboard/index.tsx                          # 错误态重试动画
  - tasks/active/TASK-014-refresh-button-feedback/**
```

---

## Verification Plan

| 验证项 | 方式 | 命令 |
|--------|------|------|
| AC-1/2 | 代码审查 + 端口 3000/5173 实测点击 | 见报告 |
| AC-3 | 门禁 | `pnpm build`、`pnpm lint`、`pnpm format:check` |
| AC-4 | 单测 | `pnpm test` |

---

## Current State

> 2026-10-11：实施与验证完成，Status=DONE。
>
> **修复内容**：
> 1. 客户管理 / 订阅管理：工具栏右侧新增刷新图标按钮（与日志 / 套餐 / 邮箱同款：
>    `variant='outline' size='icon'` + `aria-label/title='刷新'` + `isFetching` 时
>    `animate-spin` + `disabled`），两列表页此前无刷新入口，与其他 5 个列表页不一致。
> 2. 8 处错误态「重试」按钮统一补 RefreshCw 图标 + `isFetching` 时 `animate-spin`
>    + `disabled`：客户 / 订阅（原有图标无动画）、日志 / 套餐 / 邮箱 / 站内通知 /
>    webhooks / 仪表盘（原无图标无动画）。
>
> **验证结果**：`pnpm build`（tsc -b + vite build）✓；lint ✓；format:check ✓
> （3 文件经 `pnpm format` 修复）；前端单测 162/162（15 文件）✓；
> Vite dev server（:5173）实测 serve 的 customers / subscriptions 模块已含新刷新
> 按钮（aria-label ×1、animate-spin ×2）；dist 产物含新按钮标记。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| src/features/customers/components/customers-table.tsx | 修改 | 工具栏新增刷新按钮；错误态重试补动画+禁用 |
| src/features/subscriptions/components/subscriptions-table.tsx | 修改 | 同上 |
| src/features/logs/components/logs-table.tsx | 修改 | 错误态重试补图标+动画+禁用 |
| src/features/plans/components/plans-table.tsx | 修改 | 同上 |
| src/features/emails/components/emails-table.tsx | 修改 | 同上 |
| src/features/notifications/components/notifications-table.tsx | 修改 | 同上 |
| src/features/notifications/components/webhooks-table.tsx | 修改 | 同上（三元样式与该文件既有模式一致） |
| src/features/dashboard/index.tsx | 修改 | 错误态重试补图标+动画+禁用 |
| tasks/active/TASK-014-refresh-button-feedback/** | 新增 | 任务档案（本目录） |

---

## Known Issues

> 无。既有 8 个主刷新按钮（仪表盘 / 日志 / 套餐 / 邮箱 / 站内通知 / webhooks /
> Telegram / 飞书）审计确认均接真实 `refetch()`，无死按钮，动画齐全，未改动。
