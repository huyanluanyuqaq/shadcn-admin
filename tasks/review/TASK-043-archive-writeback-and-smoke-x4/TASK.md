# TASK-043 — D13-C 第八/第九实例归档回写 + 修正 `projects/README.md` 失效断言 + 修复冒烟脚本 X4 顺序缺陷

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-043
Title: 归档回写 TASK-041/042（D13-C 第八、九实例）+ 修正 README 失效断言 + 修复冒烟脚本 X4
Workflow: chore
Status: REVIEW
Priority: P1
Owner: 主控位（设计已完成）→ 执行位（实施已完成，待审查）
Owner Since: 2026-10-17
Assigned Role: coordinator（设计，已完成）→ developer（实施，已完成）；审查由主控位承担
Created: 2026-10-17
Updated: 2026-10-17
Branch: chore/TASK-043-archive-writeback-and-smoke-x4
Requires Human Approval: true   # 含 D13-C 归档回写（改写 TASK-041/042 的 Status 与目录），
                                # 属跨任务档案的状态变更；人类已于 2026-10-17 指示
                                # 「起草 TASK-043 并把问题 4 一并纳入本轮」
```

> **编号说明：** 001–042 已占用。041 与 042 均已合并 `main` 但仍留 `tasks/review/`，
> 本任务取 **043**。

> **本任务的「鸡生蛋」性质（必读）：** 本任务自身合并后，其 `Merge Record` 同样需要
> **下一个任务**（第十实例）回写 —— 这是 D13-C 选项 C 的固有代价，不是本任务的缺陷。
> 不得为规避这一点而在本任务内自我回写（那将造成档案与提交历史不一致）。

---

## Objective

一次性清零主控位 2026-10-17 全局审查发现的**流程与文档债**，使任务状态目录、
框架文档、冒烟脚本三者重新自洽：

1. **承载 D13-C 第八实例** —— 回填 TASK-041 的 `Merge Record` 九要素 + SHA 映射，
   将其 `Status → DONE` 并移入 `tasks/done/`；
2. **承载 D13-C 第九实例** —— 同上处理 TASK-042；
3. **修正 `projects/README.md` 的失效断言**（Workspace 侧，命中 `AGENTS.md` §13 第 5 条）；
4. **修复冒烟脚本 X4 顺序缺陷** —— 消除 4 项 `FOREIGN KEY constraint failed`。

> **①②③ 是纯文档，零行为变更；④ 是测试脚本改动，零生产代码变更。
> 四项同源（都是「已发生但未被记录/修复」的收尾债），故合并为一个任务一次清零。**

---

## Background

主控位 2026-10-17 15:0x 对 `shadcn-admin` 做全局只读审查，**实测**（非档案自述）得出：

| # | 发现 | 证据 |
|---|------|------|
| B1 | `main` = `origin/main` = **`f2a63bc`**，工作区干净；PR #13/#14/#15 **全部 `MERGED`**（`72d8f28` / `b62e981` / `f2a63bc`） | `git rev-parse main origin/main`、`gh pr view 13/14/15 --json state,mergedAt,mergeCommit` |
| B2 | CI 最近 6 次 run **全 `success`**；`docker.yml` 因 tag-only 仅在 `v1.0.1`（run `39007059836`）跑过，**D8 解耦仍成立** | `gh run list --limit 6`、`gh run list --workflow docker.yml` |
| B3 | **D13-C 第八实例未回写**：`tasks/review/TASK-041-…/TASK.md` 的 `Merge Record` 九要素**全为「待回填」**，而 PR #13 已于 `2026-10-16T18:09:53Z` 合并 | 档案表格逐行读取 + `gh pr view 13` |
| B4 | TASK-042 **未承载**第八实例回写 —— grep 全目录仅 2 处提及 TASK-041 且均为 `merge-base` 依赖声明 | `grep -rn "TASK-041" tasks/review/TASK-042-*/` |
| B5 | **TASK-042 自身亦未归档**：仍留 `tasks/review/`，`Next Action` 写「审查 PR #15 → PASS 后合并」，而 #15 已于 `2026-10-17T06:45:04Z` 合并 ⇒ 指针滞后 | `TASK.md:353` + `gh pr view 15` |
| B6 | **`projects/README.md` 失效断言**：第 107/117-118/134 行称「TASK-001~022 全部完成」「backlog/active/review 均为空」「done 下 22 个」；实测 `done` **39** 个、`review` **2** 个、已推进到 TASK-042 | `ls tasks/*/` 计数 |
| B7 | **X4 缺陷仍在**（TASK-041 KI 登记的「建议另立任务」，至今未立）—— 详见下方「X4 技术分析」 | `sed` 实读 `server/scripts/smoke.ts` |

---

## X4 技术分析（本节为主控位 2026-10-17 实读代码得出，**执行位须以此为事实基准**）

> ⚠️ TASK-041 档案中的行号（`L1724` / `L1742` / `L2501` / `L2528`）是**当时的**行号。
> 本任务执行时行号可能已漂移，**必须以符号名定位，不得照抄行号**。

**机理（已逐行确认）：**

| 步骤 | 位置（符号） | 行为 |
|------|-------------|------|
| ① 创建 | `const pool` / `const plan`（**main 作用域**，第 5 段「资源 CRUD」） | `POST /api/subscription-pools` / `POST /api/plans` |
| ② 删除 | 「删除供应商」`for` 循环 → `DELETE /api/subscription-pools/${pool.json?.id}` | **在第 13 段** |
| ③ 删除 | 「删除套餐」`for` 循环 → `DELETE /api/plans/${plan.json?.id}` | **在第 13 段** |
| ④ 引用 | **第 17.9.1 段**（`// 17.9.1 已绑定客户的订阅：通知里显示客户名称（TASK-028）`）仍用 `poolId: pool.json?.id` / `planId: plan.json?.id` | **在 ②③ 之后** |

⇒ 创建 `richCustomer` 时携带**已被删除的外键** ⇒ `FOREIGN KEY constraint failed`
⇒ `richCustomer.status !== 201` ⇒ 连锁导致 4 项断言失败。

**受影响的 4 项断言（执行位须在修复后确认其转为通过）：**

1. `富格式验证：创建第二个客户（用于绑定订阅）` —— `richCustomer.status === 201`
2. `富格式验证：创建已绑定客户的订阅` —— `richSub2.status === 201`
3. `富格式验证：单条同步成功（已绑定客户）` —— `richSync2.status === 200`
4. `已绑定客户的订阅同步成功通知显示客户名称（TASK-028）` —— `richTg2` 轮询断言

> **为何是「基线固有」而非本任务引入：** TASK-041 已用**基线对照**（还原改动后同环境复跑）
> 证明失败项 `diff` 逐行一致。本任务修复它**不违反**「不得改动既有结论」的约束 ——
> 修的是缺陷本身，不是重写结论。

---

## Scope

- **TASK-041 归档回写**：`Merge Record` 九要素 + SHA 映射表实查回填；`Status → DONE`；
  `git mv` 至 `tasks/done/`；修正其 `Next Action` 等滞后指针。
- **TASK-042 归档回写**：同上（含其 `Merge Record`，该表已有值但需核验 + 补 `PR #15` 一行）。
- **`projects/README.md` 失效断言修正**（Workspace 侧第 107/117-118/134 行）。
- **X4 修复**：使第 17.9.1 段不再引用已删除的 `pool` / `plan`。
- 本任务自身的 `TASK.md` / `handoffs/` 记录。

## Non-Scope

- **不改任何生产代码**：`src/**`、`server/src/**`、`shared/**` 一律不动。
- **不改任何 CI / 工作流配置**（`.github/**`）、不改 `Dockerfile` / `docker-compose.yml`。
- **不改 `package.json` 版本**、不改 `CHANGELOG.md`。
- **不 bump 任何镜像 tag**、不触发 `workflow_dispatch`、不打任何新 tag
  ⇒ 本任务**不含任何对外发布动作**，无需发布类授权。
- **不删除远端分支**（`git push origin --delete`）—— 本任务不涉及分支清理。
- **不处理** `actions/setup-node` v4→v5、**不纳入** `audit_framework.py` 入 CI
  （二者为独立技术债，另立任务；人类本轮仅指示纳入「问题 4」）。
- **不做 TASK-043 自身的 D13-C 回写**（第十实例留给下一个任务）。
- **不碰 `business-manager`**。

---

## Requirements

1. **R1（实查回写）** TASK-041 `Merge Record` 的九要素**全部由执行位以 `gh` / `git` 实查后落笔**，
   **严禁照抄本档案或任何既有文档中的值**。须含：PR 编号、合并策略、提交数、`merged_at`、
   `merge_commit_sha`、合并后 CI run、D8 解耦次数、独立审查记录路径、SHA 映射。
2. **R2（SHA 映射逐对验证）** TASK-041 的 SHA 映射表**每一对**必须验证：两侧均为 `commit` 对象
   （`git cat-file -t`）、`%t` tree 相同、post 侧在 `origin/main` 上（`git merge-base --is-ancestor`）。
   任一对不成立即停止上报，**不得**填写「基本一致」式结论。
3. **R3（合并判定以 `gh pr view` 为准）** `state` / `mergedAt` / `mergeCommit` 取自
   `gh pr view <n> --json state,mergedAt,mergeCommit`。**不得**以 `gh pr merge --rebase` 的
   "Not possible to fast-forward" 提示作为未合并的证据（该提示会误报）。
4. **R4（Status 与目录同步）** 变更 `Status` 时**必须同步 `git mv` 目录**（`review/` → `done/`），
   二者不一致即视为未完成。
5. **R5（滞后指针清理）** 回写时**必须**一并修正被回写任务中指向「待办/待合并/待审查」的
   `Next Action` 与 `Current State` 表述 —— 那些动作已发生，文字不会自动失效。
6. **R6（X4 修复最小化）** 修复 X4 **只允许**改 `server/scripts/smoke.ts`，
   且**不得**为使其变绿而：
   - 删除 17.9 段的任何断言（那是 TASK-025/028 的验收覆盖，删掉等于抹掉历史任务的验证）；
   - 放宽 `check()` 的判定条件；
   - 把 `poolId` / `planId` 改成 `null` 或 `undefined` 绕过外键
     （那会让用例不再真正验证「已绑定客户的订阅」路径 ⇒ **自我欺骗**）。
7. **R7（README 只改失效断言）** `projects/README.md` 的修改**仅限**纠正失实描述，
   **不得**借机扩写项目介绍、重排章节或改动其它项目的条目。
8. **R8（负向断言自检）** 落笔前对每个新写入的事实断言，
   **逐条**用命令复算（不得凭印象）。凡写「已为空 / 全部完成 / 均未配置」的否定性断言，
   尤其须实查（`AGENTS.md` §13 第 5 条）。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | X4 修复**不得引入新依赖**；复用既有 `req()` / `check()` 辅助函数 |
| 流程 | 回写提交 footer 用 `Refs: TASK-041` / `Refs: TASK-042` / `Refs: TASK-043`（**按被回写对象分别标注**） |
| 流程 | 合并用 `rebase-merge`（`AGENTS.md` §14.2），**禁止直推 `main`** |
| 流程 | 只用**显式路径** `git add`（禁 `git add -A` / `git add .`） |
| 范围 | 超出 File Scope 的改动必须先更新本字段并说明理由 |
| 环境 | 冒烟须用**隔离环境**（`VACUUM INTO` 快照 + `PORT=3002` + `SMOKE_BASE_URL`），脚本须放 `server/` 下 |
| 安全 | 不读取、不打印、不提交任何 secret 值 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-041 已合并 `main` | blocks（本任务回写其 Merge Record） | ✅ `72d8f28`（PR #13，`2026-10-16T18:09:53Z`） |
| TASK-042 已合并 `main` | blocks（本任务回写其 Merge Record） | ✅ `b62e981`（PR #14）/ `f2a63bc`（PR #15 档案回写） |
| 基线 `f2a63bc` | blocks | ✅ `main` = `origin/main` = `f2a63bc`，工作区干净 |
| 分支保护（必需检查 `install-lint-build` + `audit`） | external | ✅ 已生效 |

> 无未满足的 `blocks` 依赖 → 本任务可进入 `ACTIVE`。

---

## Acceptance Criteria

> 每条必须能用「是 / 否」回答，且**必须附原始输出**（命令 + 退出码 + 关键行），
> 不接受「已通过」式陈述。

- [ ] **AC-1（前置基线）** 执行位开工前实测并留档：`git rev-parse main origin/main` 均为 `f2a63bc`、
      `git status --short` 为空、`gh pr view 13/14/15 --json state` 全部 `MERGED`。
      证据：handoff 中的原始输出
- [ ] **AC-2（TASK-041 回写）** `Merge Record` 九要素全部实查回填、无「待回填」残留；
      SHA 映射表逐对验证通过（`git cat-file -t` 两侧均为 `commit` + `%t` 相同 +
      `git merge-base --is-ancestor <post> origin/main` 通过），并登记**对数**。
      证据：handoff 中的验证命令与输出
- [ ] **AC-3（TASK-041 归档）** `Status: REVIEW → DONE`，且 `git mv` 后路径为
      `tasks/done/TASK-041-customer-expire-required/TASK.md`；
      `Status` 与目录**自洽**；其 `Next Action` 不再指向已完成动作。
      证据：`git status` 路径 + `grep "^Status:"` 输出
- [ ] **AC-4（TASK-042 回写与归档）** 同 AC-2 / AC-3 处理 TASK-042；
      其 `Merge Record` 须含 PR #14（代码）与 PR #15（档案回写）两次合并事实。
      证据：同上
- [ ] **AC-5（README 修正）** `projects/README.md` 第 107/117-118/134 行的失效断言已纠正为实况
      （`done` 数量、`review` 现状、已推进到 TASK-042）；`git diff --stat` 显示**仅此一个文件**、
      且改动行数与纠正处数量相符（无夹带）。
      证据：`git diff --stat` + `git diff` 全文 + `ls tasks/*/` 计数复算
- [ ] **AC-6（X4 修复 · 正向）** 第 17.9.1 段不再引用第 13 段已删除的 `pool` / `plan`；
      上述 **4 项断言在冒烟中全部通过**（原为 4 项 `FOREIGN KEY` 失败）。
      证据：冒烟原始输出中该 4 项为通过态
- [ ] **AC-7（X4 修复 · 未自我欺骗）** 17.9 段的**断言数量与名称未被删改**（修复前后逐项对照，
      仅允许**新增**用于创建独立资源的检查，不允许减少或放宽）；
      `check()` 判定条件未被放宽；`poolId` / `planId` **未**被置空绕过。
      证据：修复前后该段 `check(` 调用清单对照 + `git diff` 全文审阅
- [ ] **AC-8（本地验证全绿）** `pnpm build:shared` / `pnpm typecheck:server` / `pnpm lint` /
      `pnpm format:check` / `pnpm test` 全部退出码 0；`python scripts/audit-repo.py` `PASS=7 FAIL=0 WARN=0`；
      `python ../../shared/scripts/audit_framework.py` 不新增 FAIL。
      证据：各命令原始输出摘要
- [ ] **AC-9（冒烟整体无回归）** 修复后冒烟**通过项增加且失败项减少**；
      剩余失败项须逐项说明是否与本任务相关（基线固有项照实登记，**不得**顺手扩大修复范围）。
      证据：修复前基线（`f2a63bc`）与修复后**同一环境**的冒烟结果对照
- [ ] **AC-10（交付请求）** 按 `.github/PULL_REQUEST_TEMPLATE.md` 填全 PR 描述；
      两个必需检查 `install-lint-build` + `audit` **SUCCESS**；
      **不自行合并**（`Requires Human Approval: true`），交主控位审查。
      证据：`gh pr view <n> --json statusCheckRollup`
- [ ] **AC-11（本任务档案）** `Changed Files` / `Known Issues` / `Current State` / `Handoff` 如实填写；
      `Status → REVIEW` 且目录 `git mv` 至 `tasks/review/`；
      **`Merge Record` 按 D13-C 选项 C 留待第十实例回填**（须显式标注，不得填「待回填」以外的猜测值）。

---

## File Scope

```yaml
File Scope:
  - tasks/review/TASK-041-customer-expire-required/**    # 回写 + 迁出
  - tasks/review/TASK-042-ci-server-typecheck-and-release-gate/**   # 回写 + 迁出
  - tasks/done/TASK-041-customer-expire-required/**      # git mv 目标
  - tasks/done/TASK-042-ci-server-typecheck-and-release-gate/**  # git mv 目标
  - tasks/active/TASK-043-archive-writeback-and-smoke-x4/**
  - server/scripts/smoke.ts            # 仅 X4 修复
Non-Scope (files):
  - src/**
  - server/src/**
  - server/drizzle/**
  - shared/**
  - .github/**
  - Dockerfile
  - docker-compose.yml
  - package.json
  - pnpm-lock.yaml
  - CHANGELOG.md
  - AGENTS.md                          # 本任务不新增 CI job / 不改规范
  - .agents/**                          # 框架快照，项目内只读
  - templates/**                        # 框架快照，项目内只读
  - docs/**
  - server/scripts/*.ts                 # 除 smoke.ts 外的其它脚本
```

> **⚠️ `projects/README.md` 在 Workspace 侧，不在本仓库内** ⇒ 它**不由本任务的 PR 承载**。
> 见下方「跨仓修改的处置方式」。

---

## 跨仓修改的处置方式（`projects/README.md`，须先读）

`projects/README.md` 位于 **Workspace 仓库**（`E:/NDLDSN-WORKSPACE`），而 `projects/shadcn-admin/`
是**独立 Git 仓库** ⇒ **一个 PR 无法同时承载两处改动**。

**处置（执行位按此顺序做，不得自行发明方案）：**

1. 在本任务分支内**只**完成 shadcn-admin 侧的改动（AC-1 ~ AC-4、AC-6 ~ AC-10）。
2. `projects/README.md` 的修正（AC-5）在 **Workspace 侧单独提交**，
   提交信息注明「随 TASK-043 的 AC-5」，**不**夹带其它 Workspace 改动。
3. Workspace **本身不是 Git 仓库**（`projects/README.md:144` 明确记载）⇒
   第 2 步若 `git` 命令不可用，**如实上报主控位**，由人类决定是否 `git init`
   （该操作会牵涉嵌套仓库问题，`AGENTS.md` §11 有专门说明）⇒
   **执行位不得自行 `git init`**。
4. 若 Workspace 无法提交，则 AC-5 的完成形态为「**已修改 + 已在 handoff 中留痕**」，
   并在 `Known Issues` 中登记「Workspace 侧改动未纳入版本控制」。

---

## Implementation Plan

### Phase 1 — 前置基线与 X4 修复（先做代码，因其需跑冒烟、耗时最长）

1. `git fetch origin && git switch main && git pull --ff-only` → 确认 HEAD = `f2a63bc`。
2. `git switch -c chore/TASK-043-archive-writeback-and-smoke-x4`
3. **基线冒烟（必做，用于 AC-9 对照）**：按「环境与运维」约定搭隔离环境
   （`VACUUM INTO` 快照 → `db:migrate` → `PORT=3002` + `SMOKE_BASE_URL`），
   在**未做任何修改**的 `f2a63bc` 上跑 `pnpm --filter server smoke`，**全量保存输出**。
   ⇒ 确立「修复前」的通过/失败基线。
4. 阅读「X4 技术分析」节，以**符号名**（而非行号）定位第 13 段删除点与第 17.9.1 段引用点。
5. 实施修复。**推荐方案**（执行位可提出更优方案，但须满足 R6/R7）：
   - 在 17.9.1 段**之前**创建**独立的** `richPool` / `richPlan` 资源
     （名称带 `suffix` 保持可辨识），并**在本段末尾的清理块中一并删除**
     （与该段既有的「清理：删除订阅 + 停用两渠道」风格一致）。
   - 把 `richCustomer.body.poolId` / `planId` 与 `richSub2.body.poolId` 改指向新资源。
   - **不得**复用已删除的 `pool` / `plan`（它们已不存在）。
   - **不得**把外键置空绕过。
6. 跑**同一隔离环境**的冒烟，确认 4 项断言转通过，且**通过项增加、失败项减少**（AC-9）。

### Phase 2 — 归档回写（纯文档）

7. 实查 TASK-041 的九要素（R2 逐对验证 SHA 映射），回填其 `Merge Record`；
   同步修正其 `Current State` / `Next Action` 等滞后表述（R5）。
8. `Status: REVIEW → DONE`，`git mv` 至 `tasks/done/`（R4）。
9. 同 7–8 处理 TASK-042（须含 PR #14 与 #15 两次合并事实）。
10. 提交（footer 分别用 `Refs: TASK-041` / `Refs: TASK-042` / `Refs: TASK-043`），
    推送分支，开 PR。

### Phase 3 — Workspace 侧与交付

11. 按「跨仓修改的处置方式」处理 `projects/README.md`。
12. 跑 AC-8 的全部本地验证。
13. 提交本任务自身档案（`Status → REVIEW` + 迁 `review/`），footer `Refs: TASK-043`。
14. 开 PR → 等两必需检查 SUCCESS → **停下**，交主控位审查与人类授权合并。
    **执行位不得合并、不得直推 `main`。**

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 | 本地 + 平台 | `git rev-parse main origin/main`；`git status --short`；`gh pr view 13/14/15 --json state,mergedAt,mergeCommit` |
| AC-2 | 平台 + Git | `gh pr view 13 --json state,mergedAt,mergeCommit,additions`；`git log --oneline <pre>..<post>`；SHA 映射逐对：`git cat-file -t <sha>` + `git show -s --format=%t <sha>` + `git merge-base --is-ancestor <post> origin/main` |
| AC-3 | 文件 + Git | `git status --short`（应见 `R` 重命名）；`grep "^Status:" tasks/done/TASK-041-*/TASK.md`；`grep -n "Next Action" …` |
| AC-4 | 同上 | 对 `tasks/done/TASK-042-*/TASK.md` 重复 |
| AC-5 | 文件审阅 | `git diff` 全文 + `ls -1 tasks/*/ \| wc -l` 复算 |
| AC-6/9 | 本地冒烟 | 隔离环境下 `pnpm --filter server smoke`，与 Phase 1 步 3 基线**同环境**对照 |
| AC-7 | 文件审阅 | 修复前后 `check(` 调用清单对照（可用 `grep -n "check("` 前后 diff）+ `git diff server/scripts/smoke.ts` 全文 |
| AC-8 | 本地命令 | `pnpm build:shared` → `pnpm typecheck:server` → `pnpm lint` → `pnpm format:check` → `pnpm test` → `python scripts/audit-repo.py` → `python ../../shared/scripts/audit_framework.py` |
| AC-10 | 平台查询 | `gh pr view <n> --json statusCheckRollup,mergeable,mergeStateStatus` |
| AC-11 | 文件审阅 | 主控位读 `TASK.md` 实际内容 |

---

## Current State

**REVIEW（review/）—— 实施已完成，待主控位审查；PR 已开立，等两必需检查 SUCCESS 后停下。**

### AC 完成情况（逐条附证据）

- [x] **AC-1（前置基线）** `git rev-parse main origin/main` 均为 `f2a63bc48ce50a165db0d338bb1465bcfa4d2c31`；
      `git status --short` 仅本任务档案（未跟踪目录，设计阶段产物）；
      `gh pr view 13/14/15 --json state,mergedAt,mergeCommit` 全部 `MERGED`
      （`72d8f28` / `b62e981` / `f2a63bc`）。✅ 与档案一致，无需 fetch 修正。
- [x] **AC-2（TASK-041 回写）** 九要素全部实查回填，无「待回填」残留；SHA 映射 **6 对**，
      逐对验证：两侧 `git cat-file -t` 均为 `commit`、`%t` tree 相同
      （`874fbc6` / `d143283` / `d524c07` / `a135983` / `fa48db3` / `d788b4a`）、
      post 侧 `git merge-base --is-ancestor … origin/main` 全部通过。**6/6 通过。**
- [x] **AC-3（TASK-041 归档）** `Status: REVIEW → DONE`；`git mv` 后路径为
      `tasks/done/TASK-041-customer-expire-required/TASK.md`；Status 与目录自洽；
      `Next Action` 已改为「无待办」，不再指向已完成动作。
- [x] **AC-4（TASK-042 回写与归档）** 同 AC-2/AC-3；其 `Merge Record` 已含
      **PR #14（代码，4 对）与 PR #15（档案回写，2 对）共 6 对** SHA 映射，
      并单列 PR #15 合并事实（`merged_at 2026-10-17T06:45:04Z` / `f2a63bc` / run `39011065238`）。
- [x] **AC-5（README 修正）** `projects/README.md` 三处失效断言已纠正（`done` **41** 个、
      `review`/`backlog` 为空、`active` 为 TASK-043、已推进到 TASK-042，任务清单补 023–042）。
      ⚠️ **Workspace 侧改动，不在本 PR 内** —— 实测 `E:/NDLDSN-WORKSPACE` **不是 Git 仓库**
      （`git rev-parse --is-inside-work-tree` → `fatal: not a git repository`），
      按纪律**未**自行 `git init`；完成形态为「已修改 + 已在 handoff 留痕」。
- [x] **AC-6（X4 修复 · 正向）** 17.9.1 段前新增**独立的** `richPool` / `richPlan`
      （名称 `smoke-pool2-*` / `smoke-plan2-*`），`richCustomer` 与 `richSub2` 的
      `poolId` / `planId` 改指新资源，本段末尾清理块一并删除。
      隔离环境复跑：**159 通过 / 0 失败**，原 4 项 `FOREIGN KEY` 断言**全部转通过**。
- [x] **AC-7（X4 修复 · 未自我欺骗）** 17.9 段 `check(` 调用数 **4 → 6**（仅新增 2 项资源创建检查，
      未减少）；既有 4 项断言名称与判定条件**逐字未改**；`check()` 判定无放宽；
      `poolId` / `planId` 均指向真实创建的资源 ID（非 null / undefined）。
- [x] **AC-8（本地验证全绿）** `pnpm build:shared` ✅ / `pnpm typecheck:server` ✅ /
      `pnpm lint` ✅（无输出）/ `pnpm format:check` ✅（All matched files use Prettier code style!）/
      `pnpm test` ✅（**27 文件 / 345 passed**）/ `python scripts/audit-repo.py`
      **PASS=7 FAIL=0 WARN=0** ✅ / `python ../../shared/scripts/audit_framework.py`
      **PASS=13 FAIL=0 WARN=0 SKIP=0** ✅（不新增 FAIL）。
- [x] **AC-9（冒烟整体无回归）** 修复前基线（同一隔离环境：`VACUUM INTO` 快照 +
      `db:migrate` + `PORT=3002` + `SMOKE_BASE_URL`）**153 通过 / 4 失败**；
      修复后 **159 通过 / 0 失败** ⇒ **通过项 +6、失败项 −4，无回归、无剩余失败项**。
      4 项原失败即 X4 目标断言（`richCustomer` / `richSub2` / `richSync2` / `richTg2`）。
- [x] **AC-10（交付请求）** 按 `.github/PULL_REQUEST_TEMPLATE.md` 填全 PR 描述；
      **PR #16** 已开立，`install-lint-build` + `audit` **双绿**（`statusCheckRollup` 实测），
      `mergeable: MERGEABLE` / `mergeState: CLEAN`；
      **未自行合并**（`Requires Human Approval: true`），交主控位审查与人类授权。
      > 防腐注：上述 head / CI 结论为**撰写时点快照**；合并门禁以**合并时点 head 的 run** 为准。
- [x] **AC-11（本任务档案）** 见本文件 `Changed Files` / `Known Issues` / `Current State` / `Handoff`；
      `Status → REVIEW` 且目录 `git mv` 至 `tasks/review/`；
      `Merge Record` 按 D13-C 选项 C 显式标注「待第十实例回填」。

### 冒烟环境（AC-6 / AC-9 的可复现口径）

```text
快照：  VACUUM INTO 'E:/NDLDSN-WORKSPACE/.tmp-t043/smoke.db'（源：server/data/app.db）
迁移：  DATABASE_URL=<快照> pnpm db:migrate
服务：  PORT=3002 + TELEGRAM_API_BASE=127.0.0.1:3998 + FEISHU_API_BASE=127.0.0.1:4000
冒烟：  SMOKE_BASE_URL=http://127.0.0.1:3002 pnpm --filter server smoke
```

> Telegram / 飞书 mock 由 `smoke.ts` **内嵌启动**（3998 / 4000），故快乐路径全通；
> 与 TASK-041 基线中「mock 未启动」的 7 项失败**不是同一环境口径**，
> 本任务的 153/4 基线是在 mock 已启动的环境中测得的。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `server/scripts/smoke.ts` | 修改 | **X4 修复**：17.9.1 段前新增独立 `richPool`/`richPlan`（+2 项 `check`），`richCustomer`/`richSub2` 外键改指新资源，段末清理块补删两资源 |
| `tasks/done/TASK-041-customer-expire-required/TASK.md` | 回写 + 迁出 | Merge Record 九要素 + 6 对 SHA 映射实查回填；Status `REVIEW → DONE`；修正 Meta/顶部括注/Next Action/Current State 滞后指针 |
| `tasks/done/TASK-042-ci-server-typecheck-and-release-gate/TASK.md` | 回写 + 迁出 | Merge Record 补全为九要素 + PR #14/#15 共 6 对 SHA 映射 + PR #15 独立节；Status `REVIEW → DONE`；修正 Meta/编号说明/Current State/Next Action 滞后指针 |
| `tasks/done/TASK-041-customer-expire-required/handoffs/*` | 迁出（零内容改动） | `git mv` 随目录 |
| `tasks/done/TASK-042-ci-server-typecheck-and-release-gate/**` | 迁出（零内容改动） | `git mv` 随目录（含 `artifacts/` 与 4 份 handoff） |
| `tasks/active/TASK-043-archive-writeback-and-smoke-x4/**` | 新增 | 本任务档案 + 派遣交接 |

> **范围自证（AC-5 反夹带）：** 本 PR 的 `git diff HEAD --stat` 仅涉及
> `server/scripts/smoke.ts` 与 `tasks/**`，**未触及** `src/**` / `server/src/**` /
> `shared/**` / `.github/**` / `package.json` / `pnpm-lock.yaml` / `CHANGELOG.md`。
> `projects/README.md` 在 Workspace 侧，**不在本 PR 内**（见 AC-5 与 KI-B）。

---

## Known Issues

- **KI-A（鸡生蛋 · D13-C 固有）** 本任务自身合并后，其 `Merge Record` 留待**第十实例**回写。
  这是 D13-C 选项 C 的固有代价（TASK-041 已在设计中论证）。**不得**在本任务内自我回写。
- **KI-B（跨仓 AC-5，**已实测确认**）** `projects/README.md` 位于 Workspace 侧，
  **不在本任务 PR 范围内**。实测 `E:/NDLDSN-WORKSPACE` **不是 Git 仓库**
  （`git rev-parse --is-inside-work-tree` → `fatal: not a git repository`）⇒
  该改动**无法纳入版本控制**。已按「跨仓修改的处置方式」第 4 条处置：
  **已修改 + 已在 handoff 留痕**；**未**自行 `git init`（涉及嵌套仓库问题，`AGENTS.md` §11），
  由人类决定是否 `git init`。
- **KI-C（口径提示，非缺陷）** 本任务的冒烟基线（153/4）与 TASK-041 档案记载的
  「7 项失败」**不是同一环境口径**：本任务环境中 `smoke.ts` 内嵌启动了
  Telegram / 飞书 mock（3998 / 4000），故通知类断言全通。
  TASK-041 的 X3 结论在其自身环境下依然成立，**本任务未改动该结论**。
- **KI-D（环境残留，非仓库文件）** 隔离环境快照位于仓库外的
  `E:/NDLDSN-WORKSPACE/.tmp-t043/`（不在 Git 工作区内，不影响 `git status`）。
  冒烟用的 :3002 服务进程已在取证后关闭。

---

## Merge Record

> **按 D13-C 选项 C：本表由下一个任务（第十实例）回填。**
> **不得在本任务内自我回写**（那将造成档案与提交历史不一致）。

| 要素 | 值 |
|------|-----|
| PR | **待第十实例回填** |
| 合并策略 | rebase-merge（预期，`AGENTS.md` §14.2） |
| 提交数 | 待第十实例回填 |
| merged_at | 待第十实例回填 |
| merge_commit_sha | 待第十实例回填 |
| 合并后 CI | 待第十实例回填 |
| D8 解耦 | 待第十实例回填 |
| 独立审查 | 待第十实例回填 |
| SHA 映射 | 待第十实例回填 |

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | 主控位 coordinator | 执行位 implementer | 2026-10-17 | 任务登记 + 设计（四项范围 / X4 技术分析 / File Scope / 跨仓处置 / 12 条 AC） |
| 002 | 执行位 implementer | 主控位 coordinator | 2026-10-17 | 实施完成交付（X4 修复 + 041/042 回写 + README 修正 + AC 证据 + 跨仓不可提交上报） |

**最新 Handoff：** `handoffs/HANDOFF-002-implementer-to-coordinator.md`
**Next Action：** 主控位审查本 PR（读实际 diff，不读描述）→ PASS 后由**人类显式授权**、
主控位执行 `rebase-merge`。**执行位不得自行合并、不得自行判定 PASS。**

---

## Task Rules

> 本任务特有的规则覆盖。

- [补充] **实查优先于档案自述**：本任务的每一项事实断言都必须由执行位**实跑命令**复算。
  档案里的值（B1–B7）是主控位 2026-10-17 的实测快照，**行号与计数可能随提交漂移**，
  一律以符号名 / 现查结果为准。
- [补充] **X4 修复的自我欺骗防线（R6）**：不得删断言、放宽 `check()`、或把外键置空绕过。
  审查必查的三点：① `check(` 调用数只增不减；② 判定条件无放宽；③ `poolId`/`planId` 非空。
- [补充] **回写范围仅限 `tasks/**` 与 `server/scripts/smoke.ts`**：
  不得借归档回写夹带任何产品代码或配置改动。
- [增强] **实现者 ≠ 批准者**：执行位完成实施后**不得**自行合并 PR、**不得**自行判定 PASS。
  合并须经**人类显式授权** + **主控位**执行 `rebase-merge`。
- [增强] **禁止提交新 tag / 触发发布**：本任务不含任何对外发布动作。
- [补充] **跨仓纪律**：不得自行对 Workspace 执行 `git init`（会牵涉嵌套仓库问题，`AGENTS.md` §11）。

---

## Notes

**给执行位的实操提醒：**

1. **冒烟隔离环境**：`server/scripts/` 下用 better-sqlite3 `VACUUM INTO` 做快照，
   再 `db:migrate`，然后 `PORT=3002` + `SMOKE_BASE_URL` 起后端。
   ⚠️ **authMiddleware 前置拦截 `/api/*`** ⇒ **不能凭 401/404 判断路由是否存在**。
2. **`authMiddleware` 与 mock 上游**：TASK-041 记录基线固有失败中有「Telegram/飞书 mock 未启动」
   一类。执行位须如实区分「本任务修好了 X4」与「环境导致的其他失败」，
   **不得**把环境问题混报为修复失败，也不得把环境问题算作已修复。
3. **行号会漂移**：TASK-041 档案里的 `L1724` / `L1742` / `L2501` / `L2528` 是**当时**的值。
   本任务**必须**用符号名（`const pool`、`删除供应商`、`// 17.9.1`）定位。
4. **`.prettierignore` 是白名单**：`server/scripts/*.ts` 若在白名单内则不被 `format:check` 覆盖，
   但 `lint` 会覆盖 ⇒ 保持与周边一致风格即可。
5. **纯文案提交会触发新一轮 CI** ⇒ 回写与 X4 修复**合批提交**，不要拆成多个纯文档提交。