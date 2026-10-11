# TASK-012 — 飞书通知渠道：应用机器人推送（复用 TASK-011 架构模式）

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-012
Title: 飞书通知渠道：应用机器人推送（复用 TASK-011 架构模式）
Workflow: feature
Status: DONE
Priority: P1
Owner: workbuddy
Owner Since: 2026-10-11
Assigned Role: developer
Created: 2026-10-11
Updated: 2026-10-11
Completed: 2026-10-11
Branch: feature/TASK-012-feishu-channel（已 ff 合并 main 并删除）
Requires Human Approval: false
```

---

## Objective

用户需求：「飞书开放平台的应用是否可以增加接入系统」→ 确认走**新增飞书专用通知渠道**
（路径 B，区别于零代码的通用 Webhook 路径 A）。

在 TASK-010 通知体系 + TASK-011 Telegram 渠道基础上，新增 **飞书（Feishu）渠道**：
侧边栏「系统」组新增「飞书机器人」入口，配置页维护企业自建应用凭证
（App ID / App Secret）与接收对象（chat_id / open_id / user_id / union_id / email），
订阅事件后由应用机器人以**交互卡片**形式推送。

## Background

已确认的飞书开放平台 API 事实（2026-10-11 查证官方文档）：

| 环节 | 端点 | 要点 |
|------|------|------|
| 获取凭证 | `POST /open-apis/auth/v3/tenant_access_token/internal`，body `{app_id, app_secret}` | 返回 `tenant_access_token`，有效期 **7200s**，需缓存并提前刷新 |
| 机器人信息 | `GET /open-apis/bot/v3/info`，header `Authorization: Bearer <token>` | 返回 `bot.app_name` / `bot.open_id` / `activate_status` |
| 发送消息 | `POST /open-apis/im/v1/messages?receive_id_type=chat_id`，body `{receive_id, msg_type, content}` | `msg_type=interactive` 时 `content` 为**卡片 JSON 序列化后的字符串** |

与 TASK-011 Telegram 的架构同构度：settings KV 单配置、四重检查派发、
10s 超时、失败仅记日志、mock 冒烟模式全部可复用；差异点仅在
token 缓存（有状态）与卡片消息构造。

## Scope

- shared：channel 枚举 + `feishu`；5 事件 channels 全量开放；飞书配置 / 状态 /
  测试入参 / 测试结果四组 zod schema + 默认事件集
- 后端：`services/feishu.ts`（token 缓存、bot 信息缓存、卡片构造、派发、测试连接）；
  `routes/feishu.ts`（GET/PUT/POST test）；index.ts 注册；env.ts `feishuApiBase`
- 派发：`notifications.ts` 的 `publish()` 增补飞书分支
- 前端：`/feishu` 配置页 + hooks + 表单 schema + 侧边栏入口
- 测试：冒烟第 17 段（内嵌 mock 飞书 API，127.0.0.1:4000）；前端 schema 单测扩充

## Non-Scope

- 不做飞书**事件订阅 / 卡片回调**（入站双向集成属交互命令面，与 Telegram 的收窄决策一致）
- 不做「拉取机器人所在群列表」的群选择器（需额外 im:chat 权限，chat_id 手动填写）
- 不改 `src/components/ui/**`；无新表（复用 settings）

---

## Requirements

| 类型 | 内容 |
|------|------|
| 质量 | `pnpm test` / `pnpm lint` / `pnpm format:check` / `pnpm typecheck:server` / 构建全绿 |
| 正确 | `tenant_access_token` 缓存复用，临期（<5min）自动刷新，失败不落库毒化 |
| 正确 | 派发四重检查（启用 / 凭证 / 接收对象 / 事件订阅），失败仅记日志不阻断 |
| 正确 | 卡片消息 severity→色板映射（success→green / error→red / warning→orange / info→blue） |
| 安全 | App Secret 服务端存储、界面密码框；接收对象按类型校验前缀（oc_/ou_/on_/email） |
| 兼容 | shared 改后 `pnpm build:shared` |

---

## Acceptance Criteria

- [x] AC-1 shared 层飞书渠道契约完整（channel 枚举 / 配置 / 状态 / 测试入参 / 默认事件集）
- [x] AC-2 token 获取与缓存可用（有效期 7200s、临期刷新、错误码不缓存）
- [x] AC-3 发送消息走 `im/v1/messages`，interactive 卡片结构正确，severity 色板生效
- [x] AC-4 `publish()` 接入飞书派发，四重检查 + 失败仅记日志
- [x] AC-5 API 三端点可用（GET 配置附事件目录 / PUT 保存含 400 校验 / POST test 失败 502）
- [x] AC-6 前端 `/feishu` 配置页 + 侧边栏入口；运行状态与渠道配置齐全
- [x] AC-7 全量门禁全绿；冒烟第 17 段（接线 / 未接线两场景）
- [x] AC-8 mock 端到端收包核验：卡片 JSON、receive_id、msg_type 正确

---

## File Scope

```yaml
File Scope:
  - shared/src/schema/notifications.ts
  - server/src/services/feishu.ts            # 新增
  - server/src/routes/feishu.ts              # 新增
  - server/src/index.ts
  - server/src/env.ts
  - server/src/services/notifications.ts
  - server/scripts/smoke.ts
  - src/features/notifications/feishu.tsx    # 新增
  - src/features/notifications/api.ts
  - src/features/notifications/data/schema.ts
  - src/features/notifications/data/schema.test.ts
  - src/routes/_authenticated/feishu/        # 新增
  - src/components/layout/data/sidebar-data.ts
  - src/routeTree.gen.ts
  - docs/architecture/overview.md
  - tasks/done/TASK-012-feishu-channel/**
Non-Scope (files):
  - src/components/ui/**
  - server/src/db/**
```

---

## Implementation Plan

1. 登记任务 + 分支（本文件）
2. shared 渠道契约（枚举 + 四 schema + 默认事件集）
3. 后端 service（token 缓存 / bot 信息 / 卡片构造 / 派发 / 测试连接）→ 路由 → 注册 → env
4. 前端配置页 + hooks + 表单 + 侧边栏 + 路由
5. 冒烟第 17 段 + 前端单测 → 全量门禁 → mock 端到端核验
6. 归档 + 文档 + 提交合并

---

## Verification Plan

### 已执行验证

**1. service 直连验证（开发期临时脚本，16/16 通过后删除）**

内嵌 mock 飞书 API（127.0.0.1:4000）+ 临时 SQLite 库，直接 import service 与
路由发请求：路由 400 校验 ×2 / 快乐路径（token + bot info + 测试卡片）/
lastTestAt 与 botName 缓存 / 路由 200 / 派发 4 severity 色板（green/red/orange/blue）/
卡片标题正文取 payload / 未订阅事件静默 / 停用静默 / 坏凭证（99991663）/
路由 502 / token 失效（99991668）自动重试成功 / 发送失败（230002）不抛出。

**2. 冒烟第 17 段（接线场景，105/105）**

`TELEGRAM_API_BASE=http://127.0.0.1:3998 FEISHU_API_BASE=http://127.0.0.1:4000`
启动服务端后跑 `pnpm --filter server smoke`：

| 用例 | 结果 |
|------|------|
| 飞书配置写入（停用态归一化）/ 读取（附 5 项事件目录） | ✓ |
| 离线 400 校验 ×4（App ID / Secret / 接收对象类型不匹配 / 代理协议） | ✓ |
| 启用回显 + 重新登录触发 `security.user_login` | ✓ |
| 登录事件派发：interactive 卡片 + info 蓝色 header + lark_md 正文 + Bearer 鉴权 + receive_id_type=chat_id | ✓ |
| 测试连接：botName=`smoke_mock_app`、messageSent、绿色测试卡片送达 mock | ✓ |
| 错误凭证：502 且 message 含 `99991663` | ✓ |
| 清理：停用并清空凭证 | ✓ |

**3. 冒烟（未接线场景，88/88）**：两个快乐路径均打印提示并优雅跳过，
离线校验全过。

**4. mock 端到端收包核验（AC-8）**：登录事件卡片全文确认——
`header.template=blue`、`header.title.content=管理员登录`、
`elements[0].text.tag=lark_md` 且 content 含「管理员 admin 登录成功」、
note 附事件名与时间、`receive_id=oc_smoke0000000001`、`msg_type=interactive`、
`Authorization: Bearer t-smoke-mock-token`。

**5. 全量门禁**：typecheck:server ✓ / lint 0/0 ✓ / format:check ✓ /
vitest 148/148（新增 11 个飞书表单用例）✓ / `tsc -b` ✓ /
`vite build --emptyOutDir false` ✓。

### 开发期发现并修复的缺陷

- **测试连接 token 缓存「假成功」**：冒烟 17.7 实测发现——测试连接复用
  `tenant_access_token` 缓存，表单改成错误 Secret（未保存）时缓存命中，
  错误凭证返回 ok:true。修复：`testFeishuConnection` 测试前强制清缓存
  重新换取（提交 f3544b6）。

---

## Changed Files

新增 5：
- `server/src/services/feishu.ts`（settings KV / token 缓存 / bot info / 卡片 / 派发 / 测试连接）
- `server/src/routes/feishu.ts`（GET/PUT/POST test）
- `src/features/notifications/feishu.tsx`（配置页）
- `src/routes/_authenticated/feishu/index.tsx`（路由）
- `tasks/done/TASK-012-feishu-channel/**`（本文件 + handoff）

修改 10：
- `shared/src/schema/notifications.ts`（feishu 枚举 + 四 schema + 默认事件集）
- `server/src/env.ts`（feishuApiBase）
- `server/src/index.ts`（路由注册）
- `server/src/services/notifications.ts`（publish 接入 + 文档）
- `server/scripts/smoke.ts`（第 17 段 + mock）
- `src/features/notifications/api.ts`（3 个 hook）
- `src/features/notifications/data/schema.ts`（表单 schema + 转换器）
- `src/features/notifications/data/schema.test.ts`（11 个用例）
- `src/components/layout/data/sidebar-data.ts`（侧边栏入口）
- `src/routeTree.gen.ts`（重新生成）
- `docs/architecture/overview.md`（§12 全量补飞书 + 新增 §12.6）

## Known Issues

1. **接收对象 ID 需手动填写**：无群选择器（Non-Scope 决策）。用户需自行从
   飞书客户端/开放平台调试台获取 chat_id / open_id，前缀校验只能防手误。
2. **`FEISHU_API_BASE` 默认值含 `/open-apis`**：service 侧路径不带该前缀
   （与 Telegram 的 apiBase 语义差异）。自建中转或 mock 时需注意拼接口径。
3. **token 缓存为模块级单例**：多实例部署（水平扩容）时各实例各自缓存，
   无共享失效机制；单实例部署（当前形态）无影响。
4. **activate_status 未校验**：bot/v3/info 返回的激活状态仅透传不判定，
   应用未发布时发送才会报错（由 lastError 呈现）。

---

## Git

| 提交 | 内容 |
|------|------|
| `9c18b7c` | feat(shared): 飞书通知渠道 zod 契约 |
| `f3bfe6b` | feat(server): 飞书通知渠道服务与 API |
| `f19b904` | feat(web): 飞书配置页与侧边栏「系统」组入口 |
| `f3544b6` | fix(server): 飞书测试连接强制刷新 token 缓存 |
| `e8d6794` | test: 冒烟新增飞书段 + 前端表单纯测 |

分支 `feature/TASK-012-feishu-channel` 已 ff 合并 `main` 并删除。
推送（push）待人类批准后执行。
