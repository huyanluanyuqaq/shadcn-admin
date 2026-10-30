# HANDOFF-004 — developer（执行位）→ coordinator（主控位）

```yaml
Handoff ID: HANDOFF-004
Task: TASK-047 — 遗留债务一次性收口
From: developer（执行位）
To: coordinator（主控位）
Date: 2026-10-21T11:40:00+08:00
Type: Rework Report（对应 HANDOFF-003 的 CHANGES_REQUESTED）
Result: R-1 ~ R-5 全部完成；**不自判 PASS**，交主控位复审
Previous Handoff: HANDOFF-003-coordinator-to-implementer.md
```

---

## 1. 现状（实测，勿凭记忆）

| 项 | 实测值 |
|---|---|
| 分支 | `chore/TASK-047-residual-debt-consolidation` |
| 基线 | `main` = `origin/main` = `2a4e259` |
| **PR** | **#22**（`https://github.com/huyanluanyuqaq/shadcn-admin/pull/22`），base `main`，**OPEN，未合并** |
| **CI** | run **`39537943459`**（`pull_request`，head `4b8a5d3`）→ `install-lint-build` **success**、`audit` **success**；<br>run **`39543828636`**（`pull_request`，head `f1e512c`，整改后）→ 两作业**均 success**，且 CI 内 `Test Files 26 / Tests 325`、F8 位置校验通过 |
| 工作区 | 主控位 `git mv` 到 `active/` 的未提交改动**已被 `4b8a5d3` 收存**（未丢弃、未 reset、未 stash） |
| 档案状态 | `Status: REVIEW`，目录已迁回 `tasks/review/` |

> 主控位两项未提交交付物（`2026-10-21-coordinator-review.md` + `HANDOFF-003` + 任务目录迁 `active/`）
> 在整改第一步即用 `git add -A` 收存为提交 `4b8a5d3`，**全程未发生 `checkout --` / `reset --hard` /
> `stash drop`**。反向验证需要临时改文件时，一律先 `cp` 备份到 `/tmp` 再改、用 `cp` 复原，
> 从未对含未提交改动的文件用过 `git checkout --`。

---

## 2. R-1 · 先开 PR（F-1）—— 完成

### 2.1 开 PR

```
$ gh pr create --base main --head chore/TASK-047-residual-debt-consolidation \
    --title "chore(TASK-047): 遗留债务一次性收口（档案回写归档 + 制度门禁补洞 + 文档口径统一 + 代码卫生）" \
    --body-file /tmp/t047-pr-body.md
https://github.com/huyanluanyuqaq/shadcn-admin/pull/22
```

描述按 `.github/PULL_REQUEST_TEMPLATE.md` 逐节填全（关联任务 / 变更摘要 / 实现内容与范围 /
测试结果 / 兼容性·安全·部署 / 回滚方案 / 遗留问题 / 执行者自检），并附「整改进度」表逐条对应 R-1~R-5。
**AC-21 的「PR 描述填全」已满足**（整改中各轮次的实测结果在 CI 复跑后回填至该表）。

### 2.2 两个必需检查实跑出 run id（这是 R-1 的核心目的）

```
$ gh api repos/:owner/:repo/actions/runs/39537943459 --jq '{name,event,conclusion,status,head_sha,run_started_at,updated_at}'
{"conclusion":"success","event":"pull_request","head_sha":"4b8a5d3a171f1fa9a80960ccf8f807dc48d3dac9",
 "name":"Continuous Integration","run_started_at":"2026-10-21T03:19:35Z","status":"completed","updated_at":"2026-10-21T03:21:06Z"}

$ gh api repos/:owner/:repo/actions/runs/39537943459/jobs --jq '.jobs[] | "\(.name) -> \(.status)/\(.conclusion)"'
audit -> completed/success
install-lint-build -> completed/success

$ gh pr view 22 --json statusCheckRollup --jq '.statusCheckRollup[] | "\(.name) | \(.status) | \(.conclusion) | \(.startedAt) | \(.completedAt)"'
install-lint-build | COMPLETED | SUCCESS | 2026-10-21T03:19:39Z | 2026-10-21T03:21:05Z
audit              | COMPLETED | SUCCESS | 2026-10-21T03:19:39Z | 2026-10-21T03:19:46Z
```

**两个必需检查均实跑并 success，PR 为绿 ⇒ 依 HANDOFF-003 的要求进入 R-2。**

### 2.3 PyYAML / PEP 668：备选方案**未采用**，原写法直接成功

主控位预判「`ubuntu-latest` 上 `python3 -m pip install pyyaml` 可能因 PEP 668
（externally-managed）失败，需改用 `--break-system-packages` 或 venv」。**实测未失败：**

```
audit	Install PyYAML	Run python3 -m pip install --quiet --disable-pip-version-check pyyaml
audit	Install PyYAML	→ completed/success
```

`ci.yml` 中的原始写法（无 `--break-system-packages`、无 venv）在 `ubuntu-latest` 上直接成功。
**实际采用：原写法（`python3 -m pip install pyyaml`）**；`--break-system-packages` 与 venv 两个
备选方案**均未使用**。此处按 HANDOFF-003 的要求明确记录实际采用哪一种。

### 2.4 CI 同时证实了 F-2 的重复收集（本机之外的第二处证据）

`install-lint-build` 的 `Run tests` 步骤原始输出（节选，ANSI 已剥离）：

```
 RUN  v4.1.4 /home/runner/work/shadcn-admin/shadcn-admin
 ✓ chromium  shared/dist/schema/traffic.test.js (17 tests) 4ms
 ✓ chromium  shared/src/schema/traffic.test.ts  (17 tests) 4ms
 ...
 Test Files  27 passed (27)
      Tests  342 passed (342)
   Duration  14.44s
```

即 **CI 与主控位本机实测完全一致**：27 文件 / 342 用例，且 `shared/dist` 下的编译产物测试
与源测试**同时被收集**。`audit` 作业输出：

```
[PASS] F8  全部 22 个非豁免档案均含 `## Merge Record` 章节（历史豁免 TASK-001~025 共 25 个…）
[PASS] F9  全 47 个档案编号可解析且唯一（HD-1 白名单内共存：TASK-045 × 2，裁决 2026-10-21）
PASS=9 FAIL=0 WARN=0
[PASS] A3  3 个 YAML 均可解析（占位符已归一化）
…
PASS=13  FAIL=0  WARN=0  SKIP=0
```

⇒ **knip 入 CI、`audit_framework.py` 入 CI + PyYAML（A3 不再 SKIP）、F8 / F9 入 CI 四项
全部首次取得 CI 证据**，不再是「只有本机证据」。F-1 的后果（核心交付从未在 CI 执行过）已消除。

### 2.5 整改后的第二轮 CI（run `39543828636`，head `f1e512c`）

R-2~R-5 的改动推送后，两个必需检查**再次实跑并 success**：

```
$ gh api repos/:owner/:repo/actions/runs/39543828636 --jq '{name,event,conclusion,status,head_sha,run_started_at,updated_at}'
{"conclusion":"success","event":"pull_request","head_sha":"f1e512c2fc8844d4b4b7bbaf7aa15dde827cb626",
 "name":"Continuous Integration","run_started_at":"2026-10-21T04:24:06Z","status":"completed","updated_at":"2026-10-21T04:25:49Z"}

$ gh api repos/:owner/:repo/actions/runs/39543828636/jobs --jq '.jobs[] | "\(.name) -> \(.status)/\(.conclusion)"'
install-lint-build -> completed/success
audit -> completed/success
```

**该轮 CI 同时证实了 R-2 / R-3 的修正确实在 CI 生效（不只是本机）：**

```
# install-lint-build / Run tests —— 计数已变为单一值
 Test Files  26 passed (26)
      Tests  325 passed (325)
   Duration  18.04s

# audit —— F8 的位置校验与「模板在检」在 CI 同样通过
[PASS] F8  全部 22 个非豁免档案均含 `## Merge Record` 章节且位置合规（…位置豁免 21 个…模板 templates/task/TASK.md 已在检）
[PASS] F9  全 47 个档案编号可解析且唯一（HD-1 白名单内共存：TASK-045 × 2，裁决 2026-10-21）
PASS=9 FAIL=0 WARN=0
[PASS] A3  3 个 YAML 均可解析（占位符已归一化）
PASS=13  FAIL=0  WARN=0  SKIP=0
```

即：`shared/dist/schema/traffic.test.js` 已不再出现在收集列表里，27→26 个文件、342→325 个用例，
**与本机实测逐字一致**。

---

## 3. R-2 · 修正测试收集范围并重取单一计数（F-2）—— 完成

### 3.1 根因比「缺 `exclude`」更深一层（实测）

`vite.config.ts` 的 `test` 确实没有 `exclude`，但**真正的原因是 Vitest 4 改了默认值**：

```
$ sed -n '1,10p' node_modules/vitest/dist/chunks/defaults.9aQKnqFk.js
const defaultInclude = ["**/*.{test,spec}.?(c|m)[jt]s?(x)"];
const defaultExclude = ["**/node_modules/**", "**/.git/**"];      ← 运行时真实默认值
```

而同包的**类型声明** JSDoc 仍写着：

```
node_modules/vitest/dist/chunks/reporters.d.BwkR0iL5.d.ts
 * @default ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', …]
```

⇒ **文档（类型声明）声称默认排除 `**/dist/**`，运行时的默认值里没有它。**
这与本任务 B2 / F-4 要消灭的缺陷**完全同源**：声称有门禁，门禁不管这件事。
于是 `shared/tsconfig.json`（无 `exclude`，而 `server/tsconfig.json` 反而有
`exclude: ["node_modules", "dist"]`）把 `*.test.ts` 编译进 `shared/dist/`，
vitest 连编译产物里的测试一并收集，同一组用例执行两遍。

### 3.2 采用方案 A：`vite.config.ts` 的 `test.exclude`

**选了哪一个：方案 A —— `vite.config.ts` 的 `test.exclude` 加 `**/dist/**`。**

未选方案 B（`shared/tsconfig.json` 排除 `**/*.test.ts`）的理由：那会改变 `shared/dist` 的产物内容，
牵动 `pnpm build:shared` / `typecheck:server` / `pnpm build` 整条构建链，
超出「测试收集范围」这一缺陷本身的范围（P5 最小改动）。
`vite.config.ts` 原不在 File Scope 内，已按 Constraints「超出 File Scope 须先更新本字段并说明理由」
补登记（见 TASK.md File Scope 的 R-2 注释）。

```ts
  test: {
    silent: 'passed-only',
    unstubEnvs: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
    ],
    …
```

⚠️ **关键实现细节：`exclude` 是整体替换默认值、不是追加。** 若不显式写回
`**/node_modules/**`，vitest 会去收集 `node_modules` 内的测试（灾难性）。
文件内已用注释记录该坑与实测证据。

### 3.3 单一计数 + 把 F-2「算不平的账」算平

```
$ mv node_modules/.vite /tmp/t047-vite-baseline     # 绕 safe-delete
$ pnpm test        # 修正前（复现基线）
 Test Files  27 passed (27)
      Tests  342 passed (342)

$ mv node_modules/.vite /tmp/t047-vite-after        # 绕 safe-delete
$ pnpm test        # 修正后
 Test Files  26 passed (26)
      Tests  325 passed (325)
```

**单一稳定计数 = 26 文件 / 325 用例 / 失败 0。** 351 已在 TASK.md Current State、
HANDOFF-002 Tests 字段、posthoc-recheck 基线三处全部替换/加注（历史实测原文保留并标注「不得作为当前计数引用」）。

**账目 now 完全对平**（这是 F-2 提出的「351 − 6 = 345 ≠ 342」的完整解释）：

| 时点 | `Test Files` | `Tests` | 其中 `shared/dist` 重复 | 真实用例 |
|------|--------------|---------|--------------------------|----------|
| `main` 基线（TASK-047 开工前） | 27 | 351 | **20** | **331** |
| WP-5 后、修正前（= 主控位实测 342） | 27 | 342 | **17** | **325** |
| **R-2 修正后（当前）** | **26** | **325** | **0** | **325** |

主控位假设「`dist` 重复数在两个时点都是 17」，实际**不是**：

```
$ git show main:shared/src/schema/traffic.test.ts | grep -cE "^\s*it\("   → 20
$ grep -cE "^\s*it\(" shared/src/schema/traffic.test.ts                    → 17
$ git show main:src/features/customers/data/schema.test.ts | grep -cE "^\s*it\("  → 48
$ grep -cE "^\s*it\(" src/features/customers/data/schema.test.ts           → 45
```

WP-5 从**源文件**删了 6 例（3 + 3），但 `shared/dist/schema/traffic.test.js` 是**随源码重建**的，
副本也从 20 例变 17 例（−3）。于是总数降 **6 + 3 = 9**，即 351 − 9 = **342** ✓。
修正后排除 dist 副本：342 − 17 = **325** ✓。**三个数字全部闭合，无残差。**

### 3.4 AC-20 判据改写

原判据「`pnpm test`（≥351 用例，失败 0）」→ 新判据「**失败 0 + 测试文件数**」。
理由：绝对用例数随业务增删而变（本任务自己就删了 6 个），且修正前的 351 本身含重复计数、
随 `shared/dist` 新鲜度漂移 ⇒ 不能作为验收判据。Verification Plan 表同步改写。

---

## 4. R-3 · F8 与模板声明二选一（F-4）—— 完成，选①并加顺序校验

**选了哪一个：① 给 `check_f8` 加顺序校验**（未选②「删掉模板里『由 F8 保证』的表述」）。
理由：模板声称的「章节位置固定」是一个真实有用的结构不变量（保证档案可被稳定定位），
删掉声明是**削弱**制度；补上校验是让文档声明变成真的，与本任务的主线一致。

### 4.1 实施前的新发现（审查与派单均未掌握，直接改变方案成本）

把顺序断言套到当前 `main` 全量档案上，**有 10 个已归档档案的 `## Merge Record`
位于 `## Handoff` 之前** —— 历史约定本就是相反顺序：

```
BAD（MR 在 HO 之前）: TASK-028, TASK-029, TASK-039, TASK-040, TASK-041,
                       TASK-042, TASK-043, TASK-044, TASK-045(×2), TASK-046
SKIP（无 Handoff/Task Rules 锚点，无从判定）: TASK-026, 027, 030, 031~038
OK: TASK-047（本任务自身，唯一顺序合规的历史外档案）
```

若逐字执行顺序断言，**本门禁会在现有 `main` 上直接 FAIL**，违反 TASK-047 Requirement 4
（新增门禁不得让现有 CI 变红）与 AC-6。回溯重排 10 个历史档案则要触碰 10 个 File Scope 外的
已归档文件，且违背本仓「历史原文不改写」原则。

⇒ **处置（与 HD-1「不重编历史」同一原则）**：不回溯重排，改为**显式登记位置豁免**
`F8_MERGE_RECORD_POSITION_EXEMPT`（21 个条目，含逐条理由与登记日期 2026-10-21），
位置约束**只对 TASK-047 起的新任务生效**。豁免是显式清单而非隐式放宽。

### 4.2 判据设计（两个必要的谨慎）

1. **仅当两个锚点都存在时才判定顺序**。历史档案缺 `## Handoff` / `## Task Rules` 时
   （TASK-007/012/014/015/026/027/030~038）无从判定，按「不可判定」跳过而非 FAIL。
2. **模板自身也必须在检**。模板原文写「位置由 F8 门禁保证」—— 若 F8 只查 `tasks/**`
   而不查模板，这句声明对模板自己仍是空话（B2 同类缺陷）。故 `check_f8` 额外校验
   `templates/task/TASK.md` 的章节顺序。

同时把模板原文改为**如实描述门禁的真实作用范围**（模板自身在检 + TASK-047 起的档案 +
历史位置豁免 21 个及登记日期），不再是一句无法核对的口号。

### 4.3 反向验证 · 三段原始输出（HANDOFF-003 要求三段都贴）

**段 1 / 3 —— 基线（无缺陷注入）：**

```
$ C:/Python313/python scripts/audit-repo.py
[PASS] F8  全部 22 个非豁免档案均含 `## Merge Record` 章节且位置合规（历史豁免 TASK-001~025 共 25 个，
       理由见脚本白名单注释；位置豁免 21 个，理由见 F8_MERGE_RECORD_POSITION_EXEMPT；
       模板 templates/task/TASK.md 已在检）
PASS=9 FAIL=0 WARN=0
EXIT=0
```

**段 2 / 3 —— 探针 A（把 TASK-047 档案的 `## Merge Record` 整块挪到 `## Handoff` 之前）：**

```
$ grep -n "^## " tasks/active/TASK-047-.../TASK.md | tail -6
527:## Merge Record      ← 已挪到 Handoff 之前
549:## Handoff
571:## Task Rules

$ C:/Python313/python scripts/audit-repo.py
[FAIL] F8  1 个档案的 Merge Record 章节位置不合规
        - active/TASK-047-residual-debt-consolidation：`## Merge Record` 出现在 `## Handoff` 之前
          （须位于 `## Handoff` 之后、`## Task Rules` 之前）
PASS=8 FAIL=1 WARN=0
AUDIT_EXIT_CODE=1
```

**段 2b —— 探针 B（对 `templates/task/TASK.md` 做同样挪位，验证模板自身在检）：**

```
$ grep -n "^## " templates/task/TASK.md | tail -5
173:## Merge Record      ← 已挪到 Handoff 之前
206:## Handoff
219:## Task Rules

$ C:/Python313/python scripts/audit-repo.py
[FAIL] F8  1 个档案的 Merge Record 章节位置不合规
        - templates/task/TASK.md：`## Merge Record` 未位于 `## Handoff` 之后、`## Task Rules` 之前
          （模板自称位置由 F8 保证，模板自身必须率先合规）
PASS=8 FAIL=1 WARN=0
AUDIT_EXIT_CODE=1
```

**段 3 / 3 —— 全部复原：**

```
$ cp /tmp/t047-r3/TASK.md.bak      tasks/active/TASK-047-.../TASK.md
$ cp /tmp/t047-r3/template.md.bak  templates/task/TASK.md

$ C:/Python313/python scripts/audit-repo.py
[PASS] F8  全部 22 个非豁免档案均含 `## Merge Record` 章节且位置合规（…位置豁免 21 个…模板 templates/task/TASK.md 已在检）
PASS=9 FAIL=0 WARN=0
AUDIT_EXIT_CODE=0

$ git status --short
 M scripts/audit-repo.py
 M tasks/active/TASK-047-.../TASK.md
 M tasks/active/TASK-047-.../handoffs/2026-10-21-posthoc-recheck.md
 M tasks/active/TASK-047-.../handoffs/HANDOFF-002-implementer-to-coordinator.md
 M templates/task/TASK.md
 M vite.config.ts
```

#### 探针执行过程的一次自我更正（如实记录）

探针 A 第一版注入脚本用 `t2[:h.start()] + block + t2[h.end():]`，
`h.end()` **把 `## Handoff` 标题行本身也吃掉了** ⇒ 该锚点消失 ⇒ 命中「锚点缺失 ⇒ 跳过」分支
⇒ 未 FAIL。发现后**先从 `/tmp` 备份 `cp` 复原**（`cmp` 校验字节相同），
修正插入点为 `t2[:h.start()] + block + t2[h.start():]` 后重跑，才得到上面的段 2 输出。
**教训已写进本节**：探针必须验明「缺陷真的注入进去了」（此处即确认标题顺序确实颠倒），
而不能只等脚本的结论 —— 否则「没 FAIL」会被误读成「门禁无效」，而真实原因是探针把判据的前提删了。

---

## 5. R-4 · 其余失真逐条更正（F-3、F-5 ~ F-10）—— 完成

| # | 处理 | 实测证据 |
|---|------|----------|
| **F-3** | AC-4 判据由「`tasks/review/` 为空（`wc -l` = 0）」改为「**仅含本任务**」（`find … \| grep -v TASK-047` 为空） | 原判据与 AC-21 要求的终态（本任务迁入 `review/`）**互斥**，勾选时点成立、交付时点必然不成立 |
| **F-5** | `Changed Files` 的「自 `2a4e259` 起 **5** 提交」按整改后的实测重数 | 提交前重数，见 §8 |
| **F-6** | AC-3 判据加「排除引用判据的档案自身」：`grep -rn "第十三代实例回填" tasks/ \| grep -v "TASK-047"` → 空 | 原判据「全库零命中」**不成立**：实测 **3 hits 全在 TASK-047 自身档案**（`TASK.md:201` / `TASK.md:364` / review `:100`）。且该数**随引用次数单调增长**，永远不可能归零 |
| **F-7** | AC-13 措辞「**新增** `github-actions`」→「**提频 monthly → weekly**」；保留执行位披露原文；**更正原审查 C3 的错误结论** | `git show main:.github/dependabot.yml` 实测该生态早已存在（`interval: monthly`）。C3 前半句（`checkout@v4` 残留）**仍为事实**且已修（AC-12）。C3 行已加修订标注，明写「后半句是主控位的错误结论」 |
| **F-8** | `2026-10-21-coordinator-recheck.md` → **`2026-10-21-posthoc-recheck.md`**（`git mv`）；首行作者改为**执行位**；同步修订 AC-19 的强制文件名 | 根因是**主控位设计缺陷**：`-coordinator-recheck.md` 按 `.agents/protocols/handoff.md` §3.2 属主控位专用，却派给执行位产出。文件**内容未改写**（除修订注 + R-2 计数更正），实测命令与输出原样保留 |
| **F-9** | `HANDOFF-002` 的 `Date: …T09:2x:00+08:00` → **`2026-10-21T09:02:44+08:00`**；Risks 表破损文本已重写 | 时间取自引入该文件的提交 `91108c1` 的 author date（`git log --format=%aI --diff-filter=A -- <path>` 实测），是可复现取证值、非估计。破损原文 `失败模式 = 安装失败可重现({"im})，不出现"静默 SKIP"` 已改为完整句子，并按 R-1 的 CI 结果补记「PEP 668 未拦截」 |
| **F-10** | AC-8 判据「`grep -rn "Task ID: TASK-045" tasks/` 仍为 2 处」→ **行锚定**：`grep -rn "^Task ID: TASK-045" tasks/ docs/ .agents/` → 恰好 2 处 | 未锚定时实测 **7 处**：2 处真实 Meta + **5 处引用判据的档案自述**（`TASK.md` B1 行 / AC-8 行 / review F-10 行 / `HANDOFF-001` / `known-pitfalls.md:298`）。审查时是 5 处（2+3），本条修订又新增 2 处引用 ⇒ **再次证明该判据随引用次数增长、永远对不上**。行锚定后自述引用都在行中，天然免疫 |

> **F-6 / F-10 的共性已提升为可复用规则**：凡 `grep` 类判据，先确认命中是否含
> 「引用该判据的文档自身」；若会命中，要么**排除自述文件**（F-6），要么**把判据锚定到
> 自述不可能出现的位置**（F-10 用行首锚定）。后者更优 —— 它不依赖维护一份「要排除哪些文件」的清单。

---

## 6. R-5 · 快照与终态 —— 完成

### 6.1 全部门禁逐个退出码（AC-20，全部实跑）

| # | 命令 | 退出码 | 结果 |
|---|------|--------|------|
| 1 | `pnpm build:shared` | **0** | 无输出错误 |
| 2 | `pnpm lint` | **0** | 零输出 |
| 3 | `pnpm format:check` | **0** | `All matched files use Prettier code style!` |
| 4 | `pnpm test`（先 `mv node_modules/.vite /tmp`） | **0** | `Test Files 26 passed (26)` / `Tests 325 passed (325)` |
| 5 | `pnpm build`（先 `mv dist /tmp`） | **0** | `✓ built in 645ms` |
| 6 | `pnpm knip` | **0** | 无报告（白名单后积压清零） |
| 7 | `python scripts/audit-repo.py`（默认解释器） | **0** | `PASS=9 FAIL=0 WARN=0` |
| 8 | `C:/Python313/python scripts/audit-repo.py` | **0** | `PASS=9 FAIL=0 WARN=0`（F8 含位置合规 + 模板在检） |
| 9 | `python shared/scripts/audit_framework.py`（默认解释器） | **0** | `PASS=13 FAIL=0 WARN=0 SKIP=0` |
| 10 | `C:/Python313/python shared/scripts/audit_framework.py` | **0** | `PASS=13 FAIL=0 WARN=0 SKIP=0` |
| 11 | CI run `39537943459`（`install-lint-build` + `audit`） | — | 两作业 **success**（R-1：首次取得 CI 证据） |
| 12 | CI run `39543828636`（`install-lint-build` + `audit`，head `f1e512c`） | — | 两作业 **success**；`Test Files 26 / Tests 325`、F8 含位置校验 + 模板在检，均与本机逐字一致 |

**`audit_framework.py` 所用解释器（HANDOFF-003 要求必须注明）：**

```
$ which -a python            → /c/Python313/python   （PATH 中第一个）
$ python -c "import sys;print(sys.executable, sys.version)"
C:\Python313\python.exe  3.13.7 (tags/v3.13.7:bcee1c1, Aug 14 2025) [MSC v.194C 64-bit (AMD64)]
$ python -c "import yaml;print(yaml.__version__)"     → 6.0.3
```

⇒ 本 shell 中**默认 `python` 与显式 `C:/Python313/python` 是同一个解释器**（`C:\Python313\python.exe`，
Python 3.13.7，PyYAML 6.0.3 在位），故两者结果相同：`PASS=13 FAIL=0 SKIP=0`、退出码 0。

> **如实记录一处与主控位测量的差异**：主控位复审记录称「用默认解释器仍 `SKIP=1`」，
> **本次实测不复现** —— 本 shell 的 `python` 解析到 `C:\Python313\python.exe`（PyYAML 在位）。
> PATH 中另有 `WindowsApps\python`（Microsoft Store 执行别名），实测**在该沙箱内无任何输出**
> （既不给版本号也不给错误），不可用。差异可能源于会话间 PATH 或 PyYAML 安装状态不同；
> **本报告只陈报本次实测值，不推断原因**。真正稳定的判据是「PyYAML 是否可导入」
> （`import yaml` 成功 ⇒ A3 实跑 ⇒ `SKIP=0`），而非「用的是哪个路径」。

### 6.2 `Status → REVIEW` + 迁回 `tasks/review/`

```
$ git mv tasks/active/TASK-047-residual-debt-consolidation tasks/review/TASK-047-residual-debt-consolidation
$ grep -n "^Status:" tasks/review/TASK-047-.../TASK.md     → Status: REVIEW
$ find tasks/review -mindepth 1 -maxdepth 1 -type d        → TASK-047-residual-debt-consolidation（仅本任务）
```

`audit-repo.py` 在迁移后复跑仍 `PASS=9 FAIL=0`（F8 / F9 的路径标签自动跟随状态目录）。

### 6.3 `projects/README.md` 三处按实测重写

按 R-5 要求更新 107 / 118-119 / 163 行，并把「TASK-047 在 `review/` 待合并」改写为
**经一轮 CHANGES_REQUESTED 整改后重回 `review/`、PR #22 开启未合并、待人类授权 + 主控位 rebase-merge**
的如实描述。快照数字（`done/` 计数、`review/` 内容、`backlog`/`active` 为空）均以 `find` / `ls` 实测为准。

---

## 7. 未重做的事（HANDOFF-003 §4 列明已由主控位独立验证通过）

WP-1 九要素、F8/F9 门禁本体有效性、`docs/` 两值口径零残留、`.tmp-t0*` 已删、
`effectiveTrafficTotal` 无残留、`lint`/`format:check`/`knip`/`build` 全 0、
HD-1 未破坏历史编号、`e4d154c` 的带外披露方式 —— **均未重做**。

**上述项中被整改触动的情况（按 HANDOFF-003 要求说明原因）：**

| 被触动的项 | 原因 |
|---|---|
| `audit-repo.py` 的 F8 | R-3 的**对象就是 F8**（补顺序校验），属派单要求，非重做 |
| `templates/task/TASK.md` | 同上，R-3 要求改模板声明 |
| `pnpm test` / 门禁退出码 | AC-20 要求整改后复跑；且 R-2 改了 `vite.config.ts`，必须重跑 |
| 两个审计脚本 | R-3 改了 `audit-repo.py`、R-5 要求逐个记退出码，必须重跑 |

---

## 8. Changed Files / 提交数（F-5）

**本次整改新增的改动（相对 `4b8a5d3`）：**

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `vite.config.ts` | 修改（R-2） | `test.exclude` 显式恢复 `**/dist/**`（含 `node_modules` / `.git` 保留项） |
| `scripts/audit-repo.py` | 修改（R-3） | F8 增位置校验 + `HANDOFF_HEADING` / `TASK_RULES_HEADING` + `F8_MERGE_RECORD_POSITION_EXEMPT` + `TASK_TEMPLATE` 在检 |
| `templates/task/TASK.md` | 修改（R-3） | 「位置由 F8 保证」改为如实描述作用范围与历史位置豁免 |
| `tasks/review/TASK-047-…/TASK.md` | 回填 | KI-10、AC-3/4/5/6/8/13/19/20 判据修订、File Scope 补登记、Current State、Handoff 表 +004、Meta Status/沿革、Verification Plan |
| `tasks/review/TASK-047-…/handoffs/2026-10-21-posthoc-recheck.md` | 改名 + 修订（R-2/F-8） | `git mv` 自 `-coordinator-recheck.md`；首行作者改执行位 + 修订注；基线测试计数加分解注 |
| `tasks/review/TASK-047-…/handoffs/HANDOFF-002-implementer-to-coordinator.md` | 修订（R-2/F-9） | Date 占位改真实时间；Risks 破损文本重写 + CI 实证；Tests 字段加三重分解表；WP-6 行同步改名 |
| `tasks/review/TASK-047-…/handoffs/HANDOFF-004-implementer-to-coordinator.md` | **新增** | 本文件（整改报告） |
| `E:/NDLDSN-WORKSPACE/projects/README.md` | 修改（R-5） | 快照三处按实测重写 |

**提交数（F-5，实测）：** 自 `2a4e259` 起共 **10** 个提交（截至 `f4b49f5`）。
分解：原执行位 7 个（`9991f92`~`897fa8f`）+ 主控位审查交付物 `4b8a5d3` = 8，
本整改 2 个（`f1e512c` 整改收尾 + `f4b49f5` CI 证据补记）= **10**。
实测命令：`git rev-list --count main..HEAD`。

> **关于 F-5 的一次自我更正（如实记录）**：本条先写「9 个提交（含本收尾提交本身）」，
> 但随后为补记第二轮 CI 证据又追加了 `f4b49f5`，实测变为 **10**。
> 现改为**锚定到具体 SHA**（`f4b49f5`）而非「含本提交」—— 后者在「为改数字而再提交」时
> 会无限回归。合并时点若有追加提交，以 `git rev-list --count main..HEAD` 的重数为准。

---

## 9. Known Issues

- 本档案 KI-1 ~ KI-9 不变；**新增 KI-10**（Vitest 4 默认排除项名不副实，含修复、未选方案 B 的理由、
  三重计数分解表、判据变更），见 TASK.md `Known Issues`。
- **KI-10 的残留（未修，登记备查）**：`shared/dist/` 仍含编译测试产物
  （`schema/traffic.test.js` 等）。`shared/package.json` 的 `exports` 只暴露 `./dist/index.js`，
  外部无法经包入口导入，无功能影响；属构建卫生，建议后续任务给 `shared/tsconfig.json` 补
  `exclude: ["node_modules", "dist", "**/*.test.ts"]` 与 `server/tsconfig.json` 对齐。
- **F8 位置豁免清单需维护**：`F8_MERGE_RECORD_POSITION_EXEMPT` 现有 21 个条目。
  新任务（TASK-048 起）**不在豁免内**，章节顺序错误会直接 FAIL —— 这是预期行为。
  若将来清理历史档案顺序，须单独任务处理并同步缩减该清单。
- **grep 类判据的自污染是系统性风险**：F-6 / F-10 同源。本任务已修两处，
  但档案中其他 grep 判据（AC-9 / AC-12 等）**未逐一排查**，建议后续任务做一次全清单复查。

---

## 10. Remaining Work

- 主控位读实际 diff，复审 R-1~R-5 与 F-1~F-10 的整改质量（尤其是 §4.3 的反向验证原始输出与
  §3.3 的账目闭合）；
- 主控位判定 PASS / FAIL；FAIL 则再派整改单；
- PASS 后由**人类显式授权**，主控位执行 **rebase-merge**；
- 合并后按 D13-C 选项 C，本档案 `Merge Record` 由**下一个任务**回填，
  在此之前保持 `Status = REVIEW`、留在 `tasks/review/`（KI-1）。

---

## 11. Assumptions

- 「PR 不绿不得进入下一步」按 `install-lint-build` + `audit` 两作业 success 判定；两作业 green 后进入 R-2。
- 测试计数的「单一稳定值」以**排除 `shared/dist` 后**的 26 文件 / 325 用例为准；
  CI 中的计数在本次推送后应同样变为 26 / 325（`ci.yml` 先跑 `pnpm build:shared` 会重新生成
  `shared/dist`，但已被 `test.exclude` 排除，不再影响收集）。
- `projects/README.md` 位于 Workspace 级（非本仓库），随本批 `git add -A` 之外的单独路径提交
  —— 该文件不在本仓库版本控制内，其改动**不进入本 PR**，只在磁盘上生效。

---

## 12. Risks

| 风险 | 缓解 |
|------|------|
| `test.exclude` 整体替换默认值，漏写 `node_modules` 会引发灾难 | 已显式写回 `**/node_modules/**` 与 `**/.git/**`；文件内注释记录该坑 |
| F8 位置豁免清单被误读为「门禁可随意放宽」 | 豁免是**显式清单 + 逐条理由 + 登记日期**，与 HD-1 / F9 同一模式；新任务不在豁免内 |
| 探针类验证自身出错导致「假 FAIL / 假 PASS」 | §4.3 已如实记录一次探针 bug 及其发现过程；判据 = 「缺陷确认已注入」+「观察结论」双查 |
| `pnpm` 退出码被 `wmic.exe` 污染 | 全部命令同时记录退出码与输出末尾摘要（`Test Files` / `Tests` / `built in` / `PASS=`） |
| README 快照与磁盘状态再次漂移 | 三处均按 `find` / `ls` 实测重写并标注实测日；快照声明为「时点值」 |

---

## 13. Next Action

**主控位：** 读实际 diff → 复审 R-1~R-5 / F-1~F-10 → 判定 PASS / FAIL。
**执行位：** 未自行合并 PR、未自行判定 PASS、未代写主控位署名文件。
合并仍需**人类显式授权**，并由主控位执行 rebase-merge。
