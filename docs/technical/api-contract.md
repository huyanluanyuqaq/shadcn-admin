# API 契约（前后端共享）

> 状态：生效中 · 创建 2026-10-09
> 所有请求/响应类型由 `shared/src/schema/` 的 zod schema 定义，前后端**均不得**另立类型。

**Base URL：** `/api`（生产由 Hono 同进程提供；开发由 Vite proxy 转发到 `:3000`）
**认证：** `Authorization: Bearer <token>`，除登录与 `/api/health` 外全部接口受保护。
**时间格式：** 统一 epoch 毫秒（number）。
**错误格式：** `{ "error": string, "message"?: string }` + 对应 HTTP 状态码。

---

## 通用

### 列表查询参数（query string）

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `page` | int ≥1 | 1 | 页码 |
| `pageSize` | int 1–200 | 20 | 每页条数 |
| `sortBy` | string | — | 排序字段 |
| `sortOrder` | `asc` \| `desc` | — | 排序方向 |
| `q` | string | — | 关键字模糊搜索（各资源自行定义匹配字段） |

筛选与排序**必须由服务端执行**，禁止前端全量拉取后过滤。

### 列表响应

```ts
{ items: T[], total: number, page: number, pageSize: number }
```

---

## 认证 `/api/auth`

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/login` | body `LoginInput` → `LoginResult` | 否 |
| POST | `/logout` | 客户端丢弃 token 即可，服务端返回 204 | 是 |
| GET | `/me` | `{ username: string }` | 是 |

---

## 资源 CRUD

以下 6 个资源均提供同一组接口（`<r>` 为资源路径）：

| 资源 | 路径 | 输出类型 |
|------|------|---------|
| 分类 | `/api/categories` | `Category` |
| 套餐 | `/api/plans` | `Plan` |
| 客户 | `/api/customers` | `Customer` |
| 订阅 | `/api/subscriptions` | `Subscription` |
| 订阅池 | `/api/subscription-pools` | `Pool` |
| 邮箱绑定 | `/api/email-bindings` | `EmailBinding` |

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/<r>` | 分页列表（支持 `q` / `sortBy` / `sortOrder`） |
| GET | `/<r>/:id` | 单条 |
| POST | `/<r>` | 创建，body 为 `XxxInput` |
| PATCH | `/<r>/:id` | 部分更新 |
| DELETE | `/<r>/:id` | 删除 |
| POST | `/<r>/bulk-delete` | body `{ ids: number[] }` → `{ deleted: number }` |

**客户额外支持筛选：** `status`、`categoryId`、`planId`
**订阅额外支持筛选：** `customerId`、`syncStatus`、`enabled`
**邮箱绑定额外支持筛选：** `subscriptionId`、`status`

### 邮箱绑定（EmailBinding）

邮箱模块管理的是**「邮箱 ↔ 订阅」的绑定关系**，不是邮箱账号：

| 字段 | 类型 | 说明 |
|------|------|------|
| `email` | string(email) | 邮箱地址，**唯一**（一对一） |
| `subscriptionId` | int \| null | 绑定的订阅；null 表示暂未绑定 |
| `status` | `active` \| `disabled` | — |
| `remark` | string \| null | — |

约束与副作用：

- `email` 唯一：重复提交返回 **409 Conflict**（message 为中文提示），而非 500。
- `subscription_id` 外键 `ON DELETE CASCADE`：订阅被删除时其邮箱绑定自动失效。
- 删除绑定**不会**删除订阅本身，只解除关系。
- 不存密码 / 提供商 / 客户：客户归属由 `subscriptions.customerId` 承载，不在本表冗余。

---

## 订阅同步（ADR-003）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/subscriptions/sync` | 批量同步。body `{ ids?: number[] }`，缺省为全部启用的订阅 → `BatchSyncResult` |
| POST | `/api/subscriptions/:id/sync` | 单条同步 → `SyncResult` |
| POST | `/api/subscriptions/scheduler/reload` | 按数据库中 cron 表达式重建调度任务 |

同步规则（架构 §10 约束 C1–C9）：
HEAD 优先回退 GET · 10s 超时 · 并发上限 5 · jitter 0–10 分钟 · 单飞锁 · 单事务批量写入 · 仅变化时写库。

---

## 日志与通知

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/logs` | 分页列表，支持 `level` / `module` / `q` |
| DELETE | `/api/logs` | 清空日志 |
| GET | `/api/reminders` | 分页提醒列表，支持 `isRead` |
| PATCH | `/api/reminders/:id/read` | 标记已读 |
| POST | `/api/reminders/scan` | 扫描到期/超流量客户并生成提醒 → `{ created: number }` |

---

## 仪表盘与设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dashboard/stats` | → `DashboardStats` |
| GET | `/api/settings` | → `Setting[]` |
| PUT | `/api/settings` | body `Setting[]`，upsert |

---

## 健康检查

`GET /api/health` → `{ status: 'ok', database: string, time: string }`（无需鉴权）
