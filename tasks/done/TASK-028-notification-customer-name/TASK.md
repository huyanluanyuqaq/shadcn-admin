# TASK-028 — 渠道通知消息增加客户名称归属行

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-028
Title: 渠道通知消息增加客户名称归属行
Workflow: feature
Status: DONE
Priority: P1
Owner: workbuddy
Owner Since: 2026-10-13
Assigned Role: developer
Created: 2026-10-13T08:29:34Z
Updated: 2026-10-13T09:03:54Z
Branch: feat/TASK-028-notification-customer-name
Requires Human Approval: false
```

---

## Objective

渠道（Telegram / 飞书）的订阅同步通知只展示订阅名，看不出这条订阅属于谁。
在富格式正文中增加一行**归属行**：已绑定客户显示客户名称，未绑定客户但留了
邮箱显示邮箱，二者皆无则提示「该订阅暂未使用」。

---

## Background

TASK-025 落地通知富格式后，正文结构为：标题头 → 对象行（`订阅: xxx`）→ 状态摘要行
→ 📊 用量信息。但订阅与客户的关联（`subscriptions.customer_id`）只在数据库侧存在，
通知侧完全丢失。

数据模型现状（schema.ts）：
- `subscriptions.customer_id` → `customers.id`（ON DELETE CASCADE），null 表示未绑定
- `subscriptions.email` → 该订阅的邮箱标识（与邮箱绑定表独立，由订阅表单填写）
- 订阅列表（`subscriptions-columns.tsx`）已按 `customerNameById` 展示归属，
  但通知侧未走 join

用户诉求（两轮明确）：
1. 「渠道通知消息要增加一行客户名称显示」
2. 「未绑定客户的订阅可以显示为邮箱」

---

## Scope

- `server/src/services/notification-format.ts`：新增 `customerLine()` 归属行排版，
  单条同步成功/失败两条事件分支插入归属行
- `server/src/services/subscription-sync.ts`：`loadSyncRows()` 一次性 join 查询
  订阅 + 归属客户（`customers.name`），避免 N+1；`publish()` data 增加
  `customerName` / `email`
- `server/src/services/notification-format.test.ts`：归属行三种分支 + 空值降级共 6 例
- `server/scripts/smoke.ts`：17.9 新增「已绑定客户的订阅同步成功通知含客户名称」
  与「未绑定客户提示暂未使用」断言
- `docs/architecture/overview.md`：§12.6.1 富格式正文结构更新为五段，新增归属行决策表

## Non-Scope

- 批量同步事件（`batch: true`）不新增归属行——汇总消息面向全部订阅，无单一归属
- 客户提醒事件（expire_soon / traffic_exhausted / traffic_threshold）本身已带
  `客户: xxx` 行，不变
- in_app / webhook 渠道文案不变（仍为 `title` + `message`）
- 无 schema 变更、无迁移、无前端改动
- 不引入新依赖

---

## Requirements

1. 归属行位于对象行之后、状态摘要行之前，不破坏既有富格式结构
2. 优先级：`customerName` 非空 → `客户: <name>`；否则 `email` 非空 → `邮箱: <email>`；
   否则 → `该订阅暂未使用`
3. 空字符串与纯空白字符串视为无值（`readStr` 的 trim 语义）
4. 归属信息随 `publish()` 的 `data` 传递，formatter 纯函数读取，不碰 DB
5. 单条同步的 join 查询一次取齐，不得在循环内逐条查客户

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 排版模块保持纯函数；join 查询为只读，不持锁、不写库 |
| 兼容 | 现有单测期望需同步更新归属行；smoke 17.9 既有富格式断言不变，仅追加 |
| 性能 | `loadSyncRows` 替代原 `db.select().from(subscriptions)`，结果集规模不变 |
| 安全 | 客户名/邮箱为用户内容，转义仍由渠道层负责（Telegram `formatTelegramMessage`） |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-025（通知富格式） | blocks | 已完成 |
| TASK-017（订阅写后回写客户用量） | 参考 | 已完成 |

---

## Acceptance Criteria

- [x] AC-1: 单条同步成功通知含归属行，三种分支（客户名/邮箱/暂无）均正确渲染
- [x] AC-2: 单条同步失败通知同样含归属行
- [x] AC-3: 归属行位于对象行之后、状态摘要行之前，不破坏既有富格式结构
- [x] AC-4: formatter 单测覆盖三种分支 + 空值/空白降级，23 例全绿
- [x] AC-5: `pnpm --filter server typecheck` / `pnpm lint` / `pnpm format:check` / `pnpm test` 全绿（251 例）
- [x] AC-6: 架构文档 §12.6.1 已更新富格式结构与归属行决策

---

## File Scope

```yaml
File Scope:
  - server/src/services/notification-format.ts      # 修改：新增 customerLine() + 归属行
  - server/src/services/notification-format.test.ts # 修改：6 例归属行测试
  - server/src/services/subscription-sync.ts        # 修改：loadSyncRows join + publish data
  - server/scripts/smoke.ts                         # 修改：17.9 追加归属行断言
  - docs/architecture/overview.md                   # 修改：§12.6.1
  - tasks/done/TASK-028-notification-customer-name/**
Non-Scope (files):
  - shared/**                # 无 schema 变更
  - src/**                   # 前端无改动
  - server/src/routes/**     # 路由层无改动
```

---

## Implementation Plan

1. formatter 新增 `customerLine()` 归属行，单条成功/失败事件插入
2. `subscription-sync.ts` 用 `loadSyncRows()` 一次性 join 查询归属信息
3. formatter 单测 + smoke 断言
4. 验证三件套 + 全量测试
5. 文档更新、归档

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|-------------|
| AC-1/AC-2/AC-3 | 单测 | `pnpm vitest run --browser.headless server/src/services/notification-format.test.ts` |
| AC-5 | 命令 | `pnpm --filter server typecheck && pnpm lint && pnpm format:check && pnpm test` |
| AC-6 | 文档 | 核对 §12.6.1 结构与归属行决策表 |

---

## Current State

> 2026-10-13 08:29 任务创建并实现完成：formatter 归属行 + sync join 查询 + 单测 6 例 +
> smoke 断言 + 架构文档。
> 2026-10-13 08:29 三件套全绿（typecheck / lint / format:check），`pnpm test` 251/251 通过。
> 2026-10-13 09:32 fast-forward 合入 main（`108231a`）并推送；CI run 38377043005 success。

## Merge Record

- 功能提交 `7361e3d`（feat(server)），任务档案 `108231a`（docs(task)），
  经 fast-forward 合入 main 并推送。
- CI 验证：run **38377043005 success**（install-lint-build 全绿）。
- Docker 构建（run 38377042676）随推送执行并成功。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| server/src/services/notification-format.ts | 修改 | 新增 `customerLine()` 归属行（客户名 > 邮箱 > 该订阅暂未使用）；单条同步成功/失败插入归属行；模块头注释更新为五段结构 |
| server/src/services/notification-format.test.ts | 修改 | 6 例：已绑定客户显示客户名、仅留邮箱显示邮箱、两者皆无暂未使用、客户名为空走邮箱、邮箱仅空白走暂无、单条失败含归属行；修正既有完整字段期望 |
| server/src/services/subscription-sync.ts | 修改 | 新增 `SyncRow` 类型与 `loadSyncRows()`（subscriptions left join customers，避免 N+1）；`displayName()` / `ownershipData()` 抽取；`syncOne` / `syncMany` 统一走 join 查询 + publish data 带 customerName/email；删除未使用的 `ownershipBySub` Map |
| server/scripts/smoke.ts | 修改 | 17.9 追加：创建第二个客户并绑定订阅 → 同步 → 断言通知含「客户: smoke-customer2-xxx」；未绑定订阅断言含「该订阅暂未使用」；清理新增资源；头注更新 |
| docs/architecture/overview.md | 修改 | §12.6.1 富格式正文结构由四段改为五段，示例补归属行；决策表新增「归属行」一行（优先级、数据来源、join 方式） |

---

## Known Issues

无。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | developer | system | 2026-10-13 | 实现+测试+文档完成，三件套与全量测试全绿 |

**最新 Handoff：** `handoffs/HANDOFF-001-developer-to-system.md`
**Next Action：** 隔离环境跑 `pnpm smoke` 验证 17.9 归属行端到端断言（需 mock 上游 + Telegram/飞书 API 覆盖）；其余已闭环。

---

## Notes

- 归属行只注入单条同步事件（`syncOne` 的 success/failure）。批量同步（`syncMany`）
  是汇总消息，面向全部订阅，无单一归属，刻意不注入——避免产生歧义的「客户: xxx」
- `loadSyncRows` 替代原 `db.select().from(subscriptions)` 时保留了原筛选语义：
  指定 ids 时按 ids 取（不管开关），未指定时取全部启用的订阅。drizzle-orm 0.45
  的 `filter(` 尚不可用，改用 `.where()` + 内存排除 in-flight
- 2026-10-13 用户补充「未绑定客户的订阅可以显示为邮箱」，已纳入优先级第二顺位