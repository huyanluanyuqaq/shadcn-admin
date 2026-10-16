# TASK-041 — 客户到期时间（`expireAt`）改为必填

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-041
Title: 客户到期时间改为必填（表单 + API 入参双重强制；历史 null 保留、编辑时补填）
Workflow: refactor          # 非新增能力，而是收紧既有字段的契约与校验
Status: DESIGN
Priority: P2
Owner: 主控位（定义与设计已由本会话完成，待执行位认领）
Owner Since: 2026-10-16
Assigned Role: architect（设计，已完成）→ developer（实施，待认领）；审查由不携带实现上下文的新实例承担
Created: 2026-10-16
Updated: 2026-10-16
Branch: refactor/TASK-041-customer-expire-required
Requires Human Approval: true   # 破坏性接口变更：POST /api/customers 由「expireAt 可省略」变「必填」；
                                # 且编辑历史 null 客户时不能再「原样保存」
```

> **状态与目录的对应关系**（变更 Status 时须同步移动目录）：
>
> | Status | 目录 |
> |--------|------|
> | `BACKLOG`, `READY` | `backlog/` |
> | `ACTIVE`, `DESIGN`, `BLOCKED`, `CHANGES_REQUESTED`, `TEST_FAILED`, `REQUIREMENT_CHANGED` | `active/` |
> | `REVIEW` | `review/` |
> | `DONE` | `done/` |
>
> **本任务当前为 `DESIGN`（`active/`）：** 设计阶段（Architect）产物已定稿并落盘。
> **但因存在未满足的 `blocks` 依赖（TASK-040 未合并），本任务不得进入 `ACTIVE`。**

> **编号说明：** 本仓库序号 001–037 已占用，038 为模板仓库任务，039 为框架接入任务
> （在 `tasks/review/`），**040 为客户续期任务**。本任务取 **041**。

---

## Objective

把客户到期时间 `Customer.expireAt` 从**可省略**变为**必填**：

- 新建/编辑客户时**必须**给出到期时间（或由「购买时间 + 套餐档位」自动算出）；
- 接口层**不允许**再创建 `null`，也**不允许**把已有到期时间清空；
- 已存在且为 `null` 的历史客户**保留原值**，但一旦打开编辑并保存即须补填。

**判定标准：** ① 新建客户不填到期时间 → 保存被拦并显示「请选择到期时间」；
② `POST /api/customers` 不带 `expireAt` → **400**；③ `PATCH /api/customers/:id` 传
`{ expireAt: null }` → **400**；④ 历史 `null` 客户打开编辑 → 不补填无法保存。

---

## Background

**人类指令（2026-10-16）：** 「到期时间改必填」

**来龙去脉：** 本任务是 TASK-040（客户续期）两次裁定的直接延续：

1. TASK-040 rev3 人类裁定「没有长期有效的选项 不需要」——不再把「无到期约束」视为
   客户的合法业务状态；
2. 主控位当时**未按主张采信**，而是实查确认 `expireAt === null` **确实是可达状态**
   （新建表单默认 `null`、编辑表单留空即「长期有效（留空）」、列表显示「长期」），
   并如实披露：该裁定的实际效果是「这类客户续期后由无约束变为有限期」，登记为 TASK-040 的 L8；
3. 主控位随即指出该状态的产生端（客户编辑表单的占位与清除按钮）**不在 TASK-040 范围内**，
   若产品要取消该状态须另立任务；
4. 人类据此裁定：**「到期时间改必填」** ⇒ 本任务。

**人类裁定（2026-10-16，三项，均以三选一形式作出）：**

| # | 问题 | 裁定 |
|---|------|------|
| 1 | 强制层级 | **表单 + API 入参**（不落数据库） |
| 2 | 历史 `null` 数据 | **保留、不回填**；编辑时补填 |
| 3 | 任务归属 | **另立 TASK-041**（不并入 TASK-040） |

**设计产物（本任务的设计阶段成果，权威）：**

- `docs/technical/customer-expire-required.md` —— 强制层级、界面与交互、历史数据处理、
  测试要求（**实施依据**）
- `docs/decisions/ADR-005-customer-expire-required.md` —— 强制层级与历史数据决策
  （`Status: Accepted`；**D-1 / D-2 / D-3 三项均已由人类裁定或追认生效**）

**实查事实（决定本任务范围的关键结论，证据见设计文档 §2 的 F1–F12）：**

1. 写入入参 `customerInputSchema.expireAt` 现为 `z.number().int().nullable().optional()`
   （`shared/src/schema/entities.ts:94`），**创建与更新共用同一 schema**
   （`server/src/lib/crud.ts:197` 用 `safeParse`；`:224` 用 `(input as any).partial()`）。
2. **输出 schema 由输入 schema 派生**：`customerSchema = customerInputSchema.extend({...})`
   （同文件 `:108`）、`Customer = z.infer<typeof customerSchema>`（`:114`）
   ⇒ 只改输入会让 `Customer.expireAt` 的类型**说谎**（声称非空，而历史行运行时为 `null`）
   ⇒ **必须**在输出 schema 中显式覆写。
3. 数据库列 `expire_at` 可空（`server/src/db/schema.ts:76`，建表迁移 `server/drizzle/0000`）
   ⇒ 人类裁定不回填 ⇒ **本任务不写迁移**。
4. 表单 schema 以 `customerInputSchema.omit(...).extend({ expireAt: z.date().nullable(), ... })`
   构成（`src/features/customers/data/schema.ts:59-110`）；`emptyCustomerForm()` 默认 `null`（`:121`）。
5. 表单**确实**接 `zodResolver(customerFormSchema)`
   （`customers-action-dialog.tsx:157`）⇒ 字段级 refine 即可拦住保存并渲染提示。
6. 界面两处 `null` 产生点：占位文案「长期有效（留空）」（`:687`）与「清除到期时间」按钮
   （`:1032-1039`，`form.setValue('expireAt', null)` 在 `:1035`）；日历 `onSelect(date ?? null)`
   （`:699-700`）允许再次点击已选日期以取消选择。
7. **冒烟脚本有 10 处创建客户不带 `expireAt`**（`server/scripts/smoke.ts` 行
   660 / 734 / 762 / 783 / 907 / 960 / 1005 / 1044 / 1080 / 1116）
   ⇒ 若只改 schema 而不改脚本，`smoke` 必红。
8. **zod 4.3.6 实测（本会话探针）**：对含**对象级** `.refine()` 的 schema，
   `.partial` 仍是 `function`、`instanceof z.ZodObject` 仍为 `true`，但**调用即抛**
   `Error: .partial() cannot be used on object schemas containing refinements`
   ⇒ 若把校验写成对象级 refine，**每一次 PATCH 都会失败**。
9. **订阅实体是同款可空模式**（`entities.ts:157`；其编辑表单与列表同样有「长期有效（留空）」/
   「长期」/清除按钮），但其 `expireAt` 由**同步引擎**写入
   （`server/src/services/subscription-sync.ts`）⇒ **本任务不动**，且须在文档中明示
   「两实体语义不同」，以免审查者误判为漏改。
10. TASK-040 的设计文档以「新建表单默认 `null`」作为 `expireAt === null` 的**可达性证据**
    （其 F13 / L8 / §3.4）⇒ 本任务落地后该表述**滞后**，须补 1 行注记（范围严格限于注记）。

**前置依赖：** TASK-040 **必须先合并**。TASK-040 的续期对话框对 `expireAt === null` 有专门分支
（显示 `未设置` + `（自今日起算）`），而本任务改变该状态的可产生性——两者必须**先后**落地。
此外 TASK-040 的首要改动面（工具栏插槽 + 新增续期对话框）与本任务（表单 schema + 编辑对话框）
虽少重叠，仍以「先 040 后 041」串行，避免同一会话持有两条互相影响的在途分支。

**D13-C 承载（`.agents/rules/github.md` §2 豁免）：** 本任务分支须承载 **TASK-040** 的归档回写
（**第七实例**，TASK-040 合并后其 Merge Record 方可回填）。本任务自身为**第八实例的待回写方**
（合并后由下一个任务承载）。

---

## Scope

- 共享层：`customerInputSchema.expireAt` 改为**必填非空**；`customerSchema` **显式覆写**
  `expireAt` 保持 `nullable()`（类型诚实）。
- 表单层：`customerExpireFormSchema` 的 `expireAt` 加**字段级**校验，拒绝 `null`。
- 界面：占位文案改为「请选择到期时间」；**移除**「清除到期时间」按钮；日历加 `required`
  （并实测其是否阻止取消选择；不生效则退化为校验兜底且**如实披露**）。
- 列表：`null` 的文案由「长期」改为「未设置」（决策 D-3，**已由人类于 2026-10-16 追认**）。
- 契约与脚本：`api-contract.md` 更新 `expireAt` 行；冒烟脚本 10 处载荷补**远期** `expireAt`，
  并新增两条契约检查（缺字段 → 400；`{ expireAt: null }` → 400）。
- 测试：表单 schema 用例、对话框用例（历史客户补填 / 新建拦截 / 无清除按钮），
  并**调整**其余保存类用例的夹具（否则被必填拦死，产生假失败）。
- 跨任务文档同步：`docs/technical/customer-renewal.md` 补 **1 行**注记（范围严格限于注记）。
- **按 D13-C 在本分支承载 TASK-040 的归档回写**（`Status → DONE` + Merge Record 七要素 +
  迁 `tasks/review/` → `tasks/done/`），范围仅限 `tasks/**`。

## Non-Scope

- **不改服务端业务代码**（`server/src/**`）：schema 是唯一写入入口，无需旁路守卫。
- **不写数据库迁移**（`server/drizzle/**`）、**不回填历史 `null`**——人类裁定保留历史数据；
  若将来确要消除 `null`，须另立 ADR 重新论证回填口径（ADR-005 方案 B 即其被否记录）。
- **不改订阅实体**（`shared/src/schema/entities.ts:157` 的 `subscriptionInputSchema.expireAt`、
  `src/features/subscriptions/**`）：订阅到期由同步引擎写入，上游可能不返回，
  强制必填会与同步语义冲突。⇒ 订阅页的「长期有效（留空）」与「长期」文案**保持不变**，
  这是**刻意**的，不是漏改。
- **不改** `purchasedAt` / `subscriptionExpireAt` / `trafficTotal` / `trafficManualCap`
  等其余可空字段（含 `purchasedAt` 的日历可清空行为）。
- **不新增依赖**、不改 `package.json` / `pnpm-lock.yaml`。
- **不改 shadcn 原语**（`src/components/ui/**`）、不改 `src/routes/**` / `routeTree.gen.ts`。
- **不对 `customerInputSchema` 使用对象级 `.refine()`**——实测会令 `crud.ts:224` 的 `.partial()`
  抛错（Background 事实 8）。
- **不改动 TASK-040 的任何决策与算法表述**（仅允许补 1 行滞后注记）。
- **不改进 `.agents/**`、`templates/**`**（框架逐字快照只读，`AGENTS.md` §10）。

---

## Requirements

1. **共享入参 schema（`shared/src/schema/entities.ts:94`）**：
   `expireAt: z.number().int().nullable().optional()` →
   `expireAt: z.number({ error: '请选择到期时间' }).int()`。
   ⇒ `POST` 必填非空；`PATCH` 经 `.partial()` 后仍可选，但**传 `null` 被拒**。
   **不得**改为对象级 refine（见 Non-Scope）。
2. **共享输出 schema（同文件 `:108`）**：在 `customerSchema` 的 `.extend({...})` 中
   **显式覆写** `expireAt: z.number().int().nullable()`，保证 `Customer.expireAt` 仍为
   `number | null`（历史行运行时确为 `null`）。
3. **表单 schema（`src/features/customers/data/schema.ts:87`）**：
   `z.date().nullable()` → `z.date().nullable().refine((v) => v !== null, { error: '请选择到期时间' })`。
   保留 `.nullable()` 以使类型与初值诚实；**不得**用「默认一个日期」的方式绕过。
4. **界面（`customers-action-dialog.tsx`）**：
   - `:687` 占位 `长期有效（留空）` → `请选择到期时间`；
   - **移除** `:1032-1039` 的「清除到期时间」按钮（与必填冲突，且是唯一的 `null` 写入入口）；
   - `:699` 日历加 `required`（`react-day-picker@9.14.0` single 模式支持）；保留
     `field.onChange(date ?? null)` 兜底；
   - `:661-674` 的「购买时间 + 档位」自动计算分支**不变**。
5. **列表文案（`customers-columns.tsx:147`）**：`null` 显示由「长期」改为「未设置」（D-3）。
   `daysLeft(null) → null` 的实现（`utils.ts:40-43`）**不得**改动。
6. **冒烟脚本（`server/scripts/smoke.ts`）**：
   - 10 处创建客户载荷补 `expireAt`，**必须用远期**（建议 `Date.now() + 3650 * 86400000`），
     以免注入到期提醒扰动提醒/统计类断言；
   - `:609` 的 `{ name: '' }` 用例保留不动（断言只看状态码 400）；
   - **新增**两条检查：`POST` 缺 `expireAt` → 400；`PATCH` `{ expireAt: null }` → 400。
7. **契约文档（`docs/technical/api-contract.md:144`）**：`expireAt` 由 `number \| null` 改为
   `number`，注明「创建必填；PATCH 传 `null` 被拒（400）；`purchasedAt` /
   `subscriptionExpireAt` 仍可空」。**必须与代码同一次提交**，不得事后补。
8. **跨任务注记（`docs/technical/customer-renewal.md`）**：在 F13 / L8 / §3.4 处补 1 行
   「TASK-041 起：新建/编辑表单不再产生 `expireAt = null`，该状态仅历史数据可达；
   续期 `null` 分支保留为历史数据路径」。**范围严格限于注记**。
9. **测试**（详见设计文档 §7）：
   - 表单 schema：拒绝 `null`（文案「请选择到期时间」）+ 接受合法 `Date`；
     保留 `data/schema.test.ts:121` 的纯函数映射断言并加注释；
   - 对话框：**至少 1 个历史 `null` 客户用例**（不补填 → 被拦；补填 → 保存成功且载荷含新值）、
     新建不选到期时间 → 被拦、「清除到期时间」按钮不存在；
     **其余保存类用例的夹具改为带 `expireAt`**（避免被必填拦死产生假失败）；
   - **不得**为让既有用例通过而放宽校验（删 `.refine()` / 改回 `.nullable()`）。
10. **提交流程**：分支自最新 `main`（**须已含 TASK-040 的合并**）派生；footer 含 `Refs: TASK-041`；
    **显式路径 `git add`**（禁 `git add -A` / `.`）；CI 必需检查 `install-lint-build` + `audit` 双绿。
11. **独立审查**：由**不携带实现上下文的新实例**执行（第 1 轮全量 + 第 2 轮定向），
    审查记录落 `handoffs/`；实现者不得自我批准（I2，受保护）；审查须**实跑**命令验证（§8 纪律）。
12. **D13-C 承载**：本分支同时承载 TASK-040 归档回写（范围仅 `tasks/**`），
    并在本任务 `Merge Record` 中标注「待下一个任务回填（第八实例）」。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 不新增依赖；校验**只能加在字段级**——对 `customerInputSchema` 加对象级 `.refine()` 会使 `crud.ts:224` 的 `.partial()` 抛错（zod 4.3.6 实测），令 PATCH 全挂 |
| 技术 | 输出 schema 必须**显式覆写** `expireAt`；不得因「输入已必填」就默认输出也必填 |
| 兼容 | **破坏性接口变更**：`POST /api/customers` 由「`expireAt` 可省略」变「必填」；仓库内调用点已穷举（10 处冒烟载荷），`api-contract.md` 必须同提交更新 |
| 兼容 | **不得**改动 `purchasedAt` / `subscriptionExpireAt` 的可空性；**不得**改订阅实体（两实体语义不同，见 Non-Scope） |
| 数据 | 不写迁移、不回填历史 `null`（人类裁定）；读取路径（`daysLeft` / `splitPlanCycles` / `isNotNull` 过滤）**不得**因「null 不再产生」而删去判空 |
| 语义 | 历史 `null` 客户编辑时**必须**补填（刻意代价，登记 L1）；不得为「放行」而放宽校验 |
| 安全 | 不引入任何密钥；`scripts/audit-repo.py` 的明文密钥扫描（A7）须保持 PASS |
| 流程 | I2：实现者 ≠ 批准者；`Requires Human Approval: true`（破坏性契约变更），合并需人类显式授权；D13-C：回写并入本任务交付请求 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| **TASK-040（客户续期）** | **blocks（本任务依赖它先合并）** | **未完成**（`Status = DESIGN`，待执行位实施） |
| TASK-040 归档回写（D13-C 第七实例） | 随本分支承载 | 待 TASK-040 合并后实查回填 |
| GitHub 分支保护 + CI（`install-lint-build` / `audit`） | external | 已配置（2026-10-14 起，`AGENTS.md` §14.4） |

> **存在未满足的 `blocks` 依赖 ⇒ 本任务不得进入 `ACTIVE`。** 执行位须先确认 TASK-040 已合并
> （`gh pr view <n> --json state,mergedAt,mergeCommit` 与 `git merge-base --is-ancestor`），
> 再从最新 `main` 派生分支。

---

## Acceptance Criteria

- [ ] AC-1: 表单层：`expireAt: null` 被校验拒绝且提示文案为「请选择到期时间」；合法 `Date` 通过。
- [ ] AC-2: API 入参层：`POST /api/customers` 缺 `expireAt` → **400**、带合法值 → 201；
      `PATCH` 省略 `expireAt` → 200（部分更新仍可用）；`PATCH` 传 `{ expireAt: null }` → **400**。
- [ ] AC-3: 输出层：`customerSchema` 的 `.extend({...})` 中**显式覆写** `expireAt` 为
      `z.number().int().nullable()`；`Customer.expireAt` 的类型仍为 `number | null`（走查 + `tsc` 为证）。
- [ ] AC-4: 界面：占位为「请选择到期时间」；「清除到期时间」按钮**不存在**；
      「购买时间 + 档位」自动计算分支行为不变。
- [ ] AC-5: 日历 `required` 的**实测结论已记录**：要么确实阻止取消选择，要么退化为
      「可落到 `null` 但被校验拦住」并**如实披露**——二选一，不得含糊或写成「UI 上无法清空」。
- [ ] AC-6: 历史 `null` 客户打开编辑即为无效初值：不补填 → 保存被拦；补填 → 保存成功且
      `mutateAsync` 载荷含新的 `expireAt`（有对应用例）。
- [ ] AC-7: 列表 `null` 文案为「**未设置**」（D-3，已由人类追认）；`daysLeft` 实现与
      `splitPlanCycles` 的判空逻辑**未改**。
- [ ] AC-8: `server/scripts/smoke.ts` 10 处载荷补**远期** `expireAt`；新增两条契约检查
      （缺字段 400 / 传 `null` 400）；`pnpm --filter server smoke` 全绿。
- [ ] AC-9: 测试按设计文档 §7 落地并实测通过；**未**放宽校验（以用例名与断言行核对，非通过率）。
- [ ] AC-10: `api-contract.md` 的 `expireAt` 行已更新（与代码同提交）；
      `customer-renewal.md` 的跨任务注记已补且**仅有注记**（以 diff 为证）。
- [ ] AC-11: 未改动 `server/src/**`、`server/drizzle/**`、`src/features/subscriptions/**`、
      `src/components/ui/**`、`package.json`、`pnpm-lock.yaml`（以 diff 为空为证）。
- [ ] AC-12: `pnpm build:shared && pnpm lint && pnpm format:check && pnpm build && pnpm test`
      全部本地通过（若浏览器不可用则如实披露由 CI 执行）；`python3 scripts/audit-repo.py` 全 PASS。
- [ ] AC-13: 分支已推远端；交付请求创建且描述覆盖模板全部字段；CI `install-lint-build` + `audit`
      双绿（run id 留痕，含「合并门禁以合并时点 head 的 run 为准」防腐注）。
- [ ] AC-14: 两轮独立审查记录落 `handoffs/`，阻断项关闭并经实跑复核；实现者未自我批准。
- [ ] AC-15: TASK-040 归档回写完成（`Status = DONE` + Merge Record 七要素 + 迁 `tasks/done/`），
      且本任务 `Merge Record` 已标注「待下一个任务回填（D13-C 第八实例）」。

---

## File Scope

```yaml
File Scope:
  - shared/src/schema/entities.ts                                       # 入参必填 + 输出覆写
  - src/features/customers/data/schema.ts                               # 表单字段级 refine
  - src/features/customers/data/schema.test.ts                          # 增补用例
  - src/features/customers/components/customers-action-dialog.tsx       # 占位/移除清除按钮/日历 required
  - src/features/customers/components/customers-action-dialog.test.tsx  # 用例调整与增补
  - src/features/customers/components/customers-columns.tsx             # 仅 null 文案（D-3）
  - server/scripts/smoke.ts                                             # 仅测试脚本（载荷 + 两条检查）
  - docs/technical/api-contract.md                                      # 契约字段更新
  - docs/technical/customer-expire-required.md                          # 本设计（补实现状态与锚点）
  - docs/technical/customer-renewal.md                                  # 仅 1 行跨任务注记（滞后修正）
  - docs/decisions/ADR-005-customer-expire-required.md                  # 状态与授权记录
  - tasks/active/TASK-041-customer-expire-required/**                   # 任务档案与交接
  - tasks/review/TASK-040-customer-renewal/**                           # D13-C 回写（仅 tasks/**）
  - tasks/done/TASK-040-customer-renewal/**                             # D13-C 归档迁入
Non-Scope (files):
  - server/src/**                    # 服务端业务零改动
  - server/drizzle/**                # 不写迁移（人类裁定不回填）
  - src/features/subscriptions/**    # 订阅实体不动（同步引擎维护）
  - src/components/ui/**             # shadcn 原语禁改
  - src/routes/**  src/routeTree.gen.ts
  - package.json  pnpm-lock.yaml  .github/**
  - .agents/**  templates/**         # 框架逐字快照只读
```

---

## Implementation Plan

> 设计已由主控位完成；下列步骤为**执行位**的实施顺序（可细化，但不得改变设计文档 §3 的
> 两条硬约束与 §9 的 D1–D8 决策）。

| # | 步骤 | 产出 |
|---|------|------|
| 1 | 读本文件 + `docs/technical/customer-expire-required.md` + ADR-005 + `AGENTS.md` §6/§10/§13；确认工作区状态 | 已读清单 |
| 2 | **前置校验**：确认 TASK-040 已合并（`gh pr view` + `git merge-base --is-ancestor`）；自最新 `main` 派生 `refactor/TASK-041-customer-expire-required`；显式 `git add` 提交**主控位已落盘的设计产物**（本档案 + handoff + 2 份 docs），footer `Refs: TASK-041` | 分支 + 首个提交 |
| 3 | `shared/src/schema/entities.ts`：入参改必填 + 输出显式覆写 ⇒ `pnpm build:shared` | 共享层 |
| 4 | `src/features/customers/data/schema.ts`：字段级 refine | 表单层 |
| 5 | `customers-action-dialog.tsx`：占位文案、移除清除按钮、日历 `required`（并实测其行为） | 界面 |
| 6 | `customers-columns.tsx`：`null` 文案改「未设置」（D-3，已由人类追认） | 列表 |
| 7 | `server/scripts/smoke.ts`：10 处补**远期** `expireAt` + 新增两条契约检查；跑 `pnpm --filter server smoke` | 契约证据 |
| 8 | 测试：表单 schema 用例 + 对话框用例（历史客户 / 新建 / 无清除按钮）+ **调整其余保存类夹具** | 测试 |
| 9 | 本地验证：`pnpm build:shared && pnpm lint && pnpm format:check && pnpm build && pnpm test` + `python3 scripts/audit-repo.py` | 原始输出 |
| 10 | 文档：`api-contract.md` 更新 + `customer-renewal.md` 1 行注记；回填档案（Current State / Changed Files / Known Issues）→ 迁 `tasks/review/`（`Status = REVIEW`）→ 推送 → 创建交付请求（含 D13-C 回写提交） | PR |
| 11 | 两轮独立审查 + 整改（整改后须再审一轮定向） | handoffs |
| 12 | 人类授权后 rebase-merge → 合并后 CI 验证 + D8 复现 → TASK-040 回写完成 → 本任务 Merge Record 标注待回填 | main |

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 / AC-9 | 测试 | `pnpm test`（用例名须对应设计文档 §7.1/§7.2） |
| AC-2 / AC-8 | 命令 | `pnpm --filter server smoke`；核对新增两条检查的名称与断言 |
| AC-3 | 走查 + 类型 | `grep -n "expireAt" -A2 -B2 shared/src/schema/entities.ts`；确认 `.extend({...})` 内覆写在场；`pnpm build:shared` 通过 |
| AC-4 / AC-5 | 测试 + 实测 | 断言清除按钮不存在；**实跑**确认日历 `required` 的实际行为并写入交付说明 |
| AC-6 | 测试 | 历史 `null` 客户的对话框用例（不补填被拦 / 补填成功） |
| AC-7 | 命令 + 走查 | `grep -n "未设置" src/features/customers/components/customers-columns.tsx`；`git diff` 确认 `utils.ts` 未改 |
| AC-10 | 命令 | `git diff --stat -- docs/technical/`；确认 `customer-renewal.md` 的改动仅 1 行注记 |
| AC-11 | 命令 | `git diff origin/main --stat -- server/src server/drizzle src/features/subscriptions src/components/ui package.json pnpm-lock.yaml`（预期无输出） |
| AC-12 | 命令 | `pnpm build:shared && pnpm lint && pnpm format:check && pnpm build && pnpm test`；`python3 scripts/audit-repo.py` |
| AC-13 | 命令 | `gh pr checks <n>`；run id 记入 handoff |
| AC-14 | 人工 | 读 `handoffs/` 两份审查记录，核对其中的**实跑**输出 |
| AC-15 | 命令 + 人工 | `git log --oneline -5`（回写提交在场）；读 `tasks/done/TASK-040-…/TASK.md` 的 Merge Record 七要素 |

---

## Current State

> **2026-10-16 —— 设计阶段完成（主控位 / Architect），尚未实施；因 `blocks` 依赖（TASK-040）
> 未满足，本任务**不得**进入 `ACTIVE`。**
>
> **已完成（本会话）：**
> ① 实查并定盘 12 项设计依据（设计文档 §2 的 F1–F12），其中三项决定性结论：
> 「共享 schema 创建与更新共用」「输出 schema 由输入派生 ⇒ 必须显式覆写」
> 「冒烟脚本 10 处创建客户不带 `expireAt`」；
> ② **实跑 zod 4.3.6 探针**（临时脚本已删，`git status` 已复原），确认三件事：
> 必填中文文案可用（v4 无 `required_error`）；**对象级 refine 会使 `.partial()` 调用即抛错**
> ⇒ 校验只能加在字段级；输出 schema 覆写有效；
> ③ 产出设计文档 `docs/technical/customer-expire-required.md`（§3 三层强制点、§4 界面与交互、
> §5 历史数据处理与跨任务连带影响、§6 契约与冒烟同步、§7 测试要求、§8 五项已知限制、§9 决策 D1–D8）；
> ④ 产出 ADR-005（`Accepted`，含逐项授权记录：**D-1 / D-2 / D-3 三项均已由人类裁定或追认生效**）；
> ⑤ 登记本档案与派遣交接 `handoffs/HANDOFF-001-coordinator-to-implementer.md`。
>
> **人类裁定（本任务设计前）：** ① 强制层级 = 表单 + API 入参；② 历史 `null` 保留、编辑时补填；
> ③ 另立 TASK-041（不并入 TASK-040）。
>
> **设计产物以工作区未提交状态交付**（主控位不创建分支、不提交、不推送——分支创建与提交属执行位职责）。
>
> **未开始：** 全部代码改动、测试落地、冒烟调整、本地验证、推送、审查、合并。
>
> **Next Action（执行位）：** 确认 TASK-040 已合并后自最新 `main` 派生
> `refactor/TASK-041-customer-expire-required` 并提交设计产物，随后从
> `shared/src/schema/entities.ts` 的两处改动开始实施。

---

## Changed Files

> 设计阶段（主控位，未提交）：4 个文件 —— 2 份 docs + 本档案 + 1 份 handoff。
> 实施阶段的代码改动由执行位在本表补充。

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `docs/technical/customer-expire-required.md` | 新增 | 客户到期时间必填设计（权威实现依据） |
| `docs/decisions/ADR-005-customer-expire-required.md` | 新增 | 强制层级与历史数据决策（`Accepted`，逐项授权记录） |
| `tasks/active/TASK-041-customer-expire-required/TASK.md` | 新增 | 本任务档案 |
| `tasks/active/TASK-041-customer-expire-required/handoffs/HANDOFF-001-coordinator-to-implementer.md` | 新增 | 主控位 → 执行位派遣交接 |

---

## Known Issues

> 设计阶段已知限制（与设计文档 §8 的 L1–L5 一一对应）。实施完成后由执行位更新状态
> （保持为「已披露的接受项」或标注「已解决」）。

- **L1 编辑历史 `null` 客户必须补填（刻意代价）**：即使只想改备注，也必须先设一个到期时间。
  这是「必填」的固有含义，**不是缺陷**；**不得**为「放行」而放宽校验或恢复 `null` 路径。
- **L2 保证强度止于 API 层**：数据库列仍可空，直写 DB 或未来绕过 CRUD 的写入仍可置 `null`。
  人类裁定不回填、不迁移；读取路径本就以 `isNotNull` / 判空容忍。
- **L3 类型与入参的表观矛盾**：输出类型保留 `number | null` 而输入必填。
  这是对**历史数据**的忠实表达（D6）；**不得**因「看起来矛盾」而把输出改为必填。
- **L4 订阅实体的 `expireAt` 仍可空、文案仍为「长期有效（留空）」**：其到期由**同步引擎**写入，
  上游可能不返回。**刻意**不改，两实体语义不同；**不得**顺手统一（越界）。
- **L5 无「禁止清空」的专门服务端守卫**：保证仅来自 zod schema。schema 是唯一写入入口
  （`crud.ts`），不为单一字段增设旁路判断。

---

## Merge Record

> **本任务的合并后回写由下一个任务按 D13-C 承载（第八实例）。**
> 合并前留空；本任务合并后应保持 `Status = REVIEW`、留在 `tasks/review/`，
> 并在下一个任务的交付请求中回填下表（七要素）。

| 要素 | 值 |
|------|-----|
| PR | 待回填 |
| 合并策略 | rebase-merge（预期） |
| 提交数 | 待回填 |
| merged_at | 待回填 |
| merge_commit_sha | 待回填 |
| 合并后 CI | 待回填 |
| D8 解耦 | 待回填 |
| 独立审查 | 待回填 |
| SHA 映射 | 待回填 |

---

## D13-C 回填指引（TASK-040，第七实例 —— 由本任务承载）

> 本任务分支须同时完成 **TASK-040（客户续期）** 的归档回写，**范围仅限 `tasks/**`**。
> **前置条件：TASK-040 必须先合并**，否则无 Merge Record 可回填 ⇒ 执行位须以 `gh` **实查**后落笔，
> 不得照抄本表（本表在 TASK-040 合并前无法填出真实值）。

| 要素 | 值（待执行位在 TASK-040 合并后实查） |
|------|--------------------------------------|
| PR | 待实查（`gh pr view`） |
| 合并策略 | 预期 rebase-merge（以 `gh pr view --json mergedAt,mergeCommit` 为准） |
| 提交数 | 待实查（`gh pr view --json commits`） |
| merged_at | 待实查 |
| merge_commit_sha | 待实查 |
| 合并后 CI | 待实查（合并后 push run 的 `install-lint-build` + `audit`） |
| D8 解耦 | 待实查（该 head 是否有 Docker 运行） |
| 独立审查 | 待实查（读 `tasks/review/TASK-040-…/handoffs/` 的审查记录） |
| SHA 映射 | 待实查（rebase-merge 后逐对 `%t` tree 比对） |

**回写动作：** ① `tasks/review/TASK-040-…/TASK.md`：`Status: REVIEW → DONE`、填 Merge Record；
② 目录 `git mv tasks/review/TASK-040-… tasks/done/TASK-040-…`；
③ 该回写作为**独立提交**（footer `Refs: TASK-040`）随本任务分支推送。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | 主控位 | 执行位 | 2026-10-16 | 设计定稿并派遣：交付设计文档 + ADR-005 + 本档案；指令为「先确认 TASK-040 已合并，再派生分支」，从共享 schema 改起 |
| 001r | 主控位 | 执行位 | 2026-10-16 | **D-3 追认同轮同步（仍在同一交接）**：人类追认「列表 `null` 文案改『未设置』」⇒ 撤销分支取消，相关条件式表述（Requirements / AC-7 / Plan 步骤 6 / Notes）全部改为确定项 |

**最新 Handoff：** `handoffs/HANDOFF-001-coordinator-to-implementer.md`
**Next Action：** 执行位确认 TASK-040 已合并（`gh pr view` + `git merge-base --is-ancestor`），
自最新 `main` 派生 `refactor/TASK-041-customer-expire-required`，显式 `git add` 本目录与两份 docs
后提交（footer `Refs: TASK-041`），随后按 Implementation Plan 步骤 3 改共享 schema。

---

## Task Rules

- [补充] 所有 Git 提交 footer 必须含 `Refs: TASK-041`；只用**显式路径** `git add`
  （禁 `git add -A` / `git add .`）。D13-C 回写提交的 footer 用 `Refs: TASK-040`。
- [补充] **禁止**对 `customerInputSchema` 使用对象级 `.refine()`：zod 4.3.6 实测会使
  `crud.ts:224` 的 `.partial()` **调用即抛错** ⇒ 校验只能加在**字段级**（或在表单/输出层）。
- [增强] 这是**破坏性接口变更**：`docs/technical/api-contract.md` 必须与代码**同一次提交**更新；
  冒烟脚本的 10 处载荷为仓库内**全部**创建调用点，须逐一核对（可用 grep 复算行号）。
- [增强] 独立审查按 I2 执行：实现会话不得出具审查结论；审查实例须**实跑**验证命令
  （`pnpm test` / `pnpm --filter server smoke` / `git diff` / 断言用例名），不得仅读描述（§8 框架纪律）。
- [增强] 合并需**人类显式授权**（本任务 `Requires Human Approval: true`）；
  执行位不得自行合并、不得直推 `main`。
- [增强] 本任务附带 D13-C 承载：回写范围**仅限 `tasks/**`**，不得借此夹带其它内容。

---

## Notes

- **设计文档是实施依据，本档案是范围与验收依据。** 两者冲突时以本档案的范围/验收为准，
  以设计文档的交互与校验口径为准；发现冲突须停下并回报主控位，不得自行择一。
- **本任务最容易被实现错的五个点（审查必查）：**
  1. 把校验写成**对象级** `.refine()` ⇒ `crud.ts:224` 的 `.partial()` 抛错，**每一次 PATCH 都失败**
     （zod 4.3.6 实测；这是本任务第一号陷阱）；
  2. 漏改**输出 schema** 的 `expireAt` 覆写 ⇒ `Customer.expireAt` 类型说谎，
     进而有人会「顺手」删掉前端的历史 `null` 分支；
  3. 冒烟脚本 10 处载荷漏补，或用**近期**时间 ⇒ CI 红，或注入到期提醒扰动提醒/统计断言；
  4. **为让既有测试通过而放宽校验**（删 `.refine()`、改回 `.nullable()`、
     把「历史客户必须补填」的用例删掉）—— 这是最需要防的自我欺骗路径；
  5. 顺手把**订阅实体**的 `expireAt` 一起改（越界，与同步引擎语义冲突；见 L4）。
- **D-3（列表 `null` 文案「长期」→「未设置」）已由人类于 2026-10-16 追认生效**（原为 architect
  在人类既定方向内的补充：概念既已废弃，其展示文案不应继续存活）。**无撤销分支**——
  实施按「未设置」执行；若将来要改回，须走新 ADR，不得就地改回 `customers-columns.tsx:147`。
- **本任务不产生新的「长期有效」语义**：实施完成后，`expireAt === null` 仅由**历史数据**产生。
  TASK-040 的续期 `null` 分支**必须保留**（历史数据路径可达），相关注记见 Requirements 8。
- 实施完成后，本档案应补记：实际改动文件清单与统计、测试与冒烟原始输出摘要、CI run id、
  两轮审查结论、日历 `required` 的实测行为、以及 TASK-040 回写的完成证据
  （`git log` 与目标档案路径）。
