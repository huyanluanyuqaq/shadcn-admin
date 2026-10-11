# TASK-021 — 订阅 CRUD 写后自动热重载调度器

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-021
Title: 订阅 CRUD 写后自动热重载调度器
Workflow: feature
Status: DONE
Priority: P2
Owner: workbuddy
Owner Since: 2026-10-11
Assigned Role: developer
Created: 2026-10-11
Updated: 2026-10-11
Branch: feat/TASK-021-subscription-write-reload-scheduler
Requires Human Approval: false
```

> **分支叠栈说明**：叠栈在 `feat/TASK-020-prefill-random-cron`（未合并）之上，
> 与前端改动无文件重叠，仅共用分支线。合并顺序：TASK-019 → TASK-020 → TASK-021。

---

## Objective

订阅经 CRUD 路由写入（创建 / 更新 / 删除 / 批量删除）后，自动调用
`scheduler.reload()` 热重载调度任务——新建或修改的 cron 表达式**立即生效**，
无需再到订阅管理页手动点「重载调度」或重启服务。

---

## Background

- 用户两阶段提案的第二阶段经确认后收窄为两项，其中「订阅→客户反向同步」
  被用户明确**取消**（客户对话框编辑打开时已按链接匹配实时预填，存储副本
  `subscription_expire_at` 近乎冗余）；保留项即本任务：自动重载调度器。
- 现状缺口：`reload()` 仅在 ① 服务启动（index.ts）② 手动
  `POST /api/subscriptions/scheduler/reload`（订阅页「重载调度」按钮）时
  调用；`crud.ts` 通用 CRUD 无写后钩子。后果：新建订阅（含客户对话框
  `syncSubscription` 创建的订阅）在重载/重启前**不会按 cron 运行**；改
  cron 同样不生效。TASK-020 起新建客户预填随机周期，该缺口体感更强
  （随机 cron 不重载就不跑）。
- 改造点：`crud.ts` 曾有的 per-resource 定制模式是 `createDefaults` 钩子；
  本次新增对称的 `afterWrite` 钩子，仅订阅路由传入（6 资源中唯一需要
  写后联动的资源）。

## Scope

- `server/src/lib/crud.ts`：新增可选 `afterWrite?: () => void` 钩子
  （create/update/delete/bulk-delete 成功后调用；异常只记录不抛出——
  写入已成功，不应让客户端看到 500 误判失败而重试）。
- `server/src/routes/resources.ts`：`/subscriptions` 路由传入
  `afterWrite: () => reload()`（scheduler.service）。
- `server/scripts/smoke.ts`：新增 12.10 段验证写入后调度器自动重建
  （作业数增减 / nextRunAt 回写 / 非法 cron 跳过 / enabled=false 不注册）。

## Non-Scope

- **不做「外科手术式」单条重启**（导出 startOne/stopOne 按 id 精准重启）：
  全量 reload 与手动按钮同语义、恒正确，本项目规模（单管理员、数十订阅、
  写操作为人手触发）下 churn 可忽略；如未来成为瓶颈再优化。
- 不动 `sync.ts` 的手动 reload/status 端点（保留作手动兜底与观测）。
- 不动同步引擎等服务层直写路径（不经 CRUD，不触发重载——避免每次同步
  都全量重建）。
- 前端「重载调度」按钮保留（手动兜底）；无「需重载生效」提示文案需清理
  （已排查，不存在）。

---

## Requirements

1. `POST /api/subscriptions`（enabled=true + 合法 cron）成功后，
   `GET /api/subscriptions/scheduler/status` 的 jobs 数 +1，且该订阅
   `nextRunAt` 非空（startOne 注册时回写）。
2. `PATCH /api/subscriptions/:id` 改 cronExpr 后 jobs 数不变（重建而非
   叠加）；改为非法表达式时该订阅 job 被跳过（jobs -1，既有 startOne
   try/catch 语义）；enabled=false 的订阅不注册 job。
3. `DELETE /api/subscriptions/:id` 成功后 jobs 数 -1。
4. 钩子异常不影响已成功的写入响应（守卫 + 记录）。

## Acceptance Criteria

- [x] AC-1: 冒烟 12.10 段全部通过（创建 +1 / 改 cron 恒数 / 非法 cron
      跳过 -1 / 停用 -1 / 改回 +1 / 删除恢复基线，全部 jobs 增量断言）。
- [x] AC-2: `pnpm typecheck:server` / `pnpm lint` / `pnpm format:check`
      通过；根 `tsc -b` 不受影响。
- [x] AC-3: 全量 `pnpm test` 197/197 无回归；隔离冒烟 139/139（133 + 6
      新增检查）0 失败。

---

## Implementation Plan

1. `crud.ts`：接口加 `afterWrite` + `runAfterWrite` 守卫 + 4 个调用点。
2. `resources.ts`：订阅路由传钩子（import scheduler.reload）。
3. `smoke.ts`：12.10 段（自包含：建两个临时订阅 → 状态断言 → 清理）。
4. 验证 + 冒烟 + 归档提交。

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-2 | 自动化 | `pnpm typecheck:server && pnpm lint && pnpm format:check && npx tsc -b` |
| AC-1/AC-3 | 冒烟 | 隔离实例（快照 + 3002）跑 smoke，12.10 段 + 总数 0 失败 |

---

## Current State

> 2026-10-11：实现完成并归档。
>
> **实现**：
> - `crud.ts`：`CrudOptions` 新增 `afterWrite?: () => void`（create /
>   update / delete / bulk-delete 成功后调用）；`runAfterWrite` 守卫
>   （钩子异常只 console.error 不抛出——写入已成功，500 会让客户端误判
>   失败并重试造成重复副作用）。
> - `resources.ts`：`/subscriptions` 传入 `afterWrite: () => reloadScheduler()`
>   （import scheduler.reload 为 reloadScheduler，避免与既有命名混淆）。
>   其余 5 资源不传（无写后联动需求）。
> - `smoke.ts`：新增 12.10 段 6 项检查（jobs 增量断言）+ 头部覆盖清单。
>
> **验证**：typecheck:server / lint / format:check / 根 tsc -b 全过；
> 全量 test 197/197 无回归；隔离冒烟 **139/139**（133 + 6）0 失败
> （3002 实例，未碰 3000 真实数据）。

---

## Changed Files

| 文件 | 变更 |
|------|------|
| `server/src/lib/crud.ts` | 新增 `afterWrite` 钩子 + `runAfterWrite` 守卫 + 4 调用点 |
| `server/src/routes/resources.ts` | `/subscriptions` 传入 `afterWrite: () => reloadScheduler()` |
| `server/scripts/smoke.ts` | 新增 12.10 段「订阅写入后自动热重载调度器」6 项检查 |

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

- [x] `pnpm typecheck:server` / `pnpm lint` / `pnpm format:check` 通过
- [x] 根 `tsc -b` 通过
- [x] 隔离冒烟 0 失败（139/139，含 12.10 新增 6 项检查）
- [x] 任务文档归档至 `tasks/done/`
- [ ] **人类批准后**：按 019→020→021 顺序 ff 合并 main + 推送 origin + 删分支

---

## Task Rules

- 钩子异常绝不冒泡出 CRUD 响应（写入已成功）。
- 只给订阅路由挂钩子；其余 5 资源不传（无写后联动需求）。
- 冒烟断言一律用 jobs **增量**（快照库可能带历史启用订阅，绝对值不稳）。

---

## Notes

- 附带修复：客户对话框 `syncSubscription` 创建/更新的订阅（走同一 CRUD
  路由）同样立即注册 job——TASK-017 起「新建客户的订阅不重载不跑」的
  缺口随之闭合。
- 用户决策记录（2026-10-11）：反向同步到客户管理**取消**；自动重载**采纳**。
