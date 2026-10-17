# HANDOFF-002 — 执行位 Implementer → 主控位 Coordinator

---

## Meta

```yaml
From: 执行位 Implementer
To: 主控位 Coordinator
Task: TASK-043 — D13-C 第八/第九实例归档回写 + 修正 projects/README.md 失效断言 + 修复冒烟脚本 X4 顺序缺陷
Date: 2026-10-17
Current State: REVIEW
Previous Handoff: handoffs/HANDOFF-001-coordinator-to-implementer.md
```

---

## Completed Work

### ① X4 修复（AC-6 / AC-7 / AC-9）

以**符号名**定位（未照抄 TASK-041 的历史行号），确认机理与 HANDOFF-001 的逐行分析一致：
第 5 段 `const pool` / `const plan` 于第 13 段被删除，第 17.9.1 段仍引用 ⇒ `FOREIGN KEY constraint failed`。

**修复方式（严格遵循 Implementation Plan 推荐方案）：**

- 在 17.9.1 段**之前**创建**独立的** `richPool` / `richPlan`
  （名称 `smoke-pool2-${suffix}` / `smoke-plan2-${suffix}`，载荷与原资源一致）；
- `richCustomer.body.poolId` / `planId` 与 `richSub2.body.poolId` 改指向新资源；
- 在本段**既有的清理块**中补删这两个新资源（与该段「清理：删除订阅 + 停用两渠道」风格一致）；
- **未**复用已删除的 `pool` / `plan`，**未**把外键置空绕过。

**冒烟结果（同一隔离环境，修复前 / 后对照）：**

| 阶段 | 通过 | 失败 | 说明 |
|------|------|------|------|
| 修复前（`f2a63bc`，未改任何代码） | **153** | **4** | 4 项即 X4 目标断言 |
| 修复后（同环境） | **159** | **0** | 通过项 **+6**、失败项 **−4** |

修复前的 4 项失败（原始输出）：

```text
✗ 富格式验证：创建第二个客户（用于绑定订阅） → {"error":"Internal Server Error","message":"FOREIGN KEY constraint failed"}
✗ 富格式验证：创建已绑定客户的订阅 → {"error":"Internal Server Error","message":"FOREIGN KEY constraint failed"}
✗ 富格式验证：单条同步成功（已绑定客户） → {"error":"Bad Request","message":"ID 不合法"}
✗ 已绑定客户的订阅同步成功通知显示客户名称（TASK-028）
```

修复后同 4 项全部 `✓` ⇒ **AC-6 达成；通过项增加、失败项减少、无剩余失败项 ⇒ AC-9 达成。**

**AC-7（未自我欺骗）三点必查，逐项实证：**

1. **`check(` 调用数只增不减** —— 17.9 段区域由 **4** 增至 **6**（新增的 2 项即
   `richPool` / `richPlan` 的创建检查）；既有 4 项断言**名称与判定条件逐字未改**。
2. **`check()` 判定条件无放宽** —— 全段无任何 `check(` 被修改（`git diff` 全文审阅，
   改动仅「新增 2 个 req + 2 个 check」与「2 处 `poolId` 指向 + 清理块补 2 个 DELETE」）。
3. **`poolId` / `planId` 未被置空绕过** —— 二者分别指向
   `richPool.json?.id` / `richPlan.json?.id`，均为真实创建成功（201）的资源 ID。

### ② TASK-041 归档回写（AC-2 / AC-3，D13-C 第八实例）

九要素全部由执行位以 `gh` / `git` **实查**后落笔，**未照抄本任务档案或任何既有文档**：

| 要素 | 实测值 |
|------|--------|
| PR | **#13** |
| 合并策略 | rebase-merge（`3d37b4a → 72d8f28`） |
| 提交数 | **6** |
| merged_at | **2026-10-16T18:09:53Z** |
| merge_commit_sha | **`72d8f28f09df689fdf3d0156118eeb40d54af525`**（pre-rebase head `b66ab74`） |
| 合并后 CI | run **`38945222696`** `success`，`headSha = 72d8f28` |
| D8 解耦 | **第 12 次复现** —— `gh api .../actions/runs?head_sha=72d8f28…` → `total_count = 1`，仅 `Continuous Integration`，无 docker run |
| 独立审查 | `handoffs/2026-10-17-review.md`，两轮，结论无阻断项 / 14 项 AC ✅ |
| SHA 映射 | **6 对**，逐对验证通过 |

SHA 映射逐对验证原始输出（`git cat-file -t` + `git show -s --format=%t` + `git merge-base --is-ancestor`）：

```text
ad34c33 (commit, tree=874fbc6) <- f750f4b (commit, tree=874fbc6) tree_match=YES post_on_main=YES
fe1d94e (commit, tree=d143283) <- 8062818 (commit, tree=d143283) tree_match=YES post_on_main=YES
10fd84e (commit, tree=d524c07) <- b14e097 (commit, tree=d524c07) tree_match=YES post_on_main=YES
f7453ae (commit, tree=a135983) <- 0ccd79a (commit, tree=a135983) tree_match=YES post_on_main=YES
9d794c7 (commit, tree=fa48db3) <- ee0bf64 (commit, tree=fa48db3) tree_match=YES post_on_main=YES
72d8f28 (commit, tree=d788b4a) <- b66ab74 (commit, tree=d788b4a) tree_match=YES post_on_main=YES
```

同步修正其滞后指针（R5）：Meta `Status` / `Owner`、顶部状态括注、`Next Action`（改为「无待办」）、
`Current State` 头部补 D13-C 第八实例完成事实。

**归档动作：** `Status: REVIEW → DONE` + `git mv tasks/review/TASK-041-… tasks/done/TASK-041-…`。
`git status` 见 `R`/`RM` 重命名记录；`grep "^Status:" tasks/done/TASK-041-…/TASK.md` → `Status: DONE`。

### ③ TASK-042 归档回写（AC-4，D13-C 第九实例）

原 `Merge Record` 仅含 PR #14 的部分事实（缺 `merged_at` / `merge_commit_sha` / D8 / 审查 /
SHA 映射），且未含 PR #15。已实查补全为**九要素 + PR #14（4 对）/ PR #15（2 对）共 6 对 SHA 映射**，
并单列「PR #15（档案回写）合并事实」一节。

| 要素 | 实测值（PR #14） |
|------|------------------|
| PR | **#14**（代码）+ **#15**（档案回写） |
| 合并策略 | rebase-merge（`72d8f28 → b62e981`） |
| 提交数 | **4** |
| merged_at | **2026-10-17T05:14:48Z** |
| merge_commit_sha | **`b62e9814bfb864c24c5398e868836e9681e64ec0`**（pre-rebase head `a075b169`） |
| 合并后 CI | run **`39005551732`** `success`，两作业均 success |
| D8 解耦 | 见下方「★ 一处需要主控位复核的表述修正」 |
| 独立审查 | `handoffs/HANDOFF-002-implementer-to-coordinator.md`，结论 **PASS，附 3 项 MINOR** |
| SHA 映射 | **6 对**（PR #14 四对 + PR #15 两对），逐对验证通过 |

PR #15：`merged_at 2026-10-17T06:45:04Z`、merge commit `f2a63bc`、提交数 2、合并后 run `39011065238` 双绿。

**★ 一处需要主控位复核的表述修正（执行位的独立判断，请确认）：**
TASK-042 原档案将「D8 解耦」作为合并后结论陈述，但**实测 `head_sha=b62e981` 的 actions runs
`total_count = 3`**，其中 2 个 `Build and Push Docker Image` 分别由
`workflow_dispatch`（run `39006433376`，AC-6 已授权）与 tag `v1.0.1` push
（run `39007059836`，AC-7 已授权）触发。执行位据此把该单元格改写为：
**该合并自身的 push 只产生 `Continuous Integration` 一个 run ⇒ 普通合并仍未触发 docker.yml，D8 解耦成立**，
并注明 2 个 docker run 的来源均为已授权动作。**未删除、未淡化任何既有事实。**

同步修正其滞后指针（R5）：Meta `Status` / `Owner`、顶部「编号说明」中 041 的目录表述、
`Current State` 头部、`Next Action`（原写「主控位审查 PR #15 → PASS 后合并」，PR #15 已合并，
已改为「无待办」并保留失效原文与修正说明）。

**归档动作：** `Status: REVIEW → DONE` + `git mv` → `tasks/done/`。`tasks/review/` 现仅剩 `.gitkeep`。

### ④ `projects/README.md` 失效断言修正（AC-5，Workspace 侧）

修正三处（严格限于纠正失实描述，未扩写项目介绍、未重排章节、未动 business-manager 条目）：

1. 第 107 行：「TASK-001 ~ TASK-022 全部完成」→「TASK-001 ~ TASK-042 全部完成，`tasks/done/` 共 41 个」；
2. 第 117–118 行：「`backlog`/`active`/`review` 均为空；`done` 下 22 个」→ 实况：
   `backlog` / `review` 为空、`active` 为 **TASK-043**、`done` **41 个**（编号 001–042，038 为模板仓库任务）；
3. 任务清单由 TASK-022 **续写至 TASK-042**（023–042 逐条一句，标题均自各 `TASK.md` 的 `Title:` 实取）。

**⚠️ 跨仓事实（须主控位/人类知悉）：** 实测 `E:/NDLDSN-WORKSPACE` **不是 Git 仓库**
（`git rev-parse --is-inside-work-tree` → `fatal: not a git repository`）⇒ 该改动**无法提交**。
已按 TASK-043「跨仓修改的处置方式」第 4 条处置：**已修改 + 已在本 handoff 留痕**，
并登记为 KI-B。**执行位未自行 `git init`**（涉及嵌套仓库问题，`AGENTS.md` §11）。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `server/scripts/smoke.ts` | 修改 | X4 修复（+48 / −3 行；仅 17.9.1 段与其清理块） |
| `tasks/review/TASK-041-customer-expire-required/TASK.md` | 回写 + 迁出 | Merge Record 九要素 + 6 对 SHA 映射；Status → DONE；修正滞后指针 |
| `tasks/review/TASK-042-ci-server-typecheck-and-release-gate/TASK.md` | 回写 + 迁出 | Merge Record 补全九要素 + 6 对 SHA 映射 + PR #15 独立节；Status → DONE；修正滞后指针 |
| `tasks/done/TASK-041-…/**`、`tasks/done/TASK-042-…/**` | 迁出 | `git mv` 目标（handoffs / artifacts 零内容改动） |
| `tasks/review/TASK-043-archive-writeback-and-smoke-x4/**` | 新增/回填 | 本任务档案（Status → REVIEW、AC 证据、Known Issues、Merge Record 待第十实例）+ 本 handoff |
| `E:/NDLDSN-WORKSPACE/projects/README.md` | 修改（**Workspace 侧，不在本 PR**） | 三处失效断言纠正（见上） |

> **反夹带自证：** `git diff HEAD --stat` 仅涉及 `server/scripts/smoke.ts` 与 `tasks/**`。

---

## Tests

```yaml
命令: 见下方逐条
结果: 全部通过
覆盖:
  - AC-1 前置基线（git rev-parse / status / gh pr view 13/14/15）
  - AC-2/AC-3/AC-4 SHA 映射逐对验证 + 归档自洽
  - AC-6/AC-7/AC-9 隔离环境冒烟（修复前 153/4 → 修复后 159/0）
  - AC-8 本地验证六项 + 两个 Python 审计
未覆盖:
  - AC-5 的 Workspace 侧提交（Workspace 非 Git 仓库，无法纳入版本控制，见 KI-B）
  - AC-10 的 CI 双绿（PR 刚开立，待主控位复核时点）
```

**AC-1 前置基线原始输出：**

```text
$ git fetch origin && git rev-parse main origin/main
f2a63bc48ce50a165db0d338bb1465bcfa4d2c31
f2a63bc48ce50a165db0d338bb1465bcfa4d2c31
$ git status --short
?? tasks/active/TASK-043-archive-writeback-and-smoke-x4/     # 仅本任务档案（设计阶段产物）

$ gh pr view 13 --json state,mergedAt,mergeCommit
{"mergeCommit":{"oid":"72d8f28f09df689fdf3d0156118eeb40d54af525"},"mergedAt":"2026-10-16T18:09:53Z","number":13,"state":"MERGED",...}
$ gh pr view 14 --json ...
{"mergeCommit":{"oid":"b62e9814bfb864c24c5398e868836e9681e64ec0"},"mergedAt":"2026-10-17T05:14:48Z","number":14,"state":"MERGED",...}
$ gh pr view 15 --json ...
{"mergeCommit":{"oid":"f2a63bc48ce50a165db0d338bb1465bcfa4d2c31"},"mergedAt":"2026-10-17T06:45:04Z","number":15,"state":"MERGED",...}
```

**AC-8 本地验证原始输出摘要：**

```text
pnpm build:shared            → EXIT=0
pnpm typecheck:server        → EXIT=0
pnpm lint                    → EXIT=0（无输出）
pnpm format:check            → EXIT=0（All matched files use Prettier code style!）
pnpm test                    → EXIT=0（Test Files 27 passed (27) / Tests 345 passed (345)）
python scripts/audit-repo.py → EXIT=0（PASS=7 FAIL=0 WARN=0）
python ../../shared/scripts/audit_framework.py → EXIT=0（PASS=13 FAIL=0 WARN=0 SKIP=0）
```

---

## Known Issues

- **KI-B（跨仓 AC-5，已实测确认）** `projects/README.md` 在 Workspace 侧，**Workspace 不是 Git 仓库**
  ⇒ 该改动**未纳入版本控制**，不在本 PR 与分支保护范围内。
  已按既定合规路径处置（修改 + handoff 留痕），**未自行 `git init`**；由人类决定是否 `git init`。
- **KI-C（口径提示，非缺陷）** 本任务冒烟基线（153/4）与 TASK-041 档案的「7 项失败」
  **不是同一环境口径**：本任务环境中 `smoke.ts` 内嵌启动了 Telegram / 飞书 mock，
  故通知类断言全通。TASK-041 的 X3 结论在其自身环境下仍成立，**本任务未改动该结论**。
- **KI-D（环境残留，非仓库文件）** 隔离快照在仓库外 `E:/NDLDSN-WORKSPACE/.tmp-t043/`，
  不影响 `git status`；:3002 服务进程已在取证后关闭。

---

## Remaining Work

1. **主控位审查本 PR**（读实际 diff，不读描述），重点三项：
   - `git diff server/scripts/smoke.ts` 全文 —— 核对 AC-7 三点（`check(` 只增不减 / 判定无放宽 / 外键非空）；
   - 两份 `Merge Record` 的九要素与 SHA 映射 —— 可按 TASK-043 `Verification Plan` 的命令复跑；
   - **KI-B 的跨仓结论**与 **TASK-042 D8 单元格的表述修正**（见上「★」节）是否符合主控位判断。
2. 审查 PASS → **人类显式授权** → 主控位执行 `rebase-merge`。
3. 合并后：本任务自身按 D13-C 选项 C 保持 `Status = REVIEW`、留在 `tasks/review/`，
   其 `Merge Record` 由**下一个任务（第十实例）**回填。

---

## Assumptions

1. HANDOFF-001 的假设 1（`main` = `f2a63bc`）**成立** —— AC-1 实测一致，无需 fetch 修正。
2. 假设 2（X4 缺陷仍存在）**成立** —— 修复前基线复现 4 项 `FOREIGN KEY` 失败。
3. 假设 3（`smoke.ts` 段落结构未被重构）**成立** —— 符号名 `const pool` / `删除供应商` /
   `// 17.9.1` 均按档案描述定位成功。
4. 假设 4（本地可跑冒烟）**成立** —— better-sqlite3 原生模块可用，Node v22.20.0 / pnpm 10.29.3。

---

## Risks

| 风险 | 实际状态 |
|------|---------|
| 为让冒烟变绿删/放宽 17.9 断言 | **未发生** —— `check(` 4→6，既有 4 项逐字未改（AC-7 实证） |
| 把 `poolId`/`planId` 置空绕过外键 | **未发生** —— 指向真实创建的 `richPool`/`richPlan` |
| 照抄 TASK-041 历史行号 | **未发生** —— 全部以符号名定位 |
| 回写填未经实查的值 | **未发生** —— 九要素逐项 `gh`/`git` 实查，SHA 映射 12 对全部逐对验证 |
| 借归档夹带产品代码 | **未发生** —— `git diff HEAD --stat` 仅 `smoke.ts` + `tasks/**` |
| 冒烟环境问题误报为修复失败 | **未发生** —— 修复前/后同一隔离环境；mock 由脚本内嵌启动，失败项归因明确 |
| Workspace 改动无处提交 | **已发生且已如实上报** —— KI-B；未自行 `git init` |
| 纯文案提交触发多轮 CI | **未发生** —— 回写与 X4 修复**合批为一次提交** |

---

## Next Action

**主控位：**

1. 读本 handoff + `TASK.md` 的 `Current State`（含 11 条 AC 的逐条证据）。
2. 按 `TASK.md` `Verification Plan` **复跑**关键命令（不接受「已通过」式陈述）：
   - `git diff server/scripts/smoke.ts`（AC-7）
   - `git cat-file -t` / `git show -s --format=%t` / `git merge-base --is-ancestor`（AC-2/AC-4 的 12 对映射）
   - `gh pr view 13/14/15 --json state,mergedAt,mergeCommit`（AC-1/AC-2/AC-4）
3. 出具 PASS / FAIL。**FAIL 则由执行位整改后再审一轮。**
4. PASS → 交**人类显式授权** → 主控位执行 `rebase-merge`（禁止直推 `main`）。

---

## References

- 任务档案：`tasks/review/TASK-043-archive-writeback-and-smoke-x4/TASK.md`（唯一事实来源）
- 派遣指令：`handoffs/HANDOFF-001-coordinator-to-implementer.md`
- 已归档档案：`tasks/done/TASK-041-customer-expire-required/TASK.md`、
  `tasks/done/TASK-042-ci-server-typecheck-and-release-gate/TASK.md`
- 待修脚本：`server/scripts/smoke.ts`（第 17.9.1 段）
- Workspace 侧文档：`E:/NDLDSN-WORKSPACE/projects/README.md`（**未纳入版本控制**，KI-B）
- 规范：`AGENTS.md` §13（DoD）、§14（GitHub 协作）、§14.2（rebase-merge）
