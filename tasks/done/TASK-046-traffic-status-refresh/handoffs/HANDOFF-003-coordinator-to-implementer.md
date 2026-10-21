# HANDOFF-003 — 主控位 Coordinator → 执行位 Implementer（口径整改）

---

## Meta

```yaml
From: 主控位 Coordinator
To: 执行位 Implementer
Task: TASK-046 — 修复换订阅后仪表盘流量状态不刷新
Date: 2026-10-20
Current State: ACTIVE（PR #21 已开，审查后要求整改）
Previous Handoff: HANDOFF-001-coordinator-to-implementer（你的实现），HANDOFF-002-implementer-to-coordinator（你的交付）
```

> **本文件是对你已交付实现（提交 `8af348e` / PR #21）的整改指令。**
> **人类已裁决生效上限的口径，你的「路径甲（写库镜像）」被推翻，必须撤销并按新口径重做。**

---

## 背景：人类裁决推翻了 R2 方案

人类在审查后明确裁决：

> **「订阅拉取更新出来的流量不参与，只有两个值参与，
> 手动设置的上限为最高优先级，其次是套餐设定的月流量。」**

经两轮澄清，最终口径是：

```
生效上限 = 手动上限（traffic_manual_cap） ?? 套餐月流量（plans.traffic_limit）
```

| 数据 | 是否参与上限计算 |
|------|-----------------|
| 手动上限 `customers.traffic_manual_cap` | ✅ **参与，最高优先级** |
| 套餐月流量 `plans.traffic_limit` | ✅ **参与，次优先级** |
| 订阅拉取的额度 `subscriptions.traffic_total` | ❌ **不参与** |
| 表单手填的月流量 `customers.traffic_total` | ❌ **不参与** |
| 订阅拉取的**已用量** `customers.traffic_used` | ✅ **参与**（它是百分比分子，去掉则客户表格流量列失去数据源） |

### ⇒ 你的「路径甲」必须撤销

你实现了 `tx.update(customers).set({ trafficUsed: used, trafficTotal: usage.total ?? null })`
—— 这**恰好是让订阅额度参与上限计算**，与人类期望**直接相反**。

**这不是你的疏漏**——是主控位在档案里给的 R2 描述（「旧订阅的额度不得继续作为生效上限」）
本身有歧义，人类裁决后方向变了。**请按新口径重做，不要为原方案辩护。**

---

## 整改清单（R-1 ~ R-5）

### R-1 撤销 trafficTotal 镜像 ★

`server/src/services/subscription-sync.ts` 的**两处**（`syncOne` 与 `syncMany`）
都要把 `trafficTotal` 从 `.set({...})` 里去掉，恢复为只写 `trafficUsed`。

```ts
// 现状（要改掉）
.set({ trafficUsed: used, trafficTotal: usage.total ?? null })
// 改为
.set({ trafficUsed: used })
```

⚠️ **两处都要改**（`syncOne` 与 `syncMany`），别只改一处。

### R-2 口径函数删掉第三顺位 ★

`shared/src/schema/traffic.ts` 的 `effectiveCustomerTrafficTotal`：

```ts
// 现状
export function effectiveCustomerTrafficTotal(
  trafficTotal: number | null | undefined,
  planTrafficLimit: number | null | undefined,
  trafficManualCap: number | null | undefined
): number | null {
  return trafficManualCap ?? planTrafficLimit ?? trafficTotal ?? null
}
```

改为**只保留两个值**。**签名怎么改由你定**（可保留 `trafficTotal` 参数但不再使用，
也可删除该参数——但删除会波及所有调用点与测试，**请评估后选改动面更小的方案并说明**）。

⚠️ **`trafficManualCap` 与 `planTrafficLimit` 的优先级顺序不得改动**
（手动最高、套餐次之）—— 这条禁令继续有效。

### R-3 三处口径统一 ★

| 位置 | 现状 | 目标 |
|------|------|------|
| 仪表盘卡片 `server/src/services/traffic-threshold.ts` | `effectiveCustomerTrafficTotal` | ✅ 已符合，**确认即可** |
| **站内提醒 `server/src/services/reminder-scan.ts:44-46`** | **裸 `trafficTotal`** ❌ | 改为同一口径函数（需 join `plans` 取套餐额度） |
| **客户表格 `src/features/customers/components/customers-columns.tsx:174`** | `effectiveTrafficTotal(trafficTotal, trafficManualCap)` ❌ | 改为「手动 ?? 套餐」 |

#### R-3.1 客户表格的技术障碍（已实测，方案已定）

**`/customers` 响应不含套餐月流量** —— `effectiveTrafficTotal` 的注释明说
「Customer API 不返回套餐月流量，行内展示仍以存量 `traffic_total` 为基准」。

**但不必改后端 API 响应结构**（那会违反 Non-Scope）。**前端已有数据可用**：

- `usePlanOptions()`（在 `src/features/customers/api.ts`）返回 `Plan[]`
- `planSchema` **含 `trafficLimit`**（`shared/src/schema/entities.ts:71`）
- 客户行有 `planId` ⇒ 按 `planId` 查表即可

⇒ 在 `customers-columns.tsx` 中用 `usePlanOptions()` 建立
`planId → trafficLimit` 映射，再算「手动 ?? 套餐」。

⚠️ 套餐数据未加载（缓存未就绪）时的降级行为**由你定并说明**
（例如：套餐未加载时该列显示「不限」还是「—」）。

### R-4 反向验收仍须成立（口径变了，结论也要对）★

新口径下的**新语义**（必须写进测试）：

| 客户情况 | 生效上限 | 期望显示 |
|---------|---------|---------|
| 有手动上限 | 手动上限 | 正常百分比 |
| 无手动、有套餐 | 套餐月流量 | 正常百分比 |
| **手动与套餐皆无** | `null` = **不限流量** | **不显示百分比**（`trafficUsagePercent` 返回 `null`） |
| **流量确实耗尽且未换订阅** | —— | **仍显示 100%**（前提：有手动上限或套餐） |

⚠️ 最后一行是**核心反向验收**：不得因为改了口径就把「用尽」显示一起修掉。
⚠️ 第三行是**新语义**（「都不设 = 不限」），**不是 bug**，须在档案与测试中明确写出来。

### R-5 文档与档案如实说明

- `customers.traffic_total`（表单「月流量（GB）」）**降级为纯存量列**：
  仍可保存，但**不再参与任何上限计算**。
  ⇒ 须在 `TASK.md` 的 `Known Issues` **明确写出**，
  否则用户「填了不生效」会困惑。（**是否要移除该表单字段**属产品决策，
  **不在本任务范围**，仅需如实记录。）

---

## 不变的部分（你做对了，不用改）

- ✅ **R1 缓存失效修复**：`invalidateCustomerDependentQueries` 统一失效三域，
  时机在用量同步成功之后，**非全量失效** —— **主控位审查通过，保留**。
- ✅ **测试手法**：`importOriginal` 保留真实失效函数 + spy 断言具体 key —— **保留**。
- ✅ **存量数据实测**（VACUUM INTO 只读快照 + 备份交叉验证）—— 方法正确，**保留**。
- ✅ 你对 KI-1b 的事实修正（`traffic_total` 可由表单写入）—— **主控位已复核，修正成立**。

---

## 硬性禁令

1. ❌ **不许保留 `trafficTotal` 的写库镜像**（R-1）
2. ❌ **不许改优先级顺序**（手动 > 套餐，永远）
3. ❌ **不许把「用尽」显示一并修掉**（R-4 核心）
4. ❌ **不许改后端 API 响应结构**（`/customers` 不加套餐字段——用前端 `usePlanOptions`）
5. ❌ **不许改 `trafficUsed` 的写入**（用量照旧参与，是分子）
6. ❌ **不许删除表单「月流量（GB）」字段**（仅记录降级事实）
7. ❌ 不许改 `.github/**`、`.agents/**`、`templates/**`
8. ❌ 不许合并自己的 PR

---

## 验收标准（整改后）

- [ ] **AC-2r** `subscription-sync.ts` 两处（`syncOne` + `syncMany`）的 `.set()`
      **均不含 `trafficTotal`**（`git diff` 可证）
- [ ] **AC-4r** `effectiveCustomerTrafficTotal` 的实现**只用**手动上限与套餐月流量
- [ ] **AC-6r** 三处口径统一（仪表盘 / 站内提醒 / 客户表格），
      `reminder-scan` 不再用裸 `trafficTotal`
- [ ] **AC-5r** 反向验收测试仍在且通过：「用尽且未换订阅 ⇒ 仍 100%」
- [ ] **AC-9r** 新语义测试：手动与套餐皆无 ⇒ 不限流量、不显示百分比
- [ ] **AC-11r** `TASK.md` 的 `Known Issues` 写明 `traffic_total` 降级为存量列
- [ ] **AC-7r** `pnpm build:shared` 后 `pnpm test` 全绿
- [ ] **AC-8r** `pnpm lint` / `pnpm format:check` / `pnpm typecheck:server` 全通过
- [ ] **AC-10r** 改动仍限于 File Scope；**PR #21 追加提交**（不新开 PR）

---

## 停手条件（命中任一条，立刻停下上报）

① 修改 R-2 函数签名时发现波及面超出 `shared/src/**` 与 `src/**`；
② `reminder-scan` 改口径时发现需要改数据库查询结构（join plans）且**代价超出预期**；
③ 发现「手动与套餐皆无 ⇒ 不限流量」这个新语义与你的理解不同；
④ 发现客户表格拿不到套餐额度（`usePlanOptions` 不含 `trafficLimit`）；
⑤ 需要改后端 API 响应结构才能做成。

---

## Next Action

1. 读本文件与 `TASK.md`（**注意 TASK.md 的 R2 已被本文件取代**）。
2. 撤销镜像（R-1）→ 改口径函数（R-2）→ 统一三处（R-3）→ 补测试（R-4、R-5）。
3. 跑全部验证。
4. **在 PR #21 上追加提交**（不要新开 PR），提交信息 `Refs: TASK-046`。
5. 更新 `HANDOFF-002-implementer-to-coordinator.md`（追加本次整改说明：
   撤销了什么、新口径如何落地、三处改动的具体位置、AC-5r/AC-9r 的测试断言）。
6. **停下**，等主控位复审与人类授权。

> **关于 `pnpm test` 的环境提示**：若遇到
> `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]` 拦截 vitest 清 `node_modules/.vite`，
> 那是环境限制不是代码问题 —— 先 `mv node_modules/.vite /tmp/…` 再跑，跑完可移回。
