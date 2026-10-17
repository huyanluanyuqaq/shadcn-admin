# TASK-042 — 补齐 CI 后端编译盲区 + 收紧 Docker 发布出口，并以受控 tag 发布 v1.0.1

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-042
Title: CI 增加后端编译门禁 + Docker `:latest` 加 tag 门禁，并受控发布 v1.0.1
Workflow: chore
Status: ACTIVE
Priority: P1
Owner: implementer-devops（执行位实施）
Owner Since: 2026-10-17
Assigned Role: architect（设计，已完成）→ devops（实施）；审查由主控位承担
Created: 2026-10-17
Updated: 2026-10-17
Branch: chore/TASK-042-ci-server-typecheck-and-release-gate
Requires Human Approval: true   # 含对外发布动作（打 tag → DockerHub 推镜像），已获人类授权（2026-10-17）；
                                # 发布 tag 名 v1.0.1 由人类当场裁决（主控位原建议 v2.2.1）
```

> **编号说明：** 001–040 已占用，041 在 `tasks/review/`（代码已合入 `main`）。本任务取 **042**。
>
> **人类授权记录（2026-10-17，本轮指派）：** 授权范围**仅限**本任务 AC-6 与 AC-7 描述的三次
> 平台动作 —— ① 一次 `workflow_dispatch`（门禁实证，副作用仅多一个 `sha-*` 镜像 tag）；
> ② 推送 annotated tag `v1.0.1`；③ 观察其 Docker 构建 run。
> **不包含**任何 `main` 直推、`push --force`、tag 删除或 DockerHub tag 清理。
> 发布动作属高风险（`change-safety.md` §2「生产环境」），执行位须按
> Inspect → Explain → Backup → Approval → Modify → Verify 六步留痕。

---

## Objective

把「对外发布镜像」这条链路从**改造后从未跑过、且无门禁**的状态，变为**有实证、有门禁、可重复**：

1. **CI 增加后端编译检查** —— 消除「CI 全绿但后端根本编译不过」的盲区；
2. **Docker `:latest` 加 tag 门禁** —— 堵住 `workflow_dispatch` 可从任意分支把该分支发布成 `:latest` 的口子；
3. **以受控 tag `v1.0.1` 完成一次真实发布** —— 用一次端到端实跑验证前两项，同时把落后 `main` 80 个提交的镜像补齐。

> **三条是一个整体：** ①② 是修，③ 是验证 ①② 的手段。只做 ①② 不做 ③，则链路仍是未验证状态。

---

## Background

2026-10-17 主控位对 `shadcn-admin` 的 Docker 发布链路做只读核查，实测发现：

| # | 发现 | 证据 |
|---|------|------|
| B1 | `docker.yml` 于 2026-10-14 15:11 改为 **tag-only**（提交 `dc531e6`，TASK-031/D8），此后**零次运行** | `gh run list --workflow docker.yml` 最新一次为 2026-10-13T14:20:54Z（run `38412561363`），早于该提交 |
| B2 | 历史上唯一的 tag 触发成功先例（2026-10-10T03:05:24Z，push tag `v1.0.0`）属于**改造前的旧配置**（`branches:[main]` + `tags:["v*"]` 并存，metadata 还带 `v1`/`v1.0` 浮动标签），**不能作为当前配置可用的证据** | `git show cb59932:.github/workflows/docker.yml` |
| B3 | DockerHub `nomorelatenights/subscription-admin:latest` 停留在 2026-10-13T14:21，对应提交 `05bf884`；`origin/main` 已是 `72d8f28`，**落后 80 个提交**（含 TASK-031~041 全部变更） | DockerHub Tags API + `git log --oneline 05bf884..origin/main` |
| B4 | **后端编译只被 Docker 构建覆盖**：根 `tsc -b` 的 references 只含 `tsconfig.app.json` / `tsconfig.node.json`，**不含 `server/`**；`ci.yml` 只跑 `pnpm build:shared` + `pnpm build`，从不编译 server。唯一编译后端的是 Dockerfile 的 `pnpm --filter server build` —— 即那个 4 天没跑的环节 | 根 `tsconfig.json`、`.github/workflows/ci.yml:46-65`、`Dockerfile` |
| B5 | `type=raw,value=latest` 为**无条件**产出。工作流保留 `workflow_dispatch`，而它允许在 Actions 页面任选分支/tag 手动触发 → 从任意 feature 分支手动触发都会把该分支构建成 `:latest` 推送，**绕过 D8「只有打 tag 才发布」** | `.github/workflows/docker.yml:70-79` |

**版本号口径（人类裁决，2026-10-17）：** 取发布 tag = **`v1.0.1`**，即**延续 DockerHub 上既有的镜像 tag 序列**
（当前最新为 `v1.0.0`，2026-10-10 创建）。主控位原建议 `v2.2.1`（对齐 `package.json` 的 `2.2.1`），
**人类选择延续镜像序列，以人类裁决为准。**

由此产生并**明确接受**的一项事实：本项目存在**两套互不相同的版本号序列** ——
`package.json` / `CHANGELOG.md` 为 `2.2.1`，DockerHub 镜像 tag 为 `v1.0.x`。
二者**不要求一致，也不在本任务内统一**（见 KI-2）。本任务**不 bump `package.json`**、不改 `CHANGELOG.md`。

---

## Scope

- `ci.yml` 的 `install-lint-build` 作业内新增**一个 step**：后端 typecheck（`pnpm typecheck:server`）。
- `docker.yml` 的 metadata-action `tags:` 段为 `:latest` 增加 `enable` 门禁，并同步更新文件头注释。
- 从合并后的 `main` 推送 annotated tag `v1.0.1`，观察并记录 Docker 构建 run 与实际产出的镜像 tag。
- 本任务的 `TASK.md` / `handoffs/` 记录。

## Non-Scope

- **不改任何产品代码**（`src/`、`server/`、`shared/`）。
- **不 bump `package.json` 版本**、不改 `CHANGELOG.md`、不改 `README.md`。
- **不新增 CI job** —— 因此不需要改 `AGENTS.md` §14.1，**不需要动分支保护的必需检查配置**。
- 不动 `Dockerfile`、`docker-compose.yml`、`.dockerignore`。
- 不清理 DockerHub 上遗留的 `v1` 浮动 tag（登记为 Known Issues，另立任务）。
- **不碰 `business-manager`**（人类 2026-10-17 明确「另一个仓库不用管」）。
- 不做多架构之外的构建方式调整（`platforms: linux/amd64,linux/arm64` 保持不变）。

---

## Requirements

1. **R1（后端门禁）** 每次 push `main` / 开 PR 都必须编译后端；后端编译失败必须在合并前暴露。
2. **R2（最小侵入）** 后端门禁以**步骤**形式加入既有作业，不新增 job、不改作业名、不改分支保护配置。
3. **R3（发布门禁）** `:latest` 只能在 ref 为 tag 时推进；`workflow_dispatch` 从分支触发时不得产出 `:latest`。
4. **R4（不误伤）** 门禁不得影响 tag 发布路径：打 tag 时 `:latest`、`vX.Y.Z`、`sha-*` 三个 tag 必须照旧产出。
5. **R5（可追溯）** `type=sha` 行为不变；发布的 tag / run ID / digest / 时间必须落盘。
6. **R6（禁止放水）** 若 `pnpm typecheck:server` 在当前 `main` 上就失败，**不得**通过修改
   `tsconfig.json`、加 `skipLibCheck`、加 `// @ts-nocheck`、注释代码或缩小检查范围来让它变绿。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 不得引入新依赖；不得新增 CI job；复用既有 `pnpm typecheck:server` 脚本（已存在于根 `package.json`） |
| 兼容 | `ci.yml` 两个作业名 `install-lint-build` / `audit` **保持不变**（否则分支保护必需检查永远待处理） |
| 兼容 | `docker.yml` 的 `platforms`、`cache-from/to`、`permissions`、`concurrency` 保持不变 |
| 安全 | 不读取、不打印、不提交任何 secret 值；日志中只允许出现 secret 名 |
| 安全 | metadata-action 的 `enable` **不得使用 `is_tag` 之类的函数**（本仓曾因此失败，提交 `f3c506a`）；只允许 GitHub 上下文表达式 |
| 流程 | 打 tag 与 `workflow_dispatch` 属高风险动作，须逐步留痕，失败即停 |
| 流程 | 合并用 `rebase-merge`（`AGENTS.md` §14.2），禁止直推 `main` |
| 范围 | 超出 File Scope 的改动必须先更新本字段并说明理由 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-041（客户到期时间必填） | blocks（本任务的发布应包含其代码） | ✅ 已合入 `main`（`10fd84e`、`f7453ae` 均为 `origin/main` 祖先） |
| GitHub Secrets `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` | external | ✅ 已配置（2026-10-17 实测在位） |
| DockerHub 仓库 `nomorelatenights/subscription-admin` | external | ✅ 存在（HTTP 200） |
| 分支保护（必需检查 `install-lint-build` + `audit`，enforce_admins） | external | ✅ 已生效（`docs/operations/github-capability.md` §2/§4） |

> 无未满足的 `blocks` 依赖 → 本任务可进入 `ACTIVE`。

---

## Acceptance Criteria

> 每条必须能用「是 / 否」回答，且**必须附原始输出**，不接受「已通过」式陈述。

- [ ] **AC-1（前置阻塞判定）** 在**未做任何修改**的 `main` 上执行 `pnpm typecheck:server`，原始输出贴入手账。
      若失败 → 本任务转 `BLOCKED` 并按五要素上报主控位，**不得**修改 `ci.yml`。
- [ ] **AC-2** `ci.yml` 的 `install-lint-build` 作业内新增后端 typecheck 步骤，命令为 `pnpm typecheck:server`；
      工作流顶层作业名集合**仍为** `install-lint-build` + `audit`（未新增 job）。
- [ ] **AC-3** `python3 scripts/audit-repo.py` 本地运行**全部 PASS**（含 F6 必需检查名一致性）。
- [ ] **AC-4** `docker.yml` 中 `:latest` 带有 `enable=${{ github.ref_type == 'tag' }}`；
      `type=sha,format=short` 与 `type=semver,pattern=v{{version}}` 两行**行为不变**；
      文件头注释已同步说明该门禁的存在与原因。
- [ ] **AC-5** 改动经 PR 合入 `main`（`rebase-merge`），PR 上 `install-lint-build` 与 `audit` 均 success，
      合并后 push 事件上两作业再次 success（附 run ID 与 URL）。
- [ ] **AC-6（门禁实证 · 已授权）** 在 `main` 上执行一次 `workflow_dispatch`，确认：
      ① run 的 metadata 步骤产出的 tags **不含** `latest`、只含 `sha-*`；
      ② DockerHub `latest` 的 digest 与该次运行前**完全一致**（未被被动过）。
      *已记录的副作用：DockerHub 会多一个 `sha-<main-sha>` 镜像 tag，无害。*
      **若 ① 或 ② 不成立 → 立即停止，不得执行 AC-7，上报主控位。**
- [ ] **AC-7（受控发布 · 已授权）** 从合并后的 `main` 打 annotated tag `v1.0.1` 并 `git push origin v1.0.1`；
      docker.yml run `success`；DockerHub 出现 `v1.0.1` tag。
- [ ] **AC-8** DockerHub 上 `v1.0.1` 与 `latest` 的 digest **相同**（证明门禁未误伤 tag 发布路径）。
- [ ] **AC-9** `TASK.md` 的 `Changed Files` / `Known Issues` / `Merge Record` 如实填写；
      handoff 中落盘：tag 名、run ID 与 URL、各镜像 tag 的 digest、UTC 时间戳、`workflow_dispatch` 验证结论。

---

## File Scope

```yaml
File Scope:
  - .github/workflows/ci.yml
  - .github/workflows/docker.yml
  - tasks/backlog/TASK-042-ci-server-typecheck-and-release-gate/**
Non-Scope (files):
  - src/**
  - server/**
  - shared/**
  - package.json            # 不 bump 版本
  - pnpm-lock.yaml
  - pnpm-workspace.yaml
  - tsconfig*.json          # R6 禁止放水
  - AGENTS.md               # 不新增 job ⇒ §14.1 无需改
  - docs/**
  - .agents/**              # 框架快照，项目内只读
  - templates/**
  - Dockerfile
  - docker-compose.yml
  - .dockerignore
  - DockerHub 上的任何 tag    # 本任务不删除/不清理任何远端镜像 tag
```

---

## Implementation Plan

### Phase 1 — 后端编译门禁（AC-1 ~ AC-3）

1. `git switch -c chore/TASK-042-ci-server-typecheck-and-release-gate origin/main`
   （先 `git switch main && git pull --ff-only` 确认基线为 `72d8f28` 或更新）。
2. **不改任何文件**，执行 `pnpm install --frozen-lockfile`（若 `node_modules` 已就绪可跳过）
   → `pnpm build:shared` → `pnpm typecheck:server`，保存原始输出。
   **这是阻塞判定点：失败即转 BLOCKED 上报，不要"顺手修一下后端"。**
3. 修改 `.github/workflows/ci.yml`：在 `Build shared package` 步骤之后、`Lint the code` 之前插入
   `Typecheck server` 步骤（`run: pnpm typecheck:server`），并写清楚**为什么加**的注释
   （根 `tsc -b` 不含 `server/`；此前唯一编译后端的是 Docker 构建，仅在打 tag 时运行）。
   - 放此处的理由：① 依赖上一步已构建的 `@repo/shared` dist；② fail-fast，排在昂贵的 lint/test/build 之前。
4. `python3 scripts/audit-repo.py` 本地跑一遍，确认 F6 仍 PASS。

### Phase 2 — `:latest` 发布门禁（AC-4）

5. 修改 `.github/workflows/docker.yml` 的 `tags:` 段：
   `type=raw,value=latest,enable=${{ github.ref_type == 'tag' }}`，其余两行不动。
6. 同步更新文件头注释块（「推送后的镜像」小节），如实说明 `:latest` 仅在 tag 触发时推进，
   以及为何需要该门禁（`workflow_dispatch` 可从任意分支触发）。
   **注释不得把「已加门禁」写成「已实证」，也不得反向把已生效的配置写成未配置。**

### Phase 3 — 交付与合并（AC-5）

7. 提交（Conventional Commits，`Refs: TASK-042` footer），推送分支，开 PR。
8. PR 描述按 `.github/PULL_REQUEST_TEMPLATE.md` 字段填全；**在 PR 中明确标注本任务含对外发布动作**。
9. 主控位审查（C8：读实际 diff，不读描述）→ PASS 后由主控位执行 `rebase-merge`。
   实现者**不得**自行合并、不得自行批准。

### Phase 4 — 门禁实证（AC-6，已授权）

10. 合并后记录 DockerHub `latest` 的**当前 digest**（作为比对基线）。
11. 在 `main` 上触发一次 `workflow_dispatch`，等 run 结束，读取 metadata 步骤日志中的 tags 列表。
12. 判定：tags 不含 `latest`、`latest` digest 未变 → 通过；否则停止并上报。

### Phase 5 — 受控发布（AC-7 / AC-8，已授权）

13. `git fetch origin && git switch main && git pull --ff-only`，确认 HEAD = 合并后的 main。
14. `git tag -a v1.0.1 -m "release: v1.0.1 —— 延续镜像 tag 序列（上一版 v1.0.0）。含 TASK-031~041 全部变更；本版起 CI 增加后端编译门禁、Docker :latest 增加 tag 门禁。镜像 tag 序列与 package.json 版本（2.2.1）为两套独立口径，见 TASK.md KI-2。"`
15. `git push origin v1.0.1`
16. 盯 run 至结束；记录 run ID / URL / conclusion / 实际产出的三个 tag / 各自 digest。
17. 比对 `v1.0.1` 与 `latest` 的 digest 是否一致。

### Phase 6 — 记录归档（AC-9）

18. 回填 `TASK.md`（`Changed Files` / `Known Issues` / `Current State` / `Merge Record`），
    写 handoff，Status 转 `REVIEW` 并移入 `tasks/review/`。

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|-------------|
| AC-1 | 本地命令 | `pnpm build:shared && pnpm typecheck:server`（原始输出全量贴入 handoff） |
| AC-2 | 文件比对 | `git diff origin/main -- .github/workflows/ci.yml`；`python3 -c "import yaml;d=yaml.safe_load(open('.github/workflows/ci.yml',encoding='utf-8'));print(list(d['jobs']))"` → 应为 `['install-lint-build','audit']` |
| AC-3 | 本地命令 | `python3 scripts/audit-repo.py` |
| AC-4 | 文件比对 | `git diff origin/main -- .github/workflows/docker.yml` |
| AC-5 | 平台查询 | `gh run list --repo huyanluanyuqaq/shadcn-admin --branch main --limit 5` + `gh pr view <n> --json statusCheckRollup` |
| AC-6 | 平台查询 | `gh run view <dispatch-run-id> --log \| grep -i "latest\|sha-"`；`curl -s "https://hub.docker.com/v2/repositories/nomorelatenights/subscription-admin/tags/latest" \| python -c "import json,sys;print(json.load(sys.stdin)['digest'])"` |
| AC-7 | 平台查询 | `gh run list --workflow docker.yml --limit 3`；`curl -s -o /dev/null -w "%{http_code}" "https://hub.docker.com/v2/repositories/nomorelatenights/subscription-admin/tags/v1.0.1"` → 200 |
| AC-8 | 平台查询 | 分别取 `v1.0.1` 与 `latest` 的 `digest` 字段，字符串比对 |
| AC-9 | 文件审阅 | 主控位读 `TASK.md` + handoff 实际内容 |

---

## Current State

**ACTIVE（active/）—— Phase 1–2 已实施完毕并开 PR；等待主控位审查与 `rebase-merge`。**

已完成：

- **AC-1** 阻塞判定点：在 `origin/main`（`72d8f28`）未修改任何文件的前提下执行
  `pnpm build:shared` 与 `pnpm typecheck:server`，**均退出码 0**。原始输出见
  `artifacts/ac1-build-shared.txt` / `artifacts/ac1-typecheck-server.txt`
  （`pnpm install --frozen-lockfile` 见 `artifacts/ac1-install.txt`）。
  ⇒ **未触发 R6，未修改任何 `tsconfig*` / `server/` / `shared/` 文件。**
- **AC-2** `ci.yml` 的 `install-lint-build` 作业内、`Build shared package` 之后新增
  `Typecheck server` 步骤（`run: pnpm typecheck:server`）。作业名集合仍为
  `['install-lint-build', 'audit']`（`yaml.safe_load` 实测）。
- **AC-3** `python3 scripts/audit-repo.py` 修改后复跑，`PASS=7 FAIL=0 WARN=0`，退出码 0
  （`artifacts/ac3-audit-p2.txt`；修改前基线见 `artifacts/ac1-audit.txt`）。
- **AC-4** `docker.yml` 的 `:latest` 行改为
  `type=raw,value=latest,enable=${{ github.ref_type == 'tag' }}`；
  `type=sha,format=short` 与 `type=semver,pattern=v{{version}}` 两行未动；
  文件头「推送后的镜像」小节已同步说明该门禁。

待主控位合并后执行：AC-5（合并与合并后 CI）、AC-6（门禁实证，已授权）、AC-7/AC-8
（受控发布 `v1.0.1`，已授权）、AC-9（本文件回填 + HANDOFF-002）。

---

## Changed Files

> 由 Developer 在执行中维护。

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `.github/workflows/ci.yml` | 修改 | `install-lint-build` 作业内、`Build shared package` 之后新增 `Typecheck server` 步骤（`run: pnpm typecheck:server`）及说明注释。**未新增 job**，作业名集合不变。 |
| `.github/workflows/docker.yml` | 修改 | `:latest` 行增加 `enable=${{ github.ref_type == 'tag' }}` 门禁；文件头「推送后的镜像」小节同步说明。`type=sha,format=short` / `type=semver,pattern=v{{version}}` 两行未动。 |
| `tasks/active/TASK-042-ci-server-typecheck-and-release-gate/**` | 新增/修改 | 任务档案；`artifacts/` 实证留档（AC-1 前置输出、AC-3 审计输出，含命令/退出码/UTC 时间头）；`handoffs/` 交接记录。 |
| _（Phase 4–6 待回填：tag / run ID / digest 记录）_ | | |

---

## Known Issues

> 执行中发现的已知问题。**无则写"无"。**

- **KI-1（继承，不在本任务范围）** DockerHub 遗留 `v1` 浮动 tag（2026-10-10 旧配置产物，HTTP 200），
  当前配置已不再产生。建议另立任务清理。
- **KI-2（口径不一致，人类已裁决接受）** 本项目存在**两套版本号序列**：`package.json` / `CHANGELOG.md`
  为 `2.2.1`，DockerHub 镜像 tag 为 `v1.0.x`。人类 2026-10-17 裁决**延续镜像序列**（取 `v1.0.1`），
  故本任务**不 bump `package.json`**、不改 `CHANGELOG.md`。两套口径是否统一、何时统一，需另立任务。
- **KI-3（结构性）** `docker.yml` 仍保留 `workflow_dispatch` 出口。本任务只是给 `:latest` 加了门禁，
  **并未移除该出口** —— 手动触发仍会推送一个 `sha-*` 镜像。若要彻底取消人工触发，需另立任务裁决。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | coordinator（主控位） | implementer（执行位） | 2026-10-17 | 任务登记 + 设计方案 + 三次平台动作的人类授权范围 |

**最新 Handoff：** `handoffs/HANDOFF-001-coordinator-to-implementer.md`
**Next Action：** **（已过期，保留以备追溯）** 原为「领取任务并从 `origin/main` 建分支后执行
阻塞判定」。该动作**已完成**：任务已于 `tasks/active/`，分支
`chore/TASK-042-ci-server-typecheck-and-release-gate` 已建，
AC-1 阻塞判定已通过（`artifacts/ac1-*.txt`）。
**当前 Next Action（交主控位）：** 审查 PR
[huyanluanyuqaq/shadcn-admin#14](https://github.com/huyanluanyuqaq/shadcn-admin/pull/14)
的实际 diff（C8：读 diff 不读描述）→ PASS 后由主控位执行 `rebase-merge`。
**执行位不得自行合并。**

---

## Task Rules

> 本任务特有的规则覆盖。

- [补充] **打 tag 与 `workflow_dispatch` 属受保护的高风险动作**，仅限 AC-6 / AC-7 描述的范围，
  已获人类 2026-10-17 授权；**任何超出该范围的高风险动作（删 tag、force push、改分支保护、
  清理 registry）都必须重新向人类申请**。
- [增强] **实现者 ≠ 批准者**：执行位完成实施后**不得**自行合并 PR、不得自行判定 PASS；
  审查由主控位读实际 diff 后给出。
- [增强] **禁止放水**（R6）：不得以任何方式弱化后端类型检查来使 CI 变绿。
- [补充] 本任务**不写 ADR**：改动限于 CI/发布配置，不涉及架构或对外接口契约；
  设计理由以本文件 `Background` + `ci.yml` / `docker.yml` 的行内注释为单一事实来源。

---

## Notes

**给执行位的三条实操提醒：**

1. **`ci.yml` 的 `pnpm install` 用 `npm install -g pnpm@12.10.1` 锁版本**，别顺手改成别的版本
   （注释里写了原因：pnpm 12 起不再读 `package.json` 的 `pnpm` 字段，`allowBuilds` 必须在
   `pnpm-workspace.yaml`）。
2. **`.github/workflows/` 不在 `.prettierignore` 的允许清单内**，所以 `pnpm format:check`
   **不会**检查工作流文件 —— 但仍应保持与周边一致的缩进和注释风格。
3. **tag 推送走 SSH**（`gh` 显示 Git 协议为 ssh）。若推送被沙箱拦截，**不要反复重试**，
   按五要素上报，由人类决定是否放行。
