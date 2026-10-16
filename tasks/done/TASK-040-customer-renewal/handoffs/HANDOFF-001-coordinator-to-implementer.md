# HANDOFF-001 — 主控位 → 执行位

---

## Meta

```yaml
From: 主控位 / Coordinator（本会话，承担 architect）
To: 执行位 / Implementer（**另一个会话**，本会话不派生任何子代理）
Task: TASK-040 — 客户管理页新增「续期」功能
Date: 2026-10-16
Revision: rev4（同会话就地更新，非新增交接：rev2 = 「个月」与档位统一为固定天数；rev3 = 撤销 `expireAt === null` 的禁用规则；rev4 = 人类确认 D-2，ADR-004 转 `Accepted`，无设计内容变更）
Current State: DESIGN
Previous Handoff: 无（首个交接）
```

---

## Completed Work

> 本次交接只交付**设计**（不含任何代码改动）。**rev2** 否决了首轮设计稿的「自然月」口径；
> **rev3** 又撤销了首轮设计稿的「`expireAt === null` 禁用续期」规则；**rev4** 依人类裁定
> 「ADR-004 的 D-2 确认」将 ADR-004 转 `Accepted`（**无设计内容变更**）。
> 下列产物均已按 **rev4** 同步完毕（三次修订均为就地更新，文件集合不变）。

- **实查并定盘 13 项设计依据事实**（设计文档 `docs/technical/customer-renewal.md` §2 的 F1–F13），
  其中决定范围的三项：
  - `PATCH /api/customers/:id` 用 `customerInputSchema.partial()` 校验、`dateKeys: ['expireAt','purchasedAt','subscriptionExpireAt']`
    自动转换时间戳、并自动 `writeLog`（`server/src/lib/crud.ts:220-247`；`server/src/routes/resources.ts:57-70`）
    ⇒ **本任务服务端零改动**；
  - 前端 `useUpdateCustomer()` 成功后 `invalidateQueries(['customers'])`（`src/features/customers/api.ts:93-107`）
    ⇒ 无需手工刷新列表；
  - `date-fns ^4.1.0` 已在依赖（`package.json:59`）⇒ **不新增依赖**。
- **产出设计文档** `docs/technical/customer-renewal.md`（rev3）：
  §3 按钮位置/形态/选中行解析/**禁用矩阵 3 条**/提示实现取舍；
  §4 对话框布局（**快捷项强制显示对应天数**）、状态模型（互斥且单一事实来源）、校验全表、
  实时预览（增量恒以「天」表述；基准三态：顺延 / 已过期 / **未设置**）、确认与失败路径、
  并发与陈旧快照披露；
  §5 计算模型（**单一口径 `addDays`** + 单一基准表达式）与逐项理由、纯函数签名与
  「与 `planTiers` 对齐」的单测约束、边界全表（**含 4 行刻意漂移用例**）、写入路径与字段级副作用；
  §6 文件清单；§7 三组测试要求；§8 **八项**已知限制；§9 决策 D1–D11 + D5b + D6b；§10 与验收标准的对应。
- **产出决策记录** `docs/decisions/ADR-004-renewal-duration-semantics.md`（**`Status: Accepted`**，
  含 **逐项授权记录**）：决策 **D-1 固定天数、与套餐档位统一（已由人类裁定生效，rev2）** /
  **D-2 `base = max(expireAt, now)`（已由人类裁定生效，第三轮确认）** /
  **D-3 `expireAt === null` 不设特例、不禁用、按 `now` 起算
  且界面呈现基准（已由人类裁定生效，rev3）**；
  方案 A（自然月）与方案 E（`null` 禁用）为**被否项**，方案 B/D 的被否理由保留，方案 C 记录
  「原被否 → rev3 转采纳」的沿革与缓解依据；
  Consequences 逐条登记月末/闰年漂移（`1/31` + 30 天 = `3/2` 等）与 `null → 有限期` 的语义变化；
  Risks 表列出实现期高危偏差（**改回 `addMonths`**、基准误写成一律 `now`、
  **恢复 `null` 禁用条件**、**对话框漏呈现基准致静默改写**）。
- **登记任务档案** `tasks/active/TASK-040-customer-renewal/TASK.md`：
  Meta（`Status: DESIGN` + `Revision: rev3`）、Objective、Background（含人类两项裁定与设计产物索引/8 项实查事实）、
  Scope / Non-Scope（含「不引入自然月续期路径」「不为 `null` 增设禁用条件」「不改客户表单到期时间字段」）、
  Requirements R1–R11、Constraints（口径行 + 语义行）、
  Dependencies、AC-1–AC-11、File Scope（含 D13-C 回写路径）、Implementation Plan 11 步、
  Verification Plan、Current State（含 rev2 + rev3 修订记录与可达性实证）、Known Issues L1–L8、
  Merge Record（留空待第七实例回填）、**D13-C 回填指引（TASK-039 第六实例）**、Task Rules、
  Notes（五个最易实现错的点：第四点为 rev2 新增，第五点即 rev3 新增）。

---

## Changed Files

> 设计阶段产出，**均处于工作区未提交状态**（主控位不创建分支、不提交、不推送）。
> 执行位派生分支后需**显式路径** `git add` 下列 4 个路径并提交。
> **rev2 / rev3 都是对这 4 个文件内容的就地修订，未增减文件** ⇒ 提交路径与 File Scope 均不变。

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `docs/technical/customer-renewal.md` | 新增 | 客户续期功能设计（权威实现依据） |
| `docs/decisions/ADR-004-renewal-duration-semantics.md` | 新增 | 时长口径与基准语义决策（`Accepted`；D-1 / D-2 / D-3 均已由人类裁定） |
| `tasks/active/TASK-040-customer-renewal/TASK.md` | 新增 | 任务档案（唯一事实来源） |
| `tasks/active/TASK-040-customer-renewal/handoffs/HANDOFF-001-coordinator-to-implementer.md` | 新增 | 本文件 |

**未改动：** 代码层零改动（`src/`、`server/`、`shared/`、`.github/`、依赖文件均未触碰）。

---

## Tests

```yaml
命令: 无（设计阶段不含代码改动，故无测试可跑）
结果: 不适用
覆盖: 不适用
未覆盖: 实施阶段必须落地设计文档 §7 的三组测试（纯函数 utils.test.ts /
        对话框 customers-renew-dialog.test.tsx / 按钮 customers-renew-button.test.tsx），
        其中 §5.3 边界全表（含标注「刻意」的 4 行、`expireAt: null` 基准）与
        `RENEW_PRESET_DAYS`↔`planTiers` 对齐断言为必测项，
        且所有时间用例须注入固定 now（不得依赖运行时刻）；按钮侧须含
        「`expireAt: null` 客户为**可用**」用例（rev3）。
**用例命名要求**: 锁定「刻意漂移」的用例名须含「刻意」或「tier-aligned」字样，
                以免后续读者按「正确性」直觉删改（rev2 新增纪律）。
```

> 设计阶段执行的**只读核查命令**（供执行位复核，全部为本机实跑）：
> `grep -rn "视图" src/`、`grep -n "customerInputSchema" -A 40 shared/src/schema/entities.ts`、
> `grep -rn "createCrudRoutes" server/src/`、`grep -rn "expired" server/src/`（无匹配）、
> `grep -rn "planTiers|planTierSchema" shared/src/schema/*.ts`、
> `grep -rn "长期" src/features/customers/`（⇒ 命中 `customers-action-dialog.tsx:687`「长期有效（留空）」与
> `customers-columns.tsx:147`「长期」，即 rev3 所述可达性证据）、
> `sed -n 115,125p src/features/customers/data/schema.ts`（≫ 新建默认 `expireAt: null`）、
> `git ls-remote --heads origin`（远端仅 `main`）、`git status --short`（干净）。

---

## Known Issues

- **设计阶段无阻塞项。** 设计文档 §8 的 L1–L8 与档案 `Known Issues` 一一对应，均为**已披露的接受项**，
  不构成实施阻塞。其中 L1（无乐观锁，last-write-wins）、**L5（月末/闰年漂移，刻意）** 与
  **L8（`null` 客户续期后变有限期）** 需要**实现者不得自行"顺手修复"** ——
  L1 属接口语义变更，L5 属 ADR 重议范围（方案 A），**L8 属人类已裁定项（方案 E 被否）**。
  **★ L5 的 `1/31` + 30 天 = `3/2` 不是缺陷；改回 `addMonths` 即越界。
  ★ L8 的 `null` 可续期不是缺陷；恢复禁用条件或对 `null` 抛错即越界。**
- **ADR-004 已为 `Accepted`**：**D-1（rev2）/ D-2（第三轮确认）/ D-3（rev3）三项均已由人类裁定生效**，
  无任何待决状态项。实施按 ADR-004 方案逐字执行即可；**不得**再以 `Proposed` 描述本 ADR。
- **`DataTableToolbar` 是 6 处复用的通用组件**：插槽必须为**可选**且缺省行为/DOM 完全不变，
  否则会波及 plans / emails / logs / notifications / subscriptions 五个列表页。

---

## Remaining Work

- 全部代码改动与测试落地（Implementation Plan 步骤 3–7）。
- 本地验证（步骤 8）：`pnpm build:shared` → `lint` → `format:check` → `build` → `test` +
  `python3 scripts/audit-repo.py`。
- 档案回填 + 迁 `tasks/review/`（`Status = REVIEW`）+ 推送 + 创建交付请求（步骤 9）。
- 两轮独立审查与整改（步骤 10，由新实例承担，实现者不得自我批准）。
- **D13-C 第六实例（TASK-039 归档回写）**：`Status: REVIEW → DONE` + Merge Record 七要素 +
  `git mv tasks/review/TASK-039-… tasks/done/TASK-039-…`，作为独立提交随本任务分支推送
  （口径见 TASK-040 档案的「D13-C 回填指引」，**须以 `gh` 实查复核后再落笔**）。
- 人类授权后 rebase-merge + 合并后 CI 验证 + D8 复现核查（步骤 11）。

---

## Assumptions

1. **「选中某一行」= 通过行勾选框或行点击产生的**单选状态**，以
   `table.getFilteredSelectedRowModel().rows.length === 1` 为准**（与既有批量操作读取选中行的范式一致）。
   若产品意图是「点击行即续期」（不依赖勾选），则 §3.3 的判定改为读取 `expandedId`，
   属需求变更，须回报主控位再审。
2. **「1/3/6/12 个月」= 套餐档位固定天数**（30/90/180/360 天），**不是自然月** ——
   该口径已由人类于 2026-10-16 裁定（原话：「一个月不等于自然月，主张与档位统一」），
   即 ADR-004 决策 D-1，**已生效、不可再按自然月实施**。⇒ 后果：月末/闰年出现**刻意的**日历漂移
   （`1/31` + 30 天 = `3/2`），且 12 个月 = 360 天 ≠ 365 天。此为已知并被接受的代价，不得修正。
3. **`expireAt === null`（未设置到期时间）的客户不禁用、正常续期**，基准取 `now`，
   只读行显示 `未设置`、预览显示 `（自今日起算）` —— ADR-004 决策 D-3，
   **已由人类于 2026-10-16 裁定**（原话：「没有长期有效的选项 不需要」），**不可再按"禁用"实施**。
   同时**如实登记**：该状态在数据中可达（表单默认值/留空即长期），故续期会把这类客户
   由「无约束」改为有限到期（L8）—— 界面呈现基准是**强制项**（ADR-004 实现约束 3）。
4. **续期不改变客户状态**（`status`），不触发订阅同步，不改 `purchasedAt`（周期锚点）。
5. 列表数据在「点击续期按钮」到「确认」之间可能被重新拉取，届时以**点击时刻**的行快照为基准计算。
6. 运行环境具备 Playwright Chromium（`pnpm test:browser:install` 已执行过）；若缺失，
   浏览器模式测试将全部失败，属环境问题而非代码缺陷（`AGENTS.md` §13.4）。

---

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 基准误写成一律 `now`（未过期客户被吞掉已付剩余时间） | **高**（资损 + 信任） | 设计文档 §5.1 逐项理由 + §5.3 前两行必测；审查必查 `max(expireAt, now)` 在场 |
| **改回 `addMonths`（回到自然月，与已裁定的 D-1 相悖）** | 中（口径分叉，月末结果与套餐档位不一致） | 单测锁定 `2026-01-31` + 30 天 = `2026-03-02`；审查须核对**用例名**与 `addDays` 调用 |
| **把月末/闰年漂移当缺陷「顺手修复」** | 中（越界，须走 ADR 重议） | ADR-004 负面第 1/2 条 + 设计文档 §8 L5 + 档案 Notes 三处声明「刻意行为」 |
| **恢复 `null` 禁用条件 / 对 `null` 抛错**（与 rev3 的 D-3 相悖，即回到方案 E） | 中（与人类裁定冲突；`null` 是新建默认值，禁用会把正常操作变两步） | 设计文档 §3.4 rev3 说明 + §7.3「可用」用例 + 档案 Notes 第五点；审查须核对禁用矩阵确为 **3 条** |
| **对话框未呈现基准或未显示新到期时间** ⇒ `null` 客户的语义变更成为静默改写（L8） | 中（客户权益层面不可见） | ADR-004 实现约束 3（强制项）+ 设计文档 §4.5 + §7.2「未设置」用例；审查须核对只读行与预览文案 |
| 快捷项天数与 `planTiers` 脱钩（改一处忘另一处） | 中（口径静默分叉） | `RENEW_PRESET_DAYS` 的对齐单测；档位变更会阻断 CI |
| 「选中一行」误用 `rowSelection` 字典长度 | 中（翻页后误判可用/不可用） | 设计文档 §3.3 易错点标注 + 按钮测试用例 ③ |
| 载荷回传整表单 | 中（把表单默认值误写为数据库真值） | 设计文档 §4.6 载荷规则 + 测试断言键集合 |
| **误删 `utils.ts` 的 `addMonths` 导入**（以为续期不再需要） | 低（`splitPlanCycles` 编译失败，通常立即暴露） | 设计文档 §2 F11 + ADR-004 实现约束 4 已明示该导入仍被使用 |
| 擅自「顺手修复」L1 并发 | 中（越界，触发接口变更） | Task Rules 硬边界 + 本 handoff Known Issues 明示 |
| `DataTableToolbar` 插槽改动破坏其余 5 处列表页 | 中 | 插槽必须可选；AC-1 要求以 diff 与人工核对证明既有调用方无变化 |
| 边界无测试（仅测"能跑通"） | 中 | AC-5 要求 §5.3 全表覆盖；审查须核对**用例名**而非通过率 |

---

## Next Action

**执行位第一步（可立即执行）：**

```bash
# 1) 确认工作区与基线（应见 4 个未跟踪的设计产物；main = 34d9d69）
cd E:/NDLDSN-WORKSPACE/projects/shadcn-admin
git status --short && git log --oneline -1 && git ls-remote --heads origin

# 2) 自最新 main 派生任务分支（远端仅 main，无需先 fetch 合并）
git checkout -b feature/TASK-040-customer-renewal

# 3) 显式路径提交设计产物（禁 git add -A / .）
git add docs/technical/customer-renewal.md \
        docs/decisions/ADR-004-renewal-duration-semantics.md \
        tasks/active/TASK-040-customer-renewal
git commit -m "docs(TASK-040): 客户续期功能设计与任务档案

时长口径按人类裁定与套餐档位统一为固定天数（1/3/6/12 个月 = 30/90/180/360 天）；
基准语义为「原到期顺延」，到期时间为空的客户不禁用、按今日起算；
并登记禁用矩阵（3 条）、对话框交互与边界测试要求（ADR-004）。

Refs: TASK-040"
```

**随后：** 按 TASK-040 `Implementation Plan` 步骤 3 起，先实现并测试
`src/features/customers/utils.ts` 的 `RENEW_PRESET_DAYS` / `parseRenewDaysInput` /
`computeRenewedExpireAt`（含 §5.3 边界全表与 `planTiers` 对齐断言），再接 UI。

---

## References

- `tasks/active/TASK-040-customer-renewal/TASK.md` — 任务档案（**唯一事实来源**，先读）
- `docs/technical/customer-renewal.md` — 功能设计（实现依据）
- `docs/decisions/ADR-004-renewal-duration-semantics.md` — 时长口径与基准语义决策
- `AGENTS.md` §6（测试命令）/ §10（项目规则）/ §13（易错点）/ §14（GitHub 协作）
- `docs/agent-collaboration.md`、`docs/git-workflow.md`、`docs/operations/agent-constraints.md`
- `.agents/rules/github.md` §2（D13-C 承载豁免）/ §6（合并后回写）；`.agents/protocols/dual-agent-model.md`（I2）
- 既有实现参照：`src/features/customers/components/customers-table.test.tsx`（测试写法）、
  `customers-multi-delete-dialog.tsx`（选中行读取范式）、`customers-dialogs.tsx`（对话框编排范式）
- 待回写目标：`tasks/review/TASK-039-adopt-workspace-framework/TASK.md`（D13-C 第六实例）
