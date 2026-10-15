# TASK-032 — 核实并修正仓库内残留的过时否定性断言

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-032
Title: 核实并修正仓库内残留的过时否定性断言
Workflow: refactor
Status: REVIEW（2026-10-15 实施完毕并提交审查；归档回写按 D13-C 待下一个任务补记）
Priority: P2
Owner: 执行位（本会话）
Owner Since: 2026-10-15
Assigned Role: architect（口径判定）+ developer（落实）；审查由新实例 Reviewer 承担
Created: 2026-10-14T08:45:00Z
Updated: 2026-10-15T04:14:40Z
Branch: docs/TASK-032-fix-stale-assertions
Requires Human Approval: false
```

---

## Objective

把 `AGENTS.md` §13.2 等位置**疑似**与当前仓库现实不符的否定性断言（最典型的候选：「纯前端，无持久层」）
**核实后**改正，使文档陈述与代码现实一致。**以「每一条断言都有可复核依据」为完成标准。**

> **注意口径：** 本任务**不预设** §13.2 已经过时 —— 它只是**线索**。
> 「是否过时」必须由本任务按代码事实核实后判定（见 `Known Issues`）。

---

## Background

- 来源：TASK-031（`tasks/done/TASK-031-github-framework-adoption/`）的 `Known Issues` 第 7 项。
  TASK-031 在替换 PR 模板、改造 CI 时**已触及 `AGENTS.md`**，但**刻意未动** §13.2：
  该条属「不在阶段 2 文件清单内」，且**修正它需要先核实真实状态**，
  否则只是用另一句未经验证的话替换一句未经验证的话。
- 相关规范：`tasks/done/TASK-031-github-framework-adoption/handoffs/2026-10-14-review.md`
  与框架的**否定性断言复核**要求（设计稿 §13.4）。
- **同时暴露的教训**：TASK-031 期间发现 `has_issues` 这一**平台事实**发生漂移
  （阶段 1 记为 `false`，实测为 `true`）→ 说明「否定性断言」既有代码侧的，也有平台侧的，
  两者都需要**复核机制**而非一次性修正。平台侧的复核机制已落地（能力记录 §8）。

---

## Scope

- 逐条复核仓库内所有**否定性 / 绝对性断言**（「无 X」「不包含 Y」「不使用 Z」「纯 W」），
  至少覆盖：`AGENTS.md`、`README.md`、`docs/**`。
- 对每条断言给出**可复核依据**（文件路径 + 代码位置或命令），据此判定：仍然成立 / 已过时 / 无法判定。
- 修正已过时的断言；对「无法判定」的，标注待核实而不是猜测。
- 在 `docs/` 内建立一个**复核清单**，使该类断言今后可被周期性复查。

## Non-Scope

- **不改动任何业务代码**（本任务只改文档）。
- 不改平台设置。
- 不处理 TASK-031 的其它已知遗留（如审计脚本 F4 覆盖面、`stale.yml` 处置）。

---

## Requirements

1. 给出仓库内否定性断言的**清单**（含位置与原文）。
2. 每条断言附**复核依据**与判定结论（成立 / 过时 / 无法判定）。
3. `AGENTS.md` §13.2 的结论必须来自**代码事实**，不得沿用其它文档的转述。
4. 建立周期性复核清单（可执行、可交接）。
5. 若发现新的事实漂移类型，同步回填相应记录（代码侧入 `docs/`，平台侧入能力记录 §8）。

---

## Acceptance Criteria

- [x] AC-1: 存在一份否定性断言清单，且每条都有复核依据与判定结论。
      → `docs/operations/negative-assertion-review.md` §2（19 条现状断言，逐条附复核命令与责任位）
      + §3（首次全量复核记录：**7 处修正 / 12 处判定成立**）。
- [x] AC-2: `AGENTS.md` §13.2 的断言已按代码事实改正（或改写为可复核的表述）。
      → 原「纯前端，无持久层 / faker mock」**证实过时**（`server/` + 11 个迁移 + 真实 API 层；
      faker 与 `data.ts` 零残留），已改写为「持久层已落地 + 端到端判定标准 + 反向失真警示」；
      连同 §10 / §4 / §13.3 / §14.6 共 **5 处**过时断言一并修正。
- [x] AC-3: 复核清单已建立，且指明复核命令与责任位。
      → `docs/operations/negative-assertion-review.md`：§2 每行含复核命令；§5 规定责任位
      （执行位例行 / 主控位周期 / architect 历史类）与触发条件、登记规则。
- [x] AC-4: 本任务的 `File Scope` 之外无改动。
      → 提交前 `git diff --cached --name-only` = 7 个路径，全部在 File Scope 内
      （含两个目录迁移的源与目标；`.workbuddy/` 保持未跟踪、未纳入）。

---

## File Scope

```yaml
File Scope:
  - AGENTS.md
  - README.md                        # 经全量复核判定无需改动（理由见 Known Issues）
  - docs/**
  - tasks/backlog/TASK-032-fix-stale-assertions/**
  - tasks/review/TASK-032-fix-stale-assertions/**   # 迁移目标：提交审查时 Status→REVIEW 并迁入
  # D13-C：本任务交付请求须一并补记 TASK-034 的归档回写（含目录迁移）
  - tasks/review/TASK-034-unify-v-numbering/**       # Status→DONE + 移 done/ + 回写 Merge Record
  - tasks/done/TASK-034-unify-v-numbering/**         # 迁移目标
Non-Scope (files):
  - src/**
  - server/**
  - shared/**
```

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 | 人工复核 | 清单逐条比对仓库现状 |
| AC-2 | 人工复核 + 代码取证 | 按断言给出的依据命令实际执行 |
| AC-3 | 人工复核 | 清单是否含复核命令与责任位 |
| AC-4 | 机器 | `git diff --name-only <base>...HEAD` 与 `File Scope` 逐项比对 |

---

## Current State

> **2026-10-15 已实施完毕（执行记录）：**
> ① 全量扫描 `AGENTS.md` / `README.md` / `docs/**` 的否定性 / 绝对性断言（19 条现状断言登记在册）；
> ② 逐条以命令实测复核 —— **5 处过时**（§13.2「纯前端，无持久层」、§10 faker 规则、
> §4 目录说明 `data.ts`、§13.3 clerk 双路由、§14.6「stale.yml 待处置」）+ **2 处同类失真**
> （§14.6 三个从未存在的上游资产、§6 `features/users/` 死引用），共 **7 处已修正**；
> 其余判定成立（逐条依据见 `docs/operations/negative-assertion-review.md` §3）；
> ③ 建立周期性复核清单 `docs/operations/negative-assertion-review.md`
> （含复核命令、责任位、触发规程与新增断言登记规则）；
> ④ 按 D13-C 一并补记 TASK-034 的归档回写（回填 `Merge Record` + 移入 `tasks/done/`
> + 悬空 SHA 说明）。
>
> **本任务自身亦演示 D13-C：** 合并后的归档回写（Status → DONE + 移 `tasks/done/` + `Merge Record`）
> 待下一个任务补记（见下）。

## Merge Record

**（按 D13-C，本项在下一个任务出现之前保持空白；届时由该任务的交付请求补记。）**

---

## Known Issues

- ~~「纯前端，无持久层」是否确已过时尚未独立核实~~ → **已核实：确已过时**
  （`server/` Hono + SQLite + 11 个迁移 + 真实 API 层俱全；`@faker-js/faker` 与 `data.ts` 零残留）。
  修正与依据见 `Current State` 与 `negative-assertion-review.md` §3.1。
- **同类失真纳入修正（范围扩张披露，来源 = 本任务调研，非审查发现）：**
  - R1：`AGENTS.md` §6 原引用 `features/users/`（不存在）—— 与否定性断言同类的文档腐坏，
    已改指 `features/customers/components/`。
  - R2：`AGENTS.md` §4 README 行增补防误读注（上游原文中的 Clerk / Sponsor 表述描述上游状态，
    本仓库已移除 Clerk）—— 防止后续会话把 README 当成本仓库现状。
  - R3：`AGENTS.md` §14.6 原列 `ISSUE_TEMPLATE/`、`CODE_OF_CONDUCT.md`、`FUNDING.yml`
    为「保留的上游资产」—— 实测三者**在本仓库历史中从未存在**（`git log --all -- <paths>` 为空），
    属虚假存在性断言，已从清单移除。
- **README.md 未改动的理由：** 其为刻意保留的上游原文（§4 已声明「未改动」），
  其中失真表述描述**上游项目**；改写会破坏该属性，故以 §4 防误读注 + 本登记处置。
- **`docs/**` 未改动的理由：** 全部否定性表述均为「历史快照 + 显式声明」
  （`overview.md` 文件头）、决策时点状态（ADR-001 / 002 背景节）或设计 rationale（ADR-003），
  属正确范式；`api-contract.md` 的「唯一 / 不存在」为 schema 级语义，与迁移一致。
- **Non-Scope 内发现（只登记，不处置）：**
  - D1：`src/assets/clerk-*.tsx` 两个 logo 资产零引用（Clerk 迁移死代码）——
    `src/**` 在 Non-Scope，已登记于 `negative-assertion-review.md` §4 D1，待后续任务清理。
  - D2：`.workbuddy/`（历次 PR 临时文件）未被 `.gitignore` 覆盖且未入库 ——
    本任务提交一律用显式路径；是否纳入 `.gitignore` 由主控位另行裁决。
- 本任务**不做**事实断言以外的整理（不顺手改文风或重构文档结构）——
  本次 7 处修正均限定在「陈述与代码事实不一致」范围内。

---

## Notes

「否定性断言」是文档里最难自证的一类陈述：它断言某物**不存在**，
而随着代码演进，最先腐坏的就是这类句子。TASK-031 的教训是：
**平台事实会漂移**（`has_issues`），**代码事实同样会漂移** —— 两者都需要机制，而不是好记性。
