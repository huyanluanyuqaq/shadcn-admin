# TASK-030 — 订阅表格行点击展开延伸面板

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-030
Title: 订阅表格行点击展开延伸面板
Workflow: feature
Status: DONE
Priority: P1
Owner: workbuddy
Owner Since: 2026-10-13
Assigned Role: developer
Created: 2026-10-13T13:55:00Z
Updated: 2026-10-13T13:55:00Z
Branch: feat/TASK-030-subscription-row-expand-panel
Requires Human Approval: false
```

---

## Objective

订阅管理表格中，为每条订阅记录增加一个可展开的延伸面板（该行下方展开），
交互与视觉与客户管理页（TASK-029）保持一致。面板内展示：

1. **订阅地址**——支持一键复制，并给出复制成功 / 失败的操作反馈；
2. **绑定客户信息**——客户名称，或名称取不到时的客户标识；
3. **关联邮箱地址**——便于查看或复制。

同时妥善处理：**信息为空**、**客户数据加载失败**、**复制不可用**三类边界。

---

## Requirements

| # | 需求 | 实现 |
|---|------|------|
| R1 | 订阅地址一键复制 + 成功/失败反馈 | `CopyButton`：文本本身即触发区；成功 `toast.success`，失败 `toast.error` 并引导手动复制 |
| R2 | 绑定客户：名称或客户标识 | 名称优先（`张三 #12`）；无名称回落 `客户 #12`；未绑定显示「未绑定客户」 |
| R3 | 关联邮箱可查看/复制 | 与 R1 同机制；为空显示 `-` 且不渲染按钮 |
| R4 | 交互/视觉与现有页面一致 | 沿用 TASK-029 的 `bg-muted/40` 面板 + `grid-rows-[0fr]↔[1fr]` 高度过渡 + 互斥选中 |
| R5 | 边界：信息为空 | 空值显示 `-`，不产生可点击区域 |
| R6 | 边界：客户数据加载失败/加载中 | 以标识兜底，并追加「加载中…」/「客户信息加载失败」说明 |
| R7 | 边界：复制不可用 | `copyToClipboard` 返回 false → 失败 toast + 手动复制引导 |

---

## File Scope

```
Owned (modified):
  - src/features/subscriptions/components/subscriptions-table.tsx
  - src/features/subscriptions/components/subscriptions-columns.tsx

Owned (created):
  - src/features/subscriptions/components/subscription-detail-panel.tsx
  - src/features/subscriptions/components/subscription-detail-panel.test.tsx
  - src/features/subscriptions/components/subscriptions-table.test.tsx
  - tasks/review/TASK-030-subscription-row-expand-panel/**

Reused (not modified, TASK-029 产物):
  - src/lib/clipboard.ts
```

---

## Design Decisions

| 决策 | 理由 |
|------|------|
| 展开状态用单一 `expandedId`（而非 Set） | 类型层面天然保证「同时只展开一行」，无需额外收敛逻辑 |
| 面板常驻 DOM，`grid-rows-[0fr]↔[1fr]` 驱动高度 | 条件挂载会让收起的那一刻失去可过渡元素，动画丢失（TASK-029 已验证） |
| 客户标识（`#12`）不可复制 | 纯内部定位信息；可复制的永远是有语义的文本 |
| 无名称时区分「加载中 / 加载失败 / 查不到」 | 避免用户把「数据问题」误判为「未绑定」，三种状态的兜底文案不同 |
| 名称列**不做**点击隔离，地址列做 | 名称是最自然的展开触发点（与客户页一致）；地址几乎必然溢出，其 LongText 点击语义是「展开全文」，不应连带展开整行 |
| 复制失败文案引导手动复制 | 自托管经 http 访问时 `navigator.clipboard` 缺失是常态，需给出可执行出路 |

---

## Current State

> 2026-10-13 13:55 实现完成：面板组件 + 表格行展开 + 事件隔离 + 16 例测试。
> 2026-10-13 13:55 验证全绿：typecheck / lint / format:check / `pnpm test` 303/303 / `pnpm build`。
> 本地已起服务（:3000 后端 + :5173 前端），插入演示数据（订阅 id 82/83/84）供人工查看。

---

## Verification

| 项 | 结果 |
|----|------|
| `npx tsc --noEmit -p tsconfig.app.json` | 通过 |
| `pnpm lint` | 通过 |
| `pnpm format:check` | 通过 |
| `pnpm test` | **303/303**（本任务新增 16 例：面板 10 + 表格 6） |
| `pnpm build` | 通过 |

测试用例清单：
- 面板（10）：地址复制成功 / 复制失败提示 / 邮箱复制 / 邮箱空占位 / 地址空占位 /
  已绑定显示名称+标识且可复制 / 未绑定 / 加载中 / 加载失败 / 查不到仅显示标识
- 表格（6）：初始全收起 / 互斥展开 / 再点收起且选中保留 / 勾选框只选中不展开 /
  面板内复制不联动展开（事件隔离）/ 面板展示该行数据

---

## Merge Record

- 功能提交 `492e159`（feat(web)），任务档案见下一条 docs(task) 提交，
  经 fast-forward 合入 main 并推送。
- CI 验证：run **38411606617 success**（install-lint-build 全绿）。
- Docker 构建：run **38411606735 success**。
