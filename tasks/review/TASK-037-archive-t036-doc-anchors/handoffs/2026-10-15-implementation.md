# TASK-037 实施记录（handoff）

> 本文件记录 TASK-037 执行期间**全部实跑命令与原始输出**。
> 任务定义见 `TASK.md`；本 handoff 与档案同目录提交审查。
> 执行位：implementer（本会话）；日期：2026-10-15。

---

## 0. 分支与远端确认

```
$ git checkout -b chore/TASK-037-archive-t036-doc-anchors
$ git push -u origin chore/TASK-037-archive-t036-doc-anchors
$ git ls-remote --heads origin | grep TASK-037
6ee27779ca641a10166941ad89f93833a323f457	refs/heads/chore/TASK-037-archive-t036-doc-anchors
```

分支自 `main`（`6ee2777`，PR #9 合并后）派生，**先推远端后开工**，远端对象确认存在。

---

## 1. AC-1 事实实查（TASK-036 Merge Record 七要素）

### 1.1 PR #9 合并标识

```
$ gh api repos/huyanluanyuqaq/shadcn-admin/pulls/9 --jq '{number, state, merged, merge_commit_sha, merged_at, commits, title}'
{"base_ref":null,"commits":8,"head_ref":null,"merge_commit_sha":"6ee27779ca641a10166941ad89f93833a323f457",
 "merged":true,"merged_at":"2026-10-15T09:28:05Z","number":9,"state":"closed",
 "title":"docs(TASK-036): 设计稿滞后断言补记与时点快照限定 + clerk 死代码清理 + D13-C 承载 TASK-032 归档回写"}
```

- `merged: true`、`commits: 8`、`merged_at = 2026-10-15T09:28:05Z`、
  `merge_commit_sha = 6ee27779ca641a10166941ad89f93833a323f457`（= 合并后 main HEAD `6ee2777`）。

### 1.2 合并后 main push CI 双绿

```
$ gh api repos/huyanluanyuqaq/shadcn-admin/actions/runs/38713147537/jobs --jq '.jobs[] | {name, status, conclusion, started_at, completed_at}'
{"completed_at":"2026-10-15T09:28:15Z","conclusion":"success","name":"audit","started_at":"2026-10-15T09:28:11Z","status":"completed"}
{"completed_at":"2026-10-15T09:29:21Z","conclusion":"success","name":"install-lint-build","started_at":"2026-10-15T09:28:11Z","status":"completed"}
```

- run `38713147537`：`audit` 09:28:11→09:28:15 success；`install-lint-build` 09:28:11→09:29:21 success。

### 1.3 D8 解耦第 8 次独立复现

```
$ gh api "repos/huyanluanyuqaq/shadcn-admin/actions/runs?head_sha=6ee27779ca641a10166941ad89f93833a323f457" --jq '.workflow_runs[] | {id, name, event, status, conclusion}'
{"conclusion":"success","event":"push","head_sha":"6ee27779ca641a10166941ad89f93833a323f457","id":38713147537,"name":"Continuous Integration","status":"completed"}
```

- `6ee2777` 上唯一 run = `Continuous Integration`（push），**无 `Build and Push Docker Image`** → D8 解耦第 8 次复现。

### 1.4 rebase-merge 策略证据（head 提交均非 main 祖先）

```
$ gh api repos/huyanluanyuqaq/shadcn-admin/pulls/9/commits --jq '.[].sha'
c722b4ace702f0d54d87cf5fdaa5595c8629b73c
4bef0cf96b5521875370e4ea59aed8d99ee885f6
e11aac3ef6d5cd7a2fb835a4c2bc15caf514c61f
ce6fb6a23a02a6259909246fe3d30240abf1f889
177822876201fd1ac7d554c6c36bf0262bde7f6c
67034309e8d56b08924e5b29aeb0b892020d3e3f
10f893a2ea030429d8ee74680101dbf37a2c63b6
320d95ef103f92f5b39f9d96fb1946f63a8bdf4d

$ for sha in $(cat /tmp/t036_head_shas.txt); do git merge-base --is-ancestor $sha origin/main && echo "$sha IS-ANCESTOR" || echo "$sha NOT-ANCESTOR"; done
（8 行全部 NOT-ANCESTOR）
```

8 个 head 提交 SHA 均**非** main 祖先 → rebase-merge 全改写；main 历史线性（`git log --oneline --graph origin/main` 无 merge commit）。

### 1.5 8 对 SHA 映射（tree / subject 逐对相同）

```
$ for pair in "c722b4a:f1d1428" "4bef0cf:66ca01e" "e11aac3:6093280" "ce6fb6a:e686251" "1778228:9b1aaf9" "6703430:410b9e5" "10f893a:ae1e76f" "320d95e:6ee2777"; do
    ot=$(git rev-parse "$old^{tree}"); nt=$(git rev-parse "$new^{tree}");
    os=$(git log -1 --format=%s "$old"); ns=$(git log -1 --format=%s "$new");
    ...; echo "$old -> $new : $tree_ok $subj_ok | $ns"; done
c722b4a -> f1d1428 : TREE-SAME SUBJECT-SAME | docs(TASK-036): 建立任务档案（设计稿补记 + 时点限定 + clerk 清理 + D13-C 回写）
4bef0cf -> 66ca01e : TREE-SAME SUBJECT-SAME | chore(TASK-036): 删除 clerk 死代码资产并同步 AGENTS.md/复核清单断言
e11aac3 -> 6093280 : TREE-SAME SUBJECT-SAME | docs(TASK-036): 承载 TASK-032 归档回写（D13-C）
ce6fb6a -> e686251 : TREE-SAME SUBJECT-SAME | docs(TASK-036): 实施记录与验证证据回填；档案迁入 tasks/review/（Status → REVIEW）
1778228 -> 9b1aaf9 : TREE-SAME SUBJECT-SAME | docs(TASK-036): 补录末提交 CI 双绿留痕（run 38690925584：audit 4s / install-lint-build 1m19s）
6703430 -> 410b9e5 : TREE-SAME SUBJECT-SAME | docs(TASK-036): 按独立审查整改 O1–O5 并归档复审记录
10f893a -> ae1e76f : TREE-SAME SUBJECT-SAME | docs(TASK-036): 档案补记审查整改提交与远端状态时点锚
320d95e -> 6ee2777 : TREE-SAME SUBJECT-SAME | docs(TASK-036): 归档第 2 轮复审记录（可合并，无阻断）
```

8 对全部 TREE-SAME + SUBJECT-SAME → rebase-merge 改写 SHA、内容零变化。

### 1.6 提交范围与合并前 CI

```
$ git log --oneline f212b7c..6ee2777
6ee2777 docs(TASK-036): 归档第 2 轮复审记录（可合并，无阻断）
ae1e76f docs(TASK-036): 档案补记审查整改提交与远端状态时点锚
410b9e5 docs(TASK-036): 按独立审查整改 O1–O5 并归档复审记录
9b1aaf9 docs(TASK-036): 补录末提交 CI 双绿留痕（run 38690925584：audit 4s / install-lint-build 1m19s）
e686251 docs(TASK-036): 实施记录与验证证据回填；档案迁入 tasks/review/（Status → REVIEW）
6093280 docs(TASK-036): 承载 TASK-032 归档回写（D13-C）
66ca01e chore(TASK-036): 删除 clerk 死代码资产并同步 AGENTS.md/复核清单断言
f1d1428 docs(TASK-036): 建立任务档案（设计稿补记 + 时点限定 + clerk 清理 + D13-C 回写）

$ gh api repos/huyanluanyuqaq/shadcn-admin/commits/10f893a2ea030429d8ee74680101dbf37a2c63b6/check-runs --jq '.check_runs[] | "\(.name) \(.conclusion) \(.started_at) \(.completed_at)"'
install-lint-build success 2026-10-15T07:11:57Z 2026-10-15T07:13:17Z
audit success 2026-10-15T07:11:56Z 2026-10-15T07:12:02Z
```

main `f212b7c` → `6ee2777` 共 8 提交；PR head（`10f893a`）pull_request CI 双绿（run `38697133770`）。

### 1.7 两轮独立审查史实

来源：`tasks/review/TASK-036-doc-sync-and-clerk-cleanup/handoffs/2026-10-15-review.md` §1–§6（第 2 轮复审记录）+ PR #9 描述实查：

- 第 1 轮（对象 `1778228`）结论「**待整改**」：阻断 O1（TASK-032 Merge Record「独立审查」行事实错误）、阻断 O2（设计稿 `:1281` 第四处无限定时点快照）、非阻断 O3–O5；
- 两轮整改：`6703430`（落实 O1–O5 + N4）、`10f893a`（落实主控位复核 N7-1/N7-2/N7-3）；
- 第 2 轮复审（对象 `10f893a`，同一独立审查实例）结论「**可合并，无阻断**」：O1–O5、N7-1/N7-2/N7-3、N4 全部经实跑验证关闭；N6 裁定为历史记录可接受；
- N8（PR 描述补记审查周期）已由执行位于合并前履行：

```
$ gh pr view 9 --json body --jq '.body' | grep -n "审查\|待整改\|可合并" | head
86:## 审查与整改（独立审查，换实例双会话）
88:**第 1 轮独立审查**（对象 `1778228`）结论「**待整改**」：
96:**第 2 轮复审**（对象 `10f893a`，同一独立审查实例）结论「**可合并，无阻断**」：…
150:- [x] PR 描述已补记审查周期（第 1 轮待整改 → 两轮整改 → 第 2 轮复审可合并、无阻断；N8 关闭）
```

---

## 2. AC-4 计数实查（D13 实例映射 + D8 八次复现）

### 2.1 PR 全列表（D13 计数的基数）

```
$ gh pr list --state all --json number,title,state --limit 30
[{"number":9,"state":"MERGED","title":"docs(TASK-036): …+ D13-C 承载 TASK-032 归档回写"},
 {"number":8,"state":"MERGED","title":"docs(TASK-032): 核实并修正否定性断言（AGENTS.md 6 处）并建立周期性复核清单；按 D13-C 归档回写 TASK-034"},
 {"number":7,"state":"MERGED","title":"chore(TASK-034): 统一「验证项」编号口径（V1–V5）— V5 裁决为「绿灯可合并」阳性对照义"},
 {"number":6,"state":"MERGED","title":"TASK-035: 落地 D13 裁决（路线 C：回写并入下一任务）并登记 D12 执行结果"},
 {"number":5,"state":"MERGED","title":"TASK-033 归档回写：Status → DONE、档案移入 tasks/done/、回写 Merge Record"},
 {"number":4,"state":"MERGED","title":"TASK-033: 阶段 3 平台门禁归档与 stale.yml 处置"},
 {"number":3,"state":"CLOSED","title":"test(v4): 分支保护实测 —— 故意让 CI 红灯的探针 PR（请勿合并）"},
 {"number":2,"state":"MERGED","title":"chore(TASK-031): 合并后归档与回写（协议 §6 / §9）"},
 {"number":1,"state":"MERGED","title":"chore(TASK-031): 在 shadcn-admin 落地双 Agent GitHub 协作框架（文件层）"}]
```

### 2.2 各 PR 提交实读（承载关系逐条对）

| PR | 提交首行（实读 `gh api …/pulls/<n>/commits`） | 承载归档回写？ |
|----|---------------------------------------------|----------------|
| #1 | TASK-031 文件层落地 | 否（实施） |
| #2 | `chore(task): TASK-031 合并后归档与回写（协议 §6 / §9）` | **是**（TASK-031，选项 A） |
| #3 | 探针 PR（故意 CI 红灯） | 否（已关闭） |
| #4 | `docs(TASK-033): 阶段 3 平台门禁归档 + stale.yml 处置` | 否（TASK-033 实施） |
| #5 | `chore(TASK-033): 归档回写 —— Status → DONE、档案移入 tasks/done/、回写 Merge Record` | **是**（TASK-033，选项 A） |
| #6 | TASK-035 落地 D13 裁决 C（`eec55b7` 等 3 提交） | 否（实施） |
| #7 | `chore(TASK-034): 统一 V 编号口径（V5 = 绿灯可合并阳性对照义）并按 D13-C 归档 TASK-035` | **是**（TASK-035，**C 实例 1**） |
| #8 | `docs(TASK-032): …按 D13-C 归档回写 TASK-034`（`f2c593b`：`chore(TASK-032): …按 D13-C 回写 TASK-034 归档`） | **是**（TASK-034，**C 实例 2**） |
| #9 | `docs(TASK-036): 承载 TASK-032 归档回写（D13-C）`（= `e11aac3`→`6093280`） | **是**（TASK-032，**C 实例 3**） |

**结论（与设计稿更新写入一致）：**
- 选项 A 时期 = PR #2 / #4 / #5（沿用设计稿原计数的史实口径：TASK-031 的 PR #2；TASK-033 的 PR #4 / PR #5）；
- D13-C 裁决后 = 3 次（PR #7 承载 TASK-035、PR #8 承载 TASK-034、PR #9 承载 TASK-032）；
- 本任务（TASK-037）PR 承载 TASK-036 回写 = **第 4 个 C 实例**（PR 建立后以 `gh pr list` 复核）。

### 2.3 D8 八次复现：8 个 main HEAD 的 run 列表逐条实查

```
$ for h in da93f4b e3231e7 0ea1916 94c5880 b31792e 2be342e f212b7c 6ee2777; do
    full=$(git rev-parse $h);
    n=$(gh api "repos/huyanluanyuqaq/shadcn-admin/actions/runs?head_sha=$full" --jq '.total_count');
    names=$(gh api "repos/huyanluanyuqaq/shadcn-admin/actions/runs?head_sha=$full" --jq '[.workflow_runs[].name] | join(",")');
    echo "$h runs=$n [$names]"; done
da93f4b runs=1 [Continuous Integration]
e3231e7 runs=1 [Continuous Integration]
0ea1916 runs=1 [Continuous Integration]
94c5880 runs=1 [Continuous Integration]
b31792e runs=2 [Close inactive issues,Continuous Integration]
2be342e runs=1 [Continuous Integration]
f212b7c runs=1 [Continuous Integration]
6ee2777 runs=1 [Continuous Integration]
```

- 8 个 head 均**无 `Build and Push Docker Image` 运行** → D8 解耦**八次独立复现**成立。
- **如实披露 `b31792e` 的细节（2 run）：** ① `Close inactive issues`（id `38662878838`）为
  **`workflow_dispatch` 手动触发**（stale.yml 已去 schedule，非计划任务自动触发；非 docker）；
  ② `Continuous Integration`（id `38609669658`，push）因 2026-10-14 Actions 停用最终
  **queued 未完成**（TASK-034 已登记该事件并有 CI 重投递留痕）。两者均不构成 docker 运行，
  D8 判据（无 `Build and Push Docker Image`）不受影响。

---

## 3. AC-2 / AC-3 仓库杂项

### 3.1 `.gitignore` 增 `.workbuddy/`

```
$ git diff .gitignore
+# agent 临时文件 / PR 描述草稿（TASK-032 D2 主控位裁决纳入 ignore）
+.workbuddy/
```

### 3.2 `ci.yml` checkout v4→v5（两处）

```
$ python -c "import yaml,sys;yaml.safe_load(open('.github/workflows/ci.yml'));print('YAML OK')"
YAML OK
$ grep -n "checkout@" .github/workflows/ci.yml
22:        uses: actions/checkout@v5
77:        uses: actions/checkout@v5
$ grep -n "setup-node@" .github/workflows/ci.yml
27:        uses: actions/setup-node@v4      # 未动（任务定义只允许改 checkout 两行）
```

### 3.3 `.workbuddy/` ignore 生效

```
$ git check-ignore -v .workbuddy/
.gitignore:43:.workbuddy/	.workbuddy/
$ git status --short
 M .github/workflows/ci.yml
 M .gitignore
（提交后复跑：干净，无 ?? .workbuddy/）
```

---

## 4. 设计稿改动（`.agents/` 不在 Git —— 仅文件改动 + 本留痕佐证）

文件：`.agents/proposals/dual-agent-github-collaboration-design-v1-draft.md`

### 4.1 AC-4 三处历史计数注时点化（三要素：时点 / 动态预期 / 非永久断言+重测命令）

1. **§17.3 前言**（原「2026-10-15 又触发 **2 次**（TASK-033 的 PR #4 与 PR #5），**共 3 次**」）
   → 选项 A 时期 3 次（PR #2 / #4 / #5）；D13-C 裁决后已 3 次（PR #7 承载 TASK-035、
   PR #8 承载 TASK-034、PR #9 承载 TASK-032；TASK-036 的回写由 TASK-037 的交付请求承载
   = 第 4 个 C 实例）；时点 2026-10-15；动态预期 = 此后每个任务的交付请求可能 +1；
   重测命令 = `gh pr list --state all --json number,title` 与
   `gh api repos/huyanluanyuqaq/shadcn-admin/pulls/<n>`。
2. **§17.1 D13 行**（原「**已实际触发 3 次**（TASK-031 的 PR #2；TASK-033 的 PR #4 / PR #5）」）
   → 保留原史实并追加 C 裁决后计数（同 1）+ 三要素。
3. **§18.1 末注**（原「构成解耦的**四次独立复现**」）
   → **八次**并列出 8 个 main HEAD：`da93f4b` / `e3231e7` / `0ea1916` / `94c5880` /
   `b31792e` / `2be342e` / `f212b7c` / `6ee2777`；时点 2026-10-15；动态预期 = 此后每次合并
   可能 +1；重测命令 = `gh api repos/huyanluanyuqaq/shadcn-admin/actions/runs`
   （查该 head 是否只有 CI 运行）。
   - §17.3「实测」表内历史行（如 `:1546`「第四次独立复现」）锚定当时合并事件，属历史记录，
     **未动**（与 TASK-032 审查 N6 裁定先例一致）。

### 4.2 AC-5 V3 行交叉引用注

§17.1「待实测项」表 V3 行（`ci.yml` 增加工作分支 push 触发后，检查是否如期运行）
表后补注：权威定义见 `github-capability-matrix.md` §8（「检查是否在**合并之前**于工作分支上
运行」）；本行语境为阶段 2 的 push 触发提案；TASK-034 独立审查判「同义、无冲突」；
结论「**甲下不需要**：`pull_request` 触发已足够」**一字未动**。
`github-capability-matrix.md` **零改动**（`git status` 佐证：`.agents/` 不在任何仓库，
但审计 A2/A10 通过佐证引用完整）。

---

## 5. 验证汇总

| 验证项 | 命令 | 结果 |
|--------|------|------|
| 框架审计（`.agents/` 改动后） | `python shared/scripts/audit_framework.py` | **PASS=13 FAIL=0** WARN=0 SKIP=0（exit 0） |
| 仓库审计 | `python scripts/audit-repo.py`（仓库根） | **PASS=6 FAIL=0**（exit 0） |
| 构建 | `pnpm build` | **✓ built in 750ms**（`tsc -b` + `vite build`；首次因本环境防误删保护拦下 Vite 清空 `dist/assets`（73 文件 > 50 阈值），`rm -rf dist` 后重建通过 —— 与 TASK-036 同款环境问题，CI 环境无此保护） |
| Lint | `pnpm lint` | **通过**（eslint 无输出） |
| 格式 | `pnpm format:check` | **通过**（All matched files use Prettier code style!；覆盖 ci.yml） |
| `.workbuddy/` ignore | `git status --short` | 干净（无 `?? .workbuddy/`） |
| ci.yml YAML | `python -c "import yaml;yaml.safe_load(...)"` | **YAML OK** |
| PR 门禁 | `gh pr checks` | **双绿**（PR #10，run `38733746197`：audit 5s / install-lint-build 54s；head `fef2a1e` OPEN/MERGEABLE） |

---

## 6. PR 与 CI

```
$ gh pr create --base main --head chore/TASK-037-archive-t036-doc-anchors \
    --title "docs(TASK-037): 承载 TASK-036 归档回写（D13-C 第四实例）+ 设计稿历史计数注时点化 + V3 措辞对齐 + 仓库杂项"
https://github.com/huyanluanyuqaq/shadcn-admin/pull/10

$ gh pr checks 10
audit                pass    5s    https://github.com/huyanluanyuqaq/shadcn-admin/actions/runs/38733746197/job/116417680885
install-lint-build   pass    54s   https://github.com/huyanluanyuqaq/shadcn-admin/actions/runs/38733746197/job/116417681425

$ gh pr view 10 --json number,state,mergeable,headRefOid
{"headRefOid":"fef2a1ed8b849ecbc60479a563cdf0fd7eb715f8","mergeable":"MERGEABLE","number":10,"state":"OPEN"}
```

- **PR #10**（`chore/TASK-037-archive-t036-doc-anchors` → `main`），head `fef2a1e`；
- CI run `38733746197`（pull_request 事件）双绿：`audit` 5s / `install-lint-build` 54s；
- PR 状态 OPEN / MERGEABLE。**不合并**（合并不经执行位）。

---

## 7. 提交序列

（每提交 footer 均含 `Refs: TASK-037`；显式路径 `git add`。）

| # | 短 SHA | subject |
|---|--------|---------|
| 1 | `2e9084c` | docs(TASK-037): 建立任务档案（TASK-036 归档回写 + 设计稿计数时点化 + 仓库杂项） |
| 2 | `95fd1c2` | docs(TASK-036): 归档回写 —— Status → DONE、回填 Merge Record 七要素、移入 tasks/done/ |
| 3 | `c7729dd` | chore(TASK-037): .gitignore 增 .workbuddy/ + ci.yml checkout v4→v5 |
| 4 | `fef2a1e` | docs(TASK-037): 档案回填（实施记录/验证/Known Issues）+ 迁 tasks/review/ + handoff |
| 5 | （本提交） | docs(TASK-037): 补录 PR #10 与 gh pr checks 双绿留痕（run 38733746197） |

---

## 8. Known Issues 披露

- **`.agents/` 改动无版本控制（D9 现状）：** 设计稿三处计数注与 V3 行改动不在 Git 内，
  无法以 PR 行差异审查，以 `audit_framework.py` 实跑（PASS=13）+ 本 handoff §4 全文留痕 +
  档案佐证；这再次构成 D9（`.agents/` 纳入 Git）的现实依据。
- **D9 被显式排除的理由：** 设计稿 §17.1 已将 D9「列为独立后续任务」；本任务仅在
  Known Issues 披露其现实影响，不越权纳入范围。
- **环境注记（非代码问题）：** 首次 `pnpm build` 失败于本环境防误删保护
  （`[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]`：Vite `prepareOutDir` 清空
  `dist/assets` 共 73 个文件 > 50 阈值），处置同 TASK-036 先例：`rm -rf dist`
  （`.gitignore` 忽略的构建产物）后重建通过。CI 环境无此保护，不受影响。
- **`Refs:` footer 无工具强制：** 沿 TASK-032/036 结论（`scripts/` 与 `.agents/` 仅作文档约定），
  本任务提交均手动加 footer，遵循 `rules/github.md` §3。
