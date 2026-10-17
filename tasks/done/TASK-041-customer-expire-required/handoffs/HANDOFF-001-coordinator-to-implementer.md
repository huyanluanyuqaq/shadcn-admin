# HANDOFF-001 — 主控位（Coordinator / Architect）→ 执行位（Implementer）

> 本次交接只交付**设计**（不含任何代码改动）。

---

## Meta

```yaml
From: 主控位 / Coordinator（本会话，承担 architect）
To: 执行位 / Implementer（**另一个会话**，本会话不派生任何子代理）
Task: TASK-041 — 客户到期时间（expireAt）改为必填
Date: 2026-10-16
Current State: DESIGN
Previous Handoff: 无（首个交接）
```

---

## Completed Work

- **实查并定盘 12 项设计依据事实**（设计文档 `docs/technical/customer-expire-required.md` §2 的 F1–F12），
  其中决定范围的三项：
  - **共享 schema 创建与更新共用**：`customerInputSchema` 同时被 `crud.ts:197` 的 `safeParse`
    （POST）与 `:224` 的 `.partial()`（PATCH）使用 ⇒ 一次改动同时决定两个端点的语义；
  - **输出 schema 由输入派生**：`customerSchema = customerInputSchema.extend({...})`
    （`shared/src/schema/entities.ts:108`）⇒ 只改输入会让 `Customer.expireAt` 的类型**说谎**
    ⇒ **必须**在 `.extend({...})` 中显式覆写；
  - **冒烟脚本有 10 处**创建客户不带 `expireAt`（`server/scripts/smoke.ts` 行
    660 / 734 / 762 / 783 / 907 / 960 / 1005 / 1044 / 1080 / 1116）⇒ 若不动脚本，`smoke` 必红。
- **实跑 zod 4.3.6 探针**（临时脚本 `.zod-probe.cjs` 已删除，`git status` 已复原为
  「仅 TASK-040 的三个未跟踪路径」），得到三条、均写入设计文档 F12：
  1. `z.number({ error: '请选择到期时间' }).int()`：**缺键**与 `null` **都**报
     `invalid_type:请选择到期时间` ⇒ 中文文案可用（v4 已无 `required_error`）；
  2. 对含**对象级** `.refine()` 的 schema：`.partial` 仍是 `function`、`instanceof z.ZodObject`
     仍为 `true`，但**调用即抛** `Error: .partial() cannot be used on object schemas containing refinements`
     ⇒ **校验只能加在字段级**，否则每一次 PATCH 都会失败（本任务第一号陷阱）；
  3. 字段级 `.refine()` 不改变容器对象类型（`.partial()` 正常）；输出 schema 用 `.extend()`
     覆写同名字段有效（`{ expireAt: null }` 通过）。
- **产出设计文档** `docs/technical/customer-expire-required.md`（实施依据）：
  §2 事实 F1–F12（含实测）；§3 三层强制点（表单 / API 入参 / API 输出 / 数据库）与两条硬约束；
  §4 界面与交互（占位、移除清除按钮、日历 `required` 及其实测要求）；
  §5 历史数据处理（不回填、编辑即无效初值、刻意的代价）与**跨任务连带影响**（TASK-040）；
  §6 契约文档与冒烟脚本同步（逐行清单 + 两条新检查 + 跨任务注记）；
  §7 三组测试要求；§8 五项已知限制 L1–L5；§9 决策 D1–D8；§10 与 AC 的对应。
- **产出决策记录** `docs/decisions/ADR-005-customer-expire-required.md`（`Status: Accepted`，
  含**逐项授权记录**）：D-1 强制层级 = 表单 + API 入参（人类裁定）；D-2 历史 `null` 保留、
  不回填、编辑时补填（人类裁定）；D-3 列表 `null` 文案「长期」→「未设置」（**已由人类于 2026-10-16
  追认生效**，改动点仅一处）。方案 A（仅前端）、B（+DB `NOT NULL` + 回填）、C（不做变更）、
  D（输出也改必填）四个被否方案均记录理由。
- **登记任务档案** `tasks/active/TASK-041-customer-expire-required/TASK.md`：
  Meta（`Status: DESIGN`、`Requires Human Approval: true`）、Objective、Background（人类三项裁定与
  来龙去脉）、Scope / Non-Scope（含「不改订阅实体」「不写迁移」）、Requirements 1–12、Constraints、
  Dependencies（**TASK-040 为未满足的 `blocks` 依赖**）、AC-1–AC-15、File Scope、
  Implementation Plan 12 步、Verification Plan、Current State、Changed Files、
  Known Issues L1–L5、Merge Record（留空待第八实例回填）、
  **D13-C 回填指引（TASK-040 第七实例）**、Task Rules、Notes（五个易错点）。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `docs/technical/customer-expire-required.md` | 新增（未提交） | 客户到期时间必填设计（权威实现依据） |
| `docs/decisions/ADR-005-customer-expire-required.md` | 新增（未提交） | 强制层级与历史数据决策（`Accepted` + 逐项授权记录） |
| `tasks/active/TASK-041-customer-expire-required/TASK.md` | 新增（未提交） | 本任务档案 |
| `tasks/active/TASK-041-customer-expire-required/handoffs/HANDOFF-001-coordinator-to-implementer.md` | 新增（未提交） | 本交接 |

> 设计阶段产出，**均处于工作区未提交状态**（主控位不创建分支、不提交、不推送）。
> 执行位派生分支后需**显式路径** `git add` 下列 4 个路径并提交。

```bash
git add docs/technical/customer-expire-required.md \
        docs/decisions/ADR-005-customer-expire-required.md \
        tasks/active/TASK-041-customer-expire-required/TASK.md \
        tasks/active/TASK-041-customer-expire-required/handoffs/HANDOFF-001-coordinator-to-implementer.md
```

---

## Tests

```yaml
命令: 无（设计阶段不含代码改动，故无测试可跑）
结果: 不适用
覆盖: 不适用（唯一实跑项为 zod 4.3.6 行为探针，结论已记入设计文档 F12；脚本已删除）
未覆盖: 实施阶段必须落地设计文档 §7 的三组测试 ——
        ① 表单 schema（拒绝 null / 接受 Date；保留 :121 的纯函数映射断言并加注释）；
        ② 对话框（历史 null 客户「不补填被拦 / 补填成功」、新建不选到期时间被拦、
           「清除到期时间」按钮不存在、其余保存类用例夹具改为带 expireAt）；
        ③ 契约层（server/scripts/smoke.ts 新增两条：POST 缺 expireAt → 400、
           PATCH { expireAt: null } → 400），并跑 `pnpm --filter server smoke`。
**用例命名要求**: 「历史客户必须补填」相关用例名须含「历史」或「legacy」字样，
                以免后续读者按「能否跳过校验」的直觉把它删掉。
```

---

## Known Issues

- **设计阶段无阻塞项，但存在未满足的 `blocks` 依赖**：**TASK-040 必须先合并**。
  TASK-040 的续期对话框对 `expireAt === null` 有专门分支，而本任务改变该状态的可产生性
  ⇒ 两者必须**先后**落地。**在此之前本任务不得进入 `ACTIVE`。**
- **D-3（列表文案「长期」→「未设置」）已由人类追认生效**（2026-10-16，原话「ADR-005 的 D-3
  提议 改成「未设置」」）：**无撤销分支**，实施按「未设置」执行，改动点为
  `src/features/customers/components/customers-columns.tsx:147` 一处。
- **订阅实体的 `expireAt` 刻意保持可空**（`shared/src/schema/entities.ts:157`；
  其编辑表单与列表同样有「长期有效（留空）」/「长期」/清除按钮）：订阅到期由**同步引擎**写入
  （`server/src/services/subscription-sync.ts`），上游可能不返回，强制必填会与同步语义冲突。
  ⇒ **审查者不得将其判定为漏改**（设计文档 L4、档案 Non-Scope 均已明示）。
- **日历 `required` 的实际行为尚未实测**（本机无浏览器环境可跑设计期验证）：
  需执行位实跑确认它是否真的阻止「再次点击已选日期以取消选择」。若不生效或引入问题，
  **允许**退化为「只靠校验兜底」，但**必须**如实披露实际行为，不得写成「UI 上无法清空」。
- **数据库列仍可空**：保证强度止于 API 层（L2）。这是人类裁定「不回填历史数据」的直接后果，
  **不得**为此补写迁移。

---

## Remaining Work

- 全部代码改动：共享 schema（入参必填 + 输出覆写）、表单字段级 refine、界面三处
  （占位文案 / 移除清除按钮 / 日历 `required`）、列表文案（D-3）。
- 冒烟脚本：10 处载荷补**远期** `expireAt` + 新增两条契约检查。
- 测试落地与既有用例夹具调整。
- 文档：`api-contract.md` 的 `expireAt` 行更新（**与代码同提交**）；
  `customer-renewal.md` 补 1 行跨任务注记。
- 本地验证、推送、交付请求、两轮独立审查、合并（需人类授权）。
- **D13-C 第七实例**：本分支承载 TASK-040 的归档回写（范围仅 `tasks/**`）。

---

## Assumptions

1. **TASK-040 会先合并**，且其合并后 `tasks/review/TASK-040-customer-renewal/` 的 Merge Record
   可由本任务实查回填。若顺序变化（例如另有任务插入），D13-C 的承载方需重新指派——
   届时须回报主控位，不得自行改变承载关系。
2. **仓库内不存在 TASK-041 之外的 `POST /api/customers` 调用点**：已穷举为
   `server/scripts/smoke.ts` 的 10 处 + 前端 `useCreateCustomer`（经表单，已含校验）。
   假设本系统为内部应用、**无仓库外调用方**；若实际存在外部调用方，本任务的破坏性变更
   需补充兼容说明（ADR-005 负面第 1 条已登记）。
3. **zod 版本为 4.3.6**（`package.json` / `shared/package.json` / `server/package.json` 一致）。
   三条实测结论以该版本为准；若升级 zod 大版本，F12 的结论须重测。
4. **表单的校验拦截依赖 `zodResolver`**（`customers-action-dialog.tsx:157` 已确认在场）。
   若实施中改为受控校验（不使用 resolver），则「保存被拦 + 提示可见」的验收须改用等效证据。
5. **`expireAt` 允许是过去的时刻**（已过期客户是合法业务状态）⇒ 必填**只约束「非空」**，
   不施加「必须晚于今天」的时间约束。**不得**顺手加上未来时间校验。
6. 运行环境具备 Playwright Chromium（`pnpm test:browser:install` 已执行过）；若缺失，
   浏览器模式测试将全部失败，属环境问题而非代码缺陷（`AGENTS.md` §13.4）。

---

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **把校验写成对象级 `.refine()`** | **高**（`crud.ts:224` 的 `.partial()` 抛错 ⇒ 每次 PATCH 失败） | 设计文档 §3 硬约束 1 + F12-②（zod 4.3.6 实跑证据）+ 档案 Task Rules 第一条；冒烟 PATCH 用例兜底 |
| 漏改**输出 schema** 覆写 | 中（`Customer.expireAt` 类型说谎，历史数据展示逻辑被误简化） | 设计文档 §3 表格 + AC-3 走查（核对 `.extend({...})` 中该字段在场） |
| 冒烟 10 处漏补 / 用「近期」时间 | 中（CI 红；或注入到期提醒扰动提醒类与统计类断言） | 设计文档 §6.1 给出**逐行清单**；约定 `Date.now() + 3650 * 86400000` |
| **为让既有测试通过而放宽校验** | **高**（假达成：界面看似必填、实际可空） | 档案 Task Rules + AC-9（核对**用例名**与断言，而非通过率）+ 本 handoff 的用例命名要求 |
| 顺手把**订阅实体**一起改 | 中（与同步引擎语义冲突） | Non-Scope 与 L4 明示；本 handoff 已列为「审查者不得判定为漏改」项 |
| 因「`null` 不再产生」而删掉读取路径的判空 | 中（历史数据命中即崩） | 设计文档 §5.5 / Constraints 明示：`daysLeft` / `splitPlanCycles` / `isNotNull` 过滤**不得**改 |
| 在 TASK-040 合并前就派生分支开工 | 中（D13-C 无内容可回填；两任务在途互相影响） | Dependencies 明确 `blocks`；Implementation Plan 步骤 2 为前置校验；档案 Meta 已写「不得进入 `ACTIVE`」 |

---

## Next Action

**第一步（可立即执行，但在 TASK-040 合并前只允许做到「确认」这一步）：**

```bash
# 0) 确认前置依赖：TASK-040 是否已合并（未合并则停下并回报主控位，不得开工）
gh pr list --state all --json number,title,state,mergedAt,mergeCommit | head -40
git ls-remote --heads origin                     # 远端默认分支
git merge-base --is-ancestor <TASK-040 的 merge_commit> origin/main && echo "已含 TASK-040"

# 1) 自最新 main 派生分支
git fetch origin --prune '+refs/heads/*:refs/remotes/origin/*'
git switch -c refactor/TASK-041-customer-expire-required origin/main

# 2) 提交主控位已落盘的 4 份设计产物（显式路径，禁 git add -A）
git add docs/technical/customer-expire-required.md \
        docs/decisions/ADR-005-customer-expire-required.md \
        tasks/active/TASK-041-customer-expire-required/TASK.md \
        tasks/active/TASK-041-customer-expire-required/handoffs/HANDOFF-001-coordinator-to-implementer.md
git commit -m "docs(TASK-041): 客户到期时间必填设计与任务档案

强制层级定为表单 + API 入参（ADR-005）：入参 schema 必填、输出 schema 显式覆写保持可空、
数据库列与历史 null 数据保持不动。

Refs: TASK-041"
```

**随后：** 按 TASK-041 `Implementation Plan` 步骤 3 起实施——
先改 `shared/src/schema/entities.ts` 的两处（入参必填 + 输出覆写）并 `pnpm build:shared`，
再改表单 schema 与界面，最后补冒烟与测试。

---

## References

- [客户到期时间必填设计](../../../../docs/technical/customer-expire-required.md) — 实施依据（§3 硬约束、§7 测试要求）
- [ADR-005](../../../../docs/decisions/ADR-005-customer-expire-required.md) — 强制层级与历史数据决策（含四个被否方案）
- [TASK-041 档案](../TASK.md) — 范围与验收依据（唯一事实来源）
- [TASK-040 设计文档](../../../../docs/technical/customer-renewal.md) — 续期；其 `null` 分支与本任务相互作用（本任务须补 1 行注记）
- [接口契约](../../../../docs/technical/api-contract.md) — `customers` 字段类型表（须更新 `expireAt` 行）
- `server/src/lib/crud.ts:197,224` — POST 的 `safeParse` 与 PATCH 的 `.partial()`（对象级 refine 陷阱的来源）
- `server/scripts/smoke.ts:660,734,762,783,907,960,1005,1044,1080,1116` — 10 处须补 `expireAt` 的载荷
