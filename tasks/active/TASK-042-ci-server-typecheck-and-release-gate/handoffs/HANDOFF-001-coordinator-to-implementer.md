# HANDOFF-001 — 主控位 → 执行位

---

## Meta

```yaml
From: 主控位 Coordinator（本会话）
To: 执行位 Implementer（devops）
Task: TASK-042 — CI 增加后端编译门禁 + Docker `:latest` 加 tag 门禁，并受控发布 v1.0.1
Date: 2026-10-17
Current State: READY
Previous Handoff: 无（首个交接）
```

---

## Completed Work

> 主控位本轮完成的**全部**工作（只读核查 + 任务登记，**未改任何产品代码、未执行任何平台写操作**）。

**一、链路只读核查（2026-10-17），实测证据：**

- `gh run list --repo huyanluanyuqaq/shadcn-admin --workflow docker.yml` →
  最新一次 docker run 为 **2026-10-13T14:20:54Z**（run `38412561363`，success，push/`main`，commit `05bf884`）。
- `git log -- .github/workflows/docker.yml` → 最后一次改动为 **`dc531e6`，2026-10-14 15:11:27 +0800**
  （「镜像发布改为仅由版本 tag 触发」，TASK-031 / D8）。
  **该提交之后至今零次 docker run** ⇒ 当前版配置从未执行。
- `gh api .../actions/workflows/docker.yml/runs?per_page=50` 全量事件类型扫描 →
  历史上 tag 触发仅一次：**2026-10-10T03:05:24Z，`push` / branch=`v1.0.0`，success**。
  但 `git show cb59932:.github/workflows/docker.yml` 显示当时触发块为
  `branches: ["main"]` + `tags: ["v*"]` **并存**，metadata 还带 `v1`/`v1.0` 浮动标签
  ⇒ **不能作为当前配置可用的证据**。
- `gh api repos/huyanluanyuqaq/shadcn-admin/actions/secrets` → `DOCKERHUB_TOKEN`、`DOCKERHUB_USERNAME` 均在位。
- `gh workflow list --all` → `Build and Push Docker Image` 状态 `active`（ID 380169901）。
- DockerHub Tags API（`nomorelatenights/subscription-admin`）→ 仓库存在（HTTP 200）；
  `latest` 更新于 **2026-10-13T14:21:25Z**；`v1.0.0` 与 `v1` 两个 tag 均存在（HTTP 200），
  `1.0.0` 不存在（404）。
- `git log --oneline 05bf884..origin/main | wc -l` → **80**；`origin/main` = `72d8f28`。
- 根 `tsconfig.json` references 仅 `tsconfig.app.json` + `tsconfig.node.json` ⇒ **不含 `server/`**；
  `ci.yml:46-65` 只跑 `pnpm build:shared` / `pnpm lint` / `pnpm format:check` /
  `pnpm test:browser:install` / `pnpm test` / `pnpm build` ⇒ **从不编译后端**。
  唯一编译后端的是 `Dockerfile` 的 `pnpm --filter server build`。
- 根 `package.json` 已有脚本 `typecheck:server` = `pnpm --filter @repo/shared build && pnpm --filter server typecheck`（无需新写）。
- `.prettierignore` 为「忽略全部 + 白名单」结构，白名单**不含** `.github/` ⇒ `pnpm format:check` 不检查工作流文件。
- `scripts/audit-repo.py` F6 逻辑为单向校验（声明的作业名必须存在于工作流），**不要求每个作业都被声明**
  ⇒ 新增 step 而不新增 job 时，`AGENTS.md` §14.1 无需改动、F6 仍 PASS。
- `git merge-base --is-ancestor` 验证 `10fd84e`、`f7453ae`（TASK-041 代码）**均在 `origin/main`**；
  `gh pr list --state open` → 空；工作树干净。

**二、任务登记：**

- 创建 `tasks/backlog/TASK-042-ci-server-typecheck-and-release-gate/TASK.md`（Status = `READY`），
  含 Objective / Background（B1–B5 实测）/ Scope / Non-Scope / Requirements / Constraints /
  Dependencies / 9 条 Acceptance Criteria / File Scope / 六阶段 Implementation Plan /
  Verification Plan / Known Issues / Task Rules。

**三、主控位裁决与人类裁决：**

- **发布 tag 取 `v1.0.1`（人类当场裁决，覆盖主控位原建议）。**
  主控位原建议 `v2.2.1`（= `package.json` 既有 version，理由是既不 bump 产品文件、也不制造新的版本错位）；
  **人类选择延续 DockerHub 上既有的镜像 tag 序列**（上一版 `v1.0.0`）。
  **以人类裁决为准，执行位不得擅自改回 `v2.2.1`，也不得 bump `package.json`。**
- 由此确认并接受的事实：本项目有**两套版本号序列** —— `package.json` / `CHANGELOG.md` 为 `2.2.1`，
  DockerHub 镜像 tag 为 `v1.0.x`。二者不要求一致，**不在本任务内统一**（见 KI-2）。
- **后端门禁以「步骤」加入既有 `install-lint-build` 作业，不新增 job**
  ⇒ `AGENTS.md` §14.1 无需改、分支保护必需检查无需动、`audit` F6 仍 PASS。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `tasks/backlog/TASK-042-ci-server-typecheck-and-release-gate/TASK.md` | 新增 | 任务登记，Status = READY |
| `tasks/backlog/TASK-042-ci-server-typecheck-and-release-gate/handoffs/HANDOFF-001-coordinator-to-implementer.md` | 新增 | 本文件 |

> **未改动**任何 `.github/`、`src/`、`server/`、`shared/`、`package.json`、`tsconfig*`、`AGENTS.md`、`docs/` 文件。
> 上述两个新文件**尚未提交**，应由执行位在任务分支上首次提交纳入。

---

## Tests

```yaml
命令: 无（本轮为只读核查 + 文档登记，未运行项目测试）
结果: 不适用
覆盖: 不适用
未覆盖: 全部项目测试（属执行位职责，见 AC-1）
说明: 主控位本轮执行的命令均为只读（gh api / gh run list / git log / git show /
      git merge-base / curl DockerHub Tags API / yaml.safe_load / python -c 读 json）
```

---

## Known Issues

- **KI-1** DockerHub 遗留 `v1` 浮动 tag（旧配置产物），当前配置已不再产生。本任务不清理，已登记待另立任务。
- **KI-2（人类已裁决接受）** 两套版本号序列并存：`package.json` / `CHANGELOG.md` = `2.2.1`，
  DockerHub 镜像 tag = `v1.0.x`。人类选择延续镜像序列，故本任务发布 `v1.0.1` 而**不 bump** `package.json`。
  两套口径是否统一需另立任务。
- **KI-3（结构性）** `docker.yml` 仍保留 `workflow_dispatch` 出口。本任务只给 `:latest` 加门禁，
  **未移除该出口** —— 手动触发仍会推一个 `sha-*` 镜像。彻底取消人工触发需另立任务裁决。
- **KI-4（本任务要解决的核心未知）** tag-only 版 `docker.yml` **从未实跑**；在 AC-7 完成前，
  不得在任何文档或对话中把该工作流描述为「已验证 / 正常」。

---

## Remaining Work

全部实施工作，按 `TASK.md` 的六阶段 Implementation Plan 执行：

- Phase 1：后端编译门禁（AC-1 ~ AC-3）
- Phase 2：`:latest` 发布门禁（AC-4）
- Phase 3：PR 交付与合并（AC-5）—— **合并由主控位执行，执行位不得自行合并**
- Phase 4：门禁实证 `workflow_dispatch`（AC-6，已授权）
- Phase 5：受控发布 tag `v1.0.1`（AC-7 / AC-8，已授权）
- Phase 6：记录归档（AC-9）

---

## Assumptions

> 以下假设**未经执行位验证**；若不成立，执行位应在动手前上报，不要默默按错误假设继续。

- **A-1** `pnpm typecheck:server` 在当前 `main` 上**能够通过**。
  未验证（主控位未运行任何项目构建命令）。这是 AC-1 的阻塞判定点。
- **A-2** `docker/metadata-action@v5` 的 `enable` 字段接受 `${{ github.ref_type == 'tag' }}`
  这类 GitHub 上下文表达式。依据：`f3c506a` 的失败是因使用了**不存在的函数** `is_tag`，
  而非因使用了上下文表达式。**执行位应自行确认这一点**（读 action 文档或源码），
  若不成立则停止并上报，由主控位改设计（备选：改为两个 metadata 步骤按 `github.ref_type` 分流）。
- **A-3** CI 环境中 `pnpm install --frozen-lockfile` 能取到 `better-sqlite3` 预编译二进制
  （`pnpm-workspace.yaml` 的 `allowBuilds` 已声明）。依据：`ci.yml` 现有 `pnpm test` 已依赖 server 侧依赖可用。
- **A-4** 推送 tag 走 SSH 可通（`gh` 显示 Git 协议为 ssh）。若被沙箱拦截，**不要反复重试**。
- **A-5** `main` 分支保护允许推送**新 tag**（它约束的是 `main` 分支，不是 tag ref）。
- **A-6** 打 tag 不会触发 `ci.yml`（其 `push` 触发器限定 `branches: [main]`）⇒ 发布期间只有 docker.yml 一个 run。

---

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `pnpm typecheck:server` 在当前 main 上就失败 | AC-1 不通过，任务转 BLOCKED；**且意味着 Docker 构建当前也是坏的**（重大发现） | AC-1 设为第一步阻塞判定；失败即停，禁止放水（R6），按五要素上报 |
| `enable` 表达式不被 metadata-action 支持 | 工作流运行时报错，发布中断 | A-2 要求执行位先自行确认；备选设计（两步分流）已写在 Assumptions 中；**在 AC-6 实证前不执行 AC-7** |
| 门禁写错方向（如把 `latest` 永远禁用） | 打 tag 后 `latest` 不前进，`docker-compose.yml`（引 `:latest`）的用户拿不到新版 | AC-6 + AC-8 双重验证：先证分支触发不产 `latest`，再证 tag 触发**确实**产 `latest` 且 digest 与 `v1.0.1` 一致 |
| `workflow_dispatch` 验证（AC-6）产生额外 `sha-*` 镜像 tag | DockerHub 多一个无害 tag | 已授权并记录；不影响 `latest` |
| 多架构构建耗时（QEMU arm64，历史 ~6 分钟/次） | 阶段 4+5 共两次构建，总耗时可能 >15 分钟 | 用 `run_in_background` 或轮询 `gh run watch`，避免空等 |
| tag 推送被沙箱拦截（SSH） | 无法完成 AC-7 | 不反复重试；上报后由人类放行或由人类手动执行 `git push origin v1.0.1` |
| 合并后 main 又前进（他人提交） | tag 指向的代码与已验证的不完全一致 | AC-7 前重新 `git pull --ff-only` 并核对 HEAD；若 main 已变，停止并上报 |

---

## Next Action

**第一个动作（可立即执行）：**

1. 读取本文件与 `tasks/backlog/TASK-042-ci-server-typecheck-and-release-gate/TASK.md` 全文。
2. 把任务移入 `tasks/active/`，`TASK.md` 的 `Status` 改为 `ACTIVE`，`Owner` 改为执行位标识，
   `Updated` 改为当前时间，并**首次提交**这两个文件到新建的任务分支
   `chore/TASK-042-ci-server-typecheck-and-release-gate`（从 `origin/main` 派生）。
3. **在不修改任何文件的前提下**执行：

   ```bash
   pnpm install --frozen-lockfile   # node_modules 不就绪时才需要
   pnpm build:shared
   pnpm typecheck:server
   ```

   把**原始输出全量**贴回 handoff。**若失败：停止，不要改任何文件，按五要素上报主控位。**
