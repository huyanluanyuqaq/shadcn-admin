# TASK-055 — 归档回写收口（051/052/053/054 四份 Merge Record）+ 邮箱绑定残留三项

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-055
Title: 归档回写收口（四份 Merge Record）+ 邮箱绑定残留三项
Workflow: maintenance
Status: ACTIVE
Priority: P1
Owner: Codex（执行位 · developer）
Owner Since: 2026-11-02T11:00:00+08:00
Assigned Role: developer
Created: 2026-11-02T10:30:00+08:00
Updated: 2026-11-02T12:10:00+08:00
Branch: fix/TASK-055-archive-backfill-and-email-binding-residuals
```

## Objective

1. **清偿 D13-C 欠账**：把 `tasks/review/` 下 **四份**（TASK-051 / 052 / 053 / 054）任务的
   `## Merge Record` 九要素按实测值回填、`Status → DONE`、移入 `tasks/done/`。
2. **闭合邮箱绑定残留三项**：`PATCH` 不存在 id 的 404 语义、`smoke.ts` 从未实跑、
   真实库大小写重复数据从未核查。

## Background

- PR **#27**（TASK-054，携带 TASK-052/053 的实现）已于 `2026-11-02T02:09:31Z` 以 rebase-merge 落地，
  `main` 从 `e563800` 前进到 `2ca5d50`；合并后 CI run `41376188754`、Docker run `41376188853` 均 success。
- 按 D13-C（`.agents/rules/github.md` §6），合并后回写**并入下一个任务的交付请求**，因此四份任务档案
  现在都停在 `Status = REVIEW` + `## Merge Record` 全「待回填」。
- **TASK-051 的欠账已滚过三轮**：它随 PR #26 于 `2026-10-31T12:04:52Z` 合并，本应由 TASK-052 补记，
  但 052/053/054 三轮都只做自己的事，未回填它。本任务**必须一并清偿**，否则「至多延后一个任务」的
  终止条件（`github-collaboration.md` §224）已被突破。
- rebase-merge **改写了全部 SHA**：审查记录里引用的 `767c149`/`8caab4f`/`be7c2f2`/`074e557`/`51b7c04`/
  `bee2610`/`07e5217` 在当前仓库中**已不存在**。回写若不附映射表，「审查记录可复现性」立即失效。

## Scope

| 组 | 内容 | 是否需要代码改动 |
|----|------|------------------|
| **R（回写）** | 051 / 052 / 053 / 054 四份档案的 Merge Record 九要素 + Status + 目录 | 否 |
| **S（SHA 映射）** | 在 052 / 053 / 054 三份档案中各加一张「审查时 SHA → main 上 SHA」映射表 | 否 |
| **C（代码）** | `PATCH /email-bindings/:id` 对**不存在的 id** 应返回 404，而非先命中判重返回 409 | 是（约 4 行） |
| **V（验证）** | 实跑 `server/scripts/smoke.ts`（从未跑过），重点取 `NULL 互异` 用例的真实结果 | 否 |
| **D（数据核查）** | 真实库 `server/data/app.db` 的**只读**脏数据核查报告 | 是（脚本，只读） |

## Non-Scope

- **不做并发竞态压测**。理由：`better-sqlite3` 是同步驱动、Node 单进程内 `db.transaction()` 的
  「判重 + 写入」不存在交错；能打破它的只有多进程同时写同一库，而本项目的部署形态（单容器 + 单进程）
  不产生该场景。压测会得出一个与本系统无关的数字，价值低于成本。**登记为长期观察，不在本任务做**。
- **不改客户表的 `beforeWrite`**。它有不完全相同的 409/404 次序问题，但属另一个任务的边界；
  改它会把本任务的回归面从「一张表」扩到「两张表 + 客户表单」。
- **不清理真实库里的重复数据**（D 组只出报告）。写操作处置权在人类，不在执行位。
- 不加 schema、不加索引、不写迁移、不引依赖；不打 tag、不发布镜像（发布走 `v1.0.x` 单独流程）。
- 不重写任何历史 handoff 记录里的旧数字与旧 SHA（历史记录不得篡改），只做**追加**映射表。

## Requirements

### R 组：四份 Merge Record（九要素，全部实测值）

每份的每一格都必须能被他人在同一仓库用 `gh api` / DockerHub Tags API **当场复现**，且要写明所用命令。
**禁止**照抄本文件下文「交叉核对值」——那是给复核用的，不是给填空用的；实测与交叉核对值不一致时，
**以你实测为准并在该格注明差异原因**。

| 档案 | PR | merge_commit_sha | merged_at | 合并 run（CI / Docker） | 镜像 tag |
|------|----|------------------|-----------|--------------------------|----------|
| TASK-051 | #26 | `e563800334ab676644d1f5c1f1bf1fb58962dd38` | `2026-10-31T12:04:52Z` | `41199514208` / `41199514198` | `sha-e563800` |
| TASK-052 | #27 | `2ca5d506d0c4f3da8b8d12bc72844c79aef7a2ab` | `2026-11-02T02:09:31Z` | `41376188754` / `41376188853` | `sha-2ca5d50` |
| TASK-053 | 同 #27 | 同上 | 同上 | 同上 | 同上 |
| TASK-054 | 同 #27 | 同上 | 同上 | 同上 | 同上 |

- **052/053/054 三份共享同一 `merge_commit_sha`**，必须在每份里写明「与其余两份同批落地」，
  避免后来者误以为是三次独立合并。
- **「镜像 tag」格必须区分合并 run 与 tag 发布 run**：TASK-051 另有 `41202023831`
  （`v1.0.7`，`event=push`，`head_branch=v1.0.7`）属**发布 run，不是合并 run**；
  `latest` 至今仍指向 `sha256:b6da326e…`（=`v1.0.7`=`sha-e563800`），**合并没有推进 `latest`**——
  这一句必须写进 052/053/054 三份，否则下次有人会以为「合并即发布」。
- **「审查记录」格必须如实，不得美化**：
  - TASK-051 → `handoffs/2026-10-31-review.md`（I2 独立审查）+ 三份 `-coordinator-review*.md`；
  - TASK-052 → `handoffs/2026-11-02-review.md`（独立审查，AC-1/6/8 判为「已被裁决取代」）
    + `2026-11-01-review.md` / `2026-11-01-coordinator-review.md`（上一轮）；
  - TASK-053 → `handoffs/2026-11-02-review.md`（同一文件两节：首轮 **FAIL** + 第二轮复核 **PASS**）；
  - TASK-054 → `handoffs/2026-11-02-coordinator-review.md`（主控位级，与实现实例不同）
    **并须明写「无 AC 加严级独立实例审查」**。该任务的 bundle 接口缺陷（判重 ① 大小写）正是由
    审 053 的独立实例顺带指出的，属**旁及**，不能据此声称 054 已被独立审查。

### S 组：SHA 映射表（防止审查记录失效）

在 052 / 053 / 054 三份档案的 `## Merge Record` 之后（或 `## Notes` 内）各加一张表，逐行给出
「审查时 SHA → main 上 SHA」。至少覆盖以下九个（执行位须用
`git log --format=%H -1 <旧SHA>` 自我验证不可得、再用 `git log e563800..2ca5d50 --oneline` 与
提交标题逐条对应确认新 SHA，**不得直接照抄**）：

```
767c149 → d270802    TASK-052/053 实现提交
068bb5d → 5672338    TASK-054 实现提交（含 052/053 的 5 个混合文件）
8caab4f → 1551bb9    TASK-054 被审 head
be7c2f2 → a501c79    主控位首轮审查记录
074e557 → 53e756c    大小写修复
a65970a → 8ba2c09    文档/档案校正
51b7c04 → 20d5d4c    CRUD beforeWrite
bee2610 → b9f9879    身份比对重写
07e5217 → 2ca5d50    收口（= merge commit）
```

### C 组：PATCH 不存在 id 的 404 语义

现状：`server/src/lib/crud.ts:280` 先调 `beforeWrite`、`:299` 才 `notFound`。因此
`PATCH /api/email-bindings/999999` 携带一个撞车邮箱时会返回 **409** 而不是 **404**。

改法（只改 `resources.ts` 里 `/email-bindings` 的 `beforeWrite`，**不动 `crud.ts`**）：
`id !== null` 且按 id 查不到本行现值时，**直接 `return null`** 放行，让 CRUD 走到自己的 404。

### V 组：smoke.ts 实跑

用隔离快照库（`VACUUM INTO`）启动服务，**不得**写真实库。必须记录：

- 通过/失败数、退出码；
- `18.x`「同一邮箱在未指定供应商下可单独绑定（NULL 互异）」那一条的**真实结果**
  （该用例此前只有「读代码推断仍会通过」，`server/scripts/smoke.ts:984-995`）。

### D 组：真实库只读核查

对 `server/data/app.db` 用 `readonly: true` 连接，跑两条查询并把**原始结果**写进档案：

1. 大小写重复：按 `lower(email) + pool_id` 分组，`count(*) > 1` 的行；
2. 一事一邮箱被破坏：同一 `subscription_id` 下绑定行数 `> 1` 的情况。

**只报告不修改**。若命中非空，必须在 `## Known Issues` 登记并写「处置待人类裁决（清理 / 保留）」，
**不得**顺手写数据修复脚本。

## Constraints

- 分支名 `fix/TASK-055-archive-backfill-and-email-binding-residuals`，从 `main`（`2ca5d50`）切出。
- **禁止**直推 `main`、禁止 `--force`、禁止自我批准、禁止自行合并。
- 档案移动用 `git mv`（保留历史），**不要** `rm` + 新建。
- 任何「实测值」都必须是**你自己跑出来的**；本文件的数字只在复核阶段用于比对。
- `audit-repo.py` 必须保持 **0 FAIL**；移动档案后若 F8/F9 变红，先修好再交付（不得改豁免清单来让门禁变绿）。

## Dependencies

- `main` 处于 `2ca5d50`（已合并）；工作区应干净。
- 本机 `gh` 已认证（`repo` scope）；DockerHub Tags API 可匿名读。
- `smoke.ts` 运行需先起服务（见 Verification Plan 的完整配方）。

## Acceptance Criteria

- [x] **AC-1** TASK-051 的 Merge Record 九要素全部填实测值，且含「tag 发布 run `41202023831` ≠ 合并 run」的区分说明。
      **证据**：`tasks/done/TASK-051-backup-residual-closure/TASK.md` 的 `## Merge Record`；
      run `41202023831`（`event=push` `head_branch=v1.0.7`）与合并 run `41199514198`
      （`event=push` `head_branch=main`）由同一条 `gh api .../actions/runs?head_sha=e563800…`
      的输出区分，档案内已写明「tag 发布 run 不计入合并后 Docker run」。
- [x] **AC-2** TASK-052 的 Merge Record 九要素全部填实测值，含与 053/054 同批落地的说明。
      **证据**：`tasks/done/TASK-052-customer-edit-cross-page-sync/TASK.md`；
      原 6 字段旧表已补齐为九要素（「变更规模」并入「提交数」一行给出 `commits=9` /
      `changed_files=29`）；含「与 TASK-053 / TASK-054 同批落地」专段。
- [x] **AC-3** TASK-053 的 Merge Record 九要素全部填实测值，「审查记录」格写明**同一文件两节**（首轮 FAIL / 复核 PASS）。
      **证据**：`tasks/done/TASK-053-email-binding-states/TASK.md` 的「审查记录」行原文：
      「`handoffs/2026-11-02-review.md` —— **同一文件内含两节**：首轮 **FAIL**（阻塞项）+
      第二轮复核 **PASS**。两节均保留，未合并、未删除」。
- [x] **AC-4** TASK-054 的 Merge Record 九要素全部填实测值，「审查记录」格**如实写明「无 AC 加严级独立实例审查」**。
      **判定复现**：`grep -c "无 AC 加严级" tasks/done/TASK-054-*/TASK.md` = **1**（实跑通过）。
      档案内并注明 bundle 接口的判重 ① 大小写缺陷系审 053 的独立实例**旁及**指出，不据此声称 054 已被独立审查。
- [x] **AC-5** 四份档案 `Status: DONE` 且均已位于 `tasks/done/`；`tasks/review/` 下不再存在 TASK-051~054。
      **判定复现**（PowerShell 等价 glob）：`tasks/done/TASK-05[1-4]*` = **4**（051/052/053/054），
      `tasks/review/TASK-05[1-4]*` = **0**。移动用 `git mv`（非 rm+新建），
      每移动一份跑一次 `audit-repo.py`，四次均为 `PASS=9 FAIL=0 WARN=0`。
- [x] **AC-6** 052/053/054 三份档案各含 SHA 映射表，九组映射**逐条可核**。
      **判定复现**：三份档案各 **9 行**映射（`grep -c` 实测 9/9/9）；九个新 SHA 的
      `git log --format=%s -1 <新SHA>` 输出与映射表「标题」列逐字一致（已逐条实跑比对）。
      **额外自证**（档案要求的「不得直接照抄」）：九个旧 SHA 的 `git merge-base --is-ancestor <旧SHA> main`
      全部返回非 0（不可达），且新旧提交的 **tree 全部相同**（9/9），证明是同一份内容的 rebase 副本。
- [x] **AC-7** `PATCH /api/email-bindings/999999`（携带一个已存在的 `(email, poolId)`）返回 **404**，
      且 `email_bindings` 行数不变；脚本新增用例断言**状态码 + 行数**两项。
      **证据**：`email-binding-sync-check.ts` 新增「场景 12」，7 项断言（状态码 404 / message /
      行数不变 / 未新建行 + 3 项对照组证明判重未被削弱）。脚本总数由 55 → **62**，全过，退出码 0。
      改动本身只有 4 行（`if (id !== null && current === null) return null` + 3 行注释），
      位于 `resources.ts` 的 `beforeWrite`，**未动 `crud.ts`**。
- [x] **AC-8** `smoke.ts` 实跑结果写入档案：**168 通过 / 14 失败**，退出码 **1**。
      **`NULL 互异` 那一条实测通过**：`✓ 同一邮箱在未指定供应商下可单独绑定（NULL 互异）`
      —— 此前仅有「读代码推断仍会通过」，现已由实跑确认，**该用例未删、断言未改**。
      14 项失败的归属见下方「V 组实测记录」；其中与本任务相关的为 0 项（基线对照证明全部先于本次改动存在）。
- [x] **AC-9** 真实库只读核查两条查询的**原始结果**写入档案（见下方「D 组实测记录」）。
      **两条查询均返回 0 行**，但因 `email_bindings` 总行数为 **0**，该空结果是 **vacuous**
      （无数据可脏），**不等于数据干净**——已在档案与 Known Issues 中明确标注，防止被误读为「已清理」。
      核查前后真实库四表行数一致（`4 / 6 / 0 / 6`），`app.db` mtime 未变。
- [x] **AC-10** 全量门禁真实退出码全 0，断言数均不低于基线：

      | 门禁 | 结果 | 退出码 | 基线 |
      |------|------|--------|------|
      | `email-binding-sync-check` | 通过 **62** / 失败 0 | `0` | ≥ 55 ✓ |
      | `email-binding-bundle-check` | 通过 **68** / 失败 0 | `0` | ≥ 68 ✓ |
      | `vitest`（全量） | **27 文件 / 345 用例** | `0` | ≥ 345 ✓ |
      | `tsc -b` | 通过 | `0` | — |
      | `eslint .` | 通过 | `0` | — |
      | `prettier --check .` | All matched files use Prettier code style | `0` | — |
      | `knip` | 通过 | `0` | — |
      | `audit-repo.py` | **PASS=9 FAIL=0 WARN=0** | `0` | — |
      | `build:shared` / `typecheck:server` | 通过 | `0` / `0` | — |
- [x] **AC-11** 交付说明中列出「本次未做」清单，见下方「本次未做（与 Non-Scope 逐条对应）」小节，
      共 8 项，与 `## Non-Scope` 逐条对应，无扩大、无静默遗漏。

## File Scope

允许修改 / 移动：

```
tasks/review/TASK-051-backup-residual-closure/TASK.md        → git mv → tasks/done/…
tasks/review/TASK-052-customer-edit-cross-page-sync/TASK.md   → git mv → tasks/done/…
tasks/review/TASK-053-email-binding-states/TASK.md            → git mv → tasks/done/…
tasks/review/TASK-054-email-binding-atomic-provision/TASK.md  → git mv → tasks/done/…
server/src/routes/resources.ts                                 （beforeWrite 的 404 分支，约 4 行）
server/scripts/email-binding-sync-check.ts                     （新增用例）
server/scripts/dirty-data-audit.ts（新建，只读核查；若不建脚本则改为一次性命令并把命令写入档案）
```

**禁止修改**：`server/src/lib/crud.ts`、`server/src/db/**`、任何 `handoffs/*.md`、
任何 `tasks/done/TASK-001~050`、`.github/**`、`.agents/**`、`scripts/audit-repo.py` 的豁免清单。

## Implementation Plan

1. 切分支；`git status` 确认干净。
2. **先做 R/S 组**（纯档案，风险低）：逐份实测 → 填九要素 → 加映射表 → `Status: DONE` → `git mv` 到 `done/`。
   每移动一份跑一次 `python scripts/audit-repo.py`，确认 F8（章节位置）/F9（编号唯一性）仍 PASS。
3. **再做 C 组**：改 `beforeWrite` 的 404 分支 → 加脚本用例 → 跑 sync 脚本。
4. **再做 V 组**：按 Verification Plan 起隔离服务 → 跑 smoke → harvest 结果。
5. **最后做 D 组**：只读核查 → 结果写档案。
6. 全量门禁 → 提交（建议 2 个：档案回写 1 个、代码+脚本 1 个）→ 推分支 → 开 PR（PR 描述须覆盖
   `.github/pull_request_template.md` 的 10 个必需字段）→ 交主控位审查。

## Verification Plan

```bash
# 0) 基线
cd /e/NDLDSN-WORKSPACE/projects/shadcn-admin && git log --oneline -1   # 应为 2ca5d50

# 1) 档案门禁（每移动一份跑一次）
python scripts/audit-repo.py            # 判据：PASS=9 FAIL=0

# 2) 脚本（注意：必须在 server/ 下执行，仓库根会 ERR_MODULE_NOT_FOUND）
cd server && ./node_modules/.bin/tsx scripts/email-binding-sync-check.ts
cd server && ./node_modules/.bin/tsx scripts/email-binding-bundle-check.ts

# 3) 前端全量（.bin/vitest 是 shell 包装，用 vitest.mjs）
node node_modules/vitest/vitest.mjs run --browser.headless
node node_modules/typescript/bin/tsc -b
node_modules/.bin/eslint . ; node_modules/.bin/prettier --check . ; node_modules/.bin/knip

# 4) smoke.ts 实跑配方（隔离快照库，绝不写真实库）
cd server && node -e "const D=require('better-sqlite3');const s=new D('data/app.db');
  s.exec(\"VACUUM INTO 'E:/tmp/t055-smoke.db'\");s.close()"
mkdir -p /e/tmp/t055-smoke-data
DATABASE_URL=E:/tmp/t055-smoke.db PORT=3000 RESTORE_AUTO_EXIT=false SMOKE_DB_DIR=E:/tmp/t055-smoke-data \
  TELEGRAM_API_BASE=http://127.0.0.1:3998 FEISHU_API_BASE=http://127.0.0.1:4000 \
  node --import tsx src/index.ts        # 后台启动
cd server && SMOKE_BASE_URL=http://127.0.0.1:3000 SMOKE_DB_DIR=E:/tmp/t055-smoke-data \
  ./node_modules/.bin/tsx scripts/smoke.ts > /tmp/smoke.log 2>&1; echo exit=$?
```

- 判据写法一律 `cmd > /tmp/x.log 2>&1; echo exit=$?`（管道后的 `$?` 是最后一个命令的，不可信）。
- `smoke.ts` 若因缺 `RESTORE_AUTO_EXIT=false` 在第 19 段中途把服务端 `process.exit(0)` 杀掉，
  后续条目会 `ECONNREFUSED` —— 这属**环境配置错误**，不是产品缺陷，须按上表重跑。
- 跑完必须核对真实库未变：`email_bindings` / `subscriptions` / `customers` / `subscription_pool` 四表行数
  与步骤 4 开始时一致。

## Current State

**Status = ACTIVE（R/S/C/V/D 五组实施完毕，待主控位审查）。**

分支 `fix/TASK-055-archive-backfill-and-email-binding-residuals`，从 `main`（`2ca5d50`）切出。
四份档案已按实测值回填九要素并 `git mv` 至 `tasks/done/`，三份已加 SHA 映射表；
C 组 404 语义已修并补 7 项断言；V 组 smoke 已实跑两轮（改动后 + main 基线对照）；
D 组只读核查已完成。AC-1~AC-11 全部通过，全量门禁退出码均为 0。

### V 组实测记录（smoke.ts 实跑）

隔离快照库配方（**绝不写真实库**）：

```bash
# ① 真实库快照（VACUUM INTO，只读源库）
node -e "const D=require('better-sqlite3');const s=new D('data/app.db');
  s.exec("VACUUM INTO 'E:/NDLDSN-WORKSPACE/.t055-tmp/t055-smoke.db'");s.close()"
# ② 起隔离服务（DATABASE_URL 指向快照，RESTORE_AUTO_EXIT=false 防止 19.16 自杀，
#    SMOKE_DB_DIR 指向临时数据目录供 19.19 删恢复标记）
DATABASE_URL=…/t055-smoke.db PORT=3000 RESTORE_AUTO_EXIT=false SMOKE_DB_DIR=…/t055-smoke-data \
  TELEGRAM_API_BASE=http://127.0.0.1:3998 FEISHU_API_BASE=http://127.0.0.1:4000 \
  node --import tsx src/index.ts
# ③ 跑 smoke
cd server && SMOKE_BASE_URL=http://127.0.0.1:3000 SMOKE_DB_DIR=…/t055-smoke-data \
  ./node_modules/.bin/tsx scripts/smoke.ts
```

**改动后（本分支）实跑结果：**

```text
结果：168 通过 / 14 失败
REAL_EXIT_CODE=1
```

**`NULL 互异`（18.x）那一条的实测结论：通过。**

```text
  ✓ 同一邮箱重复绑定同一供应商返回 409（非 500）
  ✓ 同一邮箱在未指定供应商下可单独绑定（NULL 互异）
```

该条此前只有「读代码推断仍会通过」，本次由实跑确认。它**没有失败**，因此不存在
「是否推翻 NULL 收紧可接受」的问题；该用例未删、断言未改。

**14 项失败的归属（重要）**：为排除「是不是我改坏的」，把 `server/src/routes/resources.ts`
暂存回 `main` 版本（`git stash push -- server/src/routes/resources.ts`）后重跑一次基线，
结果**逐条完全相同**：

| 运行 | 通过 | 失败 | 退出码 | 失败清单 |
|------|------|------|--------|----------|
| 本分支（含 C 组改动） | 168 | 14 | `1` | 见下 |
| `main` 基线（`resources.ts` 回退） | 168 | 14 | `1` | **与左栏逐条相同** |

14 项失败分三簇，均**先于本任务存在**，本任务不处置（见「本次未做」）：

1. **流量阈值通知 7 项**（`{"notified":0,"rows":0}`）：`/api/reminders/scan` 未生成提醒行，
   连带「仪表盘 stats 返回 trafficThresholds」1 项，共 8 项中的 7 项阈值项 + 1 项仪表盘；
2. **邮箱绑定 sync 5 项**：被 TASK-053 的 R2 守卫（「一条订阅只能对应一个邮箱」）以 409 拒绝，
   smoke 脚本的期望写于该守卫之前，属**脚本期望过期**而非产品缺陷；
3. **备份恢复标记 1 项**（19.17 恢复标记 `filename` 读到的值与请求目标不符）。

> 说明：smoke.ts 当前整体为红（退出码 1）是**本任务之前就存在的状态**，不是本任务引入的回归。
> 本任务只负责「实跑并如实记录」，修这 14 项需另立任务。

### D 组实测记录（真实库只读核查）

连接方式：`better-sqlite3` + `{ readonly: true }` 连 `server/data/app.db`，全程不写。
**核查前后四表行数一致**（`subscription_pool=4` / `subscriptions=6` / `email_bindings=0` /
`customers=6`），`app.db` 的 mtime 保持 `2026-11-01 22:12:43` 未变。

**D-1 大小写重复**（`lower(email) + pool_id` 分组，`count(*) > 1`）：

```sql
SELECT lower(email) AS email_lower, pool_id, COUNT(*) AS n,
       GROUP_CONCAT(id) AS ids, GROUP_CONCAT(email) AS emails
  FROM email_bindings
 GROUP BY lower(email), pool_id
HAVING COUNT(*) > 1
 ORDER BY n DESC, email_lower
```

原始结果：**命中行数 0**，`[]`。

**D-2 一事一邮箱被破坏**（同一 `subscription_id` 下绑定行数 `> 1`）：

```sql
SELECT subscription_id, COUNT(*) AS n,
       GROUP_CONCAT(id) AS ids, GROUP_CONCAT(email) AS emails,
       GROUP_CONCAT(pool_id) AS pool_ids
  FROM email_bindings
 WHERE subscription_id IS NOT NULL
 GROUP BY subscription_id
HAVING COUNT(*) > 1
 ORDER BY n DESC, subscription_id
```

原始结果：**命中行数 0**，`[]`。

**必须同时读的判读前提**：`email_bindings` 总行数为 **0**（`pool_id IS NULL` 0 行、
`subscription_id IS NULL` 0 行）。因此上述两个空结果是 **vacuous（无数据可脏）**，
**不能**解读为「脏数据已清理」或「数据是干净的」。真实结论是：**该表当前没有数据，
两项规则在此库上未被检验**。若将来有数据后需重跑。

**脚本落地方式的偏差（如实记录）**：本任务曾按 File Scope 新建
`server/scripts/dirty-data-audit.ts`，但 `pnpm knip` 将其报为 unused file（退出码 1）——
knip 靠 `server/package.json` 的 script 入口识别脚本，而该文件**不在本任务 File Scope 内**。
按 File Scope 中「若不建脚本则改为一次性命令并把命令写入档案」的许可备选方案，
**已删除该脚本**，改为把上述两条 SQL 的一批次命令原样写入本档案。knip 复跑退出码 0。
（若后续任务要沉淀该脚本，需同时把 `server/package.json` 纳入其 File Scope。）

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `tasks/done/TASK-051-backup-residual-closure/TASK.md` | 修改 + `git mv` | Merge Record 九要素实测回填；新增「tag 发布 run ≠ 合并 run」与「latest 未被推进」两段 + 复现命令；`Status: REVIEW → DONE` |
| `tasks/done/TASK-052-customer-edit-cross-page-sync/TASK.md` | 修改 + `git mv` | 旧 6 字段表补齐为九要素；新增「同批落地」说明 + 复现命令 + 9 行 SHA 映射表；`Status → DONE` |
| `tasks/done/TASK-053-email-binding-states/TASK.md` | 修改 + `git mv` | 「未合并」段落替换为九要素表；「审查记录」写明同一文件两节（FAIL/PASS）；新增 9 行 SHA 映射表；`Status → DONE` |
| `tasks/done/TASK-054-email-binding-atomic-provision/TASK.md` | 修改 + `git mv` | 九要素回填；「审查记录」如实写明「无 AC 加严级独立实例审查」；新增 9 行 SHA 映射表；`Status → DONE` |
| `server/src/routes/resources.ts` | 修改 | C 组：`email-bindings` 的 `beforeWrite` 增加「id 非空且按 id 查不到本行 ⇒ 放行」分支（4 行，含注释） |
| `server/scripts/email-binding-sync-check.ts` | 修改 | 新增「场景 12」：PATCH 不存在 id → 404，含状态码 + 行数断言与 3 项对照组 |
| `tasks/active/TASK-055-…/TASK.md` | 修改 | 本档案：AC 勾选附证据、V/D 组实测记录、「本次未做」清单、Known Issues |
| `tasks/active/TASK-055-…/handoffs/HANDOFF-001-developer-to-reviewer.md` | 新增 | 交接记录 |

**未修改**（File Scope 禁止或未授权）：`server/src/lib/crud.ts`、`server/src/db/**`、
所有 `handoffs/*.md` 旧文、`tasks/done/TASK-001~050`、`.github/**`、`.agents/**`、
`scripts/audit-repo.py` 及其豁免清单、`server/package.json`（该文件不在 File Scope 内，
因此 D 组脚本改为一次性命令，见 Current State 的偏差记录）。

## Known Issues

1. **smoke.ts 当前整体为红（168 通过 / 14 失败，退出码 1），且先于本任务存在**。
   已用 `main` 基线对照证明 14 项失败与本任务改动无关（逐条相同）。三簇成因：
   ① 流量阈值通知 7 项 + 仪表盘 stats 1 项（`/api/reminders/scan` 未生成提醒行）；
   ② 邮箱绑定 sync 5 项被 TASK-053 的 R2 守卫 409 拒绝，**smoke 脚本期望过期**；
   ③ 备份恢复标记 1 项（19.17）。修哪一簇都需另立任务，**本任务不处置**。
2. **D 组两项脏数据查询的结果是 vacuous**：`email_bindings` 表当前 **0 行**，
   两条查询必然返回空。这不等于「数据干净」，只等于「无数据可脏」。
   若将来该表有数据，需重跑核查；在那之前，「大小写重复 / 一事一邮箱被破坏」两项规则
   在真实库上**从未被检验过**。
3. **D 组脚本未能沉淀为仓内脚本**：`server/scripts/dirty-data-audit.ts` 因 `knip` 报
   unused file 而删除（`server/package.json` 不在 File Scope，无法注册入口）。
   现以一次性命令形式记录在本档案。后续任务若要沉淀脚本，须把 `server/package.json`
   纳入其 File Scope。
4. **`latest` 标签长期落后于 `main`**：`latest` = `v1.0.7` = `sha-e563800`（2026-10-31），
   而 `main` 已前进到 `2ca5d50`。这是 `docker.yml` 仅由 `v*` tag 触发的既定设计
   （`AGENTS.md` §14.3），**不是缺陷**；但已在 052/053/054 三份档案中写明，
   防止后来者误以为「合并即发布」。
5. **TASK-051 的 D13-C 欠账已滚过三轮**：本应由 TASK-052 补记，实际由 TASK-055 清偿，
   `github-collaboration.md` §224「至多延后一个任务」的终止条件已被突破。
   已在 TASK-051 档案内如实登记；**根因（回写责任易在传递中落空）未消除**，
   建议后续在框架层加机械门禁（如审计脚本检查 `review/` 中已合并任务的 Merge Record 是否为空）。

## Handoff

| # | From | To | Date | Summary |
|---|------|----|------|---------|
| 001 | developer（Codex，执行位） | reviewer（主控位） | 2026-11-02 | R/S/C/V/D 五组实施完毕；四份 Merge Record 实测回填 + git mv 归档；C 组 404 语义 + 7 项断言；smoke 实跑 168/14 并用 main 基线对照证明失败先于本次改动；D 组只读核查 0 命中（vacuous） |

**最新 Handoff：** `handoffs/HANDOFF-001-developer-to-reviewer.md`
**Next Action：** 主控位读 `HANDOFF-001-developer-to-reviewer.md` + 实际 diff →
逐条核对 AC-1~AC-11 → 按 Task Rules 安排**不携带实现上下文的独立实例**复核 C 组 404 语义
与 D 组报告真实性 → 出具 PASS / FAIL。

## Merge Record

| 要素 | 值 |
|------|-----|
| PR | 待回填 |
| 合并策略 | 待回填 |
| 提交数 | 待回填 |
| merged_at | 待回填 |
| merge_commit_sha | 待回填 |
| 合并后 CI run | 待回填 |
| 合并后 Docker run | 待回填 |
| 镜像 tag | 待回填 |
| 审查记录 | 待回填 |

## Task Rules

- **I2 适用于本任务**：执行位不得批准自己写的交付物；本任务含代码改动（C 组），因此
  主控位复审之外，**还须由不携带实现上下文的独立实例**复核 C 组的 404 语义与 D 组报告的真实性。
- **回写不是「复制粘贴」**：本文件的数值是交叉核对用；与自己实测不一致时以实测为准并注明差异。
- **历史不得篡改**：不重写任何 `handoffs/*.md` 内文的旧 SHA / 旧数字；只允许在 `TASK.md` 内追加映射表。
- **门禁不得放宽**：不得通过修改 `scripts/audit-repo.py` 的豁免清单或白名单来让 F8/F9 变绿。
- **D 组只读**：真实库任何写操作都超权。

## 本次未做（与 Non-Scope 逐条对应）

| # | 未做项 | 对应 Non-Scope | 原因 / 归属 |
|---|--------|----------------|-------------|
| 1 | 并发竞态压测 | Non-Scope 第 1 条 | `better-sqlite3` 同步驱动 + 单进程部署形态不产生多进程写交错；压测数字与本系统无关。登记为长期观察 |
| 2 | 真实库脏数据清理 | Non-Scope 第 3 条 | D 组只出报告；写操作处置权在人类 |
| 3 | 客户表 `beforeWrite` 的 409/404 次序 | Non-Scope 第 2 条 | 同根但不同表，改它会把回归面从一张表扩到两张表 + 客户表单，属另一个任务边界 |
| 4 | 修 smoke.ts 的 14 项失败 | 未列于 Non-Scope，但不属本任务 Objective | 属既有红，基线对照证明先于本次改动；分三簇需分别立项 |
| 5 | 沉淀 `dirty-data-audit.ts` 为仓内脚本 | File Scope 许可的备选方案 | `server/package.json` 不在 File Scope，knip 会报 unused file；已改为一次性命令 |
| 6 | schema / 索引 / 迁移 / 新依赖 | Non-Scope 第 4 条 | 本轮无模型改动 |
| 7 | 打 tag / 发布镜像 | Non-Scope 第 4 条 | 发布走 `v1.0.x` 单独流程 |
| 8 | 改写任何历史 handoff 的旧 SHA / 旧数字 | Non-Scope 第 5 条 + Task Rules | 只做追加（SHA 映射表），未触碰旧文 |

## Notes

- 本次派单的事实来源：`gh pr view 27` / `gh api .../pulls/26` / `gh api .../actions/runs?head_sha=…` /
  DockerHub Tags API（`nomorelatenights/subscription-admin`），四条命令均可复现。
- 交叉核对值（**仅用于复核，不得直接抄入档案**）：
  - PR #26 → 14 个提交；PR #27 → 9 个提交。
  - `sha-2ca5d50` digest `sha256:0658ac254eeb76a5…`，`tag_last_pushed` `2026-11-02T02:13:44Z`。
  - `latest` = `sha256:b6da326e15e41c9e…` = `v1.0.7` = `sha-e563800`（合并**未**推进 `latest`）。
