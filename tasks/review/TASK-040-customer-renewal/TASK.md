# TASK-040 — 客户管理页新增「续期」功能

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-040
Title: 客户管理页新增「续期」功能（选中单行 → 1/3/6/12 个月 = 30/90/180/360 天，或自定义天数）
Workflow: feature
Status: REVIEW（2026-10-16 实施完成，已推送；待独立审查后合并）
Revision: rev4（2026-10-16，人类裁定 D-2 确认 ⇒ ADR-004 转 Accepted，**无设计内容变更**；rev2 = 时长口径 = 档位固定天数；rev3 = 撤销「未设置到期时间」的禁用规则）
Priority: P2
Owner: 主控位（定义与设计已由本会话完成，待执行位认领）
Owner Since: 2026-10-16
Assigned Role: architect（设计，已完成）→ developer（实施，待认领）；审查由不携带实现上下文的新实例承担
Created: 2026-10-16
Updated: 2026-10-16
Branch: feature/TASK-040-customer-renewal
Requires Human Approval: false   # 普通变更：无 DB 迁移、无生产部署、无密钥；
                                 # 但「合并」始终需人类显式授权（Task Rules 已载明）
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
> **本任务当前为 `REVIEW`（`review/`）：** 实施阶段已完成（提交 e572da3），本地验证全绿，
> 已推送并创建 PR #12（CI 双绿），待独立审查通过后由人类授权 rebase-merge。

> **编号说明：** 本仓库序号 001–037 已占用，**038 由模板仓库任务占用**，
> **039 为框架接入任务**（已完成归档回写并迁入 `tasks/done/`，提交 `1183145`）。
> 本任务取 **040**。

---

## Objective

在客户管理页数据列表中，为**已选中单行的客户**提供「续期」操作：把该客户到期时间顺延
1 / 3 / 6 / 12 个月（= **30 / 90 / 180 / 360 天**，与套餐档位 `planTiers` 同口径）或任意 1–3650 天，
并即时在列表反映。

**判定标准：** 选中一行 → 工具栏「视图」左侧「续期」按钮可用 → 打开对话框 →
选择时长 → 对话框显示续期后到期时间 → 确认 → 该客户「剩余天数」列更新为新值；
**未选中行 / 选中多行**时按钮禁用并给出对应提示。
（到期时间为空的客户**不禁用**——按「自今日起算」正常续期，rev3；见 Requirements R2。）

---

## Background

**用户指令（2026-10-16）：** 「在 shadcn 项目的客户管理页面中新增『续期』功能：当用户在数据列表中
选中某一行数据后，在现有『视图』按钮旁新增一个『续期』按钮；点击后弹出选择框，提供 1 个月、
3 个月、6 个月、12 个月四个快捷选项，并额外提供可手动输入天数的输入框。」
（同时明确：设计由主控负责，代码修改按 agent 协作规范执行、**交由其他会话**负责。）

**人类裁定（2026-10-16，两项，决定业务语义）：**

1. **时长口径（rev2）**：「一个月不等于自然月，主张与档位统一」
   ⇒ 快捷项按**套餐档位固定天数**（1/3/6/12 个月 = 30/90/180/360 天）计算，
   **本功能内部只有「天」一种单位**；首轮设计稿的「自然月（`addMonths`）」口径**作废**。
2. **「未设置到期时间」不设特例（rev3）**：「没有长期有效的选项 不需要」
   ⇒ **撤销**首轮设计的「`expireAt === null` 则禁用续期」规则；这类客户正常续期、
   基准取 `now`（与已过期同路径），界面显示 `未设置` + `（自今日起算）`。
   禁用矩阵由 4 条收敛为 **3 条**。**同时登记实证**：该状态在数据中可达
   （新建客户表单默认 `expireAt: null`；编辑表单留空即「长期有效（留空）」；列表显示「长期」）
   ⇒ 语义变化与其可见性要求见设计文档 F13 / §4.5 / L8。

**设计产物（本任务的设计阶段成果，权威）：**

- `docs/technical/customer-renewal.md` —— 交互、状态机、算法、边界、测试要求（**实施依据**，rev3）
- `docs/decisions/ADR-004-renewal-duration-semantics.md` —— 时长口径与基准语义决策
  （**`Accepted`**；D-1 / D-2 / D-3 **三项均已经人类裁定**）

**实查事实（决定本任务范围的关键结论，证据见设计文档 §2 的 F1–F13）：**

1. 客户到期时间字段 `Customer.expireAt: number | null`（epoch ms，`null` = **未设置到期时间**）；
   列表以 `daysLeft()` 派生「剩余 N 天 / 已过期 N 天 / 长期」。
   **该状态可达**（新建客户表单默认 `expireAt: null`；编辑表单留空即「长期有效（留空）」）
   ⇒ 续期必须对其定义行为，但**不**设禁用条件（人类裁定 rev3，设计文档 F13）。
2. **更新接口已具备全部所需能力**：`PATCH /api/customers/:id` 接受
   `customerInputSchema.partial()`（含 `expireAt`），`dateKeys` 自动完成 number ↔ Date 转换，
   并自动写通用日志。⇒ **本任务不需要任何服务端改动。**
3. 前端已有 `useUpdateCustomer()`，成功后 `invalidateQueries(['customers'])` ⇒ 列表自动刷新。
4. `date-fns` 已在依赖中（`addDays` 可用）⇒ **不新增依赖**；续期只用 `addDays`，
   `addMonths` 仍由 `splitPlanCycles` 使用、**不得因「未使用」移除导入**。
5. 「视图」按钮是通用组件 `DataTableViewOptions`，渲染在 `DataTableToolbar` 最右端
   （该工具栏被 6 处列表页复用）⇒ 位置需求需以**可选插槽**实现，不得改变既有调用方行为。
6. 套餐档位周期为**固定天数** 30/90/180/360（`planTiers`，`computeExpireAt` 亦用 `addDays`）；
   **续期快捷项即沿用该口径**（人类裁定），并由单测锁定对齐关系。代价是月末/闰年出现
   **刻意的日历漂移**，须登记为 Known Issue（L5）并明示「不得当作缺陷修正」。
7. 客户 `status` 与 `expireAt` **无自动联动**（服务端不存在 expired 扫描/回写）
   ⇒ 续期**不**改 `status`，须如实披露（L2）。
8. `expireAt === null` 的客户续期后被赋予**有限**到期时间（无约束 → 有限），
   且无专用流水可回溯（`L8`）⇒ 必须在对话框提交前呈现基准与新到期时间（设计文档 §4.5）。

**D13-C 承载（`.agents/rules/github.md` §2 豁免）：** TASK-039 已合并（PR #11，`main = 34d9d69`），
其归档回写按 D13-C **并入本任务的交付请求**（**第六实例**）。本任务同时是**第七实例的待回写方**
（合并后由下一个任务承载）。

---

## Scope

- 在客户列表工具栏「视图」按钮左侧新增「续期」按钮（含完整禁用矩阵与提示）。
- 新增续期对话框（快捷项 1/3/6/12 个月 = 30/90/180/360 天 + 手动天数输入 + 实时预览 + 确认/失败路径）。
- 新增常量与纯函数：`RENEW_PRESET_DAYS` / `RENEW_MAX_DAYS` / `parseRenewDaysInput` /
  `computeRenewedExpireAt`（含边界行为与「与 `planTiers` 对齐」的断言）。
- 为上述纯函数、对话框、按钮分别补测试（浏览器模式，沿用既有写法）。
- 设计文档与 ADR 随实现同步更新（ADR-004 三项决策均已获人类裁定，`Status` 已为 `Accepted`，无待决状态项）。
- **按 D13-C 在本分支承载 TASK-039 的归档回写**（`Status → DONE` + Merge Record 七要素 +
  迁 `tasks/review/` → `tasks/done/`），范围仅限 `tasks/**`。

## Non-Scope

- **不改服务端**（`server/**`）：`PATCH /api/customers/:id` 已足够（Background 事实 2）。
- **不改共享层**（`shared/src/**`）：`expireAt` 已在 `customerInputSchema` 内。
- **不新增依赖**、不改 `package.json` / `pnpm-lock.yaml`。
- **不新增页面/路由**、不手改 `src/routeTree.gen.ts`、不改 `src/components/ui/**`（shadcn 原语）。
- **不做批量续期**（多行选中时按钮禁用）——需另行定义「各客户时长如何取」的语义，属独立需求。
- **不支持缩短到期时间**（负数时长）——负面语义应走「编辑」表单。
- **不引入乐观锁**（不给 `PATCH` 加 `expectedUpdatedAt` 前置条件）——那是接口语义变更，
  须单独评估并更新 `api-contract.md`（设计文档 §4.7 已披露该限制）。
- **不新建续期专用审计表**——沿用 CRUD 通用日志。
- **不改套餐档位 30/90/180/360 天口径**——续期是**沿用**它（人类裁定），不是修改它。
- **不引入自然月（`addMonths`）续期路径**——已被人类否决（ADR-004 方案 A），
  凡改回自然月者属 ADR 重议范围，不得就地改代码。
- **不为 `expireAt === null` 增设禁用条件、专门按钮或专门入口**——已被人类否决（ADR-004 方案 E）。
- **不改客户编辑表单的到期时间字段**（含其「长期有效（留空）」占位与可清空行为）——
  属另一功能面；若产品决定取消该状态（改为必填），须另立任务（见设计文档 F13 的可达性实证）。
- **不改进 `.agents/**`、`templates/**`**（框架逐字快照只读，`AGENTS.md` §10）。

---

## Requirements

1. **按钮位置与形态**：紧邻「视图」按钮**左侧**（经 `DataTableToolbar` 的**可选** `actions` 插槽实现，
   缺省不影响其余 5 处调用方）；按钮**常驻显示**，仅按条件切换禁用，不隐藏。
2. **禁用矩阵（3 条）**，每条须给出对应提示文本：
   ① 未选中任何行；② 选中 ≥2 行（提示含实际行数）；
   ③ 恰好 1 个 id 但已不在当前数据集内（翻页/筛选/刷新后残留）。
   **判定必须使用 `table.getFilteredSelectedRowModel().rows`，禁止用 `rowSelection` 字典长度。**
   **不得**为 `expireAt === null`（未设置到期时间）增设禁用条件（人类裁定 rev3；见 R4 末项）。
3. **提示实现**：使用原生 `title`（**不用** Radix `Tooltip`——disabled 按钮不派发指针事件）；
   禁用时同时带 `aria-disabled`，`aria-label` 反映当前状态与客户名。
4. **对话框**：
   - 用 `@/components/ui/dialog`，标题 `续期 · <客户名>`；只读信息行显示当前到期与剩余/过期天数。
   - 快捷项用 `RadioGroup`：`1 个月` / `3 个月` / `6 个月` / `12 个月` + `自定义`（相邻 `Input`）
     + 手动天数输入框；默认选中 `1 个月`。
     **每个快捷项必须同时显示对应天数**（`1 个月 30 天`、`12 个月 360 天`）——强制项，不得省略。
   - **互斥且单一事实来源**：选择快捷项即清空手动输入；在输入框键入任意字符即自动切到「自定义」。
   - **校验**：手动天数须为 1–3650 的整数（`trim` 后 `^\d+$`）；空 / `0` / 负数 / 小数 /
     非数字（含 `1e3` / `+1` / 全角数字）/ `>3650` 一律无效 → 内联提示 + 确认按钮禁用。
     输入框用 `type='text'` + `inputMode='numeric'`（**不用** `type='number'`）。
   - **实时预览**：`续期后到期时间：<yyyy-MM-dd HH:mm>（+N 天）`；增量**恒以「天」表述**
     （不做 `+1 个月` 措辞）；基准为已过期时须显式标注 `（自今日起算）`。
   - **未设置到期时间（`expireAt === null`）**（rev3）：按钮**不禁用**，对话框正常打开；
     只读行显示 `当前到期：未设置`，预览同样标注 `（自今日起算）` 并给出具体新到期时间。
     **不得**为该情形禁用按钮、弹出拒绝提示或抛出异常。
   - **提交**：`useUpdateCustomer().mutateAsync({ id, input: { expireAt } })`，
     **载荷仅含 `expireAt` 一个键**（不得回传其它表单字段）。
   - **防重复**：`isPending` 期间确认与取消失效、对话框禁止 ESC/遮罩关闭；成功后关闭 + `toast.success`
     （含客户名、时长、新到期时间，且时长文案**含天数**）并保留行选中；失败时 `toast.error`
     且**对话框保持打开**。
5. **算法（唯一实现形态）**：
   `base = expireAt == null ? now : max(expireAt, now)`；`newExpireAt = addDays(base, days)`；
   快捷项天数取 `RENEW_PRESET_DAYS = { m1: 30, m3: 90, m6: 180, m12: 360 }`（与 `planTiers` 对齐，
   受单测锁定），自定义天数取 `parseRenewDaysInput`。纯函数签名
   `computeRenewedExpireAt(expireAt, days, now = Date.now())`，位于 `src/features/customers/utils.ts`。
   **不存在「月」的算法分支**（rev2）。
6. **更新方式**：只走既有 `PATCH`；**不改** `purchasedAt`（周期锚点）、`status`、
   流量字段与订阅字段；不触发订阅同步。
7. **测试**：纯函数（`parseRenewDaysInput` 全表 + 设计文档 §5.3 边界全表 + `RENEW_PRESET_DAYS`
   与 `planTiers` 的对齐断言，注入固定 `now`）、对话框（默认态 / 切换 / 按档位天数换算 /
   自动切自定义 / 非法输入 / 已过期基准 / 未设置基准（`expireAt: null`）/ 成功 / 失败 / 提交中）、
   按钮（禁用矩阵 3 条 + 未设置客户可用 + 打开路径）
   三组均须落地并实测通过。
8. **文档同步**：`docs/technical/customer-renewal.md` 补「已实现」状态与提交锚点；
   ADR-004 三项决策（D-1 / D-2 / D-3）均已获人类裁定并按 rev2 / rev3 改写，`Status` 已为
   **`Accepted`**（D-2 于 2026-10-16 经人类确认）——实施时**不得**再以 `Proposed` 描述本 ADR。
9. **提交流程**：分支自最新 `main` 派生；footer 含 `Refs: TASK-040`；**显式路径 `git add`**
   （禁 `git add -A` / `.`）；推远端后创建交付请求，描述覆盖模板全部字段；
   CI 必需检查 `install-lint-build` + `audit` 双绿。
10. **独立审查**：由**不携带实现上下文的新实例**执行（第 1 轮全量 + 第 2 轮定向），
    审查记录落 `handoffs/`；实现者不得自我批准（I2，受保护）；审查须**实跑**命令验证（§8 纪律）。
11. **D13-C 承载**：本分支同时承载 TASK-039 归档回写（范围仅 `tasks/**`），
    并在本任务 `Merge Record` 中标注「待下一个任务回填」。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 不新增依赖；UI 原语只能取自 `src/components/ui/`（禁手写新原语、禁手改既有原语）；`date-fns` 为唯一日期库 |
| 技术 | `DataTableToolbar` 的改动**只能是新增可选插槽**；不得改变既有 props 语义与 DOM 结构（6 处复用） |
| 兼容 | 无接口变更、无 schema 变更 ⇒ **不得**顺手改动 `api-contract.md` 或共享 zod schema |
| 口径 | 「N 个月」= 套餐档位固定天数 30/90/180/360（D-1，人类裁定）；**月末/闰年漂移属刻意行为**，不得改回 `addMonths`；快捷项天数与 `planTiers` 的对齐由单测锁定 |
| 语义 | `expireAt === null` **不设禁用条件**（D-3，人类裁定）：不禁用、不抛错；基准取 `now`，且对话框**必须**呈现 `未设置` 与具体新到期时间（不得静默改写） |
| 兼容 | 续期只推后到期时间，不得缩短客户权益；已过期客户不补算已过去的天数 |
| 安全 | 不引入任何密钥；`scripts/audit-repo.py` 的明文密钥扫描（A7）须保持 PASS |
| 流程 | I2：实现者 ≠ 批准者；合并需人类显式授权；D13-C：回写并入本任务交付请求 |
| 范围 | 设计文档 §6「明确不改」清单为硬边界；超出必须先更新 `File Scope` 并说明理由 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-039 归档回写（D13-C 第六实例） | 随本分支承载 | 已完成（PR #11 已合并，`main = 34d9d69`；回填口径见本文件 §D13-C 回填指引） |
| GitHub 分支保护 + CI（`install-lint-build` / `audit`） | external | 已配置（2026-10-14 起，`AGENTS.md` §14.4 与 `docs/operations/github-capability.md`） |
| 无未满足的 `blocks` 依赖 | — | ⇒ 本任务可进入实施 |

---

## Acceptance Criteria

- [ ] AC-1: 按钮位于「视图」左侧且常驻显示；`DataTableToolbar` 的 `actions` 插槽缺省时
      其余 5 处列表页（plans / emails / logs / notifications / subscriptions）DOM 与行为不变。
- [ ] AC-2: 禁用矩阵 **3 条**全部成立且有对应提示文本；「选中 1 行但该行已不在当前数据集」
      被判定为禁用（不得因读取 `rowSelection` 长度而误判为可用）；
      **`expireAt === null` 的客户按钮为可用**（rev3，不得出现第 4 条禁用条件）。
- [ ] AC-3: 对话框具备 4 个快捷项 + 手动天数输入；默认选中 1 个月；**每个快捷项显示对应天数**
      （`1 个月 30 天`）；快捷项与手动输入互斥（选择快捷项清空输入；键入即切自定义）；
      到期时间为空的客户打开对话框时只读行显示 `未设置`、预览含 `（自今日起算）`。
- [ ] AC-4: 手动天数校验覆盖 空 / 0 / 负数 / 小数 / 非数字（含 `1e3`、`+1`、全角）/ >3650，
      全部无效并禁用确认；输入框为文本型（非 `type='number'`）。
- [ ] AC-5: 到期时间计算严格符合 `base = max(expireAt, now)` + `addDays(base, days)`；
      快捷项天数 = 档位天数 30/90/180/360（单测对齐 `planTiers`）；设计文档 §5.3 的边界全表
      （含标注「刻意」的 4 行、已过期基准、`null`（未设置）基准、极值）全部有单测锁定，且**未**引入
      `addMonths` 续期路径（`utils.ts` 的 `addMonths` 仅服务于 `splitPlanCycles`）。
- [ ] AC-6: 提交载荷**仅含 `expireAt`**；成功后 `toast.success` + 关闭 + 保留选中 + 列表刷新；
      失败后 `toast.error` 且对话框保持打开；`isPending` 期间无重复提交路径。
- [ ] AC-7: 未改动 `server/**`、`shared/src/**`、`package.json`、`pnpm-lock.yaml`、
      `src/components/ui/**`、`src/routes/**`、`routeTree.gen.ts`（以 diff 为空为证）。
- [ ] AC-8: `pnpm lint`、`pnpm format:check`、`pnpm build`、`pnpm test` 全部本地通过
      （若浏览器不可用则如实披露由 CI 执行）；`python3 scripts/audit-repo.py` 全 PASS。
- [ ] AC-9: 分支已推远端；交付请求创建且描述覆盖模板全部字段；CI `install-lint-build` + `audit`
      双绿（run id 留痕，含「合并门禁以合并时点 head 的 run 为准」防腐注）。
- [ ] AC-10: 两轮独立审查记录落 `handoffs/`，阻断项关闭并经实跑复核；实现者未自我批准。
- [ ] AC-11: TASK-039 归档回写完成（`Status = DONE` + Merge Record 七要素 + 迁 `tasks/done/`），
      且本任务 `Merge Record` 已标注「待下一个任务回填（D13-C 第七实例）」。

---

## File Scope

```yaml
File Scope:
  - src/features/customers/components/customers-renew-dialog.tsx        # 新增
  - src/features/customers/components/customers-renew-dialog.test.tsx   # 新增
  - src/features/customers/components/customers-renew-button.test.tsx   # 新增
  - src/features/customers/utils.ts                                     # 新增纯函数与常量
  - src/features/customers/utils.test.ts                                # 增补用例
  - src/features/customers/components/customers-table.tsx               # 按钮 + 选中行派生 + 插槽传参
  - src/features/customers/components/customers-provider.tsx            # 对话类型 + 'renew'
  - src/features/customers/components/customers-dialogs.tsx             # 注册对话框
  - src/components/data-table/toolbar.tsx                               # 新增可选 actions 插槽
  - docs/technical/customer-renewal.md                                  # 设计文档（补实现状态）
  - docs/decisions/ADR-004-renewal-duration-semantics.md                # D-1 已裁定；D-2/D-3 确认后转 Accepted
  - tasks/review/TASK-040-customer-renewal/**                           # 任务档案与交接（已迁移至 review）
  - tasks/review/TASK-039-adopt-workspace-framework/**                  # D13-C 回写（Range 仅 tasks/**）
  - tasks/done/TASK-039-adopt-workspace-framework/**                    # D13-C 归档迁入
Non-Scope (files):
  - server/**                     # 服务端零改动
  - shared/**                     # 共享 schema 零改动
  - src/components/ui/**          # shadcn 原语禁改
  - src/routes/**  src/routeTree.gen.ts
  - package.json  pnpm-lock.yaml  vite.config.ts  .github/**
  - .agents/**  templates/**      # 框架逐字快照只读
  - docs/technical/api-contract.md   # 无接口变更
```

---

## Implementation Plan

> 设计已由主控位完成；下列步骤为**执行位**的实施顺序（执行位可细化，但不得改变
> 设计文档 §6「明确不改」清单与 §9 的 D1–D11 决策）。

| # | 步骤 | 产出 |
|---|------|------|
| 1 | 读本文件 + `docs/technical/customer-renewal.md` + ADR-004 + `AGENTS.md` §6/§10/§13；确认工作区状态 | 已读清单 |
| 2 | 自最新 `main`（`34d9d69`）派生 `feature/TASK-040-customer-renewal`；显式 `git add` 提交**主控位已落盘的设计产物**（本档案 + handoff + 2 份 docs），footer 含 `Refs: TASK-040` | 分支 + 首个提交 |
| 3 | `utils.ts` 新增常量与两个纯函数；`utils.test.ts` 补齐 §5.3 全表 + `parseRenewDaysInput` 全表 | 算法层（先测后接 UI 均可） |
| 4 | `DataTableToolbar` 新增可选 `actions` 插槽（缺省行为不变） | 通用层 |
| 5 | `customers-provider.tsx` 加 `'renew'`；新增 `customers-renew-dialog.tsx`；`customers-dialogs.tsx` 注册 | 对话框 |
| 6 | `customers-table.tsx` 派生 `selectedRows` / `selectedCustomer` / `renewDisabledReason`，接入按钮与插槽 | 入口 |
| 7 | 新增两份组件测试（对话框、按钮禁用矩阵） | 测试 |
| 8 | 本地验证：`pnpm lint` / `format:check` / `build` / `test` + `python3 scripts/audit-repo.py` | 原始输出 |
| 9 | 回填档案（Current State / Changed Files / Known Issues）→ 迁 `tasks/review/`（`Status = REVIEW`）→ 推送 → 创建交付请求（含 D13-C 回写提交） | PR |
| 10 | 两轮独立审查 + 整改（整改后须再审一轮定向） | handoffs |
| 11 | 人类授权后 rebase-merge → 合并后 CI 验证 + D8 复现 → TASK-039 回写完成 → 本任务 Merge Record 标注待回填 | main |

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 / AC-3 / AC-4 | 测试 + 人工 | `pnpm test`（组件测试用例名须对应设计文档 §7.2/§7.3）；人工核对按钮与「视图」的相对位置 |
| AC-2 | 测试 + 代码走查 | 按钮测试 3 条禁用用例 + 「`expireAt === null` 可用」用例；走查确认使用 `getFilteredSelectedRowModel()` 且**无**第 4 条禁用分支 |
| AC-5 | 测试 | `pnpm test` 中 `utils.test.ts` 的边界用例全数通过；逐条核对 §5.3 表 |
| AC-6 | 测试 + 走查 | 断言 `mutateAsync` 调用参数的键集合恰为 `{ id, input: { expireAt } }` |
| AC-7 | 命令 | `git diff origin/main --stat -- server shared/src package.json pnpm-lock.yaml src/components/ui src/routes src/routeTree.gen.ts`（预期无输出） |
| AC-8 | 命令 | `pnpm build:shared && pnpm lint && pnpm format:check && pnpm build && pnpm test`；`python3 scripts/audit-repo.py` |
| AC-9 | 命令 | `gh pr checks <n>`；run id 记入 handoff |
| AC-10 | 人工 | 读 `handoffs/` 两份审查记录，核对其中的**实跑**输出 |
| AC-11 | 命令 + 人工 | `git log --oneline -5`（回写提交在场）；读 `tasks/done/TASK-039-…/TASK.md` 的 Merge Record 七要素 |

---

## Current State

> **2026-10-16 —— 实施阶段完成（执行位 / Implementer），提交 e572da3。**
>
> **本地验证（全绿）：** `pnpm build:shared` ✅ / `pnpm lint` ✅ / `pnpm format:check` ✅ /
> `pnpm build` ✅ / **`pnpm test` 334 passed** ✅ / **`python3 scripts/audit-repo.py` 7 PASS** ✅。
>
> **代码改动（9 文件，与 File Scope 逐项吻合）：**
> `src/features/customers/utils.ts`（6 个导出：`RENEW_PRESET_DAYS` / `RenewPresetKey` / `RenewChoice` /
> `RENEW_MAX_DAYS` / `parseRenewDaysInput` / `computeRenewedExpireAt`）+ `utils.test.ts`（§5.3 全表）；
> `src/components/data-table/toolbar.tsx`（可选 `actions` 插槽）；`src/features/customers/components/`
> `customers-table.tsx`（按钮 + `renewDisabledReason`）+ `customers-provider.tsx`（`'renew'`）+
> `customers-dialogs.tsx`（注册）+ `customers-renew-dialog.tsx`（完整交互）+ `customers-renew-dialog.test.tsx`
> + `customers-renew-button.test.tsx`。
>
> **TASK-039 D13-C 第六实例（已完成，提交 `1183145`）：**
> `Status → DONE` + Merge Record 七要素实查（PR #11 / rebase-merge / 11 提交 /
> merged_at `2026-10-15T16:55:49Z` / merge_commit `34d9d69` / push run `38773072232` 双绿 /
> D8 第 10 次复现 / 两轮审查 O1–O4 / N1–N3 均已整改关闭 / 11 对 SHA 映射）+
> `git mv` → `tasks/done/TASK-039-adopt-workspace-framework/`（footer `Refs: TASK-039`）。
>
> **本任务 PR #12（2026-10-16）：**
> PR https://github.com/huyanluanyuqaq/shadcn-admin/pull/12（rebase-merge），head `f8264f3`；
> CI run `38908188715`（`audit` + `install-lint-build` 双绿）。
> 已执行两轮整改（`300c28d` 7 项 + `f8264f3` 4 项），状态：交付完整性缺陷全部关闭，待独立审查。
>
> **本档案修订后 Next Action：** 独立审查（新实例，I2）→ 整改（如有）→ 人类授权 rebase-merge。

---

## Changed Files

> 设计阶段（主控位，未提交）：4 个文件 —— 2 份 docs + 本档案 + 1 份 handoff。
> **rev2 / rev3 修订均在这 4 个文件内就地完成，未增减文件**（File Scope 与 D13-C 回写范围均未变）。
> **实施阶段（e572da3）：9 个文件，与 File Scope 逐项吻合。**

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `docs/technical/customer-renewal.md` | 新增（rev2） | 客户续期功能设计（权威实现依据；时长口径改为与档位统一的固定天数） |
| `docs/decisions/ADR-004-renewal-duration-semantics.md` | 新增（rev2） | 时长口径与基准语义决策（现为 **`Accepted`**；D-1 / D-2 / D-3 均已由人类裁定） |
| `tasks/review/TASK-040-customer-renewal/TASK.md` | 新增（rev2） | 本任务档案 |
| `tasks/review/TASK-040-customer-renewal/handoffs/HANDOFF-001-coordinator-to-implementer.md` | 新增（rev2） | 主控位 → 执行位派遣交接 |
| `src/features/customers/utils.ts` | 新增常量与纯函数 | `RENEW_PRESET_DAYS` / `RenewPresetKey` / `RenewChoice` / `RENEW_MAX_DAYS` / `parseRenewDaysInput` / `computeRenewedExpireAt` |
| `src/features/customers/utils.test.ts` | 增补用例 | §5.3 边界全表 + `parseRenewDaysInput` 全表 + `planTiers` 对齐断言 |
| `src/components/data-table/toolbar.tsx` | 新增可选插槽 | `actions?: React.ReactNode`（缺省行为不变，其余 5 处列表页无影响） |
| `src/features/customers/components/customers-table.tsx` | 新增按钮与插槽 | `selectedRows` / `selectedCustomer` / `renewDisabledReason`；向 `DataTableToolbar` 传 `actions` 插槽 |
| `src/features/customers/components/customers-provider.tsx` | 对话类型 + `'renew'` | `open` 联合类型新增 `'renew'` |
| `src/features/customers/components/customers-dialogs.tsx` | 注册对话框 | `CustomersRenewDialog`（按既有编排范式注册，key = `customer-renew-${id}`） |
| `src/features/customers/components/customers-renew-dialog.tsx` | 新增 | 续期对话框（完整交互：快捷项 + 手动天数 + 实时预览 + 校验 + 确认/失败路径） |
| `src/features/customers/components/customers-renew-dialog.test.tsx` | 新增 | 对话框 9 条交互与校验用例 |
| `src/features/customers/components/customers-renew-button.test.tsx` | 新增 | 按钮禁用矩阵 3 条 + `expireAt: null` 可用 + 打开路径 |
| `docs/technical/customer-renewal.md` | 补实现状态 | 补「已实现」状态与提交锚点（e572da3） |

---

## Known Issues

> 设计阶段已知限制（与设计文档 §8 的 L1–L8 一一对应）。实施完成后由执行位更新状态
> （保持为「已披露的接受项」或标注「已解决」）。

- **L1 并发覆盖（无乐观锁）**：`expireAt` 的更新为 last-write-wins，服务端无版本号校验；
  两会话同时编辑同一客户时后写者覆盖先写者。**不阻塞**；引入前置条件校验属接口语义变更，须另立任务。
- **L2 状态不联动**：客户 `status` 与 `expireAt` 无自动联动（服务端无 expired 扫描），
  续期**不会**把「已过期」改回「启用」，操作者需另行编辑。对话框不得暗示会自动修正。
- **L3 不支持批量续期**：选中多行时按钮禁用；批量续期需先定义「各客户时长如何取」，属独立需求。
- **L4 不支持缩短到期时间**：负面语义走「编辑」表单。
- **L5 月末/闰年日历漂移（rev2，刻意行为）**：快捷项按套餐档位固定天数计算（1/3/6/12 个月 =
  30/90/180/360 天），故 `2026-01-31` 续 1 个月 = **`2026-03-02`**（非 `02-28`）、
  `2026-08-31` 续 6 个月 = **`2027-02-27`**、12 个月 = 360 天比自然年短 5 天。
  **这是人类裁定「与档位统一」的固有代价，不是缺陷。** 缓解：快捷项显示天数 + 预览/toast 以「天」表述；
  需精确到某日时用自定义天数（如 365）或「编辑」。
  **★ 不得改回 `addMonths`**——那属于 ADR-004 方案 A 的重议范围。三处防线：本行 + 设计文档
  §8 L5 + ADR-004 负面第 1/2 条。
- **L6 无续期专用审计流水**：只能看到 CRUD 通用日志「更新客户 #id」，不含「原到期 → 新到期」。
- **L7 续期不触发订阅同步**：客户到期（`expireAt`）与订阅到期（`subscriptionExpireAt`）
  是两套独立字段，前者由本功能维护，后者由同步引擎维护。
- **L8 未设置到期时间（`expireAt === null`）的客户续期后由「无到期约束」变为有限到期（rev3）**：
  人类裁定不为其设禁用条件，故该语义变化是被允许的；而该状态**可达**
  （新建客户表单默认 `expireAt: null`；编辑表单留空即「长期有效（留空）」；列表显示「长期」）。
  一次续期即把「长期」改写为具体到期日，且无专用流水可回溯。
  **缓解：** 变更在提交前可见 —— 对话框只读行显示 `未设置`、预览追加 `（自今日起算）`
  并给出具体新到期时间（设计文档 §4.5 强制项）。
  **★ 不得**为「修正」此行为而恢复禁用条件或对 `null` 抛出——与人类裁定相悖；
  若业务后续要区分「真正的长期客户」，须另立任务（含数据侧如何表达）。
- **环境注记（非代码问题）**：本机 `pnpm build` 可能撞既有防误删保护
  （`[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]`，Vite 清空 `dist/assets` 超过 50 文件阈值）。
  处置：`mv dist /tmp/…` 后重建（TASK-036/037/039 同款）。CI 无此保护，不受影响。

---

## Merge Record

> **本任务的合并后回写由下一个任务按 D13-C 承载（第七实例）。**
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

## D13-C 回填指引（TASK-039，第六实例 —— 由本任务承载）

> 本任务分支须同时完成 TASK-039 的归档回写，**范围仅限 `tasks/**`**。
> 回填口径（来源：`2026-10-15` 工作日志与 TASK-039 档案，执行位须以 `gh` 实查复核后再落笔）：

| 要素 | 值（待执行位实查复核） |
|------|------------------------|
| PR | #11 |
| 合并策略 | rebase-merge |
| 提交数 | 11 |
| merged_at | `2026-10-15T16:55:49Z` |
| merge_commit_sha | `34d9d69`（= 合并后 `main` HEAD） |
| 合并后 CI | push run `38773072232` 双绿（`install-lint-build` + `audit`） |
| D8 解耦 | 第 10 次复现（该 head 无 Docker 运行） |
| 独立审查 | 两轮（第 1 轮全量 + 第 2 轮定向），O1–O4 / N1–N3 均已整改关闭 |
| SHA 映射 | 11 对（`6d8c731→5d89dfe` … `732ce22→34d9d69`，逐对 tree + subject 相同） |

**回写动作：** ① `tasks/review/TASK-039-…/TASK.md`：`Status: REVIEW → DONE`、填 Merge Record；
② 目录 `git mv tasks/review/TASK-039-… tasks/done/TASK-039-…`；
③ 该回写作为**独立提交**（footer `Refs: TASK-039`）随本任务分支推送。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | 主控位 | 执行位 | 2026-10-16 | 设计定稿并派遣：交付设计文档 + ADR-004 + 本档案；指令从 `utils.ts` 纯函数起步实施 |
| 001r | 主控位 | 执行位 | 2026-10-16 | **rev2 修订（同一交接就地更新）**：人类裁定「个月 = 档位固定天数」，单一口径 `addDays`；同步改写 4 份产物并新增「月末漂移属刻意行为」的审查纪律 |
| 001r2 | 主控位 | 执行位 | 2026-10-16 | **rev3 修订（仍在同一交接）**：人类裁定「不存在长期有效选项、不需要该规则」⇒ 撤销 `expireAt === null` 的禁用条件（矩阵 4→3 条），改为「不禁用 + 显示 `未设置`/`（自今日起算）`」；登记可达性实证与新 Known Issue L8 |
| 001r3 | 主控位 | 执行位 | 2026-10-16 | **rev4 状态确认（仍在同一交接）**：人类裁定「ADR-004 的 D-2 确认」⇒ 三项决策齐备、ADR-004 由 `Proposed` 转 `Accepted`；**无设计内容变更**，仅同步两份 ADR、两份设计文档与两份档案中的状态引用 |

| 002 | 执行位 | 主控位 | 2026-10-16 | 实施完成：e572da3 已提交（9 文件），本地验证全绿（334 test + audit 7 PASS）；档案回填 + HANDOFF-002 已写；PR #12 已创建，待独立审查后合并 |
| 002r | 执行位 | 主控位 | 2026-10-16 | **整改交付完整性缺陷（7 项）**：目录迁移 active→review / 档案自洽修正（Meta/Changed Files/File Scope/Handoff） / 设计文档状态更新 / PR #12 描述按模板重渲染 / gitignore 覆盖临时文件 / HANDOFF-002 补提交 |
| 002r2 | 执行位 | 主控位 | 2026-10-16 | **整改交付完整性缺陷（第二轮，4 项）**：Meta YAML 行首冗余竖线去除 / DESIGN→REVIEW 状态映射段改写 / Changed Files 2 行路径 active→review / ADR-004 路径同步 / 磁盘临时文件清理（提交 `f8264f3`） |
| 002r3 | 执行位 | 主控位 | 2026-10-16 | **整改交付完整性缺陷（第三轮，R1-R4）+ 主控位阶段 9 复审记录**：设计文档 §3.4 实现注记细化（`===1`→`>0`）/ TASK-039 归档状态更新 / Current State 补记 PR/CI/Next Action / PR #12 提交引用补全 / 2026-10-16-coordinator-recheck.md 入库（提交 `aa0a8a8`） |

**最新 Handoff：** `handoffs/2026-10-16-coordinator-recheck.md`
**Next Action：** 独立审查（不携带实现上下文的新实例）→ 整改（如有）→ 人类授权 rebase-merge → D13-C 第七实例回填 Merge Record。

---

## Task Rules

- [补充] 所有 Git 提交 footer 必须含 `Refs: TASK-040`；只用**显式路径** `git add`
  （禁 `git add -A` / `git add .`）。D13-C 回写提交的 footer 用 `Refs: TASK-039`。
- [补充] UI 原语一律取自 `src/components/ui/`；**禁止**手写新的 shadcn 原语或修改既有原语文件。
- [补充] 含 `FormLabel` 的表单字段**必须**包在 `FormControl` 内（TASK-018 既有陷阱）；
  本任务推荐用局部状态 + `<Label htmlFor>` / `<Input id>` 直接关联，**不引入** `react-hook-form`。
- [补充] 设计文档 §6「明确不改」清单为硬边界；确需越界必须先更新 `File Scope` 并在档案中说明理由。
- [增强] 独立审查按 I2 执行：实现会话不得出具审查结论；审查实例须**实跑**验证命令
  （`pnpm test` / `git diff` / 断言用例名），不得仅读描述（§8 框架纪律）。
- [增强] 合并需**人类显式授权**；执行位不得自行合并、不得直推 `main`。
- [增强] 本任务附带 D13-C 承载：回写范围**仅限 `tasks/**`**，不得借此夹带其它内容。

---

## Notes

- **设计文档是实施依据，本档案是范围与验收依据。** 两者冲突时以本档案的范围/验收为准，
  以设计文档的交互与算法为准；发现冲突须停下并回报主控位，不得自行择一。
- **本功能最容易被实现错的三个点（审查必查）：**
  ① 「选中一行」误用 `rowSelection` 字典长度（翻页后残留 id 导致误判）；
  ② 基准误写成一律 `now`（吞掉未过期客户的已付剩余时间 → 资损）；
  ③ 载荷回传整表单（把表单默认值误写成数据库真值）。
- **D-2（`base = max(expireAt, now)`）是业务语义决策**，不是实现细节：
  若有人主张「一律从今天重算」，须走 ADR-004 的方案重议，不得就地改代码。
  （D-1「个月」口径已由人类于 2026-10-16 裁定为**与档位统一的固定天数**；
  D-3「`expireAt === null` 不禁用、按今日起算」亦已由人类同日裁定 —— 两者均**不再**是待议项。）
- **★ 第四个易错点（rev2 新增，审查必查）：** 把月末/闰年的日历漂移（`1/31` + 30 天 = `3/2`）
  当成缺陷，改回 `addMonths` 或加月末 clamp。**这是刻意行为**，改动即越界（ADR-004 方案 A 重议范围）。
  同时注意：**不得**因「续期不用 `addMonths` 了」就移除 `utils.ts` 中 `addMonths` 的导入——
  `splitPlanCycles` 仍在用。
- **★ 第五个易错点（rev3 新增，审查必查）：** 给 `expireAt === null` 的客户「补」上禁用条件、
  拒绝提示或异常抛出（以为在防"长期被改写"）。**人类已裁定不需要该规则**；
  正确的做法是：不禁用 + 只读行显示 `未设置` + 预览显示 `（自今日起算）` 与具体新到期时间。
  审查时若发现禁用矩阵是 **4 条**（多出一条 null 条件），即为与裁定冲突。
- **口径对齐是结构性要求**：`RENEW_PRESET_DAYS` 与 `planTiers` 的对齐由单测锁定，
  档位若调整会阻断 CI，此时须**显式决策**（同步续期天数并更新文档），不得只改一侧。
- 实施完成后，本档案应补记：实际改动文件清单与统计、测试原始输出摘要、CI run id、
  两轮审查结论、以及 TASK-039 回写的完成证据（`git log` 与目标档案路径）。
