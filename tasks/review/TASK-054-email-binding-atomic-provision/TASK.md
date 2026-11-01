# TASK-054 — 新增邮箱单事务落库（供应商 + 订阅 + 绑定一次写完）

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-054
Title: 新增邮箱单事务落库（供应商 + 订阅 + 绑定一次写完）
Workflow: feature
Status: REVIEW
Priority: P1
Owner: Codex（执行位 · developer）
Owner Since: 2026-11-01T23:05:00+08:00
Assigned Role: developer
Created: 2026-11-01T22:50:00+08:00
Updated: 2026-11-02T00:10:00+08:00
Branch: feat/TASK-054-email-binding-atomic-provision（叠于 TASK-053 未提交改动之上，未回退任何既有改动）
Requires Human Approval: false
```

---

## Objective

把「新增邮箱」面板的保存从**三次独立 HTTP 写入**收敛为**一次服务端事务**：供应商、订阅、绑定
要么三张表全落、要么三张表零新增；并在此路径上挡住「失败后重试」造成的重复订阅。

**可判定标准：** 人为让绑定插入失败时，`subscription_pool` 与 `subscriptions` 的行数与请求前完全一致；
前端保存只发出 1 次写请求。

---

## Background

TASK-053 交付的「新增邮箱」面板（`src/features/emails/components/emails-action-dialog.tsx`
`onSubmitCreate`）在前端串行发三次请求：

1. 供应商不存在 → `POST /api/subscription-pools`
2. 订阅链接非空 → `POST /api/subscriptions`
3. `POST /api/email-bindings`

三次各自提交、互不感知，**没有「要么全成、要么全不成」**。第 3 步失败时：订阅已进订阅管理
（显示「未分配」），而邮箱管理查不到这条邮箱（没有绑定行）——用户以为没保存成功，再点一次就多一条
重复订阅。属 TASK-053 `Known Issues #4` 登记的已知缺陷，补偿措施仅是 toast 提示「请到订阅管理按邮箱补绑」。

`subscriptions.url` **没有唯一索引**（`server/src/db/schema.ts:118` 仅两个普通索引），
所以重复点击不会被数据库挡住，必须在服务端显式判重。

---

## Scope

1. 新增服务端原子接口 `POST /api/email-bindings/bundle`：在**单个 `db.transaction()`** 内完成
   「按需新建供应商 → 按需新建订阅 → 写绑定」。
2. 供应商按名称复用（trim + 大小写不敏感），未命中才新建（`url` 为空串）。
3. 订阅链接判重：`subscriptions.url` 已存在 → **409**，一行不写（挡住「失败后重试」的重复订阅）。
4. 前端「新增邮箱」面板改调该接口，保存只发一次写请求；失败文案去掉「请到订阅管理补绑」。
5. `docs/technical/api-contract.md` 增加该端点（入参 / 响应 / 三种 409），并更新「新增邮箱」行为表。

## Non-Scope

- **数据库 schema 与迁移**：不加/不改索引（本轮靠服务端判重，不靠唯一约束）。
- **`email_bindings.pool_id` 收为 NOT NULL、`subscription_id` 改 SET NULL**（模型级改动，另行立项）。
- **客户表单 / 订阅表单的 `syncSubscription` 路径**：不动其语义与调用点。
- **编辑邮箱**（五字段面板）的写入路径：本次只动「新增」。
- **TASK-053 Known Issue #2 的 R2 边界**（订阅表单直接改邮箱会 409）：属人类待裁决项，**本任务不得
  顺手放开或收紧**。
- 前端离线重试队列、乐观更新。

---

## Requirements

1. **原子性**：三张表的写入在同一事务内；任一步抛错（含 409 前置校验）→ 事务回滚，三表零新增。
2. **入参二选一**：`poolId` 与 `poolName` 至少给一个；都给时以 `poolId` 为准。都缺 → 400「供应商不能为空」。
3. **供应商复用规则**：`poolName` 与既有名称 `trim().toLowerCase()` 相等即复用，**不得**因大小写/首尾空格差异新建重复供应商。
4. **订阅创建字段**：`customerId = null`、`poolId = 本次供应商`、`email = 本次邮箱`、`name = null`、
   `cronExpr = '0 */6 * * *'`、`enabled = true`、`trafficUsed = 0`——与 TASK-053 前端现状逐字一致。
5. **判重顺序**：先判 `(email, poolId)` 绑定冲突（409，沿用既有 `uniqueHint` 文案），再判 `subscriptionUrl`
   重复（409），再判「该订阅已挂别的邮箱」（409）——三次判重都在**写库之前**，命中即不写。
6. **响应可判定**：201 返回 `binding.id` / `subscriptionId`（未建订阅为 `null`）/ `poolId` / `poolName` /
   `created.pool` 与 `created.subscription` 两个布尔。
7. **时间字段**：`timestamp_ms` 列一律传 `Date` 实例（传毫秒数会在运行期抛 `value.getTime is not a function`，类型检查不报）。
8. **日志**：成功写一条 `writeLog('info', '邮箱绑定', …)` 含邮箱、供应商、是否新建订阅；失败走统一错误响应，不写 info 日志。

---

## 接口契约（本任务的判定基准，实施不得擅自改口径）

```
POST /api/email-bindings/bundle        # authMiddleware 保护，与其他 /api/* 一致
```

请求体（zod）：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `email` | string(email) | 是 | 邮箱地址 |
| `poolId` | number(int, positive) | 二选一 | 既有供应商 id |
| `poolName` | string(trim, min 1) | 二选一 | 供应商名称，未命中则新建 |
| `subscriptionUrl` | string(trim) | 否 | 缺省/空串 ⇒ 只建绑定（仅注册态 E1） |
| `remark` | string \| null | 否 | 写入绑定 |
| `status` | enum | 否 | 默认 `active` |

响应：

- `201 { binding, poolId, poolName, subscriptionId, created: { pool, subscription } }`
- `400` 供应商缺失 / 邮箱格式不合法
- `409` 三类：`绑定已存在`（`(email, poolId)` 冲突）｜`订阅链接已在订阅管理中`｜`该订阅已绑定其他邮箱`

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 只用既有依赖（drizzle + better-sqlite3），不引新包；事务用 `db.transaction()`，与 `resources.ts:262` 同款写法 |
| 兼容 | 既有 `POST /api/email-bindings`、`POST /email-bindings/sync` 语义与入参**不得改动** |
| 兼容 | 前端 `emails-action-dialog` 编辑模式（五字段）保持原样，只改新建模式的提交 |
| 安全 | 不记录明文密码类字段；错误响应不回传 SQL 原文 |
| 范围 | 超出 `File Scope` 的改动须先更新本字段并说明理由 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-053（四态语义、R2 守卫、面板三字段） | blocks | 代码已在工作区，**未提交/未合并** |
| TASK-052 / TASK-053 的 Merge Record 回写（D13-C） | 交付前置 | 见 Task Rules |

> **开工前置**：本任务必须在 TASK-053 的改动之上进行（同一工作区未提交改动不得回退）。
> 若 TASK-053 尚未提交，先按 D13-C 与其合并节奏处理，**不得**在新分支上重写 TASK-053 的代码。

---

## Acceptance Criteria

- [x] AC-1: 预置一条同 `(email, poolId)` 的绑定后调用 `/bundle`（带新 `subscriptionUrl`）→ 返回 **409**，
      且 `subscription_pool` / `subscriptions` / `email_bindings` 三表行数与调用前**逐一相等**（脚本断言 4 项）。
      **证据**：`pnpm --filter server email-binding-bundle-check` AC-1 段，脚本打印
      `调用前：subscription_pool=1 subscriptions=0 email_bindings=1` /
      `调用后：subscription_pool=1 subscriptions=0 email_bindings=1`，4 项断言全过。
- [x] AC-2: `poolName` 不存在 + 有 `subscriptionUrl` → 201；新建供应商（`url=''`）、订阅（`customer_id IS NULL`）、
      绑定三者 id 互相指向一致，`created.pool === true`、`created.subscription === true`。
      **证据**：同上脚本 AC-2 段 19 项断言（含三表各 +1、`url === ''`、订阅六字段逐一核对、
      `binding.subscriptionId / poolId / email` 与响应 id 互指）。
- [x] AC-3: `poolName` 与既有供应商仅大小写/首尾空格不同 → 复用其 id，`created.pool === false`，
      供应商表行数不变。
      **证据**：同上脚本 AC-3 段；入参 `'  p1  '` 对既有 `'P1'`，`created.pool === false`、
      `poolId === 既有 id`、供应商表行数不变，响应 `poolName` 取库中原值 `'P1'`。
- [x] AC-4: 同一 `subscriptionUrl` 提交第二次 → **409**，`subscriptions` 行数不增（挡重复点击）。
      **证据**：同上脚本 AC-4 段；除「同邮箱同供应商重复提交」外，另覆盖「换邮箱 + 同链接」
      （③ 文案，点名已占用邮箱）与「同邮箱跨供应商 + 同链接」（② 文案）两个分支，
      三种 409 均实测可达，`subscriptions` 行数三次比对均不增。
- [x] AC-5: 不传 `subscriptionUrl` → 201，`subscriptionId === null`，该绑定仍出现在 `GET /api/email-bindings`
      （E1 仅注册态），`created.subscription === false`。
      **证据**：同上脚本 AC-5 段；含「订阅表行数不变」与「该 email 出现在 `GET /email-bindings` 列表」两项。
- [x] AC-6: 前端「新增邮箱」保存只发 1 次写请求：断言 `/bundle` 被调 1 次，且 `/subscriptions`、`/email-bindings`、
      `/subscription-pools` 的 POST **均未被调用**（用例级）。
      **证据**：`src/features/emails/components/emails-action-dialog.test.tsx` 3 个用例全过
      （`pnpm test` 全量 27 文件 / 345 用例通过）。三个旧写入入口的 hook 仍被 mock 出来并断言
      `mutateAsync` 零调用；另断言入参形状（有/无 `subscriptionUrl` 两种情况）、成功 toast、
      关闭对话框、失败只回显服务端 message 且不再出现「补绑」文案。
- [x] AC-7: `docs/technical/api-contract.md` 已收录 `/email-bindings/bundle`（入参表 / 201 响应 / 三种 409），
      且原文中「新增邮箱需建订阅再建绑定（两次写入）」的表述已删除或改为单事务口径。
      **证据**：`docs/technical/api-contract.md` 新增小节「新增邮箱单事务落库
      `POST /api/email-bindings/bundle`」（入参表 / 201 响应体 / 三种 409 文案表 / 判重顺序 /
      与 `sync` 的分工）；原「新增邮箱（前端面板，TASK-053）」小节的行为表改为单事务口径，
      「两次写入不在同一事务…需到订阅管理按邮箱补绑」整句已删除。

---

## File Scope

```yaml
File Scope:
  - server/src/routes/resources.ts                    # 新增 /email-bindings/bundle（事务）
  - server/src/routes/__tests__/**                    # 若已有服务端路由测试目录，则在此补用例
  - server/scripts/email-binding-bundle-check.ts      # 新增：事务性/判重/复用断言
  - server/package.json                               # 注册 email-binding-bundle-check 脚本
  - src/features/emails/queries.ts                    # 新增 bundle mutation
  - src/features/emails/components/emails-action-dialog.tsx
  - src/features/emails/components/emails-action-dialog.test.tsx   # 若不存在则新建
  - docs/technical/api-contract.md
  - tasks/backlog/TASK-054-email-binding-atomic-provision/**
Non-Scope (files):
  - server/src/db/**                                  # 无 schema 变更、无迁移
  - server/src/routes/customers.ts / subscriptions.ts # syncSubscription 路径不动
  - src/features/customers/**                         # 客户表单不在本任务范围
  - src/features/subscriptions/**
```

---

## Implementation Plan

1. 读 `server/src/routes/resources.ts` 既有 CRUD 工厂与 `:262` 的 `db.transaction()` 写法，确认插入语句风格。
2. 写 `POST /email-bindings/bundle`：入参 zod → 三段判重（全部在写库前）→ `db.transaction()` 内
   供应商（复用/新建）→ 订阅（按需）→ 绑定 → 返回 201 与 `created` 标记。
3. 写 `server/scripts/email-binding-bundle-check.ts`：临时库直驱真实路由，覆盖 AC-1~AC-5
   （含「失败后计数不变」的四项比对），并在 `server/package.json` 注册脚本名。
4. 改前端：`queries.ts` 加 `useBundleEmailBinding()`；`onSubmitCreate` 收敛为单次调用；
   删除原有「建订阅 → 建绑定」两步与「请到订阅管理补绑」文案。
5. 补前端用例：断言只调 `/bundle` 一次、其他 POST 零调用、成功 toast 与关闭行为不变。
6. 更新 `docs/technical/api-contract.md`。
7. 跑全量门禁并记录真实退出码。

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1~AC-5 | 服务端脚本 | `pnpm --filter server email-binding-bundle-check`（输出 N/N 通过） |
| AC-6 | 前端用例 | `pnpm test`（限定 `emails-action-dialog`），断言调用次数 |
| AC-1 补充 | 手工 | 脚本内已覆盖；若手测需先在快照库上造冲突行，勿动真库 |
| AC-7 | 人工核对 | `grep -n "bundle" docs/technical/api-contract.md` |
| 类型/静态 | 命令 | `pnpm build:shared` / `pnpm typecheck:server` / `tsc -b` / `pnpm lint` / `pnpm knip` / `pnpm prettier --check .` 退出码全 `0` |
| 回归 | 命令 | `pnpm test`（全量）+ `pnpm --filter server email-binding-check`（TASK-053 的 37 项不得退化） |
| 档案结构 | 命令 | `python scripts/audit-repo.py` → 9 PASS / 0 FAIL |

---

## Current State

**Status = ACTIVE（执行位已实施完毕，待主控位审查）。**

分支 `feat/TASK-054-email-binding-atomic-provision`，叠在 TASK-052/053 的未提交改动之上
（未回退、未重写任何既有改动）。`POST /api/email-bindings/bundle` 已实现，「新增邮箱」面板
已收敛为单次写请求，AC-1~AC-7 全部通过，全量门禁退出码均为 0。
D13-C 前置已实测：TASK-052 / TASK-053 **均未合并**（无 PR），保持 `Status = REVIEW` 原状，
未回填其 Merge Record（无可回填值，不伪造）。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `server/src/routes/resources.ts` | 修改 | 新增 `POST /email-bindings/bundle`（单事务 + 三段判重）；`uniqueHint` 字面量提取为模块级 `EMAIL_BINDING_UNIQUE_HINT` 供 CRUD 与新端点共用（值不变，行为不变） |
| `server/scripts/email-binding-bundle-check.ts` | 新增 | AC-1~AC-5 的独立验证脚本（临时库直驱真实路由，58 项断言） |
| `server/package.json` | 修改 | 注册 `email-binding-bundle-check` 脚本 |
| `src/features/emails/queries.ts` | 修改 | 新增 `useBundleEmailBinding()` 与 `EmailBindingBundleInput` / `EmailBindingBundleResult` 类型 |
| `src/features/emails/components/emails-action-dialog.tsx` | 修改 | `onSubmitCreate` 收敛为单次 `bundleBinding.mutate(...)`；移除三个旧写入 hook 的调用与「请到订阅管理补绑」文案 |
| `src/features/emails/components/emails-action-dialog.test.tsx` | 新增 | 3 个用例：单次写请求 / 三个旧 POST 零调用 / 失败文案 |
| `docs/technical/api-contract.md` | 修改 | 新增 `/email-bindings/bundle` 契约小节；「新增邮箱」行为表改单事务口径 |
| `tasks/active/TASK-054-email-binding-atomic-provision/**` | 修改 | 本档案 + Handoff |

> 注：`server/src/db/**`、`server/src/routes/customers.ts`、`server/src/routes/subscriptions.ts`、
> `src/features/customers/**`、`src/features/subscriptions/**` 均**未改动**（Non-Scope）。

---

## Known Issues

1. **本轮不解决「已存在的脏数据」**：TASK-053 之前因两次写入失败留下的「无绑定订阅」不会被本任务清理，
   仍需在订阅管理用「分配」入口人工补绑。
2. **供应商判重靠应用层字符串比较**，不做数据库级唯一约束：既有 `subscription_pool.name` 无唯一索引，
   并发下理论上仍可能产生同名两条（本轮不处理，属 schema 级改动）。
3. **`poolId` 与 `poolName` 同时给出时以 `poolId` 为准**，`poolName` 仅作日志展示；前端不会同时传，属防御性设计。
4. **判重 ② 与 ③ 共用同一分支**：`subscriptionUrl` 命中既有订阅时，先看它挂的是不是**别的邮箱**——
   是则报 ③ 的专属文案（点名冲突邮箱），否则报 ② 的「订阅链接已在订阅管理中」。两种都是 409、
   都不写库，差别只在 message。这样三种 409 文案都可达，而不是把 ③ 写成永不执行的死代码。
5. **判重 ③ 的触发条件是「链接已登记」**：若将来放开「复用已有未分配订阅」（即 ② 不再一律 409），
   ③ 会自动变成实际生效的守卫，无需改代码。当前它保护的是「同邮箱跨供应商 + 同链接」这一路径。
6. **`POST /email-bindings`（CRUD 创建）与 `/email-bindings/sync` 仍可被直接调用**：本任务只把
   「新增邮箱」面板收敛到 `/bundle`，没有从路由层面禁用另外两个写入入口（它们服务各自的编辑场景）。
   若有调用方绕过面板直连那两个入口，原子性保证不适用——属已知边界，非本轮范围。
7. **`poolName` 判重是全表扫描 + 内存比较**（与 TASK-052 客户邮箱判重同款写法）：供应商表规模小，
   可接受；若供应商增长到数千条需改为 `lower(name) = lower(?)` 的 SQL 条件（需先评估索引）。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | developer（Codex，执行位） | reviewer（主控位） | 2026-11-02 | 实施完毕：`/email-bindings/bundle` 单事务接口 + 前端单次写请求；AC-1~AC-7 全过，全量门禁退出码 0；D13-C 前置实测 TASK-052/053 未合并 |
| 002 | reviewer（主控位） | developer（执行位） | 2026-11-02 | 主控位复审 **PASS（有条件）**：AC-1~AC-7 逐条通过、10 项门禁独立复现、事务回滚经故障注入探针另证；整改 R1（档案「未提交」失真 + PR #27 未登记）／R2（Status 应为 REVIEW 并移入 `review/`）／R3（原子性无回归用例）；合并前置 B-1（PR #27 携带 TASK-052/053 未审代码）待人类裁决 |
| 003 | reviewer（主控位） | 人类 | 2026-11-02 | 0750 收口：B-1 走 A 路线 → 052/053 独立审查（052 PASS / 053 首轮 FAIL）→ 三轮修复（`074e557`/`51b7c04`/`bee2610`）→ 二轮独立复核 PASS → **053 转 PASS**；R3/R4/R5 闭合，R1/R2 由主控位补正；**PR #27 待人类授权合并** |

**最新 Handoff：** `handoffs/2026-11-02-coordinator-review.md`（主控位审查记录；执行位交付书为
`handoffs/HANDOFF-001-developer-to-reviewer.md`）
**Next Action：** 人类授权合并 PR #27（rebase-merge）；合并后按 D13-C 由下一个任务回填本任务与
TASK-052 / TASK-053 的九要素 Merge Record（三者同批落地，须互相引用同一 merge_commit_sha 与 CI run）。

---

## 状态补正（主控位，2026-11-02T01:20）

两个任务的执行位会话已结束，为避免「档案自述状态」与事实继续背离，本节由主控位补正并披露：

1. **Meta `Branch` 与 Dependencies 表里的「TASK-053 未提交改动之上」已过期**。事实：TASK-052/053 的改动
   已随 `767c149`（独占文件）与 `068bb5d`（5 个混合文件，文件级无法分离，原因见该提交信息）落库，
   `git status` 在实施结束时是干净的。原文保留不改（历史记录不伪造），以本节为准。
2. **`HANDOFF-001` 里「`git status` 中 15 个 modified + 2 个 untracked 原样保留」描述的是实施中途状态**，
   不是交付时状态；交付时的真实状态见上一条。同理，该交接书未登记 PR #27，PR 号以本节为准。
3. **`Status` 由 `ACTIVE` 改为 `REVIEW` 并移入 `tasks/review/`**：按 `.agents/protocols/task-lifecycle.md`，
   状态转换本应由执行位完成（「实现完成，自检通过」→ REVIEW），执行位交付后未做，由主控位代为补正。
4. **PR：`#27`**（`feat/TASK-054-email-binding-atomic-provision` → `main`，`MERGEABLE`）。

---

## Merge Record

| 要素 | 值 |
|------|-----|
| PR | 待回填（本任务合并后由**下一个任务**按 D13-C 回填） |
| 合并策略 | rebase-merge（`AGENTS.md` §14.2 默认） |
| 提交数 | 待回填 |
| merged_at | 待回填 |
| merge_commit_sha | 待回填 |
| 合并后 CI run | 待回填 |
| 合并后 Docker run | 待回填 |
| 镜像 tag | 待回填 |
| 审查记录 | 待回填（无则如实写「无（A3 断档）」，不得补写） |

---

## Task Rules

- [补充] **D13-C 归档回写前置**：交付请求前必须实测 TASK-052 / TASK-053 的合并状态——
  已合并者按九要素回填其 `Merge Record`（值须可被 `gh api` 复现）；未合并者保持 `Status = REVIEW` 原状并如实说明，**不得伪造**。
- [补充] **TASK-053 语义冻结**：本任务不得改动四态归属判定、`listCondition`、R1/R2 两道守卫的行为；
  发现冲突须停机上报，不得就地放宽。
- [增强] **失败路径必须留证**：AC-1 的「三表计数不变」要打印调用前后的三个数字，不接受「没报错即通过」。
- [裁决·人类 2026-11-02T00:47] **B-1 走 A 路线**：TASK-052 / TASK-053 必须先取得独立实例审查 PASS，
  才允许合并 PR #27；两者 Merge Record 按「随 PR #27 一并落地」回填。顺序已定，但合并仍需人类显式授权。

---

## Notes

- 命名取舍：接口名用 `bundle` 是因为它一次完成「供应商 + 订阅 + 绑定」三件事；若执行位认为与既有
  `/sync` 命名风格冲突，**可提出改名建议，但须在交付请求中显式说明并同步文档**，不得静默改名。
- 参考实现风格：`server/src/routes/resources.ts:262`（`db.transaction` 批量重排供应商）是仓内既有事务写法。
- 断言「N 项用例」前须排除 `shared/dist/**` 的编译产物重复收集（见 TASK-047 记录）。
