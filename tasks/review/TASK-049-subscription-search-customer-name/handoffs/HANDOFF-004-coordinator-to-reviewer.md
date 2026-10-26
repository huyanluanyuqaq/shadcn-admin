# HANDOFF-004 — 主控位 Coordinator → 独立审查位 Reviewer（I2 独立审查派单）

> **性质声明：** 本派单触发的是 **I2 独立审查**（`.agents/protocols/dual-agent-model.md` §5
> 不变量 I2「实现者 ≠ 批准者」+ §5.1：换一个**不携带实现上下文的新实例**）。
> 接收方**不得**是本任务的实现、设计或整改实例——若你曾以任何身份参与本任务
> （含先读过实现代码再被派审），**立即停止并上报**。
> 审查记录命名 `handoffs/YYYY-MM-DD-review.md`（`.agents/protocols/handoff.md` §3.2
> 「独立审查记录」类），与主控位复审记录 `2026-10-26-coordinator-review.md`
> **不得相互替代**（后者与派单实例同源，按两级命名分区不构成 I2）。

---

## Meta

```yaml
From: 主控位 Coordinator
To: 独立审查位 Reviewer（不携带实现上下文的新实例）
Task: TASK-049 — 订阅管理搜索支持按客户名称搜索
Date: 2026-10-26T21:30:00+08:00
Current State: REVIEW（第一轮主控位审查 CHANGES_REQUESTED；整改入库前不得开工）
Previous Handoff: HANDOFF-003-coordinator-to-implementer.md
```

---

## Completed Work

> 以下均为**已发生的事实**（部分经主控位核实，但你须独立复跑，不得照抄结论）。

- **[派单]** `HANDOFF-001-coordinator-to-implementer.md`（2026-10-24）：侦查结论 +
  设计定稿（`crud.ts` 增可选 `searchCondition` 钩子 + 订阅路由 `exists()` 关联子查询）。
- **[交付]** 执行位单一提交 `fe680d3`（PR #24，9 文件 = 6 个 File Scope + 3 档案）：
  后端工厂扩展、订阅路由关联条件、前端 placeholder、单测 8→10、冒烟 +2 项、
  `api-contract.md` 一行；PR 描述覆盖交付请求模板字段。
- **[主控位第一轮审查]** `handoffs/2026-10-26-coordinator-review.md`：12 项独立核实，
  结论 **CHANGES_REQUESTED**（1 阻断 B-1 + 2 次要 M-1/M-2 + 1 可选 M-3；**零代码缺陷**）。
- **[整改派单]** `handoffs/HANDOFF-003-coordinator-to-implementer.md`：要求执行位**追加**
  `docs(TASK-049)` 提交（不 amend、不强推），同批入库审查记录 + HANDOFF-003 +
  **本文件**，登记 Handoff 表 003/004 行，推送后停下。
- **[CI]** PR #24 head `fe680d3`：run `40107879780`（`audit` + `install-lint-build`
  双绿，`pull_request` 事件，2026-10-24T15:38:13Z）。**合并门禁以合并时点 head 的
  run 为准**——整改提交会触发新 run，以那时为准。

---

## Changed Files

> 交付物（commit `fe680d3`）的 6 个 File Scope 文件；档案文件随整改提交更新。

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `server/src/lib/crud.ts` | 修改 | `CrudOptions` 增可选 `searchCondition`；列表处理器把「searchCols like + 钩子条件」统一 OR 后作为**单一**条件入 AND 链 |
| `server/src/routes/resources.ts` | 修改 | `/subscriptions` 增 `searchCondition`：`exists()` 子查询按 `customers.id = subscriptions.customerId` AND `like(customers.name, '%kw%')` 匹配 |
| `src/features/subscriptions/components/subscriptions-table.tsx` | 修改 | placeholder → `'搜索订阅名称、地址或客户名称…'` |
| `src/features/subscriptions/components/subscriptions-table.test.tsx` | 修改 | 新增「placeholder 属性值」与「防抖后 q 参数」两组断言（8→10） |
| `server/scripts/smoke.ts` | 修改 | 新增两项冒烟（按客户名搜到订阅 / 不存在关键字返回 0 条）；文件头补 TASK-049 行 |
| `docs/technical/api-contract.md` | 修改 | 订阅资源处补 `q` 匹配字段说明一行 |

---

## Tests

```yaml
命令: CI run 40107879780（install-lint-build 内含 pnpm test 全量 + eslint/prettier/tsc）；冒烟对照运行（快照库隔离）；订阅表单文件浏览器单测
结果: 交付方声称全绿；冒烟分支轮 154 通过 / 7 失败 vs 基线轮 152 通过 / 7 失败（失败集逐字相同）
覆盖: AC-1~AC-7 与 Requirement 1~5（交付方声明，见 TASK.md Current State 与 HANDOFF-002）
未覆盖: 7 项存量失败的修复（范围外，建议单开任务）；客户页反向搜索（Non-Scope）
```

> ⚠️ 以上是**交付方声称 + 主控位已核实**的结论。你的职责是**独立复跑**：
> 凡「声称已做某事」的条目，一律以实跑命令原文为准。

---

## Known Issues

1. **7 项存量冒烟失败（非本任务引入）**：根因是 TASK-046 把生效上限改为
   `trafficManualCap ?? 套餐月流量`，而 `smoke.ts:733-742` 的客户 A/B 不设
   `trafficManualCap`/`planId` ⇒ `effectiveCustomerTrafficTotal(null, null)` 返回 null
   被 `continue` 跳过、永不评估。主控位已认可「不修」的范围边界（修它超出 File Scope
   且触及 TASK-013 断言语义）。**你须独立复核该根因判定与「非回归」定性**（见 1.4）。
2. **A3 审查记录断档**：TASK-042~048 均无 I2 独立审查记录（已登记为既有债务）。
   本任务是断档后**第一份** I2 记录，其质量直接决定后续任务的审查基线，
   请按最高标准执行。
3. **仓库外陈旧日志（M-1，待整改）**：`E:/AiData/task049-server.log` 记录了一次
   「已注册 6 个订阅同步任务」的作废启动，与真实库现值（4 个启用订阅）不符；
   整改要求重命名加注（见 1.9）。

---

## Remaining Work

### 第 0 步 · 前置条件检查（不满足则停止，不得开始审查）

整改提交（HANDOFF-003 的产出）必须先于你入库。执行：

```bash
cd E:/NDLDSN-WORKSPACE/projects/shadcn-admin
git fetch origin
git log --oneline origin/main..origin/feat/TASK-049-subscription-search-customer-name
git merge --ff-only origin/feat/TASK-049-subscription-search-customer-name   # 本地落后时仅快进
gh pr view 24 --json state,mergeStateStatus --jq '{state, mergeStateStatus}'
grep -c '^- \[ \]' tasks/review/TASK-049-subscription-search-customer-name/TASK.md        # 期望 0
grep -n '原措辞' tasks/review/TASK-049-subscription-search-customer-name/TASK.md         # 期望有输出
git ls-files tasks/review/TASK-049-subscription-search-customer-name/handoffs/           # 003/004/审查记录应已跟踪
```

**判据：** 分支相对 `origin/main` ≥2 提交（`fe680d3` + `docs(TASK-049)` 整改提交）；
AC 复选框全部已勾；AC-3 含「原措辞」引用；HANDOFF-003、本文件（HANDOFF-004）与
`2026-10-26-coordinator-review.md` 均为**已跟踪**文件；`mergeStateStatus` 为 `CLEAN`。

**任一不满足 ⇒ 停止**，向派单方（人类 / 主控位）如实报告「前置条件不满足」及缺失项，
不得在未整改状态上开始第 1 轮（在未整改状态上出具的审查结论无效）。
`mergeStateStatus` 非 `CLEAN` 同样上报，**不得自行 rebase 或强推**。

### 第 1 轮 · 全量只读审查

> 纪律：**全部结论以实跑命令原文为准**，不采信任何交接记录 / 提交信息 / 档案自述。
> 每条结论必须附命令原文或代码行号。

**1.1 纯度自检与声明**

- 自检：本实例未参与本任务设计 / 实施 / 整改；开工前未读过实现代码
  （`git diff origin/main -- server/src src/` 未执行过）。
- 在审查记录首节写入纯度声明（两级分开判定：框架基线 + 本任务加严），
  体例参照 `tasks/done/TASK-040-customer-renewal/handoffs/2026-10-16-review.md`。

**1.2 环境自检与基准确认**

- 分支 / HEAD / 远端 tracking 一致性；`gh pr view 24`（state、mergeStateStatus、
  提交清单）；head 上 CI 双检查状态（`gh pr checks 24`，记 run id 与 headSha）。

**1.3 代码层（读 HEAD 上的实际代码，不读 diff 描述）**

1. `server/src/lib/crud.ts` 列表处理器：`searchCols` like 与钩子条件 OR 后作为
   **单一**条件进入 AND 链（若拆成多个 `push`，AND 优先级会退化为「必须同时命中」）。
2. `server/src/routes/resources.ts`：`exists()` 的关联条件
   `eq(customers.id, subscriptions.customerId)` 在位（漏掉即恒真）。
3. 关键字全走 drizzle 参数绑定，无裸 SQL 拼接、无注入面。
4. 不传 `searchCondition` 的 5 个资源行为不变：`grep -n 'searchCondition' server/src/routes/resources.ts`
   应只见订阅一处；确认可选字段 + `matches.length > 0` 兜底使无钩子时与原代码等价。
5. `q` 的 trim 与空值行为（空 `q` 不产生任何条件、不清空其他筛选）。

**1.4 功能层 AC-1 / AC-2 / AC-3（冒烟复跑，快照隔离）**

> 快照纪律（Task Rules）：只读源库、只写 `E:/AiData/`，**用独立文件名**
> （不得覆盖交付方 / 主控位的取证产物），禁止向 `server/data/app.db` 写入。

```bash
# ① 独立快照：复制 E:/AiData/task049-snapshot.cjs 为 E:/AiData/task049-snapshot-i2.cjs，
#    把 DEST 改为 E:/AiData/task049-snapshot-i2.db 后运行（只读源库、只写 E:/AiData/）
pnpm build:shared
# ② 起服务（调度器保持启用——禁设 ENABLE_SCHEDULER=false，会破坏 TASK-021 jobs 断言；
#    mock 基址按 server/scripts/smoke.ts 文件头说明设置，否则多 4 项通知失败属环境差异）：
cd server && DATABASE_URL=E:/AiData/task049-snapshot-i2.db PORT=3002 \
  TELEGRAM_API_BASE=http://127.0.0.1:3998 FEISHU_API_BASE=http://127.0.0.1:4000 \
  node --import tsx src/index.ts        # 以后台任务运行，审查结束后停掉
# ③ 另开终端跑冒烟：
SMOKE_BASE_URL=http://127.0.0.1:3002 pnpm --filter server smoke
```

- **AC-1**：新增项「按客户名称关键字搜索订阅（q 匹配绑定客户名称）」✓
  （订阅自身名称 / 地址均不含该客户名片段，命中只能来自客户名匹配）。
- **AC-2**：新增项「按不存在的关键字搜索订阅返回 0 条」✓（防搜索条件恒真）。
- **AC-3（整改后措辞）**：失败集与基线**逐字相同**、无新增失败、无既有项由绿转红。
  基线取证：`E:/AiData/task049-smoke-baseline.log`（152/7）。
  计数可能因快照时点漂移——**判据是失败项名称集合相同**，不是计数相同。
- **根因独立复核**：读 `server/src/services/traffic-threshold.ts`（生效上限口径）与
  `server/scripts/smoke.ts:733-742`（A/B 载荷），自行判定 7 项失败是否确与
  TASK-046 语义漂移有关、是否确非本任务引入。辅证：本任务 diff 不触及
  `traffic-threshold.ts` 与阈值段（`git diff origin/main --name-only` 核对）。

**1.5 功能层 Requirement 2 / 3（快照库上的定向 API 复核）**

在 1.4 已启动的服务上操作（快照库可写；留命令原文与判据）：

- **未绑定客户不被客户名命中**：建一条 `customerId` 为 null 的订阅
  （`POST /api/subscriptions`，载荷参照 `smoke.ts` 既有创建段），以该订阅**名称片段**
  搜 ⇒ 命中；以某客户名片段搜 ⇒ 不命中该订阅。
- **q 与筛选叠加为 AND**：同一 `q`（客户名片段）叠加一个**不匹配**的 `customerId`
  ⇒ 0 条；叠加匹配的 `customerId` ⇒ 命中。

**1.6 AC-4（单测复跑）**

```bash
pnpm exec vitest run --browser.headless src/features/subscriptions/components/subscriptions-table.test.tsx
```

期望 10/10。若本地浏览器不可用，如实披露「由 CI 的 `install-lint-build` 作业代行」
并引 run id——**不得假装本地跑过**。

**1.7 AC-5 / AC-6 / AC-7（门禁与工作区）**

- `pnpm exec eslint <5 个改动文件>`；`pnpm exec prettier --check <同 5 文件>`；
  `pnpm exec tsc -b`；`pnpm --filter server typecheck`（或引 CI 同作业 run id）。
- `python scripts/audit-repo.py`（本机 `python` 缺 PyYAML 时部分检查 SKIP，属环境差异，
  以 CI `audit` 作业为准——须如实披露）。
- `git status --short` 仅含 File Scope 内文件与任务档案自身；`git diff --check`
  （行尾 / 空白）干净。

**1.8 交付完整性层（档案一致性，DoD）**

- `TASK.md`：AC 复选框与 `Current State` 一致；`Changed Files` 与实际 diff 一致；
  `Handoff` 表已登记 003（coordinator→implementer）与 004（coordinator→reviewer）行；
  `Next Action` 指向未完成动作（I2 审查 / 人类授权）。
- `Known Issues` 第 1 条已登记「AC-3 措辞经主控位审查修订」这一元事实。
- `Notes` 技术论断与代码事实相符（exists vs LEFT JOIN、钩子位置、负向用例必要性、
  LIKE 大小写 / 通配符属既有行为）。
- KI-11：整改提交与审查记录 / 交接文件**同批**（`git show --stat <整改提交>` 核对：
  应只见 `TASK.md` 与 handoffs 文件，**零代码改动**）。

**1.9 整改验证（HANDOFF-003 四项）**

- **B-1（阻断项）**：AC-1/2/4/5/6/7 已勾；AC-3 为审查记录给定的**原文照抄**版本
  （含「原措辞」引用与「基线」字样）；`Known Issues` 第 1 条末尾有修订事实登记。
- **M-1（仓库外）**：`E:/AiData/task049-server.log` 已重命名为
  `task049-server-aborted-dirty-start.log` 且首行有作废注记。
- **M-2**：`Current State` 的「同快照库」已改为「同源快照（各自从
  `server/data/app.db` 全新生成）」。
- **M-3（可选）**：Handoff 表 002 行行尾空格。

**1.10 审查记录自身审查（字面量复现）**

`2026-10-26-coordinator-review.md` 自身也在被审范围。抽查其引用的字面量：

| 引用 | 复现方法 |
|------|---------|
| `fe680d3`（full `fe680d331e749c360903fde58adaf699d0f770a2`） | `git cat-file -t <sha>` |
| run `40107879780` 双绿、headSha = fe680d3 | `gh run view 40107879780 --json headSha,conclusion` |
| `crud.ts:157-166` / `resources.ts:111-127` | 读行，确认与所述一致 |
| `traffic-threshold.ts:90-94` / `smoke.ts:733-742` | 读行，确认根因陈述成立 |
| 真实库 max id：订阅 79 / 客户 85 | 只读查询 `server/data/app.db` |
| 快照 id 序列 80–90 / 86–99 | 只读查询 `E:/AiData/task049-snapshot.db` |
| 冒烟日志 152/7 与 154/7 | 读 `E:/AiData/task049-smoke-{baseline,branch}.log` 尾部计数 |

### 第 2 轮 · 定向复跑

- 对第 1 轮**全部结论**与**全部整改点**逐条复跑，确认「审查本身未引入新误差」、
  整改未引入回归（整改为纯档案改动，`git show --stat` 已核）。
- 第 1 轮若有失败 / 存疑项，第 2 轮必须给出最终裁定。

### 产出

写入 `tasks/review/TASK-049-subscription-search-customer-name/handoffs/YYYY-MM-DD-review.md`
（日期 = **结论出具日期**；与本派单同日则为 `2026-10-26-review.md`）。结构：

1. 性质声明（I2；与主控位记录不得相互替代）；
2. 审查位自证（纯度声明，两级分开判定）；
3. 第 1 轮（全量 · 只读）——逐节附命令原文；
4. 第 2 轮（定向）——复跑记录；
5. 结论：**PASS**（无阻断项）或 **CHANGES_REQUESTED**（阻断项清单 + 理由 +
   建议处置）；次要项列 M-1 / M-2…（不阻断但须登记）。

**PASS 判据（全部满足）：** AC-1~AC-7 独立验证通过（含 AC-3 整改后措辞的判定）；
Requirement 1~5 无回归；B-1 / M-1 / M-2 整改到位（M-3 未做记次要项）；
审查记录字面量全部可复现；无新增失败、无既有项由绿转红。

### 禁区（硬约束）

- **不修改**任何仓库文件——唯一可写的是你自己的审查记录文件。
- **不提交、不推送、不 rebase、不合并**（推送到任务分支是执行位独占动作，
  `.agents/protocols/dual-agent-model.md` §6）。写完记录即停下。
- 不向 `server/data/app.db` 写入；快照只写 `E:/AiData/` 且用独立文件名。
- 不替执行位修订档案，不替主控位下合并结论。

---

## Assumptions

1. 你是在**整改提交入库之后**被派发的（第 0 步验证；不满足时流程见上）。
2. 你与实现 / 设计 / 整改三个会话均无上下文共享；若曾以任何身份参与本任务，
   立即停止并上报（I2 不可在同一任务内自我满足）。
3. 本地环境与 CI 存在已知差异（本机 `python` 无 PyYAML ⇒ 审计部分 SKIP），
   以 CI 为准并如实披露，不得视为失败。
4. 冒烟复跑使用独立快照（`task049-snapshot-i2.db`），与既有取证产物无冲突；
   真实库自任务启动以来未变（订阅 max id 79 / 客户 85）——若第 0 步发现真实库
   已变，计数漂移属环境事实，按「失败项名称集合相同」判据执行。

---

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 前置条件不满足即开工 | 出具无效审查结论 | 第 0 步硬门槛 + 明令停止 |
| 冒烟复跑污染真实库 | 违反 Task Rules | 只读源库快照 + 独立文件名 + 明令禁止写 `app.db` |
| 审查记录与主控位记录混淆 | 两级审查命名分区失效 | 记录文件名与性质声明照 §3.2；本派单已声明不得相互替代 |
| 浏览器单测本地不可用 | AC-4 无法本地复跑 | 如实披露由 CI 代行 + 引 run id，禁假装 |
| 7 项存量失败被误判为回归 | 错误阻断合并 | 根因独立复核（1.4）+ 失败项名称集合判据 |
| 整批整改夹带代码改动 | 审查范围漂移 | `git show --stat` 核对零代码改动（1.8） |

---

## Next Action

**接收方（独立审查位）的第一个具体动作：**

执行第 0 步前置条件检查（命令见上「Remaining Work → 第 0 步」）。

- 全部满足 ⇒ 写入纯度声明，开始第 1 轮 1.1 / 1.2；
- 任一不满足 ⇒ **停止**，向派单方报告「前置条件不满足」及缺失项，
  不得开始第 1 轮。

审查完结后的流向（由主控位执行，你无需动作）：记录由执行位合批入库
（下一个 HANDOFF）→ PASS 则交人类授权合并（`Requires Human Approval: true`，
由主控位 `gh pr merge --rebase`）；CHANGES_REQUESTED 则执行位再整改，
视情况安排下一轮审查。

---

## References

- 任务档案（唯一事实来源）：`tasks/review/TASK-049-subscription-search-customer-name/TASK.md`
- 主控位第一轮审查记录（12 项核实）：`tasks/review/TASK-049-subscription-search-customer-name/handoffs/2026-10-26-coordinator-review.md`
- 整改派单：`tasks/review/TASK-049-subscription-search-customer-name/handoffs/HANDOFF-003-coordinator-to-implementer.md`
- 交付交接：`tasks/review/TASK-049-subscription-search-customer-name/handoffs/HANDOFF-002-developer-to-reviewer.md`
- I2 体例先例：`tasks/done/TASK-040-customer-renewal/handoffs/2026-10-16-review.md`
- 规范：`.agents/protocols/dual-agent-model.md` §5 / §5.1 / §6、`.agents/protocols/handoff.md` §3.2（两级审查命名）/ §4（必填字段）、`AGENTS.md` §13（DoD）
- PR：https://github.com/huyanluanyuqaq/shadcn-admin/pull/24
