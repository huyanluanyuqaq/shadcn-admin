# TASK-025 — Telegram / 飞书通知富格式排版（参照订阅更新样例）

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-025
Title: Telegram / 飞书通知富格式排版（参照订阅更新样例）
Workflow: feature
Status: DONE
Priority: P1
Owner: workbuddy
Owner Since: 2026-10-13
Assigned Role: developer
Created: 2026-10-13
Updated: 2026-10-13
Branch: feat/TASK-025-notification-rich-format
Requires Human Approval: false
```

---

## Objective

Telegram 与飞书通知内容过于简单（仅标题 + 一句话）。参照用户提供的订阅更新样例：

```
✅ 订阅更新
订阅: 宝可梦-MOXIMOXI-94
✅订阅【宝可梦-MOXIMOXI-94】节点同步完成，耗时 0秒，总节点【32】个，……
📊 用量信息
⬆️ 上传: 0 B
⬇️ 下载: 0 B
📦 总量: 60.00 GB
⏳ 过期: 2026-10-29 13:17:29
```

为两个外部渠道实现**分事件的富文本正文**：emoji 分区、`标签: 值` 逐行展示、
字节 human-readable、本地时间 datetime。本项目**不解析节点列表**（无节点统计
数据），故节点数字段（总节点/新增/更新/已存在/删除失效）不纳入，以「耗时 +
用量/到期信息」替代，保持样例的结构与观感。

---

## Background

通知系统建于 TASK-010~012：`publish()` 统一构造 payload，四渠道分发
（in_app / webhook / telegram / feishu）。Telegram 侧 `formatTelegramMessage`
仅按事件换标题 emoji + 加粗，正文就是 `payload.message` 一句话；飞书卡片同理。
用户反馈信息量不足，给出目标样例。

可用数据盘点（触发点现状）：

| 事件 | 现有 data | 缺口 |
|------|-----------|------|
| subscription.sync_succeeded（单条） | subscriptionId, url | name、upload/download/trafficTotal/expireAt、耗时 |
| subscription.sync_succeeded（批量） | total, changed | succeeded、耗时、用量汇总 |
| subscription.sync_failed（单条/批量） | subscriptionId, url / total, failed, failures | name（批量失败明细带订阅名） |
| customer.expire_soon | customerId, expireAt, daysLeft | name |
| customer.traffic_exhausted | customerId | name、used、total |
| customer.traffic_threshold | customerId, threshold, percent, used, total | name |
| security.user_login | username | 无（时间取 payload.time） |

---

## Scope

- 新增 `server/src/services/notification-format.ts`：纯函数富文本排版
  （`formatNotificationBody` + 时间/时长格式化 + data 安全读取），
  Telegram 与飞书共用；字节格式复用 shared `formatTrafficBytes`
- `server/src/services/telegram.ts`：`formatTelegramMessage` = 事件标题头
  （保持现有 emoji + HTML 加粗）+ 富格式正文（HTML 转义后拼接）
- `server/src/services/feishu.ts`：`formatFeishuCard` 正文由 `payload.message`
  改为富格式正文（lark_md）；本地 formatTime 去重，改引用共享模块
- 触发点 data 充实：`subscription-sync.ts`（单条/批量成功与失败）、
  `reminder-scan.ts`（到期/用尽）、`traffic-threshold.ts`（name）
- 测试：formatter 单测（`server/src/services/notification-format.test.ts`）；
  `server/scripts/smoke.ts` 新增订阅同步事件经两渠道派发的富格式断言
- 文档：`docs/architecture/overview.md` 通知小节补充富格式口径

## Non-Scope

- **节点统计**：本项目无节点解析/落库，不新增节点相关字段与通知内容
- in_app（站内）与 webhook 渠道的文案不变（仍用 `title` + `message`）
- 通知事件目录、渠道配置、订阅开关语义不变
- 前端无改动

---

## Requirements

1. 富格式正文按事件分支，结构与样例一致：标题行 / 对象行（`订阅: xxx`）/
   状态摘要行 / `📊 用量信息` 分区（⬆️上传 ⬇️下载 📦总量 ⏳过期）
2. 用量字节用 shared `formatTrafficBytes`（0 → `0 B`，空 → `-`）；
   到期为本地时间 `YYYY-MM-DD HH:mm:ss`；耗时为秒（一位小数）
3. 批量同步成功消息含用量汇总（全部成功订阅求和）与「最近到期」；
   批量失败含前 3 条失败明细（订阅名 + 原因）
4. data 字段命名统一：用量 `upload` / `download` / `trafficTotal` /
   `expireAt`（epoch ms）；批量计数 `total` / `succeeded` / `changed` /
   `failed`；批量以 `batch: true` 判别
5. 缺失字段优雅降级（`-`），不得抛错；`data` 为空时回落 `payload.message`

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 不引入新依赖；排版模块为纯函数，不碰 DB / 网络 |
| 兼容 | 保持既有 smoke 断言兼容（Telegram `🔐 <b>管理员登录</b>` 与「管理员 x 登录成功」；飞书 header title=管理员登录 且 elements[0] lark_md 含「登录成功」） |
| 性能 | publish 为 fire-and-forget，格式化同步执行但为 O(1) 字符串拼接 |
| 安全 | 用户内容（订阅名等）在 Telegram 侧必须 HTML 转义（沿用现有 escapeHtml） |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-010~012（通知系统） | blocks | 已完成 |
| TASK-013 / TASK-023（流量口径） | 参考 | 已完成 |

---

## Acceptance Criteria

- [x] AC-1: 订阅同步成功（单条）通知含「订阅: <name>」「✅订阅【<name>】同步完成，耗时 x 秒」「📊 用量信息」「⬆️ 上传」「⬇️ 下载」「📦 总量」「⏳ 过期」七类信息，字节与时间格式符合 Requirement 2
- [x] AC-2: 批量同步成功/失败、同步失败（单条）、到期、用尽、阈值、登录七类事件的 Telegram 与飞书消息均为富格式且无字段错位
- [x] AC-3: formatter 单测覆盖全部事件分支与降级路径，通过（18 例）
- [x] AC-4: 隔离冒烟通过，含新增「同步事件经两渠道派发富格式」断言（148 项，0 失败）
- [x] AC-5: `pnpm --filter server typecheck` / `pnpm lint` / `pnpm format:check` / 前端 `pnpm test` 全绿（232 例）
- [x] AC-6: 架构文档已更新富格式口径（§12.6.1 + 两渠道消息格式行）；TASK.md Changed Files 如实填写

---

## File Scope

```yaml
File Scope:
  - server/src/services/notification-format.ts      # 新增
  - server/src/services/notification-format.test.ts # 新增
  - server/src/services/telegram.ts
  - server/src/services/feishu.ts
  - server/src/services/subscription-sync.ts
  - server/src/services/reminder-scan.ts
  - server/src/services/traffic-threshold.ts
  - server/scripts/smoke.ts
  - docs/architecture/overview.md
  - tasks/active/TASK-025-notification-rich-format/**
Non-Scope (files):
  - shared/**                # 无 schema 变更（仅引用既有 formatTrafficBytes）
  - src/**                   # 前端无改动
  - server/src/routes/**     # 路由层无改动
```

---

## Implementation Plan

1. 新建 notification-format.ts（纯排版 + data 读取助手）
2. telegram.ts / feishu.ts 接入
3. 触发点 data 充实（subscription-sync / reminder-scan / traffic-threshold）
4. 单测 + 冒烟断言
5. 验证三件套 + 隔离冒烟 + 前端测试
6. 文档更新、归档、提交

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|-------------|
| AC-1/AC-2 | 单测 + 冒烟 | `pnpm vitest run --browser.headless server/src/services/notification-format.test.ts`；隔离冒烟（VACUUM 快照 → PORT=3002 → SMOKE_BASE_URL） |
| AC-5 | 命令 | `pnpm typecheck:server && pnpm lint && pnpm format:check && pnpm test` |

---

## Current State

> 2026-10-13 00:02 任务创建，进入实现。
> 2026-10-13 01:30 全部完成：排版模块 + 两渠道接入 + 触发点 data 充实 + 单测 18 例 +
> 冒烟新增 17.9 富格式断言（148/148）+ 三件套与前端 232 例全绿 + 架构文档 §12.6.1。
> 待归档 done/ 并提交。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| server/src/services/notification-format.ts | 新增 | 富格式排版纯函数模块（Telegram/飞书共用）：时间/时长格式化、data 安全读取、七类事件分支 + 降级 |
| server/src/services/notification-format.test.ts | 新增 | 18 例单测：全事件分支、缺失字段降级、批量截断、时区无关断言 |
| server/src/services/telegram.ts | 修改 | EVENT_HEADERS 标题头表 + formatTelegramMessage 改为「标题头 + 富格式正文」（HTML 转义后拼接） |
| server/src/services/feishu.ts | 修改 | formatFeishuCard 正文改富格式（lark_md）；删除本地 formatTime，改引用共享模块 |
| server/src/services/subscription-sync.ts | 修改 | 单条/批量 publish data 充实：name、upload/download/trafficTotal/expireAt(ms)/elapsedMs、batch 判别、失败明细带订阅名、批量用量汇总（求和 + 最早到期） |
| server/src/services/reminder-scan.ts | 修改 | expire_soon / traffic_exhausted 的 data 增加 name（及 used/total） |
| server/src/services/traffic-threshold.ts | 修改 | traffic_threshold 的 data 增加 name |
| server/scripts/smoke.ts | 修改 | 新增 17.9：重开两渠道 mock + mock 上游触发真实同步，断言 Telegram 富格式正文七要素与飞书富格式卡片 |
| docs/architecture/overview.md | 修改 | §12.5/§12.6 消息格式行更新；新增 §12.6.1 富格式正文小节（结构、字段约定、降级、转义口径） |

---

## Known Issues

无。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | developer | reviewer | 2026-10-13 | 实现+测试+文档完成，全绿待复核；节点统计未纳入（无数据源），用量汇总口径已注明 |

**最新 Handoff：** `handoffs/HANDOFF-001-developer-to-reviewer.md`
**Next Action：** Reviewer 按 AC-1~AC-6 复核；PASS 后提交合并（本任务已随合并归档 done/）

---

## Notes

参照样例来自用户提供的另一系统（sublinkPro 风格）通知文本；本项目无节点数据，
按「结构对齐、节点字段剔除、用量信息保留」适配。
