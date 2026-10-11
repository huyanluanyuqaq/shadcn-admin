# TASK-013 — 仪表盘流量阈值提醒（50% / 80% / 100%）+ 阈值穿越通知

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-013
Title: 仪表盘流量阈值提醒（50% / 80% / 100%）+ 阈值穿越通知
Workflow: feature
Status: DONE
Priority: P1
Owner: workbuddy
Owner Since: 2026-10-11
Assigned Role: developer
Created: 2026-10-11
Updated: 2026-10-11
Branch: feature/TASK-013-traffic-threshold-alerts
Requires Human Approval: false
```

---

## Objective

在仪表盘新增**流量阈值提醒**能力：客户流量用量达到 **50% / 80% / 100%** 三档阈值时，
通过通知系统（站内 + webhook + Telegram + 飞书）发送提醒；**每次通知取当前所在的最高阈值**，
同一阈值只通知一次（穿越式触发，不重复刷屏）。

---

## Background

用户需求原话：「进入项目 shadcn，仪表盘新增流量阈值提醒，分别为 50% 80% 100%，
达到阈值时需要发送通知提醒，通知每次取当前所在最高的阈值」。

现有基础：
- 通知系统（TASK-010）已有事件目录 + 四渠道派发；`customer.traffic_exhausted`
  覆盖「100% 用尽」但按天去重、无中间档位，且不存在 50% / 80% 预警。
- 提醒扫描（`POST /api/reminders/scan`）已按客户评估到期与流量用尽，
  但**无任何自动触发路径**（当前仅冒烟测试调用），通知实际不会发出。
- 客户流量字段：`traffic_used` / `traffic_total` / `traffic_manual_cap`
  （手动上限优先，`effectiveTrafficTotal` 语义，见 `src/features/customers/utils.ts`）。

---

## Scope

- shared：流量阈值常量与纯函数（`shared/src/schema/traffic.ts`）；新事件
  `customer.traffic_threshold` 入事件目录（`shared/src/schema/notifications.ts`）。
- 后端：`customers` 新增 `traffic_threshold_notified` 列（已通知的最高阈值，
  迁移 0010）；扫描逻辑抽入 service 并扩展阈值评估；调度器新增每日提醒扫描任务；
  仪表盘 stats 增量返回阈值客户列表。
- 前端：仪表盘新增「流量阈值提醒」卡片（阈值徽标 + 用量条 + 已用/上限）；
  Telegram 消息格式补新事件的 emoji 分支。
- 验证：冒烟测试新增流量阈值段；文档（架构 §12 / api-contract）同步。

## Non-Scope

- **不改** `customer.traffic_exhausted` 现有语义（按天去重的用尽提醒保留，
  与阈值穿越通知并存：前者是每日状态提醒，后者是一次性穿越告警）。
- 不做订阅（subscriptions）粒度的阈值——本功能面向仪表盘的客户维度，
  与既有 traffic_exhausted 扫描口径一致。
- 不做阈值档位可配置（50/80/100 写死为常量；如未来要可配置再设 settings KV）。
- 不做「低于阈值后重置通知」的手动重置入口——用量回落后自动重置（见下）。

---

## Requirements

1. 阈值档位：50% / 80% / 100%（`TRAFFIC_THRESHOLDS`，shared 单一事实来源）。
2. 生效上限 = `trafficManualCap ?? trafficTotal`；为 null 或 <= 0 时不评估。
3. **每次通知取当前所在的最高阈值**：如用量一次从 30% 跳到 85%，
   只发一条「达到 80% 阈值」通知，不发 50%。
4. **穿越式触发**：同一客户同一阈值只通知一次；用量回落到该阈值以下后
   状态重置，再次穿越可重新通知（适配月度流量重置 / 手动调量）。
5. 通知走既有 `publish()` 四渠道；`data` 带 `customerId / threshold / percent / used / total`。
6. 仪表盘展示达到阈值的客户（占比 >= 50%），按占比降序，含最高阈值徽标与已通知状态。
7. 扫描自动执行：调度器注册每日任务（默认 09:00，env `REMINDER_SCAN_CRON` 可调）；
   手动入口 `POST /api/reminders/scan` 保留。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 不引入新依赖；shared 改动后必须 `pnpm build:shared`（后端吃 dist） |
| 架构 | `publish()` 一律在事务外调用（C1）；扫描写库用单事务（C2） |
| 兼容 | `POST /api/reminders/scan` 响应保持含 `created` 字段（增量扩展） |
| 性能 | 扫描为全客户内存计算 + 单事务，客户量为百级，无压力 |
| 安全 | 无敏感数据入通知；消息只含客户名与用量 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-010 通知功能 | blocks | 已完成 |
| TASK-006 订阅同步引擎（调度器模式） | blocks | 已完成 |

---

## Acceptance Criteria

- [x] AC-1: shared 导出 `TRAFFIC_THRESHOLDS = [50, 80, 100]` 与
      `highestTrafficThreshold(used, limit)`，前后端共用同一实现。
- [x] AC-2: 事件目录新增 `customer.traffic_threshold`，webhook / Telegram /
      飞书的事件选择器自动出现该事件（目录驱动，无需改前端选择器）。
- [x] AC-3: 客户从 <50% 穿越到 >=50%：扫描后产生 1 条站内通知 +
      1 次外部派发，`customers.traffic_threshold_notified = 50`；
      再次扫描不重复通知。
- [x] AC-4: 客户一次跳到 85%：只发「80% 阈值」一条（最高阈值），
      `traffic_threshold_notified = 80`。
- [x] AC-5: 客户回落到 30%：`traffic_threshold_notified` 重置为 0，无通知；
      再次爬到 60% 时重新发「50% 阈值」。
- [x] AC-6: 手动上限（trafficManualCap）优先于月流量参与计算。
- [x] AC-7: `GET /api/dashboard/stats` 返回 `trafficThresholds` 列表，
      仪表盘渲染「流量阈值提醒」卡片。
- [x] AC-8: 调度器在启用时注册每日扫描任务；`pnpm build` /
      `pnpm --filter server typecheck` / 冒烟全部通过。

---

## File Scope

```yaml
File Scope:
  - shared/src/schema/traffic.ts          # 新增
  - shared/src/schema/notifications.ts    # 事件目录
  - shared/src/index.ts                   # 导出
  - server/src/db/schema.ts               # customers 新列
  - server/drizzle/0010_*.sql             # 迁移（generate 产物）
  - server/src/services/traffic-threshold.ts   # 新增：阈值扫描 + 状态列表
  - server/src/services/reminder-scan.ts       # 新增：扫描逻辑（自 reminders 路由抽出）
  - server/src/routes/reminders.ts        # 调 service
  - server/src/routes/dashboard.ts        # stats 增量
  - server/src/services/scheduler.ts      # 每日扫描任务
  - server/src/index.ts                   # 注册任务
  - server/src/services/telegram.ts       # 新事件 emoji 分支
  - server/scripts/smoke.ts               # 冒烟段
  - src/features/dashboard/**             # 卡片 + stats 类型
  - src/features/customers/utils.ts       # 流量函数改从 shared 再导出（去重）
  - shared/src/schema/entities.ts         # dashboardStatsSchema 增量
  - docs/architecture/overview.md         # §12 事件表 + §12.7
  - docs/technical/api-contract.md        # scan / stats 契约
  - tasks/active/TASK-013-traffic-threshold-alerts/**
Non-Scope (files):
  - server/src/routes/webhooks.ts         # 无需改动（目录驱动）
  - src/features/notifications/**         # 无需改动（目录驱动）
```

---

## Implementation Plan

1. shared：`traffic.ts`（阈值常量 / `highestTrafficThreshold` / `trafficUsagePercent` /
   `effectiveTrafficTotal` / `formatTrafficBytes`）+ 事件目录追加
   `customer.traffic_threshold` + `pnpm build:shared`。
2. 后端：schema 加列 → drizzle-kit generate 迁移 0010 → db:migrate。
3. 后端：`traffic-threshold.ts`（扫描：单事务更新 notified 列 + 事务外 publish；
   状态列表：供仪表盘）+ `reminder-scan.ts`（原扫描逻辑搬家，路由改薄）。
4. 后端：调度器每日任务（env `REMINDER_SCAN_CRON`，默认 `0 9 * * *`）。
5. 前端：`dashboardStatsSchema` 增量 + 仪表盘卡片组件 + 接线。
6. Telegram emoji 分支；冒烟段；文档；验证。

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1/2 | 类型检查 + 单测 | `pnpm build`、`pnpm --filter server typecheck` |
| AC-3~6 | 冒烟（真实服务 + DB） | `pnpm --filter server smoke`（新增阈值段） |
| AC-7 | 冒烟 + 手工 | stats 响应含 trafficThresholds；`pnpm dev` 看卡片 |
| AC-8 | 冒烟退出码 + typecheck | 见上 |

---

## Current State

> 2026-10-11：全部实施与验证完成，Status=DONE，归档至 tasks/done/。
>
> **实施记录**：
> 1. shared：新建 `schema/traffic.ts`（阈值常量 + 4 个纯函数，唯一事实来源）；
>    事件目录追加 `customer.traffic_threshold`（第 6 个事件）；
>    `dashboardStatsSchema` 增量 `trafficThresholds`；`pnpm build:shared`。
> 2. 后端：`customers` 新增 `traffic_threshold_notified` 列 + drizzle 迁移 0010
>    （已 db:migrate）；新建 `traffic-threshold.ts`（穿越式扫描：单事务更新
>    notified 列 + 事务外 publish；只读状态列表）与 `reminder-scan.ts`
>    （扫描逻辑自 reminders 路由抽出，消除「无自动触发路径」问题）；
>    reminders 路由瘦身；dashboard stats 增量；调度器注册每日提醒扫描任务
>    （env `REMINDER_SCAN_CRON`，默认 `0 9 * * *`）；Telegram 新事件 emoji 分支。
> 3. 前端：`src/features/customers/utils.ts` 的三个流量函数改为从 shared
>    再导出（消除双实现）；新建仪表盘「流量阈值提醒」卡片（阈值徽标 +
>    用量条 + 已通知状态，置于「即将到期客户」卡片前）。
> 4. 验证：冒烟新增 11.5 段 12 个 check（穿越/取最高/回落重置/手动上限优先/
>    stats 断言，含演示数据 DELETE 清理）；前端单测目录计数 5→6；
>    shared 新增 traffic 单测 14 例。
>
> **验证结果**：冒烟 118/118；前端全量单测 162/162（15 文件）；
> `pnpm build` / `pnpm --filter server typecheck` / lint / format:check 全绿；
> 端口 3000 实测 stats 返回 `trafficThresholds`、scan 返回
> `{ created, thresholds: { checked, notified, reset } }`。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| shared/src/schema/traffic.ts | 新增 | 阈值常量 + effectiveTrafficTotal / trafficUsagePercent / highestTrafficThreshold / formatTrafficBytes |
| shared/src/schema/traffic.test.ts | 新增 | 14 个单测（含 49.6% 不提前触发、跳档取最高） |
| shared/src/schema/notifications.ts | 修改 | 事件目录追加 `customer.traffic_threshold`（第 6 个事件） |
| shared/src/schema/entities.ts | 修改 | dashboardStatsSchema 增量 `trafficThresholds` |
| shared/src/index.ts | 修改 | 导出 schema/traffic.js |
| server/src/db/schema.ts | 修改 | customers 新增 `traffic_threshold_notified` 列 |
| server/drizzle/0010_little_blockbuster.sql | 新增 | 迁移 0010（已应用） |
| server/drizzle/meta/0010_snapshot.json | 新增 | 迁移快照 |
| server/src/services/traffic-threshold.ts | 新增 | 穿越式阈值扫描 + 状态列表（单事务 + 事务外 publish） |
| server/src/services/reminder-scan.ts | 新增 | 扫描逻辑 service 化（自 reminders 路由抽出） |
| server/src/routes/reminders.ts | 修改 | POST /scan 瘦身，响应增量 `thresholds` |
| server/src/routes/dashboard.ts | 修改 | stats 增加 `trafficThresholds` |
| server/src/services/scheduler.ts | 修改 | 新增每日提醒扫描 job（env `REMINDER_SCAN_CRON`） |
| server/src/index.ts | 修改 | enableScheduler 时注册扫描 job |
| server/src/services/telegram.ts | 修改 | 新事件 emoji/文案分支 |
| server/scripts/smoke.ts | 修改 | 新增 11.5 段 12 check；事件计数 5→6 两处 |
| src/features/customers/utils.ts | 修改 | 流量函数改为从 shared 再导出（去双实现） |
| src/features/dashboard/index.tsx | 修改 | 插入「流量阈值提醒」卡片 |
| src/features/dashboard/components/traffic-threshold-list.tsx | 新增 | 阈值卡片组件（阈值配色 50 amber/80 orange/100 destructive） |
| src/features/notifications/data/schema.test.ts | 修改 | 目录计数 5→6，Telegram/飞书默认集补新事件断言 |
| docs/architecture/overview.md | 修改 | §12.1 事件表 + 新增 §12.7 流量阈值提醒决策表 |
| docs/technical/api-contract.md | 修改 | scan/stats 契约 + 客户字段区补 `traffic_threshold_notified` 说明 |
| tasks/active/TASK-013-traffic-threshold-alerts/** | 新增 | 任务档案（本目录） |

---

## Known Issues

> 无。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 1 | developer | reviewer/next | 2026-10-11 | 见 handoffs/HANDOFF-001-developer-to-reviewer.md |

---

## Task Rules

- [补充] shared 的流量纯函数是唯一事实来源；`src/features/customers/utils.ts`
  中同名函数改为从 shared 再导出，禁止两套实现漂移。

---

## Notes

- 与 `customer.traffic_exhausted` 的关系：100% 档穿越时会同时存在一条阈值通知
  （一次性）与当天的用尽提醒（按天）。两者语义不同，刻意保留，不互相抑制。
