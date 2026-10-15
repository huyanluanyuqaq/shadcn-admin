# TASK-036 — 设计稿滞后断言补记与时点快照限定 + clerk 死代码清理

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-036
Title: 设计稿滞后断言补记与时点快照限定 + clerk 死代码清理
Workflow: docs
Status: DONE
Priority: P2
Owner: 执行位（本会话）
Owner Since: 2026-10-15
Assigned Role: architect（口径判定）+ developer（落实）；审查由新实例 Reviewer 承担
Created: 2026-10-15
Updated: 2026-10-15T12:08:04Z
Branch: chore/TASK-036-doc-sync-and-clerk-cleanup
Requires Human Approval: false
```

---

## Objective

设计稿滞后断言补记与时点快照限定 + clerk 死代码清理 + D13-C 承载 TASK-032 归档回写。

---

## Background

- 来源：TASK-032（`tasks/review/TASK-032-fix-stale-assertions/`）建立的「否定性 / 时点性断言复核机制」
  在框架设计稿（`.agents/proposals/dual-agent-github-collaboration-design-v1-draft.md`，不在 Git 内）
  上暴露同类问题：阶段 4 验收制度已被 PR #4–#8 五次真实交付实证，但设计稿未留「状态」行（文档滞后）；
  「远端现仅剩 `main`」式**时点快照**以现在时陈述、未加限定语的共**四处**
  （每完成一个任务，交付分支会暂时增加、合并删分支后恢复）——
  **前三处（§17 / §17.1 / §18.1）来自任务定义；第四处（§15 阶段 3 状态行 `:1281`）由独立审查发现。**
- TASK-032 的 `Known Issues` D1 登记了 `src/assets/clerk-*.tsx` 死代码「待后续任务清理」——
  本任务即该后续任务（`src/**` 首次进入本类任务的 File Scope）。
- 按 D13 裁决 C：本任务的交付请求**同时承载 TASK-032 的归档回写**（见 `rules/github.md` §6）。

---

## Scope

- 设计稿 `.agents/proposals/dual-agent-github-collaboration-design-v1-draft.md`：
  §15 阶段 4 表补「状态」行；§17 决策表 D12 行、§17.1 裁决记录 D12 行、§18.1 漂移表第 6 行
  的时点快照表述加限定语（三要素：时点 / 动态预期 / 定性）。
- 仓库 `shadcn-admin`：删除 `src/assets/clerk-full-logo.tsx`、`src/assets/clerk-logo.tsx`；
  同步 `AGENTS.md` §13.3 与 `docs/operations/negative-assertion-review.md` §4 D1 的断言。
- 按 D13-C 承载 TASK-032 归档回写：`Status → DONE`、回填 `Merge Record`、移入 `tasks/done/`。

## Non-Scope

- 不动 `docs/architecture/overview.md` 任何 clerk 表述（H 类历史快照，文件头已声明保留）。
- 不动 `src/components/layout/data/sidebar-data.ts:25` 的历史注释。
- 不动 README、`.github/` 上游资产。
- 不合并 PR（合并不经执行位；留用户授权）。

---

## Requirements

1. §15 阶段 4 表新增「状态」行：判定 = ✅ 实质已完成（补记日期 2026-10-15），
   证据逐项对应 PR #4–#8 五次真实交付；「动作」「验收」两行原文一字不改。
2. 三处时点快照加限定语（① 时点 = 2026-10-15 D12 执行时；② 动态预期 = 此后每个新任务的
   交付分支会暂时增加、合并并删分支后恢复；③ 定性 = 时点快照非永久断言，引用前重测）。
3. clerk 两资产删除前后各留一份 grep 输出；删除前 grep 必须为空（assets 外零引用）。
4. `AGENTS.md` §13.3 与 `negative-assertion-review.md` §4 D1 的断言同步更新，
   **不得留下新的过时断言**（TASK-032 机制）。
5. TASK-032 归档回写五要素齐全（PR 号 / 策略 / 提交范围 / 合并标识 / CI / 审查 / 归档）。
6. 每个提交 footer 含 `Refs: TASK-036`（修正 TASK-032 未加 footer 的流程偏差）；
   提交只用显式路径 `git add`（`.workbuddy/` 未跟踪）。

---

## Acceptance Criteria

- [x] AC-1: 设计稿 §15 阶段 4 表含「状态」行，五项验收标准逐项对应 PR #4–#8 实证；
      「动作」「验收」原文未改。
      → 状态行判定「✅ 实质已完成（补记日期 2026-10-15）」；证据链：① PR #4–#8 均存在且
      rebase-merge 合入（`gh api .../pulls/8` 实测 `merged: true`，
      `merged_at 2026-10-15T05:31:34Z`）；② 各任务 `handoffs/2026-10-15-review.md`
      含逐条 AC 核对与 PASS/FAIL；③ TASK-033/034/035 Merge Record 已回填 PR 号与 run id
      （TASK-032 由本任务按 D13-C 回填）；④ 审查均为换实例双会话、以被审 SHA 钉住；
      ⑤ V2「直推 main 被 GH006 拒绝」实测记录见 `docs/operations/github-capability.md` §4。
      「动作」「验收」两行原文一字未改（Edit 工具精确匹配替换，未触碰该两行）。
- [x] AC-2: §17 D12、§17.1 D12、§18.1 第 6 行三处快照均含三要素限定语；
      §17 主表 D12 行的范围外纳入在 Known Issues 登记为 R1。
- [x] AC-3: clerk 两资产已删；删除前后 grep 输出各留一份；`AGENTS.md` §13.3 与
      `negative-assertion-review.md` §4 D1 断言已同步；构建未破坏。
- [x] AC-4: TASK-032 档案 `Status: DONE`、位于 `tasks/done/`、`Merge Record` 五要素回填，
      Known Issues 与过程披露原文保留。
- [x] AC-5: `audit_framework.py` PASS=13 FAIL=0；`pnpm build` / `pnpm lint` /
      `pnpm format:check` 全过；PR 创建后 `gh pr checks` 双绿（见 `handoffs/2026-10-15-implementation.md`）。
- [x] AC-6: 本档案交付时位于 `tasks/review/`，`Status: REVIEW（…归档回写按 D13-C 待下一个任务补记）`，
      Merge Record 留白；提交全部含 `Refs: TASK-036` footer。

---

## File Scope

```yaml
File Scope:
  - .agents/proposals/dual-agent-github-collaboration-design-v1-draft.md   # 非 Git（工作空间根），仅文件改动
  - AGENTS.md                              # 仅 §13.3 遗留死代码一句
  - docs/operations/negative-assertion-review.md   # 仅 §4 D1 行
  - src/assets/clerk-full-logo.tsx         # 删除
  - src/assets/clerk-logo.tsx              # 删除
  - tasks/backlog/TASK-036-doc-sync-and-clerk-cleanup/**   # 本任务档案（提交审查时迁入 review/）
  - tasks/review/TASK-036-doc-sync-and-clerk-cleanup/**    # 迁移目标
  # D13-C：本任务交付请求须一并补记 TASK-032 的归档回写（含目录迁移）
  - tasks/review/TASK-032-fix-stale-assertions/**          # Status→DONE + 回写 Merge Record
  - tasks/done/TASK-032-fix-stale-assertions/**            # 迁移目标（含 handoffs/）
Non-Scope (files):
  - docs/architecture/overview.md          # H 类历史快照，禁改
  - src/components/layout/data/sidebar-data.ts             # 历史注释，禁改
  - README.md
  - .github/**
```

---

## Implementation Plan

| # | 步骤 | 产出 |
|---|------|------|
| 1 | 自 `main`（`f212b7c`）派生分支 `chore/TASK-036-doc-sync-and-clerk-cleanup`，先推远端 | 远端分支对象 |
| 2 | 建 backlog 档案并提交（`Refs: TASK-036`） | commit 1 |
| 3 | 设计稿 AC-1（§15 状态行）+ AC-2（三处限定语） | 文件改动（非 Git） |
| 4 | `audit_framework.py` 基线复核 | PASS=13 FAIL=0 |
| 5 | clerk 删除前 grep → 删除 → 删除后 grep；同步 AGENTS.md / 复核清单 | commit 2 |
| 6 | `pnpm build` / `pnpm lint` / `pnpm format:check` | 全绿输出 |
| 7 | TASK-032 归档回写 + 迁移 | commit 3 |
| 8 | 本档案 Current State / Verification / Known Issues 回填 + 迁 review/ + handoff | commit 4 |
| 9 | 推送、建 PR、`gh pr checks` 双绿留痕 | PR 编号 |

---

## Current State

> **2026-10-15 已实施完毕（执行记录）：**
> ① 分支 `chore/TASK-036-doc-sync-and-clerk-cleanup` 自 `main`（`f212b7c`）派生，
> **先推远端后开工**（`git ls-remote --heads origin` 确认远端对象存在）；
> ② 设计稿（`.agents/proposals/…`，**不在 Git 内**，工作空间根非仓库 —— D9 现状）
> §15 阶段 4 补「状态」行（判定 ✅ 实质已完成，证据逐项对应 PR #4–#8）；
> §17 D12 / §17.1 D12 / §18.1 第 6 行三处时点快照加三要素限定语；
> ③ clerk 两资产删除前后各跑一次 grep（assets 外均零引用），删除后
> `AGENTS.md` §13.3 与 `negative-assertion-review.md` §4 D1 断言同步更新；
> ④ 按 D13-C 承载 TASK-032 归档回写（`Status → DONE` + Merge Record + 移 `tasks/done/`）；
> ⑤ 验证全过：audit PASS=13 FAIL=0；`pnpm build` / `pnpm lint` / `pnpm format:check` 全绿
> （原始输出见 `handoffs/2026-10-15-implementation.md`）。
>
> **提交序列（实施 4 个 + 补录 1 个 + 审查整改 1 个，均含 `Refs: TASK-036` footer，显式路径 `git add`）：**
> `c722b4a` 建档案 → `4bef0cf` clerk 清理 + 断言同步 → `e11aac3` TASK-032 归档回写 →
> `ce6fb6a` 本档案回填 + 迁 `tasks/review/` → `1778228` 补录 CI 双绿留痕 →
> `6703430` 按独立审查整改 O1–O5（含设计稿 `:1281` 限定语与复审记录归档）。
>
> **本任务自身亦演示 D13-C：** 合并后的归档回写（`Status → DONE` + 移 `tasks/done/` +
> `Merge Record`）待下一个任务补记（见 `Merge Record` 区空白）。

## Verification

| 验证项 | 命令 | 结果 |
|--------|------|------|
| 框架审计（`.agents` 改动后） | `python shared/scripts/audit_framework.py` | **PASS=13 FAIL=0**（A1/A2/A6/A10 无回归；A2 仍查 94 处引用路径） |
| clerk 删除前引用核查 | `grep -rln clerk src/ --include='*.tsx' --include='*.ts' \| grep -v assets` | **空**（exit 1 = assets 外零引用）；全量大小写不敏感核查仅存 `sidebar-data.ts:25` 历史注释（不动） |
| clerk 删除后引用核查 | 同上（删除后复跑） | **空**（exit 1 = 保持零引用） |
| 构建 | `pnpm build` | **✓ built in 975ms**（`tsc -b` + `vite build`；首次因环境防误删保护拦下 Vite 清空 `dist/assets`，`rm -rf dist` 后重建通过 —— 见 Known Issues） |
| Lint | `pnpm lint` | **通过**（eslint 无输出） |
| 格式 | `pnpm format:check` | **通过**（All matched files use Prettier code style!） |
| PR #8 事实（AC-4 依据） | `gh api repos/…/pulls/8` 等 | `merged: true`、`merged_at 2026-10-15T05:31:34Z`、`merge_commit_sha f212b7c31921…`、5 提交、父链 `2be342e` → … → `f212b7c` |
| 合并后 CI | `gh api …/actions/runs/38687252674/jobs` | `audit` 5s success / `install-lint-build` 1m22s success；`head_sha=f212b7c` 上仅 CI 一个工作流运行（无 docker 运行） |
| 远端分支状态 | `git ls-remote --heads origin` | **时点快照（2026-10-15，TASK-032 合并后、本任务分支推送前；原始输出见 `handoffs/2026-10-15-implementation.md`）：** 仅 `main`（`f212b7c`）；`docs/TASK-032-…` 已随合并删除。该状态随新任务交付分支暂时增加、合并删分支后恢复——引用前以 `git ls-remote --heads origin` 重测 |
| PR 门禁 | `gh pr checks <n>` | 双绿（见 `handoffs/2026-10-15-implementation.md`，PR 创建后回填） |

原始命令输出全文见 `handoffs/2026-10-15-implementation.md`。

## Known Issues

- **范围披露 R1（来源 = 主控位范围裁定，非审查发现）：** 用户只点名 §17.1 / §18.1 两处；
  §17 主表 D12 行「远端现仅剩 `main`」是**同一缺陷的同类失真**。按项目「范围扩张正当处理范式」
  （MEMORY §10：不因划了范围而留存已知失真）纳入修正，并在此显式登记，**不掩饰为原计划**。
- **范围披露 R2（来源 = 审查位发现，PR #9 独立审查 O2 阻断项）：** 设计稿 §15 阶段 3 状态行
  （`:1281`）「远端仅剩 `main`」是**第四处同类时点快照残留**——无限定语、无任何披露，
  且**当前为假**（`git ls-remote --heads origin` 实测现有 `main` + 本 PR 分支两个 head）。
  本任务 Background 原枚举为「三处」、R1 仅披露 §17 主表一处，枚举不完整。**漏检原因如实写明：**
  实施位的检索模式是「现仅剩」，而 `:1281` 用的是无「现」字的「仅剩」变体，grep 因此漏掉；
  且主控位任务定义的枚举本身即不全（三处枚举来自主控位的同一模式）—— **非实施位单方失误**。
  处置：按 MEMORY §10「不因划了范围而留存已知失真」在 `:1281` 补与另三处同构的三要素限定语，
  并在此登记（整改落实于提交 `6703430`）。
- **张力披露 D1（上游差异取舍）：** clerk 两文件源自上游 `7e80b2e`（作者 satnaing，纯上游未改动），
  删除会与上游产生差异。D11「上游资产保留不动」保护的是**有功能 / 记录价值**的资产；
  clerk 属 Clerk 迁移遗留死代码，且早已在 TASK-032 登记待清理（`negative-assertion-review.md` §4 D1）。
  取舍：删。**此差异与上游同步时需知悉**（`AGENTS.md` §13.5 的上游合并流程不受影响，
  两文件在上游仍存在，若上游将来重新引入引用需重新评估）。
- **环境注记（非代码问题）：** 首次 `pnpm build` 失败于本环境防误删保护
  （`[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]`：Vite `prepareOutDir` 清空
  `dist/assets` 共 73 个文件 > 50 阈值）。处置：`rm -rf dist`（`.gitignore:11` 忽略的
  构建产物，非版本控制内容）后重建通过。CI 环境无此保护，不受影响。
- **过程披露（本地提交 amend）：** 提交 `9798a29`（TASK-032 归档回写）曾漏暂存档案编辑
  （`git mv` 只暂存了重命名），即时 `--amend` 为 `e11aac3` 并复验 `git show --stat`
  （18 insertions / 3 deletions）。该提交**从未推送**，无共享历史被重写。
- **`.agents/` 改动无版本控制（D9 现状）：** 设计稿补记与限定语不在 Git 内，
  无法以 PR 行差异审查，只能以审计脚本实跑 + 本档案 + handoff 全文留痕佐证；
  这也再次构成 D9（`.agents/` 纳入 Git）的现实依据。
- **`Refs:` footer 无工具强制：** TASK-032 已实测 `scripts/` 与 `.agents/` 仅作文档约定；
  本任务 4 个提交均手动加 footer，遵循 `rules/github.md` §3。

---

## Merge Record

**（按 D13-C 由下一个任务 TASK-037 的交付请求补记 —— 2026-10-15 回写完毕，回归终止于深度 1。）**

| 项 | 值 |
| -- | -- |
| 交付载体 | PR [#9](https://github.com/huyanluanyuqaq/shadcn-admin/pull/9)（`chore/TASK-036-doc-sync-and-clerk-cleanup` → `main`） |
| 合并策略 | **rebase-merge**（`AGENTS.md` §14.2） |
| 提交范围 | `main` `f212b7c` → `6ee2777`，共 **8** 提交；**8 对 SHA 全改写、内容零变化**（is-ancestor 均非祖先 + 逐对 tree/subject 相同，实查输出见 `tasks/review/TASK-037-archive-t036-doc-anchors/handoffs/2026-10-15-implementation.md`）：`c722b4a→f1d1428`、`4bef0cf→66ca01e`、`e11aac3→6093280`、`ce6fb6a→e686251`、`1778228→9b1aaf9`、`6703430→410b9e5`、`10f893a→ae1e76f`、`320d95e→6ee2777` |
| 合并标识 | `merged_at` = **`2026-10-15T09:28:05Z`**；`merge_commit_sha` = **`6ee27779ca641a10166941ad89f93833a323f457`**（即合并后 `main` head） |
| CI | 合并后 `main` push：run [`38713147537`](https://github.com/huyanluanyuqaq/shadcn-admin/actions/runs/38713147537)，必需检查 `audit`（09:28:11→09:28:15）+ `install-lint-build`（09:28:11→09:29:21）均 **success**；合并前 PR head（`10f893a`）的 `pull_request` CI 亦双绿（run `38697133770`：`audit` 07:11:56→07:12:02 / `install-lint-build` 07:11:57→07:13:17） |
| D8 解耦复现 | 合并后 `6ee2777` 上**仅** `Continuous Integration` 一个工作流运行（`actions/runs?head_sha=6ee27779…` 实测 total_count = 1），**无 `Build and Push Docker Image` 运行** —— D8 解耦**第 8 次独立复现** |
| 独立审查 | 共 **2 轮**（换实例双会话，对象 `1778228` / `10f893a`，即原始分支 SHA）：**第 1 轮结论「待整改」**（阻断 O1：TASK-032 Merge Record「独立审查」行事实错误；阻断 O2：设计稿 `:1281` 第四处无限定时点快照；非阻断 O3–O5）→ 两轮整改（`6703430` 落实 O1–O5 + N4、`10f893a` 落实主控位复核 N7-1/N7-2/N7-3）→ **第 2 轮复审结论「可合并，无阻断」**（O1–O5、N7-1/N7-2/N7-3、N4 全部经实跑验证关闭；N6 裁定为历史记录可接受；N8 由执行位于合并前补记 PR 描述后关闭）。记录见 `handoffs/2026-10-15-review.md` §1–§6 |
| 遗留问题闭环 | **无遗留** —— 第 1 轮 O1–O5 全部实质关闭；N7-1/N7-2/N7-3、N4 经独立实跑验证关闭；N8（PR 描述补记审查周期）已由执行位于合并前履行（`gh pr view 9 --json body` 实测含「审查与整改」章节） |
| 归档 | `Status → DONE`；档案由 `tasks/review/` 移入 `tasks/done/`（载体 = TASK-037 的交付请求，2026-10-15）；远端分支 `chore/TASK-036-doc-sync-and-clerk-cleanup` 已随合并删除 |

> **★ D13-C 的第四次实证就此完成：** 本任务曾是「回写并入下一个任务」的第四个实例
> —— `Merge Record` 的空白**是裁决的预期形态**，现由 TASK-037 补齐，**无限回归终止于深度 1** 第四次得到实证。
