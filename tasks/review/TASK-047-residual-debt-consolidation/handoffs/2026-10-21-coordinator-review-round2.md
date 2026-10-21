# 2026-10-21-coordinator-review-round2 — TASK-047 整改复审（主控位）

> **TASK-047** · 主控位**第二轮**审查（对 CHANGES_REQUESTED 整改结果的复审）
> 审查对象：PR **#22**，head **`8a6390a`**（`chore/TASK-047-residual-debt-consolidation`）
> 审查基线：`main` = `origin/main` = `2a4e259`
> **结论：PASS**（1 项合并前必修的收尾，见 §5 M-1；无实质阻断）
> 依据：上一轮 `2026-10-21-coordinator-review.md` 的 4 阻断（F-1~F-4）+ 6 失真（F-5~F-10）逐条复核

---

## 1. 本轮审查方式（全部实跑，不采信报告自述）

```
git status --short --branch ; git rev-list --count main..HEAD
gh pr list --state all --limit 5 ; gh api repos/:owner/:repo/pulls/22
gh run list --limit 8
gh run view 39544951231 --log | grep -E "A3 |PASS=|Tests|knip"
python scripts/audit-repo.py
python shared/scripts/audit_framework.py
pnpm lint / format:check / knip / build / test      # 先 mv node_modules/.vite 与 dist 绕 safe-delete
# F8 / F9 反向验证：本审查自行注入缺陷（3 个探针），不采信 §4.3 的自述输出
# 用例账目复核：git show main:<file> | grep -cE "^\s*it\(" 逐项比对
```

---

## 2. 阻断项复核（F-1 ~ F-4）：全部关闭

| # | 上轮问题 | 本轮实测 | 判定 |
|---|---|---|---|
| **F-1** | 无 PR，档案却写「已开 PR」 | PR **#22 OPEN**，base `main`，`commits=11`、`changed_files=30`、`mergeable_state=clean`；CI run **`39544951231`**（head `8a6390a`）`install-lint-build` + `audit` **均 success**；描述 9737 字符，按模板 8 节填全 | **关闭** |
| **F-1 后果** | knip / PyYAML / `audit_framework.py` 从未在 CI 执行过 | CI 日志实证：`Run repo framework audit → PASS=9 FAIL=0`；`Install PyYAML` success；`Run workspace framework audit → [PASS] A3 3 个 YAML 均可解析` + `PASS=13 FAIL=0 WARN=0 SKIP=0`；`Analyze unused files and dependencies → $ knip`（无报告）；`Tests 325 passed (325)` | **关闭**（**A3 已真实执行、不再 SKIP**，B5 的「静默跳过」形态被消灭） |
| **F-2** | 报告 351，实测 342；vitest 重复收集 `shared/dist` | 本机复跑 **`Test Files 26 / Tests 325`**、退出码 0、输出中 `shared/dist` 命中 **0**（编译产物已被排除）；`vite.config.ts` 的 `test.exclude` 已显式含 `**/dist/**` 且写回 `**/node_modules/**`、`**/.git/**`（`exclude` 整体替换默认值的坑已处理） | **关闭** |
| **F-2 根因** | 上轮判定为「缺 `exclude`」 | 执行位挖到更深一层，**本审查独立验证为真**：<br>`node_modules/vitest/dist/chunks/defaults.*.js:6` → `const defaultExclude = ["**/node_modules/**", "**/.git/**"];`<br>`node_modules/vitest/dist/chunks/reporters.*.d.ts:2476` → JSDoc 仍写含 `**/dist/**` 的长列表<br>⇒ **运行时默认值与文档声明不一致**，与 B2/F-4 同源。上轮的根因判断不完整，执行位的更正成立 | **关闭（并更正上轮结论）** |
| **F-3** | AC-4 判据（`review/` 为 0）与终态互斥 | 判据已改为「`tasks/review/` 仅含本任务」；实测 `review=1`（仅 `TASK-047-…`）、`backlog=0`、`active=0` ⇒ 勾选成立 | **关闭** |
| **F-4** | 模板称「位置由 F8 保证」，F8 只查存在性 | 采方案①：`check_f8` 增顺序校验（`MergeRecord > Handoff` 且 `< TaskRules`，两锚点均在才判定）**且把模板自身纳入在检**；`F8_MERGE_RECORD_POSITION_EXEMPT` 显式登记 21 个历史档案（含逐条理由）。**本审查自行反向验证 3 个探针**见 §3 | **关闭** |

---

## 3. F8 / F9 反向验证（本审查自造缺陷，未采信执行位 §4.3 的自述输出）

| 探针 | 注入 | 实测输出 | 复原后 |
|---|---|---|---|
| A · 本任务档案挪位 | 把 `TASK-047/TASK.md` 的 `## Merge Record` 整块移到 `## Handoff` 之前 | `[PASS]` 未被捕获 —— **但这是本审查探针自身的 bug**：注入时未补换行，标题被并入上一行 ⇒ `^## Merge Record$` 不再匹配，退化为「缺章节」分支而被 `F8` 以「1 个档案缺少」形式捕获（`PASS=8 FAIL=1`）。**不构成结论**，故重做 B/C | `PASS=9 FAIL=0` |
| B · 模板自身挪位 | 把 `templates/task/TASK.md` 的 `## Merge Record` 移到 `## Task Rules` 之后 | `[FAIL] F8 1 个档案的 Merge Record 章节位置不合规`<br>`- templates/task/TASK.md：## Merge Record 未位于 ## Handoff 之后、## Task Rules 之前（模板自称位置由 F8 保证，模板自身必须率先合规）`<br>`PASS=8 FAIL=1` | `PASS=9 FAIL=0` |
| C · 新任务（非豁免）挪位 | 造 `tasks/backlog/TASK-999-probe`，`Task ID: TASK-999`，`## Merge Record` 置于 `## Handoff` 之前 | `[FAIL] F8 1 个档案的 Merge Record 章节位置不合规`（`PASS=8 FAIL=1`）；同库 `[PASS] F9 全 48 个档案…唯一` | 修正顺序后 `[PASS] F8 … 23 个非豁免档案…`；删除探针后 `PASS=9 FAIL=0` |
| D · 撞号 | 造 `tasks/done/TASK-047-probe`，`Task ID: TASK-047` | `[FAIL] F9 1 处编号问题` + `- TASK-047 重复 2 处：review/TASK-047-…, done/TASK-047-probe` | 删除后 `[PASS] F9 全 47 个档案…`、`PASS=9 FAIL=0` |

**结论：位置校验与编号唯一性对「新任务 + 模板」真实生效，且豁免清单未被用来掩盖新问题**（TASK-999 不在豁免内即被抓住）。

> 探针 A 的失败与执行位 §4.3「探针自我更正」记录的是**同一类错误**（注入把判据前提破坏）。
> 执行位主动披露了自己那次探针 bug，本审查亦如实登记自己这次 —— 该类错误只有「确认缺陷真的注入」
> 才能排除，判据是**先看标题顺序是否真的颠倒**再看脚本结论。

---

## 4. 失真项复核（F-5 ~ F-10）：全部更正

| # | 上轮失真 | 本轮实测 |
|---|---|---|
| **F-5** | 「5 提交」实为 7 | 改为「自 `2a4e259` 起 **10 个提交，截至 `f4b49f5`**」⇒ 实测 `git rev-list --count 2a4e259..f4b49f5` = **10** ✓（HEAD 现为 11，`8a6390a` 本身即该计数修正提交）。**锚定到 SHA 而非「含本提交」，正确终止了「改数字→再提交→数字又变」的无限回归**；并在 §8 留了 self-correction 说明 |
| **F-6** | AC-3 判据被自身污染（2 hits） | 判据改为 `grep -rn "第十三代实例回填" tasks/ \| grep -v "TASK-047"`；实测命中 6 处**全部落在 TASK-047 目录内**（`TASK.md` ×4 / review ×1 / HANDOFF-004 ×1），排除后为空 ✓ |
| **F-7** | AC-13「新增 github-actions」前提错（是**主控位的错误结论**） | `C3` 行已加修订标注，明写「后半句是主控位的错误结论」；AC-13 措辞改为「提频 monthly → weekly」；`dependabot.yml:33-36` 实测 `github-actions` + `interval: 'weekly'` ✓。**执行位据实纠正主控位，处置正确** |
| **F-8** | 执行位产出主控位命名的 recheck 并自称主控位 | 已 `git mv` → **`2026-10-21-posthoc-recheck.md`**；AC-19 的强制文件名同步修订，并写明「`-coordinator-recheck.md` 不得再指派给执行位」；文件内容保留原实测 |
| **F-9** | `Date: …T09:2x:00+08:00` 占位 + Risks 破损文本 | `Date: 2026-10-21T09:02:44+08:00`（取自 `91108c1` 的 author date，可复现）；破损行已重写为完整句子，并按 R-1 补记「PEP 668 未拦截」 |
| **F-10** | AC-8 判据「2 处」实为 5 处 | 判据改为**行锚定** `grep -rn "^Task ID: TASK-045" tasks/ docs/ .agents/` ⇒ 实测**恰好 2 处** ✓（未锚定时现为 **10 处**，随引用增长 —— 印证行锚定是正确解法） |

---

## 5. 合并前必修（1 项，1 行）

### M-1 · `AC-20` 仍为未勾选 `[ ]`

- 实测：`grep -c "^- \[x\] \*\*AC-"` = **20**，`grep -c "^- \[ \] \*\*AC-"` = **1**，唯一未勾选者即 **AC-20**（全门禁复跑）。
- 而 AC-20 的**两个条件都已满足**：① 判据已按 R-2 改为「失败 0 + 测试文件数」；② 结果已附于
  `HANDOFF-004` §6.1 的 12 行退出码表。本审查亦独立复跑全部为绿（§6）。
- 即：这不是「没做」，而是「做了没勾」，属**交付完整性**缺陷（框架要求 AC 复选框与交付状态一致）。
  合并后该档案会永久留着一个「门禁 AC 未勾」的自相矛盾，故列为**合并前必修**。
- 修法：勾选并加一行注「主控位第二轮复跑确认：CI `39544951231` + 本机实测均绿」。

---

## 6. 本审查独立复跑的门禁（全部实测）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `pnpm lint` | 退出码 **0**，零输出 |
| 2 | `pnpm format:check` | 退出码 **0** |
| 3 | `pnpm knip` | 退出码 **0**，无报告 |
| 4 | `pnpm build`（先 `mv dist /tmp`） | 退出码 **0**，`✓ built in 1.04s` |
| 5 | `pnpm test`（先 `mv node_modules/.vite /tmp`） | 退出码 **0**，`Test Files 26 passed (26)` / `Tests 325 passed (325)`，`shared/dist` 命中 **0** |
| 6 | `python scripts/audit-repo.py` | `PASS=9 FAIL=0 WARN=0` |
| 7 | `python shared/scripts/audit_framework.py` | `PASS=12 FAIL=0 WARN=0 **SKIP=1**`（本会话 `python` → `C:\Users\Admin\.workbuddy\binaries\python\versions\3.13.12\python.exe`，**无 yaml**） |
| 8 | CI run `39544951231` | `audit` + `install-lint-build` 均 **success**；CI 内 `PASS=13 SKIP=0`（PyYAML 已装）与 `Tests 325` |

### 用例账目独立复算（F-2 的「算不平的账」）

```
git show main:shared/src/schema/traffic.test.ts | grep -cE "^\s*it\("  → 20
grep -cE "^\s*it\(" shared/src/schema/traffic.test.ts                  → 17
git show main:src/features/customers/data/schema.test.ts | grep -cE "^\s*it\(" → 48
grep -cE "^\s*it\(" src/features/customers/data/schema.test.ts         → 45
```

`351`（main）− 6（源文件删除）− 3（`dist` 副本随之减少）= **342**；`342 − 17 = 325` ✓
**三个数字闭合、无残差**，执行位的分解表（TASK.md:589-590）与本审查独立复算一致。

---

## 7. 残留观察（**不阻断**，登记备查）

| # | 观察 | 说明 |
|---|---|---|
| **N-1** | F8 位置校验实际覆盖面很窄 | 22 个非豁免档案中 **21 个在位置豁免内**，真正被校验的只有 TASK-047 自身 + 模板。执行位已如实披露（模板原文 + `Known Issues` + HANDOFF-004 §9），且本审查用 TASK-999 探针证明**新任务确实被覆盖**。属「历史不回溯」的刻意取舍，但豁免清单会长期存在，需后续任务逐步缩减 |
| **N-2** | `knip.config.ts` 白名单较宽 | `src/features/*/api.ts` 与 `*/queries.ts` 的 `exports`/`types` 整类豁免 ⇒ 这两类文件里**新增的**未使用导出不会再被 knip 发现。理由（CRUD 操作面刻意导出）已逐条写明，属已披露的策略 B；但门禁在这两类文件上确实变钝 |
| **N-3** | `audit_framework.py` 的「本机 PASS=13」不可跨会话复现 | 本会话默认 `python` 无 PyYAML ⇒ `SKIP=1`；执行位会话的 `python` 指向 `C:\Python313\python.exe`（有 PyYAML）⇒ `SKIP=0`。执行位**已如实披露该差异且不推断原因**，态度正确。判据应统一为「A3 是否实跑」，而 CI 现已强制 `PIP install pyyaml` ⇒ 门禁侧不受影响 |
| **N-4** | `Changed Files` 的提交数（10 @ `f4b49f5`）与 HEAD（11）不同 | 属**刻意的 SHA 锚定**，可复现、不自相矛盾；合并时若再追加提交，按 `git rev-list --count main..HEAD` 重数为准（该句已写入档案） |
| **N-5** | `effectiveTrafficTotal` 在 `utils.ts` 仍留一行注释 | 仅注释、无代码引用；`build`/`test` 绿可佐证无悬挂导入。属刻意留痕，非残留 |

---

## 8. 判定

**PASS。**

- 上轮 **4 项阻断全部关闭**，其中 F-1（CI 证据）与 F-4（F8 位置校验）经本审查**独立反向验证**成立；
- 上轮 **6 项失真全部更正**，F-6 / F-10 的判据改成「排除自述」与「行首锚定」，属**判据层面的修复**而非文字回避；
- 执行位**未自行合并、未自行判 PASS**（PR #22 `merged=false`），也未改写主控位署名文件的结论；
- 主控位自己的两处错误（C3「无 github-actions 生态」、F-2 根因只挖到「缺 exclude」）已被执行位据实纠正，本审查予以确认。

**唯余 M-1（AC-20 未勾选）**，一行改动，**合并前必须补**。

> 合并仍需**人类显式授权**，由主控位执行 **rebase-merge**。
> 合并后按 D13-C 选项 C，本档案 `Merge Record` 由下一个任务回填（D13-C 第九实例）。
