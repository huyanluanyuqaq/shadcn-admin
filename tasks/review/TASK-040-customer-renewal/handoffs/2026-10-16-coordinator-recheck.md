# 2026-10-16 主控位复审记录 —— TASK-040 客户续期（阶段 9 整改后复核）

> ⚠️ **本文件不是 AC-10 所要求的「独立审查记录」**，**不得被计为** AC-10「两份审查记录」之一。
> AC-10 的独立审查记录由**不携带实现上下文的新实例**出具，**另起文件**（约定名 `2026-10-16-review.md` 或其后日期）。

---

## Meta

```yaml
Type: 主控位复审记录（阶段 9「整改与复审」产出）
Task: TASK-040 — 客户管理页新增「续期」功能
Date: 2026-10-16
出具位: 主控位 / Coordinator（Reviewer 角色的载体，见 dual-agent-model.md §2）
被审对象: feature/TASK-040-customer-renewal @ f8264f3（PR #12，OPEN）
基线: origin/main = 34d9d69
框架依据:
  - protocols/github-collaboration.md §2（handoffs/ = 交接、审查、整改记录的载体）
  - protocols/github-collaboration.md §4 阶段 8「主控审查」/ 阶段 9「整改与复审」
  - protocols/dual-agent-model.md §2（主控位 ↔ Reviewer 角色映射）、§3 C8/C9
范围: ① 上一轮 6 项整改派单的完成度复检；② AC-1–AC-11 全量判定；③ 规格一致性抽查
```

---

## 审查位自证（纯度声明，必读）

### 1. 两个层级分开判定：本记录满足什么、不满足什么

| 层级 | 要求（出处） | 本记录 |
|------|-------------|--------|
| **流程层·框架基线** | `github-collaboration.md` §5：「审查必须由**与实现不同的会话或实例**完成」 | ✅ **满足** —— 本记录出自主控位会话；实施该变更的是**执行位会话**，二者并非同一会话 |
| **AC-10·本任务加严** | `TASK.md` AC-10：**两轮独立审查**；`dual-agent-model.md` §5.1 的纯度标准 = **不携带实现上下文的新实例** | ❌ **不满足** —— 本记录出自本任务的**设计作者**，且在前两轮门禁核对中已读过实现代码 |

⇒ 本记录 = **阶段 9 复审记录**；AC-10 的独立审查记录是**另一件东西**。**两者不得混用、不得相互替代。**

### 2. 关于「是否违反 I2」—— 澄清（回应执行位 2026-10-16 的质疑）

- `dual-agent-model.md` §5 的 I2 原文：「**实现者** ≠ 批准者 —— **实施该变更的实例**不得批准或验收同一变更」；
  `rules/github.md` §7 的受保护条目同样只约束「**由实现者**批准自己提交的交付物」。
- **本记录不是实现者出具的** —— 实现由执行位会话完成，本记录出自主控位会话。
- 且 `dual-agent-model.md` §2 明确把 **Reviewer 列入主控位的角色映射**；§3 C8（审查交付物，读实际差异）
  与 C9（提出整改要求并**复审**整改结果，载体 `handoffs/`）本就是主控位职责。
- ⇒ **本记录不构成 I2 违反。** `rules/github.md` §9 与 `dual-agent-model.md`「与项目规则的关系」所列的
  I2 受保护条目，约束对象是**实现者**，不是主控位；受保护规则优先级（`rule-precedence.md` §3）**在本案未被触发**，
  因为它与本次派单指令**并不冲突**。
- **需要如实披露的不是「I2 被违反」，而是「AC-10 的独立性尚未满足」** —— 这是**另一条轴**，见上表第 2 行。

### 3. 自我约束

- **全部结论以实跑命令为准**（见附录 A），不采信任何交接记录 / 提交信息 / 档案中的自述；
  凡「声称已做某事」的条目一律复跑验证（§1 即为对第二轮整改的复检）。
- **★ AC-10（两轮独立审查）在本记录出具时仍未满足**，须由新实例执行（见 §5）。

---

## 1 整改复检（对上一轮 6 项派单逐项实跑）

| # | 派单项 | 结论 | 证据 |
|---|--------|------|------|
| 1 | `TASK.md:13` Meta 去掉行首多余竖线 | ✅ **已完成** | 现为 `Status: REVIEW（…）`；`grep -n '^| Status:'` 无命中 |
| 2 | `TASK.md:35–36` 删除 `DESIGN`/`active/` 旧表述 | ✅ **已完成** | 现为「本任务当前为 `REVIEW`（`review/`）：实施阶段已完成（提交 e572da3）…待独立审查通过后由人类授权 rebase-merge」 |
| 3 | `TASK.md:356–357` Changed Files 两行路径 → `review/` | ✅ **已完成** | `git diff f8264f3~1 f8264f3` 逐行确认 |
| 4 | `ADR-004:338` 引用路径 → `review/` | ✅ **已完成** | 同上 |
| 5 | 清理磁盘 8 个 `.task040-*` 临时文件 | ✅ **已完成** | `ls .task040-*` → 无残留；`.gitignore` 条目保留 |
| 6 | `gh pr edit 12` 补列整改提交 `300c28d` | ❌ **未执行** | PR #12 body L4「提交引用」仍只列 `5d74064` `e572da3` `4f6c94c` `1183145`；缺 `300c28d`、`f8264f3` |

- **诚实性**：第二轮提交 `f8264f3` 的 message 明确写「上一提交该项声明有误，本轮修正」——
  对上一轮「Meta 行首 `|` 已去除」的**虚假声明**作了如实更正 ✅（符合 §8「声称已改但未做」纪律的修复要求）。
- **历史性路径豁免**：`HANDOFF-001` 内 5 处 `tasks/active/TASK-040-…` 属**当时**的交接记载，
  按「引号内元描述引用是合格历史记载」原则**不视为缺陷**，不得据此要求改写。

---

## 2 验收准则逐项判定（AC-1 … AC-11）

| AC | 判定 | 依据（实跑） |
|----|------|-------------|
| AC-1 按钮位置 + 插槽缺省不影响其余 5 处 | ✅ | `toolbar.tsx` diff：`actions` 缺省走原分支，**DOM 与改动前逐字相同**；仅新增可选 prop |
| AC-2 禁用矩阵 3 条 + `expireAt===null` 可用 | ✅ | `customers-table.tsx` 用 `getFilteredSelectedRowModel()` 作唯一判据；`rowSelection` 字典**仅**区分文案；按钮测试 3 条禁用 + null 可用用例全过 |
| AC-3 对话框快捷项 + 天数展示 + 互斥 + null 只读行 | ✅ | `customers-renew-dialog.tsx:178–213`；快捷项渲染 `{RENEW_PRESET_DAYS[key]} 天`；键入即切 `custom`；null 显示「当前到期：未设置 · 无到期约束」 |
| AC-4 手动天数校验（空/0/负/小数/非数字/>3650）+ 文本型输入 | ✅ | `parseRenewDaysInput` 用 `^\d+$`；输入框 `type='text' inputMode='numeric'`；测试含「3651 → 上限提示」「`type` 属性断言」 |
| AC-5 算法 + 档位对齐 + §5.3 边界全表 + 无 addMonths 续期分支 | ✅ | `utils.ts:96–103`：`base = expireAt == null ? now : Math.max(expireAt, now)` + `addDays`；`RENEW_PRESET_DAYS` 字面量与 `planTiers` 逐一断言；§5.3 全表（含 4 行「刻意」）用例齐备；`addMonths` 仍服务于 `splitPlanCycles`（`utils.ts:181`）未删 |
| AC-6 载荷仅 `{ expireAt }` + 成功/失败路径 + 防重复 | ✅ | 测试 `expect(mutateAsync.mock.calls[0][0]).toEqual({ id, input: { expireAt } })`——**精确对象相等**，多键即失败；失败用例断言 `onOpenChange` 未被调用 |
| AC-7 禁用面零改动 | ✅ | `git diff origin/main --stat -- server shared/src package.json pnpm-lock.yaml src/components/ui src/routes src/routeTree.gen.ts` → **空输出** |
| AC-8 本地 lint / format / build / test + audit 全过 | ✅ | 复盘实跑：`pnpm test` 27 文件 / **334 passed**；`pnpm lint` 无输出；`pnpm format:check` 全通过；`audit-repo.py` **PASS=7 FAIL=0**；`audit_framework.py` **PASS=12 FAIL=0 SKIP=1** |
| AC-9 分支已推 + PR 描述覆盖模板 + CI 双绿 | ⚠️ **部分** | 分支已推、CI run `38908188715`（head `f8264f3`）**双绿**；PR 描述 129 行覆盖模板 10 类字段 ✅；**但「提交引用」漏列两个整改提交**（见 R4） |
| AC-10 两轮独立审查 | ❌ **未满足** | 本记录为**主控位定向审查**，非独立实例；两轮独立审查**尚未执行** |
| AC-11 TASK-039 D13-C 回写 + 本任务 Merge Record 留白 | ✅ | `1183145` 已完成回写并 `git mv` → `tasks/done/`；本任务 Merge Record 已留白并标注「待下一个任务回填（D13-C 第七实例）」 |

**CI 防腐注：** 上表 AC-9 的 run `38908188715` 对应 head `f8264f3`。**合并门禁以合并时点 head 的 CI run 为准**——
本记录一经产生即可能因后续整改提交而使该 run 过期（§3 R1–R4 若整改即必然如此）。

---

## 3 发现清单

### R1（**中**，须整改）设计文档 §3.4「判定实现建议」片段与自身矩阵冲突

- **位置**：`docs/technical/customer-renewal.md:141–147`
- **问题**：该片段第三分支 `!selectedCustomer ? '选中的客户不在当前数据中，请重新选择'` **不可达**。
  因同一文档 §3.3 定义 `selectedCustomer = selectedRows.length === 1 ? selectedRows[0].original : null`，
  `length === 0` 与 `length > 1` 已被前两分支吃掉，`length === 1` 时 `selectedCustomer` 必非空
  ⇒ 第三分支恒不为真。
- **后果**：照抄该片段实现，则「恰好选中 1 个 id 但该行已不在当前数据集」（矩阵第 3 行 / D3）会落到第一分支，
  只能给出通用文案「请先在列表中选择一行客户」，**永远产不出矩阵第 3 行规定的专用文案**。
  ⇒ 设计文档**自相矛盾**（片段 vs 矩阵）+ 违反自身 D3/D5 的警示。
- **实现实况（正确）**：`customers-table.tsx` 改用
  `Object.keys(table.getState().rowSelection).length > 0` 区分第 1/3 条文案，与矩阵第 3 行一致。
  ⇒ **代码是对的，文档片段是错的**（不要反向要求改代码）。
- **建议**：将 §3.4 片段改写为与实现一致（或就地标注「已被实现纠正，见 `customers-table.tsx`」），
  消除内部矛盾。

### R2（低，建议同批整改）任务档案「编号说明」滞后

- **位置**：`TASK.md:39`
- **现状**：「**039 为框架接入任务**（在 `tasks/review/`，**待本任务承载归档回写**）。」
- **问题**：回写已完成（`1183145`），TASK-039 已 `git mv` → `tasks/done/`；「在 `tasks/review/`」与「待…回写」均已失效。
- **建议**：改为「已完成归档回写并迁入 `tasks/done/`（提交 `1183145`）」。

### R3（低，建议同批整改）`Current State` 未反映整改与当前 head

- **位置**：`TASK.md:323–342`
- **问题**：仍停在「提交 `e572da3`」与「Next Action：推送远端 → 创建交付请求（PR 待审）」，
  未记录 PR #12 已开、两轮整改（`300c28d` / `f8264f3`）与当前 head `f8264f3`。
- **建议**：补记整改轮次与当前 head / CI run；`Next Action` 改为「独立审查」。

### R4（低，PR 描述）「提交引用」漏列整改提交

- **位置**：PR #12 body「关联任务 → 提交引用」
- **问题**：仅列 `5d74064` `e572da3` `4f6c94c` `1183145`，缺 `300c28d`、`f8264f3`（上轮派单第 6 项未执行）。
- **建议**：`gh pr edit 12` 补列。

### R5（极低，可选）其他历史性字段

- `TASK.md:270`（File Scope）与 `:443`（回填指引）仍以 `tasks/review/TASK-039-…` 表述；
  属**计划/程序性**记录，历史性较强，**不阻断**。若要严格自洽可加一句「已于 `1183145` 完成并迁移」。
- `HANDOFF-002` Meta 的 `Revision: 档案回填版（4f6c94c）` 未反映两轮整改；同属低价值项。

---

## 4 结论

- **代码层：未发现缺陷。** AC-1–AC-9、AC-11 经实跑判定通过；
  设计文档「五个易错点」（`rowSelection` 字典长度误用 / 基准误取 `now` / 载荷回传整表单 /
  月末漂移被当缺陷 / 为 `null` 补禁用）**全部有测试锁定**，且实现与 ADR-004 逐条吻合。
- **文档层：1 项须整改（R1，内部矛盾）+ 3 项陈述滞后（R2–R4）。**
- **阻断项：R1。** R2–R4 不阻断但建议并入同一批整改（成本极低）。
- **不建议**在此状态下授予合并：**R1 未修** + **AC-10 未满足**。

---

## 5 Next Action

1. 执行位整改 **R1–R4**（R5 可选）→ 新提交（footer `Refs: TASK-040`）→ 推送 → 新 head CI 双绿。
2. 由**不携带实现上下文的新实例**执行 **AC-10 的两轮独立审查**（第 1 轮全量 + 第 2 轮定向）。
   记录须**另起文件**（如 `2026-10-16-review.md`；**不得写入本文件**，否则与主控位复审记录混淆）；
   实例须在文件头部自证审查位纯度。
3. 人类显式授权 → rebase-merge → 合并后 CI 验证 + D8 复现 →
   由下一个任务按 D13-C **第七实例**回填 TASK-040 的 Merge Record。

---

## 附录 A 实跑证据（原文摘录）

```text
$ git log --oneline -6
f8264f3 docs(TASK-040): 整改交付完整性缺陷（第二轮，4 项）
300c28d docs(TASK-040): 整改交付完整性缺陷（7 项）
4f6c94c docs(TASK-040): 档案回填（Current State + Changed Files）
e572da3 feat(TASK-040): 客户管理页新增「续期」功能
1183145 chore(TASK-039): D13-C 第六实例归档回写（七要素实查）并迁 tasks/done/
5d74064 docs(TASK-040): 客户续期功能设计与任务档案

$ pnpm test
 Test Files  27 passed (27)
      Tests  334 passed (334)

$ python scripts/audit-repo.py
PASS=7 FAIL=0 WARN=0

$ python ../../shared/scripts/audit_framework.py
PASS=12  FAIL=0  WARN=0  SKIP=1

$ pnpm lint            → （无输出，通过）
$ pnpm format:check    → All matched files use Prettier code style!

$ git diff origin/main --stat -- server shared/src package.json pnpm-lock.yaml \
      src/components/ui src/routes src/routeTree.gen.ts
（空输出）

$ gh pr checks 12
audit                pass  … runs/38908188715
install-lint-build   pass  … runs/38908188715

$ gh pr view 12 --json state,mergedAt,mergeCommit,headRefOid
{"headRefOid":"f8264f34ac047dcce20aff38472b6cef18c8cbe8","mergeCommit":null,"mergedAt":null,"state":"OPEN"}
```

> 合并判据提醒：`mergeCommit: null` 且 `mergedAt: null` ⇒ **PR #12 尚未合并**。

---

## 附录 B 本文件的定位更正与后续状态（2026-10-16 晚补记）

**B1 文件更名（避免与独立审查记录混淆）**

- 本文件原名 `2026-10-16-review.md`。该名与本仓库既有约定冲突：`tasks/done/TASK-031…TASK-039`
  的 `handoffs/YYYY-MM-DD-review.md` 一律是**独立审查实例**出具的记录（其头部自证「新实例 Reviewer」）。
- 本文件既由**主控位**出具、又自认「不构成 AC-10」，沿用该名会让后续读者（含 AC-10 的人工核验，
  `TASK.md:316`「读 `handoffs/` 两份审查记录」）把它误计为 AC-10 记录。
- ⇒ 更名为 `2026-10-16-coordinator-recheck.md`，并**保留** `2026-10-16-review.md` 供 AC-10 独立审查使用。
  **名称分区即证据分区**：主控位复审记录 ≠ 独立审查记录。

**B2 第三轮整改的工作区状态**

- 本记录 §3 的 R1（设计文档 §3.4 片段矛盾）、R2（TASK.md:39 编号说明）、R3（Current State / Next Action）
  已由执行位改入工作区并 `git add`（`git status` 显示 `M docs/technical/customer-renewal.md`、
  `M tasks/.../TASK.md`），**尚未提交**；R4（`gh pr edit 12` 补列提交引用）仍在平台侧待办。
- ⇒ 本记录 §4「不建议在此状态下授予合并」指的是**基线 `f8264f3`**；R1–R3 提交并推送后须按
  「合并门禁以合并时点 head 的 CI run 为准」（§2 CI 防腐注）重新取证。
- **AC-10 仍未满足**，与 R1–R4 的整改进度无关。
