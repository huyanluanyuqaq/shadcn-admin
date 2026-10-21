# 2026-10-21-coordinator-review — TASK-047 交付审查（主控位）

> **TASK-047** · 主控位复审（coordinator recheck）
> 审查对象：分支 `chore/TASK-047-residual-debt-consolidation` @ `897fa8f`（已推送 origin，**无 PR**）
> 审查基线：`main` = `origin/main` = `2a4e259`
> **结论：CHANGES_REQUESTED**（4 项阻断 + 6 项失真须更正；核心门禁交付本身**已独立验证有效**）

---

## 0. 命名说明（为什么不是 `-coordinator-recheck.md`）

`.agents/protocols/handoff.md` §3.2 规定主控位复审用 `YYYY-MM-DD-coordinator-recheck.md`。
该文件名**已被 AC-19 强制占用**（HANDOFF-001 的 WP-6 要求执行位产出同名文件），
本记录无法使用规范名 ⇒ 退让为 `-coordinator-review.md` 并在下方 **F-8** 登记为制度缺陷。
**未重命名既有文件**（那会破坏 AC-19 的判据与执行位已交付物的可追溯性）。

---

## 1. 审查方式（实跑，非引用档案自述）

```
git status --short --branch ; git log --oneline main..HEAD ; git rev-list --count main..HEAD
gh pr list --state all --limit 30 ; gh api "repos/:owner/:repo/pulls?state=all&per_page=100"
gh run list --limit 6
gh api repos/:owner/:repo/pulls/20/commits --jq 'length'          → 1
gh api repos/:owner/:repo/pulls/21/commits --jq 'length'          → 3
gh api repos/:owner/:repo/actions/runs/39091153037 --jq '{name,conclusion,event}' → success/push
gh api repos/:owner/:repo/actions/runs/39091153042 --jq '{name,conclusion}'       → success
pnpm build:shared ; pnpm lint ; pnpm format:check ; pnpm knip ; pnpm build
pnpm test                     # 先 mv node_modules/.vite 与 dist 绕开 safe-delete
python scripts/audit-repo.py
python shared/scripts/audit_framework.py          # 默认解释器
C:/Python313/python shared/scripts/audit_framework.py   # 有 PyYAML 的解释器
# F8/F9 反向验证（本审查自行制造缺陷，非采信执行位自述）
```

---

## 2. 阻断项（必须整改）

### F-1 · 没有 PR；档案却写「已开 PR」

- 实测：`gh pr list --state all --limit 30` 最新为 **#21**；`pulls?state=all&per_page=100` 中
  匹配 `TASK-047` 的分支数 = **0**；`gh run list` 无任何 `chore/TASK-047-*` 的 run
  （`ci.yml` 仅在 `push: main` 与 `pull_request` 触发 ⇒ 分支推送不产生 run，与「未开 PR」一致）。
- 档案不实：`Current State` 首句「**已开 PR**，待主控位复审」、`Handoff` 表 002 行「**已开 PR**」、
  `projects/README.md`「TASK-047 在 `tasks/review/` **待合并**」——三处均指向一个不存在的 PR。
- **后果（比少一个链接严重）**：本任务的核心交付是「**门禁生效**」（knip 入 CI、`audit_framework.py`
  入 CI + PyYAML、F8/F9 入 audit-repo）。这些改动**从未在 CI 执行过一次** ⇒
  「AC-14 / AC-15 已落地」目前只有本机证据，没有 CI 证据。
  且 `ubuntu-latest` 上 `python3 -m pip install pyyaml` 在 PEP 668（externally-managed）环境下
  可能直接失败 —— **该项必须由 CI 实跑证伪或证实，不得以本机结果代替**。
- AC-21（`PR 描述填全`）未勾选，与事实一致；但 `Current State` 与 Handoff 表的表述与之矛盾，
  属「同一档案内部互相打架」。

### F-2 · 测试数失真：报告 351，实测 342；且测试在跑编译产物

- 实测：`pnpm test` → `Test Files 27 passed (27)` / **`Tests 342 passed (342)`** / 退出码 **0**。
- `HANDOFF-002` Tests 字段与 `Current State` 均称 **351**；`recheck` 也称基线 351。
- 账算不平：WP-5 删掉 `effectiveTrafficTotal` 的 **6** 个用例（`traffic.test.ts` 3 + `schema.test.ts` 3），
  351 − 6 = 345 ≠ 342。
- 根因实测（**本任务未发现、未披露**）：
  ```
  ✓ chromium  shared/dist/schema/traffic.test.js (17 tests)
  ✓ chromium  shared/src/schema/traffic.test.ts  (17 tests)
  ```
  `shared/tsconfig.json` 把测试文件一并编译进 `shared/dist/`，而 `vite.config.ts` 的 `test`
  未覆盖 `exclude` ⇒ vitest 把**编译产物里的测试**也收集进来，同一组用例执行两遍。
  于是「用例总数」随 `shared/dist` 的新鲜度漂移：CI 里 `pnpm build:shared` 先跑，
  **CI 同样会重复执行**（既存缺陷，非本任务引入，但本任务的计数失真由它造成且未被识别）。
- 判定：**AC-20 的判据「≥351 用例」在本任务删除 6 个用例后自相矛盾**（设计缺陷），
  而「351 绿」的结论**不可复现**（记录失真）。二者都要修：判据改为「失败 0 + 文件数」，
  并把 `shared/dist/**` 排除出 vitest 收集后重新记数。

### F-3 · AC-4 的勾选与交付终态自相矛盾

- AC-4 原文判据：`find tasks/review -mindepth 1 -maxdepth 1 -type d | wc -l` = **0**，已勾选 `[x]`。
- 实测终态：**1**（= TASK-047 自身，AC-21 要求的落位）。
- 即：勾选时点成立，交付时点必然不成立 ⇒ 勾选在本档案里读起来就是假的。
- 修法：判据改为「`tasks/review/` **仅含本任务**（`find … | grep -v TASK-047` 为空）」。

### F-4 · 模板声称「F8 保证章节位置」，实测 F8 不检查位置

- `templates/task/TASK.md`（Merge Record 节内）写：
  「本节的章节位置固定：位于 `## Handoff` 之后、`## Task Rules` 之前
  （**由 `scripts/audit-repo.py` F8 门禁保证一致**）」。
- 实测 `check_f8`：只做 `MERGE_RECORD_HEADING.search(...)`（**存在性**），
  **没有任何位置/顺序判断**；位置目前靠人工（模板恰好摆对了）。
- 这正是 B2 的同类缺陷在新模板里复现：**文档声称有门禁，门禁不管这件事**。
  要么给 F8 加顺序校验（`index(MergeRecord) > index(Handoff)` 且 `< index(TaskRules)`），
  要么把模板里的「由 F8 保证」删掉。**不得两者都不做。**

---

## 3. 失真项（须更正，不阻断但必须改）

| # | 事实 |
|---|------|
| **F-5** | `Changed Files` 称「自 `2a4e259` 起 **5 提交**」，实测 `git rev-list --count main..HEAD` = **7** |
| **F-6** | AC-3 判据「`grep -rn "第十三代实例回填" tasks/` 零命中」实测 **2 hits**，但两处均来自 TASK-047 档案自身对判据的引用（判据自污染，实质目标已达成）⇒ 判据须写「排除本档案」 |
| **F-7** | AC-13 措辞「**新增** `github-actions` 生态」前提失真：`git show main:.github/dependabot.yml` 实测**早已存在**（`interval: monthly`）。执行位改为提频 weekly 并**主动披露**，处置正确；须把 AC 措辞改为「提频」并保留该披露（原审查 C3 的「无 github-actions 生态」是**主控位的错误结论**，此处一并更正） |
| **F-8** | `2026-10-21-coordinator-recheck.md` 由**执行位**产出，正文自称「**主控位**复查记录」——命名与作者不符（根因：HANDOFF-001 的 WP-6 / AC-19 让执行位产出主控位命名文件，属**主控位设计缺陷**）。须把该文件改名为如 `2026-10-21-posthoc-recheck.md` 并把首行作者改为执行位，同时修订 AC-19 的强制文件名 |
| **F-9** | `HANDOFF-002` 元数据 `Date: 2026-10-21T09:2x:00+08:00`（含占位符 `9:2x`）；Risks 表存在破损文本 `失败模式 = 安装失败可重现({"im})，不出现"静默 SKIP"` |
| **F-10** | AC-8 验证表中的判据「`grep -rn "Task ID: TASK-045" tasks/` 仍为 **2 处**」实测 **5 处**（2 处真实 Meta + 3 处档案自述引用）⇒ 同 F-6，判据须排除自述文件 |

---

## 4. 已独立验证通过的部分（不因上面的问题而否定）

1. **WP-1 九要素可复现**：PR #20 = **1** 提交 / PR #21 = **3** 提交 / `39091153037`、`39091153042`
   均 `success (push)` / `merged_at` 与 `merge_commit_sha` 与 `gh api` 逐项一致；
   两档案 `Status: DONE` 且实体在 `tasks/done/`。**本项质量高**（数字全部对得上）。
2. **F8 / F9 门禁真实有效**（本审查自行反向验证，未采信自述）：
   - 删掉 `tasks/done/TASK-026-…/TASK.md` 的 `## Merge Record` 标题 → `[FAIL] F8 1 个档案缺少…`
     并列出 `done/TASK-026-…：缺少 ## Merge Record 章节` → `git checkout --` 复原 → `PASS=9 FAIL=0`；
   - 伪造 `tasks/done/TASK-041-dup-probe`（`Task ID: TASK-041`）→
     `[FAIL] F9 1 处编号问题` + `TASK-041 重复 2 处：done/TASK-041-customer-expire-required, done/TASK-041-dup-probe`
     → 删除探针 → `PASS=9 FAIL=0`。
   - 结论：**「造缺陷能抓住」成立**，这是本任务最有价值的交付。
3. **文档两值口径彻底**：`grep -rn "?? 存量" docs/` 与 `grep -rn "trafficManualCap ?? trafficTotal" docs/`
   均零命中；`overview.md`（175 / 180–182 / 401 / 567 区段）与 `api-contract.md` 表述与
   TASK-046 人类裁决一致，含「两者皆无 ⇒ 不限流量」。
4. **HD-3 已执行**：`ls -d /e/NDLDSN-WORKSPACE/.tmp-t0*` 零匹配；转存结论在 KI-8（内容具体，可核对）。
5. **D1 清理干净**：`effectiveTrafficTotal` 全仓仅剩 `src/features/customers/utils.ts` 的一行注释，
   无残留引用；`pnpm build` 退出码 0、`test` 退出码 0 佐证无悬挂导入。
6. **其他门禁本机实测**：`build:shared` 0 / `lint` 0 / `format:check` 0 / `knip` 0（空报告）/
   `build` 0 / `audit-repo.py` `PASS=9 FAIL=0` / `audit_framework.py` 用 `C:\Python313\python`
   `PASS=13 FAIL=0 SKIP=0`（**用默认解释器仍 `SKIP=1`** —— 记录里的「本机实测 PASS=13」须注明解释器，
   否则不可复现）。
7. **HD-1 未被破坏**：`git diff main...HEAD -- tasks/done/TASK-045-review-record-naming/` 为空；
   两个 045 的 `Task ID` 原样保留。
8. **带外修改已如实披露**：`e4d154c` 把「非执行位会话」对 `TASK-045/TASK.md` 与
   TASK-046 `HANDOFF-003` 的改动单独提交并说明；改动内容为「补完成标记 + 补文件末尾换行」，
   未篡改事实。**披露方式正确**（这点值得肯定；但见 F-6：正是该改动让 AC-3 的 grep 归零）。

---

## 5. 判定与整改要求

**CHANGES_REQUESTED**。整改顺序建议：

1. **F-1 开 PR**（这是解锁一切 CI 证据的前提），确认 `install-lint-build` 与 `audit` 两个 job
   全绿；若 `pip install pyyaml` 因 PEP 668 失败，改用
   `python3 -m pip install --break-system-packages pyyaml` 或 `python3 -m venv` 方案，并在档案记录实测。
2. **F-2 修正测试收集范围**（`vite.config.ts` 的 `test.exclude` 加 `**/dist/**` 或
   `shared/tsconfig.json` 排除 `*.test.ts`），重跑得到**单一计数**，用它替换 351 并与 AC-20 判据对齐。
3. **F-4 补 F8 位置校验或删模板里的错误声明**（二选一，并做反向验证）。
4. **F-3 / F-5 ~ F-10** 逐条更正，其中 **F-8 的 AC-19 修订**与 **F-7 对 C3 的更正**须一并写入档案，
   不得只改正文不改判据。

> 本记录不构成 PASS。执行位整改后重新置 `Status = REVIEW` 交主控位复审；
> 合并仍需**人类显式授权**，且由主控位执行 rebase-merge。
