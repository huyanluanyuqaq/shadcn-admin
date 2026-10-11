# 架构总览 — 用户订阅管理系统（基于 shadcn-admin 二次开发）

> 状态：**已实施**（TASK-001 ~ TASK-012 全部完成；§1「现状与差距」为接入时
> 的基线快照，保留作历史记录，不代表当前状态）
> 创建：2026-10-09 · 作者：Architect
> 关联：[ADR-001 后端技术栈选型](../decisions/ADR-001-backend-stack.md)、
> [ADR-002 移除 Clerk 改用 JWT](../decisions/ADR-002-remove-clerk-use-jwt.md)、
> [ADR-003 订阅同步引擎设计](../decisions/ADR-003-subscription-sync-design.md)

---

## 1. 现状与差距

### 1.1 基座现状

| 维度 | 现状 |
|------|------|
| 形态 | 纯前端 SPA（Vite 8 + React 19 + TanStack Router） |
| 数据 | `@faker-js/faker` mock，刷新即变，**无持久层** |
| 后端 | 无 |
| 认证 | Clerk（SaaS，需外网 + Publishable Key） |
| 部署 | `netlify.toml` 静态部署，**无 Dockerfile / docker-compose.yml** |

### 1.2 目标

一套 `docker compose up -d` 即可自托管运行的订阅管理系统，功能覆盖：
**订阅管理、客户管理、邮箱管理、仪表盘、通知、日志、套餐**。

### 1.3 差距清单

| 缺口 | 性质 | 工作量 |
|------|------|--------|
| 后端服务与 REST API | 从零建设 | 大 |
| 数据库与迁移体系 | 从零建设 | 中 |
| 认证由 Clerk 改为自托管 JWT | 替换 | 中 |
| 7 个业务模块的领域模型与页面 | 复用 UI 范式 + 重写数据层 | 大 |
| Dockerfile + docker-compose.yml | 从零建设 | 小 |
| 后端自动化测试 | 从零建设 | 中 |

---

## 2. 目标架构

```
                         ┌─────────────────────────────────────┐
   Browser ── HTTPS ──▶  │  单容器：node:22-alpine             │
                         │  Hono (Node)                        │
                         │   ├── /api/*   → REST API           │
                         │   └── /*       → 静态 dist (SPA)     │
                         │         │                           │
                         │         ▼ Drizzle ORM               │
                         │  SQLite  /app/data/app.db           │
                         └──────────────┬──────────────────────┘
                                        │ bind mount
                                   ./data/  （宿主机持久化）
```

**拓扑要点：**

- **单进程单容器**。Hono 同时承担 API 与前端静态托管（含 SPA fallback），不引入 Nginx 反向代理。
  理由：目标场景为单机自托管，多一层反向代理只增加运维负担，不带来收益。
- **无独立数据库容器**。SQLite 以文件形式落在挂载卷中。若未来需要 Postgres，
  演进路径见 §3.3。
- **前端构建在镜像内完成**，`docker compose up --build` 一条命令产出可运行实例。

---

## 3. 后端选型

### 3.1 决定

| 层 | 选型 | 版本 |
|----|------|------|
| HTTP 框架 | **Hono**（Node runtime） | ^4 |
| ORM | **Drizzle ORM** | ^0.36+ |
| 数据库 | **SQLite**（`better-sqlite3`） | 3.x |
| 认证 | **JWT（`jose`）+ `bcryptjs`** | — |
| 校验 | **zod**（与前端共享 schema） | ^4（沿用前端既有版本） |
| 定时任务 | `node-cron` 或 Hono + 内置调度 | — |

### 3.2 理由与被否决方案

| 决策点 | 采用 | 否决项 | 否决理由 |
|--------|------|--------|---------|
| HTTP 框架 | Hono | Express | JS 优先，类型体验弱，需额外 `@types` 与大量断言 |
| | | Fastify | 能力相当，但插件模型更重；Hono 在 Node/Workers 间可移植，退出成本低 |
| ORM | Drizzle | Prisma | 需代码生成步骤与独立引擎二进制，Docker 镜像体积与构建时间显著增加 |
| | | TypeORM | 装饰器语法与前端 zod 体系割裂，类型推导弱 |
| 数据库 | SQLite | PostgreSQL | 需额外容器 + 运维；本场景写入量低（人工 CRUD + 定时同步），SQLite WAL 足以支撑 |
| 认证 | 自建 JWT | 保留 Clerk | SaaS 依赖与「自托管离线运行」目标直接冲突 |
| | | Lucia/Auth.js | 面向多租户会话场景，本系统为单管理员，引入即过度设计 |

### 3.3 演进预留

SQLite 并非永久绑定。Drizzle 支持多 dialect，未来切 Postgres 需：
1. 替换 `better-sqlite3` 为 `pg` 驱动；
2. 调整 schema 中的列类型（SQLite 的 `integer` 时间戳 → `timestamp`）；
3. 追加 `docker-compose.yml` 的 `db` service。

**代价可控但非零**，因此不在首期引入（避免过度设计）。

---

## 4. 目录布局

采用**单仓库并列目录**（而非 pnpm workspace）：

```
shadcn-admin/
├── src/           ← 前端（保持原状，仅改造 features/）
├── server/        ← 【新增】Hono 后端
│   ├── src/
│   │   ├── index.ts        # 入口：API 路由 + 静态托管
│   │   ├── routes/         # 按领域：customers / subscriptions / plans / emails / ...
│   │   ├── db/             # schema.ts, migrate.ts, seed.ts
│   │   ├── middleware/     # auth (JWT), error handler
│   │   └── services/       # 业务逻辑（订阅解析、到期计算、通知）
│   ├── drizzle/            # 迁移 SQL
│   └── package.json
├── shared/        ← 【新增】前后端共享类型与 zod schema
│   └── src/
├── Dockerfile     ← 【新增】
└── docker-compose.yml  ← 【新增】
```

**为何不用 pnpm workspace：** 那需要把 `src/` 移动为 `packages/client/src/`，
违反 Adoption 的「只加不改」原则，且会破坏上游 fork 的合并能力。
并列目录改动最小，后续可平滑演进。

**共享方式：** `shared/` 通过 tsconfig path alias + Vite alias 引入前端；
后端以相对路径引入后由 `tsc` 编译进产物。

---

## 5. 数据模型（首期）

| 表 | 用途 | 关键字段 |
|----|------|---------|
| `customers` | 客户（业务对象，非系统账号） | name, email, pool_id, plan_id, plan_tier, status, expire_at, purchased_at, traffic_used, traffic_total(月流量), traffic_manual_cap(手动上限，优先级最高), subscription_url, subscription_expire_at |
| `plans` | 套餐（一个套餐 + 四档周期定价） | name, price_monthly, price_quarterly, price_semiannual, price_yearly, traffic_limit(月流量), description, status；遗留列 price/duration_days 不再写入（迁移 0004 回填） |
| `categories` | 客户分类（表保留但不再被 customers 引用，仅 CRUD 路由可用） | name |
| `subscriptions` | 订阅链接 | url, customer_id, pool_id, traffic_total/used, expire_at, **cron_expr, last_run_at, next_run_at, sync_status, last_error, user_agent, headers(json), skip_tls_verify, proxy_url** |
| `subscription_pool` | 供应商（订阅池） | name, url, remark |
| `email_bindings` | **邮箱与订阅的绑定关系**（非邮箱账号） | email(唯一), subscription_id(级联), status, remark |
| `reminders` | 到期提醒 + **站内通知**（in_app 渠道落库） | customer_id, type(事件 key), remind_at, is_read |
| `webhooks` | **通知 Webhook**（自选订阅事件，见 §12） | name, url, method, content_type, headers(json), body(模板), enabled, event_keys(json), last_test_at |
| `logs` | 日志（操作 + 定时任务） | level, module, message, created_at |
| `settings` | 系统配置 | key, value |
| `admins` | 管理员账号（单管理员起步） | username, password_hash |

**说明：** 用户已确认「用户管理 = 订阅客户管理」，因此**不引入多用户 RBAC**。
`admins` 表仅支撑单管理员登录，保留未来扩展为角色的字段空间，但首期不实现角色。

**邮箱模块语义（2026-10-10 用户确认修正）：**
`email_bindings` 表记录的**不是邮箱账号**，而是「某个邮箱地址绑定到哪条订阅」这一关系。
因此该表**不存**密码、提供商（邮箱服务商）与客户：

- `email` 建唯一索引 —— 一对一，同一邮箱同一时间只属于一条订阅
- `subscription_id` 外键 `ON DELETE CASCADE` —— 订阅删除则绑定自动失效
- 客户归属由 `subscriptions.customer_id` 承载，不在绑定侧冗余存储
- 原 `email_providers` / `email_accounts` 两张表已由迁移 `0001_email_bindings` 删除；
  旧表中的邮箱地址会被原样搬入新表，但 `subscription_id` 留空（旧数据只有 `customer_id`，
  一个客户可有多条订阅，无法可靠推断），需在界面补绑

**订阅表同步字段说明**（参照 sublinkPro 的 `airports` 表设计）：
每条订阅自持 `cron_expr`，调度器逐条注册 job 并支持热重载；
`last_run_at` / `next_run_at` 在每次执行后回写，供前端展示下次同步时间；
`headers` 以 JSON 存储自定义请求头，`skip_tls_verify` / `proxy_url` 为单条链接的可选项
（对应 sublinkPro 的 `RequestHeaders` / `InsecureSkipVerify` / `ProxyLink`）。

**客户表单流量上限自动填充优先级（TASK-016）：**
客户表单（即「订阅面板」，含「订阅信息」「订阅链接」两部分）的**月流量**字段
在未填写时按三级优先级自动填充；生效上限口径
（`effectiveTrafficTotal` = `trafficManualCap ?? trafficTotal`）不变：

| 优先级 | 来源 | 说明 |
|--------|------|------|
| 最高 | 手动设置 | 用户已手填的值永不覆盖；`trafficManualCap` 在生效计算中仍为最高优先级 |
| 高 | 套餐月流量（`plans.traffic_limit`） | 订阅链接被使用（链接匹配到订阅管理记录 / 已点「使用」/ 已「拉取订阅更新」）时，优先于订阅信息流量 |
| 默认 | 订阅信息流量（`subscriptions.traffic_total`） | 匹配订阅的上报值或「拉取订阅更新」预览值；链接被修改后预览值作废，不残留 |

解析逻辑在前端 `src/features/customers/data/schema.ts` 的 `resolveAutoTrafficGb`
（纯函数，前后端无共享契约变更）；第三部分「订阅流量上限（GB）」是保存时同步到
订阅管理的字段，不参与本优先级链。

---

## 6. 前端改造映射

| 现有资产 | 处置 | 目标模块 |
|----------|------|---------|
| `src/components/data-table/` | **保留复用** | 全部列表页（分页/列显隐/排序/faceted 筛选/批量操作） |
| `src/components/ui/`（30 个） | **保留复用** | 全局 |
| `features/users/` | **改造** | → `features/customers/`（CRUD 范式直接迁移） |
| `features/tasks/` | **改造** | → `features/subscriptions/`（含 `import-dialog` → Excel 导入） |
| `features/dashboard/` | **改造** | 仪表盘（Recharts，接真实统计 API） |
| `features/settings/notifications.tsx` | **改造** | 通知设置 |
| `features/auth/` | **改造** | 对接自建 JWT（替换 Clerk） |
| `features/apps/`、`features/chats/` | **删除** | 与业务无关 |
| `routes/clerk/` | **删除** | Clerk 专用路由 |
| — | **新建** | `features/emails/`、`features/plans/`、`features/logs/`、`features/reminders/` |

**复用范式说明：** `features/users/` 与 `features/tasks/` 提供了完整的
「Provider + Columns + Table + Dialogs + BulkActions + DeleteDialog」结构，
新增模块只需复制该骨架并替换 `data/schema.ts`（zod）与列定义。

---

## 7. 认证改造路径（Clerk → JWT）

1. 移除依赖 `@clerk/react` 及 `VITE_CLERK_PUBLISHABLE_KEY`。
2. 删除 `src/routes/clerk/` 整个目录。
3. `routes/_authenticated/route.tsx` 的守卫逻辑：由 Clerk 的 `<SignedIn>` 改为
   读取本地 token（内存 + `sessionStorage`）并校验 `/api/auth/me`。
4. 后端新增 `POST /api/auth/login`（bcrypt 校验 → 签发 JWT）、
   `POST /api/auth/logout`、`GET /api/auth/me`。
5. `features/auth/` 的 sign-in 页面表单保持，**仅替换提交逻辑**为调用 `/api/auth/login`。
6. `sign-up`、`otp`、`forgot-password` 页面：单管理员模式下**无自助注册**，直接移除入口。

---

## 8. 容器化方案

**Dockerfile（三阶段）：**

| 阶段 | 内容 |
|------|------|
| `client-builder` | `pnpm install --frozen-lockfile` → `pnpm build` → 产出 `dist/` |
| `server-builder` | 编译 `server/` 与 `shared/` → 产出 `server/dist/` |
| `runner` | `node:22-alpine`，仅安装生产依赖，拷贝两侧产物，`CMD ["node","server/dist/index.js"]` |

**docker-compose.yml：**

```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    volumes: ["./data:/app/data"]
    environment:
      NODE_ENV: production
      JWT_SECRET: ${JWT_SECRET:-change-me-in-production}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-admin123}
    restart: unless-stopped
```

**注意：** `JWT_SECRET` 与 `ADMIN_PASSWORD` 必须提供默认值以外的真实值；
首期应在使用说明中强提示修改，后续任务应改为「缺失即拒绝启动」。

---

## 9. 实施阶段

| 阶段 | 内容 | 依赖 |
|------|------|------|
| P0 | 后端骨架（Hono + Drizzle + SQLite + 迁移脚本） | — |
| P1 | 认证改造（JWT 替换 Clerk） | P0 |
| P2 | 领域模块：套餐 → 客户 → 订阅 → 邮箱 | P0, P1 |
| P2.5 | **订阅同步引擎**（调度 + 拉取 + 批量写入，参照 sublinkPro） | P2 |
| P3 | 仪表盘 + 通知（到期提醒）+ 日志 | P2, P2.5 |
| P4 | Dockerfile + docker-compose.yml + 部署验证 | P0–P3 |
| P5 | 后端测试补齐 | P0–P3 |

---

## 10. 订阅同步设计（参照 sublinkPro）

> 定时批量拉取订阅是本项目**唯一的集中写入场景**，必须先明确约束，否则会在数据量上来后出现
> 「事务持锁数秒」或「事件循环阻塞」两类难以定位的故障。
>
> 本章设计以 [sublinkPro](https://github.com/ZeroDeng01/sublinkPro)（Go + React，1.6k stars，MIT）
> 的生产实现为主要参照（2026-10-09 调研），并在其缺口处按 Node/SQLite 特性加严。

### 10.1 参照实现：sublinkPro 的链路

| 层 | sublinkPro 实现 | 本项目对应 |
|----|----------------|-----------|
| 调度 | `robfig/cron/v3`，**每个机场一条独立 job**，`CronExpr` 存于 `airports` 表，改库热重载（`ReloadFromDatabase()`） | 采纳：cron 表达式存 `subscriptions` 表，提供 reload 接口 |
| 拉取 | `http.Client{Timeout: 10s}`，**HEAD 优先**，失败/非 2xx 回退 GET；UA 默认 `clash.meta` 可覆盖 | 采纳：HEAD 优先回退 GET |
| 解析 | 读响应头 `subscription-userinfo` | 采纳（同 `business-manager`） |
| 入库 | `UpdateUsageInfo` 单条更新；返回 `changedNodeIDs` **增量对比**，仅处理变化项 | 采纳增量对比，但写入合并为单事务（见 C2） |
| 后处理 | `applyAutoTagRules` 异步；可选「更新后测速」且 `ChangedOnly` 只测变化节点 | 首期不做测速，保留扩展位 |
| 通知 | 失败时 `notifications.Publish("subscription.sync_failed")` | 采纳：失败写 `logs` + 触发通知 |
| 代理出口 | 将 mihomo 作为 **Go 库** 嵌入，取 adapter 注入 `http.Transport.DialContext` | 改为 undici `ProxyAgent`（见 §10.5） |

**三个值得抄的细节：**

1. **HEAD 优先回退 GET** —— 只取响应头、不下载订阅正文，单次流量从数十 KB 降到数百字节。
   在数百订阅的定时拉取下，这是最直接的带宽优化。
2. **`changedNodeIDs` 增量对比** —— 只有用量/到期真正变化时才触发后续动作（打标签、通知、测速），
   避免每轮全量空转。
3. **Cron 表达式入库 + 热重载** —— 比写死在配置文件灵活，且每机场独立表达式天然错峰。

### 10.2 sublinkPro 的缺口（本项目不沿用）

| 缺口 | sublinkPro 现状 | 本项目处置 |
|------|----------------|-----------|
| 批量更新**无并发上限** | `BatchUpdateAirportUsage` 每个机场一个 goroutine，`wg.Wait()`，N 机场 = N 并发 | **加 C3 并发上限** |
| **无 `SkipIfStillRunning`** | 单任务可能重叠执行 | **加 C6 单飞锁** |
| **无 jitter** | 表达式相同时惊群 | **加 C4 jitter** |

> 它靠「用户自行配置不同的 cron 表达式」侥幸规避并发问题，而非系统层限流。
> 本项目不依赖使用者的自觉，改由系统约束保证。

### 10.3 SQLite 必配参数（已被 sublinkPro 生产验证）

```sql
PRAGMA journal_mode = WAL;      -- 读写并发
PRAGMA synchronous = NORMAL;    -- WAL 下安全，避免每次提交 fsync
PRAGMA busy_timeout = 5000;     -- 锁竞争时等待 5s 而非抛 SQLITE_BUSY（必选）
PRAGMA foreign_keys = ON;
PRAGMA cache_size = -64000;     -- 64MB 页缓存（sublinkPro 用 _cache_size=-64000）
```

sublinkPro 的 DSN 参数实测一致：`_busy_timeout=5000` / `_journal_mode=WAL` /
`_synchronous=NORMAL` / `_cache_size=-64000` / `_foreign_keys=ON`，
驱动为纯 Go 的 `glebarez/sqlite`，连接池 `MaxIdle=10 / MaxOpen=100 / MaxLifetime=1h`。

**关键事实：** WAL 模式下「1 写者 + N 读者」并发，但**写与写互斥，锁粒度为整个数据库文件**。
不设 `busy_timeout` 时并发写直接抛错。

> 注意：sublinkPro 用连接池是因为 Go 的多 goroutine 模型；本项目为 Node 单线程 +
> `better-sqlite3` 同步 API，**不需要连接池**，单连接即可。

### 10.4 强制约束

| # | 约束 | 原因 |
|---|------|------|
| C1 | **禁止在事务内执行网络 IO**（`db.transaction` 回调内不得 `await fetch`） | 写锁将被持有数秒，导致全系统写入排队 |
| C2 | 批量结果必须合并为**单个事务**写入 | `better-sqlite3` 为同步 API，N 次独立写 = N 次 fsync + N 倍事件循环阻塞 |
| C3 | 拉取并发上限 `CONCURRENCY`（建议 5–10，可配） | 防止打满上游触发限流/封 IP（sublinkPro 缺口①） |
| C4 | 定时触发需加 **jitter**（随机延迟 0–10 分钟） | 避免惊群；上游限流早于数据库成为瓶颈（缺口③） |
| C5 | 单条拉取需超时（10s）与失败隔离（`Promise.allSettled`） | 单个链接超时不得阻塞整批 |
| C6 | **单飞锁**：同一订阅（或同一批任务）未跑完不得重入 | 防止任务重叠（sublinkPro 缺口②） |
| C7 | **HEAD 优先**，非 2xx 或头部缺失时回退 GET | 省带宽；sublinkPro 实证有效 |
| C8 | **增量对比**：仅当 `upload/download/total/expire` 变化时才写库并触发通知 | 避免每轮全量空转；sublinkPro `changedNodeIDs` 思路 |
| C9 | Cron 表达式入库 + 提供热重载接口，执行后回写 `last_run` / `next_run` | 便于运维与错峰；sublinkPro `ReloadFromDatabase()` 思路 |

> 注：`better-sqlite3` 的 `db.transaction()` 回调**必须是同步函数**，
> 该 API 约束天然保证了 C1，实现时应依赖它而非绕过它。

### 10.5 mihomo 的定位（重要）

订阅信息解析**不需要 mihomo**。Clash/Mihomo 订阅的用量与到期信息通过 HTTP 响应头
`Subscription-UserInfo`（`upload=X; download=Y; total=Z; expire=T`）获取，
由 Node 原生 `fetch` + UA 轮换（`clash.meta` / `v2ray` / `ClashforWindows`）即可完成。

三个项目对 mihomo 的用法各不相同，**但都不是「订阅拉取工具」**：

| 项目 | mihomo 形态 | Node 能否复用 |
|------|------------|--------------|
| sublinkPro | Go 库嵌入，取 adapter 注入 `http.Transport.DialContext` 作代理拨号器 | ❌ Go 专有 |
| `business-manager` | 下载二进制跑独立进程 | ❌ 重，且非必需 |
| **本项目** | **不需要** | ✅ 代理出口用 undici `ProxyAgent` 即可 |

| 场景 | 是否需要在镜像内安装 mihomo |
|------|--------------------------|
| 仅解析订阅用量与到期 | **不需要** —— 省去 Docker 构建期的二进制下载，镜像更小、构建更快 |
| 需固定出口 IP 拉取 | 不需要二进制，配置 `PROXY_URL` + undici `ProxyAgent` |
| 需实际运行代理流量 | 需要（额外引入进程管理） |

> 首期按「仅解析」实现。若后续确认需要第三种场景，应新增独立 ADR 并调整 Dockerfile。

### 10.6 何时改用 PostgreSQL

判据是**部署形态**而非数据量：

- 需多容器 / 多实例水平扩展 → SQLite 不适用（多进程共享数据库文件需网络文件系统，风险高）
- 持续写 QPS 达数千量级，或长事务与高频写长期共存 → 考虑迁移
- 单容器 + 批量事务 → SQLite 余量充足（500 订阅 / 6 小时同步 ≈ 0.02 写 QPS，余量三个数量级）

### 10.7 客户保存触发同步与用量回写（TASK-017）

客户列表行「流量使用」列读 `customers.traffic_used`，而同步引擎维护的是
`subscriptions.traffic_used`——**两份数据**。TASK-017 补齐两条链路：

1. **保存即拉取**：客户表单保存后，`syncSubscription` 落到具体订阅
   （创建或更新）时，前端以该订阅 id 调用 `POST /subscriptions/:id/sync`
   触发一次同步（放在邮箱绑定同步之前）。同步失败仅 toast 软提示、不阻断
   保存——客户与订阅本身已落库。
2. **同事务回写**：`syncOne` / `syncMany` 的阶段二事务内，订阅同步成功且
   有关联客户（`subscriptions.customer_id`）时，把
   `used = (upload ?? 0) + (download ?? 0)` 写入 `customers.traffic_used`；
   **同步失败不回写**。

| 口径 | 说明 |
|------|------|
| 只镜像用量 | `customers.traffic_total` 是月流量上限（套餐/表单管理，TASK-016 三级优先级语义）、`expire_at` 同为表单管理字段，均**不覆盖** |
| 成功即写 | 不回写受 C8 增量对比约束——即使订阅侧无变化，客户侧也可能是旧值（如新建时写 0），每次成功同步都镜像 |
| 写入口仅两处 | 同步引擎（本条）+ 表单保存（`toCustomerInput` 透传原值）；无其他写点 |

> 触发同步与回写共同满足「保存客户后行内即有真实用量」；仅修前者，客户行
> 仍显示 0（无数据来源）；仅修后者，要等定时任务（cron）才更新。

---

## 11. 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| Tailwind 4 与 shadcn 组件版本演进 | 组件升级需同步改样式 | 组件通过 shadcn CLI 管理，不手改 |
| Clerk 移除涉及路由与守卫重构 | 中等返工 | 集中在 P1 一次性完成，不做渐进 |
| SQLite 并发写锁 | 高并发写失败 | 启用 WAL 模式；写入集中在人工操作场景 |
| 后端无测试 | 回归风险 | P5 补齐；P0 起即设计可测的 Service 层 |
| 与 `business-manager` 混淆 | 组件误复制导致样式崩溃 | 见 `AGENTS.md` §13.1：Tailwind 3.4 与 4 不兼容，禁止跨项目复制 |

---

## 12. 通知设计（参照 sublinkPro）

> 本章设计以 [sublinkPro](https://github.com/ZeroDeng01/sublinkPro) 的通知三件套
> （`services/notifications/{catalog,config,publish}.go` + `models/webhook.go`）为参照
> （2026-10-11 调研其源码），按 Node/SQLite 特性适配落地为 TASK-010；
> Telegram 渠道（`services/telegram`）于 TASK-011 落地，见 §12.5；
> 飞书渠道（`services/feishu`）于 TASK-012 落地，见 §12.6。

### 12.1 事件目录（Event Catalog）

点分层级事件 key 集中定义于 `shared/src/schema/notifications.ts`，前后端共用：

| 事件 key | 名称 | 分类 | 严重级 | 触发点 |
|----------|------|------|--------|--------|
| `subscription.sync_succeeded` | 订阅同步成功 | subscription | success | 同步且**用量/到期真正变化**时（C8 增量对比，防刷屏） |
| `subscription.sync_failed` | 订阅同步失败 | subscription | error | 单条或批量同步失败（批量时附前 10 条失败摘要） |
| `customer.expire_soon` | 客户即将到期 | customer | warning | 提醒扫描**新生成**到期提醒时 |
| `customer.traffic_exhausted` | 客户流量用尽 | customer | error | 提醒扫描**新生成**流量提醒时（按天去重） |
| `customer.traffic_threshold` | 客户流量阈值提醒 | customer | warning | 客户流量达到 50% / 80% / 100% 阈值**且为更高阈值**时（TASK-013，见 §12.7） |
| `security.user_login` | 管理员登录 | security | info | 登录成功 |

每条事件声明可用渠道（`webhook` + `in_app` + `telegram` + `feishu`，Telegram 于
TASK-011 落地见 §12.5，飞书于 TASK-012 落地见 §12.6）与 `defaultEnabled`。新增事件 =
目录追加一条 + 在触发点调 `publish()`，无需改派发器。

### 12.2 四渠道派发

```
publish(eventKey, { title, message, data })
   ├─ in_app：写入 reminders 表（type = 事件 key），供 Header 铃铛 / 通知中心展示
   ├─ webhook：查询订阅了该事件的 enabled webhooks → 并发派发（上限 4）
   ├─ telegram：向配置的机器人聊天推送（启用 + 已绑定 Chat ID + 订阅该事件时）
   └─ feishu：向配置的企业应用接收对象推送交互卡片（启用 + 凭证齐全 + 订阅该事件时）
```

- **fire-and-forget**：`publish` 返回 `void`，调用方（如同步循环）不等待投递结果；
  单渠道失败仅记 `logs`（module=`notification`），**绝不阻断主流程**。
- **webhook 投递**：模板变量替换（URL 用 `encodeURIComponent`，JSON body 用 JSON 转义，
  form 用 URL 编码）→ 合并自定义请求头 → `AbortSignal.timeout(10_000)` →
  `>=400` 判定失败并记录。
- **模板变量**：`{{title}} {{message}} {{time}} {{event}} {{eventName}} {{severity}}
  {{category}} {{categoryName}}`，body 另支持 `{{json .}}`（整个 payload 的 JSON）。
  凭此可零改代码接入 PushDeer / Bark / 钉钉 / 方糖等官方 webhook 地址。
- **telegram 投递**：分事件消息格式化（emoji + 加粗标题，HTML parse_mode）→
  `sendMessage` → 失败仅记日志；详见 §12.5。
- **feishu 投递**：severity → 卡片色板映射 + lark_md 正文 → `im/v1/messages`
  （`msg_type=interactive`，content 为卡片 JSON 序列化字符串）→ 失败仅记日志；
  详见 §12.6。

### 12.3 前端

| 页面 / 组件 | 路径 | 说明 |
|-------------|------|------|
| Webhook 管理 | `/webhooks` | CRUD + 事件多选（按分类分组）+ 启用开关 + 测试发送 |
| Telegram 机器人 | `/telegram` | 单配置（Token / Chat ID / 代理 / 事件订阅）+ `/start` 自动绑定 + 测试连接 + 运行状态 |
| 飞书机器人 | `/feishu` | 单配置（App ID / App Secret / 接收对象类型与 ID / 代理 / 事件订阅）+ 测试连接 + 运行状态 |
| 通知中心 | `/notifications` | URL 驱动的筛选（已读/未读）/ 分页 / 标记已读 |
| 通知铃铛 | Header（全局） | 未读角标（30s 轮询）+ 最近 6 条 Popover + 全部已读 |

站内通知复用 `reminders` 表而非新表：提醒与通知同源（都是「需要人看的事件」），
以 `type` 区分（事件 key vs 旧 `expire`/`traffic`），避免重复建设已读/未读状态机。

### 12.4 与 §10 约束的关系

C1（事务内禁网络 IO）对通知同样生效：`publish` 一律在事务外调用；
C8（增量对比）同时是通知的防刷屏机制——无变化不写库、不通知。

### 12.5 Telegram 渠道（TASK-011，参照 sublinkPro `services/telegram`）

设计参照 sublinkPro，但**刻意收窄**：sublinkPro 的机器人是完整远程管理端
（stats/monitor/subscriptions 命令 + 内联键盘 + 长轮询常驻），本项目为通知系统，
仅保留两类能力——**通知推送**与 **Chat ID 自动绑定**，无交互命令面。

| 维度 | 决策 |
|------|------|
| 存储 | settings 表 KV（键前缀 `telegram.`，sublinkPro 同思路）；单配置（一个机器人 + 一个目标聊天），非多条记录 |
| Token 校验 | `getMe`（保存前可经「测试连接」预校验），成功后缓存 botUsername |
| Chat ID 绑定 | 启用后向机器人发送 `/start`，服务端 getUpdates 长轮询（单次挂起 30s、offset 推进）绑定**首个**发送者；群组 ID 为负数故按字符串处理；**绑定后即停**，不常驻连接 |
| 消息格式 | HTML parse_mode（仅转义 `& < >`，比 sublinkPro 的 Markdown 转义稳健、兼容 CJK）；分事件标题（✅ 同步成功 / ❌ 同步失败 / ⏰ 即将到期 / 🚫 流量用尽 / 🔐 管理员登录 + 加粗） |
| 代理 | undici `ProxyAgent`（http/https/socks5），与订阅同步同语义；国内服务器访问 api.telegram.org 所需 |
| 出网基址 | `config.telegramApiBase`（env `TELEGRAM_API_BASE`，默认官方地址）；冒烟测试指向内嵌 mock，出口受限环境可自建中转 |

长轮询启停由配置驱动：PUT 保存时按「已启用 + 有 Token + 未绑定 Chat ID」启动，
绑定成功 / 停用 / 改配置即停；服务重启后按持久化配置恢复（`index.ts` 启动处）。
派发路径与 webhook 一致：四重检查（启用 / Token / Chat ID / 事件订阅）后
fire-and-forget 发送，失败仅记 `logs`，不阻断主流程。

### 12.6 飞书渠道（TASK-012，飞书开放平台 `im/v1/messages`）

与 Telegram 同构（settings KV 单配置、四重检查、10s 超时、失败仅记日志），
差异在于凭证模型与消息格式：飞书没有「Token 即全部」的单凭证，而是
**App ID + App Secret 换取 tenant_access_token**（有效期 7200s），
发送时还需指定**接收对象及其 ID 类型**。

| 维度 | 决策 |
|------|------|
| 存储 | settings 表 KV（键前缀 `feishu.`）；单配置（一个应用 + 一个接收对象），非多条记录 |
| 凭证校验 | `tenant_access_token/internal` 换取（保存前可经「测试连接」预校验）→ `bot/v3/info` 拉取应用名并缓存为 botName |
| token 缓存 | 模块级 `{ token, expiresAt }`；临期不足 5min 自动续期；换取失败不落缓存；错误码 99991668（token 失效，常见于凭证更换后旧缓存命中）时清缓存并重试一次 |
| 接收对象 | 五类型（`chat_id`=群 / `open_id`=用户 / `user_id` / `union_id` / `email`），按类型校验前缀（`oc_` / `ou_` / `on_` / 邮箱格式 / user_id 无前缀）；**手动填写**（不做群选择器，见 Non-Scope） |
| 消息格式 | 交互卡片（`msg_type=interactive`，content 为卡片 JSON 序列化字符串）；`header.template` 按 severity 着色（success→green / error→red / warning→orange / info→blue），正文 lark_md，note 附事件名与时间 |
| 代理 | undici `ProxyAgent`（http/https/socks5），与订阅同步 / Telegram 同语义 |
| 出网基址 | `config.feishuApiBase`（env `FEISHU_API_BASE`，默认 `https://open.feishu.cn/open-apis`，**已含 `/open-apis`**，service 侧路径不再重复该前缀）；冒烟测试指向内嵌 mock |

与 Telegram 的边界差异：飞书**无** `/start` 绑定长轮询——接收对象 ID 由用户
自行填写（把机器人拉进群后可获群聊 ID）；**不做**事件订阅与卡片回调
（入站双向集成属交互命令面，与 Telegram 的收窄决策一致）。

测试连接（`POST /api/feishu/test`）验证的是**当前表单值**（可能尚未保存），
因此测试前**强制清除 token 缓存**重新换取——否则缓存命中会让错误凭证
「假成功」（TASK-012 冒烟实测发现并修复）。

### 12.7 流量阈值提醒（TASK-013）

需求：仪表盘新增流量阈值提醒，阈值 50% / 80% / 100%，达到阈值时发送通知，
**每次通知取当前所在的最高阈值**。

| 维度 | 决策 |
|------|------|
| 评估对象 | **客户**（`customers`），与 `traffic_exhausted` 扫描口径一致；不做订阅粒度 |
| 生效上限 | `trafficManualCap ?? trafficTotal`（手动上限优先）；为 null/<=0 不评估 |
| 阈值常量 | `TRAFFIC_THRESHOLDS = [50, 80, 100]`（shared `schema/traffic.ts`，前后端共用；比较用精确值，避免取整提前触发） |
| 触发语义 | **穿越式**：`customers.traffic_threshold_notified` 记录「当前所在最高阈值」，仅当它**上升**时发 1 条通知（取新最高档）；同一阈值不重复发 |
| 回落重置 | 用量回落到已通知阈值之下时状态同步下调（不通知），再次穿越可重新通知——适配月度流量重置 / 手动调量 |
| 通知事件 | `customer.traffic_threshold`（warning，四渠道，defaultEnabled），payload.data 带 `customerId/threshold/percent/used/total` |
| 扫描入口 | ① 调度器每日任务（env `REMINDER_SCAN_CRON`，默认 `0 9 * * *`，随 `enableScheduler` 注册）；② 手动 `POST /api/reminders/scan`。逻辑同在 `services/reminder-scan.ts` |
| 仪表盘 | `GET /api/dashboard/stats` 增量 `trafficThresholds[]`（占比 ≥ 50% 的客户，降序，上限 10，含 `notified` 状态）；前端「流量阈值提醒」卡片按档位着色（50 黄 / 80 橙 / 100 红） |

与 `customer.traffic_exhausted` 的关系：100% 档穿越时会**同时**存在一条阈值通知
（一次性）与当天的用尽提醒（按天去重）。前者是穿越告警，后者是每日状态提醒，
语义不同，刻意并存、互不抑制。

实现约束同 §12.4：`publish()` 在事务外调用（C1）；阈值状态写库集中单事务（C2）。

### 12.8 系统备份（TASK-015）

需求：每日自动备份 + 保留策略 + 前端管理页（立即备份 / 下载 / 删除）。

| 维度 | 决策 |
|------|------|
| 备份方式 | `VACUUM INTO` 在线一致性快照（持写锁，毫秒~百毫秒量级）；**不用**裸拷贝——WAL 模式下会丢失未归档写入（ADR-001 / TASK-005 既有结论） |
| 备份内容 | 仅 SQLite 数据库（`app.db` 单文件即全量：客户/订阅/设置/提醒/日志）；不含前端产物与 node_modules |
| 备份位置 | `<数据库所在目录>/backups/`（docker 下即卷内 `/app/data/backups`，随 `./data` 持久化）；env `BACKUP_DIR` 可覆盖为任意绝对路径 |
| 每日任务 | croner job（`{ name: 'db-backup' }`），env `BACKUP_CRON` 默认 `0 3 * * *`，随 `enableScheduler` 注册，`stop()` 一并停 |
| 保留策略 | 每次备份后按创建时间排序，超出 `BACKUP_KEEP`（默认 7，env 可调）删最旧；排序以文件名时间戳为兜底（防文件系统 mtime 粗粒度误删） |
| 文件名 | `app-YYYYMMDD-HHmmss-sss.db`（毫秒级防同秒碰撞）；下载/删除一律经白名单正则 + resolve 后目录双保险校验，杜绝 `../` 路径穿越 |
| 管理页 | `/backups`（侧边栏「系统」组）：列表（文件名/大小/时间）、立即备份、下载、删除（ConfirmDialog 二次确认）、保留策略展示；TASK-014 刷新按钮/错误态重试模式 |

服务端 `services/backup.ts` 与调度器、路由、前端查询四层共享同一套文件名白名单；
所有备份操作（定时/手动/删除）均写 `logs`（module=`backup`）。

**边界（刻意不做）**：不上云、不做加密、不做增量；异地容灾由运维层在宿主机
对备份目录做 rsync/cp 实现，步骤见 `docs/operations/backup-restore.md`。
恢复为手工流程（停服务 → 替换 app.db → 重启），不做应用内一键恢复——
避免误操作覆盖实时数据。
