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

未传 `sortOrder` 时按资源默认方向：多数资源为 `desc`（最新在前）；**供应商为 `asc`**
（自定义顺序在前，见「供应商自定义排序」）。

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
| 供应商（订阅池） | `/api/subscription-pools` | `Pool` |
| 邮箱绑定 | `/api/email-bindings` | `EmailBinding` |

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/<r>` | 分页列表（支持 `q` / `sortBy` / `sortOrder`） |
| GET | `/<r>/:id` | 单条 |
| POST | `/<r>` | 创建，body 为 `XxxInput` |
| PATCH | `/<r>/:id` | 部分更新 |
| DELETE | `/<r>/:id` | 删除 |
| POST | `/<r>/bulk-delete` | body `{ ids: number[] }` → `{ deleted: number }` |

**客户额外支持筛选：** `status`、`poolId`、`planId`
**订阅额外支持筛选：** `customerId`、`syncStatus`、`enabled`
**邮箱绑定额外支持筛选：** `subscriptionId`、`poolId`、`status`

### 客户归档 `POST /api/customers/:id/archive`

归档与删除的区别：**删除**客户会按外键**级联删除**其订阅；**归档**先在事务内把该客户
订阅的 `customer_id` 置 null（订阅本身及其邮箱绑定保留在订阅管理中），再删除客户记录。
返回 `{ archived: true, subscriptionsKept: number }`（保留的订阅条数）；客户不存在返回 404。
客户列表行操作菜单的「归档」即调用此端点（删除弹窗中亦有指引）。

### 供应商自定义排序 `POST /api/subscription-pools/reorder`

供应商（机场提供商）支持自定义排序：`Pool.sortOrder` 为排序序号（int，升序越靠前）。

- **创建**时由服务端自动分配（当前最大值 + 1，追加到末尾），入参不可指定；
- **调整顺序**统一走重排端点——`sort_order` 不经创建/更新入参写入，避免序号竞争；
- **默认排序**：不传 `sortBy` / `sortOrder` 时按 `sortOrder` 升序返回
  （其余资源缺省为创建时间倒序，见上文）。

请求 body 为**完整有序 id 数组**（下标即新 `sort_order`），与前端拖拽后的提交一致：

```ts
{ ids: number[] } // 如 [3, 1, 2] 表示把 #3 移到最前
```

响应 `{ reordered: number }`。校验：ids 非空（400 `ids 不能为空`）、无重复
（400 `ids 存在重复`）、全部存在（400 `包含不存在的供应商`）；重写在单事务内完成，
重复提交同一数组幂等。

前端「供应商管理」弹窗：默认自定义顺序，按住行首手柄拖拽调整
（提交完整有序数组，乐观更新 + 失败回滚）；点击「名称 / 创建时间」列头按
升 → 降 → 自定义 循环切换，排序激活时拖拽停用。客户表单「供应商」与订阅
「供应商」下拉同样遵循该顺序。

> 术语（2026-10-10 统一）：界面文案一律称「**供应商**」（原「订阅池 / 订阅提供商」）；
> API 路径 `/subscription-pools`、字段 `poolId`、数据表 `subscription_pool` 为历史名称，
> 不随 UI 变更（避免迁移与破坏性接口改动）。

### 套餐（Plan）的四档周期价格

套餐计价为「一个套餐 + 四档周期」，时长固定，价格为可空数值（null = 不提供该周期）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `priceMonthly` | number \| null | 月付价格（元），对应 30 天 |
| `priceQuarterly` | number \| null | 季付价格（元），对应 90 天 |
| `priceSemiannual` | number \| null | 半年价格（元），对应 180 天 |
| `priceYearly` | number \| null | 年付价格（元），对应 360 天 |
| `trafficLimit` | number \| null | **月流量**上限（字节），null 表示不限 |

创建时四档价格字段均为必填 key（值可为 null）；更新（PATCH）为部分更新，
传 null 即清空对应档位。数据库另有 `price` / `duration_days` 两个遗留列
（迁移 0004 已把存量数据按周期回填至对应档位列），新数据不再写入。

### 客户与套餐档位的联动

客户表单的「套餐」下拉按四档时长展开（每个套餐为其**有价格的档位**各生成一项，
如「普通套餐 · 月付（30 天）」；四档均无价格的套餐退化为纯名称项）。
下拉值为组合串 `"<planId>:<tier>"`，提交时拆分为：

- `customers.plan_id`：所属套餐
- `customers.plan_tier`：选定档位（`monthly` / `quarterly` / `semiannual` /
  `yearly`），null 表示未指定（老数据或套餐无价格档位）

客户列表的「套餐」列显示为「套餐名 · 档位标签」。

### 客户的订阅信息字段

客户表单按「基本信息 / 订阅信息 / 订阅链接」三部分组织（迁移 0006 新增四列）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `purchasedAt` | number \| null | 购买时间（epoch ms） |
| `expireAt` | number \| null | 到期时间；**选了购买时间且套餐有档位时按「购买时间 + 档位天数」自动计算并物化**，否则手动选择 |
| `trafficTotal` | number \| null | **月流量**（字节），null 表示不限 |
| `trafficManualCap` | number \| null | 手动流量上限（字节），**优先级高于月流量**；null 表示未设置 |
| `subscriptionUrl` | string \| null | 订阅链接 |
| `subscriptionExpireAt` | number \| null | 订阅链接到期时间（epoch ms），由「拉取订阅更新」从链接获取 |

生效流量上限（列表用量条）按 `trafficManualCap ?? trafficTotal` 派生，手动上限优先。
`dateKeys` 含 `expireAt` / `purchasedAt` / `subscriptionExpireAt`（number ↔ Date 由 CRUD 工厂转换）。

迁移 0010（TASK-013）新增阈值通知状态列 `customers.traffic_threshold_notified`（number，默认 0）：
记录「当前所在最高已通知阈值」（0 = 未达到任何阈值），**仅服务端内部维护，不参与表单入参**
（客户表单的订阅字段仍只有上表六列）。

#### 客户第三部分 → 订阅管理的实时同步

客户表单第三部分（订阅链接 + 订阅配置）的字段与订阅管理编辑页一致，保存客户时
按「URL 匹配」将配置实时同步到订阅管理（前端编排：先存客户拿到 id，再匹配订阅）：

| 场景 | 行为 |
|------|------|
| URL 与既有订阅匹配 | 更新该订阅（含更换链接后的重新匹配），`customerId` 固定为当前客户 |
| URL 未匹配任何订阅 | 创建订阅并绑定当前客户 |
| 清空 URL 后保存 | 解除原订阅与该客户的关联（PATCH `{ customerId: null }`），**不删除订阅** |

同步字段：`name` / `url` / `poolId` / `email` / `cronExpr` / `userAgent` / `headers` /
`skipTlsVerify` / `proxyUrl` / `enabled` / `trafficTotal` / `expireAt`；
`trafficUsed` 透传匹配订阅原值（缺省 0），防止前端覆盖同步引擎写入的用量数据。
`poolId` 跟随客户供应商（基本信息），客户表单不再单独设置所属供应商（与「供应商」去重）；
客户未设供应商时保留匹配订阅的原有供应商，避免误清。`email` 取客户邮箱（客户即邮箱归属），
客户未填邮箱时保留匹配订阅的原有邮箱，同样避免误清。订阅名称留空时默认拉取供应商名，
回落链为「订阅名称 → 供应商名 → 客户名称」。编辑客户进入弹窗时，已匹配
订阅的配置会一次性预填到表单（不清空用户已填值）。

### 邮箱绑定（EmailBinding）

邮箱模块管理的是**「邮箱 ↔ 订阅」的绑定关系**，不是邮箱账号。绑定身份为
**「邮箱 + 供应商」**（2026-10-10 用户确认）：同一邮箱在同一供应商下只有一条绑定，
同一邮箱可以绑定不同供应商下的多条订阅。

| 字段 | 类型 | 说明 |
|------|------|------|
| `email` | string(email) | 邮箱地址 |
| `poolId` | int \| null | 供应商快照；与 `email` 共同构成唯一身份，null 表示未指定供应商 |
| `subscriptionId` | int \| null | 绑定的订阅；null 表示暂未绑定 |
| `status` | `active` \| `disabled` | — |
| `remark` | string \| null | — |

约束与副作用：

- **复合唯一索引 `(email, pool_id)`**（迁移 0008 由 email 单列唯一改造而来）：
  同邮箱 + 同供应商重复提交返回 **409 Conflict**（message 为中文提示），而非 500；
  同邮箱 + 不同供应商、或同邮箱 + 未指定供应商均为合法的新身份
  （SQLite 唯一索引视 NULL 互异）。
- `pool_id` 为**快照身份字段**：同步时取自来源（订阅的所属供应商 / 客户的供应商），
  不随后续订阅改供应商而漂移；删除供应商时置 null（`ON DELETE SET NULL`）。
- `subscription_id` 外键 `ON DELETE CASCADE`：订阅被删除时其邮箱绑定自动失效。
- 删除绑定**不会**删除订阅本身，只解除关系。
- 不存密码 / 客户：客户归属由 `subscriptions.customerId` 承载，不在本表冗余。
- 订阅表新增 `email` 列（迁移 0008）：该订阅的邮箱标识，订阅表单可编辑，
  存量值由所属客户的邮箱回填。

#### 保存即同步 `POST /api/email-bindings/sync`

客户 / 订阅表单保存成功后由前端调用（保存即同步，新增与编辑均生效），把
「邮箱 + 供应商 + 订阅」落到邮箱管理。请求 body：

```ts
{
  email: string          // 必填，合法邮箱
  poolId?: number | null // 供应商快照；null/缺省表示未指定供应商
  subscriptionId?: number | null // 绑定到的订阅；null 表示暂不绑定
}
```

upsert 语义（匹配键 `(email, pool_id)`，单事务内完成）：

| 场景 | 行为 |
|------|------|
| 该 (email, pool) 已有绑定 | 改绑到本次 `subscriptionId`（`status` / `remark` 不动） |
| 不存在 | 创建绑定（`status` 默认 `active`） |
| 同邮箱指向同一订阅、但供应商不同的陈旧绑定 | 一并清理（一条订阅只保留一个供应商身份；客户改供应商后重新保存即此场景） |

响应 `{ action: 'created' | 'updated', cleaned: number, binding: EmailBinding }`。
校验：邮箱格式 / 订阅不存在 / 供应商不存在均返回 **400**（中文 message）。
前端两个调用方：订阅表单（表单邮箱 + 所属供应商 + 保存后的订阅 id）与客户表单
（客户邮箱 + 客户供应商 + 同步落到的订阅 id）；同步失败不阻断主保存，仅 toast 提示。

---

## 订阅同步（ADR-003）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/subscriptions/sync` | 批量同步。body `{ ids?: number[] }`，缺省为全部启用的订阅 → `BatchSyncResult` |
| POST | `/api/subscriptions/:id/sync` | 单条同步 → `SyncResult` |
| POST | `/api/subscriptions/preview` | 订阅链接预览（客户表单「拉取订阅更新」）。body `{ url: string }` → `SubscriptionPreview`；失败返回 502 + 中文 message |
| POST | `/api/subscriptions/scheduler/reload` | 按数据库中 cron 表达式重建调度任务 |

预览的两段式策略（`source` 字段区分）：链接**已在订阅管理中登记**时先触发一次
同步刷新该订阅再返回最新数据（`source: 'db'`）；未登记时由服务端实时拉取
`subscription-userinfo` 响应头（`source: 'live'`，不写库）。响应含
`trafficUsed` / `trafficTotal` / `expireAt`（epoch ms，上游未提供为 null）。

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
| POST | `/api/reminders/scan` | 扫描到期/超流量客户并生成提醒，并按流量阈值（50/80/100）发送穿越式通知 → `{ created: number, thresholds: { checked, notified, reset } }`（TASK-013；`days` 查询参数控制到期窗口，默认 7） |

---

## 仪表盘与设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dashboard/stats` | → `DashboardStats`（含 `trafficThresholds[]`：达到 50%/80%/100% 阈值的客户，降序上限 10，TASK-013） |
| GET | `/api/settings` | → `Setting[]` |
| PUT | `/api/settings` | body `Setting[]`，upsert |

`DashboardStats.trafficThresholds[]` 元素：`{ id, name, used, total, percent, threshold, notified }`。
`threshold` 为当前所在最高阈值（50/80/100），`notified` 表示该阈值是否已发出通知
（扫描落库于 `customers.traffic_threshold_notified`，穿越式触发、回落重置）。

---

## 系统备份（TASK-015）

全部端点位于 authMiddleware 之后（需登录）；备份文件即完整数据库快照，
下载与删除都必须鉴权。文件名一律经服务端白名单校验（防路径穿越）。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/backups` | → `{ items: BackupFile[], policy: { keep: number, cron: string } }`，items 按创建时间新→旧 |
| POST | `/api/backups` | 立即执行一次备份（VACUUM INTO），201 → `BackupFile`；失败 500 |
| GET | `/api/backups/:filename/download` | 下载附件（`application/vnd.sqlite3` + `Content-Disposition: attachment`）；文件名不合法或不存在 404 |
| DELETE | `/api/backups/:filename` | 删除备份；不存在 404 |

`BackupFile`：`{ filename: string, size: number, createdAt: number }`（shared `backupFileSchema`）。
`filename` 恒为 `app-YYYYMMDD-HHmmss-sss.db`（白名单正则 `^app-\d{8}-\d{6}-\d{3}\.db$`）。
`policy.cron` 为 env `BACKUP_CRON`（默认 `0 3 * * *`），`policy.keep` 为 env `BACKUP_KEEP`（默认 7）。

备份位置默认 `<数据库所在目录>/backups/`（env `BACKUP_DIR` 可覆盖）；
每日自动备份与保留策略见架构 §12.8，恢复步骤见 `docs/operations/backup-restore.md`。

---

## 健康检查

`GET /api/health` → `{ status: 'ok', database: string, time: string }`（无需鉴权）
