# TASK-046 — 修复「更换订阅链接后仪表盘仍显示流量用尽」（根因 A 缓存未失效 + 根因 B 生效上限分母不更新）

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-046
Title: 修复换订阅后仪表盘流量状态不刷新（缓存失效 + 生效上限分母）
Workflow: bugfix
Status: REVIEW
Priority: P1
Owner: 主控位（设计）→ 执行位（实施完成，待审查）
Owner Since: 2026-10-20
Assigned Role: coordinator（设计）→ developer（实施完成）；审查由主控位承担
Created: 2026-10-20
Updated: 2026-10-20
Branch: chore/TASK-046-traffic-status-refresh
Requires Human Approval: true   # 含数据口径变更（生效上限来源）
```

> **编号说明**：001–045 已占用；TASK-045 仍留 `tasks/review/`（待第十三实例回写），本任务取 **046**。

---

## Objective

修复以下缺陷：**客户流量耗尽后，在客户管理页更换订阅链接并保存成功，仪表盘「流量阈值提醒」卡片仍显示该客户 100%**。

修复后须满足：
1. 更换订阅保存成功 → **仪表盘流量状态立即重新获取**（不需等 5 分钟缓存过期、不需手动刷新）；
2. 仪表盘显示**新订阅对应的额度与剩余量**；
3. **流量确实耗尽且未更换订阅时，仍正确显示 100%**（不得把「用尽」状态一并修掉）。

---

## Background

主控位 2026-10-20 10:4x~14:3x 逐层实测定位（非档案自述）。**两个根因是「与」关系**，
只修其一都不足以让用户看到正确结果。

### 数据来源（实测链路）

```
仪表盘页面 src/features/dashboard/index.tsx
  └─ useDashboardStatsQuery()  src/features/dashboard/queries.ts
       queryKey = dashboardKeys.stats = ['dashboard','stats']
       staleTime 5 分钟（src/context/auth-context.tsx:42 同款全局默认）
  └─ GET /dashboard/stats  server/src/routes/dashboard.ts
       ├─ trafficThresholds ← listTrafficThresholdStatuses()  server/src/services/traffic-threshold.ts
       │     └─ loadTrafficRows() —— **每次实时查库**，非扫描快照
       │        生效上限 = effectiveCustomerTrafficTotal(planTrafficLimit, trafficManualCap)
       │                   = 手动上限 ?? 套餐月流量
        │                （整改后口径；主控位定位时为三值「手动 ?? 套餐 ?? 存量」，见 KI-1）
       │        百分比 = trafficUsagePercent(trafficUsed, total)
       └─ remindersUnread ← count(*) from reminders where is_read = 0
```

### 根因 A（缓存未失效 · 主因）

`src/features/customers/components/customers-action-dialog.tsx:428`

```ts
void queryClient.invalidateQueries({ queryKey: customerKeys.root })   // ['customers']
```

`customerKeys.root = ['customers']` 与 `dashboardKeys.stats = ['dashboard','stats']`
是**完全独立的两个 key**，后者**从未被 invalidate**。
叠加 `staleTime: 5 * 60 * 1000` ⇒ **换订阅后 5 分钟内仪表盘必是旧值**。

### 根因 B（生效上限分母不更新 · 次因，决定性证据）

1. `subscriptions.traffic_total` **有**写入方：订阅同步时更新（订阅行自身字段，
   与客户口径无关；首轮曾据此加客户行镜像，**已按人类裁决撤销**，见 KI-1）。
2. ⚠️ **本条原始判断有误，已被 KI-1b 修正**：主控位定位时只在 `server/src/`
   内 grep drizzle 直写（`set({...trafficTotal`），据此一度认为该列无人写入。
   **实际**：客户表单「月流量（GB）」（`trafficMonthlyGb`）经 `toCustomerInput`
   （`src/features/customers/data/schema.ts:298-301`）在**每次保存**时写入
   `customers.traffic_total`（通用 CRUD `crud.ts` 的 `.set(values)`；
   入参 schema 含 `trafficTotal`，`shared/src/schema/entities.ts:109`）。
   ⇒ 该列是**用户可编辑的月流量字段**，不是无人写入的存量列
   （主控位已独立复核，修正成立）。
3. 表单里的「订阅流量上限」真名是 **`subscriptionTrafficTotalGb`**，
   经 `buildSubscriptionInput`（`src/features/customers/data/schema.ts:404-407`）
   写进 **subscriptions 表**。
4. ⇒ **触发条件（旧口径下的定位结论；口径已改，见 KI-1）**：当客户
   **既无手动上限、也无套餐**（`planId` 为 null）时，旧口径的生效上限落到
   第三顺位 `customers.traffic_total`（换订阅后不随之更新）⇒ 百分比仍可能 100%。
   ⚠️ **新口径（人类裁决）下该场景为「不限流量」**（手动与套餐皆无 ⇒ null），
   见 R2 / HANDOFF-003；本任务的最终修复**不包含**「让存量额度跟随订阅」。

### 已排除的假设（勿重复排查）

| 假设 | 排除依据 |
|------|---------|
| 后端数据陈旧 | `syncOne` 的 `changed()` 覆盖 used/total/expire；`tx.update(customers).set({trafficUsed: used})` **在同事务内确实会写** |
| 仪表盘用了扫描快照 | `listTrafficThresholdStatuses` **每次实时查库**；`trafficThresholdNotified` 只影响「已通知/待通知」文案，**不影响百分比** |
| 保存时序颠倒 | 保存链为 `updateCustomer → syncSubscription → syncSubscriptionUsage`，**用量就绪在邮箱绑定之前**，顺序正确 |
| 后端返回陈旧列表 | 列表接口 `select()` 全字段返回，`trafficTotal` 在客户行内 |

### 官方做法（已查证，非自创）

TanStack Query 官方文档《Invalidations from Mutations》《Query Invalidation》：
- `invalidateQueries({ queryKey: [...] })` **按前缀匹配**；
- 推荐 **key factory** 层级：`all → lists → list`，`all` 用于批量失效；
- `invalidateQueries` 使匹配项**立即标 stale 并在后台 refetch**（活跃 observer）。

---

## Scope

- **根因 A 修复**：`customers-action-dialog.tsx` 保存成功后，使仪表盘统计查询失效。
- **根因 B 修复**：生效上限改按**人类裁决口径**（手动上限 ?? 套餐月流量；
  订阅拉取额度与表单存量月流量均不参与）。原「换订阅后反映新订阅额度」的
  方向已作废，详见 R2 / `HANDOFF-003-coordinator-to-implementer.md`。
- 对应测试（浏览器 vitest）。
- 本任务自身的 `TASK.md` / `handoffs/` 记录。

## Non-Scope

- ❌ **不改** `reminders` 表的「流量已用尽」历史提醒（属现象②，人类已确认现象为①）。
- ❌ **不改** `trafficManualCap`（手动上限）语义与优先级。
- ❌ **不改** `trafficThresholdNotified` 的穿越式语义（TASK-013 设计）。
- ❌ **不改** 套餐月流量来源（`plans.trafficLimit`）。
- ❌ **不删除** `customers.traffic_total` 列、**不写数据库迁移**。
- ✅ **原 Non-Scope，已按 HANDOFF-003 R-3 整改（2026-10-20）**：提醒扫描
  `reminder-scan.ts` 的用尽判定已改为统一口径（经 `loadTrafficRows` +
  `effectiveCustomerTrafficTotal`），不再是 Non-Scope。
- ❌ 不改后端 API 路径与响应结构。
- ❌ 不动 `.agents/**`、`templates/**`（框架快照只读）。

---

## Requirements

### R1（根因 A · 缓存失效）★ 核心

保存成功后，**必须**使 `dashboardKeys.stats` 失效。

**实现方式由执行位定，但须满足**：
- 失效动作发生在**用量同步成功之后**（否则 refetch 仍拿到旧数据）；
- 失效范围**精确**：只失效 `['dashboard','stats']`，**不得**用 `invalidateQueries()` 全量清空
  （会连带触发所有查询重拉）；
- 若采用「统一失效域」方案（如把 dashboard 的 key 挂到 customers 根下），
  **须说明理由**并证明不影响其它 feature 的缓存语义。

> **推荐做法（TanStack 官方 key factory 模式）**：
> 把「客户数据变更」这一事件表达为一个**跨 feature 的失效域**，
> 例如在 `customers/api.ts` 导出一个 `invalidateCustomerDependentQueries(queryClient)`，
> 内部 `Promise.all([invalidate customers, invalidate dashboard/stats, invalidate subscriptions])`。
> 客户保存、订阅保存、订阅同步三处**统一调用**它 —— 避免下次再漏。

### R2（根因 B · 生效上限来源）★ 核心 —— **已被人类裁决取代（2026-10-20 20:4x）**

> ⚠️ **本节原文（写库镜像方案）已作废。** 人类裁决后，**写库镜像方向完全相反**。
> **以 `handoffs/HANDOFF-003-coordinator-to-implementer.md` 为准**（整改指令 R-1 ~ R-5）。
> 下方原文仅留档备查，**不得按其执行**。

**人类裁决（最终口径，经两轮澄清确认）：**

```
生效上限 = 手动上限（traffic_manual_cap） ?? 套餐月流量（plans.traffic_limit）
```

| 数据 | 是否参与上限计算 |
|------|-----------------|
| 手动上限 `customers.traffic_manual_cap` | ✅ 参与，最高优先级 |
| 套餐月流量 `plans.traffic_limit` | ✅ 参与，次优先级 |
| 订阅拉取的额度 `subscriptions.traffic_total` | ❌ **不参与** |
| 表单手填的月流量 `customers.traffic_total` | ❌ **不参与** |
| 订阅拉取的**已用量** `customers.traffic_used` | ✅ 参与（百分比分子） |

**⇒ 执行位原实现的「写库镜像」必须撤销**（它恰是让订阅额度参与上限，与裁决相反）。

**新语义（须写进测试与文档）**：
- 手动上限与套餐**皆无** ⇒ 生效上限 `null` ⇒ **不限流量，不显示百分比**（非 bug）；
- 手动上限或套餐**有其一** ⇒ 正常计算百分比。

**连带影响（已实测）**：
1. `effectiveCustomerTrafficTotal` 的**第三顺位 `trafficTotal` 须删除**；
2. **三处口径须统一**：`reminder-scan.ts:44-46`（现用裸 `trafficTotal`）与
   `customers-columns.tsx:174`（现用 `effectiveTrafficTotal`）**均须改**；
3. `/customers` 响应**不含**套餐月流量 ⇒ 前端用 `usePlanOptions()`
   （`Plan[]` 含 `trafficLimit`）按 `planId` 查表补齐，**不改后端响应结构**；
4. `customers.traffic_total` **降级为纯存量列**（表单仍可保存，但不再影响显示）——
   须在 `Known Issues` 如实写出。

<details>
<summary>（已作废）原 R2 文本 — 保留备查，勿执行</summary>

`effectiveCustomerTrafficTotal` 的第三顺位（存量 `customers.traffic_total`）
必须是**当前订阅的额度**，而非建表时的历史值。

**约束**：
- **不得**覆盖 `trafficManualCap`（手动上限，优先级最高）与套餐月流量（`plans.trafficLimit`）；
- **不得**改变「手动 > 套餐 > 订阅」三层优先级本身；
- 换订阅后，**旧订阅的额度不得**继续作为生效上限。

**推荐做法**：让 `customers.traffic_total` 由**该客户当前绑定订阅**的 `subscriptions.traffic_total` 派生，
即在订阅同步成功后**同步镜像**到 customers 行（与既有的 `traffic_used` 镜像同处、同事务）。

> ⚠️ **须先确认一个前提**：存量数据中 `customers.traffic_total` 是否有**与任何订阅无关**的独立语义
> （如历史迁移遗留值）。若确认无独立语义，则镜像安全；
> 若有，则须改为「仅当 `planId` 为 null 且 `traffic_manual_cap` 为 null 时才读订阅额度」的**读取期口径修正**
> （改 `effectiveCustomerTrafficTotal` 的调用侧，而非写库）。
> **执行位须先实测存量数据再选方案，并在 handoff 中报告所选路径与依据。**

</details>

### R3（不得修坏「用尽」判定）★ 反向验收

修复后，以下场景**必须仍然正确**：
- 客户流量**确实耗尽**且**未更换订阅** ⇒ 仪表盘**仍显示 100%**
  （前提：该客户有手动上限或套餐，否则按新语义为「不限流量」）；
- 客户流量确实耗尽且**更换了订阅** ⇒ 百分比按**新订阅的已用量**重算
  （分母为手动上限 ?? 套餐，**不随订阅额度变化**）。

⇒ 验收须有**正反两组用例**，不得只测「换了会更新」。
⚠️ **不得因为改了口径就把「用尽」显示一并修掉。**

### R4（读路径口径一致性）—— **口径已由人类裁决统一（2026-10-20 20:4x）**

三处**必须用同一口径**（否则仪表盘与列表会互相矛盾）：

| 位置 | 现状 | 目标 |
|------|------|------|
| 仪表盘卡片 `server/src/services/traffic-threshold.ts` | `effectiveCustomerTrafficTotal` | ✅ 确认即可 |
| **站内提醒 `server/src/services/reminder-scan.ts:44-46`** | **裸 `trafficTotal`** ❌ | 改为同一口径（需 join `plans`） |
| **客户表格 `src/features/customers/components/customers-columns.tsx:174`** | `effectiveTrafficTotal(trafficTotal, trafficManualCap)` ❌ | 改为「手动 ?? 套餐」 |

**技术障碍与方案（已实测）**：`/customers` 响应**不含**套餐月流量
（`effectiveTrafficTotal` 注释明说「Customer API 不返回套餐月流量」）。
⇒ 前端用 `usePlanOptions()`（返回 `Plan[]`，`planSchema` **含 `trafficLimit`**，
`shared/src/schema/entities.ts:71`）按 `row.planId` 查表补齐；
**不改后端 API 响应结构**（符合 Non-Scope）。

### R5（测试）

- 新增/更新测试，**覆盖 R1 与 R2**：
  - R1：保存后仪表盘查询**被失效**（断言 `invalidateQueries` 被调用且参数含 dashboard key）；
  - R2：换订阅后生效上限**取新订阅额度**；
  - R3：用尽且未换订阅 ⇒ 仍 100%。
- ⚠️ **浏览器 vitest 的已知坑**（本项目已踩过）：
  - `console.log` **不转发** ⇒ 用 `expect(obj).toBe('DUMP')` 打印；
  - `render()` 结果**无 `queryByRole` / `getByText`** ⇒ 用 `document.querySelectorAll` 扫描；
  - **占位文案与校验提示同文时文本断言恒真** ⇒ 按 `FormMessage` 的 `data-slot="form-message"` 定位。
- 已有测试 `src/features/customers/components/customers-action-dialog.test.tsx`
  **须保持通过**；其 mock 需按 R1 的实现调整（**这是预期变更，不是破坏**）。

### R6（回归验证）

- `pnpm build:shared`（**必须先跑**，否则 `server/` 下测试因 `dist` 缺失而爆发 Invalid hook call）；
- `pnpm test`（含浏览器测试）全绿；
- `pnpm lint`、`pnpm format:check` 通过；
- `pnpm typecheck:server` 通过。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 平台 | `pnpm test` 前**必须** `pnpm build:shared`（TASK-026） |
| 口径 | **不得**改动 `effectiveCustomerTrafficTotal` 的**优先级顺序**（手动 > 套餐；2026-10-20 人类裁决，订阅/存量已不参与） |
| 口径 | **不得**让「阈值穿越」语义退化为「固定状态」 |
| 范围 | 超出 File Scope 的改动须先更新本字段并说明理由 |
| 流程 | 合并用 `rebase-merge`，**禁止直推 `main`**；只用显式路径 `git add` |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| 基线 `604017d` | blocks | ✅ `main` = `origin/main` = `604017d`，工作区干净，**无待合并 PR** |
| 存量数据语义澄清 | blocks | ✅ **已实测**（VACUUM INTO 只读快照，原始输出见 HANDOFF-002）；R2 已作废，结论见 KI-1 / KI-1b |

---

## Acceptance Criteria

- [x] **AC-1（前置基线）** `main` = `origin/main` = `604017d`；工作区干净；无待合并 PR；
      `pnpm build:shared` 成功。
- [x] **AC-2（R1 · 缓存失效）** 换订阅保存成功后，**仪表盘统计查询被失效**；
      测试断言 `invalidateQueries` 的参数含 dashboard 的 key；**且失效发生在用量同步成功之后**。
- [x] **AC-3（R1 · 不误伤）** 未使用全量 `invalidateQueries()`；其它 feature 的缓存语义未变。
- [x] **AC-4r（R2 整改 · 口径按人类裁决）** 生效上限**只由「手动上限 ?? 套餐月流量」决定**：
      `effectiveCustomerTrafficTotal` 已删第三顺位（签名 `(planTrafficLimit, trafficManualCap)`）；
      `subscription-sync.ts` 两处 `.set()` **均不含 `trafficTotal`**（镜像已撤销，`git diff` 可证）。
      ⬅️ **本条取代原 AC-4**（原 AC-4 描述的「换订阅后上限取新订阅额度」已作废——
      人类裁决：订阅拉取额度不参与上限计算）。
- [x] **AC-5（R3 · 反向验收）** 用尽且**未**换订阅 ⇒ 仍显示 **100%**
      （新口径前提：该客户有手动上限或套餐；皆无按新语义为「不限」，见 AC-9r）。
- [x] **AC-6（R4 · 口径一致）** 三处生效上限口径一致：
      仪表盘卡片与阈值扫描（`loadTrafficRows` + `effectiveCustomerTrafficTotal`）、
      站内「用尽」提醒（`reminder-scan.ts` 改经 `loadTrafficRows`，**不再裸读 `trafficTotal`**）、
      客户表格流量列（`effectiveCustomerTrafficTotal` + `planTrafficLimitById` 注入）。
- [x] **AC-5r（整改 · 反向验收）** 「用尽且未换订阅 ⇒ 仍 100%」测试仍在且通过
      （`traffic.test.ts`：套餐口径 `trafficUsagePercent(100, 100)` → 100、
      `highestTrafficThreshold(100, 100)` → 100）。
- [x] **AC-6r（整改 · 三处统一）** `reminder-scan` 不再用裸 `trafficTotal`；
      三处统一到 `effectiveCustomerTrafficTotal`（客户表格经套餐映射注入）。
- [x] **AC-9r（整改 · 新语义）** 手动与套餐皆无 ⇒ 不限流量、不显示百分比
      （`trafficUsagePercent` / `highestTrafficThreshold` 返回 `null`，有测试断言）。
- [x] **AC-11r（整改 · 文档）** `Known Issues` 已写明 `traffic_total` 降级为纯存量列
      （见 KI-5，含面向用户的说明文案）。
- [x] **AC-7（R5 · 测试）** 测试覆盖 R1/R2/R3 + 整改后新口径；`pnpm test` 全绿（**351/351**，
      基线 345 → 首轮 350 → 整改后 351）；既有 `customers-action-dialog.test.tsx` 通过（23/23）。
- [x] **AC-8（R6 · 回归）** `pnpm lint` / `pnpm format:check` / `pnpm typecheck:server` /
      `pnpm build` 全通过。
- [x] **AC-9（范围自证）** 整改改动仅限 `shared/src/schema/traffic.ts(+test)`、
      `server/src/services/{traffic-threshold,reminder-scan,subscription-sync}.ts`、
      `src/features/customers/**`、`tasks/**`；**不含** notifications / subscriptions /
      dashboard（dashboard 仅被 import key）、`docs/**`（`docs/architecture/overview.md:567`
      仍描述旧口径，超出 File Scope，已留待项，见 HANDOFF-002 整改节）。
- [ ] **AC-10（交付）** 按模板填全 PR 描述；两必需检查 SUCCESS；**不自行合并**；
      本任务档案 `Status → REVIEW` 迁 `review/`。→ **待主控位复审与人类授权后由主控位闭环**
      （执行位已完成 PR 追加提交与档案迁移，合并动作不在执行位权限内）。

---

## File Scope

```yaml
File Scope:
  - src/features/customers/components/customers-action-dialog.tsx
  - src/features/customers/components/customers-action-dialog.test.tsx
  - src/features/customers/components/customers-columns.tsx   # P-2 补登记：HANDOFF-003 R-3.1 所需
  - src/features/customers/components/customers-table.tsx     # P-2 补登记：HANDOFF-003 R-3.1 所需
  - src/features/customers/api.ts
  - src/features/dashboard/queries.ts
  - src/features/customers/data/schema.ts
  - server/src/services/subscription-sync.ts
  - server/src/services/traffic-threshold.ts
  - server/src/services/reminder-scan.ts
  - shared/src/schema/traffic.ts
  - shared/src/schema/traffic.test.ts
  - tasks/active/TASK-046-traffic-status-refresh/**
  - tasks/review/TASK-046-traffic-status-refresh/**
Non-Scope (files):
  - .github/**
  - .agents/**  templates/**
  - src/features/notifications/**
  - server/src/db/schema.ts        # 不改列、不写迁移
  - server/src/db/migrations/**
  - docker-compose.yml  Dockerfile
```

> **P-2 补登记（HANDOFF-004，2026-10-20）**：`customers-columns.tsx` 与
> `customers-table.tsx` 按 HANDOFF-003 R-3.1 被改动（客户表格「流量使用」列改
> 「手动 ?? 套餐」口径），经该指令追加进 File Scope。理由：套餐额度经前端
> `usePlanOptions()` 按 `planId` 查表注入，**不改后端 API 响应结构**
> （`/customers` 不加套餐字段，符合 Non-Scope）。

---

## Implementation Plan

### Phase 1 — 前置与存量数据澄清（AC-1、R2 前提）

1. `git fetch origin && git switch main && git pull --ff-only` → 确认 `604017d`、工作区干净。
2. `git switch -c chore/TASK-046-traffic-status-refresh`
3. **实测存量数据**（用项目既有 DB 快照/本地库，**只读**）：
   ```sql
   -- customers.traffic_total 有值、且客户已绑定订阅的比例
   select count(*) from customers where traffic_total is not null;
   select count(*) from customers c
     join subscriptions s on s.customer_id = c.id
     where c.traffic_total is not null;
   -- 两者是否相等
   select c.id, c.traffic_total, s.traffic_total
     from customers c join subscriptions s on s.customer_id = c.id
     where c.traffic_total is not null limit 20;
   ```
   ⇒ 结论决定 R2 走「写库镜像」还是「读取期口径修正」。
   **⚠️ 本步骤已被人类裁决取代**：口径已明确（手动 ?? 套餐），
   执行位**仍须复跑存量 SQL**（用于确认新口径下的存量影响并留痕），
   但**不再据此选择方案**。
4. `pnpm build:shared`。

### Phase 2 — R1（缓存失效）

5. 在 `customers/api.ts` 导出统一的失效函数（TanStack 官方 key factory 模式），
   内部 `Promise.all` 失效 `customers` / `dashboard.stats` / `subscriptions`。
6. 在 `customers-action-dialog.tsx` 的**用量同步成功分支**调用它（**不是**在保存末尾）。

### Phase 3 — R2（生效上限）+ R4（口径一致）

7. 按 Phase 1 的结论实现（二选一，见 R2 说明）。
8. 若走读取期路径：统一三处调用点（R4），并更新 `shared/src/schema/traffic.test.ts`。

### Phase 4 — 测试与交付（AC-5 ~ AC-10）

9. 补测试：R1（失效断言）、R2（新上限）、R3（用尽仍 100%）。
10. 跑 `pnpm test` / `lint` / `format:check` / `typecheck:server`。
11. 提交（footer `Refs: TASK-046`）、推送、开 PR；
    本任务档案 `Status → REVIEW` 迁 `review/`。
12. **停下**，交主控位审查与人类授权。**执行位不得合并。**

---

## Verification Plan

| 验证项 | 方式 | 命令 |
|--------|------|------|
| AC-1 | 本地 | `git rev-parse main origin/main`；`pnpm build:shared` |
| AC-2 | 测试 | 断言 `invalidateQueries` 调用参数含 dashboard key |
| AC-4r | 测试 + Git | `traffic.test.ts` 口径用例；`git diff` 证两处 `.set()` 无 `trafficTotal` |
| AC-5 / AC-5r | 测试 | 「用尽且未换订阅 ⇒ 100%」用例（新口径：有手动/套餐前提） |
| AC-6 / AC-6r | 代码审阅 | 主控位逐处核对三处调用点（`loadTrafficRows` 共用） |
| AC-9r | 测试 | 「手动与套餐皆无 ⇒ 不限、不显示百分比」用例 |
| AC-7 | 本地 | `pnpm test` |
| AC-8 | 本地 | `pnpm lint` / `pnpm format:check` / `pnpm typecheck:server` / `pnpm build` |
| AC-9 | Git | `git diff --name-only main..HEAD` |
| AC-10 | 平台 | `gh pr view <n> --json statusCheckRollup` |

---

## Current State

**REVIEW（review/）—— 首轮实施完成；按 HANDOFF-003 完成口径整改，待主控位复审与人类授权合并。**

- **根因 A 已修复并审查通过（保留）**：统一失效域 `invalidateCustomerDependentQueries`
  （customers / dashboard.stats / subscriptions 精确前缀失效），时机在用量同步成功之后。
- **根因 B 已按人类裁决重做**：原「写库镜像」方案**已撤销**（R-1）；
  生效上限口径改为 **`trafficManualCap ?? 套餐月流量`**（R-2，`effectiveCustomerTrafficTotal`
  删第三顺位）；三处口径统一（R-3：`loadTrafficRows` 导出共用，`reminder-scan` 不再裸读
  `trafficTotal`，客户表格经 `planTrafficLimitById` 注入套餐额度，不改后端响应结构）。
- **新语义（人类裁决后果）**：手动与套餐皆无 ⇒ 不限流量、不显示百分比（非 bug）；
  表单「月流量（GB）」降级为纯存量列（KI-5）。
- 全量验证通过：`pnpm test` **351/351**、`pnpm lint`、`pnpm format:check`、
  `pnpm typecheck:server`、`pnpm build` 全绿。
- **待主控位**：复审整改（重点：R-1 撤销证据、R-2 签名选择、R-3 三处统一、
  KI-5 用户说明文案）；**合并须人类显式授权**，执行位未合并。

---

## Changed Files

> 由 Developer 在执行中维护。

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `tasks/review/TASK-046-traffic-status-refresh/TASK.md` | 新增/更新 | 本档案（实施完成后迁 review/，Status → REVIEW；含人类裁决后的口径整改回填） |
| `tasks/review/TASK-046-traffic-status-refresh/handoffs/HANDOFF-001-coordinator-to-implementer.md` | 新增 | 派遣指令 |
| `tasks/review/TASK-046-traffic-status-refresh/handoffs/HANDOFF-002-implementer-to-coordinator.md` | 新增/更新 | 实施报告（存量 SQL 原始输出 + 路径甲依据）+ **追加整改说明**（撤销镜像 / 新口径落地 / 三处改动位置 / AC-5r、AC-9r 断言） |
| `tasks/review/TASK-046-traffic-status-refresh/handoffs/HANDOFF-003-coordinator-to-implementer.md` | 新增 | 主控位整改指令（人类裁决：手动 ?? 套餐；R-1 ~ R-5） |
| `src/features/customers/api.ts` | 修改 | 新增统一失效函数 `invalidateCustomerDependentQueries`（customers / dashboard.stats / subscriptions 精确前缀失效） |
| `src/features/customers/components/customers-action-dialog.tsx` | 修改 | 同步成功后改调统一失效函数（原 429 行只失效 customerKeys.root） |
| `src/features/customers/components/customers-action-dialog.test.tsx` | 修改 | mock 调整（保留真实失效函数）+ 2 个 R1 用例（仪表盘失效 / 同步失败不失效） |
| `shared/src/schema/traffic.ts` | 修改 | **整改**：`effectiveCustomerTrafficTotal` 删第三顺位，签名 `(planTrafficLimit, trafficManualCap)`，只用「手动 ?? 套餐」；`effectiveTrafficTotal` 保留（无 src 消费者，仅修正过时文档注释） |
| `shared/src/schema/traffic.test.ts` | 修改 | **整改**：口径测试按人类裁决重写——手动压套餐 / 无手动按套餐 / 皆无不限；TASK-046 describe 改「分母不随订阅额度变化 + 用尽仍 100%（AC-5r）+ 皆无不限（AC-9r）」 |
| `server/src/services/subscription-sync.ts` | 修改 | 首轮加的 `trafficTotal` 镜像**已撤销**（syncOne / syncMany 均恢复只写 `trafficUsed`，`git diff` 可证） |
| `server/src/services/traffic-threshold.ts` | 修改 | **整改**：两处调用适配新签名；`TrafficRow` 去掉 `trafficTotal`；`loadTrafficRows` 导出供 reminder-scan 共用 |
| `server/src/services/reminder-scan.ts` | 修改 | **整改**：用尽判定改经 `loadTrafficRows` + `effectiveCustomerTrafficTotal`，不再裸读 `customers.trafficTotal` |
| `src/features/customers/components/customers-columns.tsx` | 修改 | **整改**：流量列改用 `effectiveCustomerTrafficTotal(planTrafficLimit, trafficManualCap)`；新增 `planTrafficLimitById` 入参 |
| `src/features/customers/components/customers-table.tsx` | 修改 | **整改**：从 `usePlanOptions()` 构建 `planTrafficLimitById` 注入列工厂 |

---

## Known Issues

- **KI-1（原 R2 方案）→ ★ 已作废，由人类裁决取代（2026-10-20 20:4x）**：
  执行位原实测了存量数据并选定「路径甲（写库镜像）」，**主控位审查通过**；
  但人类随后明确裁决：**生效上限只由「手动上限 ?? 套餐月流量」决定，
  订阅拉取的额度与表单手填的月流量均不参与**。
  ⇒ **写库镜像恰是让订阅额度参与上限，与裁决方向相反，必须撤销**。
  **存量实测数据本身仍然有效**（实时库 `customers.traffic_total` 0/6 非空），
  但不再用于论证镜像的安全性。整改要求见 `HANDOFF-003-coordinator-to-implementer.md`。
- **KI-1b（派遣单事实修正）→ 修正成立，且已被人类裁决吸收**：
  派遣单称 `customers.traffic_total`「前端表单没有输入框、后端没有代码写它」。
  **实际不符**：客户表单「月流量（GB）」（`trafficMonthlyGb`）经 `toCustomerInput`
  （`src/features/customers/data/schema.ts:298-301`）在每次保存时写入该列
  （通用 CRUD `crud.ts` 的 `.set(values)`）。**主控位已独立复核，修正成立。**
  ⇒ 该列是**用户可编辑**的月流量字段。**人类裁决后它降级为纯存量列**
  （见 KI-5），此事实已写入整改指令。
- **KI-2（仪表盘「用尽」文案）** 仪表盘上**不存在**「流量已用尽」字样，
  该卡片显示的是百分比 + 阈值徽标（100% 阈值标红）。本任务修复的是**该卡片的百分比**。
- **KI-3（历史提醒不在范围）** `reminders` 表的「流量已用尽」提醒**永久留存**
  （`routes/reminders.ts` 只有 `is_read` 标记，**无删除端点**）。
  人类已确认本次现象为①，**故不在本任务范围**；如需处理另立任务。
- **KI-4（写库行为的测试边界）→ 已消除**：整改后**不存在任何写库镜像**
  （`trafficTotal` 镜像被撤销，`trafficUsed` 镜像与口径无关），
  口径计算**全部是纯函数**（`effectiveCustomerTrafficTotal` / `trafficUsagePercent` /
  `highestTrafficThreshold`），`shared/src/schema/traffic.test.ts` **直接覆盖**
  （不再依赖 SQLite、不再依赖冒烟脚本）。
- **KI-5（表单「月流量」降级）★ 人类裁决的直接后果**：
  按新口径，`customers.traffic_total`（表单「月流量（GB）」）**不再参与任何上限计算**
  ⇒ **用户填了它也不会影响流量百分比/阈值显示**（可保存，但无效果）。
  ⚠️ 这会让用户困惑（"填了不生效"）。
  **是否移除该表单字段属产品决策，不在本任务范围**（硬性禁令 6：不许删除该字段），
  但已在本档案如实写出，避免"填了没用"变成隐性 bug。
  ⇒ **面向用户的说明文案（建议）**：「月流量（GB）为存量字段，仅作记录；
  流量上限以手动上限或所选套餐的月流量为准；两者均未设置时不限流量。」

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | 主控位 coordinator | 执行位 implementer | 2026-10-20 | 任务登记 + 设计（两根因实测证据链 / 官方做法 / R2 两条路径 / 10 条 AC） |
| 002 | 执行位 implementer | 主控位 coordinator | 2026-10-20 | 实施报告：存量 SQL 原始输出 + 选定路径甲及依据 + 派遣单事实修正（KI-1b）+ 改动文件 + 三处口径调用点 + 全量测试结果 |
| 003 | 主控位 coordinator | 执行位 implementer | 2026-10-20 | **人类裁决推翻路径甲**：生效上限改为「手动上限 ?? 套餐月流量」，订阅额度与表单月流量均不参与；整改指令 R-1 ~ R-5（撤销镜像 / 删第三顺位 / 统一三处口径 / 新语义测试 / 文档说明） |
| 004 | 主控位 coordinator | 执行位 implementer | 2026-10-20 | **复审结论：代码 8 项 AC 全过，档案有 3 类问题**；档案修正指令 P-1 ~ P-3（正文 7+1 处失真 / File Scope 补登记两文件 / docs 披露补记第 3 处） |

**最新 Handoff：** `handoffs/HANDOFF-004-coordinator-to-implementer.md`
**Next Action：** 执行位按 HANDOFF-004 修正档案（**仅 `tasks/**`，零代码改动**；
在 PR #21 上追加提交，不新开 PR）→ 交主控位复审。
**合并须人类显式授权**，由主控位执行 rebase-merge。

> **审查状态**：首轮审查 **PASS**（10 项 AC 实测全过，`pnpm test` 27 文件 /
> 350 用例全绿；口径整改后为 351），但**人类裁决改变了口径**（见 R2 / KI-1），
> 故要求整改后再复审。**R1 缓存失效部分已通过审查，整改时保留。**
> 第二轮复审（提交 `89cb11f`）：代码侧 8 项 AC 全部通过（主控位实跑复验），
> 档案问题按 HANDOFF-004 于第三轮修正。

---

## Task Rules

- [增强] **实现者 ≠ 批准者**：执行位**不得**自行合并 PR、**不得**自行判定 PASS。
  合并须经**人类显式授权** + **主控位**执行 rebase-merge。
- [补充] **不得用全量 `invalidateQueries()`** 绕过 R1 的精确性要求。
- [补充] **不得只修一个根因** —— A 与 B 是「与」关系，只修其一用户仍看不到正确结果。
- [补充] **不得删除/弱化「用尽」判定** —— R3 是反向验收，删掉它等于把 bug 藏起来。
- [补充] **实测优先于档案自述**：根因结论均为主控位实测，**行号可能漂移**，以符号名定位。

---

## Notes

**给执行位的实操提醒：**

1. **两个根因都要修**：只失效缓存 → 用户刷新页面后仍见 100%（分母没变）；
   只改上限来源 → 用户不刷新仍见旧值。
2. **失效时机**必须在 `syncSubscriptionUsage` **成功之后**（`customers-action-dialog.tsx`
   约 426 行），否则 refetch 拿到的还是旧用量。
3. **浏览器 vitest 的三个坑**见 R5，**务必先读**再写测试，否则会浪费时间在假失败上。
4. **R2 的路径选择依赖存量数据实测**（Phase 1 第 3 步的 SQL），
   **不要凭直觉选** —— 两条路径的副作用不同。
5. 本任务**不改数据库结构**，不写迁移。
