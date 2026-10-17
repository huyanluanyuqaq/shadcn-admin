# TASK-044 — D13-C 第十/十一实例归档回写 + 修正 `projects/README.md` 快照失真 + 清理误入库的派单启动语

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-044
Title: 归档回写 TASK-043/045 + 修 README 快照失真 + 清理派单启动语
Workflow: chore
Status: REVIEW
Priority: P1
Owner: 主控位（设计已完成）→ 执行位（实施已完成，待审查）
Owner Since: 2026-10-17
Assigned Role: coordinator（设计，已完成）→ developer（实施，已完成）；审查由主控位承担
Created: 2026-10-17
Updated: 2026-10-17
Branch: chore/TASK-044-archive-writeback-and-cleanup
Requires Human Approval: true   # 含两笔跨任务档案的状态变更（Task-043/045 的 Status 与目录）
```

> **编号说明：** 001–045 已占用。043 与 045 均已合并 `main` 但仍留 `tasks/review/`，本任务取 **044**。

> **本任务的「鸡生蛋」性质：** 本任务自身合并后，其合并事实同样留给**下一个任务**回填
> （D13-C 选项 C 的固有代价）。**不得在本任务内自我回写。**

---

## Objective

一次性清零主控位 2026-10-17 全局审查遗留的四项债，使**任务目录、框架文档、仓库内容三者重新自洽**：

1. **D13-C 第十实例** —— 回填 TASK-043 的 `Merge Record`，`Status → DONE`，迁 `tasks/done/`；
2. **D13-C 第十一实例** —— 为 TASK-045 **新建** `Merge Record`（当前档案**完全没有该节**），
   回填并归档；
3. **修正 `projects/README.md` 快照失真**（Workspace 侧，跨仓）；
4. **清理误入库的 `STARTUP-PROMPT.md`**（TASK-045 审查遗留项）。

---

## Background

主控位 2026-10-17 20:1x 实测（**非档案自述**）确认的四项遗留：

| # | 发现 | 证据 |
|---|------|------|
| B1 | **TASK-043 的 `Merge Record` 九要素仍全为「待第十实例回填」**，而 PR #16 已于 `2026-10-17T09:13:03Z` 合并（`3eebdae`） | 档案表格逐行读取 + `gh pr view 16` |
| B2 | **TASK-045 档案中根本没有 `Merge Record` 节**（章节结构实测：Meta→…→Notes，无 Merge Record）<br>且其正文亦**未标注**自己需被回写（仅在第26 行提及 043 是第十实例）⇒ **执行位疏漏** | `grep -n "^## "` 实测 + 逐行阅读 |
| B3 | **`projects/README.md` 第 117-118 行失真**：称「`tasks/backlog/`、`tasks/review/` 均为空；`tasks/active/` 有 TASK-043（进行中）」，实测 `backlog` 0 / `active` 0 / **`review` 2** / `done` 41 | `ls tasks/*/`计数 + 逐行读 README |
| B4 | **`STARTUP-PROMPT.md` 被误入库**：它是派单过程的启动语（发给执行位的临时产物），非项目长期资产 | 主控位审查 PR #18 时发现 |

---

## 关键差异：两笔回写的形态**不同**（务必区分）

> ★ 这是本任务最容易出错之处。**TASK-043 与 TASK-045 的回写不是同一件事。**

| 维度 | TASK-043（第十实例） | TASK-045（第十一实例） |
|------|---------------------|---------------------|
| `Merge Record` 是否存在 | ✅ **存在**，九要素待回填 | ❌ **不存在**，须**新建整节** |
| 需要做什么 | 填九行表格 | 从零写整节（含表格骨架） |
| 额外动作 | 无 | 须**补标注**「本任务自身为第十二实例待回写方」 |
| 独立审查记录 | 无（主控位审查，框架基线级） | 无（主控位审查，框架基线级） |

**TASK-045 的特殊性**：它是**跨仓改动**（模板仓库 + 项目仓库），
`Merge Record` 须同时记录两处的提交。

---

## Scope

- TASK-043：`Merge Record` 九要素实查回填；`Status → DONE`；`git mv` 至 `tasks/done/`；
  修正滞后指针（`Next Action` 等）。
- TASK-045：**新建** `Merge Record` 节并回填（含跨仓说明）；`Status → DONE`；
  `git mv` 至 `tasks/done/`；补「第十二实例待回写」标注。
- `projects/README.md` 第 117-118 行快照修正（Workspace 侧）。
- 删除 `tasks/done/TASK-045-review-record-naming/STARTUP-PROMPT.md`（及 `tasks/review/` 下的同名文件，
  若尚未归档则一并处理）。
- 本任务自身的 `TASK.md` / `handoffs/` 记录。

## Non-Scope

- **不改任何生产代码**：`src/**`、`server/**`、`shared/**` 一律不动。
- **不改** `.github/**`、`Dockerfile`、`docker-compose.yml`、`package.json`、`CHANGELOG.md`。
- **不改 `handoff.md` 本身** —— TASK-045 刚落地§3.2，本任务只读不动。
- **不重命名任何存量档案**（TASK-045 已实证：11/11 全部已合规）。
- **不 bump 镜像 tag、不触发 `workflow_dispatch`、不打新 tag** ⇒ 本任务无对外发布动作。
- **不删除远端分支**。
- **不碰 `business-manager`**。
- **不做 TASK-044 自身的回写**（第十二实例留给下一个任务）。

---

## Requirements

1. **R1（实查回写）** 九要素**全部由执行位以 `gh` / `git` 实查后落笔**，
   **严禁照抄本档案 Background 节或任何既有文档中的值**。
2. **R2（SHA 映射逐对验证）** 每对必须验证：两侧 `git cat-file -t` 均为 `commit`、
   `%t` tree 相同、post 侧 `git merge-base --is-ancestor <post> origin/main` 通过。
   任一对不成立即停止上报，**不得**填写「基本一致」式结论。
3. **R3（合并判定以 `gh pr view` 为准）** 取 `state` / `mergedAt` / `mergeCommit`。
   **不得**以 `gh pr merge --rebase` 的提示语或 `mergeable=UNKNOWN` 作为未合并证据
   （后者是 rebase 后 GitHub 重算的**暂态**）。
4. **R4（Status 与目录同步）** 变更 `Status` 时**必须同步 `git mv`**。
5. **R5（滞后指针清理）** 回写时**必须**一并修正被回写档案中指向
   「待补记 / 待合并 / 待审查」的表述 —— 那些动作已发生，文字不会自动失效。
6. **R6（TASK-045 须新建整节）** TASK-045 档案**当前无 `Merge Record` 节**，
   须**新建**（不是「回填空表」）；骨架照TASK-042 已归档档案的体例。
7. **R7（跨仓记录）** TASK-045 的 `Merge Record` 须同时记录：
   项目仓库 PR #18 的合并事实 **与** 模板仓库的提交（`aa38119`，**无远端、仅本地**）。
8. **R8（README 只改失实处）** `projects/README.md` 的改动**仅限**纠正失真描述，
   **不得**扩写项目介绍、重排章节或改动其它项目条目。
9. **R9（负向断言自检）** 凡写「已为空 / 全部完成 / 均未配置」的否定性断言，
   **必须实查**（`AGENTS.md` §13 第 5 条）。
10. **R10（启动语清理）** 删除 `STARTUP-PROMPT.md` 时**必须**确认其内容
    已无他人依赖（`grep` 确认无引用）；若有引用则**先报告再处置**，不得强删。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 流程 | 回写提交 footer 用 `Refs: TASK-043` / `Refs: TASK-044` / `Refs: TASK-045`（**按被回写对象分别标注**） |
| 流程 | 合并用 `rebase-merge`（`AGENTS.md` §14.2），**禁止直推 `main`** |
| 流程 | 只用**显式路径** `git add`（禁 `git add -A` / `git add .`） |
| 范围 | 超出 File Scope 的改动必须先更新本字段并说明理由 |
| 跨仓 | `projects/README.md` 在 Workspace 侧；Workspace **不是 Git 仓库**，**不得自行 `git init`** |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-043 已合并 | blocks（回写其 Merge Record） | ✅ PR #16 / `3eebdae` / `2026-10-17T09:13:03Z` |
| TASK-045 已合并 | blocks（回写其 Merge Record） | ✅ PR #18 / `a0e7d3f` / `2026-10-17T12:24:35Z` |
| 基线 `a0e7d3f` | blocks | ✅ `main` = `origin/main` = `a0e7d3f`，工作区干净 |
| 分支保护 | external | ✅ 必需检查 `install-lint-build` + `audit` 生效中 |

> 无未满足的 `blocks` 依赖 → 本任务可进入 `ACTIVE`。

---

## Acceptance Criteria

> 每条必须能用「是 / 否」回答，且**必须附原始输出**。

- [x] **AC-1（前置基线）** 实测留档：`git rev-parse main origin/main` 均为
      `a0e7d3fd70d139ac378b98641b3bb86a8e72f319`；`git status --short` 仅
      `?? tasks/active/TASK-044-archive-writeback-and-cleanup/`；
      `gh pr view 16 --json state` → `MERGED`、`gh pr view 18 --json state` → `MERGED`。
      结构侦查：TASK-043 有 `## Merge Record`（435 行）、TASK-045 **无**该节 ⇒ 走「填表 / 新建」双形态。
- [x] **AC-2（TASK-043 回写）** 九要素全部实查回填，**无「待回填」残留**
      （`grep` 该节内 `待第十实例|待回填` 命中 0）；SHA 映射 **2 对**，逐对验证通过：
      `c60b057→1b1f692`（树 `cb4bb33` 两侧同）、`abd7dee→3eebdae`（树 `0f73362` 两侧同），
      两侧 `git cat-file -t` 均 `commit`，post 侧 `git merge-base --is-ancestor … origin/main` 均通过。
      **2/2 通过。**
- [x] **AC-3（TASK-043 归档）** `Status: REVIEW → DONE`（第 13 行 `Status: DONE`）；
      路径已迁至 `tasks/done/TASK-043-archive-writeback-and-smoke-x4/`（`git mv`，`git status` 见 3 条 `R`）；
      `Next Action` 已改为「无待办」，不再指向「审查 PR / 合并」等已完成动作。
- [x] **AC-4（TASK-045 新建 + 回写）** `Merge Record` 节**由无到有**建成（现位于 186 行），
      九要素实查回填；**含跨仓两节**：项目仓库 PR #18 主表 + 框架模板仓库 `aa38119` 专节
      （如实标注「无远端、仅本地、未推送」）；SHA 映射 **2 对**通过。
      ⚠️ **验证口径与 TASK-043 不同，已分别如实说明**：本任务两对**不能**用 tree 验证
      （PR #17 于 PR #18 合并前 103 秒推进 `main`，rebase 基点不同），
      改用 **patch-id 一致** + `git diff <pre> <post> --stat` 证明 tree 差异可解释
      （差异恰为 PR #17 的 `.github/workflows/ci.yml` 1 个文件；TASK-045 自身改动两侧
      均为 5 files / 1077 insertions）。详见 HANDOFF-003 裁决一。
- [x] **AC-5（TASK-045 归档 + 补标注）** `Status → DONE`；已迁 `tasks/done/TASK-045-review-record-naming/`；
      档案中**已补上**「本任务自身为 D13-C 第十二实例的待回写方」标注（第 28-30 行顶部括注，
      另在 Current State / Handoff / Notes 三处呼应）—— B2 指出的疏漏已补齐。
- [x] **AC-6（README 修正）** 第 107 行与第 117-120 行失真断言已按**归档后终态**纠正：
      `backlog` 0 / `active` 0 / `review` **1**（TASK-044 自身）/ `done` **43**。
      ⚠️ 已避开时点陷阱：README 写的是**终态**（`review` 1 = 本任务归档后的位置），
      **不是**执行中间态（开工时为 `review` 2、`done` 41）。Workspace 侧无 Git ⇒ 未纳入版本控制，见 KI-1。
- [x] **AC-7（启动语清理）** `tasks/review/TASK-045-review-record-naming/STARTUP-PROMPT.md`
      **已删除**（`git rm`，`git status` 见 `D`）。R10 引用核验：`git grep -n "STARTUP-PROMPT"`
      在**已跟踪文件**中**零引用**；工作区内另有 10 处提及，全部位于本任务**未跟踪的**指令与档案中
      （`TASK.md` B4/R10/AC-7 + `HANDOFF-001`/`003`），属「描述要删什么」而非「依赖其内容」，
      **不构成断链** ⇒ 判定可删，并在此如实登记该区分。
      另：`tasks/active/TASK-044-…/STARTUP-PROMPT.md`（本任务派遣语，未跟踪）**已由主控位删除**
      （HANDOFF-003 裁决二），非本执行位动作。
- [x] **AC-8（范围自证）** `git status --short` 与暂存区**仅含 `tasks/**`**
      （3 条 `R` 迁出 TASK-043、2 条 `R` + 1 条 `D` 迁出/删 TASK-045）；
      **未触及** `src/` `server/` `shared/` `.github/` `docs/` `.agents/` `templates/` 任何路径。
      产品代码零改动（本任务纯文档）。
- [x] **AC-9（本地验证）** `python scripts/audit-repo.py` → **PASS=7 FAIL=0 WARN=0**（exit 0）；
      `python ../../shared/scripts/audit_framework.py` → **PASS=13 FAIL=0 WARN=0 SKIP=0**（exit 0，未新增 FAIL）。
      ⚠️ 本机 `python3` 为 Microsoft Store 占位存根（不可用），故以 `python` 实跑 —— 与 TASK-045 KI-1 同因。
      纯文档任务，**未跑** `pnpm test` / 冒烟（零行为变更）。
- [x] **AC-10（交付请求）** PR **#19** 已开立（`https://github.com/huyanluanyuqaq/shadcn-admin/pull/19`），
      描述已按 `.github/PULL_REQUEST_TEMPLATE.md` 填全（含「改动了 `projects/README.md`」的显式说明）。
      两必需检查实测：`install-lint-build` = **SUCCESS**、`audit` = **SUCCESS**（双绿）；
      `mergeable: MERGEABLE` / `mergeStateStatus: BLOCKED`（BLOCKED 为等待审查/授权的正常态，
      非检查失败）。
      **未自行合并**（`Requires Human Approval: true`），交主控位审查与人类授权。
- [x] **AC-11（本任务档案）** `Changed Files` / `Known Issues` / `Current State` 已如实填写；
      `Status → REVIEW` 且目录 `git mv` 至 `tasks/review/`；
      **`Merge Record` 按 D13-C 留待第十二实例回填**（已在下方 `Merge Record` 占位节显式标注）。

---

## Merge Record

> **按 D13-C 选项 C：本表由下一个任务（第十二实例）回填。**
> **不得在本任务内自我回写**（那将造成档案与提交历史不一致）。
>
> **本任务自身即为第十二实例的待回写方** —— 这是 D13-C 选项 C 的固有代价，
> 与 TASK-043 / TASK-045 同机制，**不是遗漏**。TASK-043 的该注已由本任务（第十实例）回填，
> TASK-045 的该注已由本任务（第十一实例）补建；本任务的该注由第十二实例回填。

| 要素 | 值 |
|------|-----|
| PR | **待第十二实例回填** |
| 合并策略 | rebase-merge（预期，`AGENTS.md` §14.2） |
| 提交数 | 待第十二实例回填 |
| merged_at | 待第十二实例回填 |
| merge_commit_sha | 待第十二实例回填 |
| 合并后 CI | 待第十二实例回填 |
| D8 解耦 | 待第十二实例回填 |
| 独立审查 | 待第十二实例回填 |
| SHA 映射 | 待第十二实例回填 |

---

## File Scope

```yaml
File Scope:
  - tasks/review/TASK-043-archive-writeback-and-smoke-x4/**    # 回写 + 迁出
  - tasks/review/TASK-045-review-record-naming/**              # 新建 MR + 回写 + 迁出 + 删启动语
  - tasks/done/TASK-043-archive-writeback-and-smoke-x4/**      # git mv 目标
  - tasks/done/TASK-045-review-record-naming/**                # git mv 目标
  - tasks/active/TASK-044-archive-writeback-and-cleanup/**
Non-Scope (files):
  - src/**
  - server/**
  - shared/**
  - .github/**                # 不改工作流
  - .agents/**                # 框架快照只读（TASK-045 刚落地 §3.2，本任务不动）
  - templates/**
  - docs/**
  - Dockerfile
  - docker-compose.yml
  - package.json
  - CHANGELOG.md
  - projects/_workspace-template/**
```

> **⚠️ `projects/README.md` 在 Workspace 侧，不在本仓库内** ⇒ **不由本任务 PR 承载**。
> 处置方式见下节。

---

## 跨仓修改的处置方式（`projects/README.md`）

与 TASK-043 同构（Workspace **不是 Git 仓库**，`projects/README.md:144` 明确记载）：

1. 本任务分支内**只**完成 shadcn-admin 侧改动（AC-1 ~ AC-5、AC-7 ~ AC-11）。
2. `projects/README.md` 的修正（AC-6）在 **Workspace 侧**进行。
3. Workspace **无 Git** ⇒ 若 `git` 不可用，**如实上报主控位**，**不得自行 `git init`**
   （`AGENTS.md` §11 记载该操作会把项目变成 gitlink）。
4. 若无法提交，AC-6 的完成形态为「**已修改 + 已在 handoff 留痕**」，
   并在 `Known Issues` 登记「Workspace 侧改动未纳入版本控制」。

---

## Implementation Plan

### Phase 1 — 前置基线与 TASK-043 回写

1. `git fetch origin && git switch main && git pull --ff-only` → 确认 HEAD = `a0e7d3f`。
2. `git switch -c chore/TASK-044-archive-writeback-and-cleanup`
3. 实查 PR #16 的九要素（注意：**`3eebdae` 之后的 main 已推进到 `a0e7d3f`**，
   SHA 映射须用 `%t` tree 匹配，**不要**假设 post 侧是当前 main）。
4. 回填 TASK-043 `Merge Record`；修正其滞后指针；`Status → DONE`；`git mv` 至 `done/`。

### Phase 2 — TASK-045 回写（形态不同，注意 R6）

5. 实查 PR #18 九要素 **+ 模板仓库提交 `aa38119`**（`cd ../_workspace-template && git log`）。
6. **新建** `Merge Record` 节（骨架照 `tasks/done/TASK-042-…/TASK.md` 的体例），
   回填九要素，并含跨仓说明。
7. 补「本任务自身为第十二实例待回写方」标注（AC-5）。
8. 删除 `STARTUP-PROMPT.md`（先 `grep` 确认无引用 —— R10）。
9. `Status → DONE`；`git mv` 至 `done/`。

### Phase 3 — Workspace 侧与交付

10. 按「跨仓修改的处置方式」修正 `projects/README.md`（按**归档后终态**写）。
11. 跑 AC-9 的验证。
12. 提交（footer 按被回写对象分别标注），推送，开 PR。
13. 本任务档案收尾（`Status → REVIEW` + 迁 `review/`），**再开/更新 PR**。
14. **停下**，交主控位审查与人类授权。执行位不得合并、不得直推 `main`。

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 | 本地 + 平台 | `git rev-parse main origin/main`；`git status --short`；`gh pr view 16/18 --json state` |
| AC-2/4 | 平台 + Git | `gh pr view <n> --json state,mergedAt,mergeCommit,commits`；SHA 映射逐对：`git cat-file -t` + `git show -s --format=%t` + `git merge-base --is-ancestor <post> origin/main` |
| AC-3/5 | 文件 + Git | `git status --short`（应见 `R` 重命名）；`grep "^Status:"`；`grep -n "^## "` 确认 MR 节存在 |
| AC-6 | 文件审阅 | `git diff` 全文（Workspace 侧）+ `ls -1 tasks/*/ \| wc -l` 复算 |
| AC-7 | 文件 + Git | `grep -rn "STARTUP-PROMPT" .`；`git diff --name-status` 见 `D` |
| AC-8 | Git | `git diff --name-only main..HEAD`（应仅 `tasks/**`） |
| AC-9 | 本地命令 | `python3 scripts/audit-repo.py`；`python ../../shared/scripts/audit_framework.py` |
| AC-10 | 平台查询 | `gh pr view <n> --json statusCheckRollup,mergeable,mergeStateStatus` |
| AC-11 | 文件审阅 | 主控位读 `TASK.md` 实际内容 |

---

## Current State

**REVIEW（review/）—— 实施已完成，PR 已开立，等主控位审查与人类授权。**

- 执行位已完成 AC-1 ~ AC-11，实测证据逐条附于上方「Acceptance Criteria」。
- **TASK-043**：九要素 + 2 对 SHA 映射实查回填，`Status → DONE`，已迁 `tasks/done/`。
- **TASK-045**：`Merge Record` 节由无到有新建（含跨仓两节），九要素回填，2 对 SHA 映射通过，
  「第十二实例待回写方」标注已补，`Status → DONE`，已迁 `tasks/done/`。
- `STARTUP-PROMPT.md` 已删（TASK-045 归档内那一份，`git rm`）；TASK-044 自己那一份由主控位删除。
- `projects/README.md` 已按**归档后终态**修正（Workspace 侧，无 Git，见 KI-1）。
- 两个审计脚本通过；产品代码零改动。
- **待主控位**：读实际 diff 审查 → PASS 后由**人类显式授权**、主控位执行 `rebase-merge`。
  **执行位不得自行合并、不得自行判定 PASS。**

---

## Changed Files

> 由 Developer 在执行中维护。以下为本次实施的实际改动。

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `tasks/review/TASK-043-…/TASK.md` → `tasks/done/TASK-043-…/TASK.md` | 回写 + 迁出 | `Merge Record` 九要素 + **2 对 SHA 映射**实查回填（PR #16）；修正 Meta `Status`/`Owner`、顶部「鸡生蛋」括注、Current State、AC-11、KI-A、Next Action 六处滞后指针；Background B3 由「未回写」改为「已由本任务回写（历史发现保留）」 |
| `tasks/review/TASK-045-…/TASK.md` → `tasks/done/TASK-045-…/TASK.md` | 新建节 + 回写 + 迁出 | **从零新建** `Merge Record` 节（186 行起）：项目仓库 PR #18 九要素主表 + 2 对 patch-id 映射 + 树哈希差异解释 + 模板仓库 `aa38119` 跨仓专节；补「第十二实例待回写方」标注；修正 Current State / Handoff Next Action / Notes 滞后指针 |
| `tasks/review/TASK-045-…/STARTUP-PROMPT.md` | **删除** | 派单启动语误入库清理（AC-7）；`git status` 见 `D` |
| `tasks/active/TASK-044-archive-writeback-and-cleanup/TASK.md` | 修改 | 本档案：11 条 AC 回填证据、Current State、Changed Files、Known Issues、Handoff |
| `tasks/active/TASK-044-archive-writeback-and-cleanup/handoffs/HANDOFF-003-coordinator-to-implementer.md` | 新增 | 主控位对执行位两点提请的裁决回复（patch-id 口径 + STARTUP-PROMPT 处置） |
| `tasks/active/TASK-044-archive-writeback-and-cleanup/handoffs/HANDOFF-002-implementer-to-coordinator.md` | 新增 | 本任务的实施交接报告 |
| `E:/NDLDSN-WORKSPACE/projects/README.md` | 修改 | **Workspace 侧，不在本仓库/本 PR 内**：第 107 行计数 + 第 117-120 行「当前任务」按归档后终态纠正 |

> **范围自证（AC-8）：** 本 PR 的 `git status` / 暂存区**仅含 `tasks/**`**，
> **未触及** `src/**` / `server/**` / `shared/**` / `.github/**` / `docs/**` / `.agents/**` / `templates/**`。
> `projects/README.md` 在 Workspace 侧且 Workspace 非 Git 仓库，**不由本 PR 承载**（见 KI-1）。

---

## Known Issues

- **KI-1（跨仓 AC-6，未纳入版本控制）** `projects/README.md` 位于 Workspace 侧，
  **不在本任务 PR 范围内**。实测 `E:/NDLDSN-WORKSPACE` **不是 Git 仓库**
  （`git rev-parse --is-inside-work-tree` → `fatal: not a git repository`，
  且根目录 `.git` 不存在）⇒ 该改动**无法纳入版本控制**。已按「跨仓修改的处置方式」第 4 条处置：
  **已修改 + 已在 handoff 留痕**；**未**自行 `git init`（`AGENTS.md` §11：会把项目变成 gitlink）。
  由人类决定是否 `git init`。
- **KI-2（README 逐条清单止于 TASK-042）** 第 121-155 行的逐条任务清单仍止于 TASK-042，
  未补 TASK-043 / TASK-045。**未补是有意为之**：R8 规定 README 改动「仅限纠正失真描述，
  不得扩写项目介绍」，而补清单属扩写。已登记待后续任务或人类裁决处理；
  两处计数（第 107 行「43 个」、第 117-120 行「43 个 / 编号 001–045」）已与实况一致，
  故该清单缺口不影响计数自洽性。
- **KI-3（本机 `python3` 不可用）** `python3` 是 Microsoft Store 占位存根，
  真实解释器为 `/c/Python313/python`。故 AC-9 的两个审计脚本实际以 `python` 跑通。
  **这是环境问题，非本次变更引入**；与 TASK-045 KI-1 同因，建议另立任务修正文档或 PATH。
- **KI-4（TASK-045 的 SHA 映射口径与指令给定算法不同）** 指令给的「按 `%t` tree 反查 post」法
  在 PR #18 上**静默失效**（PR #17 于合并前 103 秒推进 `main`，awk 匹配为空，
  而 `git show -s --format=%h` 省略参数会默认取 HEAD，两对均被误打印为 `-> a0e7d3f`）。
  已提请主控位裁决并采纳 **patch-id + `git diff --stat`** 口径（HANDOFF-003 裁决一）。
  TASK-043 的两对仍可用 tree 验证（其合并时 `main` 未被推进），**两笔口径不同已在档案中分别说明**。
- **KI-5（D13-C 固有）** 本任务自身合并后，其 `Merge Record` 按 D13-C 选项 C
  留待**第十二实例**回写。这是既定机制，不是遗漏，**不得**在本任务内自我回写。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | 主控位 coordinator | 执行位 implementer | 2026-10-17 | 任务登记 + 设计（四项范围 / 两笔回写形态差异 / File Scope / 11 条 AC） |
| 002 | 执行位 implementer | 主控位 coordinator | 2026-10-17 | **提请裁决两点**：① PR #18 的 tree 匹配法静默失效（`-> a0e7d3f` 为错值）；② TASK-044 自己那份未跟踪的 `STARTUP-PROMPT.md` 如何处置 |
| 003 | 主控位 coordinator | 执行位 implementer | 2026-10-17 | 裁决回复：① 采纳 patch-id + `git diff --stat` 口径（须补 tree 差异来源实测）；② TASK-044 的启动语单独删掉不入库（主控位已执行） |

**最新 Handoff：** `handoffs/HANDOFF-002-implementer-to-coordinator.md`
**Next Action：** 主控位读**实际 diff**（不读描述）审查 → PASS 后由**人类显式授权**、
主控位执行 `rebase-merge`。**执行位不得自行合并、不得自行判定 PASS。**

---

## Task Rules

- [补充] **实查优先于档案自述**：B1–B4 均为主控位 20:1x 的实测快照，
  **计数与行号可能漂移**，一律以符号名 / 现查结果为准。
- [增强] **实现者 ≠ 批准者**：执行位**不得**自行合并 PR、**不得**自行判定 PASS。
  合并须经**人类显式授权** + **主控位**执行 rebase-merge。
- [补充] **回写范围仅限 `tasks/**`**：不得借归档回写夹带产品代码或配置改动。
- [补充] **跨仓纪律**：不得自行对 Workspace 执行 `git init`。
- [补充] **AC-6 的时点陷阱**：README 快照须按**本任务归档后**的终态撰写，
  而非执行过程中的中间态（否则写完即失真）。

---

## Notes

**给执行位的实操提醒：**

1. **SHA 映射不要用「post 侧 = 当前 main」的假设** —— `a0e7d3f` 之后 main 还会继续推进，
   必须用 `%t` tree 匹配 + `merge-base --is-ancestor` 验证。
2. **`mergeable=UNKNOWN` 是 rebase 后 GitHub 重算的暂态**，不是未合并。
   一律以 `gh pr view --json state,mergedAt,mergeCommit` 为准。
3. **TASK-045 是跨仓改动**：其 `Merge Record` 须同时写项目 PR #18 与模板仓库 `aa38119`。
   ⚠️ 模板仓库**无远端**，`aa38119` 是**仅本地**提交 —— 须如实标注，不得写成「已推送」。
4. **不要跑 `pnpm test` / 冒烟**：本任务零行为变更，`tasks/**` 改动不影响任何测试结果；
   跑了反而是噪声。AC-9 只要求两个审计脚本。
5. **纯文案提交会触发新一轮 CI** ⇒ 回写与清理**合批提交**，不要拆成多个纯文档提交。