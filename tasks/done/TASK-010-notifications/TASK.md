# TASK-010 — 通知功能：事件目录 + Webhook 派发 + 站内通知（参照 sublinkPro）

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-010
Title: 通知功能：事件目录 + Webhook 派发 + 站内通知（参照 sublinkPro）
Workflow: feature
Status: DONE
Priority: P1
Owner: workbuddy
Owner Since: 2026-10-11
Assigned Role: developer
Created: 2026-10-11
Updated: 2026-10-11
Completed: 2026-10-11
Branch: feature/TASK-010-notifications
Requires Human Approval: false
```

> **登记说明（诚实记录）：** 本 Task 为**补登**。工作成果在登记前已完成，
> 所有 Verification Plan 中的验证均在补登时真实执行，非事后补写。
> 登记时顺带修复了一个 TASK-004 遗留的仓库缺陷（见 Known Issues #1）。

---

## Objective

参照开源项目 [sublinkPro](https://github.com/ZeroDeng01/sublinkPro)（Go + React）的
通知设计，为本项目增加完整的通知能力：

1. **事件目录**：点分层级事件 key 集中定义，前后端共用（`shared/src/schema/notifications.ts`）
2. **通用 Webhook 渠道**：URL / 方法 / Content-Type / 自定义请求头 / 自定义 Body 模板
   + 模板变量替换，每条 webhook 自选订阅事件；凭模板变量可零改代码接入
   PushDeer / Bark / 钉钉 / 方糖等官方 webhook 地址
3. **异步派发器**：并发上限 4、10s 超时、失败仅记日志不阻断主流程
4. **站内渠道（in_app）**：复用 `reminders` 表 + Header 通知铃铛 + 通知中心页
5. **触发点接入**：订阅同步（成功/失败）、提醒扫描（到期/流量）、管理员登录

---

## Background

用户需求原话：「进入 shadcn 项目，按照 sublinkpro 的设计增加通知功能」。

2026-10-11 调研 sublinkPro 源码确认其通知三件套设计：

| sublinkPro 组件 | 职责 | 本项目对应 |
|-----------------|------|-----------|
| `services/notifications/catalog.go` | 事件目录（key/名称/分类/严重级/渠道/默认启用） | `shared/src/schema/notifications.ts` 的 `notificationEventCatalog` |
| `models/webhook.go` + `api/webhook.go` | Webhook CRUD + 测试发送 | `server/src/routes/webhooks.ts` + `webhooks` 表 |
| `services/notifications/publish.go` | `Publish` → `TriggerWebhook` → `SendWebhook` 异步派发 | `server/src/services/notifications.ts` |
| `webs/src/views/webhooks/index.jsx` | Webhook 管理页 + 设置页事件选择器 | `src/features/notifications/`（管理页 + 铃铛 + 通知中心） |

**模板变量替换语义**（逐条核对 sublinkPro 实现后采纳）：
URL 替换用 `encodeURIComponent`，JSON body 用 JSON 字符串转义，form 用 URL 编码；
变量集 `{{title}} {{message}} {{time}} {{event}} {{eventName}} {{severity}}
{{category}} {{categoryName}}`，body 另支持 `{{json .}}`。

**渠道取舍**：sublinkPro 另有 Telegram 渠道，首期**不实现**（无 Bot 依赖诉求），
但事件目录的 `channels` 字段保留扩展位，新增渠道不改派发器结构。

---

## Scope

- shared：通知事件目录 + webhook zod schema（前后端共用契约）
- 后端：`webhooks` 表 + 迁移 0009；通知服务（目录 + 派发器 + 测试发送）；
  webhooks CRUD/启停/测试 API；reminders 增 `unread-count` / `read-all`
- 触发点：subscription-sync（C8 增量对比）、reminders scan（仅新提醒）、auth 登录
- 前端：Webhook 管理页（`/webhooks`）、通知中心（`/notifications`）、
  Header 通知铃铛（6 个业务页挂载）、侧边栏入口
- 测试：schema 单测 9 例；server 冒烟 +14 项（第 14 段）
- 文档：`docs/architecture/overview.md` §12 通知设计章节 + §5 数据模型补行

## Non-Scope

- **不实现** Telegram / 邮件 / 钉钉机器人等专用渠道（通用 Webhook 已覆盖其地址形态）
- 不做通知的「每事件独立开关」持久化（目录 `defaultEnabled` 即生效规则；
  用户级过滤靠 webhook 自选事件实现）
- 不改 `src/components/ui/**`、不动 `routeTree.gen.ts` 生成逻辑（仅重新生成）

---

## Requirements

| 类型 | 内容 |
|------|------|
| 质量 | `pnpm build` / `pnpm lint` / `pnpm typecheck:server` / `pnpm format:check` 全绿 |
| 质量 | `pnpm test` 全绿（含新增 9 例）；`pnpm --filter server smoke` 全绿（含新增 14 项） |
| 正确 | webhook 派发为 fire-and-forget，单渠道失败不阻断主流程（同步/扫描/登录） |
| 正确 | 模板变量在 URL / JSON body / form 三种形态下分别按对应转义规则替换 |
| 正确 | `sync_succeeded` 仅在用量/到期**真正变化**时触发（C8 增量对比，防刷屏） |
| 正确 | 提醒扫描仅在**新生成**提醒时触发通知（防重复扫描重复推送） |
| 兼容 | 站内通知复用 `reminders` 表，兼容旧 `type` 值（`expire`/`traffic`） |
| 安全 | webhook URL 限 http/https；自定义 headers 限 JSON 对象；事件 key 限目录内 |

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 派发并发上限 4、单次超时 10s（对齐 sublinkPro 的 `Timeout: 10s`） |
| 技术 | `publish` 一律在事务外调用（遵守 §10 C1：事务内禁网络 IO） |
| 技术 | shared 改后必须 `pnpm build:shared`（后端消费 dist） |
| 数据 | 时间列 `timestamp_ms` 毫秒、布尔列 `integer mode:'boolean'`、JSON 列 text 存储 |
| 术语 | 界面文案一律「供应商」，数据层历史名称不变（见 MEMORY.md 约定） |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-006（订阅同步引擎） | 触发点宿主（C8 增量对比已就绪） | 已完成 |
| TASK-003（领域 CRUD） | 页面范式与 API 工厂复用 | 已完成 |
| TASK-009（工程卫生） | 质量门禁基线（lint/format/test） | 已完成 |

---

## Acceptance Criteria

- [x] AC-1 事件目录在 shared 定义，含 5 事件 × (webhook + in_app) 双渠道
- [x] AC-2 webhook CRUD / 启停 / 测试发送 API 可用，测试失败返 502 + message
- [x] AC-3 自定义 Body 模板变量替换正确（URL/JSON/form 三种转义语义）
- [x] AC-4 派发异步、并发上限 4、10s 超时、失败仅记日志不阻断
- [x] AC-5 站内通知写入 reminders，铃铛未读角标 + 通知中心筛选/分页/已读可用
- [x] AC-6 三个触发点（同步成败 / 提醒扫描 / 登录）按增量对比原则接入
- [x] AC-7 `pnpm test` 127/127（含新增 9 例）、smoke 77/77（含新增 14 项）
- [x] AC-8 端到端人工验证：mock webhook 收到三类事件且模板渲染正确

---

## File Scope

```yaml
File Scope:
  - shared/src/schema/notifications.ts        # 新增：事件目录 + webhook schema
  - shared/src/index.ts                       # 导出 notifications
  - shared/src/schema/enums.ts                # logModuleSchema += 'notification'
  - server/src/db/schema.ts                   # webhooks 表（第 11 张表）
  - server/drizzle/0009_long_omega_flight.sql # 新增迁移（已 apply）
  - server/src/services/notifications.ts      # 新增：目录 + 派发器 + 测试发送
  - server/src/routes/webhooks.ts             # 新增：CRUD/启停/测试 API
  - server/src/routes/reminders.ts            # unread-count / read-all；scan 仅新提醒触发
  - server/src/services/subscription-sync.ts  # 同步成败触发（C8 增量）
  - server/src/routes/auth.ts                 # 登录触发
  - server/src/index.ts                       # 注册 /api/webhooks
  - server/scripts/smoke.ts                   # 第 14 段 14 项
  - src/features/notifications/**             # 新增：api/页面/组件/单测（14 文件）
  - src/routes/_authenticated/webhooks/**     # 新增路由
  - src/routes/_authenticated/notifications/**# 新增路由
  - src/components/layout/data/sidebar-data.ts# 通知中心 + Webhook 管理入口
  - src/features/{dashboard,customers,subscriptions,plans,emails,logs}/index.tsx  # 挂铃铛
  - src/routeTree.gen.ts                      # 重新生成
  - .gitignore                                # logs → /logs（修复误伤，见 KI#1）
  - docs/architecture/overview.md             # §5 表 + §12 通知设计
  - tasks/done/TASK-010-notifications/**
Non-Scope (files):
  - src/components/ui/**
  - server/src/routes/customers|subscriptions|plans|email-bindings|dashboard|settings.ts
```

---

## Implementation Plan

1. 下载并研读 sublinkPro 通知源码（catalog/config/publish.go、webhook.go、
   webhooks/index.jsx），提取事件目录 / 模板变量 / 派发语义
2. shared 层落地事件目录与 webhook zod schema（前后端契约）
3. 后端：webhooks 表 + 迁移 → 通知服务（派发器）→ CRUD/测试 API → reminders 扩展
4. 触发点接入：同步（C8 增量）/ 扫描（仅新提醒）/ 登录
5. 前端：管理页 + 通知中心 + 铃铛 + 路由 + 侧边栏 + 6 页挂载
6. 测试补齐（schema 单测 + smoke 第 14 段）→ 全量门禁 → 端到端人工验证

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 | 结果 |
|--------|------|------------|------|
| AC-7 测试 | 命令 | `pnpm test`（vitest browser headless） | ✅ 127/127（含新增 9 例） |
| AC-7 冒烟 | 命令 | `pnpm --filter server smoke` | ✅ 77/77（含新增 14 项） |
| AC-2/3 API | 冒烟 + 人工 | 创建 → 列表 → 启停 → 测试发送 502 → 删除 | ✅ 第 14 段全覆盖 |
| AC-8 端到端 | 人工 | mock HTTP 服务收包 + 登录/同步失败/测试发送三路触发 | ✅ 三类请求均收到，模板渲染正确 |
| 质量门禁 | 命令 | `pnpm build && pnpm lint && pnpm typecheck:server && pnpm format:check` | ✅ 全部退出码 0 |
| AC-4 不阻断 | 人工 | mock 指向不可达地址时主流程（登录/同步）正常返回 | ✅ 主流程无感，失败入 logs |

**端到端验证细节（mock webhook 落盘记录）：**

自定义 body 模板 `{"text":"[{{eventName}}] {{title}} - {{message}} @ {{time}}"}`，
mock（127.0.0.1:3999）实际收到：

| 触发 | 收到的 body |
|------|-------------|
| 管理员登录 | `{"text":"[管理员登录] 管理员登录 - 管理员 admin 登录成功 @ 2026-10-11 09:30:26"}` |
| 订阅同步失败 | `{"text":"[订阅同步失败] 订阅同步失败 - 订阅「...」同步失败：响应缺少 subscription-userinfo 头 @ 2026-10-11 09:30:28"}` |
| 测试发送 | `{"text":"[订阅同步成功] 测试通知 - 来自订阅管理系统的 Webhook 测试消息（mock-验证）... @ 2026-10-11 09:30:28"}` |

自定义头 `X-Smoke: yes` 正确透传；验证数据（webhook id=2、订阅 id=35）已清理。

---

## Current State

DONE。工作区改动已全部提交（分支 `feature/TASK-010-notifications`，
合并入 `main`）。推送 GitHub 需人类批准（change-safety 协议），未执行。

---

## Changed Files

新增 **22** 个文件，修改 **19** 个文件（另有 Workspace 层 `projects/README.md`
同步登记，不属于本仓库，不计入）。

**新增：**

| 文件 | 内容 |
|------|------|
| `shared/src/schema/notifications.ts` | 事件目录（5 事件）+ webhook/payload zod schema + 目录工具函数 |
| `server/drizzle/0009_long_omega_flight.sql` | CREATE TABLE webhooks + 索引 |
| `server/drizzle/meta/0009_snapshot.json` | 迁移快照 |
| `server/src/services/notifications.ts` | publish / sendWebhook / testWebhookSend（并发 4、超时 10s） |
| `server/src/routes/webhooks.ts` | webhooks CRUD / toggle / test API |
| `src/features/notifications/`（12 文件） | api.ts、index.tsx（Webhook 管理页）、center.tsx（通知中心）、utils.ts、data/schema.ts + 9 例单测、components/（action-dialog / webhooks-table / notification-bell / notifications-table / columns / mark-read-button） |
| `src/routes/_authenticated/webhooks/index.tsx` | 路由 |
| `src/routes/_authenticated/notifications/index.tsx` | 路由 |
| `src/features/logs/` + `src/routes/_authenticated/logs/`（6 文件） | **补提交**：TASK-004 日志功能因 `.gitignore` 误伤从未入 Git（见 KI#1） |
| `tasks/done/TASK-010-notifications/**` | 本任务文档 |

**修改：**

| 文件 | 改动 |
|------|------|
| `server/src/db/schema.ts` | webhooks 表定义（表数注释 10→11） |
| `server/src/index.ts` | 注册 `/api/webhooks` |
| `server/src/routes/reminders.ts` | `GET /unread-count`、`POST /read-all`；scan 的 insert 改返 boolean，仅新提醒触发 publish |
| `server/src/services/subscription-sync.ts` | syncOne 成功且 changed → sync_succeeded；失败 → sync_failed；syncMany 结束发汇总事件 |
| `server/src/routes/auth.ts` | 登录成功 publish `security.user_login` |
| `server/scripts/smoke.ts` | 第 14 段 14 项检查 |
| `shared/src/index.ts` / `schema/enums.ts` | 导出 notifications；logModule += 'notification' |
| `src/components/layout/data/sidebar-data.ts` | 「系统」组新增通知中心 + Webhook 管理 |
| 6 个业务页 index.tsx | Header 挂 `<NotificationBell />` |
| `src/routeTree.gen.ts` | 重新生成（两个新路由） |
| `.gitignore` | `logs` → `/logs`（修复误伤 src/features/logs，见 KI#1） |
| `docs/architecture/overview.md` | 头部状态、§5 补 webhooks/reminders 行、新增 §12 通知设计 |

---

## Known Issues

1. **`.gitignore` 的 `logs` 误伤整个日志功能（本次顺带修复）** ——
   Node 标准模板的 `logs` 条目匹配任意层级的 `logs` 目录，导致
   `src/features/logs/` 与 `src/routes/_authenticated/logs/` 自 TASK-004
   起**从未被提交进 Git**（clone 后缺文件，`routeTree.gen.ts` 引用即构建失败）。
   本次改为 `/logs`（仅忽略根级）并补提交这 6 个文件。教训：新增 feature 目录后
   应核对 `git status` 是否出现预期外的 ignored 条目。
2. **sublinkPro 的 SSE 实时广播未复刻** —— 其 `webs` 端用 SSE 推送在线状态，
   本项目站内通知改用「reminders 表 + 30s 轮询」实现，单管理员场景下轮询成本可忽略，
   且避免了 SSE 连接管理复杂度。若未来做多用户实时性再评估。
3. **Telegram 渠道未实现** —— 目录 `channels` 字段保留扩展位；通用 Webhook
   已可覆盖 Telegram Bot API 的 sendMessage URL 形态（`https://api.telegram.org/bot<token>/sendMessage`），
   用户可自行建 webhook 接入，无代码缺口。
4. **mock 落盘路径的 Windows 特性** —— 验证用的 node mock 脚本写 `/tmp/...`，
   在 Windows 下解析到当前盘根（`E:\tmp\`）而非 Git Bash 的 `/tmp` 映射，
   曾短暂误判「未收到请求」。仅影响验证脚本，不影响产品代码。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | developer | — | 2026-10-11 | 通知功能完成并全量验证；待人类批准后推送 |

**最新 Handoff：** `handoffs/HANDOFF-001-developer-to-next.md`
**Next Action：** 推送 `feature/TASK-010-notifications`（或合并后的 main）至
GitHub 需人类批准；推送后观察 `Continuous Integration` 是否全绿。
`tasks/backlog/` 为空，后续新任务可直接起 TASK-011。

---

## Task Rules

- [补充] 通知派发遵守 §10 的 C1（事务外）与 C8（增量对比）——
  `publish` 调用点一律在事务回调之外，`sync_succeeded` 仅在 changed 时触发。
- [补充] 新增通知事件只能在 shared 目录追加并同步 `pnpm build:shared`，
  不得在触发点硬编码事件文案。
- [补充] `.gitignore` 已修复 `logs` → `/logs`；后续新增业务目录后必须
  `git status` 核对无意外 ignored 条目（TASK-004 教训）。

---

## Notes

- sublinkPro 的 `changedNodeIDs` 增量对比同时承担了「防通知刷屏」职责，
  本项目 C8 落地时把这一语义显式写进了 AC-6（无变化不通知）。
- 站内通知复用 reminders 表是一次有争议的决策：替代方案是新开
  `notifications` 表。选择复用的理由是已读/未读、客户关联、时间筛选状态机
  完全重合，且 `type` 列天然可区分（事件 key vs 旧 `expire`/`traffic`），
  `reminderTypeLabel` 已做兼容映射。
- knip 对 `webhookKeys` / `reminderKeys` / `UNREAD_POLL_INTERVAL` /
  `ReminderListParams` 报未使用导出，与项目既有模式（logKeys 等）一致，
  属 queryKey 工厂的标准形态，非死代码。
