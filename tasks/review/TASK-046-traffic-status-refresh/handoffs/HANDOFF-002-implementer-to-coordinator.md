# HANDOFF-002 — 执行位 Implementer → 主控位 Coordinator

---

## Meta

```yaml
From: 执行位 Implementer
To: 主控位 Coordinator
Task: TASK-046 — 修复换订阅后仪表盘流量状态不刷新（缓存失效 + 生效上限分母）
Date: 2026-10-20
Current State: REVIEW（实施完成，待审查；未合并）
Previous Handoff: handoffs/HANDOFF-001-coordinator-to-implementer.md
```

---

## Completed Work

两个根因均已修复（「与」关系，缺一不可）：

### 根因 A · 缓存未失效（R1）

- `src/features/customers/api.ts` 新增导出
  `invalidateCustomerDependentQueries(queryClient)`：内部 `Promise.all`
  **按前缀精确失效**三个域 —— `customerKeys.root` / `dashboardKeys.stats` /
  `subscriptionKeys.root`（TanStack 官方 key factory 模式）。
- `src/features/customers/components/customers-action-dialog.tsx`：原第 429 行
  （只失效 `customerKeys.root`）改为在 `syncSubscriptionUsage` **成功之后**
  调用统一失效函数。时机在 `usageSynced = true` 赋值行的下一行，
  位于用量回写完成、邮箱绑定同步之前——满足「失效必须在用量同步成功之后」。
- 未使用全量 `invalidateQueries()`；其它 feature 的缓存语义未变
  （dashboard/subscriptions 仅被**读 key**，未改其模块文件）。

### 根因 B · 生效上限分母不更新（R2，路径甲：写库镜像）

- `server/src/services/subscription-sync.ts`：
  - `syncOne`：同事务内客户行镜像由 `{ trafficUsed: used }` 扩为
    `{ trafficUsed: used, trafficTotal: usage.total ?? null }`；
  - `syncMany`：结果循环内同样镜像 `trafficTotal: r.total ?? null`；
  - 与既有 `traffic_used` 镜像（TASK-017）同处、同事务，失败不回写。
- 优先级顺序未变：手动上限 > 套餐月流量 > 第三顺位（现为当前订阅额度）。
  `trafficManualCap` 与 `plans.traffic_limit` 均不被本镜像触碰。

---

## 存量 SQL 原始输出（VACUUM INTO 只读快照，未动生产数据）

快照生成（只读打开源库）：

```text
$ node -e "... new Database('data/app.db', {readonly:true}); db.exec(\"VACUUM INTO 'E:/NDLDSN-WORKSPACE/.tmp-t046/snapshot.db'\") ..."
snapshot written: E:/NDLDSN-WORKSPACE/.tmp-t046/snapshot.db
```

对快照执行派遣单指定的三条 SQL（`server/data/app.db`，2026-10-17 实时库）：

```text
Q1: select count(*) from customers where traffic_total is not null;
[{"n":0}]
Q1b: select count(*) from customers;
[{"n":6}]
Q1c: ... where traffic_total is not null and traffic_total > 0;
[{"n":0}]
Q2: select count(*) from customers c join subscriptions s on s.customer_id = c.id
    where c.traffic_total is not null;
[{"n":0}]
Q2b: ... traffic_total is not null AND no subscription;
[{"n":0}]
Q3: select c.id, c.traffic_total, s.traffic_total ... limit 20;
[]
补充画像：
customers: id/plan_id/traffic_used/traffic_total/traffic_manual_cap
  75: null / 3000 / null / null      76: null / 3000 / null / null
  77: null / 0 / null / null         83: null / 3000 / null / null
  84: null / 3000 / null / null      85: null / 0 / null / null
subscriptions: id/customer_id/traffic_total/traffic_used
  71→75: 10737418240 / 3000   72→76: 10737418240 / 3000
  73→77: null / 0             77→83: 10737418240 / 3000
  78→84: 10737418240 / 3000   79→85: null / 0
```

交叉验证：项目自带备份快照 `server/data/backups/before-demo-cleanup-20261013-150422.db`
（2026-10-13，demo 清理前）：

```text
Q1: 3（共 9 个客户：87/88/89 的 traffic_total = 1073741824000）
Q2: 1（仅客户 87 有订阅，且其订阅 traffic_total 为 null）
Q3: [{"id":87,"traffic_total":1073741824000}]（c=1TB，s=null）
```

### 路径选择：甲（写库镜像）。依据

1. **实时库 0/6 非空** ⇒ 镜像不覆盖任何现存值，无数据破坏风险。
   备份快照中 3 个非空值是 demo 清理前的遗留（10-17 已清掉其中 2 个无订阅客户）；
   ǀ其中 2 个无订阅 ⇒ 镜像永不触达；1 个订阅 total 为 null 的会被置 null，
   判定为可接受（陈旧 demo 值，且与订阅行保持一致）。
2. **路径乙不可行**：客户表格流量列（`customers-columns.tsx:174`）读
   `Customer.trafficTotal`，而 `/customers` 响应**不含订阅字段**
   （通用 CRUD 只 select customers 表列）；给响应加字段违反
   「不改后端 API 响应结构」。只有路径甲能让三处读取口径天然一致（见下）。
3. 与 TASK-017 既有 `traffic_used` 镜像同构：同事务、同条件（customerId 非空）。

---

## ⚠️ 派遣单事实修正（KI-1b，请主控位复核）

派遣单称：`customers.traffic_total`「前端表单根本没有这个输入框，后端也没有任何
代码写它」。**实际不符**：

- 客户表单有「月流量（GB）」字段（`trafficMonthlyGb`，
  `src/features/customers/data/schema.ts:108-109`）；
- `toCustomerInput` 在**每次保存**时把它写进 `trafficTotal`
  （同文件 `298-301` 行）；
- 经通用 CRUD PATCH 落库（`server/src/lib/crud.ts` 的
  `db.update(table).set(values)`，入参 schema 含 `trafficTotal`，
  `shared/src/schema/entities.ts:109`）。

⇒ 该列是**用户可编辑的月流量字段**，不是无人写入的存量列。
主控位的 grep（`set({...trafficTotal` 于 server/src）漏掉了通用 CRUD 路径。

**对方案的影响与取舍**：镜像会在订阅同步时用订阅额度覆盖该字段值。
执行位判定这符合 R2 意图（「旧订阅的额度不得继续作为生效上限」；
新订阅额度才是当前有效额度），且：

- 手动上限（`trafficManualCap`）优先级更高，不被触碰；
- 套餐月流量（`plans.traffic_limit`）不被触碰，套餐客户的生效上限仍取套餐；
- 表单对套餐客户仍显示套餐值（打开即覆盖，TASK-023 既有行为）；
- 无订阅客户的月流量字段不受影响（无同步即无镜像）。

若主控位认为「用户手填月流量应压过订阅额度」，需改优先级语义——
**那超出本任务范围**（禁令：不得改优先级顺序），建议另立任务。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/features/customers/api.ts` | 修改 | 新增 `invalidateCustomerDependentQueries`（三域精确前缀失效） |
| `src/features/customers/components/customers-action-dialog.tsx` | 修改 | 429 行改调统一失效函数，位置在用量同步成功之后 |
| `src/features/customers/components/customers-action-dialog.test.tsx` | 修改 | mock 改 `importOriginal`（保留真实失效函数）+ `renderDialog` 暴露 queryClient + 2 个 R1 用例 |
| `shared/src/schema/traffic.test.ts` | 修改 | 3 个用例：换订阅取新额度 / 用尽仍 100% / 镜像不压过更高优先级 |
| `server/src/services/subscription-sync.ts` | 修改 | syncOne + syncMany 同事务镜像 `trafficTotal` |
| `tasks/review/TASK-046-traffic-status-refresh/**` | 迁移+更新 | 档案迁 review/，Status → REVIEW，本交接件 |

---

## 三处口径调用点（R4 / AC-6）

路径甲下三处（实际四个调用点）全部读 `customers.traffic_total`，
镜像后**结构性一致**，无需改读取侧：

| # | 调用点 | 位置 | 消费方 |
|---|--------|------|--------|
| 1 | `loadTrafficRows()` → `customers.trafficTotal` | `server/src/services/traffic-threshold.ts:71` | `listTrafficThresholdStatuses`（:188，仪表盘卡片） |
| 2 | 同上 `loadTrafficRows()` | `server/src/services/traffic-threshold.ts:71` | `scanTrafficThresholds`（:91，reminder-scan 的阈值判定，`reminder-scan.ts:86` 调用） |
| 3 | `customers.trafficTotal` 直读 | `server/src/services/reminder-scan.ts:44/46` | 用尽判定（`trafficUsed >= trafficTotal`） |
| 4 | `row.original.trafficTotal` | `src/features/customers/components/customers-columns.tsx:172-175` | 客户表格「流量使用」列 |

写入侧唯一入口：`subscription-sync.ts` 的 syncOne / syncMany 镜像。

---

## Tests

```text
$ pnpm build:shared
> @repo/shared@0.1.0 build
> tsc -p tsconfig.json
（成功）

$ pnpm test
 Test Files  27 passed (27)
      Tests  350 passed (350)
   Duration  7.81s

$ pnpm lint
> eslint .
（无输出，通过）

$ pnpm format:check
Checking formatting...
All matched files use Prettier code style!
（注：首轮 customers-action-dialog.test.tsx 报格式，已 prettier --write 修复后复检通过）

$ pnpm typecheck:server
> tsc -p tsconfig.json --noEmit
（无输出，通过）

$ pnpm build
✓ built in 33.96s
```

基线对比：改动前 345 passed（27 文件）；改动后 350 passed（+5：
dialog 2 个 R1 用例 + traffic.test.ts 3 个 R2/R3 用例）。

### 关键断言（AC-5 反向验收）

`shared/src/schema/traffic.test.ts` 新增
`describe('TASK-046：第三顺位镜像为当前订阅额度后的评估口径')`：

- **换订阅后**：`effectiveCustomerTrafficTotal(1000, null, null)` → 1000；
  `trafficUsagePercent(100, 1000)` → **10**（不再 100%）；
- **用尽且未换订阅（反向验收）**：
  `trafficUsagePercent(100, effectiveCustomerTrafficTotal(100, null, null))` → **100**；
  `highestTrafficThreshold(100, 100)` → **100**；
- 镜像不压过更高优先级：`(1000, 500, 200)` → 200（手动）、`(1000, 500, null)` → 500（套餐）。

`customers-action-dialog.test.tsx` 新增：

- 「保存并同步成功后：仪表盘统计查询被失效（统一失效域，非全量）」——
  spy 断言 `invalidateQueries` 调用参数含 `['dashboard','stats']` /
  `['customers']` / `['subscriptions']`，且每次调用都带精确 queryKey
  （证非全量）；
- 「用量同步失败时：不做统一失效」——同步失败路径 spy 零调用
  （证失效时机在同步成功之后）。

### 未执行的测试及原因

- **冒烟脚本（`pnpm --filter server smoke`）未跑**：镜像的写库行为依赖
  SQLite，而 `pnpm test` 全量跑在 Chromium（浏览器 vitest 无法加载
  better-sqlite3）。R2/R3 以评估口径契约测试锁定；端到端写库验证留待
  主控位/人类决定是否补跑隔离环境冒烟（VACUUM INTO 快照 + PORT=3002）。
  ⚠️ **本条已被第二轮整改取代**：`trafficTotal` 镜像撤销后不存在写库口径行为，
  口径计算全部纯函数化，冒烟留待项不再适用（见文末整改记录）。
- 真实生产库不可达，存量分析基于本机 `server/data/app.db` 及其自带备份快照。

---

## Known Issues

- **KI-1b（派遣单事实修正）**：见上节——`customers.traffic_total` 实为表单
  「月流量（GB）」字段，每次保存都会写。镜像会覆盖它；执行位判定符合 R2 意图，
  **请主控位显式复核这一取舍**。
- **KI-4（测试边界）**：镜像写库无浏览器单测覆盖（依赖 SQLite），
  见上「未执行的测试及原因」。
- **KI-3 延续**：`reminders` 历史「流量已用尽」提醒不在本任务范围（人类已确认）。

---

## Remaining Work

- 主控位审查本交接件与 PR（重点：路径甲依据、KI-1b 取舍、失效时机）。
- **合并须人类显式授权**，由主控位 rebase-merge；执行位未执行任何合并动作。
- 若人类/主控位要求补冒烟或调整镜像条件（如仅非空总量才镜像），
  在审查意见中提出，执行位按新指令修改。

---

## Assumptions

1. 实时库 `server/data/app.db` 即当前运行数据（生产库不可达，以此为准）；
   备份快照仅作交叉验证。
2. 「月流量」字段被订阅额度覆盖符合产品意图（R2：换订阅后生效上限取新订阅额度）。
3. 派遣单「三处统一调用」解读为：统一失效函数覆盖三域，对话框在三事件
   （客户保存/订阅保存/订阅同步）编排流的**用量同步成功之后**单点调用——
   避免在客户保存时过早失效 dashboard（会拉到旧用量）。subscriptions feature
   未接线（`customers/api` 已 import `subscriptions/api`，反向 import 会成环）。

---

## Risks

| 风险 | 影响 | 缓解 |
|------|------|------|
| 镜像覆盖用户手填月流量 | 无套餐客户的手填值被订阅额度替换 | KI-1b 已显式上报；手动上限/套餐仍优先；如不认可可改镜像条件 |
| 订阅不上报 total（null） | 该客户第三顺位被置 null（显示不限） | 与订阅行保持一致；旧值不停留（符合 R2「旧额度不得继续生效」） |
| 多订阅客户 | 镜像后者胜出（used 镜像既有语义） | 与 TASK-017 既有行为一致，未新增风险 |

---

## Next Action

主控位审查 → 人类授权 → 主控位 rebase-merge。执行位**已停下**。

---

---

# 第二轮：口径整改记录（2026-10-20，响应 HANDOFF-003 R-1 ~ R-5）

**背景**：主控位审查后，**人类裁决推翻了首轮的「路径甲（写库镜像）」**：

> 「订阅拉取更新出来的流量不参与，只有两个值参与，手动设置的上限为
> 最高优先级，其次是套餐设定的月流量。」

⇒ 生效上限 = `traffic_manual_cap ?? plans.traffic_limit`。
订阅拉取额度与表单存量月流量**均不参与**；`traffic_used`（分子）照旧参与。
首轮镜像恰是让订阅额度参与上限，与裁决相反，**已按要求撤销，不为原方案辩护**。

## R-1 撤销镜像（AC-2r / AC-4r）

`server/src/services/subscription-sync.ts` 两处均已恢复：

- `syncOne`：`.set({ trafficUsed: used, trafficTotal: usage.total ?? null })`
  → `.set({ trafficUsed: used })`（注释同步改回 TASK-017 原文）；
- `syncMany`：`.set({ trafficUsed: …, trafficTotal: r.total ?? null })`
  → `.set({ trafficUsed: (r.upload ?? 0) + (r.download ?? 0) })`。

`git diff` 可证两处均不含 `trafficTotal`（订阅行自身的
`trafficTotal: usage.total ?? null` 是 subscriptions 表自己的列，与客户口径无关，保留）。

## R-2 口径函数（AC-4r）

`shared/src/schema/traffic.ts` 的 `effectiveCustomerTrafficTotal`：

```ts
export function effectiveCustomerTrafficTotal(
  planTrafficLimit: number | null | undefined,
  trafficManualCap: number | null | undefined
): number | null {
  return trafficManualCap ?? planTrafficLimit ?? null
}
```

**签名方案选择：删除 `trafficTotal` 参数**（而非保留弃用）。评估：删除后波及面仅
`traffic-threshold.ts` 两处调用 + `traffic.test.ts` 用例，且顺带清掉
`TrafficRow.trafficTotal` 与 select 列——比留一个无人传的弃用参数更干净，
也不会给未来调用方「存量仍参与」的误导。优先级顺序未动（手动 > 套餐）。

`effectiveTrafficTotal`（2 参，`manual ?? 传入月流量`）**保留未删**：本任务外既有
导出、有测试覆盖，删它属扩大改动面；仅修正其已过时的文档注释（不再声称被客户表格使用）。
整改后它**无任何 src 消费者**（仅 tests 引用）——已记录，留给后续清理决策。

## R-3 三处口径统一（AC-6r）

| # | 位置 | 整改内容 |
|---|------|---------|
| 1 | `server/src/services/traffic-threshold.ts` | 两处调用适配新签名；`TrafficRow` 去掉 `trafficTotal`；**`loadTrafficRows` 改为导出**（供 reminder-scan 共用，join plans 取套餐额度） |
| 2 | `server/src/services/reminder-scan.ts:46` | 用尽判定由「裸读 `customers.trafficTotal`」改为 `loadTrafficRows().flatMap(...)` + `effectiveCustomerTrafficTotal(planTrafficLimit, trafficManualCap)`；`total == null \|\| <= 0 \|\| used < total` 过滤（与扫描同一评估条件）；publish data 改用算得的 `used/total` |
| 3 | `src/features/customers/components/customers-columns.tsx:181` | 流量列改用 `effectiveCustomerTrafficTotal(planTrafficLimit, trafficManualCap)`；新增入参 `planTrafficLimitById: Map<number, number \| null>` |
| 3b | `src/features/customers/components/customers-table.tsx:96` | 沿用既有 `poolNameById`/`planNameById` 同款装配：从 `usePlanOptions()` 构建 `planTrafficLimitById`（`item.trafficLimit ?? null`）注入列工厂 |

**未改后端 API 响应结构**（`/customers` 未加套餐字段，符合 Non-Scope 与禁令 4）；
套餐额度走前端已有的 `usePlanOptions()` 缓存（`Plan[]` 含 `trafficLimit`）。

**降级行为定案（HANDOFF-003 要求由执行位定并说明）**：套餐数据未加载
（`plans.data` 为空 → 映射无条目）时，该客户的 `planTrafficLimit` 按 `null` 处理
⇒ 生效上限 = 手动 ?? null。**无手动上限时该列短暂显示「不限 / 无上限」**，
套餐查询就绪后自动恢复正确值。选取此行为的原因：与「未设套餐」的真实语义一致
（都是无套餐额度），不引入新的加载态 UI；套餐选项查询为 5 分钟 staleTime 的共享缓存，
实际窗口极小。

## R-4 测试（AC-5r / AC-9r）

`shared/src/schema/traffic.test.ts` 按新口径重写（首轮 3 个镜像口径用例作废）：

- `effectiveCustomerTrafficTotal` describe 改 2 参：手动压套餐（`(200, 50)` → 50）、
  无手动按套餐（`(200, null)` → 200）、皆无不限（`(null, null)` → null）；
- **TASK-046 describe（3 个）**：
  - 「有手动上限：换订阅后分母不随订阅额度变化，仅按已用量重算」——
    `(1000, 100)` → 100；`trafficUsagePercent(100, 100)` → **100**、
    `trafficUsagePercent(10, 100)` → **10**（新订阅额度 1000 不参与分母）；
  - **反向验收（AC-5r）「用尽且未换订阅 ⇒ 仍显示 100%」**（套餐口径）——
    `trafficUsagePercent(100, effectiveCustomerTrafficTotal(100, null))` → **100**、
    `highestTrafficThreshold(100, 100)` → **100**；
  - **新语义（AC-9r）「手动与套餐皆无 ⇒ 不限流量，不显示百分比」**——
    `trafficUsagePercent(100, null)` → null、`highestTrafficThreshold(100, null)` → null。

R1 的两个 dialog 用例（仪表盘失效 / 同步失败不失效）不受口径整改影响，保持通过。

## R-5 文档（AC-11r）

- `TASK.md`：`Known Issues` 增补 KI-5（`traffic_total` 降级为纯存量列 +
  面向用户说明文案：「月流量（GB）为存量字段，仅作记录；流量上限以手动上限或
  所选套餐的月流量为准；两者均未设置时不限流量。」）；KI-4 改写为
  「口径纯函数化、测试直接覆盖」；AC 段补齐 AC-4r/5r/6r/9r/11r 并勾选。
- 表单「月流量（GB）」字段**未移除**（禁令 6：仅记录降级事实，移除属产品决策）。

## 整改验证（全绿）

```text
$ pnpm build:shared          （成功）
$ pnpm test
 Test Files  27 passed (27)
      Tests  351 passed (351)      ← 首轮 350 → 351（口径用例重写后净 +1）
$ pnpm lint                  （无输出，通过）
$ pnpm format:check          （customers-columns.tsx 首轮报格式，prettier --write 后通过）
$ pnpm typecheck:server      （无输出，通过）
$ pnpm build                 ✓ built（修复一处 Map 值类型 item.trafficLimit ?? null 后通过）
```

## 留待项（超出本任务 File Scope，未动）

- `docs/architecture/overview.md:567`（及 175/186 行）仍描述旧口径
  「`trafficManualCap ?? 套餐月流量 ?? trafficTotal`」——`docs/**` 不在本任务
  File Scope，**未改**；建议主控位/人类决定是否随合并后续航修订。
- `effectiveTrafficTotal` 无 src 消费者（见 R-2 节），是否清理留待后续决策。

---

## References

- 任务档案：`tasks/review/TASK-046-traffic-status-refresh/TASK.md`
- 派遣单：`handoffs/HANDOFF-001-coordinator-to-implementer.md`
- 只读快照：`E:/NDLDSN-WORKSPACE/.tmp-t046/snapshot.db`（分析产物，可删）
