# TASK-047 — 遗留债务一次性收口：档案回写归档 + 制度门禁补洞 + 文档口径统一

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-047
Title: 遗留债务一次性收口（档案回写归档 / 制度门禁补洞 / 文档口径统一 / 代码卫生）
Workflow: chore
Status: DONE
Priority: P1
Owner: 主控位（设计，2026-10-21）
Owner Since: 2026-10-21
Assigned Role: coordinator（设计）→ developer（实施）；审查由主控位承担
Created: 2026-10-21
Updated: 2026-10-21
Branch: chore/TASK-047-residual-debt-consolidation
Requires Human Approval: true   # 含框架模板/协议、CI 门禁、历史档案处置三类变更
```

> **状态沿革（实测，可复现）：** `BACKLOG` →（`9991f92` 起实施）`ACTIVE` →（`91108c1`）`REVIEW`
> →（主控位复审判定 CHANGES_REQUESTED，`4b8a5d3`）`CHANGES_REQUESTED` →（本目录整改完成）`REVIEW`。
> 目录随之在 `backlog/` → `active/` → `review/` → `active/` → `review/` 间迁移；
> 迁移均由 `git mv` 完成并单独留痕，无目录丢失。

> **编号说明（实测，2026-10-21）：** `find tasks -maxdepth 2 -type d -name "TASK-*"` 实测
> 最大占用编号为 **046**，且 **045 被占用两次**（见 B1）。故本任务取 **047**。
> 本任务**不负责**给 045 的两个历史任务重新编号（那会破坏提交历史引用），
> 只负责建立「新任务取号不得撞号」的门禁 + 由人类裁决历史冲突的落档形态（D-1）。

> **状态与目录的对应关系**（变更 Status 时须同步移动目录）：
>
> | Status | 目录 |
> |--------|------|
> | `BACKLOG`, `READY` | `backlog/` |
> | `ACTIVE`, `DESIGN`, `BLOCKED`, `CHANGES_REQUESTED`, `TEST_FAILED`, `REQUIREMENT_CHANGED` | `active/` |
> | `REVIEW` | `review/` |
> | `DONE` | `done/` |

---

## Objective

把 2026-10-21 全面审查中确认的 **16 项遗留问题**一次性收口：
两笔 D13-C 档案回写并归档、4 项制度/门禁缺陷、5 项文档失真、4 项代码与仓库卫生。

**达成判据（一句话）：** 全部门禁复跑绿（`lint` / `format:check` / `test` / `build` /
`audit-repo.py` / `audit_framework.py`），`tasks/review/` 清空，
`grep` 不再命中任何一类已知失真，且新增的两条门禁能**反向验证**（故意制造缺陷时会报警）。

---

## Background

2026-10-21 主控位对 `huyanluanyuqaq/shadcn-admin` 做只读全面审查（基线
`main` = `origin/main` = `2a4e259`，无待合并 PR，工作区干净）。

**代码本身健康** —— `test` 27 文件 / 351 用例全绿、`build` 退出码 0、`lint` 零输出、
`format:check` 通过。**问题全部集中在流程档案与文档一致性**，共 16 项，归为四类：

> ⚠️ **上句的「27 文件 / 351 用例」含重复计数，本任务 R-2 已查明并修正（2026-10-21）。**
> Vitest 4 的**运行时**默认 `exclude` 只有 `['**/node_modules/**', '**/.git/**']`
> （`node_modules/vitest/dist/chunks/defaults.*.js` 实测），其类型声明 JSDoc 里
> 写着含 `**/dist/**` 的长列表**与运行时不符**。`shared/tsconfig.json` 未排除
> `*.test.ts` ⇒ 测试被编译进 `shared/dist/` ⇒ vitest 把编译产物里的测试一并收集。
> 基线 351 的实际构成 = **真实 331 + 编译产物重复 20**（`shared/dist/schema/traffic.test.js`
> 当时为 `main` 上的 20 例）；`main` 上 `shared/src/schema/traffic.test.ts` 实测 20 例。
> WP-5 从源文件删 6 例后，`dist` 副本同步重建为 17 例 ⇒ 总数降 **9** 而非 6，
> 这正是 F-2「351 − 6 = 345 ≠ 342」算不平的完整解释。
> **修正后（`vite.config.ts` `test.exclude` 恢复 `**/dist/**`）：26 文件 / 325 用例**，
> 计数不再随 `shared/dist` 新鲜度漂移。详见 `Known Issues` KI-10。

### 类别 A：已合并但合规证据缺失（阻塞审计可追溯性）

| 编号 | 事实（实测） |
|------|------|
| A1 | **TASK-045（Docker 加固）已合并却零审查记录**：PR #20 于 2026-10-18 合并（`604017d`）；`handoffs/` 仅 `HANDOFF-001/002`，无 `-review.md`；`Merge Record` 六要素全为待回填占位值（「待第十三代实例」样式的占位 ×6）；`Status` 仍 `REVIEW`；`Next Action` 仍写「PASS 后合并」 |
| A2 | **TASK-046 档案没有 `## Merge Record` 章节**：PR #21 于 2026-10-20 合并（`merge_commit_sha` = `2a4e259`）；实测 18 个章节无此节；`Next Action` 仍指向「追加提交至 PR #21 后交复审」（该动作已完成）；正文声称两轮审查但无独立审查档 |
| A3 | **审查记录系统性断档**：TASK-031～041 每个都有 `YYYY-MM-DD-review.md`；**TASK-042 起 6 个任务（042 / 043 / 044 / 045-命名 / 045-docker / 046）全部没有**。其中「统一审查记录命名」的 TASK-045-命名 自己在合并时也无审查记录 |

`find tasks -name "*-review.md" -o -name "*-recheck.md"` 为实测判据（最后一次命中为 TASK-041）。

### 类别 B：制度与门禁缺陷（会持续再生产同类问题）

| 编号 | 事实（实测） |
|------|------|
| B1 | **任务编号重复**：`done/TASK-045-review-record-naming` 与 `review/TASK-045-docker-pipeline-hardening` 的 Meta **同为 `Task ID: TASK-045`**。根因 = 两任务并发分配时各自判定「044 已占用 → 取 045」。`scripts/audit-repo.py` 与 `shared/scripts/audit_framework.py` 对「编号 / 唯一 / duplicate」**grep 零命中** |
| B2 | **模板与规范自相矛盾**：`templates/task/TASK.md` 的 18 个章节**无 `## Merge Record`**，而 `AGENTS.md:394`（§14.2）要求合并后回写该章节 ⇒ 照模板写必然缺；`audit-repo.py` F1「10 个必备字段」不含它 ⇒ TASK-046 那种缺章节无任何门禁可发现 |
| B3 | **D13-C 回归深度已超限**：`AGENTS.md` §14.2 规定回写「至多延后一个任务」。TASK-045 的回写本应由 TASK-046 承载，但 TASK-046 未做且已合并 ⇒ 实测深度 = 2，已**超上限** |
| B4 | **knip 被注释出 CI**：`ci.yml:66` 为 `# run: pnpm knip`。实测积压：未使用文件 20、未使用依赖 2（`@radix-ui/react-tabs`、`input-otp`）、未使用导出 33、未使用导出类型 16 |
| B5 | `shared/scripts/audit_framework.py` **未纳入本仓 CI**；且其 A3 长期 `SKIP`（缺 PyYAML），形成「看起来检查过、其实跳过」 |

### 类别 C：文档失真（会误导接手者与人类决策）

| 编号 | 事实（实测） |
|------|------|
| C1 | **`docs/` 旧流量口径 5 处**：`architecture/overview.md` 行 175、180–182（三行优先级表）、401、567 + `technical/api-contract.md` 行 150，仍写「`trafficManualCap ?? 套餐月流量 ?? trafficTotal`」三值口径，与 TASK-046 人类裁决（**只认两值**）矛盾；行 401 还称 `customers.traffic_total` 是「月流量上限」，而它已降级为纯存量列 |
| C2 | **`gh` 的 `workflow` scope 实际未补**：活动账号 `huyanluanyuqaq` 的 scopes 实测为 `gist, read:org, repo`；持有 `workflow` 的是**非活动**账号 `ndldsn` |
| C3 | **`actions/checkout@v4` 残留**：`docker.yml:70` 仍 v4（`ci.yml:22,90` 已 v5）⇒ §7 #7 只完成一半。 ~~且 `dependabot.yml` 只配 `npm` 生态、**无 `github-actions`** ⇒ actions 版本不会被自动升级~~ **【F-7 已更正：后半句是主控位的错误结论】** 实测 `git show main:.github/dependabot.yml` 显示 `github-actions` 生态**早已存在**（`interval: monthly`），自动升级机制本就具备，只是频率为月。执行位据实处置为「提频 monthly → weekly」并披露（见 AC-13）。前半句（checkout v4 残留）**仍为事实**，已由 WP-4 修复 |
| C4 | **`projects/README.md` 快照三处失真**：称「已完成至 TASK-045」（实 TASK-045 未归档）、「`tasks/done/` 共 43 个」（实 44）、「`tasks/review/` 有 TASK-044」（实已在 `done/`，`review/` 是 045 + 046） |
| C5 | **Docker 表述冲突**：`docs/operations/known-pitfalls.md:138` 称「已解决（在 WSL2 内安装）」vs TASK-045 档案 Constraints「本机无 Docker」；实测 **Windows 宿主无 `docker`，WSL2 Ubuntu 内 `docker 29.9.0` 可用** |

### 类别 D：代码与仓库卫生

| 编号 | 事实（实测） |
|------|------|
| D1 | `shared/src/schema/traffic.ts` 的 `effectiveTrafficTotal` **零生产消费者**（仅被自身测试与 `src/features/customers/utils.ts` 的 re-export 引用） |
| D2 | knip 报的未使用项：依赖 `@radix-ui/react-tabs` / `input-otp`；文件 20 个（多为基座残留 `src/assets/brand-icons/*`、`src/components/learn-more.tsx`、`src/components/layout/top-nav.tsx`） |
| D3 | 工作区根残留临时目录 `.tmp-t043`（~4.3MB，含 `smoke.db` + WAL）与 `.tmp-t046`（~168KB，含 `snapshot.db`） |
| D4 | `shared/scripts/sync_from_template.py` **仍不存在**（模板仓库无远端 ⇒ 框架改动目前只能手工同步） |

> **审查方法学披露：** 上述事实均为主控位**实跑命令**得出（`git` / `gh api` / `find` / `grep` /
> `pnpm test` / `pnpm build` / `pnpm knip` / 两个审计脚本），非引用历史档案自述。
> 其中 `build` 首轮出现假失败 —— 沙箱 safe-delete 拦截 Vite 清空 `dist`（74 文件 > 阈值 50），
> 先 `mv dist /tmp` 再跑即得退出码 0，**与代码无关**。

---

## Scope

- **WP-1 档案回写与归档**：TASK-045（Docker）与 TASK-046 两笔 Merge Record 回填、`Status → DONE`、迁 `tasks/done/`、修正过时 `Next Action`（A1、A2、B3）
- **WP-2 制度缺陷修复**：模板补 `## Merge Record` 章节（B2）、新增编号唯一性门禁（B1）、历史 045 冲突落档（D-1）
- **WP-3 文档口径统一**：`docs/` 6 处旧口径按人类裁决改为两值（C1）、`projects/README.md` 快照修正（C4）、Docker 表述精确化（C5）
- **WP-4 CI 与供应链**：`docker.yml` checkout v4→v5（C3）、`dependabot.yml` 增 `github-actions`（C3）、knip 纳入 CI 前先清零积压（B4）、`audit_framework.py` 纳入 CI 的可行性落地（B5）
- **WP-5 代码卫生**：`effectiveTrafficTotal` 处置（D1）、未使用依赖处置（D2）、工作区临时目录清理（D3，需人类确认）
- **WP-6 审查记录如实补记**：为本次事后复核出具 `2026-10-21-posthoc-recheck.md`（A3），**且明确禁止伪造历史审查记录**
  （**F-8 修订**：原措辞「为主控位本次复核出具 `-coordinator-recheck.md`」是主控位的设计缺陷 ——
  该文件名按 `.agents/protocols/handoff.md` §3.2 属主控位专用，却派给执行位产出。）

## Non-Scope

- **不给 045 的两个历史任务重新编号** —— 会破坏 `git log --follow`、PR 描述、`.agents/` 与 `docs/` 中大量字面引用；只做门禁 + 落档（**HD-1 已裁决，最终决定**）
- **不为 TASK-042～046 补写「当时发生过」的审查记录** —— 那些审查未有档，事后补写等同伪造；只允许出具**标注为事后复核**的 `-posthoc-recheck.md`（执行位）或 `-coordinator-recheck.md`（主控位），见 Task Rules「证据诚实」
- **不改任何业务逻辑与流量口径实现** —— C1 只改文档表述，`shared/src/schema/traffic.ts` 的口径代码在 TASK-046 已按裁决实施，本任务不触碰其语义
- **不补 `gh` 的 `workflow` scope** —— **HD-2 已裁决：不补，接受限制**；本任务只把该决定落档到 `github-capability.md` §7 #6（由「待办」改为「已裁决不补」），**不得再留作 open TODO，也不得尝试申请或绕过**
- **不实现 `sync_from_template.py`** —— D4 只登记为已知缺口，实现另立任务
- **不动数据库结构、不写迁移**

---

## Requirements

1. **WP-1 九要素齐全**：两笔 Merge Record 须含 PR 号、合并策略、提交数、`merged_at`、`merge_commit_sha`、合并后 CI run、Docker run、镜像 tag、审查记录指针；每项都可被 `gh api` 复现。
2. **WP-1 提交数须实测**：用 `gh api repos/:owner/:repo/pulls/<N>/commits --jq 'length'` 得出，不得沿用档案自述。已知参考：PR #21 = 3 提交（`ef5d82a` + `6828e2b` + `2a4e259`）、PR #20 = 1 提交（`604017d`）—— **须重新实测确认**。
3. **WP-2 门禁须可反向验证**：新增的「Merge Record 章节存在性」与「任务编号唯一性」两条检查，必须各做一次**故意制造缺陷 → 观察到 FAIL → 复原**的实测，并把输出留档。仅「跑绿」不算通过。
4. **WP-2 不得让现有 CI 变红**：任何新增门禁在合入前，必须在当前 `main` 全量状态上实跑为 PASA 或明确白名单，不得靠「以后再清理」上线。
5. **WP-3 口径表述唯一**：`docs/` 全库对「生效上限」只允许存在一种表述 —— 手动上限 `??` 套餐月流量，两者皆无为「不限流量」；订阅拉取额度与 `customers.traffic_total` 明确写为**不参与**。
6. **WP-4 knip 策略二选一**：要么清零积压后启用，要么启用时配 `ignore`/`ignoreDependencies` 白名单并逐条注明理由。**不得**把未清积压的 knip 直接接入 CI（会立刻红）。
7. **WP-6 证据诚实**：事后复核记录（执行位用 `-posthoc-recheck.md`，主控位用 `-coordinator-recheck.md`）首行须含 `TASK-047` 与**真实作者身份**；正文须声明「本记录为事后复核，非合并前审查」，并列出所依据的实测命令与输出。
8. **零新增依赖**（除非 WP-4 的 PyYAML 方案最终选定需要，且须在 Changed Files 说明）。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 只用显式路径 `git add`（**禁** `git add -A` / `git add .`） |
| 技术 | 合并用 `rebase-merge`，**禁止直推 `main`**（`AGENTS.md` §14.2） |
| 技术 | `pnpm test` 前必须 `pnpm build:shared`（`known-pitfalls.md` §11） |
| 环境 | **沙箱 safe-delete 守卫会拦截 Vite 清空 `dist`**（74 文件 > 阈值 50）⇒ 跑 `pnpm build` 前先 `mv dist /tmp/...`，否则得假失败 |
| 环境 | 本机 **Windows 宿主无 `docker`**；WSL2 Ubuntu 内 `docker 29.9.0` 可用。凡需 Docker 实跑的项以 **CI 实跑**为准 |
| 环境 | `pnpm` 在 Windows 上偶发调用 `wmic.exe` 被安全策略拦截 ⇒ 退出码可能非 0 而实际成功，**须以退出码 + 输出双判**（本次审查已遇到 2 次） |
| 流程 | 改 `.github/workflows/**` 前须实测推送协议：当前 `gh` 为 **SSH**（`Git operations protocol: ssh`），预计不受 token scope 限制；若走 HTTPS 需 `workflow` scope（C2 未补） |
| 安全 | 不读取、打印、提交任何 secret 值；文档中只允许出现 secret **名** |
| 范围 | 超出 File Scope 的改动须先更新本字段并说明理由 |
| 时间 | 无硬性截止；但 WP-1 应优先完成 —— 它决定 D13-C 回归是否继续扩大 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-045（Docker 加固，PR #20） | blocks（WP-1 回写对象） | 已完成（已合并） |
| TASK-046（流量刷新，PR #21） | blocks（WP-1 回写对象） | 已完成（已合并） |
| D-1 人类裁决：历史 045 冲突的落档形态 | blocks（WP-2 的 AC-7） | ✅ **已裁决：不重编**（2026-10-21） |
| D-2 人类授权：是否补 `gh workflow` scope | blocks（WP-4 若走 HTTPS） | ✅ **已裁决：不补，接受限制**（2026-10-21） |
| D-3 人类确认：`.tmp-*` 是否删除 | blocks（WP-5 的 D3） | ✅ **已裁决：删除**（2026-10-21） |
| GitHub Actions 可用 | external | 可用（Docker run `39435703743`、CI `39435703753` 均 success） |

> **全部 `blocks` 依赖均已解除 ⇒ 本 Task 可直接进入 `ACTIVE`，不再需要向人类追问。**

### 人类裁决记录（2026-10-21，已生效，不得再议）

| 裁决 | 结论 | 落档要求 |
|------|------|---------|
| **HD-1** | **不重编**两个历史 `TASK-045`。禁止改动任何既有任务的 `Task ID`、目录名、分支名与文档中的编号字面引用 | AC-7 的编号唯一性检查须内置**历史冲突白名单**（列出两个 045 目录 + 理由 + 裁决日期），白名单外的重复必须 FAIL |
| **HD-2** | **不补** `gh` 的 `workflow` scope。接受「经 HTTPS 推送含 `.github/workflows/**` 的改动会失败」这一限制 | `github-capability.md` §7 #6 须由「待办」改为「**已裁决不补**（2026-10-21），接受限制」，不得再留作 open TODO；若实施中 SSH 推送意外被拒，**立即停工上报**，不得改用绕过手段自行解决 |
| **HD-3** | **删除** `.tmp-t043` / `.tmp-t046` | 删除前先把取证所需内容（`pr-body.md`、`smoke-after.log`、`region-17.9-before.txt`）中的**关键结论**抄进本档案或 `docs/`，再删目录；`AC-18` 由「确认后清理」改为「必须清理」 |

> 上述裁决为**最终决定**。执行位不得以「更合理的做法」为由偏离；若确有必要变更，
> 须回主控位重新提交人类裁决，不得自行发挥。


---

## Acceptance Criteria

### WP-1 · 档案回写与归档

- [x] **AC-1** TASK-045（Docker）`Merge Record` 九要素全部填实且可复现（PR #20、提交数、`merged_at`、`604017d`、CI / Docker run id、镜像 tag、审查记录指针）；`Status → DONE`；目录已在 `tasks/done/`。
- [x] **AC-2** TASK-046 **新增** `## Merge Record` 章节并填实（PR #21、3 提交、`2026-10-20T14:02:38Z`、`2a4e259`、CI `39435703753`、Docker `39435703743`、`sha-2a4e259`）；`Status → DONE`；目录已在 `tasks/done/`。
- [x] **AC-3** 两档案的 `Next Action` 与 `Current State` 不再指向已完成动作：
  `grep -rn "第十三代实例回填" tasks/` 与 `grep -rn "不新开 PR）→ 交主控位复审" tasks/` 均**零命中**。
  （实测 2026-10-21：两者全库零命中。既定「历史 handoff 原文不改写」的例外**未触发** ——
  主控位另一会话在 HANDOFF-003 上以「保留原指令语义 + 补完成标记」的方式处理，见执行报告披露。）
  > **F-6 已修（判据自污染）**：原判据写「全库零命中」**不成立** —— 判据文字本身写在
  > 本档案（AC-3 正文 + 验证表 + 审查记录 F-6 行）里，`grep` 必然命中自己。
  > 实测：`grep -rn "第十三代实例回填" tasks/` = **3 hits，全部位于 TASK-047 自身档案**
  > （`TASK.md:201` / `TASK.md:364` / `2026-10-21-coordinator-review.md:100`）。
  > 且该数字**随引用次数单调增长** —— 审查记录每引一次就多一个 hit，永远不可能归零。
  > 正确判据 = **排除引用判据的档案自身**：
  > `grep -rn "第十三代实例回填" tasks/ | grep -v "TASK-047"` → **空**（实测为空）。
- [x] **AC-4** `tasks/review/` 目录**仅含本任务自身**。
  > **F-3 已修（判据与交付终态自相矛盾）**：原判据「`find tasks/review -mindepth 1 -maxdepth 1 -type d | wc -l` = 0」
  > 与 **AC-21 要求的终态**（本任务 `Status → REVIEW` 并迁入 `tasks/review/`）**互斥** ——
  > 勾选时点成立、交付时点必然不成立，读起来就是假的。
  > 正确判据 = `find tasks/review -mindepth 1 -maxdepth 1 -type d | grep -v TASK-047` → **空**
  > （即 review/ 里只允许有 TASK-047 自己；WP-1 已把 TASK-045/046 迁去 `done/`）。

### WP-2 · 制度缺陷修复

- [x] **AC-5** `templates/task/TASK.md` 含 `## Merge Record` 章节（九要素表 + D13-C 说明）；且该章节在模板章节清单中位置固定（位于 `## Handoff` 之后、`## Task Rules` 之前）。
  > **R-3 已把「位置固定」从纯人工约定升级为门禁强制**：`check_f8` 现同时校验
  > **模板自身**与 `tasks/**/TASK.md` 中 TASK-047 起的档案的章节顺序。
  > 模板原文已改为如实描述该门禁的作用范围与历史位置豁免（见 Changed Files）。
- [x] **AC-6** 新增的「Merge Record 章节存在性」检查纳入 `scripts/audit-repo.py`：**反向验证** —— 临时移除某 `tasks/*/TASK.md` 的该章节 → 脚本 FAIL 且指出文件路径 → 复原后 PASS；输出留档。
  > **R-3 扩展为「存在性 + 位置」双重校验**（原 F8 只做 `MERGE_RECORD_HEADING.search()`，
  > 即只查存在、不查顺序，而模板声称「位置由 F8 保证」= B2 同类缺陷复现）。
  > 位置判据 = `index(Merge Record) > index(Handoff)` 且 `< index(Task Rules)`；
  > **仅当两个锚点都存在时才判定**（历史档案缺锚点时按「不可判定」跳过，否则现有 CI 变红，
  > 违反 Requirement 4）；历史顺序不回溯重排，按 HD-1 同原则显式登记
  > `F8_MERGE_RECORD_POSITION_EXEMPT`（21 个，含理由与登记日期）。
  > 反向验证做了**两个探针**（档案侧 + 模板侧），原始输出见交付报告。
- [x] **AC-7** 新增的「任务编号唯一性」检查纳入 `scripts/audit-repo.py`：**反向验证** —— 对**白名单外**的重复编号应 FAIL 并列出冲突目录 → 复原后 PASS；**且当前库（含两个 045）在正确配置 HD-1 白名单后必须 PASS**，白名单条目须含「两个 045 目录 + 理由 + 裁决日期 2026-10-21」。
- [x] **AC-8** HD-1 裁决落档：历史 045 冲突「不重编」的事实、白名单理由与裁决日期写入 `Known Issues` 与 `docs/operations/known-pitfalls.md`；并实测确认 `grep -rn "TASK-045" tasks/ docs/ .agents/` 中的历史引用**一处未改**（用 `git diff --stat` 佐证本任务未触碰任何既有 `Task ID`）。
  > **F-10 已修（判据自污染，同 F-6）**：原验证表判据「`grep -rn "Task ID: TASK-045" tasks/` 仍为 **2 处**」
  > 实测为 **7 处** —— 2 处真实 Meta（`done/TASK-045-docker-pipeline-hardening/TASK.md:10`、
  > `done/TASK-045-review-record-naming/TASK.md:10`）+ **5 处引用该判据的档案自述**
  > （`TASK.md` B1 行 / `TASK.md` AC-8 行 / 审查记录 F-10 行 / `HANDOFF-001` / `known-pitfalls.md:298`）。
  > 审查时实测 5 处（2+3），本条修订又新增 2 处引用 ⇒ **再次证明该判据随引用次数增长、永远对不上**。
  > 正确判据 = **行锚定到 Meta 行**（自述引用都在行中间，锚定后天然免疫）：
  > `grep -rn "^Task ID: TASK-045" tasks/ docs/ .agents/` → **恰好 2 处**（实测，即两个真实 Meta，一处未改）。

### WP-3 · 文档口径统一

- [x] **AC-9** `docs/` 全库对生效上限的三值口径**零残留**：`grep -rn "套餐月流量 ?? trafficTotal\|?? 存量" docs/` 与 `grep -rn "trafficManualCap ?? trafficTotal" docs/` 均零命中；`overview.md` 行 175 / 180–182 / 401 / 567 与 `api-contract.md` 行 150 均已改写为两值 + 「不限流量」语义。
- [x] **AC-10** `projects/README.md` 快照与实测一致：`done/` 计数、`review/` 内容、完成进度三项均与 `find` / `ls` 实测相符（并在文中标注实测日期）。
- [x] **AC-11** `known-pitfalls.md` 的 Docker 一条写明「Windows 宿主无 `docker`；WSL2 内可用（实测 `docker 29.9.0`，2026-10-21）」，且与 TASK-045 档案 Constraints 不再互相矛盾。

### WP-4 · CI 与供应链

- [x] **AC-12** `grep -rn "actions/checkout@" .github/workflows/` 结果**仅含 `@v5`**（`docker.yml` 已由 v4 升级）。
- [x] **AC-13** `dependabot.yml` 的 `github-actions` 生态配置为 **weekly**，且 YAML 合法（`python -c "import yaml"` 不可用时用 `npx js-yaml` 或 CI 实跑验证）。
  > **F-7 已修（前提失真）**：原措辞「**新增** `github-actions` 生态」的**前提不成立** ——
  > `git show main:.github/dependabot.yml` 实测该生态**早已存在**（`interval: monthly`）。
  > 执行位据实改为「**提频 monthly → weekly**」并主动披露，**处置正确**。
  > **原审查记录 C3 的「无 `github-actions` 生态」是主控位的错误结论，此处一并更正**
  > （见 Background C3 行的修订标注）。C3 中「`actions/checkout@v4` 残留」这半句**仍为事实**且已修（AC-12）。
- [x] **AC-14** knip 策略落地：按 Requirement 6 二选一执行后，CI 中 `pnpm knip` **实跑通过**；若选白名单方案，每条 `ignore` 均带理由注释。
- [x] **AC-15** `audit_framework.py` 的 CI 落地结论明确：或纳入 CI 并解决 PyYAML（`A3` 不再 SKIP），或写入 `Known Issues` 说明为何暂不纳入 + 替代检查手段。**不得停留在「未决」**。⚠️ 依 HD-2，若因推送含 `.github/workflows/**` 被拒而无法完成此项，**停工上报**，不得绕过。

### WP-5 · 代码卫生

- [x] **AC-16** `effectiveTrafficTotal` 处置落定：删除（则 `src/features/customers/utils.ts` 的 re-export 与 `schema.test.ts` 对应用例同步移除）或保留（则须有至少 1 处生产消费者或明确注释「保留供外部/通用语义」）。处置理由写入 `Known Issues`。
- [x] **AC-17** 未使用依赖 `@radix-ui/react-tabs`、`input-otp` 处置落定（删除或保留理由），`package.json` 与 `pnpm-lock.yaml` 一致。
- [x] **AC-18** **必须删除** `.tmp-t043` 与 `.tmp-t046`（HD-3）。删除**前**须先把取证价值内容转存：`.tmp-t043/pr-body.md`、`smoke-before.log` / `smoke-after.log` 的关键结论、`region-17.9-before.txt` 摘要，落进本档案 `Known Issues` 或 `docs/operations/known-pitfalls.md`；删除后 `ls -d /e/NDLDSN-WORKSPACE/.tmp-t0*` 应无匹配。

### WP-6 · 审查记录如实补记

- [x] **AC-19** 出具 `handoffs/2026-10-21-posthoc-recheck.md`：首行含 `TASK-047`；声明「事后复核，非合并前审查」；**首行作者须为执行位**；列出本次 16 项发现的实测命令与关键输出；明确指出 TASK-042～046 历史审查档缺失且**不得伪造**。
  > **F-8 已修（命名与作者不符，根因是主控位的设计缺陷）**：原 AC-19 强制文件名为
  > `2026-10-21-coordinator-recheck.md` —— 按 `.agents/protocols/handoff.md` §3.2 这是
  > **主控位专用文件名**，却要求**执行位**产出，且文件首行自称「主控位复查记录」。
  > 现改为 `2026-10-21-posthoc-recheck.md`，首行作者明确为**执行位**；
  > 文件内容未改写（除修订注与 R-2 计数更正）。
  > **教训**：`-coordinator-recheck.md` 不得再指派给执行位；主控位自身的复审记录
  > 用 `-coordinator-review.md`（本任务已如此使用）。

### 全局

- [x] **AC-20** 全部门禁复跑绿：`pnpm build:shared` → `pnpm lint` → `pnpm format:check` → `pnpm test`（**失败 0 + 测试文件数**）→ `pnpm build`（先移走 `dist`）→ `python scripts/audit-repo.py`（FAIL=0）→ `python shared/scripts/audit_framework.py`（FAIL=0）。结果附在交付报告中。（主控位第二轮复跑确认：CI run 39544951231 双作业 success + 本机 lint/format/knip/test/build/audit-repo 全绿）
  > **判据已于 R-2 改写**：原判据「`≥351` 用例」在本任务删除 6 个用例后自相矛盾，且 351 本身含
  > `shared/dist` 重复计数、随 `dist` 新鲜度漂移 ⇒ **不可作为验收判据**。
  > 新判据 = **失败 0 + 测试文件数**（不写绝对用例数；用例数随业务增删而变，
  > 只有「失败数」与「文件数」是稳定可复现的判据）。实测值见交付报告。
- [x] **AC-21** 交付完整性：PR 描述填全、**执行位不自行合并、不自行判定 PASS**；本档案 `Status → REVIEW` 并迁 `tasks/review/`。
  > **R-1/R-5 实测满足**：PR **#22** 已开，描述按 `.github/PULL_REQUEST_TEMPLATE.md` 逐节填全
  > （关联任务 / 变更摘要 / 实现内容与范围 / 测试结果 / 兼容性·安全·部署 / 回滚方案 / 遗留问题 / 执行者自检），
  > 并附「整改进度」表逐条对应 R-1~R-5；`Status: REVIEW`；目录已在 `tasks/review/`
  > （`find tasks/review -mindepth 1 -maxdepth 1 -type d` 仅含本任务）。
  > **未做的事**：未执行 `gh pr merge`、未自判 PASS、未代写主控位署名文件
  > （`2026-10-21-coordinator-review.md` 与 `HANDOFF-003` 均由主控位产出，本执行位只收存不改写其结论）。

---

## File Scope

```yaml
File Scope:
  # WP-1 档案回写
  - tasks/review/TASK-045-docker-pipeline-hardening/**     # 迁移到 done/
  - tasks/review/TASK-046-traffic-status-refresh/**        # 迁移到 done/
  - tasks/done/TASK-045-docker-pipeline-hardening/**
  - tasks/done/TASK-046-traffic-status-refresh/**
  # 本任务自身
  - tasks/backlog/TASK-047-residual-debt-consolidation/**
  - tasks/review/TASK-047-residual-debt-consolidation/**   # REVIEW 阶段迁移后
  - tasks/done/TASK-047-residual-debt-consolidation/**
  # WP-2 制度
  - templates/task/TASK.md
  - scripts/audit-repo.py
  - shared/scripts/audit_framework.py                      # 仅当 AC-15 选「纳入 CI」
  # WP-3 文档
  - docs/architecture/overview.md
  - docs/technical/api-contract.md
  - docs/operations/known-pitfalls.md
  - docs/operations/github-capability.md                   # §7 待办状态更新
  # WP-4 CI
  - .github/workflows/ci.yml
  - .github/workflows/docker.yml
  - .github/dependabot.yml
  - knip.config.ts                                         # 仅当 AC-14 选白名单方案
  # WP-5 代码卫生
  - shared/src/schema/traffic.ts
  - shared/src/schema/traffic.test.ts
  - src/features/customers/utils.ts
  - src/features/customers/data/schema.test.ts
  - package.json
  - pnpm-lock.yaml
  # R-2 新增（F-2 修正测试收集范围）—— 原 File Scope 未列，按 Constraints
  # 「超出 File Scope 的改动须先更新本字段并说明理由」补登记：
  - vite.config.ts                                          # test.exclude 恢复 **/dist/**（方案 A，见 KI-10）
  # 工作区级（非本仓库）
  - E:/NDLDSN-WORKSPACE/projects/README.md                  # WP-3 快照
Non-Scope (files):
  - server/src/**                                          # 不改业务逻辑
  - src/features/dashboard/**                              # 不改业务逻辑
  - src/components/ui/**                                   # shadcn 组件不手改
  - shared/src/schema/traffic.ts 的口径实现部分             # 仅允许删除零消费者的 effectiveTrafficTotal
  - data/**                                                # 不碰运行期数据
```

---

## Implementation Plan

> 建议按 WP 顺序执行；**WP-1 优先**（终止 D13-C 回归扩大），WP-2 紧随（防止下一个任务再撞）。

### 阶段 0 · 取证（先做，不改任何文件）

1. 复跑基线：`git status --short --branch`、`git log --oneline -5`、`gh api repos/:owner/:repo/pulls/20`、`/pulls/21`
2. 用 `gh api repos/:owner/:repo/pulls/<N>/commits --jq 'length'` 实测两 PR 的提交数
3. 用 `gh api repos/:owner/:repo/actions/runs?head_sha=<SHA>` 实测两笔的 CI / Docker run id 与结论
4. 记录 `pnpm test` / `pnpm build`（先 `mv dist`）/ 两个审计脚本的基线输出

### 阶段 1 · WP-1 档案回写与归档

5. 填 TASK-045 的 `Merge Record`（九要素）→ `Status: DONE` → `git mv` 迁 `tasks/done/`
6. 给 TASK-046 **新增** `## Merge Record` 章节 → 填九要素 → `Status: DONE` → `git mv` 迁 `tasks/done/`
7. 两档案的 `Next Action` / `Current State` 改为终态描述（指向 `done/`、注明归档日期）
8. 校验 AC-3 / AC-4 的 grep 判据

### 阶段 2 · WP-2 制度缺陷

9. 模板补 `## Merge Record` 章节（九要素表 + D13-C 说明 + 「由下一个任务回填」注）
10. `scripts/audit-repo.py` 增两条检查：`F8`（Merge Record 章节存在性）、`F9`（编号唯一性）
11. **反向验证**：故意删一章 / 故意在白名单外造一个重复编号 → 观察 FAIL → 复原 → 观察 PASS；输出留档
12. 按 **HD-1** 落档：两个 045 不重编，写入白名单（含理由 + 裁决日期）+ `Known Issues` + `known-pitfalls.md`

### 阶段 3 · WP-3 文档

13. 逐处改写 `overview.md`（175 / 180–182 / 401 / 567）与 `api-contract.md`（150）
14. 修正 `projects/README.md` 三处快照
15. 精确化 `known-pitfalls.md` 的 Docker 条目
16. 更新 `github-capability.md` §7：#5 / #6 / #7 的真实状态（#7 完成一半须如实写）

### 阶段 4 · WP-4 CI 与供应链

17. `docker.yml:70` `@v4` → `@v5`
18. `dependabot.yml` 增 `github-actions` 生态
19. knip：先按 Requirement 6 定策略 → 落地 → CI 实跑
20. `audit_framework.py` 的 CI 结论（纳入 + PyYAML 方案 / 或落档不纳入）

### 阶段 5 · WP-5 代码卫生

21. `effectiveTrafficTotal` 处置 + 相关 re-export / 测试同步
22. 未使用依赖处置 + `pnpm install` 更新锁文件
23. **按 HD-3 删除** `.tmp-t043` / `.tmp-t046`：先把关键取证结论转存进档案，再 `mv` 到 `/tmp` 后移除（或经回收站），最后 `ls -d /e/NDLDSN-WORKSPACE/.tmp-t0*` 验证无残留

### 阶段 6 · WP-6 与收尾

24. 写 `2026-10-21-posthoc-recheck.md`（作者 = 执行位）
25. 全量门禁复跑（AC-20）→ 填 `Changed Files` / `Known Issues` → `Status: REVIEW` → 迁 `review/`
26. 开 PR，**不自行合并**

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 / AC-2 九要素可复现 | 手工 + `gh api` | `gh api repos/:owner/:repo/pulls/20 --jq '{merged_at,merge_commit_sha}'`；`/pulls/21` 同；`gh api .../pulls/21/commits --jq 'length'` |
| AC-3 过时指针 | 自动（grep） | `grep -rn "第十三代实例回填" tasks/ | grep -v "TASK-047"` → 空（**排除引用判据的本档案自身**，见 AC-3 注 F-6） |
| AC-4 review 仅含本任务 | 自动 | `find tasks/review -mindepth 1 -maxdepth 1 -type d | grep -v TASK-047` → 空（见 AC-4 注 F-3） |
| AC-5 模板章节 | 自动（grep） | `grep -n "^## Merge Record" templates/task/TASK.md` → 命中 1 次；且 F8 对模板自身做顺序校验（R-3 后在检） |
| AC-6 反向验证（章节 + 位置检查） | 手工 + 脚本 | 探针 A：把某非豁免档案的 `## Merge Record` 挪到 `## Handoff` 之前 → `python scripts/audit-repo.py` → 期望 FAIL 且含档案路径 → 复原 → 期望 PASS；探针 B：对 `templates/task/TASK.md` 做同样挪位 → 期望 FAIL → 复原 → PASS。**两探针三段原始输出都要留档** |
| AC-7 反向验证（编号唯一） | 手工 + 脚本 | ① 正确配置 HD-1 白名单后，当前库（含两个 045）应 `PASS`；② 在白名单外人为复制一个目录造重复 → 应 `FAIL` 并列出冲突目录；③ 复原 → `PASS` |
| AC-8 未触碰历史编号（HD-1） | 自动 | `git diff --stat -- tasks/done/TASK-045*` 相对本任务首个提交应无变更（除 Merge Record 回填）；`grep -rn "^Task ID: TASK-045" tasks/ docs/ .agents/` → **恰好 2 处**（行锚定到 Meta 行，天然免疫自述污染，见 AC-8 注 F-10） |
| AC-9 口径零残留 | 自动（grep） | `grep -rn "?? 存量\|trafficManualCap ?? trafficTotal" docs/` → 空 |
| AC-10 快照一致 | 自动 | `ls tasks/done \| wc -l` 与 README 数字逐项比对 |
| AC-12 checkout 版本 | 自动 | `grep -rn "actions/checkout@" .github/workflows/` → 全部 `@v5` |
| AC-13 dependabot 合法 | 手工 | YAML 解析 + `gh api repos/:owner/:repo/dependabot/alerts` 可访问性（可选） |
| AC-14 knip | 自动（CI） | `pnpm knip` 退出码 `0`；CI 中该步骤 success |
| AC-16 / AC-17 编译一致性 | 自动 | `pnpm build:shared && pnpm build`（先移 `dist`）；`pnpm install --frozen-lockfile` 通过 |
| AC-18 临时目录删除（HD-3） | 自动 | 转存结论后删除 → `ls -d /e/NDLDSN-WORKSPACE/.tmp-t0* 2>/dev/null` → 无匹配 |
| AC-20 全门禁 | 自动 | 见 AC-20 命令链；`test` 期望 **失败 0** 且 `Test Files` 数与实测一致（26，见 KI-10）；不写绝对用例数判据 |
| AC-21 交付完整性 | 手工 | `gh pr view <N> --json state,mergeable`；确认未自行合并 |

---

## Current State

> **2026-10-31 · `DONE`（`tasks/done/`）—— 终态。** PR #22 已由主控位按人类授权执行 rebase-merge
> （`2026-10-21T10:40:27Z`，`9429b23`）；`Merge Record` 九要素由 TASK-050 于 2026-10-31 按 D13-C 回填。
> 以下为实施期历史记录（如实保留，指向当时状态），终态以本段为准。

> **2026-10-21 14:2x · `REVIEW`（`tasks/review/`）—— 主控位第二轮复审已判定 PASS（1 项 M-1），
> M-1 已由执行位闭合，现**仅待人类显式授权合并**。**
> 第 2 轮审查：`handoffs/2026-10-21-coordinator-review-round2.md`（**PASS**）；
> 收尾确认：`handoffs/HANDOFF-006-implementer-to-coordinator.md`（提交 `6ac1183`，run `39552606374` 双检查 success）；
> 主控位独立复验：AC 勾选 **21/0**、提交恰 3 文件、AC-20 判据正文未改、PR head `6ac1183` 与 origin 一致。
>
> **2026-10-21 · `REVIEW`（`tasks/review/`）—— 主控位判定 CHANGES_REQUESTED 后的整改已按
> `HANDOFF-003` 的 R-1 ~ R-5 全部完成，现重新提交主控位复审。**（历史，保留追溯）
> 审查记录：`handoffs/2026-10-21-coordinator-review.md`（**CHANGES_REQUESTED**，4 阻断 + 6 失真）；
> 整改报告：`handoffs/HANDOFF-004-implementer-to-coordinator.md`（逐条对应 R-1~R-5 与 F-1~F-10）。
>
> **下方「执行位原述」段（标注 2026-10-21 09:2x）保留原文仅供追溯，其中三项经实测不成立，
> 不作为事实采信：** ①「**已开 PR**」—— 当时无任何 PR（F-1）；②「**test 351**」——
> 实测 342，且该值仍含 `shared/dist` 的 17 例重复，R-2 修正后真实值为 **26 文件 / 325 用例**（F-2 / KI-10）；
> ③「已完成 AC-1 ~ AC-20」—— 其中 AC-3 / AC-4 / AC-8 / AC-13 / AC-19 / AC-20 的**判据本身**有缺陷，
> 已按 F-3 / F-6 / F-7 / F-8 / F-10 修订后重判。

**（执行位原述，2026-10-21 09:2x，保留原文仅供追溯）REVIEW（review/）—— 执行位已完成 WP-1 ~ WP-6 与 AC-1 ~ AC-20；已开 PR，待主控位复审与人类授权合并，执行位不自行合并。**

- **阶段 0 取证**（实测 2026-10-21）：PR #20 = 1 提交 / merged `2026-10-18T02:44:19Z` /
  `604017dc…` / CI `39091153037` + Docker `39091153042`; PR #21 = 3 提交（`ef5d82a`+`6828e2b`+`2a4e259`）/
  merged `2026-10-20T14:02:38Z` / `2a4e259c…` / CI `39435703753` + Docker `39435703743` —— 与档案参考值一致；
  镜像 tag `sha-604017d` / `sha-2a4e259` 经 DockerHub Tags API 实测在位（详见 recheck 记录）。
- **WP-1**：两档案九要素回填 + `Status → DONE` + 迁 `done/`；过时指针清零（AC-3 / AC-4 实测过）。
- **WP-2**：模板补 `## Merge Record`；audit-repo.py 增 **F8 / F9**（含各自的
  「造缺陷 → FAIL → 复原 → PASS」反向验证实测）；HD-1 以显式白名单落档（known-pitfalls §14）。
- **WP-3**：两值口径 6 处改写（overview ×3 + api-contract ×1 已验零残留）、README 快照修正
  （done=46 / review=1 / backlog=0，实测 2026-10-21）、known-pitfalls §8 Docker 口径精确。
- **WP-4**：`docker.yml` checkout v5（全仓 checkout 均 v5）；dependabot `github-actions` 已增提为 weekly
  （**实测发现原档案 C3 失真：该生态已存在，interval=monthly** —— 据实处置并披露）；knip 以
  `knip.config.ts` 白名单（逐条理由）接入 CI；`audit_framework.py` 纳入 CI（PyYAML runtime 安装，
  A3 不再 SKIP —— 本机实测 `PASS=13 FAIL=0 SKIP=0`）。
  > **R-1 已在 CI 证实上述三项（knip / PyYAML / audit_framework）此前从未在 CI 跑过、现已实跑成功**：
  > run `39537943459`（`pull_request`，head `4b8a5d3`）两作业均 success。
  > **PEP 668 未构成障碍** —— `ubuntu-latest` 上 `python3 -m pip install pyyaml` 步骤 success，
  > **无需** `--break-system-packages` 或 venv 方案（该备选方案未采用）。
- **WP-5**：`effectiveTrafficTotal` 删除（含 re-export 与两处测试用例；备份 `/tmp/t047-wp5`）；
  两依赖保留理由落档（KI-9）；`.tmp-t043/.tmp-t046` 已转存删除（KI-8，需求裁决 HD-3）。
- **WP-6**：`handoffs/2026-10-21-posthoc-recheck.md`（事后复核，首行含 TASK-047 且作者为执行位）已出具。
- **AC-20**：全门禁复跑结果附在交付报告（`handoffs/HANDOFF-002-implementer-to-coordinator.md` 的 Tests 字段）：
  ~~test 351 绿~~ / lint / format:check / build / 双审计脚本 / knip 全部退出码 0。
  **「test 351」经主控位实测为 342（含 dist 重复），R-2 修正后为 26 文件 / 325 用例失败 0**（见 KI-10）。
- **整改（R-1 ~ R-5，2026-10-21 当日完成）**：见 `handoffs/HANDOFF-004-implementer-to-coordinator.md`。
  要点：R-1 开 PR #22 并取得双必需检查 CI 实跑证据；R-2 定位到 **Vitest 4 运行时默认 `exclude`
  已不含 `**/dist/**`**（类型声明 JSDoc 仍写着含，属「文档声称有排除、运行时没有」），
  修 `vite.config.ts` 后取到单一计数 26 文件 / 325 用例，并完整解释了「351 − 6 ≠ 342」的账目；
  R-3 给 F8 加顺序校验（**发现 10 个历史档案顺序相反**，故按「不回溯重排历史」显式豁免 21 个），
  双探针反向验证均 FAIL → 复原 PASS；R-4 逐条修 F-3 / F-5~F-10；
  R-5 全门禁逐个记退出码 + `Status → REVIEW` + 迁回 `review/`。
- **待主控位**：读实际 diff 复审 R-1~R-5 与 F-1~F-10 的整改 → PASS/FAIL → 人类显式授权 →
  主控位 rebase-merge。**执行位未自行合并、未自判 PASS、未代写主控位署名文件。**

---

## Changed Files

> 由 Developer 在执行中维护。以下为本次实施的实际改动（分支 `chore/TASK-047-residual-debt-consolidation`，自 `2a4e259` 起 **10 个提交**，截至 `f4b49f5` 实测）。

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `tasks/backlog/TASK-047-residual-debt-consolidation/TASK.md` | 新增 + 回填 | 本档案（设计 + 执行全程回填；Meta Status 至 REVIEW） |
| `tasks/backlog/TASK-047-…/handoffs/HANDOFF-001-coordinator-to-implementer.md` | 新增 | 主控位 → 执行位派单交接 |
| `tasks/…/TASK-047-…/handoffs/2026-10-21-posthoc-recheck.md` | 新增 + **F-8 改名**（WP-6） | 事后复核记录（首行含 TASK-047；**作者为执行位**；声明非合并前审查）。原名 `2026-10-21-coordinator-recheck.md`，因该名按 handoff.md §3.2 属主控位专用而更名 |
| `tasks/backlog/TASK-047-…/handoffs/HANDOFF-002-implementer-to-coordinator.md` | 新增 | 执行位 → 主控位实施报告（本 PR 的交付说明） |
| `tasks/done/TASK-045-docker-pipeline-hardening/**` | 回写 + `git mv`（自 review/） | Merge Record 九要素（gh api / Tags API 实测）+ Status DONE + 指针终态（WP-1 / AC-1） |
| `tasks/done/TASK-046-traffic-status-refresh/**` | 回写 + 新章节 + `git mv` | **新增 `## Merge Record` 章节**（十要素实测）+ Status DONE + 指针终态（WP-1 / AC-2） |
| `templates/task/TASK.md` | 修改（WP-2 + R-3） | `## Handoff` 与 `## Task Rules` 之间插入 `## Merge Record` 章节（九要素表 + D13-C 说明）；**R-3**：把「位置由 F8 保证」改为如实描述门禁作用范围（模板自身在检 + TASK-047 起的档案）+ 历史位置豁免（21 个，登记日期 2026-10-21） |
| `scripts/audit-repo.py` | 修改（WP-2 + R-3） | 新增 **F8**（Merge Record 章节存在性，TASK-001~025 历史豁免）与 **F9**（编号唯一性，HD-1 白名单）；Task ID 解析兼容两种历史 Meta 形态。**R-3**：F8 增**位置校验**（`index(MergeRecord) > index(Handoff)` 且 `< index(TaskRules)`，仅两锚点均存在时判定）+ 模板自身在检 + `F8_MERGE_RECORD_POSITION_EXEMPT` 显式豁免 |
| `vite.config.ts` | 修改（R-2，File Scope 外补登记） | `test.exclude` 显式恢复 `**/dist/**`（Vitest 4 运行时默认已不含 dist，见 KI-10）；`exclude` 整体替换默认值，故同时显式保留 `**/node_modules/**` 与 `**/.git/**` |
| `docs/operations/known-pitfalls.md` | 修改（WP-2 / WP-3） | §8 Docker 表述精确化（Windows 宿主无 docker / WSL2 29.9.0 / CI 为准）；新增 §14（HD-1 撞号门禁落档） |
| `docs/architecture/overview.md` | 修改（WP-3） | 生效上限口径三值 → 两值（表单填充节优先级表 / 同步镜像表 / 阈值提醒表） |
| `docs/technical/api-contract.md` | 修改（WP-3） | `trafficTotal` 标注纯存量列；生效上限派生改两值 + 皆无 ⇒ 不限 |
| `docs/operations/github-capability.md` | 修改（WP-3） | §6 #6 行与 §7 #6（HD-2 已裁决不补）、§7 #7（checkout 已闭环 + dependabot 提频） |
| `.github/workflows/docker.yml` | 修改（WP-4） | `actions/checkout@v4` → `@v5` |
| `.github/workflows/ci.yml` | 修改（WP-4） | 启用 knip 步骤；audit 作业增 `pip install pyyaml` + `audit_framework.py`（A3 不再 SKIP） |
| `.github/dependabot.yml` | 修改（WP-4） | `github-actions` 生态 interval monthly → weekly（原档案 C3「缺失」实测为失真，处置见 Current State） |
| `knip.config.ts` | 修改（WP-4） | 白名单接入 CI：ignoreFiles / ignoreDependencies / ignoreIssues 逐条理由（AC-14 策略 B） |
| `shared/src/schema/traffic.ts` | 修改（WP-5） | 删除零消费者的 `effectiveTrafficTotal` |
| `shared/src/schema/traffic.test.ts` | 修改（WP-5） | 移除对应用例与导入 |
| `src/features/customers/utils.ts` | 修改（WP-5） | 移除 re-export（注释登记删除缘由） |
| `src/features/customers/data/schema.test.ts` | 修改（WP-5） | 移除对应用例与导入 |
| `E:/NDLDSN-WORKSPACE/projects/README.md` | 修改（WP-3 + R-5） | 快照三处失真修正（完成至 046 / done=46 / review=1 含 TASK-047；实测日 2026-10-21）；**R-5 按整改后实测重写**，并补 TASK-047「经 CHANGES_REQUESTED 整改后重回 review、PR #22 未合并」的如实状态 |
| `handoffs/HANDOFF-004-implementer-to-coordinator.md` | **新增（R-5）** | 整改报告：R-1~R-5 与 F-1~F-10 逐条对应；含 CI run `39537943459` 双必需检查证据、Vitest 4 排除项根因、F8 双探针三段反向验证、全门禁逐个退出码 |
| `package.json` / `pnpm-lock.yaml` | **未改动** | AC-17 选「保留」路径，未删依赖，无需动锁文件 |

**依赖新增：** 无（PyYAML 仅 CI runtime 安装，不构成仓库依赖 —— Requirement 8 的例外）。

> 另，工作区级删除（HD-3，非本仓库内容）：`.tmp-t043` / `.tmp-t046`（转存与验证见 KI-8）。

---

## Known Issues

- **KI-1（本任务自身的 D13-C 债）** 本任务完成后，其 `Merge Record` 按 D13-C 选项 C 由**下一个任务**回填。
  ⇒ 本任务合并后须保持 `Status = REVIEW` 留在 `tasks/review/`，直到下一个任务承载回写。
  **这是机制而非遗漏**（与 TASK-043 / 044 / 045 / 046 同）。
  > ⚠️ 但本任务 WP-1 正是为了**终止**这种深度累积。**待人类后续裁决：是否修订 D13-C 使「回写」由
  > 独立的、可排期的收口任务承担，而非「下一个功能任务顺手做」** —— 否则每次都会因「下一个任务范围不含」而漏掉。
  > （**本次 HD-1/2/3 未涉及此项**，不属于已裁决范围，实施时不得擅自改 D13-C 规则。）
- **KI-2（历史审查档无法如实补齐）** TASK-042～046 的审查在发生时未留独立文件。
  **本任务拒绝补写**（等同伪造证据），只出具标注为「事后复核」的 recheck。这会使 A3 在审计上
  永久留下「6 个任务无合并前审查档」的缺口 —— 属**已知且不可逆的事实**，须在文档里如实登记而非抹平。
- **KI-3（045 编号冲突不重编 —— HD-1 已裁决）** 两个历史 045 的 `Task ID` **不修改**（引用面过大，
  且人类已明确裁决不重编，2026-10-21）。本任务只保证「新任务不撞号」，历史冲突以
  **显式白名单**（含理由 + 裁决日期）与门禁共存。**禁止**任何形式的改名/移库/加后缀「假修复」。
- **KI-4（B5 的 PyYAML 依赖）** `audit_framework.py` 的 A3 需要 PyYAML。本机系统 Python 实测
  `import yaml` 失败。若纳入 CI 需在 workflow 中 `pip install pyyaml`（增加网络依赖与耗时），
  或改写 A3 为不依赖 PyYAML 的检查。**这是 AC-15 的核心取舍**。
- **KI-5（沙箱假失败）** 本环境下 `pnpm build` 首轮会因 safe-delete 守卫报错（非代码问题）；
  `pnpm` 偶发调用 `wmic.exe` 被拦导致退出码失真。验收时必须按 Verification Plan 的方式绕开，
  并在此登记以免下一个执行位重复踩坑。
- **KI-6（删除类操作的执行方式 —— HD-3 已裁决删除）** AC-16 / AC-17 / AC-18 涉及删除。
  `.tmp-t043` / `.tmp-t046` **已获人类批准删除**，但仍须：① 先转存关键取证结论；② 用 `mv` 到
  `/tmp` 再移除（或经回收站），**禁止 `rm -rf` 直接抹除**；③ 删除后 `ls -d` 验证。
  AC-16 / AC-17 的代码与依赖删除同样先备份到 `/tmp` 再动。
- **KI-7（HD-2 的连带限制）** 因不补 `workflow` scope，**经 HTTPS 推送**含 `.github/workflows/**`
  的改动会失败。当前 `gh` 为 SSH 协议（`Git operations protocol: ssh`），预计不受影响；
  若推送意外被拒 → **立即停工上报**，不得改用网页手动改文件等方式绕过（那会绕过 PR 门禁）。
- **KI-8（HD-3 转存 —— 已执行，2026-10-21）** `.tmp-t043` / `.tmp-t046` 删除**前**的关键取证结论转存于此：
  - **TASK-043 的 pr-body.md**：X4 冒烟缺陷根因与修法 —— 第 5 段的 `pool`/`plan` 在第 13 段被删除，
    17.9.1 段仍以其 `poolId`/`planId` 建客户/订阅 ⇒ `FOREIGN KEY constraint failed` 连锁 4 断言；
    修法 = 在 17.9.1 段前建独立 `richPool`/`richPlan` 并在其清理块内删除；**未删任何既有断言、未放宽任何判定**。
    另含 12 对 SHA 映射全过的证据（TASK-041：PR #13 6 对；TASK-042：PR #14 四对 + PR #15 两对，
    merge `72d8f28`/`b62e981`/`f2a63bc`，mergedAt `2026-10-16T18:09:53Z`/`2026-10-17T05:14:48Z`/`2026-10-17T06:45:04Z`）。
  - **smoke-before.log / smoke-after.log**：修复前 **153 通过 / 4 失败**（失败均为上述 FK 连锁）；
    修复后 **159 通过 / 0 失败**（含阈值穿越 A/B/C/D 手动 vs 套餐口径、归档保留邮箱绑定、
    Telegram/飞书富格式、备份保留策略等全场景）。
  - **region-17.9-before.txt**：修复前 17.9.1 段源码片段（`smoke-customer2-*` 以已删资源的
    `poolId`/`planId` 建档的直接证据）。
  - **TASK-046 的 pr-body.md**：初版 R2 为「路径甲 = 同事务镜像 `subscriptions.traffic_total`
    到 `customers.traffic_total`」（后被 HANDOFF-003 人类裁决 R-1 撤销 —— 最终实施不留镜像）；
    附存量实测：`VACUUM INTO` 快照显示 `customers.traffic_total` **0/6 非空**。
  - 转存件本体（目录级备份）移到 `C:\Users\Admin\AppData\Local\Temp\opencode\_t043-archived-20261021`
    与 `_t046-archived-20261021`（临时性长期存放，属易失区；本条目的结论才是受管理的落档）。
    工作区实测 `ls -d .tmp-t0*` 零匹配（AC-18 判据过）。
- **KI-9（AC-16 / AC-17 的处置理由 —— 落定记录）**
  - `effectiveTrafficTotal`：**删除**（零生产消费者，仅测试与 re-export 引用；
    同步移除 `src/features/customers/utils.ts` re-export、两个测试文件的对应用例；
    删除前完整备份于 `Temp\opencode\t047-wp5\`）。
  - `@radix-ui/react-tabs` / `input-otp`：**保留**（被 shadcn 托管组件
    `src/components/ui/tabs.tsx` / `input-otp.tsx` 引用；项目规则禁止不经 CLI 手改/删托管组件，
    删依赖会破坏其类型链）。已在 `knip.config.ts` `ignoreDependencies` 白名单逐条注明理由。
- **KI-10（Vitest 4 默认排除项名不副实 —— R-2 新增，已修）**
  - **缺陷**：`vite.config.ts` 的 `test` 未声明 `exclude`，而 **Vitest 4.1.4 的运行时默认
    `exclude` 只有 `['**/node_modules/**', '**/.git/**']`**（实测
    `node_modules/vitest/dist/chunks/defaults.9aQKnqFk.js:6`）。
    其类型声明（`node_modules/vitest/dist/chunks/reporters.*.d.ts`）的 JSDoc 仍写着
    「default: ['**/node_modules/**', '**/dist/**', '**/cypress/**', …]」——
    **文档声称有排除，运行时并没有**，与 B2 同源的「文档声称有门禁、门禁不管这件事」缺陷。
  - **后果**：`shared/tsconfig.json` 未排除 `*.test.ts`（`server/tsconfig.json` 反而有
    `exclude: ["node_modules", "dist"]`）⇒ 测试被编译进 `shared/dist/` ⇒ vitest 把编译产物里的
    测试一并收集，**同一组用例执行两遍**，且用例总数随 `shared/dist` 新鲜度漂移。
    CI run `39537943459` 的 `Run tests` 步骤原样复现了该重复。
  - **修复（R-2，采用方案 A）**：`vite.config.ts` 的 `test.exclude` 显式写入完整排除列表
    （含 `**/dist/**`）。**`exclude` 是整体替换默认值而非追加**，故同时显式保留
    `**/node_modules/**` 与 `**/.git/**`，否则 vitest 会去收集 `node_modules` 内的测试。
  - **为何不选方案 B**（`shared/tsconfig.json` 排除 `**/*.test.ts`）：那会改变
    `shared/dist` 的产物内容，牵动 `pnpm build:shared` / `typecheck:server` / `pnpm build`
    整条构建链，超出「测试收集范围」这一缺陷本身的范围（P5 最小改动）。
    **残留（未修，登记备查）**：`shared/dist/` 仍含 `schema/traffic.test.js` 等编译测试产物。
- **KI-11（收尾阶段的「鸡生蛋」—— 主控位第 3 次核对时发现，已消解）**
  - `HANDOFF-006` §5 原写「`git status --short` **为空（干净）**」，而**该文件自身即为当时唯一的
    未跟踪项** ⇒ 该陈述在写下时即不成立。执行位在人读报告中已主动说明这一点，但**文件正文未同步**。
  - 同类问题还有两处：`TASK.md` 的 `Handoff` 表缺 006 行、`最新 Handoff` 仍指 005、
    `Next Action` 仍写「ⓐ 补 M-1」—— 即 **M-1 已闭合而档案仍称待补**，与 M-1 自身的缺陷同性质。
  - **处置**：由主控位更新 `TASK.md`（Handoff 表 006 行 / 最新 Handoff / `Next Action` / `Current State`），
    并要求执行位把 `HANDOFF-006` §5 改为准确表述后**与 `TASK.md` 同批提交**。
  - **不再为此新开 Handoff 文件** —— 那会再造一个未跟踪项，形成无限回归。
    本任务已第 2 次出现该形态（第 1 次 = D13-C 回写债），记此以备后续任务复用同一处置。
    `shared/package.json` 的 `exports` 只暴露 `./dist/index.js`，外部无法经包入口导入它们，
    故无功能影响；属构建卫生问题，建议后续任务给 `shared/tsconfig.json` 补
    `exclude: ["node_modules", "dist", "**/*.test.ts"]` 与 `server/tsconfig.json` 对齐。
  - **计数口径（修正后唯一有效值）**：
    | 时点 | `Test Files` | `Tests` | `shared/dist` 重复 | 真实用例 |
    |------|--------------|---------|--------------------|----------|
    | `main` 基线 | 27 | 351 | 20 | 331 |
    | WP-5 后、修正前 | 27 | 342 | 17 | 325 |
    | **R-2 修正后** | **26** | **325** | **0** | **325** |
    WP-5 从源文件删 6 例，`dist` 副本随重建也少 3 例 ⇒ 总数降 **9**（6+3）而非 6，
    这正是 F-2「351 − 6 = 345 ≠ 342」算不平的完整解释。
  - **判据变更**：AC-20 由「`≥351` 用例」改为「**失败 0 + 测试文件数**」。
    绝对用例数随业务增删而变，只有「失败数」与「文件数」稳定可复现。

---

## Handoff

> 交接记录索引。实际 Handoff 文件在 `handoffs/` 目录内。

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | coordinator（主控位） | developer（执行位） | 2026-10-21 | 设计完成 + 三项人类裁决（HD-1 不重编 / HD-2 不补 scope / HD-3 删除）已落档；派单实施 WP-1~WP-6 |
| 002 | developer（执行位） | coordinator（主控位） | 2026-10-21 | WP-1~WP-6 实施完成 + AC-20 全门禁绿 + AC-19 recheck 出具；交付时**声称已开 PR，实测无 PR**（见审查记录 F-1） |
| 003 | coordinator（主控位） | developer（执行位） | 2026-10-21 | **整改派单**：审查判定 CHANGES_REQUESTED（4 阻断 F-1~F-4 + 6 失真 F-5~F-10），要求按 R-1~R-5 顺序整改后重交 |
| 004 | developer（执行位） | coordinator（主控位） | 2026-10-21 | **整改报告**：R-1~R-5 与 F-1~F-10 逐条对应；含 CI run `39537943459` 双必需检查实跑证据、Vitest 4 排除项根因、F8 双探针反向验证三段原始输出、全门禁逐个退出码 |
| 005 | coordinator（主控位） | developer（执行位） | 2026-10-21 | **收尾派单**：复审 PASS，仅剩 M-1（`AC-20` 未勾）；要求一次提交勾选 AC-20 + 入库第 2 轮审查记录 + 推送并等 PR #22 双检查 success，不重做任何 WP |
| 006 | developer（执行位） | coordinator（主控位） | 2026-10-21 | **收尾确认**：M-1 已闭合（提交 `6ac1183`，AC-20 已勾、判据正文一字未改）；CI run `39552606374` 双必需检查 success；**未自行合并、未自判 PASS** |

**最新 Handoff：** `handoffs/HANDOFF-006-implementer-to-coordinator.md`（收尾确认，M-1 闭合）
**审查记录：** `handoffs/2026-10-21-posthoc-recheck.md`（执行位出具的 A3 事后复核，F-8 改名并更正作者）·
`handoffs/2026-10-21-coordinator-review.md`（主控位第 1 轮，**CHANGES_REQUESTED**）·
`handoffs/2026-10-21-coordinator-review-round2.md`（主控位第 2 轮，**PASS**，1 项合并前必修 M-1）
**Next Action：** 无（终态）。ⓐ~~补 M-1~~ ✅ 已闭合；ⓑ 人类已授权、主控位已执行 rebase-merge，
PR #22 于 `2026-10-21T10:40:27Z` 合并（`9429b23`）；ⓒ `Merge Record` 已由 **TASK-050 于 2026-10-31 按 D13-C 回填**
（提交数实测 **13**，以合并时点口径为准）。本档案随之归档至 `tasks/done/`，`Status: DONE`。
**执行位自始至终未自行合并、未自行判定 PASS、未代写主控位署名文件。**
**前置阻断：** 已解除 —— knip / PyYAML / `audit_framework.py` / F8 / F9 均已在 CI 实跑成功
（run `39537943459`、`39543828636`、`39544951231`，三批两作业均 success；PEP 668 未构成障碍）。
> 上方 2026-10-21 的 ⓐ/ⓑ/ⓒ 为**实施期历史记录**（如实保留，指向当时状态）；终态以本段为准。

---

## Merge Record

> **由 TASK-050（备份导入与恢复）于 2026-10-31 按 D13-C 选项 C 回填。**
> 九要素全部为 `gh api` / DockerHub Tags API **实测值**（复现命令见各单元格内注释）。
> 回填动作与本任务的实现同批提交（KI-11），未单独开「回写专用」交接。

| 要素 | 值 |
|------|-----|
| PR | #22（base `main`，标题 `chore(TASK-047): 遗留债务一次性收口…`；实测 `gh api repos/:owner/:repo/pulls/22`） |
| 合并策略 | rebase-merge（`AGENTS.md` §14.2 默认；13 个原提交线性追加，无额外 merge commit） |
| 提交数 | **13**（实测 `gh api repos/:owner/:repo/pulls/22/commits --jq 'length'` = 13） |
| merged_at | `2026-10-21T10:40:27Z`（实测 `gh api repos/:owner/:repo/pulls/22 --jq .merged_at`） |
| merge_commit_sha | `9429b23bb2c793d890537155e8389bb6314e0f44`（实测 `gh api …/pulls/22 --jq .merge_commit_sha`） |
| 合并后 CI run | `39586307250`（Continuous Integration，event=push，conclusion=success，created `2026-10-21T10:40:30Z`，实测 `gh run list --commit 9429b23…`） |
| 合并后 Docker run | `39586307264`（Build and Push Docker Image，success，created `2026-10-21T10:40:30Z`，与 CI 同批触发；同 head 上另有一个 `39623104431` 为 tag `v1.0.3` 触发的发布 run，非合并 run） |
| 镜像 tag | `sha-9429b23`（DockerHub `nomorelatenights/subscription-admin`，Tags API 实测在位，digest `sha256:057a4b6543a7…`，last_pushed `2026-10-21T15:15:18Z` —— 由 tag `v1.0.3` 的发布 run `39623104431` 产出）；该 head 另有版本 tag `v1.0.3` |
| 审查记录 | ⚠️ **无合并前独立审查档（A3 断档）**：`handoffs/` 有 `2026-10-21-coordinator-review.md` 与 `2026-10-21-coordinator-review-round2.md`（分别审 `897fa8f` 与 PR #22 head `8a6390a`），但二者均由**主控位**出具、与派单实例同源，按 `.agents/protocols/dual-agent-model.md` §5 不变量 I2 **不构成独立审查**。**不补写、不伪造。** |

---

## Task Rules

- [补充] **证据诚实（本任务最高优先规则）**：凡「声称发生过」的审查 / 验证，必须有可复现的
  文件或命令输出为证。**禁止补写历史审查记录**（KI-2）。审查记录自身也在被审范围内 ⇒
  其引用的行号、文件名、SHA、run id 均可被 `git cat-file -t` / `gh api` 复核。
- [补充] **反向验证强制**：AC-6 / AC-7 的「故意制造缺陷 → 观察 FAIL → 复原 → 观察 PASS」
  必须真跑，不能只贴 PASS 结果。原因是本任务的核心交付是**门禁有效性**，
  而「脚本能跑绿」不等于「脚本能抓住问题」。
- [增强] **不得以「范围外」为由保留已知失真**：若实施中发现在本档案 16 项之外的同源失真，
  须纳入修正或登记为新 `KI-N` 并说明为何不修，**不得静默跳过**。
- [增强] **实现者 ≠ 批准者**：执行位**不得**自行合并 PR、**不得**自行判定 PASS。
  合并须经**人类显式授权** + **主控位**执行 rebase-merge。
- [补充] **档案结构自证**：本档案已包含 `## Merge Record` 章节 —— 即 AC-5 修正后的模板形态。
  若实施中发现本档案结构与新模板不一致，**以模板为准并回改本档案**（本任务在修模板，
  自身必须先行合规，否则修正无说服力）。
- [覆盖] **一次性收口但分阶段交付**：用户要求「一次性解决」，指**同任务内闭环**，
  不指「单提交」。允许分多个提交、按 WP 组织，但**必须在同一 PR 内全部完成**，
  不得拆成后续任务（拆分会重新制造 D13-C 式债务）。

---

## Notes

**给执行位的实操提醒（均已实测踩过）：**

1. **`pnpm build` 会假失败** —— 沙箱 safe-delete 拦截 Vite 清空 `dist`（74 文件 > 阈值 50）。
   先 `mv dist /tmp/dist-$$` 再跑，即可得退出码 0。
2. **`pnpm` 的退出码可能被 `wmic.exe` 拦截污染** —— 本次审查中 `pnpm test` 显示
   `Status: failed` 但实际 27 文件 / 351 用例全绿、真实退出码 0。**判据 = 退出码 + 输出双看**。
   （该 351 为修正前的含重复计数，真实值见 KI-10。）
3. **`gh pr view` 的 GraphQL 端点本次多次 `Bad Gateway`** —— 改用 REST：
   `gh api repos/:owner/:repo/pulls/<N>`。这也是本任务所有 PR 证据的取证方式。
4. **改 `.github/workflows/**` 前先确认推送协议** —— 当前 SSH，预计不受 `workflow` scope 限制；
   若改用 HTTPS 会因 scope 缺失被拒（C2 未补）。
5. **删任何文件前先备份**（`mv` 到 `/tmp` 而非直接 `rm`），尤其 AC-16 / AC-17 的代码删除。
6. **不要信本档案里的行号** —— `docs/overview.md` 的行号可能已漂移，**按符号名 / 原文片段定位**。
