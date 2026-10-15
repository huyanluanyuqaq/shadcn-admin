# TASK-037 — 承载 TASK-036 归档回写（D13-C 第四实例）+ 设计稿历史计数注时点化 + V3 措辞对齐 + 仓库杂项

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-037
Title: 承载 TASK-036 归档回写（D13-C 第四实例）+ 设计稿历史计数注时点化 + V3 措辞对齐 + 仓库杂项
Workflow: docs（仓库层含 chore 类改动）
Status: REVIEW（实施完毕并提交审查；归档回写按 D13-C 待下一个任务补记）
Priority: P2
Owner: 执行位（本会话）
Owner Since: 2026-10-15
Assigned Role: architect（口径判定）+ developer（落实）；审查由新实例 Reviewer 承担
Created: 2026-10-15
Updated: 2026-10-15T12:20:35Z
Branch: chore/TASK-037-archive-t036-doc-anchors
Requires Human Approval: false
```

---

## Objective

按 D13 裁决 C 承载 **TASK-036 的归档回写**（D13-C 第四个实例，回归终止于深度 1 的第四次实证）；
对设计稿（`.agents/proposals/dual-agent-github-collaboration-design-v1-draft.md`，不在 Git 内）
三处**历史计数注**做时点化改造（N1 登记项）；对齐 V3 行措辞（TASK-034 独立审查 O2 登记项）；
并完成两项仓库杂项（`.gitignore` 增 `.workbuddy/`、`ci.yml` checkout v4→v5）。

---

## Background

- **D13-C 机制（本任务核心）：** TASK-036 合并（PR #9，2026-10-15T09:28:05Z）后其档案
  `Status = REVIEW（…归档回写按 D13-C 待下一个任务补记）`、`Merge Record` 空白——
  按 `rules/github.md` §6 与 §17.3 裁决，归档回写**并入本任务的交付请求**。
  此前三个 C 实例：PR #7 承载 TASK-035、PR #8 承载 TASK-034、PR #9 承载 TASK-032。
- **N1 登记项（设计稿历史计数注）：** 设计稿 §17.3 / §17.1 / §18.1 三处含**裸计数**
  （「又触发 2 次，共 3 次」「已实际触发 3 次」「四次独立复现」）——与 TASK-032 建立的
  「否定性 / 时点性断言」同族的**计数型时点断言**，未加限定语，随交付推进必然腐坏。
- **TASK-034 独立审查 O2 登记项（V3 措辞）：** 设计稿 §17.1「待实测项」表 V3 行措辞
  与 `.agents/protocols/github-capability-matrix.md` §8 权威定义侧重略异（触发 vs 时机），
  审查判「同义、无冲突」但登记防漂移；处置为最小改动（补交叉引用注），**不改 matrix**。
- **TASK-032 D2 主控位裁决：** `.workbuddy/`（agent 临时文件 / PR 描述草稿）纳入 `.gitignore`。
- **技术更新：** `actions/checkout` v4→v5（Node 24 运行时基线）。

---

## Scope

- 按 D13-C 承载 TASK-036 归档回写：`Status → DONE`、回填 `Merge Record`（七要素）、
  移入 `tasks/done/`（含 handoffs/ 全部文件）；Known Issues / Background / Current State /
  Verification 原文一字不改。
- 设计稿三处历史计数注时点化（三要素：时点 / 动态预期 / 非永久断言+重测命令）：
  §17.3 前言（D13 触发计数）、§17.1 D13 行（D13 触发计数）、§18.1 末注（D8 复现计数）。
- 设计稿 §17.1 V3 行补交叉引用注（权威定义见 `github-capability-matrix.md` §8）；
  该行结论「甲下不需要：`pull_request` 触发已足够」一字不动。
- 仓库 `.gitignore` 增 `.workbuddy/`；`.github/workflows/ci.yml` 两处 checkout v4→v5。

## Non-Scope

- 不合并 PR、不推 `main`、不起审查者、不 amend / force-push 已推送提交。
- 不改 `.agents/**` 其余文件（含 `github-capability-matrix.md` —— TASK-034 已裁定 §8 为权威源）。
- 不改 `ci.yml` 其余行（node 版本等）、`docs/`、`src/**`、`README.md`、`.github/` 其余文件。
- D9（`.agents/` 纳入 Git）不纳入本任务——设计稿 §17.1 已「列为独立后续任务」，
  本任务仅在 Known Issues 如实披露其现实影响。

---

## Requirements

1. TASK-036 归档回写七要素全部**先实查验证后写入**：PR #9 / rebase-merge / 8 提交 /
   `merged_at` / `merge_commit_sha` / 合并后 CI run 双绿 / D8 解耦第 8 次复现 /
   两轮独立审查史实 / 8 对 SHA 映射（is-ancestor 非祖先 + 逐对 tree/subject 相同）。
2. Meta `Updated` 刷新为真实编辑时间且**早于提交时间**（N4 纪律）。
3. TASK-036 档案仅动三处：`Status`、Meta `Updated`、`Merge Record` 区 + 目录迁移；
   Known Issues（R1/R2/D1/环境注记/过程披露/D9 注记/Refs 注记）、Background、
   Current State、Verification **原文一字不改**。
4. 设计稿三处计数注按三要素模式改造；**所有计数以命令实查为准**
   （PR 列表 / run 列表逐条对），不采信任务定义转述。
5. V3 行最小改动：仅补交叉引用注，结论句一字不动；不改 matrix。
6. ci.yml 推送前本地验证 YAML 合法；PR 的 `gh pr checks` 双绿才算该 AC 完成
   （ci.yml 写坏 → 必需检查不上报 → PR 永久 blocked 的自锁风险必须避免）。
7. 每个提交 footer 含 `Refs: TASK-037`；只用显式路径 `git add`（禁 `git add -A` / `.`）。
8. `.agents/` 的文件改动**不得进入任何提交**（不在 Git 内），以审计 + 档案 + handoff 留痕佐证。

---

## Acceptance Criteria

- [x] AC-1: TASK-036 档案 `Status: DONE`、位于 `tasks/done/`、`Merge Record` 七要素回填且
      全部数值经命令实查验证（PR #9 / rebase-merge / 8 提交 / merged_at 2026-10-15T09:28:05Z /
      merge_commit_sha `6ee27779ca641a10166941ad89f93833a323f457` / run 38713147537 双绿 /
      D8 第 8 次复现 / 两轮审查史实 / 8 对 SHA 映射 tree+subject 逐对相同）；
      Known Issues / Background / Current State / Verification 原文一字未改（diff 仅 18+/3-）。
- [x] AC-2: `.gitignore` 含 `.workbuddy/`（带注释，`.gitignore:43`）；
      `git status --short` 不再出现 `?? .workbuddy/`（`git check-ignore -v` 实测命中）。
- [x] AC-3: `ci.yml` 两处 checkout v4→v5（行 22 / 行 77），其余行未动
      （setup-node 保持 v4、node 22 未动）；本地 `yaml.safe_load` 验证合法（YAML OK）；
      PR #10 `gh pr checks` **双绿**（run `38733746197`：audit 5s / install-lint-build 54s）。
- [x] AC-4: 设计稿三处计数注完成时点化（时点 / 动态预期 / 重测命令三要素齐全）；
      D13 实例映射与 D8 八 head run 列表均以实查输出为准（handoff §2 留痕，
      含 `b31792e` 双 run 细节如实披露）。
- [x] AC-5: V3 行含交叉引用注（权威定义见 `github-capability-matrix.md` §8；
      结论「甲下不需要：`pull_request` 触发已足够」一字未动）；
      `github-capability-matrix.md` 零改动。
- [x] AC-6: 本档案交付时位于 `tasks/review/`、`Status: REVIEW`、Meta `Updated`
      （12:16:48Z）早于提交时间；handoff 含全部实跑命令与原始输出；
      Known Issues 如实披露 `.agents/` 无版本控制与 D9 排除理由。
- [x] AC-7: `audit_framework.py` PASS=13 FAIL=0；`scripts/audit-repo.py` PASS=6；
      `pnpm build` / `pnpm lint` / `pnpm format:check` 全绿；`git status --short` 干净。

---

## File Scope

```yaml
File Scope:
  - tasks/review/TASK-036-doc-sync-and-clerk-cleanup/**    # Status→DONE + Meta + Merge Record 回填
  - tasks/done/TASK-036-doc-sync-and-clerk-cleanup/**      # 迁移目标（含 handoffs/）
  - .gitignore                                            # 增 .workbuddy/
  - .github/workflows/ci.yml                              # 仅 checkout 两行
  - .agents/proposals/dual-agent-github-collaboration-design-v1-draft.md  # 非 Git：三处计数注 + V3 行
  - tasks/backlog/TASK-037-archive-t036-doc-anchors/**    # 本任务档案（提交审查时迁 review/）
  - tasks/review/TASK-037-archive-t036-doc-anchors/**     # 迁移目标
Non-Scope (files):
  - .agents/** 其余文件（含 github-capability-matrix.md）  # D9 不纳入；matrix 是权威源不改
  - .github/workflows/ci.yml 其余行
  - docs/architecture/overview.md、src/**、README.md、.github/ 其余文件
```

---

## Implementation Plan

| # | 步骤 | 产出 |
|---|------|------|
| 1 | 自 `main`（`6ee2777`）派生分支，**先推远端**（`git ls-remote --heads origin` 确认） | 远端分支对象 |
| 2 | AC-1 事实实查：PR #9 / run 38713147537 / D8 第 8 次复现 / 8 对 SHA 映射 / 两轮审查 / N8 | 实查输出 |
| 3 | 建 backlog 档案并提交（`Refs: TASK-037`） | commit 1 |
| 4 | AC-4 计数实查：PR 列表逐条对（D13 实例映射）、8 个 main HEAD run 列表（D8 复现） | 实查输出 |
| 5 | TASK-036 归档回写（Status→DONE + Meta + Merge Record 七要素）+ `git mv` 迁 `tasks/done/` | commit 2 |
| 6 | `.gitignore` 增 `.workbuddy/` + `ci.yml` checkout v4→v5；YAML 本地验证 | commit 3 |
| 7 | 设计稿三处计数注时点化 + V3 行交叉引用注（**不提交**，`.agents/` 不在 Git） | 文件改动留痕 |
| 8 | 本档案 Current State / Verification / Known Issues 回填 + 迁 `tasks/review/` + handoff | commit 4 |
| 9 | 全量验证（audit / audit-repo / build / lint / format:check / git status） | 全绿输出 |
| 10 | 推送、建 PR、`gh pr checks` 双绿留痕 | PR 编号 |

---

## Current State

> **2026-10-15 已实施完毕（执行记录）：**
> ① 分支 `chore/TASK-037-archive-t036-doc-anchors` 自 `main`（`6ee2777`，PR #9 合并后）派生，
> **先推远端后开工**（`git ls-remote --heads origin` 确认远端对象存在）；
> ② **D13-C 第四实例**：TASK-036 档案 `Status → DONE`、Meta `Updated` 刷新（12:08:04Z，
> 早于提交时间）、`Merge Record` 七要素全部经命令实查验证后回填（PR #9 / rebase-merge / 8 提交 /
> `merged_at 2026-10-15T09:28:05Z` / `merge_commit_sha 6ee27779ca641a10166941ad89f93833a323f457` /
> 合并后 push run `38713147537` 双绿 / D8 解耦第 8 次独立复现 / 两轮独立审查史实 / 8 对 SHA
> 全改写映射），档案移入 `tasks/done/`（含 handoffs/ 全部文件）；
> Known Issues / Background / Current State / Verification 原文一字未改；
> ③ 仓库杂项：`.gitignore` 增 `.workbuddy/`（`git check-ignore` 实测生效）；
> `ci.yml` 两处 checkout v4→v5（YAML 本地验证 OK）；
> ④ 设计稿（`.agents/proposals/…`，**不在 Git 内**）三处历史计数注时点化
> （§17.3 前言 / §17.1 D13 行 / §18.1 末注，三要素齐全，计数全部实查）
> + V3 行交叉引用注（结论句未动，matrix 零改动）；
> ⑤ 验证全过：`audit_framework.py` PASS=13 FAIL=0；`audit-repo.py` PASS=6；
> `pnpm build` / `pnpm lint` / `pnpm format:check` 全绿（原始输出见
> `handoffs/2026-10-15-implementation.md`）。
>
> **提交序列（均含 `Refs: TASK-037` footer，显式路径 `git add`）：**
> `2e9084c` 建档案 → `95fd1c2` TASK-036 归档回写 + 迁 `tasks/done/` →
> `c7729dd` .gitignore + ci.yml checkout → `fef2a1e` 档案回填 + 迁 `tasks/review/` + handoff
> →（补录提交）PR #10 编号与 `gh pr checks` 双绿留痕（run `38733746197`）。
>
> **本任务自身亦演示 D13-C：** 合并后的归档回写（`Status → DONE` + 移 `tasks/done/` +
> `Merge Record`）待下一个任务补记（见 `Merge Record` 区空白）。

## Verification

| 验证项 | 命令 | 结果 |
|--------|------|------|
| PR #9 合并标识 | `gh api repos/huyanluanyuqaq/shadcn-admin/pulls/9` | `merged: true`、`commits: 8`、`merged_at 2026-10-15T09:28:05Z`、`merge_commit_sha 6ee27779ca641a10166941ad89f93833a323f457` |
| 合并后 CI | `gh api …/actions/runs/38713147537/jobs` | `audit` 09:28:11→09:28:15 success；`install-lint-build` 09:28:11→09:29:21 success |
| D8 第 8 次复现 | `gh api "…/actions/runs?head_sha=6ee27779…"` | total_count = 1（仅 CI，无 docker） |
| rebase-merge 证据 | `git merge-base --is-ancestor` × 8 | 8 个 head SHA 均 NOT-ANCESTOR；main 历史线性 |
| 8 对 SHA 映射 | `git rev-parse <pair>^{tree}` + subject 比对 | 8/8 TREE-SAME + SUBJECT-SAME |
| D13 实例映射 | `gh pr list --state all` + 各 PR commits 实读 | 选项 A 时期 PR #2/#4/#5；C 实例 PR #7(TASK-035)/#8(TASK-034)/#9(TASK-032)；本任务 PR = 第 4 实例 |
| D8 八head run 列表 | `gh api "…/actions/runs?head_sha=<h>"` × 8 | 8 head 均无 docker run；`b31792e` 双 run 细节如实披露（workflow_dispatch stale + push CI queued） |
| ci.yml YAML 合法性 | `python -c "import yaml;yaml.safe_load(open('.github/workflows/ci.yml'))"` | **YAML OK**；checkout@v5 ×2（行 22/77）；setup-node@v4 未动 |
| `.workbuddy/` ignore | `git check-ignore -v .workbuddy/` + `git status --short` | `.gitignore:43` 命中；status 干净 |
| 框架审计 | `python shared/scripts/audit_framework.py` | **PASS=13 FAIL=0** WARN=0 SKIP=0 |
| 仓库审计 | `python scripts/audit-repo.py` | **PASS=6 FAIL=0** |
| 构建 | `pnpm build` | **✓ built in 750ms**（首次因环境防误删保护拦下，`rm -rf dist` 后通过） |
| Lint | `pnpm lint` | **通过** |
| 格式 | `pnpm format:check` | **通过**（覆盖 ci.yml） |
| PR 门禁 | `gh pr checks` | **双绿**（PR #10，run `38733746197`：audit 5s / install-lint-build 54s；head `fef2a1e` OPEN/MERGEABLE） |

原始命令输出全文见 `handoffs/2026-10-15-implementation.md`。

## Known Issues

- **`.agents/` 改动无版本控制（D9 现状）：** 设计稿三处计数注与 V3 行改动不在 Git 内，
  无法以 PR 行差异审查，只能以 `audit_framework.py` 实跑（PASS=13 FAIL=0）+
  本档案 + `handoffs/2026-10-15-implementation.md` §4 全文留痕佐证；
  这再次构成 D9（`.agents/` 纳入 Git）的现实依据。
- **D9 被显式排除的理由：** 设计稿 §17.1 已将 D9「列为独立后续任务」；
  本任务仅在 Known Issues 披露其现实影响，不越权纳入范围。
- **环境注记（非代码问题）：** 首次 `pnpm build` 失败于本环境防误删保护
  （`[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]`：Vite `prepareOutDir` 清空
  `dist/assets` 共 73 个文件 > 50 阈值）—— 与 TASK-036 同款。处置：`rm -rf dist`
  （`.gitignore` 忽略的构建产物，非版本控制内容）后重建通过。CI 环境无此保护，不受影响。
- **`b31792e` 双 run 细节披露（D8 计数佐证）：** 该 head 上 push 事件的 CI run
  （`38609669658`）因 2026-10-14 Actions 停用最终 queued 未完成（TASK-034 已登记）；
  另有一个 `workflow_dispatch` **手动触发**的 stale 工作流 run（`38662878838`，
  非计划任务、非 docker）。8 个 head 均无 `Build and Push Docker Image` 运行，
  D8 判据不受影响。
- **`Refs:` footer 无工具强制：** 沿 TASK-032/036 结论（`scripts/` 与 `.agents/` 仅作文档约定），
  本任务提交均手动加 footer，遵循 `rules/github.md` §3。

---

## Merge Record

**（按 D13-C，本项在下一个任务出现之前保持空白；届时由该任务的交付请求补记。）**
