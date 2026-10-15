# 否定性断言复核清单（Negative Assertion Review）

> **目的：** 让文档中的「否定性 / 绝对性断言」（「无 X」「不包含 Y」「不使用 Z」「纯 W」）
> 有一份**可执行、可交接**的周期性复核机制，而不是依赖好记性。
>
> **来源：** TASK-032（`tasks/review/TASK-032-fix-stale-assertions/`，2026-10-15 首次全量复核）。
> **权威口径：** `AGENTS.md` §13 / §14 与本文清单不一致时，以**代码实测**为准，并同步修正本清单。

---

## 1. 为什么需要这份清单

否定性断言是文档里**最难自证**的一类陈述：它断言某物**不存在**，
而随着代码演进，**最先腐坏的就是这类句子**。两个已实证的漂移实例：

| 实例 | 漂移内容 | 发现途径 |
| --- | --- | --- |
| 平台侧（TASK-031） | `has_issues` 记为 `false`，实测为 `true` | 阶段 1 记录 vs 阶段 3 实测 |
| 代码侧（TASK-032） | 「纯前端，无持久层」「mock 来自 faker」「存在两套认证路由」等 5 处 | 本清单首次全量复核 |

**正确范式（已被验证、无需修改）：** `docs/architecture/overview.md` 文件头对 §1 的声明 ——
「§1『现状与差距』为接入时的**基线快照**，保留作历史记录，**不代表当前状态**」。
历史陈述 + 显式声明 = 不会误导；**没有声明的历史陈述**才会腐坏成失真。

**由此得出两条规则：**

1. **改写现状断言时，要么给当前事实，要么显式声明为历史快照** —— 不允许中间态。
2. **每条现状断言都必须附可复核命令** —— 没有命令的断言等于没有断言（只是愿望）。

---

## 2. 断言清单（当前状态 · 逐条可复核）

> 责任位约定：**执行位**在改动触及对应区域时按行内命令复核（Definition of Done 的一部分）；
> **主控位**在阶段归档或每 10 个任务时指派一次全量复核；**平台侧断言**（P1 / P2）按
> `github-capability.md` §8 的命令复核，**引用前必须重测**。

| # | 位置 | 断言（当前表述） | 复核命令 | 责任位 | 上次复核 |
| --- | --- | --- | --- | --- | --- |
| C1 | `AGENTS.md` §3 表 / §13.2 | 后端/数据库/认证/容器化四行均为「已建设」；数据持久化（刷新不丢） | `ls server/src/index.ts server/drizzle/*.sql Dockerfile docker-compose.yml` | 执行位 | 2026-10-15 |
| C2 | `AGENTS.md` §3 表 | 依赖版本（TS ~6.0 / React 19.2 / Vite 8 / Router 1.168 / Query 5.99 / axios 1.15 / Table 8.21 / Recharts 3.8 / rhf 7 / zod 4 / zustand 5 / Tailwind 4.2） | `grep -E '"(typescript\|react\|vite\|@tanstack/react-router\|@tanstack/react-query\|axios\|@tanstack/react-table\|recharts\|react-hook-form\|zod\|zustand\|tailwindcss)"' package.json` | 执行位 | 2026-10-15 |
| C3 | `AGENTS.md` §3 表 | `src/components/ui/` 有 30 个组件 | `ls src/components/ui/ \| wc -l` | 执行位 | 2026-10-15 |
| C4 | `AGENTS.md` §4 树 | `README.md` 为上游原文（未改动） | `git log --oneline -1 --format='%an %ad' -- README.md`（作者应为上游、日期早于接入；防误读注见 §4 树内） | 执行位 | 2026-10-15 |
| C5 | `AGENTS.md` §4 树 | `netlify.toml` 为上游遗留、已被 docker compose 取代 | `ls netlify.toml docker-compose.yml` | 执行位 | 2026-10-15 |
| C6 | `AGENTS.md` §4 / §10 | `data/` 仅存于 customers / notifications / subscriptions 且**不含 mock 数据**（仅 `schema.ts` + 其测试）；`@faker-js/faker` 与 `data.ts` 零残留 | `ls src/features/*/data/`；`grep -rn faker package.json server/package.json shared/package.json`；`grep -rln faker src/`（后两者空 = 成立） | 执行位 | 2026-10-15 |
| C7 | `AGENTS.md` §6 | 测试范例指向 `features/customers/`（原 `features/users/` 已不存在） | `ls src/features/customers/components/*.test.tsx` | 执行位 | 2026-10-15 |
| C8 | `AGENTS.md` §9 表 | `docs/operations/` 含 `agent-constraints.md` / `github-capability.md` / `negative-assertion-review.md`；`agent-collaboration.md` / `git-workflow.md` 存在 | `ls docs/operations/*.md docs/agent-collaboration.md docs/git-workflow.md` | 执行位 | 2026-10-15 |
| C9 | `AGENTS.md` §12 | Standalone 模式下 `.agents/**` 缺失 | `ls .agents 2>/dev/null`（**双态断言**：Workspace 模式下项目内本无 `.agents/`，按所在模式判定） | 执行位 | 2026-10-15 |
| C10 | `AGENTS.md` §13.1 | `projects/business-manager` 为 Tailwind 3.4 | `grep '"tailwindcss"' ../business-manager/src/client/package.json` | architect | 2026-10-15 |
| C11 | `AGENTS.md` §13.6 | better-sqlite3 限定 `^12.4.1`（v13 起无预编译） | `grep better-sqlite3 server/package.json` | 执行位 | 2026-10-15 |
| C12 | `AGENTS.md` §14.1 | 必需检查表与工作流作业名一致 | `python scripts/audit-repo.py`（F6） | 执行位 | 2026-10-15 |
| C13 | `AGENTS.md` §14.5 | 不设 `.github/CODEOWNERS` | `ls .github/CODEOWNERS 2>/dev/null`（有输出即为失真） | 执行位 | 2026-10-15 |
| C14 | `AGENTS.md` §14.6 | `stale.yml` 已处置：无 schedule 触发器、PR 侧 `-1` 禁用、最小权限、**无任何无人值守自动运行** | `grep -c "schedule:" .github/workflows/stale.yml`（应为 0）+ `grep "days-before-pr-stale" .github/workflows/stale.yml`（应为 -1） | 执行位 | 2026-10-15 |
| C15 | `AGENTS.md` §14.6 | 上游遗留资产存在：`.github/ISSUE_TEMPLATE/`、`.github/CODE_OF_CONDUCT.md`、`.github/FUNDING.yml`、根 `netlify.toml`；`.github/CODEOWNERS` 不存在 | `ls .github/ISSUE_TEMPLATE .github/CODE_OF_CONDUCT.md .github/FUNDING.yml netlify.toml` + `ls .github/CODEOWNERS 2>&1`（后者应不存在） | 执行位 | 2026-10-15 |
| P1 | `AGENTS.md` §14.4 | 分支保护已配置（经典保护、enforce_admins、approvals=0） | `gh api repos/huyanluanyuqaq/shadcn-admin/branches/main/protection` | 主控位 | 2026-10-15 |
| P2 | `docs/operations/github-capability.md` | 平台事实全表（含漂移表） | 按该文档 §8 的复核命令逐条重测 | 主控位 | 2026-10-15 |
| H1 | `docs/architecture/overview.md` §1 | 「现状与差距」为接入时基线快照（历史声明） | `sed -n '1,6p' docs/architecture/overview.md`（声明必须在场） | architect | 2026-10-15 |
| H2 | `docs/decisions/ADR-001/002` 背景节 | 「纯前端 / faker / Clerk / 两套认证路由」为**决策时点**状态 | `sed -n '15,25p' docs/decisions/ADR-001-backend-stack.md` 等（历史记录，禁止改为现状） | architect | 2026-10-15 |
| H3 | `docs/decisions/ADR-003` | 镜像内不含 mihomo 二进制 | `grep -c mihomo Dockerfile`（应为 0） | architect | 2026-10-15 |

**编号含义：** C = 代码侧现状断言；P = 平台侧断言；H = 历史快照类（声明必须在场、内容不得改）。

---

## 3. 首次全量复核记录（2026-10-15 · TASK-032）

**范围：** `AGENTS.md`、`README.md`、`docs/**` 全部否定性 / 绝对性表述。
**结论：6 处修正（5 处过时改写 + 1 处同类失真）+ 1 处误判回退；§2 清单共 20 条断言（17 条现状 + 3 条历史快照类），其余全部判定成立（逐条见 §3.2）。**

> **★ 误判回退记录（本任务的自我教训）：** §3.1 第 6 行「上游资产从未存在」实为**路径错误导致的误判**
> —— 资产位于 `.github/` 下，而复核命令查的是仓库根路径，空结果被当成了「不存在」的证据。
> 由独立审查（O1）拦下并回退。**坏命令会给坏结论永久盖章**，这正是本清单要防的失真形态。

### 3.1 已修正（TASK-032 交付）

| # | 位置 | 原表述 | 修正为 | 依据 |
| --- | --- | --- | --- | --- |
| 1 | `AGENTS.md` §13.2 | 「纯前端，无持久层：当前所有数据为 faker mock，刷新即变」 | 持久层已落地（Hono + SQLite + Drizzle）；「功能已完成」的判定标准改为端到端可用 | `server/` + 11 个迁移 + §3 已登记 |
| 2 | `AGENTS.md` §10 | 「mock 数据当前来自 @faker-js/faker…接后端后必须改为 TanStack Query」 | 迁移已完成；新模块数据源必须是真实 API，不得 reintroduce mock | `package.json` 无 faker；`src/` 零引用 |
| 3 | `AGENTS.md` §4 目录说明 | 「每个模块含 data/（schema.ts + data.ts mock）」 | data/ 仅存于 3 个模块且只含 schema.ts | `ls src/features/*/data/` |
| 4 | `AGENTS.md` §13.3 | 「src/routes/clerk/ 与 features/auth/ 存在两套认证路由，迁移时需一并处理」 | Clerk 已移除（TASK-002 / ADR-002），认证统一为自建 JWT；遗留死资产登记见 §4 | `ls src/routes/` 无 clerk/ |
| 5 | `AGENTS.md` §14.6 | 「stale.yml 属待处置项」 | 已处置（TASK-033）：无 schedule、PR 侧 -1、最小权限 | `stale.yml` 文件头 + `github-capability.md` §7 |
| 6 | `AGENTS.md` §14.6 | 「ISSUE_TEMPLATE/、CODE_OF_CONDUCT.md、FUNDING.yml 为上游内容，保留」 | ~~三者从未存在，从清单移除~~ → **误判，已回退**：三者实际存在于 `.github/` 下、由上游引入（`7e80b2e`），原表述属实；恢复原清单并补 `.github/` 前缀（审查 O1 拦下） | `git ls-files .github/` + `git log --diff-filter=A -- .github/ISSUE_TEMPLATE .github/CODE_OF_CONDUCT.md .github/FUNDING.yml` |
| 7 | `AGENTS.md` §6 | 「参照 features/users/ 现有测试」 | 改指 `features/customers/`（users/ 不存在） | `ls src/features/` |

### 3.2 判定成立（未改）

- `AGENTS.md` §13.1（business-manager Tailwind 3.4）、§3 全表版本与组件数、
  §4 README/netlify.toml、§13.6（better-sqlite3）、§14.1（F6 审计 PASS）、§14.5（无 CODEOWNERS）、
  §14.6 上游资产清单（`.github/ISSUE_TEMPLATE/` 等 + `netlify.toml`；本次误判已回退，见 §3.1 第 6 行）。
- `README.md`：**刻意保留的上游原文**（§4 已声明「未改动」），其中 Auth/Clerk/Sponsor
  表述描述**上游项目状态** —— 不在本任务改写（改即破坏「上游原文」属性），
  已在 `AGENTS.md` §4 该行加**防误读注**。
- `docs/architecture/overview.md` §1：历史快照 + 显式声明（§1 规则 1 的范式）。
- `docs/decisions/ADR-001/002/003`：决策时点状态与设计 rationale，历史记录。
- `docs/technical/api-contract.md`：schema 级唯一性 / 404 语义，与迁移一致。
- `docs/operations/github-capability.md`、`known-pitfalls.md`：平台事实与事件记录，各有复核机制。

---

## 4. 附带发现登记（非否定性断言 · 同类问题 / 死代码候选）

| # | 发现 | 性质 | 处置 |
| --- | --- | --- | --- |
| D1 | `src/assets/clerk-full-logo.tsx`、`src/assets/clerk-logo.tsx` 零引用（Clerk 迁移遗留死代码） | 死代码 | **登记待后续任务清理** —— `src/**` 在 TASK-032 的 Non-Scope。复核命令：`grep -rln clerk src/ --include='*.tsx' --include='*.ts' \| grep -v assets`（空 = 仍无引用） |
| D2 | `.workbuddy/`（历次 PR 临时文件）未被 `.gitignore` 覆盖且未入库 | 卫生 | 提交一律用**显式路径**，不 `git add -A`；是否纳入 `.gitignore` 由主控位另行裁决（不在 TASK-032 范围） |

---

## 5. 复核规程

1. **例行触发（执行位）：** 任何任务改动了 `src/**`、`server/**`、`shared/**`、`package.json`、
   `.github/**`、`docs/**` 或平台设置后，按 §2 中对应行**执行复核命令**，
   发现不一致 → 当场修正文档（或登记为遗留，**不得默默跳过**）。
2. **周期全量（主控位）：** 阶段归档时或每 10 个任务，指派一次 §2 全表复核；
   每次复核后更新「上次复核」列。
3. **平台侧（P1/P2）：** 引用前必须重测（平台配置不在版本历史内，已两次实证漂移）。
4. **记录：** 复核结论写入当次任务的 `handoffs/`；本清单的修订随任务交付请求合入。
5. **新增断言：** 任何人向 `AGENTS.md` / `docs/**` 写入新的否定性 / 绝对性断言时，
   **必须同时在 §2 登记一行**（位置 + 命令 + 责任位）—— 未登记的断言视为未验证。

---

*本文档由 TASK-032 建立（2026-10-15）。修改本文档须走交付请求（`AGENTS.md` §14）。*
