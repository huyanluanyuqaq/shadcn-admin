# TASK-033 · 阶段 3 平台门禁归档与 `stale.yml` 处置

## Meta

| 字段 | 值 |
| ---- | -- |
| Task ID | `TASK-033` |
| Status | `ACTIVE` |
| Priority | P1（阻塞后续所有任务的闭环方式判定） |
| Assigned Role | implementer（执行位） |
| Created | 2026-10-15 |
| Updated | 2026-10-15 |
| Owner | 执行位（本会话） |
| Owner Since | 2026-10-15 |

## Objective

把 2026-10-14 完成的**分支保护配置**与**门禁实测结论**从会话层落到**层 1 文件**，
并处置上游遗留的定时任务 `stale.yml`（风险 R7：可能自动关闭沉寂的交付请求）。

本任务是**阶段 3 的收尾载体**，也是**分支保护启用后的首个真实交付请求** ——
因此它同时承担 **V5**（必需检查全绿时，所有者能否正常合并自己的 PR）的实测。

## Background

- 2026-10-14 阶段 2 收官：`main` 由 `da93f4b` 推进到 `e3231e7`（PR #2 rebase-merge）。
- 2026-10-14 阶段 3 第一件：**分支保护已启用并实测有效**（V1 / V2 / V4 全部通过）。
- **但结论只存在于会话与一份临时清单**（`.workbuddy/stage3-branch-protection-checklist.md`，
  非本仓库文件）。本仓库内的 `docs/operations/github-capability.md` / `AGENTS.md`
  **仍然写着「尚未配置任何分支保护」** —— 这是**当前最严重的失实陈述**，
  且 `AGENTS.md` §14.4 明确禁止「把计划配置写成已配置」，反向的失真同样必须纠正。

## Requirements

| # | 要求 | 验收方式 |
| - | ---- | -------- |
| R1 | `docs/operations/github-capability.md` §2 改为**已配置**的真实终态（逐字段），删除全部「未启用」表述及其警示段 | 逐字段比对 `gh api .../branches/main/protection` |
| R2 | §4 回填 **V1 / V2 / V4 / V5** 的实测结论与证据（`GH006` 原文、探针 PR #3 的 HTTP 405） | 结论须可复现 |
| R3 | §5 落差表更新「禁止直推」「必需检查」两行的**平台是否强制**，并**同步** `docs/agent-collaboration.md` §6 的同一张表 | 两表逐行一致（防再犯 TASK-031 的 C-2 类错误） |
| R4 | `AGENTS.md` §14.4 由「尚未配置」改为如实描述已配置；**保留**自锁风险与「禁止失真」语句 | 人工核对 |
| R5 | §6 自动化能力现状：把「修改分支保护 / 规则集」由**未实测**改为**已实测可用** | 与本次实际操作一致 |
| R6 | §7 未决与待办：移除已完成项，按现状重排；新增 D13 的**选项 B 失效**事实 | 编号无跳号 |
| R7 | 处置 `.github/workflows/stale.yml`：消除「定时自动关闭交付请求」的风险 | 见 Design Decisions D1 |
| R8 | **不得引入任何未实测的断言**；「计划」与「已生效」严格区分 | 逐条自查 |

## File Scope

**允许修改：**

- `docs/operations/github-capability.md`
- `docs/agent-collaboration.md`（仅 §6 落差表，为 R3 的同步）
- `AGENTS.md`（仅 §14.4）
- `.github/workflows/stale.yml`
- `tasks/active/TASK-033-stage3-platform-record/**`（本任务档案）

**明确排除：**

- `ci.yml` / `docker.yml` / `scripts/audit-repo.py` / `.github/PULL_REQUEST_TEMPLATE.md`（本期不动）
- **D12**（删除 3 个历史远端分支）—— 破坏性操作，**未获授权**
- **D13 的裁决本身** —— 仍待用户；本任务只**记录**其选项空间因实测而收敛的事实
- 升级 `actions/stale` 版本（上游版本漂移不在本期范围）

## Design Decisions

### D1 · `stale.yml` 采用「最小禁用」而非删除

- **做法**：① 移除 `schedule` 触发器（改为仅 `workflow_dispatch`）；② 令 `days-before-pr-stale` /
  `days-before-pr-close` 为 `-1`（`actions/stale` 中**禁用**该侧处理的既有约定）；
  ③ 移除已不需要的 `pull-requests: write` 权限。
- **理由**：本项目**不使用 Issue**（`AGENTS.md` §14 / D2），而 **PR 是交付请求的载体** ——
  一个「沉寂即关闭」的定时任务对本项目**只有风险、没有价值**（R7）。
  选「禁用」而非「删除」是为了①与上游保持最小差异、②可逆（改回 3 处即可恢复）、
  ③保留人工触发的可能性。
- **不选删除的理由**：删除会把「上游遗留资产」变成「本项目的自主决策」，
  而实际需要消除的只是**无人值守的自动行为**，不是这个动作本身。

### D2 · V 编号沿用 `github-capability.md` §4 的既有口径

该文件 V1–V5 的定义与设计方案 §17.2 在 V1 / V2 / V4 上**逐条一致**，本任务不重编号，避免第三套编号。

### D3 · 不新增文档

本次结论并入既有文件，不新开文档 —— 新文档会稀释 `AGENTS.md` §15 的索引，也会制造第二处维护点。

## Current State

- 分支：`chore/TASK-033-stage3-record`（自 `main` = `e3231e7` 派生）
- 前置事实（2026-10-14 实测，见 `handoffs/`）：
  - `main` 分支保护：**已启用**（`require PR` + 必需检查 `install-lint-build` / `audit`
    + `approvals = 0` + `enforce_admins = true` + 禁强推 / 禁删分支）
  - V1 / V2 / V4 **全部实测通过**
- 平台门禁：**本 PR 是它启用后拦下的第一个真实交付请求**

## Verification

见 `handoffs/2026-10-15-implementation.md`。

## Known Issues

1. **V5 在本 PR 合并前无法自称成立** —— 本 PR 就是它的阳性对照，结论只能在合并时得出。
2. **「PR 模板在 GitHub 网页渲染正常」仍未人工确认**（阶段 2 遗留的唯一验收项）。
   本任务提供一个顺路办法：由用户在「新建交付请求」页面目视确认模板是否预填，**无需提交**。
3. **`stale.yml` 的 `-1` 语义未在本仓库实跑验证** —— 该工作流早已不会自动运行，
   且本项目不使用 Issue，故**刻意不做一次真实运行**（会真的给 Issue 打标签/关闭）。
   依据是 `actions/stale` 的既有约定，属**未实测**，如实登记。
4. **D13 仍未裁决** —— 但本次实测使**选项 B（为归档回写开直推豁免）实质失效**：
   经典分支保护无按路径豁免能力，开豁免只能关闭 `enforce_admins`，即**作废 D3（真门禁）**。
   选择空间收敛为「A 或 C」×「终止规则 D / tag」。**仍需用户裁决。**
5. **D12 未授权** —— 3 个历史远端分支 + TASK-031 的 2 条分支仍在远端（共 5 条）。
6. **`gh` 缺 `workflow` scope** —— 不影响本任务（无需 `workflow run`）。
7. 本仓库 `.prettierignore` 为**白名单**模式（仅 `src/` 等），故本期改动的
   `docs/**` / `AGENTS.md` / `.github/**` / `tasks/**` **不进入** `format:check` 的检查范围；
   `eslint .` 亦不覆盖这些文件。这意味着**格式类检查对本期改动不构成保护**，如实登记。

## Merge Record

（合并后由主控位回写：PR 号、合并标识、CI run id、V5 结论。）
