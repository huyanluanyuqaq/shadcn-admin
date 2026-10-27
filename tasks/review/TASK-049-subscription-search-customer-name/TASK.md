# TASK-049 — 订阅管理搜索支持按客户名称搜索

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-049
Title: 订阅管理搜索支持按客户名称搜索
Workflow: feature
Status: REVIEW
Priority: P2
Owner: 执行位 Implementer（claude-code / Opus 5，会话 2026-10-24）
Owner Since: 2026-10-24T11:20:00+08:00
Assigned Role: developer
Created: 2026-10-24T11:00:00+08:00
Updated: 2026-10-27T14:00:00+08:00
Branch: feat/TASK-049-subscription-search-customer-name
Requires Human Approval: true
```

---

## Objective

订阅管理页（`/subscriptions`）顶部搜索框输入**客户名称片段**时，能搜到该客户名下绑定的订阅：
服务端 `q` 关键字的匹配范围从「订阅名称 + 订阅地址」扩展为「订阅名称 + 订阅地址 + **绑定客户名称**」三字段 OR 模糊匹配，前端搜索框 placeholder 文案同步体现。

---

## Background

**现状链路（已实测，main `d229ce1`）：**

1. 前端 `src/features/subscriptions/components/subscriptions-table.tsx:65` 把工具栏搜索框的
   `globalFilter` 经 `useDebouncedValue`（300ms）防抖后作为 `q`，于 `:67-77` 进入
   `SubscriptionListParams`，由 `api.ts:54-72` 的 `useSubscriptionsQuery` 拼成
   `GET /api/subscriptions?page&pageSize&q&customerId&poolId&syncStatus&enabled&sortBy&sortOrder`。
2. 服务端 `server/src/routes/resources.ts:104-130` 的订阅 CRUD 配置
   `searchCols: [subscriptions.name, subscriptions.url]`（`:110`）；
   `server/src/lib/crud.ts:150-154` 把 `searchCols` 各列做 `like(col, '%kw%')` 后 OR 拼接。
3. 搜索框 placeholder 现为「搜索订阅名称或地址…」（`subscriptions-table.tsx:189`）。

**缺口：** 运营中的高频入口是「记得客户叫什么」，而不是订阅名或订阅 URL。现有的「绑定客户」
筛选器（`subscriptions-table.tsx:203-205`）是**精确单值**匹配（`api.ts:65` 注释：多选时仅
首个生效），无法按名称片段模糊查找。

**设计结论（主控位已完成，见 Implementation Plan 参考实现）：** 在 CRUD 工厂增加一个可选的
跨表搜索钩子 `searchCondition`，订阅路由用 drizzle `exists()` 关联子查询匹配
`customers.name`（已实测 drizzle-orm 0.45.4 导出 `exists`，`node -e` 验证为 function）。

---

## Scope

- `server/src/lib/crud.ts`：`CrudOptions` 新增可选字段
  `searchCondition?: (keyword: string) => SQL | undefined`；列表处理器把该条件与
  `searchCols` 的 like 做 OR（同时修正「searchCols 为空时条件被整体跳过」的边际）。
- `server/src/routes/resources.ts`：`/subscriptions` 路由传入 `searchCondition`，
  用 `exists()` 子查询按 `customers.name` 模糊匹配（关联键 `customers.id = subscriptions.customerId`）。
- `src/features/subscriptions/components/subscriptions-table.tsx`：搜索框 placeholder
  文案更新为体现「客户名称」。
- `src/features/subscriptions/components/subscriptions-table.test.tsx`：新增
  「placeholder 文案」与「输入关键字防抖后进入 q 参数」两组断言。
- `server/scripts/smoke.ts`：新增两项冒烟——按客户名称搜到订阅；按不存在的关键字
  返回 0 条；文件头覆盖说明补一行 TASK-049。
- `docs/technical/api-contract.md`：订阅资源处补一行 `q` 匹配字段说明（唯一文档改动）。

## Non-Scope

- 客户管理页反向搜索订阅（按订阅名称找客户）
- `q` 匹配客户的邮箱 / 备注（本任务只匹配客户**名称**）
- 改动「绑定客户」faceted 筛选的行为与多选语义
- 其他五个资源（分类/套餐/客户/供应商/邮箱绑定）的 `searchCols`
- 前端全量拉取后本地过滤（明令禁止，服务端筛选是既定契约）
- 调度器、通知、仪表盘等无关模块

---

## Requirements

1. `GET /api/subscriptions?q=<客户名称片段>` 的返回集中包含该客户绑定的订阅，
   与「订阅名称 / 订阅地址」的匹配为 **OR** 关系。
2. `customer_id` 为 NULL（未绑定客户）的订阅不因客户名搜索命中，但仍可被名称/地址命中。
3. `q` 与现有筛选（`customerId` / `poolId` / `syncStatus` / `enabled`）、排序、分页
   可叠加，语义为 AND（q 条件 AND 各筛选条件），不得回归。
4. 搜索框 placeholder 文案体现「客户名称」，用户可见。
5. 现有防抖（300ms）与「关键字变化时分页回到第 1 页」（`subscriptions-table.tsx:127-131`）
   行为不变。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 不引入新依赖； drizzle 查询构建器内实现（`exists()` / `like()`），禁止裸 SQL 字符串拼接，关键字必须走参数绑定 |
| 兼容 | 不改 API 契约的请求/响应结构，仅扩展 `q` 的匹配语义；不传 `searchCondition` 的资源行为逐字节不变 |
| 数据 | 验证只允许使用快照库（`VACUUM INTO` 到 `E:/AiData/`），**禁止向 `server/data/app.db` 写入测试行** |
| 安全 | 搜索条件为 OR 追加，不得使 WHERE 恒真（负向用例兜底） |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| 无 | - | - |

> `backlog/` 与 `active/` 均为空（2026-10-24 实测），无并行任务争用
> `crud.ts` / `resources.ts` / `subscriptions-table.tsx` / `smoke.ts`。

---

## Acceptance Criteria

- [x] AC-1: 冒烟新增项「按客户名称关键字搜索订阅（q 匹配绑定客户名称）」通过
      （订阅自身名称/地址均不含该客户名片段，命中只能来自客户名匹配）
- [x] AC-2: 冒烟新增项「按不存在的关键字搜索订阅返回 0 条」通过（防搜索条件恒真）
- [x] AC-3: 冒烟既有项无回归——在未改动 main 的同源快照、同启动参数对照下，
      失败集与基线逐字相同（7 项存量失败，根因与范围边界见 Known Issues 第 1 条），
      无新增失败、无既有项由绿转红。
      （原措辞：「既有全部项目通过」——因基线存量红色而不可达，经主控位审查
      修订为上述可判定形式；修订理由见 Known Issues 第 1 条。）
- [x] AC-4: `subscriptions-table.test.tsx` 新增用例通过：placeholder 体现客户名称；
      输入关键字防抖后 `useSubscriptionsQuery` 收到 `q` 参数
- [x] AC-5: `pnpm exec eslint` / `pnpm exec prettier --check` / `pnpm exec tsc -b` /
      `pnpm --filter server typecheck` 全部通过（改动文件全覆盖）
- [x] AC-6: `python scripts/audit-repo.py` 通过（F1–F9；本机缺 PyYAML 时以 CI 为准）
- [x] AC-7: `git status --short` 仅含 File Scope 内文件与任务档案自身，无 dist 污染、
      无临时文件入库

---

## File Scope

```yaml
File Scope:
  - server/src/lib/crud.ts
  - server/src/routes/resources.ts
  - src/features/subscriptions/components/subscriptions-table.tsx
  - src/features/subscriptions/components/subscriptions-table.test.tsx
  - server/scripts/smoke.ts
  - docs/technical/api-contract.md
  - tasks/backlog/TASK-049-subscription-search-customer-name/**   # 任务档案与交接（领取后随任务移动，当前位于 tasks/review/）
Non-Scope (files):
  - server/src/db/**          # 无 schema 变更，不生成迁移
  - shared/**                 # 无类型/schema 变更
  - src/features/customers/** # 客户页不改
  - src/features/subscriptions/api.ts   # SubscriptionListParams 已有 q，无需改
  - src/components/data-table/**        # 工具栏组件不改，只改调用方文案
  - .github/**
  - server/data/**
```

---

## Implementation Plan

1. **基线复核**：`git fetch origin` + `git rev-parse main origin/main`（期望 `d229ce1` 两处）、
   `git status --short`（期望为空）。
2. **领取任务**：`git switch -c feat/TASK-049-subscription-search-customer-name`；
   任务目录移入 `tasks/active/`，`Status: READY → ACTIVE`，Meta 补 `Owner` / `Owner Since` / `Branch`。
3. **后端 · 工厂扩展**（`server/src/lib/crud.ts`）：

   - `CrudOptions` 增补（放在 `searchCols` 附近，注释说明用途与求值时机）：

     ```ts
     /**
      * 跨表关键字搜索条件（可选，TASK-049）。
      * 与 searchCols 为 OR 关系；keyword 已 trim，调用方自行拼 like 模式串。
      * 典型用途：订阅列表按绑定客户的名称搜索（customer_id 可空 ⇒ EXISTS 子查询）。
      * 在列表处理器内按请求求值，不得在模块加载期构建。
      */
     searchCondition?: (keyword: string) => SQL | undefined
     ```

   - 列表处理器（现 `:150-154`）改为：

     ```ts
     const conditions: SQL[] = []
     const keyword = (query.q ?? '').trim()
     if (keyword) {
       const matches: SQL[] = searchCols.map((col) => like(col, `%${keyword}%`))
       const extra = searchCondition?.(keyword)
       if (extra) matches.push(extra)
       if (matches.length > 0) conditions.push(or(...matches) as SQL)
     }
     ```

4. **后端 · 订阅路由**（`server/src/routes/resources.ts`）：`drizzle-orm` 导入补
   `and, exists, like`；`/subscriptions` 的 `createCrudRoutes` 配置中 `searchCols` 之后增加：

   ```ts
   // TASK-049：q 额外匹配「绑定客户的名称」——按客户检索是订阅管理的高频入口。
   // subscriptions.customer_id 可空 ⇒ EXISTS 关联子查询（未绑定客户的订阅天然不命中），
   // 与 searchCols 为 OR 关系；customers 表已在本模块导入。
   searchCondition: (keyword) =>
     exists(
       db
         .select({ id: customers.id })
         .from(customers)
         .where(
           and(
             eq(customers.id, subscriptions.customerId),
             like(customers.name, `%${keyword}%`)
           )
         )
     ),
   ```

   若 `exists()` 返回值与 `SQL` 存在类型摩擦，以 `tsc` 输出为准加显式注解，
   **不得**为迁就类型改语义（如去掉关联条件）。

5. **前端文案**（`subscriptions-table.tsx:189`）：
   `searchPlaceholder='搜索订阅名称或地址…'` → `'搜索订阅名称、地址或客户名称…'`。

6. **前端测试**（`subscriptions-table.test.tsx`）：仿照文件内 TASK-048 段落的
   `describe` 体例新增一组，要点：
   - 用 `document.querySelector('input[placeholder]')` 定位搜索框，断言
     `placeholder` **属性值**（不用文本匹配，避免与校验提示同文导致恒真——框架既有教训）；
   - `userEvent.type(input, '张三')` 后 `vi.waitFor(() => expect(useSubscriptionsQuery)
     .toHaveBeenCalledWith(expect.objectContaining({ q: '张三' })))`
     （防抖 300ms < waitFor 默认超时 1000ms）。

7. **冒烟**（`server/scripts/smoke.ts`）：在「按 customerId 筛选订阅」检查（约 `:515-526`）
   之后插入两项；客户名 `smoke-customer-${suffix}` 与订阅名 `smoke-sub-${suffix}`、
   地址 `https://example.com/sub` 均无片段重叠，命中只能来自客户名匹配：

   ```ts
   const byCustomerName = await req(
     `/api/subscriptions?q=${encodeURIComponent(`smoke-customer-${suffix}`)}`,
     { token }
   )
   check(
     '按客户名称关键字搜索订阅（q 匹配绑定客户名称）',
     byCustomerName.status === 200 &&
       Array.isArray(byCustomerName.json?.items) &&
       byCustomerName.json.items.some((s: any) => s.id === subscription.json?.id),
     byCustomerName.json && { total: byCustomerName.json.total }
   )

   const byNoMatch = await req(
     `/api/subscriptions?q=${encodeURIComponent(`绝不存在的关键字-${suffix}`)}`,
     { token }
   )
   check(
     '按不存在的关键字搜索订阅返回 0 条（防止搜索条件恒真）',
     byNoMatch.status === 200 && byNoMatch.json?.total === 0,
     byNoMatch.json && { total: byNoMatch.json.total }
   )
   ```

   文件头覆盖说明补一行（与既有 TASK-021/024/028 条目同格式）：
   `订阅 q 搜索扩展（TASK-049：按绑定客户名称搜到订阅 / 不存在的关键字返回 0）`。

8. **文档**（`docs/technical/api-contract.md`）：在「**订阅额外支持筛选：**」行（`:71`）后补：

   ```text
   **订阅 `q` 的匹配字段（TASK-049）：** 订阅名称、订阅地址、绑定客户的名称
   （三者 OR 模糊匹配；未绑定客户的订阅只参与前两者）。
   ```

9. **验证**：按 Verification Plan 逐项执行并留存原始输出。
10. **收尾**：任务档案回填 Changed Files / Current State / Known Issues；写交付
    Handoff（developer → reviewer）；`Status: ACTIVE → REVIEW`，目录移入 `tasks/review/`；
    推送分支、开交付请求（PR），**停下等待独立审查与人类授权**。

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1/AC-2/AC-3 | 冒烟（快照库隔离） | ① `pnpm build:shared` ② 快照：`node --import tsx -e "..."` 用 better-sqlite3 `VACUUM INTO 'E:/AiData/task049-snapshot.db'`（源：`server/data/app.db`，脚本与产物均放 `E:/AiData/`）③ 起服务：`cd server && DATABASE_URL=E:/AiData/task049-snapshot.db PORT=3002 node --import tsx src/index.ts`（**保持调度器启用**——冒烟含 TASK-021 的 jobs 增量断言，`ENABLE_SCHEDULER=false` 会使其失败）④ `SMOKE_BASE_URL=http://127.0.0.1:3002 pnpm --filter server smoke`，期望退出码 0 且新增两项 ✓ |
| AC-4 | 浏览器单测 | `pnpm exec vitest run --browser.headless src/features/subscriptions/components/subscriptions-table.test.tsx` |
| AC-5 | 静态门禁 | `pnpm exec eslint server/src/lib/crud.ts server/src/routes/resources.ts src/features/subscriptions/components/subscriptions-table.tsx src/features/subscriptions/components/subscriptions-table.test.tsx server/scripts/smoke.ts`；`pnpm exec prettier --check <同上 5 文件>`；`pnpm exec tsc -b`；`pnpm --filter server typecheck` |
| AC-6 | 框架审计 | `python scripts/audit-repo.py`（本机 `python` 无 PyYAML 时部分检查 SKIP，属环境差异，以 CI 的 `audit` 作业为准） |
| AC-7 | 工作区清洁 | `git status --short` 逐一核对；`git diff --check`（行尾/空白） |

**判定口径：** 「搜到」= 返回集包含目标订阅 id；「0 条」= `total === 0`。
两项都必须留原始输出（通过/失败计数与失败项明细）。

---

## Current State

**已实施完毕；I2 独立审查已 PASS（记录 `handoffs/2026-10-27-review.md`，
2026-10-27，零阻断项），待人类授权合并（REVIEW）。** 基线与主控位侦查一致（`main` / `origin/main` 均
`d229ce1`，`git status --short` 仅本任务档案自身）。6 个 File Scope 文件已改，
AC-1 / AC-2 / AC-4 / AC-5 / AC-6 / AC-7 全部通过；AC-3 的冒烟在**同源快照
（各自从 `server/data/app.db` 全新生成）、同启动参数**下与未改动 `main` 做了对照：
基线 152 通过 / 7 失败，本分支 154 通过 / 7 失败
（新增 2 项即 AC-1 / AC-2，7 项失败与基线逐字相同，均为 TASK-046 语义变更后
`smoke.ts` 阈值段落未同步所致的**存量失败**，与本任务无关，详见 Known Issues 第 1 条）。
另以快照库做了 Requirement 2/3 的定向复核（未绑定客户不被客户名命中、q 与
`customerId` / `syncStatus` / `enabled` 叠加为 AND、多来源命中取并集），
原始输出见交付交接。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `server/src/lib/crud.ts` | 修改 | `CrudOptions` 增可选 `searchCondition?: (keyword) => SQL \| undefined`（`:30-36`）；列表处理器改为「searchCols like + 钩子条件」统一 OR 后作为单一条件入 AND 链（`:157-166`），同时修正 searchCols 为空时条件被整体跳过的边际 |
| `server/src/routes/resources.ts` | 修改 | 导入补 `and, exists, like`；`/subscriptions` 增 `searchCondition`——`exists()` 子查询按 `customers.id = subscriptions.customerId` AND `like(customers.name, '%kw%')` 匹配（`:111-127`） |
| `src/features/subscriptions/components/subscriptions-table.tsx` | 修改 | 搜索框 placeholder `'搜索订阅名称或地址…'` → `'搜索订阅名称、地址或客户名称…'`（`:189`） |
| `src/features/subscriptions/components/subscriptions-table.test.tsx` | 修改 | 新增 `describe('SubscriptionsTable 关键字搜索')` 两组断言：placeholder 属性值体现客户名称；输入关键字防抖后 `useSubscriptionsQuery` 收到 `q` |
| `server/scripts/smoke.ts` | 修改 | 「按 customerId 筛选订阅」之后插入两项冒烟（按客户名称搜到订阅 / 不存在的关键字返回 0 条）；文件头覆盖说明补 TASK-049 一行 |
| `docs/technical/api-contract.md` | 修改 | 「订阅额外支持筛选」行后补 `q` 匹配字段说明（唯一文档改动） |
| `tasks/review/TASK-049-subscription-search-customer-name/TASK.md` | 新增 | 任务档案（唯一事实来源，随任务移入 `review/`） |
| `tasks/review/TASK-049-subscription-search-customer-name/handoffs/HANDOFF-002-developer-to-reviewer.md` | 新增 | 交付交接（含对照基线与原始输出） |
| `tasks/review/TASK-049-subscription-search-customer-name/handoffs/2026-10-26-coordinator-review.md` | 新增 | 主控位第一轮审查记录（12 项独立核实；结论 CHANGES_REQUESTED，零代码缺陷） |
| `tasks/review/TASK-049-subscription-search-customer-name/handoffs/HANDOFF-003-coordinator-to-implementer.md` | 新增 | 整改派单（B-1 AC 勾选与 AC-3 措辞 + M-1~M-3） |
| `tasks/review/TASK-049-subscription-search-customer-name/handoffs/2026-10-27-review.md` | 新增 | I2 独立审查记录（结论 PASS，1 次要项 M-4）——**原样入库，内容未改动** |
| `tasks/review/TASK-049-subscription-search-customer-name/handoffs/HANDOFF-004-coordinator-to-reviewer.md` | 新增 | I2 独立审查派单（审查位须能从仓库读取，故随本批入库） |

> `HANDOFF-001-coordinator-to-implementer.md` 为主控位既有指派交接，未改动。
> 本批（`fe680d3` 之后）为**纯档案改动 + 仓库外日志重命名**，零代码改动。

---

## Known Issues

1. **存量失败（非本任务引入，未修复）**：冒烟的流量阈值段落（客户 A / B 共 6 项 +
   仪表盘 `trafficThresholds` 1 项 = 7 项）在**未改动的 `main` 上同样失败**。
   根因是 TASK-046 的人类裁决把生效上限改为 `trafficManualCap ?? 套餐月流量`
   （`traffic-threshold.ts:20-22`、`:90-94`），而 `smoke.ts:733-742` 的客户 A/B
   只设 `trafficTotal` 与 `trafficUsed`、不设 `planId` 与 `trafficManualCap`，
   于是 `effectiveCustomerTrafficTotal` 返回 null，客户被 `continue` 跳过、永不评估。
   **修复属于独立任务**（要么把 A/B 改为设 `trafficManualCap`，要么按 TASK-046
   语义重写该段断言），本任务 File Scope 不含 `smoke.ts` 以外内容，
   且修它会改变 TASK-013 既有断言语义，**超出范围，故未处理**。
   影响：`pnpm --filter server smoke` 退出码非 0，AC-3 的「既有全部项目通过」
   在字面上不成立——如实记录为**基线同红**，非回归。
   **元事实登记（2026-10-26，主控位第一轮审查 B-1）：** AC-3 的验收措辞已由主控位
   审查修订为「既有项无回归（失败集与基线逐字相同）」的可判定形式，原文
   「既有全部项目通过」以引用形式保留在 AC-3 正文内，未静默改词；
   修订方向是**更严格**（明确到失败集逐字相同），且修订事实本身登记于本条。
2. **`smoke.ts` 的 happy path 依赖服务端指向 mock**：不设
   `TELEGRAM_API_BASE` / `FEISHU_API_BASE` 启动服务端时，会额外多出 4 项
   通知派发失败（TASK-025 ×2 / TASK-028 ×2）。这是环境差异而非缺陷，
   本任务的对照运行已按文件头说明正确设置。
3. 无本任务自身引入的未解决问题。
4. **M-4（2026-10-27，I2 审查次要项，已更正）**：主控位审查记录
   `2026-10-26-coordinator-review.md` 第 10 项的快照 id 跨度字面量
   （原「订阅 80–90 / 客户 86–99」）失准，实测新增存活 id 为订阅 86–90 /
   客户 95–99（`sqlite_sequence` 高水位 97 / 102）；该记录已追加字面量更正注记
   （原文以引用保留），结论（全新快照）经双重确认不受影响。I2 PASS 判定不受影响。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | coordinator | implementer | 2026-10-24 | 派单：侦查结论 + 设计参考实现 + 分相实施计划 |
| 002 | developer | reviewer | 2026-10-24 | 交付：实现 6 文件 + 单测 10 通过 + 冒烟对照基线（154/7 vs 152/7） |
| 003 | coordinator | implementer | 2026-10-26 | 整改派单：AC 勾选 + AC-3 措辞修订 + 三处次要项 |
| 004 | coordinator | reviewer | 2026-10-26 | I2 独立审查派单（含前置条件门槛与两轮审查范围） |
| 005 | coordinator | implementer | 2026-10-27 | I2 记录合批入库派单：PASS 后的搬运批次 |

**最新 Handoff：** `handoffs/HANDOFF-005-coordinator-to-implementer.md`
**Next Action：** 人类授权合并（`Requires Human Approval: true`）后由主控位执行
`gh pr merge 24 --rebase`；`Merge Record` 由下一个任务按 D13-C 回填。

---

## Merge Record

> **本节不随「Pass/收尾」填写。** 按 D13-C 选项 C（`.agents/rules/github.md` §2 / §6、
> `AGENTS.md` §14.2），本表由**下一个任务**在回收本任务归档时回填；
> 在此之前任务保持 `Status = REVIEW`、留在 `tasks/review/`（机制，非遗漏）。
> **禁止在本任务内自我回写**（那会造成档案与提交历史不一致）。

| 要素 | 值 |
|------|-----|
| PR | 待回填 |
| 合并策略 | rebase-merge（`AGENTS.md` §14.2 默认） |
| 提交数 | 待回填 |
| merged_at | 待回填 |
| merge_commit_sha | 待回填 |
| 合并后 CI run | 待回填 |
| 合并后 Docker run | 待回填 |
| 镜像 tag | 待回填 |
| 审查记录 | 待回填（无合并前独立审查档时如实写「无（A3 断档）」，不补写） |

---

## Task Rules

- [补充] 验证只允许使用快照库（`VACUUM INTO` 到工作区外的 `E:/AiData/`），
  禁止向真实 `server/data/app.db` 写入测试行。
- [补充] 冒烟服务端必须保持调度器启用（默认），不得设 `ENABLE_SCHEDULER=false`
  （会破坏 TASK-021 既有 jobs 断言，见 Verification Plan）。
- [补充] 任务档案与交接文件随实现**同批提交**（不新开「入库专用」交接——
  KI-11：记录自身产生新 head，独立提交会无限回归）。

---

## Notes

- **为什么用 `exists()` 而不是 LEFT JOIN**：主查询 `db.select().from(subscriptions)`
  的形状与行集合由 JOIN 改变的风险更高；`customer_id` 是单值外键，`exists()`
  关联子查询语义精确、且对未绑定客户天然返回不命中。
- **为什么钩子放在 crud.ts 而不是在 resources.ts 手写列表路由**：手写会复制
  分页/排序/筛选/afterWrite 全套逻辑，与「6 资源共用 CRUD 工厂」的既定架构相悖。
- **为什么负向用例是必需项**：`or(...)` 条件一旦恒真，表现为「搜索永远返回全表」——
  仅靠正向用例发现不了。「不存在的关键字 → total 0」是唯一廉价的反证。
- 匹配大小写：沿用 SQLite `LIKE` 默认语义（ASCII 大小写不敏感），与现有
  name/url 搜索一致，本任务不改变。
- 输入含 `%` / `_` 时按 LIKE 通配符处理——这是既有行为（name/url 同理），
  本任务不处理，亦不计入缺陷。
