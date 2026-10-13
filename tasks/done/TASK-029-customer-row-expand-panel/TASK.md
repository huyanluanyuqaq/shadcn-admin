# TASK-029 — 客户表格行点击展开延伸面板

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-029
Title: 客户表格行点击展开延伸面板
Workflow: feature
Status: DONE
Priority: P1
Owner: workbuddy
Owner Since: 2026-10-13
Assigned Role: developer
Created: 2026-10-13T11:46:00Z
Updated: 2026-10-13T11:46:00Z
Branch: feat/TASK-029-customer-row-expand-panel
Requires Human Approval: false
```

---

## Objective

客户管理表格中，点击某一行即**选中该客户**，并在该行下方展开延伸面板，
**同一时间只展开一行**。面板内：

1. **可复制字段**：客户名称、邮箱、订阅链接 —— 点击字段文本即完成复制，
   不单独放复制按钮，复制成功后给出轻量提示。
2. **仅展示字段（不可复制）**：购买时间、到期时间。
3. **套餐周期列表**：依据购买时间与到期时间，按整月粒度拆出当前套餐的
   每个周期，带序号逐条展示。

展开与收起需平滑过渡，整体样式与现有页面一致。

---

## Background

`CustomersTable`（`src/features/customers/components/customers-table.tsx`）
基于 TanStack Table 8.21 封装，此前**行不可点击**，仅通过勾选框做批量选择，
行内也没有承载更多信息的空间。客户的可复制信息（邮箱 / 订阅链接）与
套餐周期需要一个新的展示位。

数据模型（`shared/src/schema/entities.ts` → `customerSchema`）：
- `purchasedAt`：购买时间（epoch ms，nullable）
- `expireAt`：到期时间（epoch ms，nullable）
- `subscriptionUrl`：订阅链接（nullable）
- `email`：邮箱（nullable）
- `name`：客户名称（必填）

---

## Acceptance Criteria

- **AC-1** 客户名称、邮箱、订阅链接三个字段点击文本即复制到剪贴板，
  复制成功弹出轻量 toast 提示；界面上不出现独立的「复制」按钮。
- **AC-2** 购买时间与到期时间以 `yyyy-MM-dd HH:mm` 展示，且**不可点击、不可复制**。
- **AC-3** 套餐周期按整月粒度拆分并带序号（从 1 开始）逐条展示。
- **AC-4** 周期规则：首个周期从购买日期起算；每个周期为
  「**本月购买日 → 次月购买日的前一天**」；最后一个周期不足整月时以
  到期时间作为结束日期。
  - 需求示例：购买 `2026-10-24`、到期 `2027-01-22` → 三个周期
    `2026.10.24-2026.11.23`、`2026.11.24-2026.12.23`、`2026.12.24-2027.01.22`
- **AC-5** 边界：购买日为月末（29/30/31 日）时按自然月进位。
- **AC-6** 边界：到期时间正好等于某周期结束日时不额外生成空周期。
- **AC-7** 边界：字段缺失时显示占位符，且不生成可复制按钮。
- **AC-8** 同一时间只展开一行；再次点击同一行收起。
- **AC-9** 点击行同时选中该客户（互斥选中）。
- **AC-10** 点击行内交互元素（勾选框 / 操作菜单）不会误触发展开。

---

## Scope

```yaml
Scope:
  - src/features/customers/utils.ts            # 新增 splitPlanCycles / formatPlanCycleRange / PlanCycle
  - src/features/customers/utils.test.ts       # 新增：周期拆分 18 例
  - src/lib/clipboard.ts                       # 新增：剪贴板写入 + execCommand 回落
  - src/features/customers/components/customer-detail-panel.tsx        # 新增：延伸面板
  - .../customer-detail-panel.test.tsx         # 新增：面板 12 例
  - src/features/customers/components/customers-table.tsx              # 修改：行点击 + 面板行
  - src/features/customers/components/customers-columns.tsx             # 修改：交互元素阻止冒泡
  - src/features/customers/components/customers-table.test.tsx          # 新增：展开状态机 6 例
Non-Scope (files):
  - shared/**              # 无 schema 变更
  - server/**              # 纯前端展示逻辑，后端无改动
  - src/components/ui/**   # shadcn 原语，未改动
```

---

## Implementation Plan

1. 纯函数 `splitPlanCycles()`：整月粒度拆分 + 月末进位 + 空周期保护
2. `copyToClipboard()`：Clipboard API + execCommand 回落
3. `CustomerDetailPanel`：可复制字段 / 只读字段 / 周期列表 / 占位
4. `customers-table.tsx`：`expandedId` 单一状态 + 面板行常驻 DOM + grid 过渡
5. 单测与三件套验证

---

## Design Decisions

| # | 决策 | 理由 |
|---|------|------|
| 1 | 面板行**常驻 DOM**（`grid-rows-[0fr]↔[1fr]`）而非条件挂载 | 条件挂载会丢失收起方向的过渡；grid 行高 0fr→1fr 是纯 CSS 的高度动画，无需测量高度 |
| 2 | 展开状态用**单一 `expandedId`** 而非 Set | 需求明确「同一时间只展开一行」，单一状态天然满足，无需额外约束逻辑 |
| 3 | 可复制字段本体是 `<button>` 而非 `<span onClick>` | 保留键盘可达性与语义；按钮内就是字段文本，符合「不单独放复制按钮」 |
| 4 | 日期按月推进时**保留购买时间的时分秒** | 末周期被到期时间截断时结束时刻即到期时刻，不会跨天错位 |
| 5 | 末周期标注「（不足整月）」 | 解释为何该周期短于其他周期，避免误读为数据错误 |
| 6 | 点击行做**互斥选中**（`{ [row.id]: true }`） | 需求「点击某一行选中该客户」；批量多选仍可走勾选框 |

### 关于「月末进位」的两种解释

`addMonths` 链式推进会产生漂移：`01-31 → 02-28 → 03-28 → 04-28`。
这与需求「每个周期为**本月购买日** → 次月购买日的前一天」不一致——三月的
「购买日」应是 31 日。故实现采用**锚定购买日**方案：第 k 个周期起始日 =
购买月 + k 个月的「购买日」，当月不足该天数则取月末，即
`01-31 → 02-28 → 03-31 → 04-30`。已为两种口径分别落测试（`utils.test.ts`）。

---

## Verification

| 验证项 | 方式 | 结果 |
|--------|------|------|
| AC-4/5/6/7 | `utils.test.ts` | 18 例通过（含需求示例逐字断言） |
| AC-1/2/3/7 | `customer-detail-panel.test.tsx` | 12 例通过 |
| AC-8/9/10 | `customers-table.test.tsx` | 6 例通过 |
| 全量回归 | `pnpm test` | **287/287 通过**（改动前 251） |
| 类型 | `tsc -b`（`pnpm build`） | 通过 |
| 规范 | `pnpm lint` / `pnpm format:check` | 通过 |

---

## Current State

> 2026-10-13 11:46 实现完成：周期拆分纯函数 + 剪贴板工具 + 延伸面板 +
> 表格行交互，三件套与全量测试全绿。
> 2026-10-13 22:07 交付完成：提交 `5280a18`（分支
> `feat/TASK-029-customer-row-expand-panel`），已推送并 fast-forward 合入 main。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| src/features/customers/utils.ts | 修改 | 新增 `PlanCycle` 类型、`splitPlanCycles()`（整月粒度拆分 + 月末锚定进位 + 空周期保护 + MAX_CYCLES 防御上限）、`formatPlanCycleRange()`（区间文本） |
| src/features/customers/utils.test.ts | 新增 | 周期拆分 18 例：需求示例、恰好整月、月末进位（31/30/闰年29）、跨年、跨 2 月、同月不足整月、同刻、字段缺失、脏数据倒序、超长区间保护、首尾相接、序号连续 |
| src/lib/clipboard.ts | 新增 | `copyToClipboard()`：优先 Clipboard API，非安全上下文回落到 textarea + `execCommand('copy')`，并还原用户原选区 |
| src/features/customers/components/customer-detail-panel.tsx | 新增 | 面板：三个可复制字段（button 承载文本 + hover 显示复制图标 + toast）、两个只读字段、带序号的周期列表、缺失占位 |
| src/features/customers/components/customer-detail-panel.test.tsx | 新增 | 12 例：复制内容/提示、复制失败提示、按钮数量与 aria-label、日期格式化、不可复制、周期输出、缺失占位 |
| src/features/customers/components/customers-table.tsx | 修改 | 新增 `expandedId` 状态与 `toggleRow()`；每行渲染主行 + 面板行（`Fragment`）；面板行 `data-state=expanded/collapsed`；主行 `cursor-pointer` + 键盘可达 |
| src/features/customers/components/customers-columns.tsx | 修改 | 勾选框与行操作菜单外包 `div` 并 `stopPropagation`，避免点击行内交互元素误触发展开 |
| src/features/customers/components/customers-table.test.tsx | 新增 | 6 例：初始态、展开与互斥、再点收起、选中互斥、勾选框不展开、面板周期可见 |

---

## Known Issues

- `data-state` 在未选中行上会被 React 渲染为字符串 `"false"`（因
  `row.getIsSelected() && 'selected'` 的短路求值），与面板行的
  `expanded`/`collapsed` 共存于同一属性名。测试据此区分主行与面板行；
  若后续重构选择逻辑，需同步更新 `customers-table.test.tsx` 的
  `rowStates()` / `panelStates()`。
- 端到端冒烟未跑：需后端 + mock 上游环境，本次仅覆盖离线单测。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | developer | system | 2026-10-13 | 实现+测试全绿，已交付合入 main |

**最新 Handoff：** `handoffs/HANDOFF-001-developer-to-system.md`
**Next Action：** 无阻塞项。遗留：端到端冒烟未跑（需后端 + mock 上游环境），
离线单测已覆盖全部周期分支与展开状态机。

---
