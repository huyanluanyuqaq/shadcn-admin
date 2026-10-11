# TASK-018 — 客户对话框输入框补 FormControl 关联（label 可访问性）

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-018
Title: 客户对话框输入框补 FormControl 关联（label 可访问性）
Workflow: feature
Status: DONE
Priority: P3
Owner: workbuddy
Owner Since: 2026-10-11
Assigned Role: developer
Created: 2026-10-11
Updated: 2026-10-11
Branch: feat/TASK-018-dialog-form-control-association
Requires Human Approval: false
```

---

## Objective

TASK-017 归档时记录的遗留问题：客户表单对话框（`customers-action-dialog.tsx`）
中「名称 / 邮箱 / 备注 / 月流量 / 手动流量上限 / 订阅名称 / 同步周期 /
订阅流量上限 / User-Agent / 代理地址 / 自定义请求头」等输入框**未包
`FormControl`**，`FormLabel` 的 `htmlFor` 指向不存在的 id——label 与输入
无关联：点击 label 不聚焦输入，屏幕阅读器读不出字段名。

修复：把这些裸 `<Input>` / `<Textarea>` 包进 `<FormControl>`（shadcn 标准
结构，Slot 自动注入 `id` + `aria-describedby` + `aria-invalid`）。

---

## Background

- 2026-10-11 TASK-017 组件测试排查中发现：`getByLabelText('名称')` 解析
  0 元素导致 `fill` 永久等待。根因是这些输入缺 `FormControl`（React useId
  生成的 `formItemId` 只由 FormControl 透传给输入元素）。
- 全项目审计（grep 全部 9 个含 FormLabel 的文件）：**仅客户对话框存在此
  问题**；auth / emails / webhook / feishu / telegram / plans / providers /
  subscriptions 八个对话框的输入均已正确包裹。
- 纯前端结构修复：无 API / DB / 行为变化（仅新增 id 与 aria 属性）。

## Scope

- `src/features/customers/components/customers-action-dialog.tsx`：
  12 处裸输入补 `FormControl` 包裹（name/email/remark/到期时间自动计算
  分支只读 Input/trafficMonthlyGb/trafficManualCapGb/subscriptionName/
  subscriptionCronExpr/subscriptionTrafficTotalGb/subscriptionUserAgent/
  subscriptionProxyUrl/subscriptionHeaders）。
- 测试：`customers-action-dialog.test.tsx` 既有 4 例定位方式由
  placeholder 升级为 `getByLabelText(..., { exact: true })`（直接验证
  关联生效），并新增全字段 label 关联断言用例（16 个字段逐一解析
  且唯一）。

## Non-Scope

- 不动其他对话框（已审计无同类问题）。
- 不改任何交互逻辑、校验、样式类名（FormControl 只注入属性）。
- 三个 Select（供应商/套餐/状态）不动：SelectField 组件内部已包
  FormControl，无问题。

---

## Requirements

1. 客户对话框所有带 `FormLabel` 的输入控件均被 `FormControl` 包裹，
   label 的 `htmlFor` 与输入的 `id` 一致（DOM 实证）。
2. 既有测试与交互不回退（`pnpm test` 全绿）。
3. 新增测试断言 label 关联（`getByLabelText('名称')` 等可解析且唯一）。

---

## Acceptance Criteria

- [x] AC-1: 组件测试——`getByLabelText('名称')` / `getByLabelText('订阅链接')`
      等解析到唯一输入元素（修复前为 0 元素）。新增关联断言用例逐一
      校验 16 个字段（12 处修复 + 4 处防回归）均唯一关联。
- [x] AC-2: `pnpm test`（192/192）/ `pnpm lint` / `pnpm format:check` /
      `tsc -b` / `vite build` 全绿。
- [x] AC-3: 冒烟对隔离实例全绿（133 通过 / 0 失败，无回归）。

---

## Implementation Plan

1. 逐字段包 `FormControl`（name/email/remark/trafficMonthlyGb/
   trafficManualCapGb/subscriptionName/subscriptionCronExpr/
   subscriptionTrafficTotalGb/subscriptionUserAgent/subscriptionProxyUrl/
   subscriptionHeaders + 到期时间只读分支）。
2. 测试补 label 关联断言。
3. 验证 + 归档提交。

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 | 组件测试 | `pnpm test` |
| AC-2 | 自动化 | `pnpm test && pnpm lint && pnpm format:check` |
| AC-3 | 冒烟 | `SMOKE_BASE_URL=http://localhost:3000 pnpm --filter server smoke` |

---

## Current State

> 2026-10-11：实现完成并归档。
>
> **已修复 12 处裸输入**（`customers-action-dialog.tsx`）：name / email /
> remark / 到期时间自动计算只读分支 / trafficMonthlyGb /
> trafficManualCapGb / subscriptionName / subscriptionCronExpr /
> subscriptionTrafficTotalGb / subscriptionUserAgent / subscriptionProxyUrl /
> subscriptionHeaders。全文件 17 个 FormLabel 现全部经 FormControl
> （或 SelectField 内部自带）与控件关联。
>
> **测试**：既有 4 例定位由 placeholder 升级为
> `getByLabelText(..., { exact: true })`；新增「表单标签关联」用例，
> 对 16 个字段逐一 `elements()` 解析并断言唯一（locator 惰性求值，
> 必须实际解析，`expect(locator).toBeTruthy()` 是空断言）。
>
> **验证**：组件测试 5/5；全量 192/192；lint / format:check / tsc -b /
> vite build 全过；隔离冒烟 133/133（快照 + migrate + 3002 实例，
> 未触碰 3000 真实实例）。
>
> **实现期发现（测试坑，已记入长期记忆）**：vitest-browser 的
> `getByLabelText` 默认**子串匹配**——`'名称'` 会连带命中『订阅名称』
> 触发 strict violation，必须传 `{ exact: true }`（与 `getByRole` 的
> name 子串匹配同源，TASK-017 排查时曾靠 placeholder 绕开）。

---

## Changed Files

| 文件 | 变更 |
|------|------|
| `src/features/customers/components/customers-action-dialog.tsx` | 12 处裸输入补 `FormControl` 包裹（纯结构，Slot 只注入 id/aria-*） |
| `src/features/customers/components/customers-action-dialog.test.tsx` | 4 例定位升级为 `getByLabelText(exact)`；新增 label 全字段关联断言用例（16 字段） |

---

## Known Issues

无。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 1 | workbuddy | human | 2026-10-11 | 实现+验证+归档完成，待人类批准合并推送 main |

---

## 合并前检查单

- [x] `pnpm test` 全绿（192/192）
- [x] `pnpm lint` / `pnpm format:check` 通过
- [x] `tsc -b` / `vite build` 通过
- [x] 隔离冒烟 133/133（3002 实例，未污染 3000 真实数据）
- [x] 任务文档归档至 `tasks/done/`
- [ ] **人类批准后**：ff 合并 main + 推送 origin + 删分支

---

## Task Rules

- FormControl 是 Slot：只合并属性（id/aria-*），不改变子元素结构与样式。
- 保留 Textarea 现有的显式 props（value/onChange/onBlur/name/ref），
  仅在外层包 FormControl。

---

## Notes

- 本任务是 TASK-017 归档 Known Issues 中「对话框部分输入缺 FormControl
  的 a11y 瑕疵」的正式修复（当时判定超 Scope 未顺手修）。
