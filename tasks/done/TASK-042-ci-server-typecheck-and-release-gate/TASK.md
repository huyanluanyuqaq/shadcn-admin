# TASK-042 — 补齐 CI 后端编译盲区 + 收紧 Docker 发布出口，并以受控 tag 发布 v1.0.1

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-042
Title: CI 增加后端编译门禁 + Docker `:latest` 加 tag 门禁，并受控发布 v1.0.1
Workflow: chore
Status: DONE
Priority: P1
Owner: implementer-devops（执行位实施）→ 已合并归档
Owner Since: 2026-10-17
Assigned Role: architect（设计，已完成）→ devops（实施）；审查由主控位承担
Created: 2026-10-17
Updated: 2026-10-17
Branch: chore/TASK-042-ci-server-typecheck-and-release-gate
Requires Human Approval: true   # 含对外发布动作（打 tag → DockerHub 推镜像），已获人类授权（2026-10-17）；
                                # 发布 tag 名 v1.0.1 由人类当场裁决（主控位原建议 v2.2.1）
```

> **编号说明：** 001–040 已占用，041 已归档 `tasks/done/`（代码已合入 `main`）。本任务取 **042**。
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

- [x] **AC-1（前置阻塞判定）** 在**未做任何修改**的 `main`（HEAD=`72d8f28` = `origin/main`）上执行
      `pnpm typecheck:server`，退出码 0；`.github/` 未修改；未触发 R6。
      证据：`artifacts/ac1-typecheck-server.txt`
- [x] **AC-2** `ci.yml` 的 `install-lint-build` 作业内第 7 步 "Typecheck server" → success
      （run `39004353067`、`39005264346`、`39005551732` 三次均见该步骤）；
      作业名集合仍为 `['install-lint-build','audit']`
      证据：PR #14 的 `statusCheckRollup` + `gh run view` 三次 run 日志
- [x] **AC-3** `scripts/audit-repo.py` 本地 `PASS=7 FAIL=0 WARN=0`（主控位独立复跑一致）
      证据：`artifacts/ac3-audit-p2.txt`
- [x] **AC-4** `docker.yml:84` 为 `type=raw,value=latest,enable=${{ github.ref_type == 'tag' }}`；
      `type=sha` 与 `type=semver` 两行未动；文件头已同步说明
      证据：`.github/workflows/docker.yml` 当前版本
- [x] **AC-5** PR #14 rebase-merge，main `72d8f28..b62e981`，提交 `ffad602` / `29f8dbe` / `9534983` / `b62e981`；
      PR 上两必需检查 SUCCESS；合并后 main push run `39005551732` 两作业 success
      证据：`gh pr view 14 --json statusCheckRollup` + `gh run list --branch main --limit 5`
- [x] **AC-6（门禁实证 · 已授权）** run `39006433376`（workflow_dispatch / main，success）——
      metadata 只产出 `sha-b62e981`，不含 `latest`、不含版本号；
      DockerHub `latest` digest 仍为 `sha256:19e2d1ea9464da1d2da8316b885393e03330282df3dbb678b1840672979abe2d`、
      `last_updated` 仍 `2026-10-13T14:21:23Z`，与运行前完全一致
      证据：run `39006433376` 日志 + DockerHub Tags API 运行前后两次调用
- [x] **AC-7（受控发布 · 已授权）** annotated tag `v1.0.1` → `31b670a`（= `b62e981`），已推送；
      run `39007059836`（push / v1.0.1）success
      证据：`git show v1.0.1 --no-patch --format="%H %D"` + `gh run view 39007059836`
- [x] **AC-8** `v1.0.1` 与 `latest` digest 完全相同：
      `sha256:13bbf2d989dfe4428d46d8be23c985e8a6104851e924149e05faf7a6c101eed3`；
      三者（`latest` / `v1.0.1` / `sha-b62e981`）`updated` 均为 `2026-10-17T05:40:11~16Z`
      证据：DockerHub Tags API 三次调用（各 tag 的 digest + last_updated）
- [x] **AC-9** `TASK.md` 的 `Changed Files` / `Known Issues` / `Merge Record` 如实填写；
      handoff 中落盘：tag 名、run ID 与 URL、各镜像 tag 的 digest、UTC 时间戳、`workflow_dispatch` 验证结论。

---

## Merge Record

> **本表由 TASK-043 按 D13-C 第九实例于 2026-10-17 实查回填。**
> 本任务经**两次**交付请求合入 `main`：**PR #14**（代码：CI 门禁 + Docker `:latest` 收紧）
> 与 **PR #15**（AC-9 档案回写）。下表九要素按 PR #14 为主记录，PR #15 的事实单列一节。

| 要素 | 值 |
|------|-----|
| PR | **#14**（代码）+ **#15**（档案回写，见下节） |
| 合并策略 | **rebase-merge**（`origin/main` `72d8f28 → b62e981`） |
| 提交数 | **4** |
| merged_at | **2026-10-17T05:14:48Z** |
| merge_commit_sha | **`b62e9814bfb864c24c5398e868836e9681e64ec0`**（pre-rebase head `a075b169`） |
| 合并后 CI | run **`39005551732`** `success`，`headSha = b62e981`，两作业（`install-lint-build` + `audit`）均 success |
| D8 解耦 | **第 13 次复现**（`b62e981` 上 actions runs `total_count = 3`，但其中 2 个 `Build and Push Docker Image` 分别由 **`workflow_dispatch`（run `39006433376`，AC-6 已授权）**与 **tag `v1.0.1` push（run `39007059836`，AC-7 已授权）**触发；**该合并自身的 push 只产生 `Continuous Integration` 一个 run** ⇒ 普通合并仍未触发 docker.yml，D8 解耦成立） |
| 独立审查 | `handoffs/HANDOFF-002-implementer-to-coordinator.md`（主控位审查结论 **PASS，附 3 项 MINOR**，均已整改） |
| SHA 映射 | **4 对**（PR #14）+ **2 对**（PR #15），逐对验证通过：两侧均为 `commit` 对象、`%t` **tree 相同**、`git merge-base --is-ancestor <post> origin/main` 通过 |

**SHA 映射逐对验证（2026-10-17 实测；pre = PR 侧 commit，post = `origin/main` 侧 commit）：**

| # | PR | pre（PR 侧） | post（main 侧） | `%t` 相同 | post 在 `origin/main` |
|---|----|--------------|-----------------|-----------|----------------------|
| 1 | #14 | `f1991d0544fc5c50712bd1c203c51c0578962ccd` | `ffad602` | ✅ `de86aaf` | ✅ |
| 2 | #14 | `ee1e34e787c7cdd81b5ea8acea7d4f38c96364e7` | `29f8dbe` | ✅ `82494fc` | ✅ |
| 3 | #14 | `789c96ea46d3104edc0574de139bc184ae089c60` | `9534983` | ✅ `17ebc21` | ✅ |
| 4 | #14 | `a075b1693fedaf4244d0e61acf909ffff416bc40` | `b62e981` | ✅ `1cb77fb` | ✅ |
| 5 | #15 | `f377d6ca73626552a0c1d87cbb06affa27467df1` | `51a5ba8` | ✅ `c19fc33` | ✅ |
| 6 | #15 | `9e22f66a41308a3c617aca1ca3a713432afd01a1` | `f2a63bc` | ✅ `905f5a0` | ✅ |

> **映射说明：** rebase-merge 会把 PR 侧提交重写为新 SHA，故 pre/post **SHA 不同但 tree 相同**。
> 上表按提交主题一一对应（`git log --oneline` 与 `gh pr view 14/15 --json commits` 双向核对），
> **PR #14 共 4 对、PR #15 共 2 对，合计 6 对，全部通过**。

### PR #15（档案回写）合并事实

| 要素 | 值 |
|------|-----|
| PR | **#15** |
| 合并策略 | rebase-merge（`origin/main` `b62e981 → f2a63bc`） |
| 提交数 | **2** |
| merged_at | **2026-10-17T06:45:04Z** |
| merge_commit_sha | **`f2a63bc48ce50a165db0d338bb1465bcfa4d2c31`**（pre-rebase head `9e22f66a`） |
| 合并后 CI | run **`39011065238`** `success`，`headSha = f2a63bc`，两作业均 success |
| D8 解耦 | 同上（第 13 次复现口径：普通合并不触发 docker.yml） |

> **D13-C 归档回写：** 原注「合并时尚未回写；按 D13-C 选项 C，归档回写（移入 `done/`）待下一个任务补记」
> **已由 TASK-043（第九实例）于 2026-10-17 完成** —— `Status: REVIEW → DONE`、`git mv` 至 `tasks/done/`、
> 本 `Merge Record` 九要素 + 6 对 SHA 映射实查回填。该原注已失效，不再保留。

---

---

## File Scope

```yaml
File Scope:
  - .github/workflows/ci.yml
  - .github/workflows/docker.yml
  - tasks/**/TASK-042-ci-server-typecheck-and-release-gate/**
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

**DONE（done/）—— 全部 AC 已完成；D13-C 第九实例归档回写已由 TASK-043 于 2026-10-17 完成。**

> **2026-10-17 归档回写（由 TASK-043 承载，`Refs: TASK-042`）：** `Status: REVIEW → DONE`、
> `git mv` → `tasks/done/`；`Merge Record` 由「仅 PR #14 事实」补全为**九要素 + PR #14（4 对）/
> PR #15（2 对）共 6 对 SHA 映射**，全部以 `gh pr view 14/15` 与 `git` 实查后落笔
> （`merged_at` / `merge_commit_sha` / 提交数 / 合并后 CI run / D8 复现口径 / 独立审查 /
> SHA 映射逐对 `%t` 与 `--is-ancestor` 验证）。同步修正 Meta 的 `Status` 与 `Owner`、
> 顶部「编号说明」的 041 目录表述、本 `Current State` 头部、以及 `Next Action` 滞后指针（R5）。
>
> **下方为实施/归档阶段的历史记录，按原样保留：**
>
> **REVIEW（review/）—— 全部 AC 已完成，任务移交 `review/` 待归档回写。**

- **AC-1** 阻塞判定点：在 `origin/main`（`72d8f28`）未修改任何文件的前提下执行
  `pnpm build:shared` 与 `pnpm typecheck:server`，**均退出码 0**。原始输出见
  `artifacts/ac1-build-shared.txt` / `artifacts/ac1-typecheck-server.txt`
  （`pnpm install --frozen-lockfile` 见 `artifacts/ac1-install.txt`）。
  ⇒ **未触发 R6，未修改任何 `tsconfig*` / `server/` / `shared/` 文件。**
- **AC-2** `ci.yml` 的 `install-lint-build` 作业内、`Build shared package` 之后新增
  `Typecheck server` 步骤（`run: pnpm typecheck:server`）。作业名集合仍为
  `['install-lint-build', 'audit']`（`yaml.safe_load` 实测）。
  三次 CI run（`39004353067`、`39005264346`、`39005551732`）均见该步骤 success。
- **AC-3** `python3 scripts/audit-repo.py` 修改后复跑，`PASS=7 FAIL=0 WARN=0`，退出码 0
  （`artifacts/ac3-audit-p2.txt`；修改前基线见 `artifacts/ac1-audit.txt`）。
- **AC-4** `docker.yml` 的 `:latest` 行改为
  `type=raw,value=latest,enable=${{ github.ref_type == 'tag' }}`；
  `type=sha,format=short` 与 `type=semver,pattern=v{{version}}` 两行未动；
  文件头「推送后的镜像」小节已同步说明该门禁。
- **AC-5** PR #14 rebase-merge，main `72d8f28..b62e981`，提交
  `ffad602` / `29f8dbe` / `9534983` / `b62e981`。
  PR 上 `install-lint-build`（run `39005264346`）与 `audit`（同 run）均 SUCCESS；
  合并后 main push run `39005551732` 两作业再次 SUCCESS。
- **AC-6** run `39006433376`（workflow_dispatch / main，success）——
  metadata 产出 `sha-b62e981`，不含 `latest`、不含版本号；
  DockerHub `latest` digest 与运行前完全一致（`sha256:19e2d1ea...`），`last_updated` 未变。
- **AC-7** annotated tag `v1.0.1` → `31b670a`（= `b62e981`），已推送；
  run `39007059836`（push tag `v1.0.1`）success。
- **AC-8** `v1.0.1` 与 `latest` digest 完全相同：
  `sha256:13bbf2d989dfe4428d46d8be23c985e8a6104851e924149e05faf7a6c101eed3`；
  三者（`latest` / `v1.0.1` / `sha-b62e981`）`updated` 均为 `2026-10-17T05:40:11~16Z`。
- **AC-9**（本归档回写）TASK.md 与 handoff 已补记，任务目录迁入 `tasks/review/`，Status 改为 `REVIEW`。

---

## Changed Files

> 由 Developer 在执行中维护。

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `.github/workflows/ci.yml` | 修改 | `install-lint-build` 作业内、`Build shared package` 之后新增 `Typecheck server` 步骤（`run: pnpm typecheck:server`）及说明注释。**未新增 job**，作业名集合不变。 |
| `.github/workflows/docker.yml` | 修改 | `:latest` 行增加 `enable=${{ github.ref_type == 'tag' }}` 门禁；文件头「推送后的镜像」小节同步说明。`type=sha,format=short` / `type=semver,pattern=v{{version}}` 两行未动。 |
| `tasks/**/TASK-042-ci-server-typecheck-and-release-gate/**` | 新增/修改 | 任务档案；`artifacts/` 实证留档（AC-1 前置输出、AC-3 审计输出，含命令/退出码/UTC 时间头）；`handoffs/` 交接记录（HANDOFF-001~004）。 |
| _（Phase 4–6 回填：tag / run ID / digest 记录）_ | | |

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
- **KI-4（已修）** `docker.yml` 文件头原称 workflow_dispatch「只产出 `<短commit-sha>` 一个 tag」，与同句
  「可任选分支/tag」矛盾；从 tag 触发时会同时产出 `latest` + 版本号 + `sha`。已由主控位以提交
  `a075b16`（main 上为 `b62e981`）修正。
- **KI-5（未清理）** DockerHub 上 `sha-05bf884` 等旧 tag 与 `v1.0.0` 仍在，未清理。本任务不删除/不清理任何远端镜像 tag。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | coordinator（主控位） | implementer（执行位） | 2026-10-17 | 任务登记 + 设计方案 + 三次平台动作的人类授权范围 |
| 002 | implementer（执行位） | coordinator（主控位） | 2026-10-17 | P1–P3 实施报告 + PR #14 开立 + 主控位审查结论（PASS，附 3 项 MINOR） |
| 003 | coordinator（主控位） | implementer（执行位） | 2026-10-17 | AC-9 归档回写指派（范围 / File Scope / 禁止事项 / 实证数据） |
| 004 | implementer（执行位） | coordinator（主控位） | 2026-10-17 | AC-9 完成报告（改动文件 / 本地验证 / PR / 未做事项） |

**最新 Handoff：** `handoffs/HANDOFF-004-implementer-to-coordinator.md`
**Next Action：** **无待办。** PR #14 与 PR #15 均已合并（`b62e981` / `f2a63bc`），
本任务已由 TASK-043 按 D13-C 第九实例归档回写完成（`Status = DONE`、`tasks/done/`、
`Merge Record` 九要素 + 6 对 SHA 映射实查回填）。
> **原指针（已失效，2026-10-17 由 TASK-043 修正）：** 「主控位审查 PR #15 的档案回写 diff →
> PASS 后执行 `rebase-merge`」—— PR #15 已于 `2026-10-17T06:45:04Z` 合并
> （merge commit `f2a63bc`，合并后 run `39011065238` 双绿）。

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
