# 2026-11-01 主控位复审记录 — TASK-052 客户编辑跨页实时同步

> **性质声明：** 本记录是**主控位复审**（Coordinator 视角把关与验收决定），
> 按 `.agents/protocols/handoff.md` §3.2 的两级命名分区，**不构成 I2 独立审查**。
> 依据：`TASK.md` 的 `Owner` 为「鼠鼠戴的工具人 (WorkBuddy)」，与本复审实例同属一个实例族；
> 按 `dual-agent-model.md` §5，实施该变更的实例族不得批准同一变更。
> **I2 已由另一实例（`Claude`，不携带实现上下文）完成两轮**，见
> `handoffs/2026-11-01-review.md` 第一、二节。本记录只回答「是否可合入、还差什么」。
>
> **方法声明：** 本记录的全部结论来自**我本人复跑的命令输出**与**我本人阅读的实际差异**，
> 未以开发者的自验结论或审查者的 PASS 声明作为依据；对审查记录的引用一律**当场抽查**。
> 凡我无法复现的证据（E2E 脚本），一律标注「不可复现」而非「已采信」，见 §6。

---

## Meta

```yaml
Task: TASK-052 — 客户编辑跨页实时同步（邮箱 / 订阅链接）
审查对象: 工作区未提交改动（未建分支）
  M docs/technical/api-contract.md
  M server/src/routes/resources.ts
  M src/features/customers/components/customers-action-dialog.tsx
  M src/features/customers/components/customers-action-dialog.test.tsx
  M src/features/emails/queries.ts
  ?? tasks/review/TASK-052-customer-edit-cross-page-sync/（TASK.md + handoffs/2026-11-01-review.md）
基线: main @ e563800（TASK-051 已合并，v1.0.7 已发）
档案: tasks/review/TASK-052-customer-edit-cross-page-sync/TASK.md
上游审查: handoffs/2026-11-01-review.md（第一节 FAIL / 第二节 PASS）
审查人: 主控位 Coordinator（本会话）
日期: 2026-11-01
结论: PASS（可合入）—— 附 1 项合入前置文档整改（N-1）+ 1 项技术债登记（C-1）
```

**一句话结论：** 技术交付达到可合并级——`build:shared` / `build:server` / `tsc -b` / `lint` 四项
真实退出码全 0，全量测试 **26 文件 / 340 用例全通过**，服务端迁移段与前端编排逻辑经我逐行阅读
与 6 条 AC 描述一致，接口文档与实现的可核对项**逐项相符**。拦下的问题**全部在文档措辞层**，
其中 1 项（`migrated` 计数口径）属 MAJOR-1 同类的「文档与实现不符」但程度轻微，派回执行位改 1 行；
另有 1 项审查两轮均未覆盖的**实质设计局限**（跨客户邮箱迁移越界）予以登记待裁决。

---

## 1. 独立复跑（原始输出，不看「已通过」字样）

| # | 命令 | 真实退出码 | 关键输出 |
|---|------|-----------|---------|
| 1 | `pnpm build:shared` | `0` | `tsc -p tsconfig.json` 无错误 |
| 2 | `pnpm build:server` | `0` | `tsc -p tsconfig.json` 无错误 |
| 3 | `pnpm exec tsc -b` | `0` | 无输出 |
| 4 | `pnpm lint` | `0` | `eslint .` 无输出 |
| 5 | `pnpm test`（全量，browser headless） | `0` | **`Test Files 26 passed (26)` / `Tests 340 passed (340)`** |
| 6 | 焦点文件计数交叉核对 | — | 输出中 `src/features/customers/components/customers-action-dialog.test.tsx (28 tests)`；`grep -cE "^\s*it\("` 同文件 = **28**，与档案声明一致 |

退出码取自 `cmd > file 2>&1; echo exit=$?` 形式，非管道后的 `$?`。

### 1.1 测试计数排除「虚高」的可能（TASK-047 教训复核）

- `vite.config.ts:45-70` 已显式声明 `exclude`（含 `**/dist/**`，并附「Vitest 4 运行时默认 exclude
  只有 node_modules/.git」的实测说明）⇒ 不存在 `shared/dist/**` 重复收集。
- 交叉核对：全仓 `^\s*it\(` 合计 **338**，与 340 相差 2，差额已定位为
  `src/context/search-provider.test.tsx:87` 的 `it.each([['Ctrl','Control'],['Cmd','Meta']])`
  **表格展开出 2 个用例**（1 个 `it.each` 声明 ≠ 1 个用例）。
  即 338 + 2 = **340**，与输出自洽，**未出现「文件数多了 1 而用例翻倍」的旧症状**。

### 1.2 必须披露的环境性失败（不能拿它当判定）

首次 `pnpm test` **失败**：`Test Files no tests` + 1 error + `exit=1`，栈顶为
`safe-delete-shim.cjs` 拦截 Vite 删除依赖缓存（`node_modules/.vite/**`）。
按本仓既有处置（`mv node_modules/.vite /tmp/…`）后复跑即全绿。
**该失败与本次改动无关，属环境/工具链形态**；但它正好说明：**单看 exit code 不足以判定**，
必须看输出末尾的 `Tests N passed`。此点写入本记录，避免后续把这次红判为回归。

---

## 2. 交付物实质审查（读差异，不读描述）

### 2.1 `server/src/routes/resources.ts`

| 判据 | 我的核验结果 |
|------|-------------|
| 迁移段位置在**事务内**且**先于 upsert** | ✅ 迁移段在 `db.transaction` 回调首部（L301 起）；`bindings` 的查询在迁移段**之后**，故迁移来的行会被同键 upsert 命中 |
| 触发条件 | ✅ `previousEmail !== undefined && previousEmail !== email`——不传 / 传同值均不进入迁移 |
| 合并判定键与 NULL 分支 | ✅ `and(eq(email,email), oldPoolId === null ? isNull(poolId) : eq(poolId, oldPoolId))`；SQLite 唯一索引对 NULL 不生效，故 NULL 分支必须显式判等，实现正确 |
| 合并动作 | ✅ 命中 → `tx.delete`；未命中 → `tx.update({ email })`（整条改名，`status`/`remark` 不动） |
| `migrated` 计数口径 | ⚠️ `migrated++` 在 **delete 与 rename 两个分支都会执行** ⇒ 计的是「处理过的旧行数」，而非「被改名的行数」。文档措辞未反映此点 ⇒ **N-1**（合入前置，见 §5） |
| `subscriptionId === null` 早返回 | ✅ 位置在**迁移之后**、清理/upsert 之前；返回 `{ row: null, action: null, cleaned: 0, migrated }` |
| 原 `if (subscriptionId !== null)` 守卫被移除是否等价 | ✅ 等价——早返回之后 `subscriptionId` 已不可能为 null，清理段的 `staleIds` 过滤不再需要外层守卫 |
| 响应结构 | ✅ `c.json({ action, cleaned, migrated, binding })` 恰 4 键；`binding: result.row ? serialize(result.row) : null` |
| 既有调用方兼容 | ✅ **我独立核了唯一调用方**：`subscriptions-action-dialog.tsx:150-154` 恒传 `subscriptionId: saved.id`（非 null）⇒ `TASK.md` Notes 的「null 分支原无调用方触达」成立，非事后合理化 |

### 2.2 `src/features/customers/components/customers-action-dialog.tsx`

| 判据 | 核验结果 |
|------|---------|
| 新建订阅后回写 target（`let target`） | ✅ 否则解绑判定的 `target.id` 无法取得 |
| 换链解绑的四重守卫 | ✅ `previousUrl` 存在 → `previousUrl !== url` → `previousSub.id !== target.id` → `previousSub.customerId === customer.id`；四条缺一即可能误伤（解绑他人订阅 / 解绑本次刚落到的同一条） |
| 解绑未命中的静默性 | ⚠️ 依赖 `useSubscriptionOptions()`（`pageSize: 200`），超 200 条时 `previousSub` 为 `undefined`、解绑静默不发生 —— 已由审查登记为 Known Issue #6，措辞准确，我复核成立 |
| 「清空链接」路径未被改动 | ✅ 走 `target` 存在则 `customerId: null`、返回 `'unlinked'`，与改动前一致 |
| 邮箱同步条件放宽 | ✅ `customer.email && (subscriptionId !== null \|\| emailChanged)`；`previousEmail` 用条件 spread 注入，**不会**在未变更时发送 `undefined` 键 |
| 清空邮箱路径 | ✅ `customer.email` 为空即整段跳过 ⇒ 旧绑定残留，与 Known Issue #1 一致，**本次未改变该行为**（放开的只是「有邮箱且邮箱变了」） |
| `action` 显式标志（NIT-1 整改） | ✅ 两分支各自赋值，无不可达三元；`tsc -b` 通过 |

### 2.3 测试质量

5 个新用例断言到**调用参数级**，并含负向断言（AC-1 断言「不存在 `customerId: null` 的解绑调用」、
AC-5 断言「`syncEmailBinding` 未被调用」），不是「跑完即绿」的形态。
覆盖方向与 AC-1~AC-5 一一对应，未见「用例断言的是自身 mock」的自证形态。

**结论：未发现审查两轮漏判的功能缺陷。** 这一判断基于代码路径，不基于测试全绿。

---

## 3. 接口文档 ↔ 实现一致性（我自己核，不引用审查者的 25 项探针）

`docs/technical/api-contract.md` L209-239 与实现的可核对项：

| 文档声明 | 源码判据 | 结论 |
|---------|---------|------|
| 请求 4 字段（`email` 必填 / `previousEmail?` / `poolId?` / `subscriptionId?`） | `emailBindingSyncSchema` L238-248 | ✅ |
| `previousEmail` 过 email 校验 | `z.string().email('邮箱格式不正确').optional()` | ✅ |
| 响应 4 键，`action`/`binding` 可空 | `return c.json({...})` 恰 4 键 + `result.row ? … : null` | ✅（结构性事实，无需运行期即可判定） |
| 仅迁移路径 `action: null` / `binding: null` / 不 upsert | 早返回分支 | ✅ |
| 迁移先于 upsert | 代码顺序 | ✅ |
| 同键已有绑定 → 删除旧条目、旧行备注不保留 | `tx.delete`，未写 remark | ✅ 文档括注与行为一致 |
| 未命中 → 整条改名 | `tx.update().set({ email })` | ✅ |
| 改绑时 `status`/`remark` 不动 | `.set({ subscriptionId })` | ✅ |
| 陈旧绑定一并清理 | `staleIds` 过滤 + `inArray` 删除 | ✅ |
| 单事务 | `db.transaction` 包住迁移/匹配/清理/upsert | ✅ |
| 唯一键 `(email, pool_id)` | `server/drizzle/0008_*.sql`：`DROP email_bindings_email_unique` + `CREATE UNIQUE INDEX uq_email_bindings_email_pool` | ✅（顺带确认 0001 的 email 单列唯一已废止，故「同邮箱多供应商」多行是设计内形态） |

**唯一不符项**：`migrated` 的语义措辞（§2.1 末行）⇒ N-1。

---

## 4. 对审查记录自身的复核（引用字面量抽查）

| 被引用的字面量 | 抽查结果 |
|---------------|---------|
| `server/src/routes/resources.ts:263`（MINOR-1 的 JSDoc 括注） | ✅ 逐字命中「已有绑定则删除旧条目（旧行备注不保留，以新邮箱既有条目为准）」 |
| `docs/technical/api-contract.md:235`（NIT-3 位置） | ✅ 逐字命中「`migrated` 为本次迁移的绑定条数」 |
| `TASK.md`「审查登记」块的 MAJOR-1 无解决标记（NIT-4） | ✅ 成立，块内仍写「MAJOR-1（阻塞）」 |
| NIT-5 的定位与引文 | ❌ **不精确**（R-1）：审查称「`TASK.md` Current State 该节称『整改轮未改任何逻辑语义』」，但该句在 `Current State` **不存在逐字**；现存逐字表述是 **Handoff 003 行**的「逻辑语义零改动」，`Current State` 仅在 NIT 摘要里以引号转述。**NIT-5 的实质成立**（`action` 返回值确实由恒 `'updated'` 变为按分支），仅定位与引文需更正 |
| 第一轮对 `customers-action-dialog.tsx` 的行号（`400-402` / `415` / `463-476`） | ⚠️ 基于**整改前**版本；整改轮引入 `let action` 与 target 注释后行号已漂移（R-2）。属正常时序，但**此类行号不可作为事后核对判据** |
| 「`git status` 审查前后一致，仅 4 个 File Scope 内文件被修改」 | ✅ 与第一轮时点自洽（`api-contract.md` 当时尚未修改）；当前实际为 5 个 M 文件，差额已由第二轮记录 |
| E2E 三层 85 项断言（41 + 19 + 25） | ⚠️ **不可复现**（R-3）：三个脚本均未入仓，记录只给文件名，无日志路径、无 sha256、无运行时间戳。我**未采信亦未否定**，以源码级核验替代 |

---

## 5. 问题清单与我的处置决定

### 合入前置（文档层，不改逻辑）

**N-1（原 NIT-3，升级为合入前置）** — `docs/technical/api-contract.md:235` 的 `migrated` 措辞
与实现口径不符：合并路径下旧行是被删除、没有任何行被改名，`migrated` 仍计 1。
处置：**派回执行位**改为「本次迁移段**处理**的旧邮箱绑定条数（含被合并删除的旧行）」。
理由：这与 MAJOR-1 属**同一类失真**（文档声明与实现不符），只是无消费方、无行为影响；
既然 MAJOR-1 已作为阻塞项修过，剩下的同类措辞不应留到下一任务。改动限该文件该行。

**N-2（原 NIT-4）** — `TASK.md`「审查登记」块给第一轮 MAJOR-1 补解决标记。
处置：**我直接修**。理由：该块是主控位署名内容，执行位不得代写（框架一致性要求）；
且 `negative-assertion-review.md` §1 规则 1 明确「不允许中间态」。

### 已裁定「不改」

**N-3（原 NIT-5）** — **不改写 Handoff 003**（历史记录不得回改），改为在两处加注：
本记录 §4 与 `TASK.md` `Current State` 各注一句「Handoff 003 的『逻辑语义零改动』应读作
『未改变任何**可观测**行为』；`action` 返回值语义经 NIT-1 修正得更准确」。
这正是 `negative-assertion-review.md` §1 认可的范式（历史陈述 + 显式声明）。

### 登记（新发现，两轮审查均未覆盖）

**C-1（MINOR，不阻塞）— 跨客户邮箱迁移越界**

- **事实**：`customers.email` **无唯一约束**（`server/src/db/schema.ts:69` `email: text('email')`；
  迁移 0000/0002 均未建唯一索引），且前端表单只校验格式、不校验唯一性。
- **实现**：迁移段按 `previousEmail` **全量取行**（`where(eq(emailBindings.email, previousEmail))`），
  不校验这些绑定所属订阅的 `customerId` 是否为本客户。
- **后果**：若两个客户共用一个邮箱、各自绑定不同供应商（`email_bindings` 唯一键是
  `(email, pool_id)`，故允许同邮箱多行），编辑其中一位的邮箱会把**另一客户的绑定一并改名**，
  另一客户在邮箱管理中的记录随之消失、且其订阅被挂到他人的新邮箱下。
- **严重性**：低概率（需共用邮箱）× 中影响（归属错位，但**不删数据**）。
- **建议**：登记 `TASK.md` Known Issue #7（已由我登记）；根治需入参携带 `customerId`
  或按「本客户名下订阅」过滤，属接口扩展 ⇒ **待人类裁决是否单独立项**。

**C-2（裁决留档，非问题）— 本变更是否需要 ADR**

`AGENTS.md` §13 DoD 含「接口变更已写 ADR」。本变更使响应新增 `migrated`、`action`/`binding` 可空，
形式上是响应契约变更。**裁定：无需 ADR。** 依据：① 唯一消费方是本仓前端且不消费返回值；
② 项目既有惯例将端点契约置于 `docs/technical/api-contract.md`，`ADR-003` 仅覆盖「拉取/调度」，
邮箱绑定同步从未入 ADR（`grep -rn "email-bindings\|邮箱绑定" docs/decisions/` **零命中**）。
留此裁决以免后续复核把它误判为漏项。

**C-3（核验，非问题）— 「清空邮箱」不是本次回归**

`customer.email` 为空时整段邮箱同步被跳过，改动前后一致（详见 §2.2）。
与 Known Issue #1 的表述相符，Non-Scope 成立，不要求本任务处理。

### 审查记录质量问题（要求后续改进，不影响本次结论）

- **R-1**：NIT-5 的定位与引文不精确（见 §4），后续引用档案文字须逐字核对。
- **R-2**：跨轮引用代码行号时须标注「基于哪个提交/时点」，否则整改后即失效。
- **R-3**：E2E 类证据若无法入仓，至少须留**可复现摘要**（脚本绝对路径 + 运行时间 + 输出尾部），
  否则在证据链上等同「不可复核声明」。本记录不将其计入可采信证据。

---

## 6. 我在本次复审中**没有**做的事（限制声明）

1. **未复跑三层 E2E**（41 + 19 + 25 断言）：脚本未入仓、不存在于当前工作区，
   技术上无法执行。相应结论由「源码级核验」替代，已在 §2/§3 逐项标注判据形态。
2. **未启动真实浏览器 / 未起服务端实例**：登录 → 编辑 → 切页观察这条链路，
   我依据实现路径与 5 个单测（含负向断言）判断，未做运行期复现。
3. **未核验平台侧**（分支保护 / 必需检查 / PR 状态）：本任务尚未建分支、尚无 PR，
   `P1`（分支保护）**引用前须重测**，我将在合并前置检查时重测，不在本次记录中给出结论。
4. 平台身份无法区分协作位，独立审查为**流程约定、平台不强制**（`dual-agent-model.md` §5.2）。

---

## 7. 验收结论

**`PASS`（可合入）。**

- AC-1~AC-6 与 Requirements 1~5：**成立**，证据为「单测 28/28（我复跑）+ 源码路径核验（我逐行读）」；
- Constraints：请求侧向后兼容 ✅、响应侧扩展已如实写入接口文档 ✅、无新依赖 ✅、无 schema/迁移 ✅、单事务 ✅；
- 安全性：`previousEmail` 经 zod 校验、全部走参数化查询、未新增路由、未削弱受保护规则 ✅；
- File Scope：5 个文件，全部在 Scope 内（`api-contract.md` 已申报超范围理由）✅；
- 档案完整性：AC 复选框与 PASS 一致、`Status = REVIEW` 与 `tasks/review/` 自洽、
  Handoff 表已登记至 004（本次复审追加 005）✅。

**合入前提**：完成 **N-1**（`api-contract.md:235` 一行措辞）。N-2 我已在本次一并修完。
N-1 属纯文案，改完**不需再开新一轮独立审查**，由我在合并前置检查时逐字复核；
若执行位超出该行范围改动，则必须重启独立审查。

**合并后状态（D13-C 选项 C）**：保持 `Status = REVIEW`、留在 `tasks/review/`；
**Merge Record 不由本任务回写**，并入下一个任务的交付请求（本记录不预留占位，避免自我回写）。

---

## 8. Handoff（主控位 → 执行位）

| 项 | 内容 |
|----|------|
| From → To | coordinator → developer |
| Current State | PASS，1 项合入前置（N-1），1 项登记（C-1） |

**必须完成（解除合入前置）**

1. 改 `docs/technical/api-contract.md:235` 的 `migrated` 措辞（**仅此一行**，禁触逻辑代码）。
2. 建分支 `feat/TASK-052-customer-edit-cross-page-sync`（**禁直推 `main`**），提交 5 个文件 + 任务目录
   （`TASK.md` 与我本份主控位记录一并入库，避免 KI-11「审查记录自身是未跟踪项」）。
3. 开 PR，描述含：AC 证据指针、N-1 整改说明、C-1 登记、以及「本地全绿 ≠ 可合并，须看 `gh pr checks`」。

**禁止**

4. 不得代写 `handoffs/2026-11-01-coordinator-review.md` 与 `TASK.md`「审查登记」块（主控位署名内容）。
5. 不得借本次整改之名改动 `resources.ts` / 前端逻辑（逻辑层已验收，动则重启独立审查）。

### Next Action

> 执行位：改 `api-contract.md:235` 一行 → 建分支 → 提交（含任务目录）→ 开 PR →
> 在主控位合并前置检查中由我复核该行并重测平台门禁（P1）。

---

## 9. References

- `tasks/review/TASK-052-customer-edit-cross-page-sync/TASK.md`（唯一事实来源）
- `handoffs/2026-11-01-review.md`（上游两轮独立审查，第一节 FAIL / 第二节 PASS）
- `docs/technical/api-contract.md` L209-239（N-1 目标行 L235）
- `server/src/routes/resources.ts` L237-405（迁移段 L301 起）
- `src/features/customers/components/customers-action-dialog.tsx` L360-482
- `docs/operations/negative-assertion-review.md` §1 规则 1、§5.1
- `.agents/protocols/dual-agent-model.md` §3 / §5 / §5.2
- `vite.config.ts` L45-70（测试计数排除项，TASK-047 F-2）

---

## 10. 附录 — 复审结论的适用范围被后续需求改变（2026-11-01T18:50）

**本条晚于上文全部结论，冲突时以本条为准。**

人类在同日追加了「客户邮箱与订阅链接强绑定」需求，并裁决**并入 TASK-052**（不新开任务）。
该需求改变了上文 PASS 所依据的语义与差异范围：

| 上文假设 | 现状 |
|---|---|
| 迁移一律执行 `previousEmail` | 迁移改为**有条件**：仅当「旧绑定订阅的 `customerId` == 本次订阅的 `customerId`」时改名，否则旧记录保留转「未分配」 |
| `subscriptionId: null` → 仅迁移 | 改为**不 upsert、也不迁移**；AC-4 修订 |
| 差异仅 5 个文件 | 现为 **9 个文件**（新增 `crud.ts` / `email-binding-sync-check.ts` / `server/package.json` / `subscriptions-columns.tsx`） |
| 合入前置仅 N-1（1 行文档） | N-1 已随本次一并修复；同时新增 AC-7~AC-9 与两节文档 |

**因此：**

1. 上文的 `PASS` **仅覆盖 Handoff 004/005 时点的工作区**，**不再覆盖**当前差异；
2. 我在本轮以**执行位**身份实施了该扩展（`Handoff 006`），按 I2 我**不得**批准自己写的代码
   ⇒ 当前差异必须由**不携带实现上下文的另一实例**重新独立审查；
3. 上文 N-1 的派单已失效（该项已修完），不再挂账；C-1 的登记已被两道口子部分缓解，
   见 `TASK.md` Known Issue #7 的追加说明。
