# TASK-045 — Docker 流水线四项加固：合并即构建（甲方案）+ pnpm 版本统一 + 推送重试 + 本地脚本

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-045
Title: 合并即构建（甲方案）+ pnpm 版本统一 + 推送重试 + 本地构建脚本
Workflow: chore
Status: REVIEW
Priority: P1
Owner: 执行位（实施已完成）→ 主控位（待审查）
Owner Since: 2026-10-17
Assigned Role: coordinator（设计，已完成）→ devops（实施，已完成）；审查由主控位承担
Created: 2026-10-17
Updated: 2026-10-17
Branch: chore/TASK-045-docker-pipeline-hardening
Requires Human Approval: true   # 含 CI/发布配置变更；且「合并即构建」改变 D8 的触发面，
                                # 人类已于 2026-10-17 23:4x 选定「甲方案」
```

> **编号说明：** 001–044 已占用；TASK-044 仍留 `tasks/review/`（待第十二实例回写），本任务取 **045**。

---

## Objective

加固 Docker 镜像流水线，使其**每次合并都能自动产出可追溯的镜像**，并消除三个已实测确认的工程债：

1. **合并即构建（甲方案）** —— `docker.yml` 增加 `push: branches: [main]`，
   每次合并 `main` 自动构建并推送 **`sha-*` 镜像**；
   **`:latest` 与版本号标签仍只在打版本 tag 时前进**（TASK-042 的门禁**原样保留，不得削弱**）；
2. **pnpm 版本统一** —— 消除 `Dockerfile`(10.29.3) 与 `ci.yml`(12.10.1) 的**大版本漂移**；
3. **推送失败重试** —— 给 build-and-push 加**退避重试**与可诊断日志；
4. **本地构建脚本** —— 提供本地与 CI **共用同一套参数**的入口，消除本地/CI 漂移。

---

## Background

主控位 2026-10-17 23:2x 对镜像流水线做**只读全量核查**（用户要求「实现镜像自动构建推送」，
实测发现 TASK-042 已实现 90%+，故定位为**加固而非重建**）。

### 4.1 已具备，**不得重做**（实测确认）

| 项 | 现状 |
|----|------|
| `Dockerfile` | 四阶段多阶段构建：`base` → `deps` → `build` → `runner` |
| 基础镜像选型 | **Debian slim 而非 Alpine**，理由已写入文件头注释（better-sqlite3 预编译基于 glibc，musl 会退化为源码编译） |
| 依赖管理 | pnpm workspace（`server` + `shared`），`--frozen-lockfile` |
| 启动方式 | `node server/dist/db/migrate.js && node server/dist/index.js`（**启动先迁移**） |
| 标签命名 | `latest`（**仅 tag 触发**）、`sha-<short>`、semver 精确版 |
| 多架构 | `linux/amd64,linux/arm64` |
| **认证** | ✅ `secrets.DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`，**实测两 secret 在位**；**无凭据入库** |
| 缓存 | `cache-from: type=gha` / `cache-to: type=gha,mode=max` |
| 并发 | `group: docker-${{ github.ref }}` + `cancel-in-progress: true` |
| `.dockerignore` | 完备 |

### 4.2 本任务要修的四个缺口（**均实测确认**）

| # | 缺口 | 实测证据 |
|---|------|---------|
| G1 | **无法「合并即构建」** | `docker.yml:39-41` 仅 `tags: ["v*"]`，`main` 推送不触发 |
| G2 | **pnpm 大版本漂移** | `Dockerfile` corepack = **10.29.3**；`ci.yml` = **12.10.1**；本机 = **10.29.3**。<br>`pnpm-workspace.yaml` 注释已记载 pnpm 11+ 移除 `onlyBuiltDependencies` 列表语法 → 换用 `allowBuilds` |
| G3 | **无任何重试** | `grep retry\|timeout-minutes\|max-attempts` → **零命中**。多架构经 QEMU 模拟耗时长，DockerHub 网络抖动即整条流水线红 |
| G4 | **无本地构建入口** | 无 `Makefile` / `Taskfile.yml` / `justfile`；`package.json` **无 `docker:*` 脚本** ⇒ 本地只能用裸 `docker build`，与 CI 的 buildx/多架构/缓存参数易漂移 |

### 4.3 「合并即构建」的技术前提（实测确认，方案成立）

- **合并确实产生 `event=push`**：2026-10-17 四次合并（`09:13` / `12:22` / `12:24` / `15:04`）
  均触发 CI `push` 事件 ⇒ 增加 `branches: [main]` 即可让 `docker.yml` 被合并触发。
- **D8 的语义变化（人类已知悉并选定）**：D8 原为「普通合并不产生对外可见镜像」。
  本任务后**部分放弃**该约束：合并**会**产出 `sha-*` 镜像（对外可见于 DockerHub）。
  但 **`latest` 与版本号仍不随合并前进** ⇒ **「合并不等于发布」的核心保护完整保留**。

### 4.4 已明确排除的方案（乙方案 · 人类已否决）

人类曾问「合并后自动打 tag」，主控位实测结论：**不可行**，除非引入 PAT ——
Actions 运行时只有 `GITHUB_TOKEN`，且 **`GITHUB_TOKEN` 产生的推送不触发新 workflow run**
（GitHub 内置递归防护）⇒ 无法「合并 → 自动打 tag → 构建」串联。
人类于 23:4x 选定**甲方案**：合并即构建，tag 仍由人工打。

⇒ **本任务不得实现任何自动打 tag 的逻辑。**

---

## Scope

- `.github/workflows/docker.yml`：新增 `branches: [main]` 触发；文件头注释同步说明；
  build-and-push 加重试与诊断日志。
- `Dockerfile`：corepack pnpm 版本与 CI 对齐。
- `scripts/docker-build.sh`（新增）：本地构建入口，**参数与 CI 保持一致**。
- `docs/operations/docker-release.md`（新增）：触发方式、标签规则、失败排查、配置项说明。
- TASK-044 的 D13-C 第十二实例回写与归档（捎带）。
- 本任务自身的 `TASK.md` / `handoffs/` 记录。

## Non-Scope

- ❌ **不实现自动打 tag**（已否决，见 §4.4）。
- ❌ **不新增任何 secret / PAT**。
- ❌ **不削弱 `:latest` 门禁** —— `enable=${{ github.ref_type == 'tag' }}` **原样保留**。
- ❌ **不改** `docker-compose.yml`、`.dockerignore`、数据库迁移逻辑。
- ❌ **不改** CI 门禁的**作业名**（`install-lint-build` / `audit`，否则分支保护必需检查永挂）。
- ❌ **不 bump `package.json` 版本**、不改 `CHANGELOG.md`。
- ❌ **不改** `.agents/**`、`templates/**`（框架快照只读）。
- ❌ **不 bump 镜像 tag、不触发实际发布** —— 本任务**不产生任何 DockerHub 副作用**。
- ❌ **不引入 Makefile / Taskfile / justfile** —— 只加一个 shell 脚本，避免为解决一个问题引入一个新工具。

---

## Requirements

1. **R1（合并即构建）** `docker.yml` 的 `on.push` 须**同时**包含：
   ```yaml
   branches: ["main"]
   tags: ["v*"]
   ```
   ⚠️ **GitHub Actions 中 `branches` 与 `tags` 并列时为「或」关系** —— 执行位须在 PR 描述中
   **实跑验证**两类事件均能触发（见 AC-2），**不得**只改配置就宣称达成。

2. **R2（`:latest` 门禁零削弱）** `type=raw,value=latest,enable=${{ github.ref_type == 'tag' }}`
   **一个字符都不许改**。验收以 `git diff` 该行**输出为空**为准。

3. **R3（pnpm 版本统一）** `Dockerfile` 的 corepack pnpm 版本**改为与 `ci.yml` 一致**
   （目标：`12.10.1`）。⚠️ 改后须实测 `pnpm install --frozen-lockfile` 仍成功 ——
   若 pnpm 12 下 `pnpm-workspace.yaml` 的 `allowBuilds` 写法不兼容，
   **停止上报**，**不得**擅自改 `pnpm-workspace.yaml`（那属另一议题）。

4. **R4（重试）** build-and-push 须具备**失败重试**能力：
   - 至少 **2 次**重试（总尝试 ≥3）；
   - **退避间隔递增**（避免连续撞同一故障）；
   - 重试次数与每次结果**打印到日志**（便于事后判断是网络抖动还是真失败）。

5. **R5（日志可诊断）** 失败时日志须能区分：
   **构建失败**（编译错误）vs **推送失败**（网络/认证）——
   至少在重试耗尽后输出**失败阶段的明确标识**与最后的错误摘要。

6. **R6（本地脚本与 CI 同参）** `scripts/docker-build.sh` 须与 `docker.yml` 使用
   **相同的 `platforms`** 与 **`cache` 语义**；支持 `--push` 开关（默认**只构建不推送**，防误推）。

7. **R7（凭据零入库）** 本地脚本的推送凭据**只从环境变量读取**
   （`DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`），**不得**：
   写入文件、设默认值、打印到日志、或出现在 PR 描述中。

8. **R8（TASK-044 回写）** 按 D13-C **第十二实例**回写 TASK-044 的 `Merge Record`
   （PR #19 / `a978337` / 1 提交 / CI `39043427578`），`Status → DONE`，迁 `tasks/done/`。

9. **R9（文档）** `docs/operations/docker-release.md` 须覆盖：
   两种触发方式、标签规则、**`:latest` 为何不随合并前进**、失败排查步骤、
   配置项（secrets 名称、本地环境变量）、重试行为。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 平台 | `docker.yml` 单次构建为**多架构**（经 QEMU），耗时较长 ⇒ 验收时**须等足时间**，不得因超时误判为失败 |
| 环境 | **本机无 Docker**（实测 `docker: command not found`）⇒ 本地构建**无法实跑验证**，只能静态核查 + 依赖 CI 实跑 |
| 流程 | 合并用 `rebase-merge`，**禁止直推 `main`** |
| 流程 | 只用**显式路径** `git add`（禁 `git add -A` / `git add .`） |
| 安全 | 不读取、不打印、不提交任何 secret 值；日志中只允许出现 secret **名** |
| 范围 | 超出 File Scope 的改动须先更新本字段并说明理由 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| 基线 `a978337` | blocks | ✅ `main` = `origin/main` = `a978337`，工作区干净，**无待合并 PR** |
| Secret `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` | external | ✅ 实测在位（`gh secret list` 仅列名） |
| QEMU 多架构 | external | ✅ 已在 `docker.yml` 配置 |

> 无未满足的 `blocks` 依赖 → 可进入 `ACTIVE`。

---

## Acceptance Criteria

> 每条必须能用「是 / 否」回答。执行位已填本地可验证项；AC-2 / AC-7 / AC-12 依赖 PR / 合并后平台行为，
> 已如实标注边界（见 KI-1 / KI-2），主控位合并前复验。逐条证据另见 HANDOFF-002 与「Current State」。

- [x] **AC-1（前置基线）** `main` = `origin/main` = `a978337`；工作区干净；无待合并 PR。
- [x] **AC-2（R1 实证 · 关键）** `docker.yml` 同时含 `branches: ["main"]` 与 `tags: ["v*"]`；
      且在 **PR 描述中实跑证据**表明两类事件均可触发
      （**`workflow_dispatch` 实跑一次 + 说明 PR 合并后将由 main push 触发**；
      ⚠️ 不得以「未合并的 PR 无法验证」为由跳过，须如实说明并给出配置层面的论证 + 后续验证方式）。
- [x] **AC-3（R2 零削弱）** `git diff` 中 `:latest` 那一行**输出为空**（未改）。
- [x] **AC-4（R3 pnpm 对齐）** `Dockerfile` 的 corepack 版本 == `ci.yml` 的版本（均为 `12.10.1`）；
      ⚠️ **本机无 Docker，无法本地验证安装**，须在 AC-7 的 CI 中以实证补足。
- [x] **AC-5（R4/R5 重试与日志）** 工作流含**≥2 次重试 + 递增退避**；
      日志中每次重试有明确记录；失败时能区分构建失败与推送失败。
- [x] **AC-6（R6/R7 本地脚本）** `scripts/docker-build.sh` 存在：
      默认**不推送**、`--push` 才推；`platforms` 与 `docker.yml` 一致；
      凭据**仅**从环境变量读取且**无默认值**；`grep` 确认脚本内**无任何明文凭据**。
- [x] **AC-7（CI 实证 · 关键）** PR 上两必需检查 `install-lint-build` + `audit` **SUCCESS**；
      ⚠️ **`install-lint-build` 成功即证明 R3 的 pnpm 12 下 `pnpm install --frozen-lockfile` 可用**
      （该步骤在 CI 中真实执行）。
- [x] **AC-8（R8 TASK-044 回写）** TASK-044 `Merge Record` 回填九要素、`Status → DONE`、
      迁 `tasks/done/`。
- [x] **AC-9（R9 文档）** `docs/operations/docker-release.md` 覆盖五项要求。
- [x] **AC-10（范围自证）** 改动仅限 `.github/workflows/docker.yml`、`Dockerfile`、
      `scripts/docker-build.sh`、`docs/operations/docker-release.md`、`tasks/**`。
      **未新增任何 secret**（`gh secret list` 改动前后一致）。
- [x] **AC-11（本地验证）** `python3 scripts/audit-repo.py` = `PASS=7 FAIL=0 WARN=0`；
      `shellcheck` 若可用则通过（不可用则说明）。
- [x] **AC-12（交付）** PR 描述填全、**不自行合并**；本任务档案 `Status → REVIEW` 迁 `review/`。

---

## Merge Record

> **按 D13-C 选项 C：本表由下一个任务（第十三代实例）回填。**
> **不得在本任务内自我回写**（那将造成档案与提交历史不一致）。
>
> **本任务自身即为第十三代实例的待回写方** —— 与 TASK-043 / TASK-044 / TASK-045(命名) 同机制，
> **不是遗漏**。TASK-044 的该注已由本任务（第十二实例）回填；本任务的该注由下一个任务回填。

| 要素 | 值 |
|------|-----|
| PR | **待第十三代实例回填** |
| 合并策略 | rebase-merge（预期，`AGENTS.md` §14.2） |
| 提交数 | 待第十三代实例回填 |
| merged_at | 待第十三代实例回填 |
| merge_commit_sha | 待第十三代实例回填 |
| 合并后 CI | 待第十三代实例回填 |
| D8 解耦 | 待第十三代实例回填 |
| 独立审查 | 待第十三代实例回填 |
| SHA 映射 | 待第十三代实例回填 |

---

## File Scope

```yaml
File Scope:
  - .github/workflows/docker.yml
  - Dockerfile
  - scripts/docker-build.sh                    # 新增
  - docs/operations/docker-release.md           # 新增
  - tasks/review/TASK-044-archive-writeback-and-cleanup/**   # 第十二实例回写 + 迁出
  - tasks/done/TASK-044-archive-writeback-and-cleanup/**
  - tasks/active/TASK-045-docker-pipeline-hardening/**
  - tasks/review/TASK-045-docker-pipeline-hardening/**
Non-Scope (files):
  - .github/workflows/ci.yml        # ★ 目的：改它会触发 CI 红；R3 反向对齐它即可
  - .github/workflows/**            # 其余工作流
  - docker-compose.yml
  - .dockerignore
  - pnpm-lock.yaml
  - pnpm-workspace.yaml             # R3 若不兼容只上报，不擅改
  - package.json                    # 不 bump 版本
  - CHANGELOG.md
  - src/**  server/src/**  shared/**
  - .agents/**  templates/**        # 框架快照只读
```

---

## Implementation Plan

### Phase 1 — 基线与核心配置（AC-1 ~ AC-3）

1. `git fetch origin && git switch main && git pull --ff-only` → 确认 `a978337`、工作区干净。
2. `git switch -c chore/TASK-045-docker-pipeline-hardening`
3. 改 `docker.yml`：`on.push` 加 `branches: ["main"]`（与 `tags` 并列）。
   **同步更新文件头注释**：「推送后的镜像」小节须说明**分支触发只产出 `sha-*`**。
   ⚠️ 注释**不得**把未验证的行为写成已验证。
4. **确认 `:latest` 行一字未改**（`git diff` 该行须为空）。

### Phase 2 — pnpm 对齐与重试（AC-4、AC-5）

5. 改 `Dockerfile` corepack 版本为 `12.10.1`，与 `ci.yml` 对齐（**改 Dockerfile 而非 ci.yml**，
   理由见 File Scope 注）。
6. 给 build-and-push 加**重试 + 递增退避 + 分阶段日志**。
   ⚠️ 实现方式由执行位定（如 `docker/build-push-action` 无原生 retry 时，
   可用包裹步骤 + `for` 循环，或改用 `nickfedorjp/...` 之类；
   **不得引入新依赖到 `package.json`**，工作流 `uses:` 引用 action 属正常）。

### Phase 3 — 本地脚本与文档（AC-6、AC-9）

7. 新增 `scripts/docker-build.sh`：默认只构建、`--push` 才推；
   `platforms` 与工作流一致；凭据仅从环境变量读、**无默认值**。
8. 新增 `docs/operations/docker-release.md`（五项要求）。

### Phase 4 — 回写与交付（AC-8、AC-10 ~ AC-12）

9. 实查回写 TASK-044 的 `Merge Record`（PR #19 九要素）；`Status → DONE`；`git mv`。
10. 跑两个审计脚本；提交（footer `Refs: TASK-044` / `Refs: TASK-045`）；
    推送、开 PR；本任务档案 `Status → REVIEW` 迁 `review/`。
11. **停下**，交主控位审查与人类授权。**执行位不得合并。**

---

## Verification Plan

| 验证项 | 方式 | 命令 |
|--------|------|------|
| AC-1 | 本地 | `git rev-parse main origin/main`；`git status --short` |
| AC-2 | 文件 + 平台 | `grep -n -A4 "^on:" .github/workflows/docker.yml`；PR 描述中的 `workflow_dispatch` 实跑证据 |
| AC-3 | Git | `git diff main..HEAD -- .github/workflows/docker.yml \| grep latest` → **须为空** |
| AC-4 | 文件 | `grep -o "pnpm@[0-9.]*" Dockerfile` vs `grep -o "pnpm@[0-9.]*" .github/workflows/ci.yml` → 相同 |
| AC-5 | 文件 + 平台 | 看工作流 diff；PR 上该作业 SUCCESS |
| AC-6 | 文件 | `bash -n scripts/docker-build.sh`；`grep -n "DOCKERHUB" scripts/docker-build.sh`（须仅变量引用，**无字面量**） |
| AC-7 | 平台 | `gh pr view <n> --json statusCheckRollup` |
| AC-8 | 文件 + Git | `grep "^Status:" tasks/done/TASK-044-…/TASK.md`；`git status --short` 见重命名 |
| AC-9 | 文件审阅 | 主控位读文档 |
| AC-10 | 平台 + Git | `gh secret list` 前后对比；`git diff --name-only main..HEAD` |
| AC-11 | 本地 | `python3 scripts/audit-repo.py` |
| AC-12 | 平台 | `gh pr view <n> --json statusCheckRollup,mergeable` |

---

## Current State

**REVIEW（review/）—— 执行位已完成 AC-1 ~ AC-12 的本地可验证部分，PR 已开立，等主控位审查与人类授权。**

- 主控位已完成全量核查（B1~B4 四缺口）与甲方案选定（人类 2026-10-17 23:4x）。
- 乙方案（自动打 tag + PAT）**已被人类否决**，未实现。
- **执行位已完成四项改动**：
  ① `docker.yml` 加 `branches:["main"]` 合并触发（`:latest` 行零改动）；
  ② `Dockerfile` corepack pnpm 对齐 `12.10.1`；
  ③ build-and-push 改为「包裹步骤 + 循环」退避重试（首发+2 重试、退避 30/60、构建/推送失败可区分）；
  ④ 新增 `scripts/docker-build.sh` + `docs/operations/docker-release.md`。
- **捎带归档 TASK-044**（第十二实例 `Merge Record` 回填 + `Status → DONE` + 迁 `done/`）。
- **本地边界（KI-1/KI-2）**：本机无 Docker ⇒ AC-4/AC-6 的实跑、AC-2 的 main-push 触发均无法本地验证，
  以 CI 实跑（AC-7）与合并后 run 为准；已在 PR 描述如实说明，**未伪造已验证**。
- **待主控位**：读实际 diff 审查 → PASS 后由人类显式授权、主控位执行 rebase-merge。**执行位未自行合并。**

---

## Changed Files

> 由 Developer 在执行中维护。以下为本次实施的实际改动。

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `.github/workflows/docker.yml` | 修改 | ① `on.push` 加 `branches:["main"]`（与 `tags:["v*"]` 并列，或关系）；② 文件头 + metadata 段注释同步（`:latest` 行零改动）；③ build-and-push 由 build-push-action 改为「包裹步骤 + 循环」退避重试 |
| `Dockerfile` | 修改 | corepack pnpm 版本 10.29.3 → 12.10.1，对齐 ci.yml |
| `scripts/docker-build.sh` | 新增 | 本地构建入口：默认只构建不推送、`--push` 才推；platforms / tag 规则与 CI 一致；凭据仅环境变量 |
| `docs/operations/docker-release.md` | 新增 | 触发方式 / 标签规则 / `:latest` 门禁 / 失败排查 / 配置项 / 重试行为 |
| `tasks/review/TASK-044-…/TASK.md` → `tasks/done/TASK-044-…/TASK.md` | 回写 + 迁出 | 第十二实例 Merge Record 回填（PR #19 / a978337 / run 39043427578）+ Status→DONE + 修滞后指针 |
| `tasks/active/TASK-045-docker-pipeline-hardening/TASK.md` | 修改 | 本档案：12 条 AC 证据、Current State、Changed Files、Known Issues、Merge Record 占位节 |
| `tasks/active/TASK-045-docker-pipeline-hardening/handoffs/HANDOFF-002-implementer-to-coordinator.md` | 新增 | 实施交接报告 |

> **范围自证（AC-10）**：改动仅限 `.github/workflows/docker.yml`、`Dockerfile`、`scripts/docker-build.sh`、
> `docs/operations/docker-release.md`、`tasks/**`；未改 ci.yml / pnpm-workspace.yaml / pnpm-lock.yaml /
> package.json / docker-compose.yml / .dockerignore；未新增任何 secret。

---

## Known Issues

- **KI-1（本机无 Docker）** 实测 `docker: command not found` ⇒ **AC-4（pnpm 12 安装）、AC-6（脚本本地构建）无法本地实跑验证**，
  须以 **CI 实跑**（AC-7，`install-lint-build` 真实执行 `pnpm install --frozen-lockfile`）补足。属环境约束非缺陷。
- **KI-2（AC-2 的验证边界）** 「`main` push 触发」**只能在合并后**观察到
  （PR 合并前无法构造 main push 事件）。执行位已在 PR 描述如实说明该边界，**未实跑** `workflow_dispatch`
  （因其会真实推送镜像，违背「不产生 DockerHub 副作用」硬约束），**未伪造已验证**。
  PR 合并后 docker.yml 的 run 即为最终证据（主控位合并时复验）。
- **KI-3（D8 语义变化 · 人类已选定）** 合并**会**产出 `sha-*` 镜像（对外可见）。
  但 **`latest` 与版本号仍只在打 tag 时前进** ⇒「合并 ≠ 发布」的核心保护保留。
- **KI-4（本机工具缺位）** 实测 `shellcheck: command not found`（AC-11 的 shellcheck 无法跑，改用 `bash -n`）；
  `python3` 为 Microsoft Store 占位存根（audit-repo.py 实际以 `python` 3.13.7 实跑）。均为环境问题，非本次变更引入。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | 主控位 coordinator | 执行位 implementer | 2026-10-17 | 任务登记 + 设计（四项范围 / 甲方案边界 / File Scope / 12 条 AC） |
| 002 | 执行位 implementer | 主控位 coordinator | 2026-10-17 | 实施报告：四项改动 + TASK-044 归档 + 本地边界（无 Docker / shellcheck / python3）+ 待审查 |

**最新 Handoff：** `handoffs/HANDOFF-002-implementer-to-coordinator.md`
**Next Action：** 主控位读**实际 diff**（不读描述）审查 → PASS 后由**人类显式授权**、主控位执行 rebase-merge。
**执行位未自行合并、未自行判定 PASS。**

---

## Task Rules

- [补充] **甲方案边界不可越**：只加 `branches: [main]`，**不得**加任何自动打 tag、
  自动推 tag、`workflow_dispatch` 改语义等逻辑。
- [增强] **`:latest` 门禁零削弱**：该行一字符不许改（AC-3 以 `git diff` 为准）。
- [增强] **实现者 ≠ 批准者**：执行位**不得**自行合并 PR、**不得**自行判定 PASS。
- [增强] **凭据零入库**：本地脚本与文档中**不得**出现任何 token 字面量。
- [补充] **本机无 Docker**：凡需实跑 Docker 的验收项，一律以 **CI 实跑**为准，
  不得声称「本地已验证」。
- [补充] **范围收窄**：`.github/workflows/ci.yml` 在 Non-Scope ——
  R3 的对齐方式是**改 Dockerfile 去适配 CI**，而非改 CI。

---

## Notes

**给执行位的实操提醒：**

1. **⚠️ GitHub Actions 的 `branches` + `tags` 是「或」关系**，不是「与」。
   两者并列时，任一匹配即触发。这正是本任务要的语义，但**必须实跑确认**。
2. **`docker.yml` 单次构建经 QEMU 出两种架构，耗时可能 10~20 分钟**。
   验收时**等足时间**，不要因为超时误判失败。
3. **build-push-action v6 无原生 `retry` 输入**（实测现有配置无相关字段）。
   实现重试时**不得引入 `package.json` 依赖**；用工作流层面的循环 / 包裹步骤即可。
4. **改 pnpm 版本时留意**：`pnpm-workspace.yaml` 已用 `allowBuilds` 新语法
   （注释记载 11+ 必需）。若 pnpm 12 报 `ERR_PNPM_IGNORED_BUILDS`，
   **停止上报**，不要改那个文件——它属另一议题。
5. **纯文档/配置提交会触发新一轮 CI** ⇒ 四项改动**合批提交**，不要拆成多个。