# TASK-059 — 框架模板修复漂移 + SHA 映射表制度化

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-059
Title: 框架模板修复漂移 + SHA 映射表制度化
Workflow: maintenance
Status: REVIEW
Priority: P1
Owner: main
Owner Since: 2026-11-02
Assigned Role: developer
Created: 2026-11-02T22:05:00+08:00
Updated: 2026-11-03T22:46:37+08:00
Branch: feat/TASK-059-snapshot-sync
Requires Human Approval: false
```

## Objective

修复 `templates/` 快照与模板仓库之间**已存在的单文件漂移**（`AGENTS.md` §10 的「逐字快照」声称当前为假），
并把「rebase-merge 改写 SHA 必须附映射表」写成模板中的**强制要求**，使该实践从执行位自觉变为门禁可检。

## Background

### 发现：快照声称与事实不符（本任务的直接触发点）

`AGENTS.md` §10 声称 `.agents/` 与 `templates/` 是模板仓库 `projects/_workspace-template/` 的**逐字快照**、
项目内只读、框架演进在模板仓库进行。2026-11-02 主控位实测：

```
diff -rq  <template>/.agents   <shadcn-admin>/.agents     → 无差异      ✅
diff -rq  <template>/templates <shadcn-admin>/templates  → 1 个文件不同  ❌
```

唯一差异文件是 `templates/task/TASK.md`：shadcn-admin 版多出 **33 行的 `## Merge Record` 章节**
（234 行 vs 模板仓 201 行）。

**根因（git 历史定位）**：提交 `c47509a`「feat(TASK-047/WP-2): 模板补 Merge Record 章节 +
audit-repo.py 增 F8/F9 门禁」（2026-10-21）**直接改了仓内快照**，未在模板仓库演进后同步。
这违反 `AGENTS.md` §10 的「框架快照只读」项目规则。

**后果**：
1. §10 的「逐字快照」是一句**假断言**（与 TASK-056 C17 同类：文档说一致，事实不一致）；
2. `audit-repo.py` 的 F8 门禁校验的是 shadcn-admin 版模板，模板仓库的模板**不在检范围**，
   F8 对模板仓自己是空话；
3. 新项目从模板仓复制时会拿到**没有 Merge Record 章节**的任务模板，
   D13-C 回写机制在新项目中无声失效。

### 第二项：SHA 映射表无制度要求

场景 F（`docs/operations/collaboration-scenarios.md`）已指出：rebase-merge 改写全部 SHA，
但制度只要求「合并后回写 Merge Record」，**未要求**「SHA 失效时补映射表」。
TASK-055 与 TASK-056 都靠执行位自觉补了，且两次的判据方法**不同**：

| 任务 | rebase 基点变化 | 判据方法 |
|------|----------------|---------|
| TASK-055 | `2ca5d50` → `2ca5d50`（未变） | 新旧 **tree 相同**（9/9） |
| TASK-056 | `2ca5d50` → `d7cb861`（前移） | 新旧 **patch-id 相同**（10/10），因逐对 tree 已不同 |

模板必须写清两种方法**各自的适用条件**，否则后来者会照抄错的那一种。

## Scope

| 组 | 内容 | 仓库 |
|----|------|------|
| **U（上同步）** | 把 shadcn-admin 版 `templates/task/TASK.md` 的 `## Merge Record` 章节同步**上移到**模板仓库 | `_workspace-template` |
| **M（制度化）** | 在模板仓的 `templates/task/TASK.md` 增加「SHA 映射表」强制要求 + 两种判据方法的适用条件 | `_workspace-template` |
| **D（下同步）** | 把模板仓的 `templates/` 重新逐字同步回 shadcn-admin，使 `diff -rq` 归零 | `shadcn-admin` |
| **V（验证）** | 新增或扩展一条检查，使「快照与模板仓库逐字一致」成为**可执行判据**（而非口头声称） | `shadcn-admin` |

## Non-Scope

- **不改 `.agents/`**（实测已逐字一致，无需动）。
- **不重写 TASK-047 的历史提交**（`c47509a` 是既成事实，只在档案中登记根因）。
- **不给 `AGENTS.md` 瘦身**（审计 F-9，457 行属独立问题，另立任务）。
- **不动 D13-C 选项 C 的裁决本身**（回写并入下一个任务的交付请求）；本任务只补「SHA 映射表」这一环。
- **不改 `scripts/audit-repo.py` 的既有 F1–F9 判据**（只允许**新增**检查项，不允许放宽既有项）。

## Requirements

1. 上同步必须**逐字**搬运 shadcn-admin 版的 `## Merge Record` 章节（含 F8 位置说明与豁免登记段），
   不得顺手改写内容；改写须另立任务并在提交信息中说明。
2. 「SHA 映射表」要求必须写在模板的 `## Merge Record` 章节内，且至少包含：
   - **何时必须附**：合并策略为 rebase-merge 时必须；
   - **两种判据方法及各自的适用条件**：rebase 基点未变 → 新旧 tree 相同；
     基点前移（其间有其它合并）→ 新旧 patch-id 相同（`git show --format= <SHA> | git patch-id --stable`）；
   - **必须自行验证，不得照抄档案里的旧值**（TASK-055/056 的既有纪律）；
   - **反向验证**：旧 SHA 在 `main` 上必须不可达（`git merge-base --is-ancestor` 返回非 0）。
3. 下同步后 `diff -rq <template>/templates <shadcn-admin>/templates` 必须**零输出**；
   `diff -rq` 对 `.agents/` 亦须保持零输出。
4. V 组新增的检查必须能被**反向验证**：故意让两边不一致，检查必须变红并指名文件。
5. 若 V 组选择把检查加进 `scripts/audit-repo.py`，须新增检查编号（如 F10）并保持
   `PASS` 总数与 `FAIL=0`；**不得**通过改豁免清单让门禁变绿。
6. 模板仓库的改动须走其自己的提交规范；shadcn-admin 侧的快照同步须走交付请求。
   **两个仓库各一个 PR**，shadcn-admin 的 PR 描述中必须引用模板仓库的 PR 号。

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 检查脚本仅用 Python 标准库 + git；不联网、不读凭据 |
| 兼容 | 不改任何运行时行为；不改 `.github/workflows/**` 的触发条件 |
| 安全 | 不写凭据；不修改模板仓库的远端保护配置 |
| 流程 | 两个仓库各一分支一 PR；footer 各含 `Refs: TASK-059`；模板仓 PR 须先合 |

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| 模板仓库 `projects/_workspace-template` 可写 | external | 可用（本地 git 仓库） |
| TASK-055 / TASK-056 的 SHA 映射表先例 | blocks | 已完成（提供两种判据方法的实证） |
| shadcn-admin 的 `AGENTS.md` §10 | 规则依据 | 生效 |

## Acceptance Criteria

- [ ] AC-1: 模板仓库的 `templates/task/TASK.md` 含 `## Merge Record` 章节，
      且与 shadcn-admin 版**逐字一致**（`diff` 零输出）。
- [ ] AC-2: 模板的 `## Merge Record` 章节内含「SHA 映射表」强制要求，
      写明两种判据方法及各自适用条件、自行验证纪律、旧 SHA 不可达的反向验证。
- [ ] AC-3: `diff -rq` 对 `templates/` 与 `.agents/` **均零输出**（快照漂移归零）。
- [ ] AC-4: 新增的「快照一致性」检查正向通过、**反向变红**（故意制造单字符差异，
      检查必须失败并指名文件）；两次原始输出贴入档案。
- [ ] AC-5: `audit-repo.py` → `PASS=N FAIL=0 WARN=0`（N ≥ 10，含新增检查项）；`prettier --check .` 退出码 0。
- [ ] AC-6: `AGENTS.md` §10 的「逐字快照」声称**重新为真**，且 §10 附近新增一句指向
      「一致性由脚本 X 保证」的可执行判据（不再是口头声称）。
- [ ] AC-7: 两个 PR 的编号与合并关系在 shadcn-admin 的 `TASK.md` 中互相引用。

## File Scope

```yaml
File Scope:
  # 模板仓库（projects/_workspace-template）
  - templates/task/TASK.md
  - .agents/**                     # 仅当需同步规则条文时
  # shadcn-admin
  - templates/**                   # 仅下同步，逐字复制
  - scripts/audit-repo.py          # 仅允许新增检查项
  - AGENTS.md                      # 仅 §10 的判据指向
  - docs/operations/negative-assertion-review.md
  - tasks/backlog/TASK-059-*/**   → tasks/active/… → tasks/review/…
Non-Scope (files):
  - .github/**
  - src/**, server/**, shared/src/**
  - tasks/done/TASK-001~056 的任何内容（不得借机改写历史档案）
  - scripts/audit-repo.py 的既有 F1–F9 判据与 F8_MERGE_RECORD_POSITION_EXEMPT / HD-1 豁免清单
```

## Implementation Plan

1. 切两个仓库的分支（模板仓先合）。
2. **U 组**：把 shadcn-admin 版 `## Merge Record` 章节逐字搬入模板仓；提交、开 PR、合并。
3. **M 组**：在模板仓同一章节增补「SHA 映射表」要求（含两种判据方法）；
   提交（可并入 U 组的同一 PR，若 U 组尚未合并则须分提交）。
4. **D 组**：模板仓合并后，把 `templates/` 逐字同步回 shadcn-admin；`diff -rq` 归零。
5. **V 组**：在 `scripts/audit-repo.py` 新增「快照一致性」检查（或独立脚本 + CI 作业），
   正反两向验证。
6. 更正 `AGENTS.md` §10 与 `negative-assertion-review.md`（新增一条 C 类断言 + 判据命令）。
7. 全量门禁 → 提交 → 推分支 → 开 PR（引用模板仓 PR 号）→ 交主控位审查。

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 | diff | `diff <template>/templates/task/TASK.md <proj>/templates/task/TASK.md` |
| AC-2 | 文本 | `grep -n "SHA 映射表\|patch-id\|tree 相同" <template>/templates/task/TASK.md` |
| AC-3 | diff -rq | 对 `templates/` 与 `.agents/` 各跑一次，须零输出 |
| AC-4 | 反向验证 | 临时改一个字符 → 检查必须 FAIL 并指名文件；恢复 → PASS |
| AC-5 | 门禁 | `python scripts/audit-repo.py`；`prettier --check .` |
| AC-6 | 文本 | `grep -n "逐字快照" AGENTS.md` 并读该段判据指向 |
| AC-7 | 文本 | 两个 `TASK.md` 中的 PR 号互引 |

## Current State

**REVIEW（2026-11-03 已合并，归档回写待下一个任务补记）。**

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `templates/task/TASK.md`（模板仓 + 本项目） | 新增 `## Merge Record` 章节（逐字从本项目版上移） | U 组 + D 组；同步后 diff -rq 零输出 |
| `templates/task/TASK.md`（模板仓 + 本项目） | 新增 `### SHA 映射表` 子章节 | M 组：两种判据方法 + 验证纪律 |
| `scripts/audit-repo.py`（本项目） | 新增 F10 检查函数 + 加入 CHECKS 列表 | V 组：快照一致性可执行判据 |
| `AGENTS.md` §10（本项目） | 新增 F10 门禁指向，逐字快照声称重新为真 | AC-6 |
| `docs/operations/negative-assertion-review.md`（本项目） | 更新 C9 复核命令；新增 C18 | 漂移修复登记 |

## Known Issues

1. **快照漂移已存在 12 天**（自 `c47509a`，2026-10-21），期间 `audit-repo.py` 的 F8
   一直在校验「只有 shadcn-admin 才有的那份模板」，从未发现上游缺失。根因是
   **没有任何检查比对两个仓库的 `templates/`** —— 本任务的 V 组即为此而设。
2. **「框架快照只读」这条项目规则本身已被违反过一次且未被发现**。除修复漂移外，
   建议在 V 组的检查中同时覆盖 `.agents/`（当前虽一致，但同样无检查保护）。
3. **模板仓库不在本项目的 CI 覆盖范围内**，其正确性只能由本项目的检查单方面保证。
   这是结构性限制，登记备查。

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | main（执行位） | 主控位 | 2026-11-02 | U+M+D+V 四组全部完成；shadcn-admin PR #34（feat/TASK-059-snapshot-sync）已开；模板仓库本地 commit 8f56589（分支 feat/TASK-059-sha-mapping，无 remote） |

**最新 Handoff：** 见上表
**Next Action：** 主控位审查 shadcn-admin PR #34（全量门禁退出码 0，prettier 全绿），确认后合并；模板仓库 commit 8f56589 须同步推送到对应远端。

## Merge Record

> **归档回写待下一个任务补记**，在此之前保持 `Status = REVIEW`、留在 `tasks/review/`（机制，非遗漏）。

> **本节不随「Pass/收尾」填写。** 按 D13-C 选项 C（`.agents/rules/github.md` §2 / §6、
> `AGENTS.md` §14.2），本表由**下一个任务**在回收本任务归档时回填；
> 在此之前任务保持 `Status = REVIEW`、留在 `tasks/review/`（机制，非遗漏）。
> **禁止在本任务内自我回写**（那会造成档案与提交历史不一致）。
> 回填时九要素必须填实测值（可被 `gh api` / Tags API 复现），不得沿用档案自述；
> 无合并前独立审查档时，「审查记录」行须如实写「无（A3 断档）」，**不得补写、不得伪造**。

| 要素 | 值 |
|------|-----|
| PR | 待回填 |
| 合并策略 | rebase-merge（`AGENTS.md` §14.2 默认） |
| 提交数 | 待回填 |
| merged_at | 待回填 |
| merge_commit_sha | 待回填 |
| 合并后 CI run | 待回填 |
| 合并后 Docker run | 待回填 |
| 镜像 tag | 待回填 |
| 审查记录 | 待回填 |

## Task Rules

- [增强] **上同步必须逐字搬运，不得顺手改写**。要改内容就另立任务，并在提交信息中说明改了什么、为什么。
- [补充] 本任务横跨两个 git 仓库，**模板仓的 PR 必须先合并**，shadcn-admin 的快照同步才能做。
- [补充] 新增检查必须做反向验证（故意制造差异必须变红）——TASK-056 traceability 的同款纪律。

## Notes

- 漂移的实测证据（2026-11-02 主控位）：
  - `diff -rq <template>/.agents <proj>/.agents` → 无输出
  - `diff -rq <template>/templates <proj>/templates` → `Files …/templates/task/TASK.md … differ`
  - 行数 234（shadcn-admin）vs 201（模板仓）
  - 根因提交：`c47509a`「feat(TASK-047/WP-2): 模板补 Merge Record 章节 + audit-repo.py 增 F8/F9 门禁」
- 场景 F 的原始建议见 `docs/operations/collaboration-scenarios.md` 场景 F 的「缺口」段。
