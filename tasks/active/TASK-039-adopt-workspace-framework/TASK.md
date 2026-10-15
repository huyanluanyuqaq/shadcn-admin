# TASK-039 — 接入 Workspace 模板仓库双 Agent 协作框架

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-039
Title: 接入 Workspace 模板仓库双 Agent 协作框架（.agents/ + templates/ 入仓）
Workflow: chore
Status: ACTIVE
Priority: P2
Owner: 主控位（本会话）
Owner Since: 2026-10-15
Assigned Role: architect（口径判定）+ developer（落实）；审查由新实例 Reviewer 承担
Created: 2026-10-15
Updated: 2026-10-15T23:40:00Z
Branch: chore/TASK-039-adopt-workspace-framework
Requires Human Approval: false
```

> **编号说明：** 本仓库任务序号 001–037 已占用；**038 已由模板仓库任务占用**
> （2026-10-15 创建于 `projects/_workspace-template/tasks/done/TASK-038-workspace-template/`）。
> 本任务取 **039** 以避免跨仓库引用歧义（两个仓库各有独立任务序列）。

---

## Objective

按用户指令（2026-10-15）：**将 shadcn-admin 的项目整体框架改造为 `projects/` 目录下模板仓库
（`_workspace-template/`）的双 Agent 协作框架** —— 使本仓库独立 clone 后即自带完整协作规范，
不再依赖 Workspace 根目录的 `.agents/`。

判定标准：`.agents/` 与 `templates/` 逐字入仓、框架脚本落位、全部因接入而失效的文档断言完成防腐修正、
仓库门禁（`audit` 作业）能验证框架资产在位，且 CI 双绿 + 独立审查 PASS 后合并。

---

## Background

- **模板仓库已建立（TASK-038，2026-10-15）：** 用户裁定工作空间根不做 `git init`，D9 改为在
  `projects/_workspace-template/` 建立可复制的模板仓库（独立 Git），含 `.agents/`、`templates/`、
  `shared/`、根 `AGENTS.md`、`README.md`、`.gitignore`。新项目从此模板复制，自带双 Agent 协作体系。
- **本仓库的既有缺口：** shadcn-admin 的 `AGENTS.md` §12 按「Standalone 模式下 `.agents/**` 缺失」
  设计应对；`docs/operations/github-capability.md`、`docs/agent-collaboration.md`、
  `docs/operations/agent-constraints.md`、`docs/operations/negative-assertion-review.md`（C9）
  均含「`.agents/` 不在本仓库内」类断言。框架不入仓，这些断言永远成立但也永远意味着
  **独立 clone 丢失协作规范**。
- **接入方式依据：** `.agents/protocols/project-adoption.md`（只加不改：协调层追加、代码层零改动）。
  `shared/scripts/create_from_template.py` **不适用**（它为从零建新项目设计，会 `git init` 并覆盖复制）。
- **D13-C 承载（github.md §2 豁免）：** 本地 `main` 领先 `origin/main` 两个提交
  （`6d8c731` + `da98560`，TASK-037 归档回写，D13-C 第五实例）。按 D13-C，本任务分支
  **同时承载该回写**（范围仅限 `tasks/**`），不单独开回写专用交付请求。

---

## Scope

- 从 `projects/_workspace-template/` **逐字复制**框架资产入本仓库：
  - `.agents/`（roles / workflows / rules / protocols / state / proposals / README.md）
  - `templates/`（task / handoff / adr / github / project）
  - `shared/scripts/`、`shared/tools/`、`shared/knowledge/`、`shared/README.md`
    （**合并进既有 `shared/` 目录** —— 该目录已被 pnpm 包 `@repo/shared` 占用，属同名不同义；
     框架侧只追加子目录与 README，不改动 `shared/src/`、`shared/package.json` 等既有文件）
- 修正全部因框架入仓而失效的文档断言（§Requirements R3）。
- 扩展 `scripts/audit-repo.py`：新增 F7「框架资产在位」检查，纳入 CI `audit` 门禁。
- 按 D13-C 在本分支承载 TASK-037 归档回写（两个既有提交，随本分支推送）。
- 任务档案（`tasks/active/` → `tasks/review/`）+ 交接/审查记录落 `handoffs/`。

## Non-Scope

- **不改动代码层**：`src/`、`server/`、`shared/src/`、`shared/package.json`、`shared/tsconfig.json`、
  `package.json`、`pnpm-lock.yaml`、`vite.config.ts`、`.github/workflows/*` 一律不动
  （`scripts/audit-repo.py` 属门禁脚本，按 R4 扩展，不改变其既有检查语义）。
- 不修改 `.agents/` 与 `templates/` 的任何内容（逐字快照；项目级覆盖走 `AGENTS.md` §10）。
- 不改模板仓库本身（`projects/_workspace-template/` 不由本任务演进）。
- 不推远端模板同步脚本（`sync_from_template.py` 留作后续任务，TASK-038 Known Issue 已登记）。
- 不新增/修改任何依赖；不触碰 `dist/`、`node_modules/`、`data/` 等 ignored 产物。

---

## Requirements

1. **框架资产完整且逐字一致**：`.agents/`、`templates/` 与模板仓库对应目录 `diff -r` 零差异；
   `shared/scripts/` 等框架子目录存在且内容与模板一致。
2. **代码层零改动**：`git diff origin/main -- src server shared/src shared/package.json package.json pnpm-lock.yaml .github` 为空
   （TASK-037 回写两个提交仅触及 `tasks/**`）。
3. **文档断言防腐**：下列位置中「`.agents/` 不在本仓库 / Standalone 缺失」类表述全部修正，
   且每处修正可被 `negative-assertion-review.md` §2 的复核命令验证：
   - `AGENTS.md`：§4 目录树（补 `.agents/`、`templates/`、`shared/` 双语义）、§9 文档位置表、
     §10 项目规则（新增「框架快照只读」条）、§12 Standalone 重写、§14.2 规范来源表述
   - `README.md`：末尾追加「Agent 协作」章节（指向 `AGENTS.md`），主体上游原文不动
   - `docs/agent-collaboration.md`：文件头「上层规范不可读」理由改写
   - `docs/operations/github-capability.md`：D13 段落中「`.agents/**` 不在本仓库内」改写
   - `docs/operations/agent-constraints.md`：文件头模式表述改写
   - `docs/operations/negative-assertion-review.md`：C9 行更新为「框架资产与模板一致」+ C4 行更新（README 追加章节）
4. **门禁扩展**：`scripts/audit-repo.py` 新增 F7（框架资产在位），CI `audit` 作业随之覆盖；
   既有 F1–F6 语义不变。
5. **审计双绿**：`python3 scripts/audit-repo.py` 全 PASS（含 F7）；
   `python3 shared/scripts/audit_framework.py --root .` 在项目根可跑且无 FAIL
   （A1–A13 与模板仓库同口径；A3 缺 PyYAML 时 SKIP 属预期）。
6. **本地检查**：`pnpm lint`、`pnpm format:check`、`pnpm build` 通过；
   `pnpm test` 尽量本地执行，若浏览器不可用则如实披露「由 CI `install-lint-build` 作业执行」。
7. **提交流程**：footer 含 `Refs: TASK-039`；显式路径 `git add`（禁 `-A`/`.`）；
   分支推送远端后创建交付请求，描述覆盖模板全部字段。
8. **独立审查**：由**不携带实现上下文的新实例**执行两轮审查（第 1 轮全量、第 2 轮定向），
   审查记录落 `handoffs/`；实现者不得自我批准（I2，受保护）。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 框架资产逐字复制，禁止「顺手优化」框架文本；项目侧适配只发生在项目自己的文件中 |
| 兼容 | `shared/` 的 pnpm 包语义（`@repo/shared`）不得被破坏；`pnpm build:shared` / `--filter server` 行为不变 |
| 安全 | 不引入任何密钥；A7 明文密钥扫描须保持 PASS |
| 流程 | D13-C：合并后回写并入下一个任务交付请求；本任务合并后档案留 `tasks/review/`、`Status = REVIEW` |
| 范围 | 只加不改（project-adoption.md §2）；代码层零改动 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-038（模板仓库建立） | blocks | 已完成（`projects/_workspace-template/` 存在且 Git 干净） |
| TASK-037 归档回写（本地 2 提交） | 随本分支承载（D13-C 豁免） | 已完成待推送 |
| GitHub 分支保护 / CI | external | 已配置（2026-10-14 起，`AGENTS.md` §14.4） |

---

## Acceptance Criteria

- [ ] AC-1: `.agents/`、`templates/` 存在于本仓库且与 `projects/_workspace-template/` 对应目录 `diff -r` 零差异；`shared/scripts`、`shared/tools`、`shared/knowledge` 存在。
- [ ] AC-2: 代码层零改动 —— `git diff origin/main -- src server shared/src shared/package.json package.json pnpm-lock.yaml .github workflows` 为空（唯一例外：`scripts/audit-repo.py` 的 F7 扩展）。
- [ ] AC-3: §Requirements R3 所列六处文档断言全部修正，且 `negative-assertion-review.md` C9 行可执行（`ls .agents templates` + Workspace 模式下 `diff -r` 对模板）。
- [ ] AC-4: `python3 scripts/audit-repo.py` → `PASS=7 FAIL=0`；`python3 shared/scripts/audit_framework.py --root .` → 无 FAIL。
- [ ] AC-5: `pnpm lint` / `pnpm format:check` / `pnpm build` 本地通过；`pnpm test` 本地通过或已如实披露由 CI 执行。
- [ ] AC-6: 分支已推远端；交付请求创建且描述覆盖模板全部字段；CI `install-lint-build` + `audit` 双绿（run id 留痕）。
- [ ] AC-7: 两轮独立审查记录落 `handoffs/`；阻断项关闭且经复核（非仅标记）。
- [ ] AC-8: rebase-merge 合并后 `main` 含 TASK-037 回写与本任务交付；D8 复现（合并后无 docker run）；两个仓库 `git status` 干净。

---

## File Scope

```yaml
File Scope:
  - .agents/**                      # 框架规范（逐字复制，禁止改动）
  - templates/**                    # 框架模板（逐字复制，禁止改动）
  - shared/scripts/**               # 框架脚本（新增，不改 shared/ 既有文件）
  - shared/tools/**
  - shared/knowledge/**
  - shared/README.md                # 新增（模板 shared/ 的说明）
  - AGENTS.md                       # 项目入口：结构/规则/Standalone/规范来源修正
  - README.md                       # 仅末尾追加协作章节
  - docs/agent-collaboration.md
  - docs/operations/github-capability.md
  - docs/operations/agent-constraints.md
  - docs/operations/negative-assertion-review.md
  - scripts/audit-repo.py           # 仅新增 F7
  - tasks/active/TASK-039-adopt-workspace-framework/**
  - tasks/review/TASK-039-adopt-workspace-framework/**
Non-Scope (files):
  - src/**  server/**  shared/src/**  shared/package.json  shared/tsconfig.json
  - package.json  pnpm-lock.yaml  vite.config.ts  .github/**
  - projects/_workspace-template/**   # 模板仓库不由本任务改动
  - E:/NDLDSN-WORKSPACE/.agents/**     # Workspace 根框架源不动
```

---

## Implementation Plan

| # | 步骤 | 产出 |
|---|------|------|
| 1 | 从最新 `main` 派生分支；登记任务档案于 `tasks/active/` | 分支 + TASK.md |
| 2 | 复制 `.agents/`、`templates/`；合并 `shared/{scripts,tools,knowledge}` + `shared/README.md` | 框架资产 |
| 3 | `diff -r` 验证复制零差异；`pnpm build:shared` 冒烟（确认 pnpm 包不受影响） | 验证输出 |
| 4 | 修正六处文档断言（R3） | 文档 diff |
| 5 | `scripts/audit-repo.py` 增加 F7 | 门禁脚本 |
| 6 | 本地全量验证（双审计 + lint + format + build + test） | 原始输出 |
| 7 | 提交（显式路径）→ 回填档案 → 迁 `tasks/review/`（Status=REVIEW + D13-C 标注）→ 推送 → 创建交付请求 | PR |
| 8 | 两轮独立审查 + 整改 | handoffs |
| 9 | rebase-merge + D8 验证 + 收尾 | main |

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 | 命令 | `diff -r .agents ../_workspace-template/.agents && diff -r templates ../_workspace-template/templates`（无输出 = 零差异）；`ls shared/scripts shared/tools shared/knowledge` |
| AC-2 | 命令 | `git diff origin/main --stat -- src server shared/src shared/package.json package.json pnpm-lock.yaml .github`（仅 scripts/audit-repo.py 预期出现） |
| AC-3 | 命令 + 人工 | 逐处读 diff；`grep -rn "不在本仓库内\|Standalone 模式下 \`.agents/\*\* 缺失" AGENTS.md docs/`（应无残留旧表述） |
| AC-4 | 命令 | `python3 scripts/audit-repo.py`；`python3 shared/scripts/audit_framework.py --root .` |
| AC-5 | 命令 | `pnpm lint && pnpm format:check && pnpm build`；`pnpm test` |
| AC-6 | 命令 | `gh pr checks <n>`；run id 记入 handoff |
| AC-7 | 人工 | 读 `handoffs/` 两份审查记录 |
| AC-8 | 命令 | `gh api "repos/huyanluanyuqaq/shadcn-admin/actions/runs?head_sha=<main-sha>"`（total_count=1，仅 CI）；两仓库 `git status --short` |

---

## Current State

> 2026-10-15T23:40Z：任务登记（active/）。分支 `chore/TASK-039-adopt-workspace-framework`
> 已从本地 `main`（`da98560`，含 TASK-037 回写两提交）派生。下一步：复制框架资产。

---

## Changed Files

> 由 Developer 在回填阶段填写。

---

## Known Issues

> 在回填阶段填写。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | 主控位 | 执行位 | 2026-10-15 | 定义 TASK-039，派遣执行位实施（本会话两职串行，审查由新实例承担） |

**最新 Handoff：** `handoffs/HANDOFF-001-coordinator-to-implementer.md`
**Next Action：** 执行位按 Implementation Plan 步骤 2 实施（复制框架资产 → 验证 → 文档修正 → 门禁扩展）

---

## Task Rules

- [覆盖] `git.md` §3（原子提交）：本任务允许「框架资产复制」与「文档断言修正」分为两个提交，
  但两者同属一个逻辑变更（框架接入），不夹带任何其它内容。
- [补充] 所有 Git 提交 footer 必须含 `Refs: TASK-039`；只用显式路径 `git add`（禁 `git add -A` / `.`）。
- [补充] `.agents/` 与 `templates/` 为逐字快照：**禁止**在本任务内修改其任何字符；
  若审查发现框架文本与模板存在差异，以模板为准重新复制，不得手工「修齐」。
- [增强] 独立审查按 I2 执行：实现会话不得出具审查结论；审查实例须实跑验证命令（不只读描述）。

---

## Notes

- `shared/` 同名冲突是本任务最主要的设计决策：模板的 `shared/`（跨项目脚本/工具/知识）与项目的
  `shared/`（pnpm 包 `@repo/shared`，前后端共享类型）同名不同义。选择**合并**而非改名/挪位，
  理由是 `.agents/rules/github.md` §8 与 `.agents/protocols/project-adoption.md` §1
  引用了 `shared/scripts/github_setup_checklist.md` 与 `shared/scripts/create_project.py`，
  挪位会使框架自检 A2（路径引用一致性）失败、并迫使修改框架文本（违反逐字快照原则）。
- 框架快照只读规则落在 `AGENTS.md` §10：项目级覆盖一律用 [覆盖]/[补充]/[增强] 标记表达，
  框架演进走模板仓库交付请求后同步快照（TASK-038 Known Issue「模板同步」依旧适用）。
