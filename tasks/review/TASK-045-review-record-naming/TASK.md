# TASK-045 — handoff.md 补「审查记录命名」子节（填补框架规范空白）

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-045
Title: handoff.md 补「审查记录命名」子节（填补规范空白）+ 同步项目快照
Workflow: chore
Status: REVIEW
Priority: P1
Owner: 主控位（设计/实测/裁决，已完成）→ 执行位（实施已完成，待审查）
Owner Since: 2026-10-17
Assigned Role: coordinator（设计）→ developer（实施，已完成）；审查由主控位承担
Created: 2026-10-17
Updated: 2026-10-17
Branch: chore/TASK-045-review-record-naming
Requires Human Approval: true   # 裁决一（存量重命名）与裁决二（同时改框架协议）
                                 # 均由人类于 2026-10-17 19:5x 作出；本 PR 不得由执行位自行合并
```

> **编号说明：** 001–044 已占用（044 未占用则取 045）；043 已合并 `main` 但仍留
> `tasks/review/`（D13-C 第十实例待回写），本任务取 **045**。

> **本任务是跨仓改动（Cross-Repository Change）。** 唯一事实来源的修改发生在
> **框架模板仓库** `projects/_workspace-template`（**无远端**），本仓库只承接
> **机械同步**。两段式结构见下方 Implementation Plan。

---

## Objective

在框架协议 `.agents/protocols/handoff.md` 的 §3 下新增子节 **§3.2「审查记录」**，
填补「独立审查记录文件命名」这一**规范空白**；原有交接命名内容**完整移入 §3.1**，
随后机械同步到项目内的只读快照。

**判定标准：** §3.1 内容零丢失、§3.2 含三类命名与四条约束、两副本逐字一致、
存量档案零重命名、`audit-repo.py` 仍为 `PASS=7 FAIL=0 WARN=0`。

> ⚠️ **本任务不是"整顿违规"，而是"填补空白"。**
> `handoff.md` 此前**只规定了** `HANDOFF-<seq>-<from>-to-<to>.md`，
> **从未规定**审查记录的文件名 —— 现存命名不一致**不是谁没遵守规矩，
> 而是根本没有规矩**。

---

## Background

主控位 2026-10-17 对 `tasks/**/handoffs/` 做**全量实测**（54 个文件逐个定性）：

| 类别 | 命名形态 | 数量 | 性质 |
|------|----------|------|------|
| 交接记录 | `HANDOFF-NNN-<from>-to-<to>.md` | 27 | 协议已规定，**本次不动** |
| **审查记录** | 日期开头，含 `-review` | **11** | **协议未规定 ⇒ 需统一** |
| 审查类交接 | `HANDOFF-NNN-developer-to-reviewer.md` | 5 | 是**交接**，不是审查记录，**不动** |
| 其他实施记录 | `DATE-implementation.md` / `DATE-ci-verification.md` | 7 | 实施留痕，不在本次范围 |
| 主控位复审 | `2026-10-16-coordinator-recheck.md` | 1 | 已自成一类，**保留** |

**为何值得做**：归档回写自动化（调研于 2026-10-17 18:3x）的**前置依赖**就是命名统一。
`Merge Record` 九要素中，「独立审查记录路径」是**唯一 GitHub 查不到**的要素 ——
PR、提交、CI run 全部永久保存在 GitHub，只有"两轮审查、无阻断"这类判断只存在本地。
目前找它靠人肉翻 `handoffs/`，且 `HANDOFF-001-developer-to-reviewer.md` 这类
**看似审查、实为交接**的文件极易导致误判。地基不牢，后续任何自动化都会漏读。

**两个必须容纳的特例：**

- **特例 A —— 同任务多份审查并存**（TASK-033）：
  `2026-10-15-review.md` 与 `2026-10-15-archive-review.md` **同日同任务**。
  ⇒ 规范必须支持「一个任务多份审查」，否则会逼出覆盖丢文件。
- **特例 B —— 主控位复审须与独立审查名称分区**（TASK-040）：
  该文件正文已自我声明「**本文件不是 AC-10 所要求的「独立审查记录」**，
  **不得被计为** AC-10「两份审查记录」之一」。
  ⇒ 项目内已自发形成好实践：`-review` = 独立审查、`-coordinator-recheck` = 主控位复审。
  **规范应采纳这一既有区分，而非另发明命名。**

---

## Scope

- 模板仓库 `projects/_workspace-template/.agents/protocols/handoff.md`：
  原 §3 内容移入 `### 3.1 交接记录`，新增 `### 3.2 审查记录`。
- 项目仓库 `projects/shadcn-admin/.agents/protocols/handoff.md`：
  由模板仓库**机械同步覆盖**（`cp`），不手改。
- 本任务自身档案（`TASK.md` + `handoffs/`）与目录迁移。

## Non-Scope

- **不重命名任何存量档案**（裁决一已消解为无可执行对象，详见下方「存量裁决」）。
- 不改 `templates/**`（模板仓库与项目仓库两侧均不动）。
- 不改业务代码（`src/` `server/` `shared/`）、`.github/**`、`docs/**`。
- 不新增 CI 门禁、不改工作流。
- 不在项目 `AGENTS.md` 新开规范节（按裁决二，最终落点是框架协议本身）。
- **不自行合并 PR。**
- 不 `git push` 模板仓库（无远端，必然失败）。

---

## Requirements

1. §3 重组为 `### 3.1 交接记录`（原有内容**逐字移入，零丢失**）与
   `### 3.2 审查记录`（新增），**不新开一级节**。
2. §3.2 含三类命名：独立审查记录 `YYYY-MM-DD-review.md`（同任务多份时
   `YYYY-MM-DD-<scope>-review.md`）、主控位复审 `YYYY-MM-DD-coordinator-recheck.md`、
   框架基线审查 `YYYY-MM-DD-baseline-review.md`。
3. §3.2 含四条约束：① 日期用**出具审查结论的日期**；② **不加轮次序号**
   （禁 `review2.md` / `review-round2.md`）；③ 首行标题内必须含任务号；
   ④ 交接记录命名不受本节约束。
4. 两段式执行：先改模板仓库（唯一事实来源）→ 再机械同步到项目快照。
   **不得跳过段一直接在项目内编辑 `.agents/**`。**
5. 项目侧改动走 PR 流程，footer 含 `Refs: TASK-045`。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 不得引入新依赖；纯 Markdown 变更，零代码路径 |
| 兼容 | 存量 11 份审查记录与 27 份交接记录**零重命名**，历史引用与 Merge Record 中的 SHA 不受波及 |
| 安全 | 无密钥、无权限、无 CI 变更 |
| 流程 | 模板仓库无远端 ⇒ 其改动无法走 PR 审查，只能由执行位自证 + 主控位人工核对 |
| 流程 | PR 开好后**必须停下**，等主控位审查与人类显式授权，不得自行合并 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| 人类裁决一（存量是否重命名） | external | 已完成（2026-10-17 19:5x，已消解为无对象） |
| 人类裁决二（是否同时改框架协议） | external | 已完成（2026-10-17 19:5x，采纳两段式） |
| 主控位全量实测（54 文件定性） | blocks | 已完成 |
| TASK-043（D13-C 第九实例） | 无依赖关系 | 已合并 `main`，仍留 `tasks/review/` |

---

## 存量裁决（必读，防止做无用功）

**人类曾裁决「存量 11 份审查记录要重命名」，主控位实测后将其消解为「无可执行对象」。**

复跑校验命令与结果（执行位须**亲自复跑**确认）：

```bash
find tasks -path "*/handoffs/*" -name "*-review*.md" | grep -v "to-reviewer" \
  | while read f; do
      bn=$(basename "$f")
      echo "$bn" | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]*review\.md$' \
        && echo "  OK  $bn" || echo "  BAD  $bn"
    done
```

⇒ 实测 **11/11 全部 OK，0 BAD**。

**根因（务必理解，否则会做无用功）**：§3.1/§3.2 的命名模式**是从现存 11 份记录的
实际形态归纳出来的**，不是凭空设计 ⇒ 归纳结果必然与被归纳对象一致。

**⚠️ 若强行重命名，风险/收益严重倒挂**：收益为 0，代价是存量引用的同步修改
+ 历史档案 SHA 被 TASK-043 等多处 Merge Record 波及。
⇒ **一个都不改。**

---

## Acceptance Criteria

- [x] **AC-1** 模板仓库 `handoff.md` 的 §3 下新增 `### 3.2「审查记录」`子节，
      含 3 类命名模式与 4 条约束；原有交接命名内容完整移入 `### 3.1`，**无内容丢失**
- [x] **AC-2** 两副本逐字一致：`cmp` 无输出（字节级一致，均 5593 字节）
- [x] **AC-3** 存量 11 份审查记录**文件未被重命名**；`git diff --name-status main..HEAD`
      仅 1 个 `M`，**无任何 `R`**
- [x] **AC-4** 存量引用**零改动**：六个存量文件名的引用计数在 `main` 与 `HEAD` **完全一致**
- [x] **AC-5** 项目内 `.agents/**` **未经手工编辑**：该文件的变更**只能**来自模板仓库同步
- [x] **AC-6** 规范支持两个特例：TASK-033「同任务多份审查」（`<scope>` 机制）与
      TASK-040「独立审查 / 主控位复审名称分区」（`-review` vs `-coordinator-recheck`）
- [x] **AC-7** 项目侧改动走 PR 流程：作业名集合未变、
      `python scripts/audit-repo.py` 仍为 `PASS=7 FAIL=0 WARN=0`

---

## File Scope

```yaml
File Scope:
  - projects/_workspace-template/.agents/protocols/handoff.md   # 段一：唯一事实来源
  - projects/shadcn-admin/.agents/protocols/handoff.md         # 段二：同步目标（只可由同步覆盖）
  - tasks/active/TASK-045-review-record-naming/**              # 本任务自身档案
  - tasks/review/TASK-045-review-record-naming/**
Non-Scope (files):
  - tasks/**/handoffs/**          # ★ 存量审查记录一律不改（裁决一已消解）
  - projects/_workspace-template/templates/**    # 模板文件本次不动
  - projects/shadcn-admin/templates/**
  - src/**  server/**  shared/**
  - .github/**                         # 不新增门禁/不改工作流
  - docs/**
```

> **路径基准**：本任务跨两个仓库，命令均已标注 `cd` 目标，
> **不要在错误的仓库里执行 `git` 命令**。
>
> - `E:/NDLDSN-WORKSPACE/projects/_workspace-template`（模板仓库，分支 `master`→`feat/...`，**无远端**）
> - `E:/NDLDSN-WORKSPACE/projects/shadcn-admin`（项目仓库，远端 `huyanluanyuqaq/shadcn-admin`）

---

## Implementation Plan

### 段一 · 模板仓库（改唯一事实来源）

1. `git status --short`（须为空）→ `git switch -c feat/TASK-045-review-record-naming`
2. 编辑 `.agents/protocols/handoff.md`：§3 重组为 §3.1 + §3.2
3. `git add` + `git commit -m "docs(protocol): handoff.md 补「审查记录命名」子节（填补规范空白）"`

### 段二 · 同步到项目快照 + 走 PR

1. `cp` 模板文件 → 项目快照；`cmp` / `diff -q` 校验一致
2. 项目仓库 `git switch main && git pull --ff-only`
3. `git switch -c chore/TASK-045-review-record-naming` + 提交（footer `Refs: TASK-045`）
4. `python scripts/audit-repo.py`（须 `PASS=7 FAIL=0 WARN=0`）
5. 推送分支、按 `.github/PULL_REQUEST_TEMPLATE.md` 开 PR（**标注跨仓改动**），**不合并**

### 段三 · 归档本任务档案

1. 从 `ASSIGNMENT.md` 重建并补齐 `TASK.md`，回填实测值
2. 写 `handoffs/HANDOFF-002-implementer-to-coordinator.md`
3. `Status → REVIEW`，`git mv` 至 `tasks/review/`，提交并推送

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|-------------|
| AC-1 | 手工 | 实读 §3.1/§3.2，比对原有内容无丢失 |
| AC-2 | 命令 | `cmp <template> <project>` 无输出 |
| AC-3 | 命令 | `git diff --name-status main..HEAD` 无 `R` |
| AC-4 | 命令 | 六个存量文件名在 `main` 与 `HEAD` 的引用计数逐一比对，须全 `SAME` |
| AC-5 | 命令 | `cmp <模板仓库提交的 blob> <项目提交的 blob>` 无输出 |
| AC-6 | 手工 | 确认 `<scope>` 机制与 `-coordinator-recheck` 分区已写入 §3.2 |
| AC-7 | 命令 | `python scripts/audit-repo.py` = `PASS=7 FAIL=0 WARN=0`，EXIT=0 |
| 存量合规 | 命令 | 复跑指派单 §6 裁决一的 `find` 校验命令，须 11/11 |

---

## Current State

**实施已完成，等待主控位审查与人类授权。**

- 段一（模板仓库）已完成：提交 `aa381199c22cabf1ed5b24eb034af20dbb491b83`，
  分支 `feat/TASK-045-review-record-naming`（**本地提交，无远端，未 push**）。
- 段二（项目仓库）已完成：提交 `9264dfb`，分支
  `chore/TASK-045-review-record-naming` 已推送，**PR #18 已开、`OPEN`/`MERGEABLE`、未合并**。
  模板仓库 `master` 仍停在 `e507f26`（未合并 feature 分支，符合"不自行合并"约束）。
- 段三（归档）已完成：本档案已补齐并移入 `tasks/review/`。
- **Next Action**：主控位审查 PR #18 → PASS 后由**人类显式授权**才可合并；
  合并后需由下一个任务回写本任务的 `Merge Record` 九要素。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `projects/_workspace-template/.agents/protocols/handoff.md` | 修改 | 段一：§3 → §3.1 + §3.2（+28 行，无删除） |
| `projects/shadcn-admin/.agents/protocols/handoff.md` | 修改 | 段二：`cp` 同步（+28 行，无删除） |
| `tasks/review/TASK-045-review-record-naming/TASK.md` | 新增 | 本档案（从 `ASSIGNMENT.md` 重建） |
| `tasks/review/TASK-045-review-record-naming/handoffs/HANDOFF-002-implementer-to-coordinator.md` | 新增 | 实施交接报告 |

---

## Known Issues

1. **`python3` 在本机不可用**：`python3` 是 Microsoft Store 占位存根
   （`python3 --version` 退出码 49、无输出），真实解释器为 `/c/Python313/python`。
   故 audit 实际以 `python scripts/audit-repo.py` 跑通。
   **这是环境问题，非本次变更引入**；但指派单与既有档案均写作 `python3`，
   该文档化调用方式在本机不可用，建议另立任务修正文档或 PATH。
2. **AC-4 的引用计数口径与指派单不一致（须主控位复核）**：
   指派单给出的分文件引用数为 `2026-10-15-review.md` 13、`2026-10-15-archive-review.md` 6、
   `2026-10-16-review.md` 5、`2026-10-14-review.md` 4、`2026-10-17-review.md` 4、
   `2026-10-16-coordinator-recheck.md` 4（合计 36）。执行位实测得**出现次数**为
   9 / 36 / 6 / 18 / 10 / 10（合计 89），**涉及文件数**为 4 / 17 / 6 / 5 / 4 / 4（合计 40）。
   ⇒ **两种口径均与指派的 36 不完全吻合。**
   **但 AC-4 的判定标准是"引用点数量与改动前一致"，而非等于某个绝对值**；
   执行位已逐一比对 `main` vs `HEAD`，**六个文件名全部 `SAME`（零改动）**，
   故 AC-4 按定义成立。口径差异建议主控位复核，不影响本任务结论。
3. **模板仓库无远端** ⇒ 其框架规范修改（含本次 `aa38119`）**无法走 PR 审查流程**，
   只能依赖执行位 `cmp` 自证 + 主控位人工核对。这是框架层面的结构性缺口，
   建议另立任务评估是否为该仓库接入远端。本任务不处理（超出 File Scope）。
4. **规范空白期的既有命名不可回溯统一**：本规范生效前已产生的审查记录命名不受约束。
   实测 11/11 已合规，故该风险实际为零。
5. 指派单 §7 提到的「归档回写自动化」**尚未实现**，本任务仅为其铺好命名地基，
   需另立任务。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 002 | developer（执行位） | coordinator（主控位） | 2026-10-17 | 两段式实施完成：模板 `aa38119` + 项目 `9264dfb` + PR #18，七项 AC 全过，存量零重命名 |

**最新 Handoff：** `handoffs/HANDOFF-002-implementer-to-coordinator.md`
**Next Action：** 主控位审查 PR #18；PASS 后由人类显式授权方可合并；
合并后由下一个任务回写本任务的 `Merge Record` 九要素。

---

## Task Rules

- [增强] `.agents/**` 虽为「逐字只读快照」，本任务以「先改唯一事实来源、
  再机械同步」的方式取得例外 —— **执行位不得**据此推论今后可在项目内独立修改框架规范。
- [补充] 本任务为**跨仓改动**，模板仓库一侧无 PR 审查环节，
  其正确性完全依赖 `cmp` 字节级自证与主控位人工核对。
- [补充] 存量审查记录一律零改动；`git diff --name-status` 出现任何 `R`
  即视为违反本任务核心约束。

---

## Notes

- 模板仓库侧分支名 `feat/TASK-045-review-record-naming` 与提交信息
  `docs(protocol): handoff.md 补「审查记录命名」子节（填补规范空白）`
  均按指派单原文执行，未作改写。
- 项目仓库中存在一个**与本任务无关**的未合并 PR #17（setup-node v5）
  与未切换分支 `chore/setup-node-v5`，全程未触碰。
- 本任务的 `Merge Record` 九要素尚未回填（需待 PR #18 合并后由下一个任务处理）。
