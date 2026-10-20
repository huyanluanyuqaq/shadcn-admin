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
       │        生效上限 = effectiveCustomerTrafficTotal(trafficTotal, planTrafficLimit, trafficManualCap)
       │                   = 手动上限 ?? 套餐月流量 ?? 存量上限
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

1. `subscriptions.traffic_total` **有**写入方：`subscription-sync.ts:142 / 178 / 280`。
2. **`customers.traffic_total` 全仓无任何写入方** ——
   `grep -rn "set\(\{[^}]*trafficTotal" server/src/` **零命中**；
   仅 `db/schema.ts:82` 定义 + `reminder-scan.ts:44/46`、`traffic-threshold.ts` 读取。
   ⇒ 该列是**只读的历史存量列**（建表时留下、此后无代码写它）。
3. 客户表单**无 `trafficTotal` 字段**（只有 `trafficManualCapGb`），
   后端 `customerInputSchema` 虽允许 `trafficTotal`（`shared/src/schema/entities.ts:109`），
   但**前端从不发送** ⇒ 永远保持建表时的值。
4. 表单里的「订阅流量上限」真名是 **`subscriptionTrafficTotalGb`**，
   经 `buildSubscriptionInput`（`src/features/customers/data/schema.ts:404-407`）
   写进 **subscriptions 表**。
5. ⇒ **触发条件**：当客户**既无手动上限、也无套餐**（`planId` 为 null）时，
   生效上限落到「永不变化的存量 `customers.traffic_total`」。
   换订阅后 `traffic_used` 虽已更新为新订阅用量，**分母仍是旧订阅的额度**
   ⇒ 百分比仍可能 100%。

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
- **根因 B 修复**：让生效上限在换订阅后能反映**新订阅的额度**。
- 对应测试（浏览器 vitest）。
- 本任务自身的 `TASK.md` / `handoffs/` 记录。

## Non-Scope

- ❌ **不改** `reminders` 表的「流量已用尽」历史提醒（属现象②，人类已确认现象为①）。
- ❌ **不改** `trafficManualCap`（手动上限）语义与优先级。
- ❌ **不改** `trafficThresholdNotified` 的穿越式语义（TASK-013 设计）。
- ❌ **不改** 套餐月流量来源（`plans.trafficLimit`）。
- ❌ **不删除** `customers.traffic_total` 列、**不写数据库迁移**。
- ❌ **不改** 提醒扫描 `reminder-scan.ts` 的用尽判定。
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

### R2（根因 B · 生效上限来源）★ 核心

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

### R3（不得修坏「用尽」判定）★ 反向验收

修复后，以下场景**必须仍然正确**：
- 客户流量**确实耗尽**且**未更换订阅** ⇒ 仪表盘**仍显示 100%**；
- 客户流量确实耗尽且**更换了订阅**（新订阅额度更大）⇒ 显示新订阅对应的百分比。

⇒ 验收须有**正反两组用例**，不得只测「换了会更新」。

### R4（读路径口径一致性）

若采用 R2 的「读取期口径修正」路径，
`listTrafficThresholdStatuses`、`reminder-scan` 的用尽判定、
客户表格的流量列**三处必须用同一口径**（否则仪表盘与列表会互相矛盾）。
⇒ 须检查并列出这三处的调用点，统一到 `effectiveCustomerTrafficTotal` 或其等价实现。

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
| 口径 | **不得**改动 `effectiveCustomerTrafficTotal` 的**优先级顺序**（手动 > 套餐 > 订阅/存量） |
| 口径 | **不得**让「阈值穿越」语义退化为「固定状态」 |
| 范围 | 超出 File Scope 的改动须先更新本字段并说明理由 |
| 流程 | 合并用 `rebase-merge`，**禁止直推 `main`**；只用显式路径 `git add` |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| 基线 `604017d` | blocks | ✅ `main` = `origin/main` = `604017d`，工作区干净，**无待合并 PR** |
| 存量数据语义澄清 | blocks | ⚠️ **执行位须先实测** `customers.traffic_total` 存量值与订阅的关系（R2） |

---

## Acceptance Criteria

- [x] **AC-1（前置基线）** `main` = `origin/main` = `604017d`；工作区干净；无待合并 PR；
      `pnpm build:shared` 成功。
- [x] **AC-2（R1 · 缓存失效）** 换订阅保存成功后，**仪表盘统计查询被失效**；
      测试断言 `invalidateQueries` 的参数含 dashboard 的 key；**且失效发生在用量同步成功之后**。
- [x] **AC-3（R1 · 不误伤）** 未使用全量 `invalidateQueries()`；其它 feature 的缓存语义未变。
- [x] **AC-4（R2 · 上限随订阅更新）** 换订阅后生效上限取**新订阅额度**；
      handoff 中报告存量数据实测结论与所选实现路径（选定路径甲，依据见 HANDOFF-002）。
- [x] **AC-5（R3 · 反向验收）** 用尽且**未**换订阅 ⇒ 仪表盘**仍 100%**（有测试断言）。
- [x] **AC-6（R4 · 口径一致）** `listTrafficThresholdStatuses`、`reminder-scan`、客户表格流量列
      三处的生效上限口径一致（调用点清单见 HANDOFF-002）。
- [x] **AC-7（R5 · 测试）** 新增测试覆盖 R1/R2/R3；`pnpm test` 全绿（350/350）；
      既有 `customers-action-dialog.test.tsx` 通过（23/23）。
- [x] **AC-8（R6 · 回归）** `pnpm lint` / `pnpm format:check` / `pnpm typecheck:server` 全通过
      （另跑 `pnpm build` 通过）。
- [x] **AC-9（范围自证）** 改动仅限 `src/features/customers/**`、`shared/src/**`、
      `server/src/services/**`、`tasks/**`；**不含** `src/features/notifications/**`、
      `src/features/subscriptions/**`、`src/features/dashboard/**`（dashboard 仅被 import key，未改其文件）。
- [ ] **AC-10（交付）** 按模板填全 PR 描述；两必需检查 SUCCESS；**不自行合并**；
      本任务档案 `Status → REVIEW` 迁 `review/`。→ **待主控位审查与人类授权后由主控位闭环**
      （执行位已完成 PR 提交与档案迁移，合并动作不在执行位权限内）。

---

## File Scope

```yaml
File Scope:
  - src/features/customers/components/customers-action-dialog.tsx
  - src/features/customers/components/customers-action-dialog.test.tsx
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
| AC-4 | 实测 + 测试 | 存量 SQL 输出 + 新上限断言 |
| AC-5 | 测试 | 「用尽且未换订阅 ⇒ 100%」用例 |
| AC-6 | 代码审阅 | 主控位逐处核对三处调用点 |
| AC-7 | 本地 | `pnpm test` |
| AC-8 | 本地 | `pnpm lint` / `pnpm format:check` / `pnpm typecheck:server` |
| AC-9 | Git | `git diff --name-only main..HEAD` |
| AC-10 | 平台 | `gh pr view <n> --json statusCheckRollup` |

---

## Current State

**REVIEW（review/）—— 执行位实施完成，待主控位审查与人类授权合并。**

- 两个根因均已修复：**根因 A**（统一失效域 + 用量同步成功后调用）、
  **根因 B**（订阅同步同事务镜像总量到 `customers.traffic_total`，路径甲）。
- 存量数据已实测（VACUUM INTO 只读快照），原始输出与路径选择依据见
  `handoffs/HANDOFF-002-implementer-to-coordinator.md`。
- 全量验证通过：`pnpm test` 350/350、`pnpm lint`、`pnpm format:check`、
  `pnpm typecheck:server`、`pnpm build` 全绿。
- **待主控位**：审查 AC-1 ~ AC-10；**合并须人类显式授权**，执行位未合并。

---

## Changed Files

> 由 Developer 在执行中维护。

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `tasks/review/TASK-046-traffic-status-refresh/TASK.md` | 新增/更新 | 本档案（实施完成后迁 review/，Status → REVIEW） |
| `tasks/review/TASK-046-traffic-status-refresh/handoffs/HANDOFF-001-coordinator-to-implementer.md` | 新增 | 派遣指令 |
| `tasks/review/TASK-046-traffic-status-refresh/handoffs/HANDOFF-002-implementer-to-coordinator.md` | 新增 | 实施报告（存量 SQL 原始输出 + 路径甲依据 + 三处口径 + 测试结果） |
| `src/features/customers/api.ts` | 修改 | 新增统一失效函数 `invalidateCustomerDependentQueries`（customers / dashboard.stats / subscriptions 精确前缀失效） |
| `src/features/customers/components/customers-action-dialog.tsx` | 修改 | 同步成功后改调统一失效函数（原 429 行只失效 customerKeys.root） |
| `src/features/customers/components/customers-action-dialog.test.tsx` | 修改 | mock 调整（保留真实失效函数）+ 2 个 R1 用例（仪表盘失效 / 同步失败不失效） |
| `shared/src/schema/traffic.test.ts` | 修改 | 新增 3 个用例：换订阅后取新额度、用尽仍 100%（反向验收）、镜像不压过更高优先级 |
| `server/src/services/subscription-sync.ts` | 修改 | syncOne / syncMany 同事务镜像 `trafficTotal` 到客户行（路径甲） |

---

## Known Issues

- **KI-1（R2 方案）→ 已实测解决**：执行位于 Phase 1 用 `VACUUM INTO` 只读快照
  实测存量数据，**选定路径甲（写库镜像）**。依据：① 实时库
  `server/data/app.db` 中 `customers.traffic_total` **全部为 NULL**（0/6），
  镜像不破坏任何现存值；② 路径乙不可行——客户表格流量列读
  `Customer.trafficTotal`（`/customers` 响应不含订阅字段，加字段违反
  「不改后端 API 响应结构」），只有镜像能让三处口径天然一致。
  原始输出与完整依据见 HANDOFF-002。
- **KI-1b（派遣单事实修正）**：派遣单称 `customers.traffic_total`
  「前端表单没有输入框、后端没有代码写它」。**实际不符**：客户表单
  「月流量（GB）」（`trafficMonthlyGb`）经 `toCustomerInput`
  （`src/features/customers/data/schema.ts:298-301`）在每次保存时写入该列
  （通用 CRUD `crud.ts` 的 `.set(values)`）。即该列是**用户可编辑的
  月流量字段**，非无人写入的存量列。影响：镜像会在同步时用订阅额度覆盖
  该字段——判定为符合 R2 意图（「旧订阅的额度不得继续作为生效上限」），
  且手动上限 / 套餐月流量优先级更高、不被触碰。已上报主控位复核。
- **KI-2（仪表盘「用尽」文案）** 仪表盘上**不存在**「流量已用尽」字样，
  该卡片显示的是百分比 + 阈值徽标（100% 阈值标红）。本任务修复的是**该卡片的百分比**。
- **KI-3（历史提醒不在范围）** `reminders` 表的「流量已用尽」提醒**永久留存**
  （`routes/reminders.ts` 只有 `is_read` 标记，**无删除端点**）。
  人类已确认本次现象为①，**故不在本任务范围**；如需处理另立任务。
- **KI-4（镜像写库的测试边界）** 镜像的写库行为依赖 SQLite，
  浏览器 vitest（`pnpm test` 全量跑在 Chromium）无法覆盖；
  R2/R3 由 `shared/src/schema/traffic.test.ts` 锁定**评估口径契约**，
  端到端写库行为依赖冒烟脚本（本次未跑，理由见 HANDOFF-002）。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | 主控位 coordinator | 执行位 implementer | 2026-10-20 | 任务登记 + 设计（两根因实测证据链 / 官方做法 / R2 两条路径 / 10 条 AC） |
| 002 | 执行位 implementer | 主控位 coordinator | 2026-10-20 | 实施报告：存量 SQL 原始输出 + 选定路径甲及依据 + 派遣单事实修正（KI-1b）+ 改动文件 + 三处口径调用点 + 全量测试结果 |

**最新 Handoff：** `handoffs/HANDOFF-002-implementer-to-coordinator.md`
**Next Action：** 主控位审查 HANDOFF-002 与 PR（重点：路径甲选择依据、KI-1b 事实修正、
镜像覆盖「月流量」字段的取舍）；**合并须人类显式授权**，由主控位执行 rebase-merge。

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
