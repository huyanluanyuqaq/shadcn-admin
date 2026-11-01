# TASK-052 — 客户编辑跨页实时同步（邮箱 / 订阅链接）

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-052
Title: 客户编辑跨页实时同步（邮箱 / 订阅链接）
Workflow: feature
Status: REVIEW
Priority: P1
Owner: 鼠鼠戴的工具人 (WorkBuddy)
Owner Since: 2026-11-01T13:30:00+08:00
Assigned Role: developer
Created: 2026-11-01T13:30:00+08:00
Updated: 2026-11-01T19:05:00+08:00
Branch: （未建分支，工作于主工作区；提交时按 .agents/rules/git.md 命名 feat/TASK-052-customer-edit-cross-page-sync）
Requires Human Approval: false
```

---

## Objective

编辑客户并保存后，无论「更换邮箱」「更换订阅链接」还是「两者同时更换」，订阅管理页面与邮箱管理页面都立即反映最新数据，且不残留与新状态矛盾的旧记录。

**强绑定追加口径（2026-11-01 人类需求）：** 同时把邮箱 B→BB、链接 C→CC 保存后，
`客户管理` 只剩 BB / CC；**B 与 C 都不删除**，分别保留在邮箱管理与订阅管理中并标记为「未分配」；
新邮箱 BB 与新订阅 CC 归属同一客户。即：**只有仍归属本客户的旧绑定才跟着改名，其余一律留在原地转未分配**。

---

## Background

排查（2026-11-01 会话）发现三处数据不一致缺陷：

1. **换邮箱悬挂**：客户改邮箱后，`/email-bindings/sync` 只按新邮箱 upsert，旧邮箱名下的绑定原样残留，邮箱管理出现两条绑定指向同一订阅；清空邮箱时旧记录同样残留。
2. **换链接残留双绑**：客户表单换新链接（未登记）时新建订阅，但旧链接对应、仍绑定在该客户名下的订阅**不被解绑**，客户名下残留新旧两条订阅。
3. **换邮箱且未落订阅时完全不迁移**：原前端条件 `customer.email && syncResult.subscriptionId !== null` 导致无订阅场景下邮箱变更不产生任何同步。

缓存失效链路（`useSyncEmailBinding` 失效三根键；`invalidateCustomerDependentQueries` 失效三域）经排查已覆盖各写入路径，本 Task 不改动失效机制本身。

---

## Scope

- 服务端 `POST /email-bindings/sync` 新增 `previousEmail` 入参与迁移语义。
- 客户表单保存流：换链接时解绑旧订阅；换邮箱时携带 `previousEmail`；「换邮箱但未落订阅」也触发迁移。
- 上述行为的浏览器测试用例（`customers-action-dialog.test.tsx`）。

## Non-Scope

- 缓存失效机制重构（TanStack Query invalidation 链路维持现状）。
- 订阅表单侧（`subscriptions-action-dialog.tsx`）的同步语义变更（其邮箱同步本就 always-call，不涉及换邮箱迁移）。
- 「清空邮箱」时旧绑定的处置（保留为独立登记记录，见 Known Issues）。
- 「清空订阅链接」时邮箱绑定的处置（维持现状：绑定保留、所属客户显示「未分配」）。
- 服务端路由层自动化测试（项目现状：routes 层无测试基建，见 Known Issues）。

---

## Requirements

> **⚠️ 2026-11-01 人类裁决**：第 1 / 2 / 3 / 6 条以「可以只换邮箱、链接不变」为前提，该前提已被否决
> ⇒ 本节保留为历史，**冲突时以下一节「场景与规则」为准**，对应实现尚未改（见该节「待实施差异」）。

1. 换邮箱保存后：旧邮箱名下全部绑定迁移/合并到新邮箱，邮箱管理页不残留旧邮箱记录。
2. 迁移合并规则：同 `(新邮箱, 同供应商)` 已有绑定 → 删除旧条目；否则整条改名。迁移先于 upsert，迁移来的行被同键 upsert 命中时直接改绑。
3. 换邮箱且本次未落到具体订阅（清空链接后的 skipped 场景）：仅迁移，不新建「未绑定」行、不新建空绑定。
4. 换订阅链接保存后：新链接落到订阅管理（新建或接管既有记录），旧链接对应且仍属于该客户的订阅被解绑（`customerId: null`，订阅本身保留）。
5. 上述任一保存后，订阅管理页与邮箱管理页经既有 invalidate 链路自动 refetch，无需手动刷新。
6. **旧记录转未分配（强绑定）**：换邮箱时，只有「该旧绑定指向的订阅仍归属本客户」才改名迁移；
   否则旧邮箱记录原样保留，在邮箱管理页显示「未分配」（与旧订阅的未分配状态对应）。
7. **邮箱全局唯一（强绑定校验）**：客户邮箱与其它客户重复时拒绝保存（409），大小写不敏感；
   只阻止新引入的重复，不改动历史数据；清空邮箱不受限制。

---

## 场景与规则（2026-11-01 人类裁决，权威）

**前提（人类逐字裁定）**

1. 「仅更换邮箱而链接不变」**不成立**。
2. 「仅更换链接而邮箱不变」**只在订阅链接被重置、旧链接失效时**发生，此时旧订阅链接**无需在系统中保留**。

**推导出的结构性事实**

- 绑定唯一性只有一条数据库约束：`uniqueIndex('uq_email_bindings_email_pool')`（`schema.ts:184`）；
  `subscription_id` 上只有普通索引（`schema.ts:185`）⇒「一条订阅一条绑定」是**应用层不变式**，靠同步逻辑维持。
- 因此「邮箱变了、订阅没变」必然产生「同一订阅两条绑定」——正是 TASK-052 的原始缺陷。
  该场景不是"少见"，而是**与数据模型自我矛盾，必须被拦**。
- 两个**有效**场景都不需要「旧邮箱改名迁移」：
  - 换账号：订阅变了 ⇒ 旧绑定天然留在旧订阅上（即「未分配」），无须迁移；
  - 链接重置：邮箱没变 ⇒ 同键 `(email, pool)` upsert 直接把 `subscription_id` 改指新订阅，无须迁移。
  ⇒ `previousEmail` 迁移机制（Requirements 1/2/3、AC-6 迁移语义）**整体失去适用场景**。

| # | 场景 | 成立性 | 客户管理 | 订阅管理 | 邮箱管理 |
|---|------|--------|----------|----------|----------|
| S1 | 换账号：邮箱 B→BB **且** 链接 C→CC | 成立（主场景） | BB / CC | CC→A；C 解绑、保留、显示未分配 | BB→CC；**B 原位保留**指向 C、显示未分配 |
| S2 | 链接重置：邮箱 B 不变，C→CC（C 已失效） | 成立（唯一成因） | B / CC | CC→A；C 解绑，**不做保留承诺**（不删、不迁、不标注） | B 的既有绑定改指 CC（不新增行、不迁移） |
| S3 | 只换邮箱：B→BB，链接 C 不变 | **不成立** | — | — | — |
| S4 | 清空链接（既有 AC-3） | 成立 | B / 空 | C 解绑、不删除 | 不 sync；B→C 保留、显示未分配 |

**处理规则**

- **R1 校验**：邮箱变更必须伴随链接变更。前端提交前拦截——`email` 与 `currentRow.email` 不同
  （大小写/首尾空格归一后比较）而 `subscriptionUrl` 与 `currentRow.subscriptionUrl` 相同
  ⇒ 阻止保存，提示「更换邮箱必须同时填写新的订阅链接」。
- **R2 服务端兜底**：`/email-bindings/sync` 收到 `previousEmail ≠ email` 且「旧邮箱名下存在绑定指向本次
  `subscriptionId`」⇒ **400**（同一提示语）。不做改名、不做合并——即把原迁移机制改造成拒绝守卫。
- **R3 邮箱唯一**：沿用 AC-8（409、排除自身、只拦新引入重复）。比较前归一化大小写与首尾空格。
- **R4 同步顺序**：客户 → 订阅（新建/接管 + 旧链接解绑）→ 用量（仅落到订阅时）→ 邮箱绑定（仅落到订阅时）。
- **R5「无需保留」的落地口径（S2）**：只解绑（`customerId: null`），**不删除订阅**（与 AC-3 一致），
  不写标记、不做特殊展示。若要求「失效订阅在列表里彻底不可见」，需新增状态字段 + 列表过滤 ⇒ 新需求，登记 Known Issue。

**为什么 S1 的 C/B 会「保留为未分配」**：不是因为任何"保留"动作，而是因为订阅未删、绑定未动，
它们仍各自指向原订阅 C。S2 的 C 同样以未分配形式残留，只是**不承诺**其可读性。
两者机制完全相同，差别只在承诺 ⇒ **除 R1/R2 外无需额外代码**。

**待实施差异（截至本节写入时尚未改代码）**

1. `server/src/routes/resources.ts` 迁移段（≈L341-388）：删改名/合并逻辑，改为 R2 的 400 拒绝；
   `migrated` 随即恒为 0 ⇒ 建议连响应字段一并移除（顺带永久消除 N-1 的措辞争议）。
2. `customers-action-dialog.tsx`：加 R1 校验；邮箱同步条件回到「仅落到订阅时」。
3. `server/scripts/email-binding-sync-check.ts` 场景 2 / 场景 4（均以"链接不变"为前提）→ 改写为 R2 拒绝断言。
4. `docs/technical/api-contract.md`：语义表删「邮箱变更迁移」行，补 R1/R2 与 S1/S2 终态——**须与代码同批改**，
   避免再现 MAJOR-1 的文档-实现脱节。
5. `TASK.md` 的 Requirements 1/2/3/6 与 AC-4 / AC-6 / AC-7 已与本裁决冲突，改代码时一并重写。

**边界（需人类确认一次）**：若真实业务存在「原邮箱填错、链接确实未变」的**纠错**场景，R1 会挡下合法操作
（需先改链接再改回）。若该场景存在，改为"允许保存但服务端删除旧绑定"（等价于原迁移、且需重开审查）。

---

## Constraints

- 技术：不引入新依赖；不改数据库 schema / 不写迁移；请求侧契约向后兼容（`previousEmail` 为可选新增字段）。**响应侧为扩展性变更**（新增 `migrated`；`action` / `binding` 在仅迁移路径为 `null`），随本次改动同步更新了 `docs/technical/api-contract.md`（第一轮审查 MAJOR-1 整改）。
- 兼容：`/email-bindings/sync` 既有调用方（订阅表单）不传 `previousEmail` 时行为逐字节不变（`subscriptionId: null` 的 upsert 语义为本次新定义，原无调用方触达）。
- 安全：`previousEmail` 须过 zod email 校验；迁移在单事务内完成。
- **强绑定（2026-11-01 追加）**：邮箱唯一校验放在 CRUD 工厂的 `beforeWrite` 前置钩子（不改数据库约束、不动历史数据）；比较用 `lower()` 且仅检查入参里出现的 `email` 键，故部分更新不受影响；订阅链接「接管」语义**不变**（换到已登记订阅仍按 AC-3 接管，不新增拦截）。

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-046（统一失效域） | blocks | 已完成 |
| 无外部系统 | external | — |

---

## Acceptance Criteria

> 状态说明（计数为 2026-11-02 复核值）：AC-1~AC-5、AC-7 由 `customers-action-dialog.test.tsx` 验证（**30/30**，全量 **27 文件 345 用例**）；
> AC-8、AC-9 由 `server/scripts/email-binding-sync-check.ts` 验证（**8 场景 41 项**，临时库）；
> AC-6 已由 `pnpm build:server` + `pnpm exec tsc -b` + `pnpm lint`（均 exit 0）验证。

- [x] AC-1: 编辑换邮箱（链接不变）保存后，`syncEmailBinding` 调用携带 `previousEmail`，且不产生任何订阅解绑调用。
- [x] AC-2: 编辑换链接为未登记新 URL 保存后，新建订阅且旧订阅被解绑（`updateSubscription({ id: 旧id, input: { customerId: null } })`）。
- [x] AC-3: 编辑换链接为已登记的其他订阅时，该订阅被更新接管到本客户，旧订阅被解绑。
- [x] AC-4: 换邮箱且本次未落订阅时，**不触发**邮箱同步（2026-11-01 强绑定扩展修订：服务端此路径无「本次订阅的归属客户」可比对，不存在可执行的迁移；此前「触发一个空转同步」的写法已撤回），且不触发用量同步。
- [x] AC-5: 邮箱未变且未落订阅时，不触发邮箱同步（不新建空绑定行）。
- [x] AC-6: 服务端 `/email-bindings/sync` 支持 `previousEmail` 迁移逻辑（同键合并删除 / 整条改名 / 迁移先行于 upsert），**迁移以「旧绑定订阅仍归本客户」为前提**，TS 编译与 lint 通过。
- [x] AC-7: 同时换邮箱（B→BB）与换链接（C→CC）保存后：新邮箱 BB 指向新订阅 CC 且归属本客户；旧订阅 C 解绑（订阅管理显示「未分配」）但保留；**旧邮箱 B 记录保留原位、仍指向 C**（邮箱管理显示「未分配」）；客户管理行只剩 BB / CC。
- [x] AC-8: 客户邮箱全局唯一——新建或更新撞上其它客户已用邮箱返回 409（大小写不敏感），提示含占用者姓名；改自身其它字段、保存自身原邮箱、清空邮箱均不受影响。
- [x] AC-9: 服务端强绑定规则可复现验证——`server/scripts/email-binding-sync-check.ts` 覆盖 8 个场景 **41 项断言全通过**（临时库，不触碰真实库；计数为 2026-11-02 复核值）。

> **范围说明：** AC-1~AC-6 为 TASK-052 初版范围（两轮独立审查结论见 `handoffs/2026-11-01-review.md`）；
> AC-7~AC-9 为 **2026-11-01 人类追加「强绑定」需求后并入**的范围（含 AC-4 的修订理由），
> 证据见本档案 Current State 与 `handoffs/2026-11-01-coordinator-review.md`。

> **⚠️ 后续裁决注记（TASK-053，2026-11-01T21:50，冲突时以本注为准，上文不复改）：**
> 人类随后裁决「邮箱与订阅链接必须整体替换」，并把绑定关系重构为四态模型（见
> `tasks/review/TASK-053-email-binding-states/TASK.md`）。据此：
> - **AC-6 与 `previousEmail` 迁移机制已被删除**（入参、响应字段 `migrated`、迁移段、文档、脚本五处），
>   换链接后旧邮箱记录**原样保留**，不再被改名迁走；
> - **AC-8 的「邮箱全局唯一」已改回按 `(邮箱, 供应商)` 唯一**（同一邮箱可注册不同供应商）；
> - AC-7 的落库形态（旧邮箱 B 保留、显示「未分配」）**仍然成立**，且现在靠「不做任何迁移」天然实现。
>
> 本档案按「历史不回改」原则保留原始 AC 文本，**不得再据 AC-6 / AC-8 验收当前代码**。

---

## File Scope

```yaml
File Scope:
  - server/src/routes/resources.ts
  - server/src/lib/crud.ts          # 强绑定扩展新增：CRUD 工厂加 beforeWrite 校验钩子
  - server/scripts/email-binding-sync-check.ts    # 强绑定扩展新增：服务端规则可复现验证
  - server/package.json             # 强绑定扩展新增：注册 email-binding-check 命令
  - src/features/emails/queries.ts
  - src/features/customers/components/customers-action-dialog.tsx
  - src/features/customers/components/customers-action-dialog.test.tsx
  - src/features/subscriptions/components/subscriptions-columns.tsx  # 「未分配」口径统一（仅文案）
  - docs/technical/api-contract.md  # 第一轮审查 MAJOR-1 整改新增 + 强绑定规则
Non-Scope (files):
  - src/features/subscriptions/**（订阅表单侧同步语义不变；**例外**：`subscriptions-columns.tsx` 仅改「绑定客户」列为空时的显示文案，不动同步逻辑）
  - server/src/db/**（无 schema 变更、无迁移）
  - shared/**（无共享类型变更：EmailBindingSyncInput 为前端本地类型）
```

---

## Implementation Plan

1. 服务端：`emailBindingSyncSchema` 增加 `previousEmail`（可选、email 校验）。
2. 服务端：sync 事务内增加迁移段（先于 upsert）：按旧邮箱取绑定 → 同键合并删除或整条改名。
   **强绑定追加后**：迁移仅在「旧绑定订阅的 `customerId` == 本次订阅的 `customerId` 且非 null」时执行；
   `subscriptionId === null` 时提前返回（不 upsert、不迁移）。
3. 前端：`EmailBindingSyncInput` 增加 `previousEmail`；`useSyncEmailBinding` 注释同步。
4. 前端：`syncSubscription` 改 `let target`，新建订阅回写 target；换链接（`previousUrl !== url`）时解绑旧订阅（守卫：仍属于本客户且非本次落到的同一条）。
5. 前端：`onSubmit` 在「本次落订阅」时同步邮箱，换邮箱时携带 `previousEmail`（强绑定追加后撤回「未落订阅也发一次空转同步」的写法）。
6. 测试：新增 TASK-052 describe（5 用例）；`pnpm build:shared` → vitest → `build:server` → `tsc -b` → `lint` 全绿。
7. 整改轮（第一轮审查 FAIL 后）：修 `docs/technical/api-contract.md` 三处（MAJOR-1）；修 `resources.ts` JSDoc 括注（MINOR-1）；`action` 显式标志（NIT-1）；Known Issue #4/#6 更新与登记。
8. **强绑定追加（2026-11-01）**：服务端迁移段加归属判定；`server/src/lib/crud.ts` 增加 `beforeWrite` 钩子；`customers` 路由接入邮箱唯一校验（409）。
9. 前端：`subscriptions-columns.tsx` 的「绑定客户」列为空时显示「未分配」（与邮箱管理口径一致）。
10. 服务端测试：新增 `server/scripts/email-binding-sync-check.ts`（临时库直驱真实路由，5 场景 28 断言）并注册 `pnpm --filter server email-binding-check`。

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1~AC-5、AC-7 | 自动化测试 | `pnpm build:shared && pnpm vitest run src/features/customers/components/customers-action-dialog.test.tsx`（**29 passed**） |
| AC-6 | 编译 + 静态检查 | `pnpm build:server`（exit 0）+ `pnpm exec tsc -b`（exit 0）+ `pnpm lint`（exit 0） |
| AC-8、AC-9 | 服务端自动化（临时库直驱真实路由） | `pnpm --filter server email-binding-check`（**28 passed / 0 failed**） |
| 端到端手工（建议审查者抽验） | 手工 | 起 server + 前端 dev，编辑客户换邮箱/换链接保存，切到邮箱管理/订阅管理页观察刷新结果 |

---

## Current State

**第二轮独立审查结论 `PASS`（2026-11-01T16:20）—— 移交主控位复审（已由主控位复审，结论见本节末）。**

第一轮 FAIL 的 MAJOR-1（`docs/technical/api-contract.md` 未同步契约变更）已修复，并经
**25 项逐字一致性探针**确认文档声明与 `server/src/routes/resources.ts` 运行期行为完全一致
（请求 4 字段及校验、响应恰 4 键及 nullable 语义、语义表 5 行含「旧行备注不保留」括注）；
MINOR-1 / MINOR-2 / NIT-1 / NIT-2 与 Known Issue #4 过期表述均已按审查记录 §8 闭环。

整改后复跑：`build:shared` / `build:server` / `tsc -b` / `lint` 全 exit 0；
`vitest` 对话框用例 28/28；全量回归 340/340（该轮实测值；2026-11-02 复核为对话框 30/30、全量 27 文件 345 用例）；
端到端三层共 **85 项断言**（HTTP 41 + 浏览器 19 + 文档探针 25）全部通过。

第二轮仅新增 3 项**不阻塞**的措辞类 NIT（`migrated` 语义措辞、审查登记块缺解决标记、
「未改逻辑语义」与 NIT-1 整改的表述矛盾），详见审查记录第二节 §5，建议顺手处理但不作为合入前提。
**（主控位裁定见本节末：上述 3 项已分别升级为合入前置 N-1、直接修复 N-2、加注解决 N-3，均不再挂账。）**

按审查者指示暂留 `tasks/review/`，待主控位复审（`handoffs/2026-11-01-coordinator-review.md`）。

**主控位复审结论 `PASS`（2026-11-01T16:40）—— 可合入，附 1 项合入前置。**
主控位独立复跑 `build:shared` / `build:server` / `tsc -b` / `lint` 四项退出码全 0、
`pnpm test` 26 文件 / 340 用例全通过（该轮实测值；2026-11-02 复核为 27 文件 345 用例），并逐行阅读 `resources.ts` 迁移段与前端编排逻辑；
接口文档与实现的可核对项逐项相符，**唯一不符项为 `migrated` 的语义措辞**（审查 NIT-3）
⇒ 升级为**合入前置 N-1**（派执行位改 `docs/technical/api-contract.md:235` 一行）。
主控位新发现并已登记 Known Issue #7（跨客户邮箱迁移越界，待人类裁决是否立项）；
另裁定本变更**无需 ADR**（理由见复审记录 §5 C-2）。
对审查记录自身的抽查：`resources.ts:263` / `api-contract.md:235` / NIT-4 三处引用**成立**；
NIT-5 的**定位与引文不精确**（现存逐字表述在 Handoff 003「逻辑语义零改动」，非 `Current State`）——
实质成立、仅需更正引用；第一轮对 dialog 的行号基于整改前版本，整改后已漂移，不可作为核对判据。
上节「端到端三层 85 项断言全部通过」**主控位无法复现**（三个脚本均未入仓，记录无日志路径/时间戳），
已按「不可复核声明」处理，**未计入可采信证据**；主控位以源码级核验替代，结论不因此改变。
**关于 Handoff 003 的「逻辑语义零改动」应读作「未改变任何可观测行为」**（`action` 返回值语义
经 NIT-1 修正得更准确）——历史记录不回改，以本注为准。

---

**强绑定扩展（2026-11-01T18:45，人类追加需求后并入同一任务）—— 实现完成，`Status` 维持 `REVIEW`，待独立审查。**

需求：同时把邮箱 B→BB、链接 C→CC 保存后，客户管理只剩 BB/CC；B 与 C 均**保留**在邮箱管理/订阅管理
并标记「未分配」；三处页面一致；并给出保存时的双向绑定校验与同步规则。

实现（`HANDOFF-006`）：
- 迁移判据改为**「旧绑定订阅的 `customerId` == 本次订阅的 `customerId` 且非 null」**：
  仅换邮箱时仍改名迁移（保住 TASK-052 修的「同订阅两条绑定」），换链接导致旧订阅解绑时旧邮箱记录
  **原样保留**——服务端此路径下 `migrated = 0`，邮箱页据此显示「未分配」。
- `subscriptionId: null` 路径：不做 upsert、**也不做迁移**（无「本次订阅的归属客户」可比对），
  前端因此不再发起空转同步（AC-4 修订）。
- 新增邮箱全局唯一校验：`server/src/lib/crud.ts` 加 `beforeWrite` 钩子，`customers` 路由接入
  （大小写不敏感、排除自身、只拦新引入的重复 → 409）。
- 「绑定客户」列为空时统一显示**「未分配」**（订阅管理，原为 `-`）。
- 新增 `server/scripts/email-binding-sync-check.ts` + `pnpm --filter server email-binding-check`：
  临时库直驱真实路由，5 场景 28 断言，**顺带补上 Known Issue #4 的 routes 层测试缺口**。

验证（真实退出码）：`build:shared` 0 / `build:server` 0 / `tsc -b` 0 / `lint` 0 /
`pnpm test` **27 文件 345 用例全通过**（对话框用例 30）/ `email-binding-sync-check` **41 项通过 0 失败**
（行内计数为 2026-11-02 复核值；交付当时为 26 文件 341 用例、对话框 29、脚本 28 项）。
文档同步：`api-contract.md` 增「客户邮箱全局唯一」「保存客户时的写入顺序与三页一致性」两节，
并改写 sync 语义表首行与 `subscriptionId: null` 行、修正 `migrated` 措辞（即合入前置 N-1）。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| server/src/routes/resources.ts | 修改 | sync 端点新增 `previousEmail` 迁移语义；`subscriptionId: null` 仅迁移不 upsert；响应增加 `migrated`；日志更新；导入 `isNull`。整改轮：JSDoc 合并括注改为如实表述（MINOR-1） |
| src/features/emails/queries.ts | 修改 | `EmailBindingSyncInput` 增加 `previousEmail?`；注释更新 |
| src/features/customers/components/customers-action-dialog.tsx | 修改 | `syncSubscription`：新建回写 target + 换链接解绑旧订阅；`onSubmit`：邮箱同步条件放宽 + 携带 `previousEmail`。整改轮：`action` 改为显式标志消除不可达分支（NIT-1） |
| src/features/customers/components/customers-action-dialog.test.tsx | 修改 | 新增 TASK-052 describe，5 个用例锁死上述行为 |
| docs/technical/api-contract.md | 修改 | 整改轮（MAJOR-1）：`/email-bindings/sync` 小节补 `previousEmail` 入参、响应类型改为含 `migrated` 与 nullable 字段、语义表补「邮箱变更迁移」与「`subscriptionId: null` 仅迁移」两行。强绑定扩展：迁移行加「旧订阅仍归本客户」前提、`subscriptionId: null` 行改为「不 upsert 也不迁移」、修正 `migrated` 措辞，新增「客户邮箱全局唯一」「保存客户时的写入顺序与三页一致性」两节 |
| server/src/lib/crud.ts | 修改 | 强绑定扩展：`CrudOptions` 增 `beforeWrite(values, id)` 前置校验钩子，POST/PATCH 在写库前调用（默认不启用，其他资源行为不变） |
| server/scripts/email-binding-sync-check.ts | 新增 | 强绑定扩展：临时库直驱 `/email-bindings/sync` 与 `/customers` 路由，5 场景 28 断言，补 routes 层测试缺口 |
| server/package.json | 修改 | 强绑定扩展：注册 `email-binding-check` 命令 |
| src/features/subscriptions/components/subscriptions-columns.tsx | 修改 | 强绑定扩展：「绑定客户」列 `customerId` 为空时显示「未分配」（原 `-`），与邮箱管理口径一致 |

---

## Known Issues

1. **清空客户邮箱**：旧邮箱绑定按「独立登记记录」保留（不删除、不迁移）——绑定表是登记簿语义，删除可能误伤。审查者如认为应随保存清理，需人类裁决。
2. **清空订阅链接（解绑）**：邮箱绑定保留并继续指向该订阅，邮箱管理页「所属客户」列显示「未分配」——维持既有行为，未改。
3. **新建客户填邮箱但无订阅**：不会在邮箱管理创建记录（原表单文案「填写的邮箱将同步到邮箱管理」在该场景仍过于宽泛）——本次仅修编辑链路，文案未动。
4. **服务端 routes 层无自动化测试基建**：迁移逻辑仅由前端测试 + 编译检查间接覆盖。第一轮独立审查已通过隔离临时库完成端到端抽验（HTTP 级 41/41 + 浏览器级 19/19，脚本未入仓）——**该抽验不可复用**，后续改动 `resources.ts` 时缺口会重新暴露，建议单独立项补测试基建。
   **→ 2026-11-01 强绑定扩展：已入仓 `server/scripts/email-binding-sync-check.ts`（5 场景 28 断言，`pnpm --filter server email-binding-check`），本端点的缺口闭合；其它 routes 仍无基建，建议的立项仍然有效。**
5. 前端 200 条上限的选项查询（邮箱页名称映射）为既有问题，不在本 Task 范围。
6. **换链接解绑依赖 200 条上限的选项列表**（第一轮审查 MINOR-2 登记）：解绑判定走 `useSubscriptionOptions()`（`pageSize: 200`），订阅数超 200 时 `previousSub` 找不到、解绑**静默不发生**。属既有上限的继承，与 #5 是同一上限的不同症状（#5 未覆盖解绑路径）；如需根治应改为按 URL 精确查询，待人类裁决是否单独立项。
7. **跨客户邮箱迁移越界**（主控位复审 C-1 登记，2026-11-01）：`customers.email` **无唯一约束**（`server/src/db/schema.ts:69`，迁移 0000/0002 亦无唯一索引；前端仅校验格式），而迁移段按 `previousEmail` **全量取行**、不校验绑定所属订阅的 `customerId`。若两个客户共用同一邮箱且分别绑定不同供应商（`email_bindings` 唯一键为 `(email, pool_id)`，允许同邮箱多行），编辑其中一位的邮箱会把**另一客户的绑定一并改名**（归属错位，但不删数据）。低概率、中影响；根治需入参携带 `customerId` 或按「本客户名下订阅」过滤，属接口扩展 ⇒ **待人类裁决是否单独立项**。
   **→ 2026-11-01 强绑定扩展：迁移判据已改为「旧绑定订阅的 `customerId` == 本次订阅的 `customerId`」，加上客户邮箱全局唯一校验（409），**新增**的跨客户迁移错位已在两道口子堵住；**历史已存在的重复邮箱仍需人工核对**（`SELECT email, COUNT(*) FROM customers WHERE email IS NOT NULL GROUP BY lower(email) HAVING COUNT(*)>1;`，有命中则先决定归属再改邮箱）。**

---

**审查登记（2026-11-01 · Reviewer，对应 `handoffs/2026-11-01-review.md`）：**

- **Known Issue 4 第二句已过期**：「端到端迁移行为依赖审查者手工抽验」—— 本次审查**已完成**该抽验
  （HTTP 级 41/41 + 真实浏览器级 19/19，均在隔离临时库上进行，未入仓）。
  该缺口本身（routes 层无测试基建）仍成立，建议后续单独立项补测试基建。
- **MINOR-2 新登记**：换链接解绑依赖 `useSubscriptionOptions()`（`pageSize: 200`）能覆盖到旧订阅；
  订阅数超 200 时 `previousSub` 找不到、解绑静默不发生。属既有上限的继承，但本 Task 的新建能力依赖了它，
  故显式登记（与 Known Issue 5 是同一上限的**不同**症状，5 未覆盖解绑路径）。
- **MINOR-1 新登记**：`server/src/routes/resources.ts:263` JSDoc 称同键合并时「信息并入新条目」，
  实际仅删除旧行、未并入旧行 `remark`（已实测）。Requirements #2 的「删除旧条目」表述准确，失真的是代码注释括注。
- **MAJOR-1（阻塞）**：`docs/technical/api-contract.md` L209-233 未随本次契约变更更新，
  违反 Workspace `AGENTS.md` §13 DoD「文档已更新」与项目 `negative-assertion-review.md` §5.1。
  **→ 已闭环**：已由整改轮修复并经第二轮逐字探针确认（见审查记录第二节 §2）。
- 本块为**第一轮审查发现的快照**；逐项闭环状态以审查记录第二节与主控位复审记录为准。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | developer | reviewer | 2026-11-01 | 开发完成，AC-1~AC-6 自验通过，提请独立审查 |
| 002 | reviewer | developer | 2026-11-01 | **FAIL（CHANGES_REQUESTED）**：AC-1~AC-6 与 Req 1~5 全部实证达成（单测 28/28 + HTTP 级 41/41 + 浏览器级 19/19 + 全量回归 340/340）；唯一阻塞项为 `docs/technical/api-contract.md` 未同步契约变更（MAJOR-1），另列 MINOR-1/2、NIT-1/2。无需改逻辑代码 |
| 003 | developer | reviewer | 2026-11-01 | **整改完成，提请第二轮独立审查**：MAJOR-1 文档三处已修、MINOR-1 注释已修、MINOR-2 与 Known Issue #4 已登记/更新、NIT-1 已修；逻辑语义零改动；整改后 build:server / vitest 28/28 / lint 全绿。审查应对照 `handoffs/2026-11-01-review.md` §7/§8 逐项复核并追加第二节 |
| 004 | reviewer | coordinator | 2026-11-01 | **PASS**：§7 全部问题闭环；MAJOR-1 经 25 项逐字探针确认文档与实现一致；整改后全部命令复跑通过（含全量回归 340/340）＋ 端到端三层 85 项断言（41+19+25）全通过；File Scope 合规、无越界改动。第二轮仅新增 3 项不阻塞措辞类 NIT（NIT-3/4/5）。**移交主控位复审** |
| 005 | coordinator | developer | 2026-11-01 | **主控位复审 PASS（可合入）**：四项门禁退出码全 0 + 全量 340/340 由主控位复跑；逐行读迁移段与前端编排，未发现两轮漏判的功能缺陷；拦下 1 项合入前置（N-1：`migrated` 措辞）、登记 1 项新发现（C-1 跨客户迁移越界 = Known Issue #7）、裁定无需 ADR；审查记录自身 3 项引用问题（NIT-5 定位/行号时点/E2E 不可复现）已披露。**下一步：执行位改 1 行 → 建分支 → 提交 → 开 PR** |
| 006 | developer | reviewer | 2026-11-01 | **强绑定扩展交付（人类追加需求，经裁决「并入 TASK-052」）**：AC-4 修订 + 新增 AC-7~AC-9；迁移改为「旧订阅仍归本客户才改名，否则保留转未分配」；新增 `beforeWrite` 钩子 + 客户邮箱唯一校验（409）；订阅「绑定客户」空值改显示「未分配」；新增 `email-binding-check`（28/28）并同步接口文档（含合入前置 N-1 的 `migrated` 措辞）。验证：build:shared/build:server/tsc -b/lint 全 0、全量 341/341、检查脚本 28/28。**提请独立审查（本轮改动触及已审逻辑，须重审）** |

**最新 Handoff：** 006（developer → reviewer，见本节 + `handoffs/2026-11-01-coordinator-review.md` 的"强绑定扩展"段）
**Next Action（分两步，顺序不可颠倒）**：
1. **独立审查（新实例，不带实现上下文）**：对照 AC-1~AC-9 复跑 `pnpm test` 与 `pnpm --filter server email-binding-check`，
   重点核 ① 迁移归属判定的四种路径（换链接/仅换邮箱/未落订阅/合并）与 `api-contract.md` 语义表逐字一致；
   ② 邮箱唯一校验只拦新引入的重复（历史重复客户仍可保存其它字段）；③ `beforeWrite` 钩子对其它 5 个资源零影响。
   产出 `handoffs/<日期>-review.md`，结论写回本表（Handoff 007）。
2. **批准后由主控位执行合并前置**：建分支 `feat/TASK-052-customer-edit-cross-page-sync`（禁直推 `main`）→ 提交
   5+4 个文件与本任务目录 → 开 PR → 复核 `gh pr checks` 失败步骤原文 + 重测分支保护（`P1`）。

合入后按 `AGENTS.md` §14.2 / D13-C 保持 `Status = REVIEW`、留在 `tasks/review/`，**Merge Record 并入下一个任务的交付请求**（本任务不回写）。

---

## Merge Record

> **本节不随「Pass/收尾」填写。** 按 D13-C 选项 C（`.agents/rules/github.md` §2 / §6、
> `AGENTS.md` §14.2），本表由**下一个任务**在回收本任务归档时回填；
> 在此之前任务保持 `Status = REVIEW`、留在 `tasks/review/`（机制，非遗漏）。
> **禁止在本任务内自我回写**（那会造成档案与提交历史不一致）。

| 项 | 值 |
|----|----|
| PR | 待回填 |
| merge commit | 待回填 |
| merged at | 待回填 |
| 变更规模 | 待回填 |
| 合并时点 head | 待回填 |
| 合并时点 CI run | 待回填 |

---

## Notes

- 排查结论（本 Task 的动因）在 2026-11-01 会话中产出，要点：三处邮箱冗余（customers.email / subscriptions.email / email_bindings.email）；「过期」为派生状态非存储状态；缓存机制为 key 前缀失效、无轮询。
- `subscriptionId: null` 的 sync 语义为本次新定义（仅迁移、不 upsert）——schema 原本允许 null 但历史上无调用方触达该分支，定义为不破坏兼容。
