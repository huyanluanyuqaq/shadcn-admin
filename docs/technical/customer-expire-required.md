# 客户到期时间必填 —— 设计文档

> **状态：设计已定稿，待实施**（TASK-041）
> 设计者：主控位 / Architect · 2026-10-16
> 关联：`docs/decisions/ADR-005-customer-expire-required.md`（强制层级与历史数据决策）、
> `tasks/review/TASK-041-customer-expire-required/TASK.md`（任务档案，唯一事实来源；
> 实施完成后随 `Status → REVIEW` 由 `tasks/active/` 迁入 `tasks/review/`）
>
> **读者须知：** 本文是**功能设计**（强制层级、界面行为、历史数据处理、测试要求）。
> 不重复 `api-contract.md` 的接口描述，不重复 ADR-005 的决策论证。
>
> **前置任务：** TASK-040（客户续期）**必须先合并**。本任务会改变 `expireAt` 的可空性，
> 而 TASK-040 的续期对话框对 `expireAt === null` 有专门分支——两者必须**先后**落地，
> 不得并行（见 §5.4 的跨任务连带影响）。

---

## 1 目标与一句话语义

把客户到期时间（`Customer.expireAt`）从**可省略**变为**必填**：

- **新建客户**：必须给出到期时间（或选择「购买时间 + 套餐档位」由系统自动算出）。
- **更新客户**：一旦提交，`expireAt` 不得为 `null`；**不允许把已有到期时间清空**。
- **历史数据**：已存在且为 `null` 的客户**保留原值**；但一旦打开编辑并保存，必须补填。

**一句话语义：** 到期时间从此是客户的**必填属性**；`null` 只是历史遗留状态，不再由任何
界面或接口产生。

**可判定的达成标准：** 新建客户不填到期时间 → 保存被拦并显示「请选择到期时间」；
API 直接 `POST /api/customers` 不带 `expireAt` → 400；`PATCH` 传 `{ expireAt: null }` → 400。

---

## 2 设计依据事实

> 全部经实查（文件行号为编写时实测）。F12 为**本会话实跑探针**的结论（临时脚本已删除）。

| # | 事实 | 证据 |
|---|------|------|
| F1 | 写入入参 `customerInputSchema.expireAt` 现为 `z.number().int().nullable().optional()` | `shared/src/schema/entities.ts:94` |
| F2 | **输出 schema 由输入 schema 派生**：`customerSchema = customerInputSchema.extend({...})`，`Customer = z.infer<typeof customerSchema>` | `shared/src/schema/entities.ts:108,114` |
| F3 | 创建走 `input.safeParse(body)`；更新走 `(input as any).partial()` —— **同一个 schema** | `server/src/lib/crud.ts:197,224` |
| F4 | 数据库列 `expire_at` **可空**（`integer('expire_at', { mode: 'timestamp_ms' })`） | `server/src/db/schema.ts:76`；建表 `server/drizzle/0000_minor_paladin.sql:25` |
| F5 | 表单 schema 由 `customerInputSchema.omit(...).extend({ expireAt: z.date().nullable(), ... })` 构成；`emptyCustomerForm()` 默认 `expireAt: null`；`toCustomerForm()` / `toCustomerInput()` 均以 `? :` 映射 `null` | `src/features/customers/data/schema.ts:59-110,121,151,272` |
| F6 | 表单**确实**接 `zodResolver(customerFormSchema)`；默认值 `emptyCustomerForm()`，打开时 `form.reset(currentRow ? toCustomerForm(currentRow) : emptyCustomerForm())`；到期时间字段占位文案「长期有效（留空）」、日历 `onSelect(date ?? null)`；底部有「清除到期时间」按钮（仅 `!autoExpireAt` 时渲染） | `src/features/customers/components/customers-action-dialog.tsx:157,158,164,655-710,687,699-700,1032-1039` |
| F7 | `null` 的展示链路：`daysLeft(null) → null` ⇒ 列表「剩余天数」列显示「**长期**」 | `src/features/customers/utils.ts:40-43`；`customers-columns.tsx:139-158`（文案在 `:147`） |
| F8 | 冒烟脚本有 **10 处** `POST /api/customers` **不带** `expireAt`（行 660 / 734 / 762 / 783 / 907 / 960 / 1005 / 1044 / 1080 / 1116）；带 `expireAt` 的为 441 / 2435；`:609` 是**故意非法**用例（`{ name: '' }`，断言只看状态码 400） | `server/scripts/smoke.ts` |
| F9 | 接口契约文档记载 `expireAt` 为 `number \| null` | `docs/technical/api-contract.md:144` |
| F10 | **订阅实体是同款可空模式**（输入 schema、编辑表单占位「长期有效（留空）」、清除按钮、列表「长期」），但其 `expireAt` 由**同步引擎**写入 | `shared/src/schema/entities.ts:157`；`src/features/subscriptions/components/subscriptions-action-dialog.tsx:474,503`；`subscriptions-columns.tsx:179`；`server/src/services/subscription-sync.ts:143,179,281` |
| F11 | 现有测试：`toCustomerInput(null) → null` 断言；对话框多处 `expireAt: null` 夹具；列表测试亦有 null 夹具（**读取**路径） | `src/features/customers/data/schema.test.ts:121`；`customers-action-dialog.test.tsx:90,132,315,339-340`；`customers-table.test.tsx:55,93` |
| F12 | **zod 4.3.6 实测三条**：① `z.number({ error: '请选择到期时间' }).int()` 对**缺键**与 `null` **都**报 `invalid_type:请选择到期时间`（中文文案可用，v4 已无 `required_error`）；② 对含 `.refine()` 的**对象** schema，`.partial` 仍是 `function`、`instanceof z.ZodObject` 仍为 `true`，但**调用即抛** `Error: .partial() cannot be used on object schemas containing refinements`；③ 字段级 `.refine()` 不改变容器对象类型（`.partial()` 正常），且用 `.extend()` 覆写同名字段有效（`{expireAt: null}` 通过） | 本会话探针（`zod@4.3.6`，脚本已删；`git status` 已复原） |

---

## 3 强制层级：三层分别怎么改

人类裁定：**表单 + API 入参**强制；**数据库列保持可空**（历史 null 保留、不回填）。

| 层 | 位置 | 改动 | 依据 / 理由 |
|----|------|------|------------|
| 表单 | `src/features/customers/data/schema.ts:87` | `z.date().nullable()` → `z.date().nullable().refine((v) => v !== null, { error: '请选择到期时间' })` | 保留 `Date \| null` 类型 ⇒ `emptyCustomerForm()` / `toCustomerForm()` / `toCustomerInput()` 的**类型与实现均不需改**；`zodResolver` 会在提交时拦住并渲染 `FormMessage`（F6、F12-③） |
| API 入参 | `shared/src/schema/entities.ts:94` | `z.number().int().nullable().optional()` → `z.number({ error: '请选择到期时间' }).int()` | POST 必填非空；PATCH 经 `.partial()` 后仍**可选**，但传 `null` **被拒** ⇒「不允许清空」成为契约保证（F3、F12-①） |
| API 输出 | `shared/src/schema/entities.ts:108` | 在 `.extend({...})` 中**显式覆写** `expireAt: z.number().int().nullable()` | **必须**：否则 `Customer.expireAt` 变为 `number`，而历史行运行时返回 `null` —— 类型说谎（F2、F12-③） |
| 数据库 | `server/src/db/schema.ts:76` | **不变** | 人类裁定（ADR-005 D-2）：历史 null 保留 ⇒ 列保持可空，**不写迁移、不回填**（F4） |

**禁止事项（两条硬约束）**

1. **不得**在 `customerInputSchema` 上做**对象级** `.refine()`（例如 `z.object({...}).refine(...)`）。
   理由不是风格问题：`crud.ts:224` 会对同一 schema 调 `.partial()`，而 v4 实测**调用即抛错**
   （F12-②）⇒ **每一次 PATCH 都会 500**。校验只能加在**字段**上，或加在**输出/表单**层。
2. **不得**用「给一个默认日期」的方式绕过校验（例如把表单字段改成 `z.date()` 并在默认值里写
   `new Date()`）。那会把「未设置」静默变成「今天到期」，是语义污染，不是必填实现。

---

## 4 界面与交互

| 项 | 现状 | 改为 |
|----|------|------|
| 字段占位（`customers-action-dialog.tsx:687`） | `长期有效（留空）` | `请选择到期时间` |
| 校验提示 | 无 | `请选择到期时间`（来自 §3 表单层，经 `FormMessage` 渲染） |
| 「清除到期时间」按钮（`:1032-1039`） | 存在（仅 `!autoExpireAt` 时渲染） | **移除**。它与必填直接冲突，且是**唯一的** `null` 写入入口（`form.setValue('expireAt', null)`） |
| 日历选择（`:699-700`） | `field.onChange(date ?? null)`；`mode='single'` 下**再次点击已选日期会取消选择** ⇒ 字段回落 `null` | 给 `Calendar` 传 `required`（`react-day-picker@9.14.0` 的 single 模式支持该 prop；`src/components/ui/calendar.tsx` 将 `...props` 透传给 `DayPicker`），使「清除」在 UI 上不可达；**保留** `?? null` 作为兜底，由校验拦住 |
| 自动计算分支（`:661-674`） | 选了购买时间 + 有档位价格的套餐时，只读展示「购买时间 + 档位天数」 | **不变**（这是必填的合法满足路径之一，界面已给出说明文案） |
| `purchasedAt` 的 `onSelect(date ?? null)` | 可清空 | **不变**（该字段仍可空，不属本任务） |

> **必须实测确认（非阻塞项）：** `required` 在 `mode='single'` 下是否真的阻止取消选择。
> 若不生效或引入行为问题，**允许**退化为「只靠校验兜底」，但**必须**在实现交付中如实披露
> 实际行为（「点击已选日期仍会落到 `null`，由校验拦住」），不得描述成「UI 上无法清空」。

---

## 5 历史 `null` 数据的处理

### 5.1 不回填、不迁移（人类裁定）

数据库列保持可空；不新增迁移；历史 `null` 行**原样保留**。这与 ADR-005 D-2 一致。

### 5.2 编辑历史客户：开放即无效初值，保存前必须补填

`toCustomerForm()`（F5）对 `expireAt === null` 的客户仍返回 `expireAt: null` ⇒ 打开编辑对话框时
表单处于**无效初值**状态。用户点击保存会被 `zodResolver` 拦住并看到「请选择到期时间」，
补填后即可保存。

新建模式同理：`emptyCustomerForm()` 的 `expireAt: null` 也是无效初值——用户必须选日期，
或选择「购买时间 + 套餐档位」让系统自动填入（`customers-action-dialog.tsx:226-231`）。

### 5.3 刻意的代价（登记为 L1）

历史 `null` 客户**即使只想改备注**，也必须先设一个到期时间。这是「必填」的固有含义，
不是缺陷；缓解手段是字段级错误提示与自动计算路径。

### 5.4 跨任务连带影响（与 TASK-040）

TASK-040（客户续期）的设计文档以「**新建表单默认 `expireAt: null`**」作为
`expireAt === null` **可达性**的证据（其 F13 / L8 / §3.4 注记）。本任务落地后，该表述失效：
`null` 只由**历史数据**产生，不再由任何界面产生。

- TASK-040 续期对话框对 `null` 的分支（显示 `未设置` + `（自今日起算）`）**仍然需要保留**——
  历史数据路径可达，删掉会退化为「未设置客户打开续期即报错」。
- 因此本任务须同步补一行注记到 `docs/technical/customer-renewal.md` 的 F13 / L8 处
  （见 §6 末项）。**范围严格限定为注记**，不得改动 TASK-040 的任何决策与算法表述。

### 5.5 读取路径全部不需要改

`daysLeft(null) → null`（F7）、`splitPlanCycles`（`utils.ts:85-88` 已处理 null）、
`dashboard` 的 `expiringSoon`（`server/src/routes/dashboard.ts:78` 用 `isNotNull`）、
`reminder-scan`（`server/src/services/reminder-scan.ts:38` 用 `isNotNull`）——
这些路径本就正确容忍 `null`，**不得**顺手「简化」为不再判空（历史数据仍会命中）。

唯一改动的展示项是列表文案：`null` 由「长期」改为「未设置」（决策 D3）。

---

## 6 契约文档与冒烟脚本同步

### 6.1 `server/scripts/smoke.ts`

- **10 处**创建客户的载荷补 `expireAt`（F8 列出的行号）。
- **必须用远期时间**（建议 `Date.now() + 3650 * 86400000`）。理由：若落在提醒时间窗内，
  会注入 `customer.expire` 提醒，扰动 `/api/reminders/scan` 相关与会话统计类断言；
  远期可保证零注入。（`thresholdRemindersOf` 按 `type === 'customer.traffic_threshold'` 过滤，
  本身不受影响，但不必依赖这一点。）
- `:609` 的 `{ name: '' }` 用例**保留不动**（仍返回 400，断言只看状态码）。
- **新增两条契约检查**（这是「必填是真契约」的唯一端到端证据）：
  1. `POST /api/customers` 载荷缺 `expireAt` → **400**；
  2. `PATCH /api/customers/:id` 载荷 `{ expireAt: null }` → **400**（证「不允许清空」）。

### 6.2 `docs/technical/api-contract.md`

`:144` 的 `expireAt` 行：类型由 `number \| null` 改为 `number`，并注明
「创建必填；PATCH 传 `null` 被拒（400）；`purchasedAt` / `subscriptionExpireAt` 仍可空」。

### 6.3 跨任务文档同步（1 行注记）

`docs/technical/customer-renewal.md`（TASK-040 的设计文档）的 F13 / L8 / §3.4 注记处补一行：
「**TASK-041 起**：新建/编辑表单不再产生 `expireAt = null`，该状态仅**历史数据**可达；
续期的 `null` 分支保留为历史数据路径。」

---

## 7 测试要求

### 7.1 表单 schema（`src/features/customers/data/schema.test.ts`）

- **新增**：`expireAt: null` → 校验失败，且 `issues[0].message === '请选择到期时间'`。
- **新增**：合法 `Date` → 校验通过。
- **保留** `:121` 的 `toCustomerInput(null) → null`（纯函数映射是**独立契约**，与 UI 校验无关），
  并加注释标注「该分支自 TASK-041 起不再由表单触达，仅作防御性映射」。

### 7.2 对话框（`src/features/customers/components/customers-action-dialog.test.tsx`）

- **必须**保留/新增至少 1 个**历史客户**（`expireAt: null`）用例：
  打开编辑 → 直接保存 → **被拦**且提示「请选择到期时间」可见 → 补填日期 → 保存成功，
  且 `mutateAsync` 载荷含新的 `expireAt`。
- **新增**：新建模式下不选到期时间（且未触发自动计算）→ 保存被拦。
- **新增**：「清除到期时间」按钮不存在（`queryByRole('button', { name: '清除到期时间' })` 为 `null`）。
- **必须调整**：其余**保存类**用例的夹具改为带 `expireAt` 的客户——否则它们会被必填拦死，
  产生与被测行为无关的**假失败**。
- **不得**为了让既有用例通过而放宽校验（把 `.refine()` 删掉、改回 `.nullable()`）——
  这是本任务最需要防的自我欺骗路径。

### 7.3 契约层

由 §6.1 的两条冒烟检查承担；若 `shared/src/**` 已存在测试文件，则额外加一条对
`customerInputSchema` 的直接断言（缺 `expireAt` 失败 / `partial({ expireAt: null })` 失败）。

---

## 8 已知限制

| # | 限制 | 影响 | 处置 |
|---|------|------|------|
| L1 | 历史 `null` 客户编辑时必须补填（§5.3） | 只想改备注也要先设到期时间 | **刻意的代价**（必填的固有含义）；不得为「放行」而放宽校验 |
| L2 | 数据库列仍可空，应用层与存储层的保证强度不同 | 直写 DB（未来新代码 / 手工 SQL）仍可置 `null` | 人类裁定不回填、不迁移；由 API 层承担保证；`isNotNull` 过滤的读取路径本就容忍 |
| L3 | 输出 schema 保留 `number \| null`，输入 schema 必填 | 类型上「可能为 null」与「入参必填」看似矛盾 | 这是对**历史数据**的忠实表达（D6）；不得因「看起来矛盾」而把输出改成必填 |
| L4 | 订阅实体的 `expireAt` 仍可空，其界面文案仍为「长期有效（留空）」 | 两个实体的到期时间语义不同 | **刻意**：订阅到期由同步引擎写入（F10），上游可能不返回；**不得**顺手改（Non-Scope） |
| L5 | 无「禁止清空」的专门服务端守卫 | 保证只来自 zod schema | schema 是唯一写入入口（`crud.ts`）；不为单一字段增设旁路判断 |

---

## 9 决策索引

| # | 决策 | 来源 |
|---|------|------|
| D1 | 强制层级 = **表单 + API 入参**；不落数据库 | 人类裁定 2026-10-16（ADR-005 D-1） |
| D2 | 历史 `null` **保留、不回填**；数据库列保持可空；编辑时补填 | 人类裁定 2026-10-16（ADR-005 D-2） |
| D3 | 列表 `null` 文案「长期」→「**未设置**」 | **人类追认 2026-10-16**（原为 architect 提议；见 ADR-005 D-3） |
| D4 | 必填文案用 `z.number({ error: '请选择到期时间' }).int()`（v4 无 `required_error`） | 实测 F12-① |
| D5 | 表单层用**字段级** `.refine()`，保留 `Date \| null` 类型 | 实测 F12-③；避免连带改动三处类型与实现 |
| D6 | 输出 schema **显式覆写** `expireAt` 为 `nullable()` | F2（否则类型说谎） |
| D7 | 移除「清除到期时间」按钮；日历加 `required`（不生效则退化为校验兜底 + 披露） | §4 |
| D8 | 冒烟补 `expireAt` 用**远期**时间；新增两条契约检查（缺字段 / 传 null 均 400） | F8 + §6.1 |

---

## 10 与验收标准的对应

| 设计章节 | 对应 AC |
|----------|---------|
| §3 三层改动 | AC-1 / AC-2 / AC-3 |
| §4 界面与交互 | AC-4 / AC-5 |
| §5 历史数据处理 | AC-6 |
| §6 契约与冒烟同步 | AC-7 / AC-8 |
| §7 测试要求 | AC-9 |
| §8 已知限制 | AC-10（如实登记，不得当作缺陷修） |

---

## 11 实现结果（执行位 / Implementer，2026-10-17）

> 本章为实施完成后的**回填**，记录与设计的偏差与实测结论。**不改变任何设计决策**（D1–D8）。

### 11.1 两处设计未预见的连锁（实施期实测发现，已就地处理）

| # | 现象 | 根因 | 处置 |
|---|------|------|------|
| **X1** | 表单 schema 加 `.refine()` 后，`CustomerForm.expireAt` 的类型由 `Date \| null` **收窄为 `Date`**，导致 `emptyCustomerForm()` / `toCustomerForm()` 的 `null` 初值类型报错 | **TypeScript 5.5「推断类型谓词」**：内联箭头函数 `(v) => v !== null` 被自动推成 `(v) => v is Date` | 给箭头函数加**显式返回类型注解** `(v): boolean => v !== null`（禁用该推断）⇒ 输出类型保持 `Date \| null`，与 D5 一致 |
| **X2** | `toCustomerInput` 的 `expireAt: ... : null` 与新的 `CustomerInput.expireAt: number` 类型冲突 | 入参必填后，纯数据映射函数的返回类型随之收紧 | 保留**运行时**的 `null → null` 映射（§7.1 要求保留该断言）并加类型断言 + 注释，标明「该分支自 TASK-041 起**不再由表单触达**，仅作防御性映射，类型断言由字段级校验保证成立」 |

### 11.2 AC-5 实测结论：日历 `required` **生效**（含对照实验）

- **到期时间日历（加了 `required`）**：选 `2026-10-01` 后再次点击同一日期 ⇒ 字段**仍为** `2026-10-01`，不落回 `null`。
- **对照（同页「购买时间」日历，**未**加 `required`，刻意保持可空）**：同样操作 ⇒ 字段**被清空**。
- ⇒ 两者差异确由 `required` 带来，而非「single 模式本来就不能取消选择」。
  用例见 `customers-action-dialog.test.tsx`（一正一反两个）。
- 校验兜底仍在：`onSelect` 保留 `?? null`，即使 UI 层被绕过，字段级 refine 也会拦住（设计 §4 预案未触发）。

### 11.3 冒烟基线对照（证明 7 项失败与本任务无关）

| 运行 | 结果 |
|------|------|
| 本分支（`b14e097` + `0ccd79a`） | **133 通过 / 7 失败** |
| 基线（还原改动后的 `main`，同一隔离环境、同一快照口径） | **130 通过 / 7 失败** |
| 失败项 diff | **逐行完全一致**（`diff` 为空）⇒ 均为基线固有 |

7 项失败集中在「富格式验证」段：Telegram/飞书 mock 未启动（`TELEGRAM_API_BASE` / `FEISHU_API_BASE` 未覆盖）
导致通知未派发；以及该段创建客户时报 `FOREIGN KEY constraint failed`。
**新增的 3 条契约检查（缺字段 400 / 传 null 400 / 省略仍 200）全部通过。**

### 11.4 落地测试清单（+11，全量 27 文件 / 345 passed）

- 表单 schema（5）：拒绝 `null` 且文案为「请选择到期时间」、接受合法 `Date`、新建默认即无效初值、
  过去时刻仍合法（必填只约束非空）、其余可空日期字段未被波及。
- 对话框（6）：新建未选被拦、历史 `null` 客户不补填被拦、历史客户补填后载荷含新 `expireAt`、
  「清除到期时间」按钮不存在、日历 `required` 实测、对照组（购买时间可清空）。
- 既有 3 个「新建保存」用例改为先选到期时间（否则被必填拦死 ⇒ 与被测行为无关的假失败）。

> **防假阳性注记：** 字段的占位文案与校验提示**同为**「请选择到期时间」，
> 若用文本查询断言「提示可见」会**恒真**。测试一律按 `FormMessage` 的
> `data-slot="form-message"` 定位，并以「保存未被调用」作为拦截的行为证据。
