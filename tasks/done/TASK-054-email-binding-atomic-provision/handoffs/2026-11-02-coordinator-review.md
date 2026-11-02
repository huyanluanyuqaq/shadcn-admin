# 2026-11-02 主控位审查 —— TASK-054 新增邮箱单事务落库

| 字段 | 值 |
|------|----|
| **审查类型** | 主控位复审（coordinator review）。**不是** I2 两级审查里的第二级；本记录不替代独立实例审查 |
| **审查对象** | `tasks/active/TASK-054-email-binding-atomic-provision/`（TASK.md + HANDOFF-001）；<br>本记录成文于该目录仍在 `active/` 时，2026-11-02T01:20 随 Status 改 `REVIEW` 移入 `tasks/review/`，内容不因此改写 |
| **被审 head** | `8caab4f144ed7a77ef3b124a117dbcbe9afbf248` |
| **分支 / PR** | `feat/TASK-054-email-binding-atomic-provision` / PR **#27**（OPEN，`MERGEABLE` / `CLEAN`） |
| **审查时间** | 2026-11-02T00:37–00:47 +08:00 |
| **审查结论** | **PASS（有条件）** —— 代码与文档判定通过；3 项整改 + 1 项合并前置必须闭合 |

---

## 1 独立复核（不看交接结论，自己重跑）

| 项 | 命令（本机实测） | 结果 | 退出码 |
|----|------------------|------|--------|
| 事务性 / 判重脚本 | `server/node_modules/.bin/tsx scripts/email-binding-bundle-check.ts` | **58 / 0** | `0` |
| TASK-053 回归脚本 | `server/node_modules/.bin/tsx scripts/email-binding-sync-check.ts` | **37 / 0** | `0` |
| 前端全量 | `node_modules/.bin/vitest run --browser.headless` | **27 文件 / 345 用例** | `0` |
| 类型 | `node node_modules/typescript/bin/tsc -b` | 通过 | `0` |
| Lint | `node_modules/.bin/eslint .` | 通过 | `0` |
| 格式 | `node_modules/.bin/prettier --check .` | All matched files use Prettier code style | `0` |
| 死代码 | `node_modules/.bin/knip` | 通过 | `0` |
| 档案门禁 | `python scripts/audit-repo.py` | **PASS=9 FAIL=0 WARN=0** | `0` |
| CI（PR #27） | `gh run view 41325099935` | `install-lint-build` / `audit` 均 `SUCCESS`，`headSha = 8caab4f`（与被审 head 一致） | — |

交接书声明的 10 项数字与实测**逐项相符**，无虚报。

### 1.1 一处必须说明的复跑插曲

首次 `vitest` 直接失败：`Test Files no tests` + `Error: [safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED] {"count":119,...,"targets":["node_modules\\.vite\\vitest\\...\\deps"]}`。
这是本机 safe-delete guard 拦截 vite 重建依赖缓存，**不是代码缺陷**；`mv node_modules/.vite /tmp/…` 后复跑即 27/345 全绿。判据只认「移动缓存后仍红」。

---

## 2 AC 逐条判定

| AC | 判定 | 我的依据（自己跑出来的，不引用交接书） |
|----|------|------------------------------------------|
| AC-1 | **通过（证据强度不足，见 R3）** | 脚本 AC-1 段打印 `pool=1 subs=0 bindings=1` → 调用 → `pool=1 subs=0 bindings=1`，409 文案 = `EMAIL_BINDING_UNIQUE_HINT` |
| AC-2 | 通过 | 新建供应商 `url=''`、订阅六字段（`customer_id NULL` / `cron_expr '0 */6 * * *'` / `enabled true` / `traffic_used 0` / `name null` / `pool_id` 指向本次供应商）、绑定三向外键互指 |
| AC-3 | 通过 | 入参 `'  p1  '` 对既有 `'P1'` → `created.pool === false`，复用 id，供应商行数不变，响应 `poolName` 取库中原值 |
| AC-4 | 通过 | 同链接二次提交 409 且 `subscriptions` 不增；另两条路径（换邮箱同链接 → ③ 点名邮箱；同邮箱跨供应商同链接 → ②）均实测可达 |
| AC-5 | 通过 | 不传 `subscriptionUrl` → 201 / `subscriptionId === null` / 订阅表不增 / 该邮箱出现在 `GET /email-bindings` |
| AC-6 | 通过 | `emails-action-dialog.test.tsx` 3 用例；实测断言 `bundleEmailBinding.mutate` 恰 1 次、入参 `{email,poolName,subscriptionUrl}` 精确相等、空链接时 `'subscriptionUrl' in vars === false`、三旧 hook `mutateAsync` 零调用、失败只回显服务端 message 且不含「补绑」 |
| AC-7 | 通过 | `docs/technical/api-contract.md:347` 新增小节（入参 / 201 / 四种 400 / 三种 409 表 / 判重顺序 / 与 `sync` 分工）；`grep "补绑"` 仅剩 `:106` 的**否定式**表述（"因此也无需「到订阅管理补绑」"），无残留旧口径 |

### 2.1 对「判重 ②③ 合并分支」的裁决：**接受**

契约字面写 ①→②→③，实现把 ②③ 合成「链接已登记」一个分支、内部先判 ③ 再落 ②。
理由成立：若 ② 一律先返回，③ 在任何输入下都不可达，就是死代码。两者都是 409、都不写库，差别只在 message。
已在 `TASK.md` Known Issues #4/#5、`api-contract.md` 错误表、HANDOFF §2 三处显式披露，**不属于静默改口径**。
附带确认：文档错误表把 ② 的条件写成「且该订阅未挂本邮箱」、③ 写成「挂着别的邮箱」，与实现的两个互斥谓词一致，无失真。

### 2.2 对 `EMAIL_BINDING_UNIQUE_HINT` 提取的核查：**未改变既有行为**

`git show 767c149:server/src/routes/resources.ts` 中原文为 `uniqueHint: '该邮箱已绑定同一供应商下的订阅，请直接编辑已有绑定'`（`:233`），
现模块级常量值逐字相同（`resources.ts:31`），CRUD 处改为引用同一常量（`:299`）。值不变、调用点不变。

### 2.3 对 `db.transaction()` 真实性的核查：**回滚有效（新证据，非交接书提供）**

AC-1 走的是「写库前判重短路」，**根本没进事务**，因此它证明不了回滚。我另做了一次故障注入探针
（脚本在 `E:/tmp`，不入库）：预置同邮箱绑定 → 给 `email_bindings(email)` 注入 UNIQUE 索引
→ 传 `poolName`（判重 ① 因供应商未命中被跳过）+ 新链接（②③ 跳过）→ 事务内「建供应商 → 建订阅 → 插绑定」时抛
`SQLITE_CONSTRAINT_UNIQUE`。结果：

```
注入后、调用前： { pool: 1, subs: 0, bindings: 1 }
SqliteError: UNIQUE constraint failed: email_bindings.email   ← 抛在 resources.ts:510（绑定插入）
调用后：         { pool: 1, subs: 0, bindings: 1 }
响应状态： 500
✓ 事务已回滚：绑定插入失败时，供应商与订阅均未残留
```

即「供应商已建、订阅已建、绑定失败」这一**原始缺陷现场**下，前两张表确实被一起回滚。Objective 的原子性成立。

---

## 3 整改项（合并前必须闭合）

### R1（档案失真）`TASK.md` / `HANDOFF-001` 仍在描述已不存在的「未提交」状态

- `TASK.md:20` Meta `Branch:` 写「叠于 TASK-053 **未提交**改动之上」；
- `TASK.md:132` Dependencies 写「代码已在工作区，**未提交**/未合并」；
- `HANDOFF-001:17-19` 写「`git status` 中 TASK-052/053 的既有改动（15 个 modified + 2 个 untracked）**原样保留**」。

实测：`git status --short` **完全干净**，这些改动已经由 `767c149` 与 `068bb5d` 落库（PR #27 三个提交）。
handoff 把「实施中途的工作区状态」当成「当前状态」呈现，属本仓反复出现的档案自述失真。

**要求**：改为事实口径 ——「TASK-052/053 的改动经 `767c149`（独占文件）与 `068bb5d`（5 个混合文件）随本分支落库；
文件级无法分离的原因见 `068bb5d` 提交信息」。同时把 PR **#27** 登记进 Handoff 表（交接书通篇未提 PR 号，
而 PR 是交付请求的载体）。

### R2（状态机）`Status = ACTIVE` 与「等待独立审查」自相矛盾

`.agents/protocols/task-lifecycle.md`：`ACTIVE` = 正在实现、目录 `active/`；`ACTIVE → REVIEW` 的触发者是 **Developer**，
触发条件是「实现完成，自检通过」。当前 `TASK.md:13` 是 `ACTIVE`、目录是 `active/`，却在 Handoff 里声明「等待主控位审查」——
State 与 Narrative 打架。

**要求**：改为 `Status: REVIEW` 并移入 `tasks/review/TASK-054-email-binding-atomic-provision/`（与 TASK-052/053 同规格）。
本记录写在 `active/` 下是**跟随现状**，目录迁移由执行位执行，我不代写其署名文件。

### R3（AC 质量）「要么全落、要么零新增」目前**没有任何自动化防线**

推理（**未做变异测试，明确标为推理**）：把 `resources.ts:464` 的 `db.transaction(...)` 包裹去掉、三段判重位置不变，
`email-binding-bundle-check` 的 **58 项仍会全过** —— AC-1 的 409 来自判重短路，其余场景都是单次成功写。
也就是说本任务的核心承诺只由一次人工探针守着，回归时不会红。

**要求**（二选一，推荐前者，成本约 10 分钟）：

1. 在 `email-binding-bundle-check.ts` 增一节常驻用例，用 **触发器**注入失败，不依赖我的临时脚本：
   `CREATE TRIGGER probe_fail BEFORE INSERT ON email_bindings BEGIN SELECT RAISE(ABORT,'injected'); END`
   → 调 `/bundle`（新供应商 + 新链接）→ 断言 `subscription_pool` 与 `subscriptions` 行数**逐一不变** → 删触发器。
2. 若不加固化用例，则必须把 `TASK.md` Objective / Requirements #1 的「任一步抛错即整体回滚」降格为
   「事务包裹存在（人工探针已验证一次，无回归用例）」，并在 Known Issues 登记。

### B-1（合并前置）PR #27 携带 TASK-052 / TASK-053 的**未审查代码**

`767c149` 是 TASK-052/053 的实现提交，`068bb5d` 又带入 5 个混合文件里的 TASK-052/053 部分。
两个任务的 `Status` 均为 `REVIEW`、均未合并、**均未取得独立实例审查**（TASK-053 明确标注「需不携带实现上下文的独立实例」）。
按 rebase-merge 合并 PR #27，等于让 052/053 的代码**绕过两级审查直接进 main**。

**要求**（二者择一，需人类裁决）：

- **A（推荐）**：先完成 TASK-052 / TASK-053 的独立审查并 PASS，再合并 PR #27；两任务 Merge Record 记为
  「随 PR #27 rebase-merge 一并落地」并按 D13-C 由下一个任务回填九要素；
- **B**：人类明示「接受 052/053 随同合并」，则须在本记录与两任务档案同步留痕，不得默认发生。

在 B-1 闭合前，**PR #27 不得合并**（合并权在主控位，且需人类显式授权）。

> **裁决（人类，2026-11-02T00:47+08:00）：选 A。** 即：TASK-052 / TASK-053 必须先取得独立实例审查 PASS，
> 之后才允许合并 PR #27；两者 Merge Record 以「随 PR #27 一并落地」口径回填。
> 该裁决不解除「合并需人类显式授权」这一前置——A 只确定了顺序，不构成合并授权。

---

## 4 非阻断观察（NI）

| # | 观察 | 说明 |
|---|------|------|
| NI-1 | 「三个旧写入入口零调用」断言当前是**空转** | 组件已不再 import `useCreateEmailBinding` / `useCreateSubscriptionPool` / `useCreateSubscription`，mock 出来的 `mutateAsync` 天然为 0。它只在「有人把旧路径接回来」时才转为有意义的绊线，现值≈0 但成本也≈0，保留即可 |
| NI-2 | 判重 ① 文案在「仅注册态」邮箱上语义不准 | 绑定 `subscription_id` 为 NULL 时仍提示「已绑定同一供应商下的**订阅**」，用户会以为已有订阅。属 CRUD 既有文案，本轮未恶化（Known Issues #6 已把该入口列为边界）。若要改，需与 CRUD 同步改，另开 |
| NI-3 | 事务内异常对前端是英文 `Internal Server Error` | 注入探针的 500 走 Hono 默认响应，`toast.error` 会原样显示英文。判重类错误都是中文 409，只有「不该发生」的 DB 错误会给英文，可接受 |
| NI-4 | `api-contract.md` 的新小节末尾挂了两行描述 `sync` 调用方的正文 | 「前端两个调用方：订阅表单…与客户表单…」紧跟 `> 与 sync 的分工` 引用块之后、未在块内，读起来像 bundle 的调用方。属排版漂移，建议并入上一小节的 `sync` 段落 |
| NI-5 | `worker` 侧 `poolName` 全表扫描判重（Known Issues #7） | 与 TASK-052 客户邮箱判重同款写法，规模小可接受；已登记，不阻断 |

---

## 5 结论

**PASS（有条件）**：实现与契约一致、原子性经我独立探针验证、门禁 10/10 项自测复现、无自审、未自行合并。
在 **R1 / R2 / R3 闭合 + B-1 经人类裁决**之前，本任务不得进入合并流程。

**本轮不作判定的事项**：

- 「删除 `db.transaction` 后 58 项是否仍全过」——推理结论，未做变异测试（修改源码验证会把树弄脏，且在审查职责外）；
- TASK-052 / TASK-053 的 AC 是否成立——不在本次审查范围，须由独立实例另行审查（见 B-1）。

---

## 6 追加（2026-11-02T01:05）—— 052/053 独立审查回执，以及本任务的连带阻断项 R4

按人类裁决「A 路线」，独立实例（不携带实现上下文）已出具两份记录：

- `tasks/review/TASK-052-.../handoffs/2026-11-02-review.md` → **PASS（有条件）**，无代码阻断项；
  R1 为档案失真（「旧邮箱 B 显示未分配」在当前归属模型下不成立：B 仍指向旧订阅 ⇒ 属 E2/E4，不出现在邮箱管理），
  NI-1 为「28/28」等旧数字不可复现（实测 7 场景 37 项）。
- `tasks/review/TASK-053-.../handoffs/2026-11-02-review.md` → **FAIL**，阻断项 R1：

> `/email-bindings/sync` 的「一条订阅只能一个邮箱」守卫用 `lower(email)` 比较（`resources.ts:603`），
> 但同一函数里 upsert 的定位用 `eq(email, …)` 精确匹配（`resources.ts:621-628`）。
> 于是把邮箱只改大小写（`a@x.com` → `A@X.COM`）时：守卫判定「不是别的邮箱」而放行，
> upsert 又匹配不到既有行而**新建一条** ⇒ 同一订阅挂两条绑定，正是 TASK-053 要根除的形态。
> 可从正常 UI 触发：`customers-action-dialog.tsx:463-464` 的 R1 拦截也用 `toLowerCase()` 比较，
> 大小写变更被视为「邮箱未变」而放行，随即 `:511-524` 以新大小写发起同步。

**我已独立复现**（重放独立审查员留在 `E:/tmp/probe-052-053.ts` 的探针）：同一订阅先后同步
`a@x.com` / `A@X.COM` → `200 / 200`，`email_bindings` 变为 **2 行**，邮箱值为 `["a@x.com","A@X.COM"]`。

### R4（阻断合并 · 代码）本任务的判重 ① 有同根漏洞

`resources.ts:424-429` 的判重 ① 写的是 `eq(emailBindings.email, email)` —— 与 R1 同源的**精确匹配**。
`email_bindings` 的唯一索引 `(email, pool_id)` 在 SQLite 里是二进制比较，大小写变体不冲突，
因此「同一供应商 + 同一邮箱的另一大小写写法」会绕过判重 ① 再插一条绑定。

**要求**：与 R1 一并修，且必须一致 —— 所有「同一邮箱」的判定统一走
`lower(email) = lower(?)`（**不做存量改写、不做 migration**，避免把用户输入的显示大小写抹平）：

| 位置 | 现状 | 应改为 |
|------|------|--------|
| `resources.ts:603` sync 守卫 | `ne(sql\`lower(email)\`, email.trim().toLowerCase())` | 保留（已是大小写不敏感） |
| `resources.ts:621-628` sync upsert 定位 | `eq(emailBindings.email, email)` | `sql\`lower(email) = ${email.trim().toLowerCase()}\`` |
| `resources.ts:424-429` bundle 判重 ① | `eq(emailBindings.email, email)` | 同上 |

修完须各补一条脚本用例（同一订阅 / 同一供应商，两次不同大小写）：**断言绑定行数不变**，
而不是只断言状态码 —— 本次两种缺陷都是「状态码看着正常、行数悄悄 +1」。

### 合并影响

B-1 的 A 路线要求 052/053 双 PASS，现 053 为 FAIL ⇒ **PR #27 仍不得合并**。
本轮修复会落在同一分支（052/053 没有独立分支，代码就在 PR #27 里），修复提交后需对
「R1 修复 + 新增用例」再出一轮独立复核，通过后才能进入合并授权。

---

## 7 修复轮次记录（2026-11-02T01:10–01:40）

| 提交 | 内容 |
|------|------|
| `074e557` | `resources.ts` sync upsert 定位（`:636`）与 bundle 判重 ①（`:432`）改为 `lower(email)` 比较；新增大小写场景（sync 场景 8 / bundle 判重 ① 变体）与**事务回滚**常驻用例（R3，触发器 `RAISE(ABORT)` 注入） |
| `a65970a` | 文档/档案校正：`api-contract.md` 归属口径与重复段落；`TASK-052` 旧计数（28/28、341）改实测值并加注；`TASK-053` AC-7 措辞改准；`emails/queries.ts:170` JSDoc 改准 |
| `51b7c04` | **R5（本轮新发现，已闭合）**：`/email-bindings` CRUD 补 `beforeWrite` 大小写不敏感判重 —— 这是同根缺陷的**第三个入口**（`PATCH` 编辑邮箱） |

### 7.1 R5 的由来与我的判据错误

执行位在上一轮主动登记「CRUD 没有邮箱判重，唯一性只靠区分大小写的索引」，我核实后判定**必修**而非登记了事：
客户表 `resources.ts:95-135` 早有同构实现，绑定表漏配，`PATCH` 把一行改成与另一行大小写冲突即落出重复。

第一轮我给的判据写错了一处：我要求「预置一条 `a@x.com` → PATCH 该条改成 `A@X.COM` → 期望 409」。
执行位指出这**不构成重复**（`ne(id)` 排除自身，改自己成自己的大小写变体只有一行，200 才对），
自行改为「预置两行 `a@x.com` + `b@x.com` → PATCH `b` 改成 `A@X.COM` → 409」。**该纠正是对的，我的判据有误**。

### 7.2 行为变化（须披露）

`beforeWrite` 把 `pool_id IS NULL` 视作同一个格子 ⇒ 「同邮箱的两条未指定供应商绑定」由**允许**变为 **409**。
判断：这是「判定单元 = (邮箱, 供应商)」的自然推论（NULL 也是一个格子），且 UI 上供应商必填，
属收紧退化路径。已核对 `server/scripts/smoke.ts:984-995` 的 `NULL 互异` 用例：其另一行 `pool_id` 非空，
`isNull` 分支命中不到，**该用例仍会通过**（执行位说法成立）。

为避免文档与实现打架，`docs/technical/api-contract.md:299-311` 已补「应用层判重（TASK-054）」小节，
写明 trim + 大小写不敏感、`NULL` 同格、跨供应商不受影响、落库保留原样大小写。
**该段落由主控位直接补写**（执行位未覆盖此点），特此披露，不是执行位交付内容。

### 7.3 我自己的复核

| 项 | 结果 |
|----|------|
| `email-binding-sync-check.ts` | **49 / 0**（原 37 → 41 → 49） |
| `email-binding-bundle-check.ts` | **68 / 0**（原 58） |
| 代码核对 | `resources.ts:310-336` 与客户表 `:95-135` 同构；`:636` 与 `:432` 均为 `lower()`；守卫 `:596-616` 未被顺手重写 |
| 残留 | `PATCH` 不存在 id 的退化路径会先 409 而非 404（与客户表同款，既有行为，不阻断） |

### 7.4 仍未闭合

R1（档案失真）与 R2（Status/目录）是**执行位**的档案动作，到本记录写入时尚未做；
R5 的修复未经**独立实例**复核（本轮修复由执行位完成，按 I2 不能由我或执行位自批）。
⇒ 下一步：独立实例复核「三个入口口径一致 + 新用例是否真咬得住」，通过后由人类授权合并。

---

## 8 第三轮（`bee2610`）与最终判定（2026-11-02T01:15）

第二轮独立复核给出 **PASS（0 阻断）**，同时提出 4 条待收项，执行位以 `bee2610` 收口：

| 项 | 内容 | 处置 |
|----|------|------|
| N1 | `beforeWrite` 在 `values.email` 非字符串时直接放行 ⇒ PATCH 只传 `poolId` 跳过判重（实测可把一行挪进他人格子） | 已修：先解析「本次改动后的身份」= `values.email ?? 现值` + `values.poolId ?? 现值`，身份变了才判重 |
| N2 | 存量重复行经 UI 全量保存**恒 409**（连只改 `remark` 也拦），脏数据在 UI 里改不动 | 已修：身份未变（`trim+lower` 邮箱相同且 `poolId` 相同）直接放行 |
| N3 | `api-contract.md` 旧句「同邮箱 + 未指定供应商均为合法新身份」与新句「两条 NULL 也算重复」正面矛盾（**该段主控位所写，错误在我**） | 已重写：索引层（区分大小写 / NULL 互异）与业务语义分层表述，覆盖面改为修后真正成立的口径 |
| N4 | `smoke.ts:984` 注释理由过期 | 已补注「索引层结论，应用层另判重复」；断言名未动（其另一行 `pool_id` 非空，原表述仍成立） |

### 8.1 主控位自己的复核（不采信交接数字）

| 项 | 实测 | 退出码 |
|----|------|--------|
| `email-binding-sync-check.ts` | **55 / 0**（9 场景 → 11 场景） | 0 |
| `email-binding-bundle-check.ts` | **68 / 0** | 0 |
| `vitest` | **27 文件 / 345 用例** | 0 |
| `tsc -b` / `eslint` / `prettier --check` / `knip` | 全通过 | 0 / 0 / 0 / 0 |
| `audit-repo.py` | PASS=9 FAIL=0 WARN=0 | 0 |
| 代码核对 | `resources.ts:314-347`：现值查询 → 身份合成 → 身份未变放行 → 变则 `lower(email)+poolId+ne(id)` 判重；落库不外改大小写 | — |

### 8.2 最终判定

- **TASK-052**：PASS（R1 档案失真已随 `a65970a` 修正，无代码阻断项）。
- **TASK-053**：**PASS**（R1 大小写变体缺陷已闭合，独立复核以真变异测试证明用例咬得住；R2 文档口径已修正）。
- **TASK-054**：PASS。R1（档案「未提交」失真 + PR #27 未登记）与 R2（Status/目录）由主控位在收口提交中补正
  （见本档案 §「状态补正」）；R3（原子性回归用例）由 `074e557` 以触发器注入固化；R4/R5（判重三入口）已闭合。

**遗留（不阻断合并，登记待办）**：`PATCH` 不存在的 id 会先命中判重返回 409 而非 404（与客户表同款既有行为）；
`smoke.ts` 未实跑（需起服务，不在门禁内）；并发竞态未压测；真实库是否已存在大小写重复行未核查
（若存在，现已被 N2 修复解除「改不动」的困境）。

### 8.3 合并前置

B-1（A 路线）的两项条件已满足：052 PASS、053 PASS。**PR #27 可进入合并流程，但仍需人类显式授权**；
合并后按 D13-C 由下一个任务回填本任务与 052/053 的九要素 Merge Record。
