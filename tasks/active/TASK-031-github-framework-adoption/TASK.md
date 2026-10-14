# TASK-031 — 在 shadcn-admin 落地双 Agent GitHub 协作框架（阶段 2）

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。
>
> **本 Task 是工作空间级框架落地计划「阶段 2 · 首个项目落地」的执行载体。**
> 设计来源：`.agents/proposals/dual-agent-github-collaboration-design-v1-draft.md` §15 阶段 2。
> 规范来源：`.agents/rules/github.md`、`.agents/protocols/github-collaboration.md`、
> `.agents/protocols/github-capability-matrix.md`（Standalone 模式下这三者不存在，见本文末「Standalone 说明」）。

---

## Meta

```yaml
Task ID: TASK-031
Title: 在 shadcn-admin 落地双 Agent GitHub 协作框架（阶段 2）
Workflow: chore
Status: ACTIVE
Priority: P1
Owner: workbuddy
Owner Since: 2026-10-14
Assigned Role: developer
Created: 2026-10-14T07:00:00Z
Updated: 2026-10-14T07:00:00Z
Branch: chore/TASK-031-github-framework-adoption
Requires Human Approval: false
Platform Config Required: true   # 阶段 3（分支保护 / 必需检查）由用户在网页端完成
```

---

## Objective

把工作空间级「双 Agent GitHub 协作框架」的**文件层落地**到本仓库：
交付描述的载体（PR 模板）、CI 的最小权限与新增审计作业、发布与合并的解耦、
文档体系（协作流程 + Git 工作流 + 平台能力记录）。

**本 Task 只做文件层变更。** 平台侧配置（分支保护、必需检查、`gh` 凭据提权）属阶段 3，
**由用户操作，本 Task 不代做、不声称已完成**。

---

## Requirements

| # | 需求 | 实现载体 |
|---|------|---------|
| R1 | 交付请求模板改为框架模板，字段与层 1（任务文件 + 交接记录）一一对应，**不产生新信息** | `.github/PULL_REQUEST_TEMPLATE.md` |
| R2 | CI 显式声明最小权限 | `.github/workflows/ci.yml` 的 `permissions:` |
| R3 | CI 增加**仓库级框架审计**作业（只读、无网络、结果确定） | `scripts/audit-repo.py` + ci.yml 的 `audit` 作业 |
| R4 | CI 的 Node 版本与本机开发环境对齐 | ci.yml `node-version` |
| R5 | 合并与「对外发布镜像」解耦：不再由 push `main` 触发镜像发布 | `.github/workflows/docker.yml` 改为 tag-only（D8） |
| R6 | 依赖更新有覆盖（供应链） | `.github/dependabot.yml` |
| R7 | 协作流程与 Git 工作流有项目内文档（Standalone 下可用） | `docs/agent-collaboration.md`、`docs/git-workflow.md` |
| R8 | 平台能力与实测结论有**事实记录**（未配置项显式标注） | `docs/operations/github-capability.md` |
| R9 | 项目入口声明必需检查、合并策略、能力记录位置 | `AGENTS.md` §14 |
| R10 | 修正指向上游的失效/误导链接 | `.github/CONTRIBUTING.md`（P-08） |

---

## File Scope

```
Owned (created):
  - .github/dependabot.yml
  - .github/PULL_REQUEST_TEMPLATE.md          （由上游版本替换）
  - scripts/audit-repo.py
  - docs/agent-collaboration.md
  - docs/git-workflow.md
  - docs/operations/github-capability.md
  - tasks/active/TASK-031-github-framework-adoption/**

Owned (modified):
  - .github/workflows/ci.yml
  - .github/workflows/docker.yml
  - .github/CONTRIBUTING.md
  - AGENTS.md

Reused (not modified):
  - src/**、server/**、shared/**、package.json、vite.config.ts、.prettierignore、.prettierrc
```

**明确不新增：** `.github/CODEOWNERS`、`.github/ISSUE_TEMPLATE/**` 的新模板（D1b=甲 下
`approvals=0` 时 CODEOWNERS 无强制力；Issue 不参与状态与审查）。

---

## Design Decisions

| 决策 | 理由 |
|------|------|
| PR 模板**替换**而非新增第二个 | GitHub 只渲染 `.github/PULL_REQUEST_TEMPLATE.md` 这一路径；共存会造成"哪个生效"的歧义 |
| 审计作业放在**仓库内**独立脚本，而非复用工作空间脚本 | 工作空间脚本的扫描范围是 `.agents/`、`templates/`、`shared/` 且**显式排除 `projects/`**；本仓库被独立 clone 后看不到工作空间，门禁必须自持 |
| 审计脚本用 Python（仅标准库）、不使用 YAML 解析 | 与工作空间审计脚本同族，便于日后合并；只做文本/结构断言，避免引入依赖与网络 |
| 审计作业**不**调用 registry / `pnpm audit` | 依赖审计依赖外部网络，作为必需检查会产生不可控噪声；依赖更新由 Dependabot 覆盖（R6）。**此项已如实记为未纳入** |
| **不**把 CI 作业改名为 `verify` | 保持最小变更；必需检查名称以**本仓库实际作业名**为准，并在 `AGENTS.md` §14 与能力记录中声明 |
| `docker.yml` 保留 `workflow_dispatch` | 保留受控的人工发布出口；tag-only 只针对自动触发 |
| `latest` 标签语义**随触发方式改变** | 触发改为 tag-only 后，`:latest` 只在打版本 tag 时更新，不再随 `main` 前进 |
| `stale.yml` 本次**不动** | 属阶段 3 处置项（R7/P-10），且 Issues 当前关闭；本次仅登记为已知遗留 |

---

## Current State

> 2026-10-14 07:00 阶段 2 启动：分支 `chore/TASK-031-github-framework-adoption` 已从 `main`（`05bf884`）派生。
> 2026-10-14 07:10 文件层实施完成，本地全绿（见 `handoffs/2026-10-14-implementation.md`）。
> **待用户创建 PR**（Agent 无法创建：`gh` 身份对本仓库只读），之后自动触发 CI，再进入主控审查。

---

## Verification

| 项 | 结果 |
|----|------|
| `pnpm format:check` | **通过**（All matched files use Prettier code style） |
| `pnpm lint` | **通过**（无输出，exit 0） |
| `pnpm test` | **通过**：25 文件 / **303 例全绿** |
| `pnpm build` | **通过**（✓ built in 30.14s，exit 0） |
| `python scripts/audit-repo.py` | **PASS=6 FAIL=0 WARN=0**（含 4 项受控负向测试，均已按预期失败） |
| YAML 可解析（4 个文件） | **通过**（PyYAML 6.0.3） |
| PR 上 CI（`install-lint-build` + `audit`） | **未执行**：需先创建 PR；`gh` 只读导致 Agent 无法创建 |
| 平台门禁是否生效（V1–V5） | **未实测**：分支保护尚未配置（阶段 3，用户操作） |

原始输出见 `handoffs/2026-10-14-implementation.md` §4。

---

## Known Issues

1. **`gh` 凭据只读**：当前 `gh` 身份对 `huyanluanyuqaq/shadcn-admin` 仅有 `pull` 权限，
   **Agent 无法创建或合并 PR**。需要：① 以 `huyanluanyuqaq` 重新认证 `gh`；或
   ② 在浏览器打开 compare 链接创建 PR。属阶段 3 前置。
2. **平台门禁尚未启用**：分支保护 / 必需检查 / 禁止绕过 **均未配置**。
   因此「禁止直推 `main`」**当前仍是纯文档约定，平台不强制**。
3. **「实现者 ≠ 批准者」无平台强制**：单身份（D1=B）下平台无法区分两个协作位。
4. **依赖审计未纳入 CI**（见 Design Decisions）：Dependabot 只覆盖"有更新时提 PR"，不覆盖 CVE 门禁。
5. **`stale.yml` 未处置**：定时任务可能关闭长期不活跃的 PR（阈值 120 天）。
6. **上游遗留资产未清理**：`ISSUE_TEMPLATE/`、`CODE_OF_CONDUCT.md`、`FUNDING.yml`、`netlify.toml`
   仍为上游内容（D11：保留并在 `AGENTS.md` §14 标注不适用）。
7. **`AGENTS.md` §13.2 的过时断言未修正**：「纯前端，无持久层」自 TASK-001 起已不成立。
   本次**不动**（不在阶段 2 文件清单内，且需先核实真实状态，避免用另一句未经验证的话替换）。
   建议另立小任务；对应框架 §13.4「否定性断言复核」清单。
8. **依赖漏洞审计未纳入 CI**：Dependabot 只覆盖"有更新时提 PR"，不构成 CVE 门禁。
9. **`docs/operations/known-pitfalls.md` 等历史文档未纳入审计链接检查范围**（避免历史死链造成噪声）。

---

## Merge Record

- 待合并后回填：提交范围、PR 号、CI run id、Docker run（本次**预期不触发** docker 发布）。

---

## Standalone 说明

本仓库被单独 `git clone` 后没有工作空间，`.agents/**` 不存在。此时：

- 本 Task 引用的 `design v1-draft`、`github.md`、`github-collaboration.md` 不可读；
- 但 `docs/agent-collaboration.md`、`docs/git-workflow.md`、`docs/operations/github-capability.md`
  是**仓库内自持**的，Standalone 下仍然可读且有效。
