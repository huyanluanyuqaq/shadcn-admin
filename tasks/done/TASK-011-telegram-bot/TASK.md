# TASK-011 — Telegram 机器人：Bot 推送 + /start 自动绑定 Chat ID（参照 sublinkPro）

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-011
Title: Telegram 机器人：Bot 推送 + /start 自动绑定 Chat ID（参照 sublinkPro）
Workflow: feature
Status: DONE
Priority: P1
Owner: workbuddy
Owner Since: 2026-10-11
Assigned Role: developer
Created: 2026-10-11
Updated: 2026-10-11
Completed: 2026-10-11
Branch: feature/TASK-011-telegram-bot
Requires Human Approval: false
```

> **登记说明（诚实记录）：** 本 Task 为**补登**。工作成果在登记前已完成，
> 所有 Verification Plan 中的验证均在补登时真实执行，非事后补写。
> 补登过程中真实发现并修复了一个运行期缺陷（见 Known Issues #1）。

---

## Objective

用户需求原话：「在侧栏系统中增加 telegram 机器人，参照 sublinkpro 的配置」。

在 TASK-010 通知体系（事件目录 + 派发器）基础上，落地 **Telegram 通知渠道**：
侧边栏「系统」组新增「Telegram 机器人」入口，配置页可维护 Bot Token /
Chat ID / 代理 / 订阅事件，支持测试连接与 `/start` 自动绑定 Chat ID。

---

## Background

2026-10-11 调研 sublinkPro 的 Telegram 实现（`services/telegram/{telegram,notify,types}.go`、
`services/notifications/{config,catalog,publish}.go`、`api/telegram.go`、
`docs/features/telegram-bot.zh-CN.md`），提取并适配以下设计：

| sublinkPro 机制 | 本项目落地 |
|-----------------|-----------|
| settings KV 存储（`telegram_enabled/bot_token/chat_id/use_proxy/proxy_link` + `telegram_event_keys` JSON 数组） | settings 表 KV，键前缀 `telegram.`（点分区，同库同思路） |
| `getMe` 校验 Token | 同；成功后缓存 botUsername 供界面展示 |
| `getUpdates` 长轮询，`/start` 自动绑定首个发送者 Chat ID | 同；**绑定后即停**，不常驻 |
| 分事件消息格式化（notify.go） | 同思路；parse_mode 由 Markdown 改 **HTML**（见下） |
| `CreateTestBot` 测试连接 | `POST /api/telegram/test`（getMe + 可选测试消息） |

**对 sublinkPro 的刻意改进 / 收窄：**

1. **parse_mode 改用 HTML**：sublinkPro 用 Markdown，用户内容（订阅名、客户名）
   中的 `_ * [` 等字符会破坏格式且转义规则繁琐；HTML 只需转义 `& < >`，
   对 CJK 与用户内容更稳健。
2. **不做交互命令面**：sublinkPro 的机器人是完整远程管理端（stats/monitor/
   subscriptions 命令 + 内联键盘 + 长轮询常驻）。本项目是通知系统，仅保留
   **通知推送**与 **Chat ID 自动绑定**；长轮询仅在「已启用 + 有 Token +
   未绑定 Chat ID」时运行，绑定后自停。
3. **代理支持**：undici `ProxyAgent`（http/https/socks5），与订阅同步同语义，
   国内服务器访问 api.telegram.org 所需（sublinkPro 的 proxy_link 同目的）。

---

## Scope

- shared：通知渠道枚举扩 `telegram`；5 事件全部开放 telegram 渠道；
  新增 Telegram 配置 / 状态 / 测试入参三组 zod schema 与默认事件集函数
- 后端：`services/telegram.ts`（settings KV 读写 / getMe / sendMessage /
  getUpdates 长轮询 / 派发 / 测试连接）；`routes/telegram.ts`
  （GET 配置 / PUT 保存 / POST test / GET bind-status）；`index.ts` 注册路由 +
  启动恢复绑定轮询；`env.ts` 增 `telegramApiBase`（`TELEGRAM_API_BASE`）
- 派发：`notifications.ts` 的 `publish()` 增补 telegram 分支（fire-and-forget）
- 前端：`/telegram` 配置页（运行状态 Card + 渠道配置 Card）、api hooks、
  表单 schema 与转换器、侧边栏「系统」组入口
- 测试：冒烟第 16 段 14 项（内嵌 mock Bot API）；前端 schema 单测 +10 例
- 文档：`docs/architecture/overview.md` §12 扩为三渠道 + 新增 §12.5

## Non-Scope

- **不做**机器人交互命令（stats / monitor / subscriptions 远程管理面）
- 不做多机器人 / 多聊天目标（单配置：一个机器人 + 一个目标聊天）
- 不改 `src/components/ui/**`；不动 DB 表结构（复用 settings 表，无新迁移）

---

## Requirements

| 类型 | 内容 |
|------|------|
| 质量 | `pnpm test` 全绿（含新增 10 例）；`pnpm --filter server smoke` 全绿（含新增 14 项） |
| 质量 | `pnpm lint` / `pnpm format:check` / `pnpm typecheck:server` / 构建全绿 |
| 正确 | 派发为 fire-and-forget，四重检查（启用 / Token / Chat ID / 事件订阅），失败仅记日志 |
| 正确 | `/start` 绑定首个发送者 Chat ID（含负数群组 ID），绑定后长轮询自停 |
| 正确 | 消息用 HTML parse_mode，分事件标题；测试连接支持保存前校验（表单当前值） |
| 安全 | Bot Token 限 `<数字>:<授权串>` 形态；Chat ID 限数字；代理限 http/https/socks5 |
| 兼容 | shared 改后 `pnpm build:shared`（后端消费 dist，前端经 `@shared` 别名消费源码） |

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 所有出网调用 10s 超时（与 webhook 渠道一致）；getUpdates 单次挂起 30s |
| 技术 | `publish` 内 telegram 派发一律事务外（遵守 §10 C1） |
| 技术 | 长轮询进程级单例（模块级 AbortController），PUT 保存与启动时按配置启停 |
| 术语 | 界面文案「供应商」等既有约定不变；本功能不涉及该实体 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-010（通知功能） | 事件目录 + publish 派发器宿主 | 已完成 |
| TASK-006（订阅同步引擎） | proxyUrl 代理语义同源 | 已完成 |
| TASK-009（工程卫生） | 质量门禁基线 | 已完成 |

---

## Acceptance Criteria

- [x] AC-1 shared 层 telegram 渠道契约完整（channel 枚举 / 配置 / 状态 / 测试入参 / 默认事件集）
- [x] AC-2 后端配置存取（settings KV）+ getMe / sendMessage / getUpdates 服务可用
- [x] AC-3 `/start` 自动绑定 Chat ID：长轮询按需启停、绑定后自停、服务重启恢复
- [x] AC-4 `publish()` 接入 telegram 派发，四重检查 + 失败仅记日志不阻断
- [x] AC-5 API 四端点可用：GET 配置（附事件目录）/ PUT 保存（含校验 400）/
      POST test（失败 502）/ GET bind-status
- [x] AC-6 前端 `/telegram` 配置页 + 侧边栏「系统」组入口；运行状态、渠道配置、
      事件订阅、测试连接、等待绑定提示齐全
- [x] AC-7 全量门禁：`pnpm test` 137/137（含新增 10 例）、smoke 92/92（含新增
      14 项，未接线场景 82/82 优雅跳过）、lint 0/0、format:check 全绿
- [x] AC-8 端到端 mock 验证：绑定确认 / 登录派发 / 测试连接三类消息收包，
      HTML parse_mode 与分事件标题核验通过

---

## File Scope

```yaml
File Scope:
  - shared/src/schema/notifications.ts          # 修改：telegram 渠道契约（枚举/配置/状态/测试入参）
  - server/src/services/telegram.ts             # 新增：配置存储 + API 客户端 + 绑定轮询 + 派发
  - server/src/routes/telegram.ts               # 新增：GET/PUT/POST test/GET bind-status
  - server/src/index.ts                         # 注册 /api/telegram + 启动恢复绑定轮询
  - server/src/env.ts                           # telegramApiBase（TELEGRAM_API_BASE）
  - server/src/services/notifications.ts        # publish() 增补 telegram 派发
  - server/scripts/smoke.ts                     # 第 16 段 14 项（内嵌 mock Bot API）
  - src/features/notifications/telegram.tsx     # 新增：配置页
  - src/features/notifications/api.ts           # telegram query/mutation hooks
  - src/features/notifications/data/schema.ts   # telegram 表单 schema + 转换器
  - src/features/notifications/data/schema.test.ts # +10 例
  - src/routes/_authenticated/telegram/index.tsx# 新增路由
  - src/components/layout/data/sidebar-data.ts  # 「系统」组新增 Telegram 机器人入口
  - src/routeTree.gen.ts                        # 重新生成（/telegram）
  - docs/architecture/overview.md               # §12 三渠道 + §12.5 Telegram 设计
  - tasks/done/TASK-011-telegram-bot/**
Non-Scope (files):
  - src/components/ui/**
  - server/src/db/**                            # 无新表（复用 settings），无迁移
```

---

## Implementation Plan

1. 调研 sublinkPro Telegram 实现（storage/notify/api 三处 + 官方文档）
2. shared 层渠道契约（枚举 + 三组 schema + 默认事件集；refine 与基础对象拆分）
3. 后端 service：settings KV → telegramApi（undici + ProxyAgent + 10s 超时）→
   validateToken / formatTelegramMessage / sendMessage / dispatchTelegram /
   testTelegramConnection → 绑定轮询（getUpdates 长轮询 + /start 绑定 + 自停）
4. 路由四端点 + index.ts 注册与启动恢复 + env.ts 基址可配置
5. 前端配置页（运行状态 / 渠道配置 / 事件分组 / 测试连接 / 等待绑定提示）+ 侧边栏
6. 冒烟第 16 段（内嵌 mock + 离线校验 + 条件快乐路径）→ 前端单测 → 全量门禁 →
   mock 端到端收包核验

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 | 结果 |
|--------|------|------------|------|
| AC-7 单测 | 命令 | `pnpm test`（vitest browser headless） | ✅ 137/137（含新增 10 例） |
| AC-7 冒烟（接线） | 命令 | `TELEGRAM_API_BASE=http://127.0.0.1:3998` 起服务后 `pnpm --filter server smoke` | ✅ 92/92（含新增 14 项） |
| 冒烟（未接线降级） | 命令 | 默认 env 起服务后 smoke | ✅ 82/82，快乐路径按预期跳过 |
| AC-5 API | 冒烟 + 人工 | curl GET/PUT/POST test/GET bind-status | ✅ 四端点行为符合预期 |
| AC-2/3 绑定 | 人工 + mock | 启用 → mock getUpdates 收到轮询 → 发送 /start → chatId 落库 → 轮询自停 | ✅ 全链路通过 |
| 质量门禁 | 命令 | `pnpm lint` / `pnpm format:check` / `pnpm typecheck:server` / `tsc -b` + `vite build --emptyOutDir false` | ✅ 全部退出码 0 |
| AC-4 不阻断 | 人工 | mock 不可达时登录 / 同步主流程正常 | ✅ 主流程无感，失败入 logs |

**端到端 mock 收包核验（127.0.0.1:3998，消息全文）：**

| 场景 | mock 收到的 sendMessage |
|------|------------------------|
| 绑定确认 | `{"chat_id":"-1002233445566","text":"🔗 已绑定成功，通知将推送到本聊天。","parse_mode":"HTML","disable_web_page_preview":true}` |
| 登录事件派发 | `{"chat_id":"-1002233445566","text":"🔐 <b>管理员登录</b>\n\n管理员登录\n管理员 admin 登录成功","parse_mode":"HTML","disable_web_page_preview":true}` |
| 测试连接 | `{"chat_id":"-1002233445566","text":"✅ 订阅管理系统 Telegram 连接测试成功，收到即表示配置可用。","parse_mode":"HTML","disable_web_page_preview":true}` |

`/test` 响应：`{"ok":true,"botUsername":"@dump_bot","messageSent":true,"error":null}`。
验证后配置已清理（停用 + 解绑），验证数据无残留。

---

## Current State

DONE。工作区改动已全部提交（分支 `feature/TASK-011-telegram-bot`，
合并入 `main`）。推送 GitHub 需人类批准（change-safety 协议），未执行。

---

## Changed Files

新增 **5** 个文件（含任务文档），修改 **11** 个文件（另有 Workspace 层
`projects/README.md` 同步登记，不属于本仓库，不计入）。

**新增：**

| 文件 | 内容 |
|------|------|
| `server/src/services/telegram.ts` | settings KV 读写 / telegramApi（undici + ProxyAgent + 10s 超时）/ validateToken / escapeHtml / formatTelegramMessage / sendMessage / dispatchTelegram / testTelegramConnection / 绑定长轮询（getUpdates + /start + 自停） |
| `server/src/routes/telegram.ts` | GET `/`（配置 + 状态 + 事件目录）、PUT `/`（保存 + 按需启停轮询）、POST `/test`（连接测试，失败 502）、GET `/bind-status` |
| `src/features/notifications/telegram.tsx` | 配置页：运行状态 Card（渠道 Badge / 机器人 / Chat ID / 最近测试 / lastError）+ 渠道配置 Card（启用开关 / Token / Chat ID / 代理 / 事件分组多选 / 测试连接 / 保存 / 等待绑定提示） |
| `src/routes/_authenticated/telegram/index.tsx` | 路由（createFileRoute） |
| `tasks/done/TASK-011-telegram-bot/**` | 本任务文档 + handoff |

**修改：**

| 文件 | 改动 |
|------|------|
| `shared/src/schema/notifications.ts` | channel 枚举 + `telegram`；5 事件 channels 全量开放；`telegramConfigBaseSchema` + `telegramConfigChecks` 谓词 + `telegramConfigSchema` / `telegramStatusSchema` / `telegramTestInputSchema`；`defaultTelegramEventKeys()` |
| `server/src/index.ts` | 注册 `/api/telegram`；启动处 `void startBindPoller()`（重启恢复） |
| `server/src/env.ts` | config 增 `telegramApiBase`（`TELEGRAM_API_BASE`，默认官方，去尾斜杠） |
| `server/src/services/notifications.ts` | 头部注释「三条通道」；publish() 内 `void dispatchTelegram(payload)` |
| `server/scripts/smoke.ts` | 第 16 段：内嵌 mock Bot API（127.0.0.1:3998）+ 离线校验 5 项 + 条件快乐路径 9 项 |
| `src/features/notifications/api.ts` | `telegramKeys` / `useTelegramConfigQuery` / `useSaveTelegramConfig` / `useTestTelegram` / `useTelegramBindStatusQuery`（启用时 3s 轮询） |
| `src/features/notifications/data/schema.ts` | `telegramFormSchema`（3 refine）/ `emptyTelegramForm` / `toTelegramForm` / `toTelegramInput` |
| `src/features/notifications/data/schema.test.ts` | Telegram 表单与校验 10 例（默认值 / 回显 / 归一 / token / chatId / 代理 / 事件） |
| `src/components/layout/data/sidebar-data.ts` | 「系统」组 Webhook 管理后插入「Telegram 机器人」（icon: Send） |
| `src/routeTree.gen.ts` | 重新生成（新增 `/telegram` 路由） |
| `docs/architecture/overview.md` | 头部状态 TASK-011；§12 三渠道派发 + 前端表补行 + 新增 §12.5 Telegram 渠道设计 |

---

## Known Issues

1. **zod 禁止对含 refinements 的 schema `.pick()`（本次真实踩雷并修复）** ——
   路由初版写 `telegramConfigSchema.pick({...})`（refine 后的 ZodEffects），
   TypeScript 类型检查通过但**运行期抛错**（`.pick() cannot be used on object
   schemas containing refinements`），`POST /test` 直接 500。启动服务实测才发现。
   修复：shared 层从基础对象重新派生专用 `telegramTestInputSchema` 并复用同一组
   校验谓词。教训：zod refine 后的 schema 不能 extend/pick，需要从 base 重新派生；
   且「类型过 ≠ 运行对」，路由注册后应实际打一次请求。
2. **sublinkPro 的交互命令面未复刻（刻意收窄）** —— stats / monitor /
   subscriptions 远程管理 + 内联键盘 + 常驻长轮询均未实现，本项目只做通知推送
   与 Chat ID 绑定。若未来需要远程管理，应作为独立 Task 评估（含鉴权与命令面设计）。
3. **mock getUpdates 需要人为 pacing** —— 真实 Telegram 按 `timeout=30` 挂起，
   本地 mock 立即返回会导致绑定轮询热循环（localhost 下每秒数十次）。
   mock 实现加 250ms 延迟模拟；仅影响测试基建，不影响产品代码。
4. **`pnpm build` 的 vite 清空 dist 受沙箱 safe-delete 拦截** ——
   TASK-009 已知环境问题（`dist/assets` 文件数超 50 阈值），
   本次以 `vite build --emptyOutDir false` 验证通过。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | developer | — | 2026-10-11 | Telegram 渠道完成并全量验证；待人类批准后推送 |

**最新 Handoff：** `handoffs/HANDOFF-001-developer-to-next.md`
**Next Action：** 推送 `feature/TASK-011-telegram-bot`（或合并后的 main）至
GitHub 需人类批准；推送后观察 `Continuous Integration` 是否全绿。
`tasks/backlog/` 为空，后续新任务可直接起 TASK-012。

---

## Task Rules

- [补充] 新增通知渠道沿用 TASK-010 模式：shared 目录契约 → 后端 service →
  派发器接入 → 前端配置页；触发点文案不硬编码。
- [补充] zod refine 后的 schema 禁止 `.pick()` / `.extend()`，需要时从
  基础对象重新派生并复用校验谓词（KI#1 教训）。
- [补充] Telegram 长轮询是**按需运行**的进程级单例：任何「改配置」路径
  （PUT / 启动）都必须显式决策启停，避免残留轮询。

---

## Notes

- 配置页的「等待绑定中」提示与 bind-status 3s 轮询联动：未启用时展示保存后
  进入等待的预期，启用且未绑定时展示「请现在向机器人发送 /start」。
- Chat ID 用字符串存储而非数字：群组 ID 为负数且长度超出 JS 安全整数范围，
  字符串是 Telegram 生态（含官方 API 参数形态）的一致选择。
- 测试连接接受「表单当前值」而非仅已存配置（sublinkPro 同设计），
  便于保存前验证 Token 与代理。
