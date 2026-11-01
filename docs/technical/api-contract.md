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
**订阅 `q` 的匹配字段（TASK-049）：** 订阅名称、订阅地址、绑定客户的名称
（三者 OR 模糊匹配；未绑定客户的订阅只参与前两者）。
**邮箱绑定额外支持筛选：** `subscriptionId`、`poolId`、`status`

**`GET /api/email-bindings` 的固定归属条件（TASK-053，不可由入参关闭）：** 列表只返回
「仅注册」与「到期回落」两类记录，其余归订阅管理：

| 归属 | 条件 | 页面 |
|------|------|------|
| 仅注册（两要素） | `subscription_id IS NULL` | 邮箱管理 |
| 到期回落 | 订阅 `customer_id IS NULL` 且 `expire_at + 24h <= now` | 邮箱管理（**同时**仍在订阅管理可见） |
| 待分配 / 在用 | 其余全部 | 订阅管理 |

`expire_at` 为 `NULL`（未取到有效期）按「未到期」处理。该条件是**展示派生**：
不修改任何数据，`subscription_id` 与三要素绑定关系保持不动。
条件仅作用于列表（`GET /` 与 `total`），`GET /:id`、写入、删除不受影响。

### 新增邮箱（前端面板，TASK-053 面板 / TASK-054 单事务落库）

「邮箱管理 → 新增邮箱」只有 `邮箱` / `订阅` / `供应商` 三个字段，保存时前端**只发一次写请求**
`POST /email-bindings/bundle`（TASK-054），由服务端在单个事务内完成「按需新建供应商 →
按需新建订阅 → 写绑定」：

| 输入 | 行为 |
|------|------|
| `poolName` 命中已有供应商（大小写/首尾空格归一） | 复用其 `poolId`，`created.pool = false` |
| `poolName` 未命中 | 事务内新建供应商（`url = ''`），`created.pool = true` |
| 同时给出 `poolId` 与 `poolName` | 以 `poolId` 为准，`poolName` 仅作展示 |
| 订阅留空 | 只建绑定（仅注册态），`subscriptionId = null`、`created.subscription = false` |
| 订阅填了链接 | 事务内新建订阅并挂到该绑定上，`created.subscription = true` |

订阅填值时，该记录**随即从邮箱管理列表消失**（归属条件见上），出现在订阅管理的「未分配」中。

**三张表要么全落、要么零新增**（同一 `db.transaction()`）：任一步失败即整体回滚，
不存在「订阅已进订阅管理、邮箱管理查不到」的中间态，因此也无需「到订阅管理补绑」的补偿提示。
前端**不再**自行调用 `POST /subscription-pools` / `POST /subscriptions` / `POST /email-bindings`
来完成新增——这三个入口仍然存在，但只服务各自的编辑场景。

### 客户邮箱唯一性：按「供应商」维度（TASK-052 强绑定，2026-11-01 修订）

判定单元是 **`(邮箱, 供应商)`**，与邮箱绑定表的唯一索引 `(email, pool_id)` 同口径。
**同一邮箱可在不同供应商处各注册一次，不算重复**（原「全局唯一」规则已作废）。
`POST /customers` 与 `PATCH /customers/:id` 在写入前校验：

| 规则 | 行为 |
|------|------|
| 同供应商下邮箱与其他客户重复（**大小写不敏感**，`lower()` 比较；首尾空格忽略） | **409** `{ error: 'Conflict', message: '该邮箱在供应商「<供应商名>」下已被客户「<客户名>」使用' }` |
| 邮箱相同但供应商不同 | 正常写入（跨供应商各注册一次） |
| PATCH 未携带 `poolId` | 按库中现值判定供应商，不视为"跨供应商" |
| 邮箱与自身原值相同（PATCH 排除自身） | 正常写入 |
| 邮箱为 `null` / 省略（清空或不涉及） | 不校验 |
| 只改其它字段（不含 `email` 键） | 不校验（部分更新只检查入参出现的键） |

**只阻止新引入的重复，不改动历史数据**：库里已存在的重复邮箱保持原样，编辑这些客户时
只要不动 `email` 就照常保存。前端无需预校验，409 的 `message` 由客户表单 `toast.error` 直接展示
（`ApiError` 携带服务端 message）。

### 客户归档 `POST /api/customers/:id/archive`

归档与删除的区别：**删除**客户会按外键**级联删除**其订阅；**归档**先在事务内把该客户
订阅的 `customer_id` 置 null（订阅本身及其邮箱绑定保留在订阅管理中），再删除客户记录。
返回 `{ archived: true, subscriptionsKept: number }`（保留的订阅条数）；客户不存在返回 404。
客户列表行操作菜单的「归档」即调用此端点（删除弹窗中亦有指引）。

**到期自动归档（TASK-053）**：调度器每日 04:00（`CUSTOMER_ARCHIVE_CRON` 可调）执行
`runCustomerArchiveScan()`，对 `customers.expire_at <= now` 的客户执行与上面**完全相同**的
归档逻辑（订阅置 `customer_id = null`，再删客户行；不软删）。判据只看**客户购买到期**，
与订阅链接自身的有效期无关。`CUSTOMER_AUTO_ARCHIVE=false` 可停用该定时任务（手动端点不受影响）。
归档后其订阅在订阅管理显示「未分配」，三要素绑定保持不变。

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
| `expireAt` | number（**必填，不可为 null**） | 到期时间；**选了购买时间且套餐有档位时按「购买时间 + 档位天数」自动计算并物化**，否则手动选择。**TASK-041 起写入必填**：`POST` 缺此字段 → 400；`PATCH` 可**省略**（部分更新不受影响），但传 `{ expireAt: null }` → 400（不允许清空）。**读取仍可能为 `null`** —— 历史数据中已存在的空值保留不回填（ADR-005），故输出类型维持 `number \| null`。`purchasedAt` / `subscriptionExpireAt` 仍可空 |
| `trafficTotal` | number \| null | **月流量**（字节），null 表示不限。**纯存量列**：表单管理字段，不参与生效上限派生（人类裁决 2026-10-20） |
| `trafficManualCap` | number \| null | 手动流量上限（字节），**优先级高于套餐月流量**；null 表示未设置 |
| `subscriptionUrl` | string \| null | 订阅链接 |
| `subscriptionExpireAt` | number \| null | 订阅链接到期时间（epoch ms），由「拉取订阅更新」从链接获取 |

生效流量上限（列表用量条）按 **`trafficManualCap ?? 套餐月流量`** 派生（人类裁决
2026-10-20 / TASK-046），手动上限优先；两者皆无 ⇒ 不限流量、不显示百分比。
订阅拉取的流量额度与 `customers.traffic_total` 均**不参与**派生。
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
| **换 URL 后保存**（原链接 → 新链接） | 新链接按上两行落到订阅管理；**原链接对应的订阅解除与该客户的关联**（PATCH `{ customerId: null }`）——订阅本身保留在订阅管理，`绑定客户` 列显示「未分配」。仅当该订阅当前仍属于本客户时才解绑，避免误伤他人订阅 |
| 清空 URL 后保存 | 解除原订阅与该客户的关联（PATCH `{ customerId: null }`），**不删除订阅** |

同步字段：`name` / `url` / `poolId` / `email` / `cronExpr` / `userAgent` / `headers` /
`skipTlsVerify` / `proxyUrl` / `enabled` / `trafficTotal` / `expireAt`；
`trafficUsed` 透传匹配订阅原值（缺省 0），防止前端覆盖同步引擎写入的用量数据。
`poolId` 跟随客户供应商（基本信息），客户表单不再单独设置所属供应商（与「供应商」去重）；
客户未设供应商时保留匹配订阅的原有供应商，避免误清。`email` 取客户邮箱（客户即邮箱归属），
客户未填邮箱时保留匹配订阅的原有邮箱，同样避免误清。订阅名称留空时默认拉取供应商名，
回落链为「订阅名称 → 供应商名 → 客户名称」。编辑客户进入弹窗时，已匹配
订阅的配置会一次性预填到表单（不清空用户已填值）。

#### 保存客户时的写入顺序与三页一致性（TASK-052）

表单只提交一次，服务端写入被前端编排成固定顺序，任一步失败都**不回滚已成功的前序步骤**
（邮箱同步失败仅 toast，不阻断主保存）：

```
① PATCH/POST /customers          客户基本字段（含 email；邮箱重复 → 409，到此终止）
② PATCH/POST /subscriptions…     订阅：新链接落库（新建 / 接管），旧链接解绑
③ POST /subscriptions/:id/sync   用量回写（仅 ② 落到具体订阅时）
④ POST /email-bindings/sync      邮箱绑定（仅 ② 落到具体订阅时）
```

各场景保存后三处页面的**最终形态**（A = 客户，B/BB = 新旧邮箱，C/CC = 新旧订阅）：

| 保存动作 | 客户管理（A 行） | 订阅管理 | 邮箱管理 |
|---|---|---|---|
| 换邮箱 B→BB **且** 换链接 C→CC | BB / CC | CC 绑定 A；**C 保留、未分配** | BB 指向 CC、属 A；**B 保留、未分配**（仍指向 C） |
| 只换链接 C→CC（邮箱不变 B） | B / CC | CC 绑定 A；C 未分配 | B 改绑到 CC、属 A（邮箱未变即跟着客户走） |
| 清空链接 + 换邮箱 B→BB | BB / 空 | C 未分配 | **B 保留、未分配**；BB 不建绑定行（本次未落订阅） |
| 只换邮箱 B→BB（链接不变 C） | **不允许保存** | — | — |

（最后一行仅指「原本就绑着链接且链接没动」；仅注册态 E1——客户名下本就没有链接——
改邮箱不涉及订阅身份，正常放行。）

规则可归为两句：

1. **邮箱与订阅链接必须整体替换**（三要素强绑定）：只有链接变了，邮箱才能变。
   「只换邮箱、链接不变」会让同一条订阅出现两个邮箱身份，前端提交前拦截并提示
   （`customers-action-dialog.tsx`），服务端另有 409 兜底（见下节）。
2. **旧记录一律不改名**（TASK-053 删除 TASK-052 的邮箱迁移机制）：换链接后旧邮箱记录
   原样留在邮箱管理里，与旧订阅一起显示为「未分配」。

订阅管理页「绑定客户」列对 `customerId = null` 统一显示**「未分配」**（TASK-052 起；
此前为 `-`），与邮箱管理页口径一致。

#### 「分配」入口（TASK-053，纯前端）

未分配行就地提供「分配」按钮：跳 `/customers?assignUrl=<订阅链接>&assignEmail=<订阅邮箱>&assignPoolId=<供应商 id>`，
客户新建弹窗按这三个参数预填。**不新增接口**——保存时由既有保存流按订阅链接命中该订阅，
`PATCH /api/subscriptions/:id` 写入 `customerId`（以及邮箱 / 供应商快照），订阅随即从「未分配」变为有主。
参数在弹窗关闭时从 URL 上清掉，避免刷新后又弹一次。

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
  subscriptionId?: number | null // 绑定到的订阅；null 表示不做 upsert
}
```

upsert 语义（匹配键 `(email, pool_id)`，单事务内完成）：

| 场景 | 行为 |
|------|------|
| 该 `subscriptionId` 已挂着**另一个邮箱**的绑定 | **409** `{ error: 'Conflict', message: '该订阅已绑定邮箱「<邮箱>」…' }`——一条订阅只能有一个邮箱身份。它是「只换邮箱不换链接」的**服务端兜底**（前端已先拦一次）；同样会在「订阅表单直接改邮箱」时触发，因为服务端无法判断链接是否也变了 |
| 该 (email, pool) 已有绑定 | 改绑到本次 `subscriptionId`（`status` / `remark` 不动） |
| 不存在 | 创建绑定（`status` 默认 `active`） |
| 同邮箱指向同一订阅、但供应商不同的陈旧绑定 | 一并清理（一条订阅只保留一个供应商身份；客户改供应商后重新保存即此场景） |
| `subscriptionId: null` | **不做 upsert / 不清理**（不新建「未绑定」行，也不改动任何旧记录）；响应 `action: null`、`binding: null` |

响应 `{ action: 'created' | 'updated' | null, cleaned: number, binding: EmailBinding | null }`
（`action` / `binding` 在 `subscriptionId: null` 路径下为 `null`；`cleaned` 为本次清理的陈旧绑定条数）。

> **TASK-053 变更**：入参 `previousEmail` 与响应字段 `migrated` **已删除**（连同整段改名迁移逻辑）。
> 旧邮箱记录不再被「并入新邮箱」，而是**原样保留并仍指向旧订阅**：客户改邮箱时会连同链接一起换，
> 旧订阅就此解除归属（`customer_id = null`），因此旧邮箱记录按归属表落在 **E2（待分配）/ E4（到期回落）**，
> 而不是「仅注册态」；只有当它的 `subscription_id` 本身为 `NULL` 时才是 **E1 仅注册态**。
> 四个调用方/文档同步改动，依据是「邮箱与订阅链接必须整体替换」的裁决——旧机制服务的场景
> （只换邮箱）已被判定不成立。

校验：邮箱格式 / 订阅不存在 / 供应商不存在均返回 **400**（中文 message）；同一订阅两个邮箱 **409**。

#### 新增邮箱单事务落库 `POST /api/email-bindings/bundle`

「新增邮箱」面板的写入入口（TASK-054）。一次请求完成「按需新建供应商 → 按需新建订阅 → 写绑定」，
三张表写入在**同一个 `db.transaction()`** 内：要么全落，要么零新增。请求 body：

```ts
{
  email: string           // 必填，合法邮箱
  poolId?: number         // 既有供应商 id；与 poolName 二选一，都给时以本字段为准
  poolName?: string       // 供应商名称（trim）；未命中则按 trim + 大小写不敏感判重后新建
  subscriptionUrl?: string // 订阅链接（trim）；缺省或空串 ⇒ 只建绑定（仅注册态 E1）
  remark?: string | null  // 写入绑定
  status?: 'active' | 'disabled' // 默认 active
}
```

响应 `201`：

```ts
{
  binding: EmailBinding,      // 新建的绑定行
  poolId: number,             // 本次落定的供应商 id
  poolName: string,           // 本次落定的供应商名称（取库中原值）
  subscriptionId: number | null, // 未建订阅（仅注册态）为 null
  created: { pool: boolean, subscription: boolean }
}
```

错误：

| 状态 | 场景 | message |
|------|------|---------|
| `400` | `poolId` 与 `poolName` 都缺 | `供应商不能为空` |
| `400` | `poolId` 指向不存在的供应商 | `供应商不存在` |
| `400` | 邮箱格式不合法 / `poolName` 为空白 | zod 中文提示 |
| `409` | `(email, poolId)` 已有绑定（判重 ①） | `该邮箱已绑定同一供应商下的订阅，请直接编辑已有绑定`（与邮箱绑定 CRUD 同一文案） |
| `409` | `subscriptionUrl` 已在 `subscriptions` 登记，且该订阅未挂本邮箱（判重 ②） | `订阅链接已在订阅管理中` |
| `409` | `subscriptionUrl` 已登记，且该订阅挂着**别的邮箱**（判重 ③） | `该订阅已绑定邮箱「<邮箱>」。一条订阅只能对应一个邮箱，如需更换邮箱请同时更换订阅链接` |

判重顺序为 ① → ② → ③，**全部在写库之前**，命中即返回 409、三张表零新增。
其中 ② 是「失败后重试」的防线：`subscriptions.url` **没有唯一索引**（schema 仅两个普通索引），
重复点击不会被数据库挡住，必须由服务端显式判重。

订阅新建字段与 TASK-053 前端原口径逐字一致：`customerId = null`、`name = null`、
`cronExpr = '0 */6 * * *'`、`enabled = true`、`trafficUsed = 0`。

> **与 `POST /email-bindings/sync` 的分工**：`sync` 服务客户表单 / 订阅表单的「保存即同步」，
> 语义是 upsert（同键改绑、清理陈旧绑定）；本端点是「新增邮箱」的一次性写入，语义是
> create-or-409。两者互不影响，`sync` 的入参与行为**未因本端点改动**。

前端两个调用方：订阅表单（表单邮箱 + 所属供应商 + 保存后的订阅 id）与客户表单
（客户邮箱 + 客户供应商 + 同步落到的订阅 id）；**客户表单在本次未落订阅时不调用**
（无订阅可绑，调用只会是空转请求）。同步失败不阻断主保存，仅 toast 提示。

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

## 系统备份（TASK-015；TASK-050 增加导入与恢复）

全部端点位于 authMiddleware 之后（需登录）；备份文件即完整数据库快照，
下载、删除、导入与恢复都必须鉴权。文件名一律经服务端白名单校验（防路径穿越）。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/backups` | → `{ items: BackupFile[], policy: BackupPolicy }`，items 按创建时间新→旧 |
| POST | `/api/backups` | 立即执行一次备份（VACUUM INTO），201 → `BackupFile`；失败 500 |
| POST | `/api/backups/import` | 导入备份（TASK-050），见下方「导入」；成功 201 → `BackupImportResult` |
| GET | `/api/backups/:filename/download` | 下载附件（`application/vnd.sqlite3` + `Content-Disposition: attachment` + `Cache-Control: no-store`）；文件名不合法或不存在 404 |
| POST | `/api/backups/:filename/restore` | 排程一次恢复（TASK-050），见下方「恢复」；成功 202 → `BackupRestorePlan` |
| DELETE | `/api/backups/:filename` | 删除备份；不存在 404 |

`BackupFile`：`{ filename: string, size: number, createdAt: number }`（shared `backupFileSchema`）。
`filename` 恒匹配 `^(app|imp)-\d{8}-\d{6}-\d{3}\.db$`：`app-` = 本机生成，`imp-` = 外部导入。
`BackupPolicy`：`{ keep: number, cron: string, restoreAutoExit: boolean }`。
`policy.cron` 为 env `BACKUP_CRON`（默认 `0 3 * * *`），`policy.keep` 为 env `BACKUP_KEEP`（默认 7），
`policy.restoreAutoExit` 为 env `RESTORE_AUTO_EXIT`（默认 `true`）——供前端提示「本环境恢复后
不会自动重启」与冒烟避免服务端自杀。

备份位置默认 `<数据库所在目录>/backups/`（env `BACKUP_DIR` 可覆盖）；
每日自动备份与保留策略见架构 §12.8，恢复步骤见 `docs/operations/backup-restore.md`。

### 导入备份（TASK-050）

`POST /api/backups/import`

- 请求：`Content-Type: application/octet-stream`，请求体即 `.db` 文件原始字节流
  （**不走 multipart**）。可选头 `X-Backup-Filename: <原始文件名>`，**仅入审计日志**，
  不参与落盘命名。
- 响应 201 → `BackupImportResult`：
  `{ item: BackupFile, origin: string | null, sha256: string }`
  （`item.filename` 为 `imp-` 前缀，`sha256` 为 64 位十六进制，`origin` 回显 `X-Backup-Filename`）。
- 失败（任一层不通过均**不在备份目录留任何残留**：先写 `<name>.part`，通过后才原子 rename）：

| 状态 | 条件 |
|------|------|
| 413 | `Content-Length` 或实际长度 > 64 MiB |
| 400 | 长度 < 512 字节，或前 16 字节不等于 `SQLite format 3\0` |
| 400 | 只读打开后 `PRAGMA integrity_check` 不等于 `ok` |
| 400 | `sqlite_master` 缺少 `admins` / `customers` / `subscriptions` / `settings` / `logs` 任一表 |

### 恢复备份（TASK-050）

`POST /api/backups/:filename/restore`

- 请求体：`{ "confirm": "<filename>" }`，`confirm` 必须与路径参数**逐字相等**（二次确认，
  恢复会覆盖当前数据库）。
- 前置校验：文件名白名单 + 文件存在（否则 404）；`confirm` 不相等 → 400；
  目标文件 `integrity_check` + 五表校验不过 → 400（**不写标记**）。
- 响应 202 → `BackupRestorePlan`：`{ scheduled: true, filename: string, restartExpected: boolean }`。
  排程内容写入 `<数据库所在目录>/.restore-pending.json`，并在**下一次启动、打开数据库
  连接之前**被应用（现库改名留作 `pre-restore-*` 回退副本、复制备份为 `app.db`、
  删 `-wal`/`-shm`、删标记）。`restartExpected` 反映本环境是否会自动退出进程以触发重启。

---

## 健康检查

`GET /api/health` → `{ status: 'ok', database: string, time: string }`（无需鉴权）
