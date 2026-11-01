# HANDOFF-001 — TASK-054 developer → reviewer

| 字段 | 值 |
|------|----|
| **From** | Codex（执行位 · developer） |
| **To** | reviewer（主控位） |
| **Task** | TASK-054 新增邮箱单事务落库（供应商 + 订阅 + 绑定一次写完） |
| **Date** | 2026-11-02T00:10:00+08:00 |
| **Current State** | `Status = ACTIVE`，位于 `tasks/active/TASK-054-email-binding-atomic-provision/`，分支 `feat/TASK-054-email-binding-atomic-provision` |

---

## Current State

实施完毕，全量门禁通过，等待独立审查。**未自审、未合并、未推送合并。**

分支叠在 TASK-052/053 的未提交改动之上：`git status` 中 TASK-052/053 的既有改动
（`resources.ts` / `crud.ts` / `scheduler.ts` / `customers/**` / `emails/**` / `subscriptions/**`
等 15 个 modified + 2 个 untracked）**原样保留**，本任务只在其上追加，未回退、未重写。

---

## Completed Work

### 1. 服务端：`POST /api/email-bindings/bundle`（`server/src/routes/resources.ts`）

单 `db.transaction()` 内完成「按需新建供应商 → 按需新建订阅 → 写绑定」。

- **入参**（zod）：`email`(必填, email)、`poolId`(int+, 可选)、`poolName`(trim, min 1, 可选)、
  `subscriptionUrl`(trim, 可选)、`remark`(string|null, 可选)、`status`(enum, 默认 `active`)。
- **入参二选一**：都缺 → 400「供应商不能为空」；都给 → 以 `poolId` 为准。
- **供应商复用**：`poolName` 与既有名称 `trim().toLowerCase()` 相等即复用；未命中才在事务内新建
  （`url = ''`，`sortOrder = 当前最大值 + 1`，与 `/subscription-pools` CRUD 的 `createDefaults` 同规则）。
- **订阅字段**与 TASK-053 前端原口径逐字一致：`customerId = null`、`poolId = 本次供应商`、
  `email = 本次邮箱`、`name = null`、`cronExpr = '0 */6 * * *'`、`enabled = true`、`trafficUsed = 0`。
- **时间字段**：本端点的插入不显式传 `timestamp_ms` 列，由 schema 的 `default(nowMs)` 兜底
  （`nowMs` 返回 `Date` 实例），因此不触及「传毫秒数会抛 `value.getTime is not a function`」的坑；
  验证脚本里 seed 数据时对 `expire_at` 显式传 `new Date(...)`。
- **日志**：成功写一条 `writeLog('info', '邮箱绑定', …)`，含邮箱、供应商、是否新建订阅；
  所有 4xx 路径在写库前返回，不写 info 日志。

### 2. 三段判重（全部在写库之前，命中即 409、三表零新增）

| 顺序 | 条件 | 文案 |
|------|------|------|
| ① | `(email, poolId)` 已有绑定 | `该邮箱已绑定同一供应商下的订阅，请直接编辑已有绑定`（与 email-bindings CRUD 的 `uniqueHint` 同一常量） |
| ② | `subscriptionUrl` 已在 `subscriptions` 登记，且该订阅未挂本邮箱 | `订阅链接已在订阅管理中` |
| ③ | `subscriptionUrl` 已登记，且该订阅挂着**别的邮箱** | `该订阅已绑定邮箱「<邮箱>」。一条订阅只能对应一个邮箱，如需更换邮箱请同时更换订阅链接` |

②③ 共用一个「链接已登记」分支：先判 ③ 的更具体文案，否则落 ②。**理由**：若 ② 一律先返回，
③ 永不可达（链接已登记就已被 ② 挡掉），会写成死代码；合并后两种 409 都可达、都不写库，
差别只在 message。此为本任务对契约的一处**实现口径细化**，已在 `api-contract.md` 与
`TASK.md` Known Issues #4/#5 显式记录，未静默改动判定基准。

> 判重 ① 的常量 `EMAIL_BINDING_UNIQUE_HINT` 从 CRUD 的 `uniqueHint` 字面量提取为模块级常量，
> 两处共用。**值逐字不变**，CRUD 行为不变——这是本任务对 TASK-053 既有代码的唯一接触点。

### 3. 前端：只发一次写请求

- `src/features/emails/queries.ts`：新增 `useBundleEmailBinding()` 与
  `EmailBindingBundleInput` / `EmailBindingBundleResult`；成功后失效
  `email-bindings` / `subscriptions` / `customers` 三个根键。
- `src/features/emails/components/emails-action-dialog.tsx`：`onSubmitCreate` 收敛为单次
  `bundleBinding.mutate({ email, poolName, ...(url ? { subscriptionUrl: url } : {}) })`；
  删除「建供应商 → 建订阅 → 建绑定」三步与「请到订阅管理补绑」文案；
  移除 `useCreateSubscriptionPool` / `useCreateSubscription` / `useCreateEmailBinding` 的调用与 import。
  编辑模式（五字段）**未动**。

### 4. 文档（AC-7）

`docs/technical/api-contract.md`：
- 新增小节「新增邮箱单事务落库 `POST /api/email-bindings/bundle`」：入参表、201 响应体、
  三种 409 文案表、判重顺序、与 `/email-bindings/sync` 的分工（upsert vs create-or-409）。
- 原「新增邮箱（前端面板，TASK-053）」小节：行为表改单事务口径，删除
  「两次写入不在同一事务…需到订阅管理按邮箱补绑」。

---

## Changed Files

| 文件 | 变更类型 |
|------|---------|
| `server/src/routes/resources.ts` | 修改 |
| `server/scripts/email-binding-bundle-check.ts` | 新增 |
| `server/package.json` | 修改 |
| `src/features/emails/queries.ts` | 修改 |
| `src/features/emails/components/emails-action-dialog.tsx` | 修改 |
| `src/features/emails/components/emails-action-dialog.test.tsx` | 新增 |
| `docs/technical/api-contract.md` | 修改 |
| `tasks/active/TASK-054-email-binding-atomic-provision/**` | 修改（档案 + 本交接） |

**Non-Scope 文件零改动**：`server/src/db/**`、`server/src/routes/customers.ts`、
`server/src/routes/subscriptions.ts`、`src/features/customers/**`、`src/features/subscriptions/**`。

---

## Tests

全部在 `E:\NDLDSN-WORKSPACE\projects\shadcn-admin` 下执行，退出码为 `$LASTEXITCODE` 实测值。

| 命令 | 结果 | 退出码 |
|------|------|--------|
| `pnpm --filter server email-binding-bundle-check` | **通过 58 / 失败 0** | `0` |
| `pnpm --filter server email-binding-check`（TASK-053 回归） | **通过 37 / 失败 0** | `0` |
| `pnpm build:shared` | 通过 | `0` |
| `pnpm typecheck:server` | 通过 | `0` |
| `tsc -b`（根，`node node_modules/typescript/bin/tsc -b`） | 通过 | `0` |
| `pnpm lint` | 通过 | `0` |
| `pnpm knip` | 通过 | `0` |
| `pnpm prettier --check .` | All matched files use Prettier code style | `0` |
| `pnpm test`（全量） | **27 文件 / 345 用例全过** | `0` |
| `python scripts/audit-repo.py` | **PASS=9 FAIL=0 WARN=0** | `0` |

### `email-binding-bundle-check` 的 N/N 实测输出（节选）

```
[email-binding-bundle-check] 临时库：E:\AiData\task054-email-binding-bundle-check-1793548561545\data\app.db

AC-1：同 (email, poolId) 已有绑定 → 409，三表行数逐一不变
  调用前：subscription_pool=1 subscriptions=0 email_bindings=1
  调用后：subscription_pool=1 subscriptions=0 email_bindings=1
  ✓ 返回 409
  ✓ 沿用既有 uniqueHint 文案
  ✓ subscription_pool 行数不变
  ✓ subscriptions 行数不变
  ✓ email_bindings 行数不变

AC-2：新供应商 + 新订阅 + 新绑定 → 201，三者 id 互相指向一致
  ✓ 返回 201 / created.pool === true / created.subscription === true
  ✓ 供应商 +1 / 订阅 +1 / 绑定 +1
  ✓ 新建供应商 url 为空串 / name 为入参名称
  ✓ 订阅 customer_id IS NULL / pool_id 指向本次供应商 / email 为本次邮箱
  ✓ 订阅 name 为 null / cron_expr 为 '0 */6 * * *' / enabled 为 true / traffic_used 为 0
  ✓ binding.id 存在 / 绑定 subscription_id 指向本次订阅 / pool_id 指向本次供应商 / email 为本次邮箱

AC-3：poolName 与既有供应商仅大小写/首尾空格不同 → 复用，不新建
  ✓ 返回 201 / created.pool === false / created.subscription === false
  ✓ subscriptionId 为 null / 复用既有供应商 id / 响应 poolName 取库中原值
  ✓ 供应商表行数不变 / 订阅表行数不变 / 绑定 +1

AC-4：同一 subscriptionUrl 提交第二次 → 409，subscriptions 行数不增
  ✓ 首次提交 201 / 第二次提交 409
  ✓ subscriptions 行数不增 / subscription_pool 行数不增 / email_bindings 行数不增
  ✓ 换邮箱 + 同链接 → 409；提示点名已占用该订阅的邮箱（③）
  ✓ 同邮箱跨供应商 + 同链接 → 409；提示为「订阅链接已在订阅管理中」（②）

AC-5：不传 subscriptionUrl → 201，仅注册态（E1），仍出现在邮箱管理
  ✓ 返回 201 / subscriptionId === null / created.subscription === false / created.pool === true
  ✓ 订阅表行数不变
  ✓ 该绑定出现在 GET /email-bindings（E1 仅注册态）

入参校验：400
  ✓ poolId / poolName 都缺 → 400「供应商不能为空」
  ✓ 邮箱格式不合法 → 400 / poolId 不存在 → 400「供应商不存在」/ poolName 为空白 → 400

poolId 与 poolName 同时给出：以 poolId 为准
  ✓ 返回 201 / 落在 poolId 指定的供应商上 / 响应 poolName 为 poolId 对应名称

[email-binding-bundle-check] 通过 58 / 失败 0
```

（临时目录未自动删除，供复查：`E:\AiData\task054-email-binding-bundle-check-*`）

### AC-1 三表计数前后对比

| 表 | 调用前 | 调用后 | 判定 |
|----|--------|--------|------|
| `subscription_pool` | 1 | 1 | 相等 |
| `subscriptions` | 0 | 0 | 相等 |
| `email_bindings` | 1 | 1 | 相等 |

（脚本内对三个数字**逐一打印并断言**，非「没报错即通过」。）

---

## Known Issues

1. **判重 ②③ 合并分支**（见上）：已在本档案 Known Issues #4/#5 与 `api-contract.md` 记录。
2. **CRUD 创建入口与 `/email-bindings/sync` 未禁用**：本任务只收敛「新增邮箱」面板，
   另外两个写入入口仍可直连；绕过面板时原子性保证不适用。见本档案 Known Issues #6。
3. **`poolName` 判重是全表扫描**：供应商表规模小可接受；见本档案 Known Issues #7。
4. **环境事故（已恢复，需主控位知情）**：执行位在跑 `pnpm build:shared` 时，pnpm 的依赖自检
   触发了一次 `node_modules`  purge，中途因文件锁（EPERM）中断，导致 `node_modules` 半毁。
   已通过 `pnpm install --frozen-lockfile`（用户环境中的 pnpm 10）完整恢复，
   恢复后 `email-binding-check` 37/37 复跑通过，与事故前一致。
   **无任何源码 / 档案 / git 状态损失**（`git status` 前后一致）。本机沙箱内的 pnpm 为 11.25.0，
   其依赖自检会尝试 purge 并重建 `node_modules`，**在沙箱内执行 `pnpm <script>` 有复现风险**，
   建议后续在用户环境中执行 pnpm 命令。

---

## Remaining Work

无（实现侧已完毕）。等待主控位审查。

---

## Assumptions

1. **契约中「三种 409」的 ②③ 顺序按语义合并实现**（见 Completed Work §2）：契约原文写的是
   「再判 `subscriptionUrl` 重复（409），再判『该订阅已挂别的邮箱』（409）」。若严格按字面顺序
   先返 ②，则 ③ 在任何输入下都不可达。执行位选择「② 检测、③ 细化文案」的合并分支，
   使三种 409 均可达。**此为实现口径的显式偏离，已在档案与文档记录，请主控位裁决是否接受。**
2. 新供应商的 `sortOrder` 取「当前最大值 + 1」，与 `/subscription-pools` CRUD 的
   `createDefaults` 保持一致（契约未规定，但若取 0 会插到自定义顺序最前面）。
3. 前端只传 `poolName` 不传 `poolId`（不再自行匹配 `poolList`）：匹配口径统一收拢到服务端，
   避免前后端两套 trim/大小写规则漂移。属实现选择，不改外部行为。
4. 未给 `POST /email-bindings`（CRUD）与 `/email-bindings/sync` 加任何限制（Non-Scope 未授权）。

---

## Risks

| 风险 | 缓解 |
|------|------|
| ②③ 合并分支与契约字面顺序不完全一致 | 已在档案 / 文档 / 本交接三处显式记录，交主控位裁决 |
| 供应商同名并发下仍可能建两条（无唯一索引） | 契约明确的 Non-Scope（schema 级改动），本轮不处理 |
| 前端不再预检供应商是否存在，错误依赖服务端 409 文案 | 服务端三种 409 均有中文 message，`toast.error` 直接展示 |
| 环境事故可能复现（沙箱内 pnpm 11 触发 node_modules purge） | 见 Known Issues #4；建议在用户环境执行 pnpm |

---

## Next Action

主控位（reviewer）：
1. 读本 Handoff + `tasks/active/TASK-054-email-binding-atomic-provision/TASK.md`；
2. 读实际 diff（`git diff` + 未跟踪文件），**不要只读本交接的描述**；
3. 逐条核对 AC-1~AC-7，重点复核：判重 ②③ 的合并分支是否可接受、`EMAIL_BINDING_UNIQUE_HINT`
   提取是否确实未改变 CRUD 行为、`onSubmitCreate` 是否真的只发一次写请求；
4. 出具 PASS / FAIL 审查记录（`handoffs/2026-11-02-review.md`）。
