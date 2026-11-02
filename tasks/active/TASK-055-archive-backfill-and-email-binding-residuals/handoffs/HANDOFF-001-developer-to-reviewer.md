# HANDOFF-001 — TASK-055 developer → reviewer

| 字段 | 值 |
|------|----|
| **From** | Codex（执行位 · developer） |
| **To** | reviewer（主控位） |
| **Task** | TASK-055 归档回写收口（051/052/053/054 四份 Merge Record）+ 邮箱绑定残留三项 |
| **Date** | 2026-11-02T12:10:00+08:00 |
| **Current State** | `Status = ACTIVE`，位于 `tasks/active/TASK-055-archive-backfill-and-email-binding-residuals/`，分支 `fix/TASK-055-archive-backfill-and-email-binding-residuals`（自 `main` `2ca5d50` 切出） |

---

## Current State

R/S/C/V/D 五组实施完毕，全量门禁通过，等待独立审查。**未自审、未自行批准、未合并。**

> ⚠️ 本任务的 Status 仍为 `ACTIVE` 而非 `DONE`：TASK-055 自身尚未合并，
> 其 Merge Record 按 D13-C 由**下一个任务**回填，本任务不得自我回写。

---

## Completed Work

### R 组：四份 Merge Record 九要素（全部实测值）

九要素均为执行位在 2026-11-02 实跑所得，**未照抄档案的「交叉核对值」**。
四处复现命令已写入各档案。

| 档案 | PR | merge_commit_sha | merged_at | 提交数 | CI run | Docker run | 镜像 tag |
|------|----|------------------|-----------|--------|--------|------------|----------|
| TASK-051 | #26 | `e563800…` | `2026-10-31T12:04:52Z` | 14 | `41199514208` | `41199514198` | `sha-e563800` |
| TASK-052 | #27 | `2ca5d50…` | `2026-11-02T02:09:31Z` | 9 | `41376188754` | `41376188853` | `sha-2ca5d50` |
| TASK-053 | 同 #27 | 同 #27 | 同 #27 | 9 | 同 #27 | 同 #27 | 同 #27 |
| TASK-054 | 同 #27 | 同 #27 | 同 #27 | 9 | 同 #27 | 同 #27 | 同 #27 |

关键区分（AC-1 / 避免误读）：

- **合并策略**：两条 merge commit 均只有 **1 个 parent**（`e563800`→`7169b72`；
  `2ca5d50`→`b9f9879`），实测确认 `rebase-merge`，非双亲合并提交。
- **tag 发布 run ≠ 合并 run**（TASK-051）：run `41202023831` 是
  `event=push` / `head_branch=v1.0.7` 的**发布 run**，不计入「合并后 Docker run」。
- **合并未推进 `latest`**：`latest` = `v1.0.7` = `sha-e563800`（digest `sha256:b6da326e…`），
  而 `sha-2ca5d50` 是 `sha256:0658ac25…` —— 三者不同，`latest` 未随 PR #27 前进。
  该句已写入 052/053/054 三份档案。
- **052/053/054 共用同一 merge_commit_sha**：三份档案均写明「与其余两份同批落地」，
  并说明成因（052/053 从未提交，054 必须叠在其上）。

**每个九要素所用的复现命令**（已在各档案内逐条列明）：

| 要素 | 命令 |
|------|------|
| PR / merged / merged_at / merge_commit_sha / 提交数 / 变更规模 | `gh api repos/huyanluanyuqaq/shadcn-admin/pulls/<n> --jq '{merged,merged_at,merge_commit_sha,commits,changed_files}'` |
| 提交数（复核） | `gh api repos/huyanluanyuqaq/shadcn-admin/pulls/<n>/commits --jq 'length'` |
| 合并后 CI / Docker run | `gh api "repos/huyanluanyuqaq/shadcn-admin/actions/runs?head_sha=<merge_commit_sha>&per_page=20" --jq '.workflow_runs[] \| {id,name,event,head_branch,conclusion,created_at}'` |
| 合并策略 | `git log --format="%H %P %s" -1 <merge_commit_sha>`（单 parent ⇒ rebase-merge） |
| 镜像 tag / digest / last_pushed | `Invoke-RestMethod https://hub.docker.com/v2/repositories/nomorelatenights/subscription-admin/tags/<tag>` |

### S 组：SHA 映射表（3 份 × 9 行）

052/053/054 各加一张「审查时 SHA → main 上 SHA」九行映射表。
**自行验证而非照抄**：九个旧 SHA 的 `git merge-base --is-ancestor <旧SHA> main`
全部返回非 0（rebase 后不可达）；九个新旧提交的 **tree 全部相同**（9/9），
证明是同一份内容的 rebase 副本而非另写一份。

### C 组：PATCH 不存在 id → 404

`server/src/routes/resources.ts` 的 `email-bindings` `beforeWrite` 增加 4 行：

```ts
if (id !== null && current === null) return null
```

（含 3 行注释说明动机）。**未动 `crud.ts`**。让 CRUD 走到自己的
`notFound(c, '邮箱绑定 不存在')`，调用方可区分「记录不存在」与「邮箱冲突」。

`email-binding-sync-check.ts` 新增「场景 12」，7 项断言：状态码 404、message、
`email_bindings` 行数不变、未新建行，外加 3 项**对照组**证明判重未被削弱
（PATCH 存在的 id 撞别人邮箱仍 409、行数仍不变、文案仍为既有 uniqueHint）。

### V 组：smoke.ts 实跑（此前从未跑过）

隔离快照库（`VACUUM INTO`）→ 起服务（`DATABASE_URL` 指向快照，
`RESTORE_AUTO_EXIT=false` 防 19.16 自杀，`SMOKE_DB_DIR` 指向临时目录）→ 跑 smoke。

**改动后结果：168 通过 / 14 失败，退出码 `1`。**

**`NULL 互异`（18.x）实测结论：通过** ——
`✓ 同一邮箱在未指定供应商下可单独绑定（NULL 互异）`。
该条此前仅有「读代码推断」，现已由实跑确认；用例未删、断言未改，因此不存在
「是否推翻 NULL 收紧可接受」的问题。

**14 项失败的归属（关键自证）**：把 `resources.ts` 暂存回 `main` 版本
（`git stash push -- server/src/routes/resources.ts`）后重跑基线，结果
**168 通过 / 14 失败、退出码 1、失败清单逐条相同**。故 14 项全部先于本任务存在：

1. 流量阈值通知 7 项 + 仪表盘 stats 1 项（`/api/reminders/scan` 未生成提醒行）；
2. 邮箱绑定 sync 5 项（被 TASK-053 的 R2 守卫 409 拒绝，**smoke 脚本期望过期**）；
3. 备份恢复标记 1 项（19.17）。

### D 组：真实库只读核查

`{ readonly: true }` 连接 `server/data/app.db`，两条查询原始结果：

- **D-1 大小写重复**（`lower(email) + pool_id` 分组 `count(*)>1`）：**命中 0 行**，`[]`
- **D-2 一事一邮箱被破坏**（同 `subscription_id` 绑定行数 `>1`）：**命中 0 行**，`[]`

**必须同时读的判读前提**：`email_bindings` 总行数为 **0**（四表行数
`subscription_pool=4 / subscriptions=6 / email_bindings=0 / customers=6`）。
因此两个空结果是 **vacuous（无数据可脏）**，**不等于数据干净**——
这两项规则在真实库上其实从未被检验。核查前后四表行数一致，`app.db` mtime 未变。

**脚本落地偏差**：曾按 File Scope 新建 `server/scripts/dirty-data-audit.ts`，
但 `knip` 报 unused file（退出码 1）——knip 靠 `server/package.json` 的 script 入口识别脚本，
而该文件**不在 File Scope 内**。按 File Scope 中「若不建脚本则改为一次性命令并把命令写入档案」
的许可备选方案，已删除脚本，两条 SQL 的一次性命令原样写入档案。knip 复跑退出码 0。

---

## Changed Files

| 文件 | 变更类型 |
|------|---------|
| `tasks/done/TASK-051-backup-residual-closure/TASK.md` | 修改 + `git mv` |
| `tasks/done/TASK-052-customer-edit-cross-page-sync/TASK.md` | 修改 + `git mv` |
| `tasks/done/TASK-053-email-binding-states/TASK.md` | 修改 + `git mv` |
| `tasks/done/TASK-054-email-binding-atomic-provision/TASK.md` | 修改 + `git mv` |
| `server/src/routes/resources.ts` | 修改（C 组 4 行） |
| `server/scripts/email-binding-sync-check.ts` | 修改（场景 12，7 项断言） |
| `tasks/active/TASK-055-…/TASK.md` | 修改 |
| `tasks/active/TASK-055-…/handoffs/HANDOFF-001-developer-to-reviewer.md` | 新增 |

**未修改**：`server/src/lib/crud.ts`、`server/src/db/**`、任何 `handoffs/*.md` 旧文、
`tasks/done/TASK-001~050`、`.github/**`、`.agents/**`、`scripts/audit-repo.py` 及其豁免清单、
`server/package.json`。

---

## Tests

全部在 `E:\NDLDSN-WORKSPACE\projects\shadcn-admin` 执行，退出码为实测值。

| 命令 | 结果 | 退出码 |
|------|------|--------|
| `email-binding-sync-check` | 通过 **62** / 失败 0 | `0` |
| `email-binding-bundle-check` | 通过 **68** / 失败 0 | `0` |
| `vitest run --browser.headless` | **27 文件 / 345 用例**全过 | `0` |
| `tsc -b` | 通过 | `0` |
| `eslint .` | 通过 | `0` |
| `prettier --check .` | All matched files use Prettier code style | `0` |
| `knip` | 通过 | `0` |
| `audit-repo.py` | **PASS=9 FAIL=0 WARN=0** | `0` |
| `build:shared` / `typecheck:server` | 通过 | `0` / `0` |
| `smoke.ts`（隔离快照库） | 168 通过 / **14 失败** | **`1`** |

> smoke 退出码为 1 是**既有状态**，已用 main 基线对照证明与本任务无关（见上）。
> AC-10 要求的八项门禁退出码全部为 0，smoke 不在此列。

每移动一份档案跑一次 `audit-repo.py`，四次均 `PASS=9 FAIL=0 WARN=0`。

---

## Known Issues

1. **smoke.ts 整体为红（14 项失败）**，先于本任务存在，分三簇需分别立项。
2. **D 组结果是 vacuous**：`email_bindings` 0 行，两项规则在真实库上从未被检验。
3. **D 组脚本未沉淀**：受 File Scope 限制（`server/package.json` 不可改），改为一次性命令。
4. **`latest` 长期落后 `main`**：既定设计（`docker.yml` 仅 `v*` 触发），已在三份档案写明。
5. **TASK-051 的 D13-C 欠账滚过三轮**，根因（回写责任传递中落空）未消除，
   建议后续加机械门禁。

---

## Remaining Work

无（实现侧已完毕）。等待主控位审查 + 按 Task Rules 安排的**独立实例**复核。

---

## Assumptions

1. **TASK-052 的 Merge Record 原为 6 字段旧格式**，补齐为九要素时把「变更规模」
   并入「提交数」一行（`commits=9` / `changed_files=29`），未删信息。
2. **九要素中「提交数」按 PR 全量计**（#26 → 14、#27 → 9）。052/053/054 共用 PR #27，
   无法按任务拆分，已在三份档案写明这一点，避免误读为各自 9 个提交。
3. **V 组 smoke 跑了三轮**（改动后两次 + main 基线一次）。前两次分别为 168/14 与 168/14，
   第三次为取可靠退出码而用全新快照重跑；基线轮用于证明失败与本次改动无关。
4. **D 组用 `readonly: true`**，未对真实库做任何写操作；核查前后行数与 mtime 均未变。

---

## Risks

| 风险 | 缓解 |
|------|------|
| 九要素填错导致「可复现」失效 | 每条都附复现命令；PR/sha/run/tag 四类数据全部实测而非抄录 |
| SHA 映射表照抄档案导致「逐条可核」落空 | 已自行验证：旧 SHA 不可达 + 新旧 tree 相同（9/9） |
| C 组改动削弱判重 | 场景 12 含 3 项对照组，证明 409 路径未被削弱；sync 62 项全过 |
| smoke 的 14 项失败被误判为本任务回归 | 已用 main 基线对照，逐条相同；档案与 PR 均明确记载 |
| D 组空结果被误读为「数据干净」 | 档案与 Known Issues 均标注 vacuous，并给出四表行数 |
| 档案移动破坏 F8/F9 | 每移动一份跑一次 audit，四次均 9 PASS / 0 FAIL |

---

## Next Action

主控位（reviewer）：

1. 读本 Handoff + `tasks/active/TASK-055-…/TASK.md`；
2. 读实际 diff（`git diff main...HEAD` + `git status`），**不要只读本交接的描述**；
3. 逐条核对 AC-1~AC-11，重点复核：
   - 四份九要素是否与他人在同仓用所列命令复现的结果一致；
   - 三份 SHA 映射表九组是否逐条可核；
   - C 组 404 语义是否只影响「不存在的 id」、有无削弱 409 判重；
   - V 组 smoke 的 14 项失败归属判断是否成立；
   - D 组报告是否如实（尤其 vacuous 的标注）；
4. 按 Task Rules，安排**不携带实现上下文的独立实例**复核 C 组 404 语义与 D 组报告真实性；
5. 出具 PASS / FAIL 审查记录（`handoffs/2026-11-02-review.md`）。
