# TASK-017 — 客户保存后触发订阅同步并回写流量用量

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-017
Title: 客户保存后触发订阅同步并回写流量用量
Workflow: feature
Status: DONE
Priority: P1
Owner: workbuddy
Owner Since: 2026-10-11
Assigned Role: developer
Created: 2026-10-11
Updated: 2026-10-11
Branch: feat/TASK-017-save-triggers-subscription-sync
Requires Human Approval: false
```

---

## Objective

用户原话：「有一个问题，当新增客户页面填完所有信息保存后，我期望订阅拉取一次更新以获取流量使用情况显示在行内容中，但是目前完成保存后没有拉取更新显示正确的流量使用情况」。

落地口径：保存客户（新建/编辑）后，若本次落到具体订阅（创建或更新），
**立即触发一次该订阅的同步**；同步引擎把订阅用量**回写**到关联客户的
`traffic_used`，使客户列表行「流量使用」列保存后即有真实数据。

---

## Background（根因：双缺陷，缺一不可）

1. **保存后不触发同步**：`customers-action-dialog.tsx` 的 `onSubmit` 经
   `syncSubscription` 只创建/更新订阅记录（`POST /subscriptions`），从不调用
   `POST /subscriptions/:id/sync`。订阅的用量数据只有等定时任务（cron）或用户
   去订阅管理页手动同步才会更新。
2. **客户行没有数据来源**：客户行「流量使用」列读 `customers.traffic_used`
   （`customers-columns.tsx`），而同步引擎（`syncOne`/`syncMany`）只写
   `subscriptions.traffic_used`，**没有任何回写链路**——`toCustomerInput` 新建时
   写 0、编辑时透传原值，全库无其他写点（已 grep 证实）。因此即使同步跑了，
   客户行用量也永远是 0。

两处都修才能满足用户预期；仅修前者，行内仍显示 0。

---

## Scope

- 后端 `server/src/services/subscription-sync.ts`：同步成功时把用量
  （upload+download）镜像到关联客户（`subscriptions.customer_id → customers.traffic_used`），
  `syncOne` 与 `syncMany` 两条写路径都改；**只镜像 trafficUsed**——
  `customers.traffic_total` 是月流量上限（套餐/表单管理，TASK-016 优先级语义），
  与订阅上报总量语义不同，不覆盖；`expireAt` 同样不镜像（表单管理）。
- 前端 `src/features/customers/components/customers-action-dialog.tsx`：
  保存后对本次落到订阅触发一次同步（复用 `useSyncSubscription`），成功后
  invalidate 客户列表使行内刷新；同步失败仅软提示（客户已保存，不阻断）；
  `isPending` 纳入同步 mutation。
- 测试：新增对话框保存流组件测试（mock hooks 断言同步被触发/未填链接不触发）；
  冒烟新增段（内嵌 mock 订阅上游，验证单条+批量同步回写客户用量）。
- 文档：架构 overview 补充回写链路说明。

## Non-Scope

- 不改客户行展示口径（仍读 customers.traffic_used + effectiveTrafficTotal）。
- 不做「多订阅客户的用量聚合」（客户-订阅是一主一从模型，行内只有一个用量值；
  同步谁就回写谁，与既有单值列模型一致）。
- 不动定时调度、预览端点、订阅管理页行为。
- 不改 API 契约（复用既有 `POST /subscriptions/:id/sync`）。

---

## Requirements

1. `syncOne`/`syncMany` 同步成功后，若订阅有关联客户，在同一事务内把
   `used = (upload ?? 0) + (download ?? 0)` 写入 `customers.traffic_used`；
   同步失败不回写。
2. 客户保存（新建/编辑）后，`syncSubscription` 返回具体 subscriptionId 时
   触发一次同步；失败时 toast 软提示且不阻断保存流程。
3. 同步成功后客户列表查询失效，行内「流量使用」显示真实用量。
4. UI 文案：保存成功提示区分「已拉取最新用量」；同步失败给出明确软警告。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 架构 | 回写必须在同步的同一事务内（C2）；通知仍在事务外（C1/C8 不变） |
| 兼容 | 不改 DB 结构、不改 API 契约、不影响订阅管理页既有同步行为 |
| 性能 | 每次同步多一行 customers 写入（按订阅 cron 频率，可接受） |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-006 订阅同步引擎 | 基础 | 已完成（在 main） |
| TASK-013 流量阈值（读 customers.traffic_used） | 受益方 | 已完成（在 main） |

---

## Acceptance Criteria

- [x] AC-1: 单条同步成功后关联客户 `traffic_used` = upload+download（冒烟实证）。
- [x] AC-2: 批量同步同样回写（冒烟实证）。
- [x] AC-3: 组件测试——保存填了订阅链接的新客户：先建订阅、再以新订阅 id
      触发同步；未填链接时不触发同步。
- [x] AC-4: `pnpm test` / `pnpm lint` / `pnpm format:check` 全绿；
      冒烟对运行实例全绿（含新增段）。
- [x] AC-5: 架构文档补充回写链路说明。

---

## Implementation Plan

1. 后端：`subscription-sync.ts` 两个写路径加客户回写（同事务）。
2. 前端：对话框接入 `useSyncSubscription`，onSubmit 保存后触发 + 失效刷新 + toast。
3. 测试：`customers-action-dialog.test.tsx` + 冒烟 12.6 段（mock 订阅上游）。
4. 文档与提交归档。

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1/2 | 冒烟（内嵌 mock 上游） | `SMOKE_BASE_URL=http://localhost:3000 pnpm --filter server smoke` |
| AC-3 | 组件测试 | `pnpm test`（vitest browser） |
| AC-4 | 自动化 | `pnpm test && pnpm lint && pnpm format:check` |
| AC-5 | 人工 | 文档 diff 核对 |

---

## Current State

> 2026-10-11：实现完成并全量验证。
> - 后端：`syncOne` 事务内在 subscriptions 写入之后按 `row.customerId` 回写
>   `customers.traffic_used = used`（isChanged 之外无条件执行）；`syncMany`
>   阶段一用 rows 建 `customerBySub` 映射，阶段二事务对每个 ok 结果回写。
> - 前端：onSubmit 在 `syncSubscription` 之后、邮箱绑定同步之前
>   `await syncSubscriptionUsage.mutateAsync(id)`；成功后 invalidate
>   `customerKeys.root` 刷新行内；失败 toast 软提示不阻断；`isPending` 纳入
>   同步 mutation；成功 toast 区分「已拉取最新用量」；对话框描述补文案。
> - 测试：新增 `customers-action-dialog.test.tsx` 4 例（新建建订阅后触发 /
>   未填链接不触发 / 编辑更新后触发 / 同步失败不阻断）；`pnpm test` 191/191。
> - 冒烟：12.6 段内嵌 mock 上游（随机端口 listen(0)，/ok 返回
>   subscription-userinfo、/fail 返回 404），单条/批量回写 + 失败不回写
>   共 7 项检查全过；对 3000 实例 116 通过 / 0 失败。
> - 已知遗留（未在 Scope）：对话框「名称/邮箱/备注」等输入未包 FormControl，
>   label 无 id 关联（可访问性瑕疵，既有结构，测试按 placeholder 定位）。
>   分支 `feat/TASK-017-save-triggers-subscription-sync` 未合并、未推送。

---

## Changed Files

| 文件 | 改动 |
|------|------|
| `server/src/services/subscription-sync.ts` | import customers；syncOne/syncMany 两条写路径同事务回写 `customers.traffic_used`（仅镜像用量，失败不回写） |
| `src/features/customers/components/customers-action-dialog.tsx` | 接入 `useSyncSubscription` + `useQueryClient`；onSubmit 保存后触发同步（邮箱绑定前）+ invalidate 客户列表 + toast 区分/软失败 + isPending 纳入 + 描述文案 |
| `src/features/customers/components/customers-action-dialog.test.tsx` | 新增：mock 三 hooks 模块，4 例覆盖建/改订阅触发同步、未填链接不触发、同步失败不阻断 |
| `server/scripts/smoke.ts` | 新增 `startMockUpstream()`（随机端口 mock 订阅上游）与 12.6 段（单条/批量回写 + 失败不回写，7 项检查）；头部覆盖说明同步 |
| `docs/architecture/overview.md` | §10.7「客户保存触发同步与用量回写（TASK-017）」：双链路、只镜像用量口径、写入口清单 |

---

## Known Issues

- 对话框部分输入（名称/邮箱/备注/订阅名称等）未包 `FormControl`，label 与
  input 无 id 关联（点击 label 不聚焦输入）。既有结构、超出本任务 Scope，
  未顺手修（避免混入原子提交）；如需修复应单独立项。
- 冒烟 TG/飞书快乐路径需服务端带 `TELEGRAM_API_BASE` / `FEISHU_API_BASE`
  指向 mock 端口才接线（本次 3000 实例未接线，对应段优雅跳过）。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 1 | workbuddy | — | 2026-10-11 | 实现 + 验证完成（test 191/191、冒烟 116/0），归档待人类批准合并推送 | |

---

## Task Rules

- 「行内容」= 客户列表行的「流量使用」列（customers.trafficUsed +
  effectiveTrafficTotal 展示），不是订阅管理页。
- 回写只镜像用量，不镜像总量/到期（客户侧这两个字段是表单管理的上限语义）。

---

## Notes

- 触发同步放在邮箱绑定同步之前：订阅用量就绪后，后续通知/阈值扫描立即可见。
- 冒烟 mock 上游用随机端口（listen 0）避免与 Telegram 3998 / 飞书 4000 冲突。
