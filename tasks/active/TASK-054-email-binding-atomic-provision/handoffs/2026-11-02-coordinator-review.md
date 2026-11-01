# 2026-11-02 主控位审查 —— TASK-054 新增邮箱单事务落库

| 字段 | 值 |
|------|----|
| **审查类型** | 主控位复审（coordinator review）。**不是** I2 两级审查里的第二级；本记录不替代独立实例审查 |
| **审查对象** | `tasks/active/TASK-054-email-binding-atomic-provision/`（TASK.md + HANDOFF-001） |
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
