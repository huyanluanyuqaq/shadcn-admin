# TASK-032 — 核实并修正仓库内残留的过时否定性断言

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-032
Title: 核实并修正仓库内残留的过时否定性断言
Workflow: refactor
Status: DONE
Priority: P2
Owner: 执行位（本会话）
Owner Since: 2026-10-15
Assigned Role: architect（口径判定）+ developer（落实）；审查由新实例 Reviewer 承担
Created: 2026-10-14T08:45:00Z
Updated: 2026-10-15T06:00:00Z
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
      → `docs/operations/negative-assertion-review.md` §2（20 条断言 = 17 条现状 + 3 条历史快照类，逐条附复核命令与责任位）
      + §3（首次全量复核记录：**6 处修正 + 1 处误判回退**，其余登记项判定成立）。
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
> ① 全量扫描 `AGENTS.md` / `README.md` / `docs/**` 的否定性 / 绝对性断言（20 条断言登记在册：17 条现状 + 3 条历史快照类）；
> ② 逐条以命令实测复核 —— **5 处过时**（§13.2「纯前端，无持久层」、§10 faker 规则、
> §4 目录说明 `data.ts`、§13.3 clerk 双路由、§14.6「stale.yml 待处置」）+ **1 处同类失真**
> （§6 `features/users/` 死引用），共 **6 处已修正**；另有 1 处**误判**（§14.6 上游资产
> 「从未存在」）被独立审查拦下并回退，见 Known Issues R3；
> 其余判定成立（逐条依据见 `docs/operations/negative-assertion-review.md` §3）；
> ③ 建立周期性复核清单 `docs/operations/negative-assertion-review.md`
> （含复核命令、责任位、触发规程与新增断言登记规则）；
> ④ 按 D13-C 一并补记 TASK-034 的归档回写（回填 `Merge Record` + 移入 `tasks/done/`
> + 悬空 SHA 说明）。
>
> **本任务自身亦演示 D13-C：** 合并后的归档回写（Status → DONE + 移 `tasks/done/` + `Merge Record`）
> 待下一个任务补记（见下）。

## Merge Record

**（按 D13-C 由下一个任务 TASK-036 的交付请求补记 —— 2026-10-15 回写完毕，回归终止于深度 1。）**

| 项 | 值 |
| -- | -- |
| 交付载体 | PR [#8](https://github.com/huyanluanyuqaq/shadcn-admin/pull/8)（`docs/TASK-032-fix-stale-assertions` → `main`） |
| 合并策略 | **rebase-merge**（`AGENTS.md` §14.2） |
| 提交范围 | `main` `2be342e` → `f212b7c`，共 **5** 提交，**原样未重写**（无 squash / amend / 重排）：分支基于 `main` 尖 `2be342e`（实测 `c138888` 父提交 = `2be342e`），rebase-merge 仅将 5 提交**原样重放**于同一基尖（内容零变化；SHA 因 GitHub rebase-merge 必然改写 committer 元数据而变更，属该策略的固有形态）。原始分支提交：`c138888` → `9bae9ec` → `345b89e` → `c183fa0` → `ba7775b`；`main` 上重放后：`a7e13e2` → `f2c593b` → `c0a1e9f` → `39fa466` → `f212b7c` |
| 合并标识 | `merged_at` = **`2026-10-15T05:31:34Z`**；`merge_commit_sha` = **`f212b7c31921d948bf4f19cbdbc8673128448e22`**（即合并后 `main` head；父提交 `39fa466`，基线 `2be342e` 为其祖先） |
| CI | 合并后 `main` push：run [`38687252674`](https://github.com/huyanluanyuqaq/shadcn-admin/actions/runs/38687252674)，必需检查 `install-lint-build` + `audit` 均 **success**（`audit` 5s：05:31:40→05:31:45；`install-lint-build` 1m22s：05:31:40→05:33:02）；合并前 PR head（`ba7775b`）的 `pull_request` CI 全绿（run `38682757487`：`audit` 4s / `install-lint-build` 1m29s）；其余 4 个提交被后续 push 顺延取代、未产生独立 run（审查位以 `commits/<sha>/check-runs` 逐一实测为零） |
| D8 解耦复现 | 合并后 `f212b7c` 上**仅** `Continuous Integration` 一个工作流运行（`actions/runs?head_sha=f212b7c` 实测），**无 `Build and Push Docker Image` 运行** —— D8 解耦**第 7 次独立复现** |
| 独立审查 | 共 **2 轮**（对象 `9bae9ec` / `345b89e`，即原始分支 SHA）：**第 1 轮结论「待整改」**（阻断项 O1：§14.6 上游资产「从未存在」误判，已回退，见 Known Issues R3）；**第 2 轮结论「可合并，无阻断」**（O1–O5 全部关闭、无新问题）。记录见 `handoffs/2026-10-15-review.md`（**换实例双会话**，`dual-agent-model.md` §5.1） |
| 遗留问题闭环 | **无遗留** —— 第 1 轮 O1 阻断项（§14.6 上游资产误判）已回退，第 2 轮非阻断残留 N1/N2 已就地强化；`Refs:` footer 流程偏差已如实登记（Known Issues），后续任务遵循 |
| 归档 | `Status → DONE`；档案由 `tasks/review/` 移入 `tasks/done/`（载体 = TASK-036 的交付请求，2026-10-15）；远端分支 `docs/TASK-032-fix-stale-assertions` 已随合并删除（`git ls-remote --heads origin` 实测仅剩 `main`） |

> **★ D13-C 的第三次实证就此完成：** 本任务曾是「回写并入下一个任务」的第三个实例
> —— `Merge Record` 的空白**是裁决的预期形态**，现由 TASK-036 补齐，**无限回归终止于深度 1** 第三次得到实证。

---

## Known Issues

- ~~「纯前端，无持久层」是否确已过时尚未独立核实~~ → **已核实：确已过时**
  （`server/` Hono + SQLite + 11 个迁移 + 真实 API 层俱全；`@faker-js/faker` 与 `data.ts` 零残留）。
  修正与依据见 `Current State` 与 `negative-assertion-review.md` §3.1。
- **范围披露（来源 = 本任务调研，非审查发现）：**
  - R1：`AGENTS.md` §6 原引用 `features/users/`（不存在）—— 与否定性断言同类的文档腐坏，
    已改指 `features/customers/components/`。
  - R2：`AGENTS.md` §4 README 行增补防误读注（上游原文中的 Clerk / Sponsor 表述描述上游状态，
    本仓库已移除 Clerk）—— 防止后续会话把 README 当成本仓库现状。
    **注释性增补，不计入「6 处修正」计数。**
  - R3（**误判，已回退 —— 独立审查 O1 拦下**）：曾判定 `AGENTS.md` §14.6 的
    `ISSUE_TEMPLATE/`、`CODE_OF_CONDUCT.md`、`FUNDING.yml` 「从未存在」并将其移出清单。
    实测（审查者实跑 + 本人复核）：三者**存在于 `.github/` 下**、由上游 `satnaing` 引入
    （`7e80b2e`），原表述属实 —— 误判肇因是**复核命令查了仓库根路径**（缺 `.github/` 前缀），
    空结果被当成了「不存在」的证据。已恢复原清单（补 `.github/` 前缀），C15 命令同步修正。
    **教训：坏命令会给坏结论永久盖章；「查无此物」类结论必须先确认查找路径正确。**
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
- **流程偏差披露（模板约定未遵循）：** PR 模板要求每个提交 footer 含 `Refs: TASK-032`，
  本任务 4 个提交未加（任务 ID 已在各提交 subject 前缀 `docs(TASK-032):` / `chore(TASK-032):` 中）。
  **刻意不做历史重写**：两轮独立审查记录以 SHA 钉住审查对象（`9bae9ec` / `345b89e`），
  重写会架空该证据链；且 `Refs:` 无任何工具强制（已实测 `scripts/` 与 `.agents/` 仅作文档约定）。
  后续任务遵循 footer 约定。
- 本任务**不做**事实断言以外的整理（不顺手改文风或重构文档结构）——
  本次 6 处修正均限定在「陈述与代码事实不一致」范围内。
- **过程纠错披露（本任务执行期间，按「为交付留痕的规则同样适用于审查记录自身」登记）：**
  - D3：首个提交曾误落在**本地** `main`（**未推送**，远端从未收到）。已即时修正：
    该提交移入工作分支 `docs/TASK-032-fix-stale-assertions`，`main` 恢复至
    `origin/main`（`2be342e`），`git rev-parse main origin/main` 实测一致。
  - D4：复核清单初版曾把断言总数误写为「19 条现状断言」—— 实为 **20 条**
    （C1–C15 + P1–P2 + H1–H3，其中现状 17 条、历史快照类 3 条），已在提交前就地更正。
    **这正是本任务要防的那类失真（计数型断言），出现在本任务自己的交付物里** —— 记录以示该类
    腐坏无处不在，包括新建文档。

---

## Notes

「否定性断言」是文档里最难自证的一类陈述：它断言某物**不存在**，
而随着代码演进，最先腐坏的就是这类句子。TASK-031 的教训是：
**平台事实会漂移**（`has_issues`），**代码事实同样会漂移** —— 两者都需要机制，而不是好记性。
