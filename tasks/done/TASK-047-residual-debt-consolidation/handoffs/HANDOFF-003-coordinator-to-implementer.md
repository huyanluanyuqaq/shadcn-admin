# HANDOFF-003 — TASK-047 整改派单（主控位 → 执行位）

```yaml
Handoff ID: HANDOFF-003
Task: TASK-047
From: coordinator（主控位）
To: implementer（执行位）
Date: 2026-10-21T10:05:00+08:00
Type: Rework Request
Result: CHANGES_REQUESTED（见 2026-10-21-coordinator-review.md）
```

---

## 1. 现状（实测，勿凭记忆）

| 项 | 实测值 |
|---|---|
| 分支 | `chore/TASK-047-residual-debt-consolidation` @ `897fa8f`（`git rev-list --count main..HEAD` = **7**） |
| 基线 | `main` = `origin/main` = `2a4e259` |
| PR | **无**（`pulls?state=all` 匹配 TASK-047 = 0；`gh run list` 无本分支 run） |
| 工作区 | **脏**：主控位已 `git mv` 本任务 `review/ → active/`（已暂存），并新增 `2026-10-21-coordinator-review.md`（未跟踪） |
| 档案状态 | `Status: CHANGES_REQUESTED` |

> ⚠️ **工作区的未提交改动是主控位的审查交付物，禁止 `git checkout --` / `git reset --hard` / `git stash drop` 丢弃。**
> 整改时一并 `git add -A` 提交，与整改内容同批入 PR。

---

## 2. 必须做的事（按序，前一项是后一项的前提）

### R-1 · 先开 PR（F-1）

- `gh pr create` 指向 `main`，标题含 `TASK-047`，描述按 `.github/pull_request_template.md` 填全（AC-21 判据）。
- 等 `install-lint-build` 与 `audit` 两个必需检查**实跑完成**并贴出 run id 与 conclusion。
- **PyYAML 若在 `ubuntu-latest` 因 PEP 668 失败**：改用 `python3 -m pip install --break-system-packages pyyaml`
  或 `python3 -m venv`，并在档案记录**实际采用哪一种 + CI 实测输出**。不得以本机结果代替 CI 证据。
- 若 CI 失败，先修到绿再进入 R-2 —— 不得在红的基础上继续堆改动。

### R-2 · 修正测试收集范围并重取单一计数（F-2）

- 根因：`shared/tsconfig.json` 把 `*.test.ts` 编译进 `shared/dist/`，而 `vite.config.ts` 的 `test`
  **没有 `exclude`**（现只有 `coverage.exclude`）⇒ vitest 同时收集
  `shared/dist/schema/traffic.test.js`（17）与 `shared/src/schema/traffic.test.ts`（17），同一组用例跑两遍。
- 修法（二选一，写明选了哪个）：`vite.config.ts` 的 `test.exclude` 加 `**/dist/**`；
  或 `shared/tsconfig.json` 的 `exclude` 加 `**/*.test.ts`。
- 修后重跑，得到**单一稳定计数**（先 `mv node_modules/.vite /tmp` 与 `mv dist /tmp` 绕开 safe-delete）。
- 用新计数**替换全部 351**（`TASK.md` Current State、HANDOFF-002 Tests 字段、recheck 记录）；
  **AC-20 判据改为「失败 0 + 测试文件数」**，不再写「≥351」。

### R-3 · F8 与模板声明二选一（F-4）

- 现状：`templates/task/TASK.md` 的 Merge Record 节写「位置固定…**由 F8 门禁保证**」，
  而 `check_f8` 只做 `MERGE_RECORD_HEADING.search()`，**没有任何顺序判断**。
- 二选一：① 给 `check_f8` 加顺序校验（`index(MergeRecord) > index(Handoff)` 且 `< index(TaskRules)`）；
  ② 删掉模板里「由 F8 保证」的表述。
- **必做反向验证**：把某档案的 Merge Record 挪到 Handoff 之前 → 观察 FAIL/或确认无声明 →
  复原 → 观察 PASS。**原始输出三段都要贴**，只贴 PASS 视为未做。

### R-4 · 其余失真逐条更正（F-3、F-5 ~ F-10）

| # | 要求 |
|---|---|
| F-3 | AC-4 判据改为「`tasks/review/` **仅含本任务**」（`find … \| grep -v TASK-047` 为空），重判勾选 |
| F-5 | `Changed Files` 的「5 提交」改为实测值（当前为 7，整改后会变，**提交前重数**） |
| F-6 | AC-3 判据加「排除本档案自身」限定（`grep` 会命中判据文字本身，实测 2 hits 均属自污染） |
| F-7 | AC-13 措辞「**新增** `github-actions`」改为「**提频**（monthly → weekly）」；保留执行位的披露原文；同时更正审查记录 C3 的错误结论（该结论是主控位的错） |
| F-8 | `2026-10-21-coordinator-recheck.md` 改名 `2026-10-21-posthoc-recheck.md`，首行作者改为**执行位**，并**修订 AC-19 的强制文件名**（原 AC-19 让执行位产出主控位命名文件，是主控位的设计缺陷） |
| F-9 | `HANDOFF-002` 的 `Date: …T09:2x:00+08:00` 改为真实时间；修复 Risks 表的破损文本 `失败模式 = 安装失败可重现({"im})` |
| F-10 | AC-8 判据「仍为 2 处」改为「**2 处真实 Meta**（排除档案自述引用，实测 5 处）」 |

> F-6 / F-10 的共性：**判据被自身文字污染**。凡 grep 类判据，一律先确认命中是否含「引用该判据的文档」。

### R-5 · 快照与终态

- 更新 `/e/NDLDSN-WORKSPACE/projects/README.md` 三处（107 / 118-119 / 163 行）：
  当前写「TASK-047 在 `tasks/review/` 待合并」「`backlog/` 与 `active/` 均为空」——整改结束时按实测重写。
- 按 AC-20 复跑全部门禁，**逐个记录退出码**，`audit_framework.py` 须注明所用解释器。
- `Status → REVIEW`，`git mv tasks/active/TASK-047-… tasks/review/TASK-047-…`，`audit-repo.py` 复跑。
- 新出 `HANDOFF-004-implementer-to-coordinator.md` 汇报整改结果（逐条对应 R-1~R-5 与本表 F-1~F-10）。
- **不得自行合并、不得自判 PASS、不得代写主控位署名文件**（F-8 的教训）。

---

## 3. 环境陷阱（会导致假失败，别误判为代码问题）

1. `pnpm build` 首轮会因 safe-delete 拦截 `dist`（>50 文件）报错 → 先 `mv dist /tmp`。
2. `pnpm test` 同理会卡在 `.vite` 缓存 → 先 `mv node_modules/.vite /tmp`。
3. `pnpm` 偶发调 `wmic.exe` 被拦，**退出码不可信** → 以输出末尾 `Tests N passed` 为准。
4. `audit_framework.py` 的 A3 需 PyYAML；**默认解释器无 yaml → SKIP=1**，
   `C:\Python313\python` 有 → `PASS=13 SKIP=0`。记录必须写清用的是哪个。
5. `rm -rf dist` 被沙箱拦 → 用 `mv` 到 `/tmp` 代替。

---

## 4. 不需要重做的事（已由主控位独立验证通过，勿浪费轮次）

WP-1 九要素（PR20 = 1 提交 / PR21 = 3 提交 / run `39091153037`、`39091153042` 均 success）、
F8/F9 门禁本身有效性、`docs/` 两值口径零残留、`.tmp-t0*` 已删、`effectiveTrafficTotal` 无残留、
`lint`/`format:check`/`knip`/`build` 全 0、HD-1 未破坏历史编号、`e4d154c` 的带外披露方式。

**上述项若整改中被改动，须在 HANDOFF-004 中说明原因。**
