# HANDOFF-004 — 执行位 Implementer → 主控位 Coordinator（第 1 轮整改闭环）

---

## Meta

```yaml
From: Codex (执行位 Implementer)
To: 主控位 Coordinator
Task: TASK-051 — 备份残留收口
Date: 2026-10-31
Current State: REVIEW（第 1 轮整改完成，待复审）
Previous Handoff: HANDOFF-003-coordinator-to-implementer.md（整改派单）
审查记录: handoffs/2026-10-31-coordinator-review.md（CHANGES_REQUESTED：0 阻断 + 3 必须修 + 6 记录项）
基线: 分支 feat/TASK-051-backup-residual-closure，56b2200（PR #26）
整改后 head: e6c69b9（+ 3 提交，见 §七）
```

**本轮做了什么**：只做派单列出的 M-1~M-3 与 R-1~R-6，**没有**改架构、签名、脚本结构
（派单 §零明确要求不动）。`git diff 56b2200..HEAD --stat` = 5 文件 / +166 / −19
（详见 §七），diff 是**变小方向**的收尾而非扩张。

**执行顺序说明**：派单要求「按 M-1 → M-2 → M-3 → R-1~R-6」，但 M-1 的 AC-7 勾选
**必须等 M-3 定论**（派单 M-1 第 3 条明示）。故实际执行顺序为
**M-2 → M-3 → R-4 → R-5 → M-1（含 AC-7）→ R-2/R-3 → R-1/R-6**，
下面按派单的编号顺序逐条汇报。

---

## 一、M-1：12 条 AC 全量勾选 + 证据指针

`tasks/review/TASK-051-backup-residual-closure/TASK.md` 的 Acceptance Criteria：
`[ ]` 12 条 → `[x]` **12 条**（`git grep -c "^- \[x\]"` 该节 = 12，`- [ ]` = 0）。
每条下方加了一行 `>` 引注，写「命令 + 期望值 + 实际值」或档案/交接行号。
判据取自**本机重跑**，未照抄审查记录。

| AC | 期望 | 实际（本机重跑） | 证据位置 |
|----|------|-----------------|---------|
| AC-1 | 九要素为实测值 | `gh api …/pulls/25` → `merged=true`/`commits=16`/`merged_at 2026-10-31T01:37:54Z`/`sha 2fdd2c93…`；runs `41156271179`(CI,main)/`41156271209`(Docker,main)/`41158945149`(Docker,**v1.0.6**)；DockerHub 三 tag 同 digest `sha256:edd1338b…`；`git/tags/c571798f…` → `.object.sha = 2fdd2c93…` | TASK.md AC-1 引注 |
| AC-2 | `Status: DONE` + 在 `done/` | `git ls-files tasks/done/TASK-050-…` = 9 文件；`git ls-files tasks/review/` 无 TASK-050；`Status: DONE` | AC-2 引注 |
| AC-3 | Next Action 终态、不写死数字 | 「无（终态）。…」；无「当前 N 提交」表述；`4d936e1`/`8ef856e` 仅在审查叙述与 Merge Record 事实陈述中 | AC-3 引注 |
| AC-4 | `process.env.BACKUP_DIR` 零命中 | `git grep -n "process.env.BACKUP_DIR" -- server/src/db/restore.ts` → **零命中**（退出码 1）；`config.backupDir` 在 `db/index.ts` 4 处命中 | AC-4 引注 |
| AC-5 | 调用点逐点列参数名 | 6 处代码命中，逐点列实参名与来源（见下） | AC-5 引注 |
| AC-6 | `restore-check` 24/0 | **24 通过 / 0 失败，退出码 0** | §五-1 |
| AC-7 | e2e 退出码 0 + 两次启动日志片段 + 数据层 + 审计 | **21 通过 / 0 失败，退出码 0**（两次，端口 60626 / 39150）；`启动日志[1]`/`启动日志[2]` 两组片段；断言 14/15/19/20 全绿 | §五-3、§二-M-3 |
| AC-8 | 连跑两次 + 无遗留 | 两次端口 60626 / 39150 不同；`netstat` 对两端口无命中；node 进程数不变；断言 9/10/11 两次全绿 | §五-3 |
| AC-9 | `retention-check` 退出码 0 + 三项证据 | **10 通过 / 0 失败，退出码 0**；失败文件名 `app-20261031-120001-000.db`、`removed` 长度 1、logs error 行原文齐备 | §五-2 |
| AC-10 | 六项门禁全绿 + status 仅 File Scope | eslint/prettier/`tsc -b`/`typecheck:server`/knip 退出码均 0；`audit-repo.py` `PASS=9 FAIL=0 WARN=0`；status 仅 4 个改动文件 + `tasks/review/TASK-051-…/**` | §五-4、§五-5 |
| AC-11 | 文档有注入说明 + 两条命令与判据 + 无失效否定断言 | §1「目录口径」行、§3.1 第 4 步、§4.1/§4.2；M-2 后判据 `git grep "自 TASK-015 起"` 排除 `tasks/` **零命中** | §二-M-2 |
| AC-12 | 047/048/049 未动 + 无 workflows/compose/schema/迁移 | diff 的 20 个文件中三者零变动；无 `.github/workflows/**`、`docker-compose.yml`、`Dockerfile`、`schema.ts`、`server/drizzle/**` | §五-6 |

**AC-5 的逐点实参表**（派单 R5 要求「参数名」而非「看起来对」）：

| 调用点 | 实参 |
|--------|------|
| `server/src/db/index.ts:57` | `applyPendingRestore(dbPath, backupDir)` —— `dbPath` = 同模块 `resolveDbPath()`；`backupDir` = 同模块 `:43` 由 `config.backupDir` 推导 |
| `server/src/db/restore.ts:121` | `resolveBackupFile(marker.filename, backupDir)` —— 第二个参数直接透传 `applyPendingRestore` 的入参 |
| `server/scripts/restore-apply-check.ts:183/207/285/322` | `applyPendingRestore(DB_PATH, BACKUP_DIR)` —— 两个均为脚本既有常量（`DB_PATH` = 临时库、`BACKUP_DIR` = 临时备份目录） |

顺序正确性另由 WP-1 红/绿兜底：若两参写反，恢复会因「备份文件不存在」直接失败（不会静默写错目录）。

---

## 二、M-2：更正「自 TASK-015 起就在位」这一事实错误

**先自证（用派单给的命令，未采信转述）**：

```text
$ git log -S "保留策略删除旧备份失败" --oneline -- server/src/services/backup.ts
df06dbe refactor(backup): 抽离备份文件名规则到零依赖模块

$ git cat-file -p $(git rev-parse 00345ff:server/src/services/backup.ts) | grep -n "console.error"
82: console.error(`[backup] 删除旧备份失败（${file.filename}）:`, err)
     （该版本 catch 内只有 console.error，没有 writeLog）

$ git cat-file -p $(git rev-parse dbb3698:server/src/services/backup.ts) | grep -n "writeLog"
5:import { writeLog } from './logger.js'
111: void writeLog('info', 'backup', `保留策略生效：删除旧备份 ${removed.join('、')}`)
     （TASK-050 基线时 catch 内仍无 writeLog）

$ git merge-base --is-ancestor df06dbe 2fdd2c9 && echo YES
YES
```

> 说明：本机无 `grep`，上述第 2/3 条用 `Select-String` 取得同样结果
> （`00345ff` 版本仅 `:82` 命中 `console.error`；`dbb3698` 版本 `:5` import 与 `:111`
> 的 `info` 级 writeLog，catch 内无 error 级 writeLog）。

**改动（2 处）**：

| 文件 | 改后表述 |
|------|---------|
| `server/scripts/retention-log-check.ts:7-16` | 「由 **TASK-050 的 PR #25**（提交 `df06dbe`）新增——当时补了日志但**未补测试**」，并附上面三条可复现的溯源命令 |
| `docs/operations/backup-restore.md` §4.2 | 同口径改写 |

**自查判据（已排除 `tasks/`）**：

```text
$ git grep -rn --include=*.md --include=*.ts "自 TASK-015 起" -- . | grep -v node_modules | grep -v "^\./tasks/"
（空）                                            # 判据通过
```

残留仅在 `tasks/` 下：`TASK.md:253`（主控位审查结论的引述）与 `TASK.md:321`
（HANDOFF 表第 003 行摘要）——按派单说明属「允许的历史审查与派单引文」。

**一处无法消除的残留，如实登记**：WP-3 的提交信息（`91b7149`）正文里仍写着
「自 TASK-015 起就在位」。该提交**已推送**，改写需 force-push 共享分支（`git.md` §6 受保护禁止），
故不动历史；更正由本次提交与 `HANDOFF-004`（本节）承载。判据本身只扫工作区文件，不受影响。

---

## 三、M-3：AC-7 与实现择一 —— **选方案 A（改实现）**

**选择**：方案 A —— `waitForHealth` 成功后打印子进程最近 3 行 stdout/stderr。

**理由**：

1. **成本极低而信息量高**。改的是 12 行打印逻辑，不触碰任何断言与流程；
   换来的是「两次启动确实发生了」从「只能信断言编号」变成「输出里可肉眼确认」。
2. **顺带补了一条更强的证据**。第二次启动那几行直接打出
   `[restore] 已应用备份 app-…db，原库留作 pre-restore-…db` ——
   这是**服务端自己**在启动期说的「我做了恢复」，比脚本自己的断言更接近事实源。
   AC-7 的三个判据（两次启动 / 数据层 / 审计）因此有了独立的第二来源。
3. **方案 B 会削弱门禁**。把 AC 措辞改成「就绪断言 + 端口 + 两次 logs 文件名不同」，
   本质是把「看得见」降级为「推得出来」；而本任务的全部意义就是把 TASK-050 的
   「从未实测」变成「可复现验证」，方向上不应往回退。
4. 派单亦标注 A 为推荐项。

**实现**（`server/scripts/restore-e2e-check.ts`）：

```ts
async function printStartupLog(label: string, handle: ServerHandle): Promise<void> {
  await new Promise((r) => setTimeout(r, LOG_DRAIN_MS))   // 300ms，等管道数据到达
  const tail = handle.log.slice(-3)
  if (tail.length === 0) { console.log(`  · 启动日志[${label}]：（子进程未产生 stdout/stderr 输出）`); return }
  for (const line of tail) console.log(`  · 启动日志[${label}] ${line}`)
}
```

`waitForHealth(handle, label)` 在拿到 200 后 `await printStartupLog(label, handle)` 再返回 true；
两处调用点分别传 `'1'` / `'2'`。失败路径原本就有 `check(..., handle.log.slice(-5))` 作 detail，不变。

**连带改动**：`docs/operations/backup-restore.md` §4.1 的判据补上
「输出须含 `启动日志[1]` 与 `启动日志[2]` 两组片段，且两次的端口与 `logs` 文件名不同」。
**AC-7 措辞未改**（原本就写着「输出含两次启动的日志片段」，现在它成立了）。

**实际输出**（§五-3 完整日志的片段）：

```text
  · 启动日志[1] [scheduler] 已注册 0 个订阅同步任务
  · 启动日志[1] [server] listening on http://localhost:60626
  · 启动日志[1] [server] database: …\task051-restore-e2e-1793428981010\data\app.db
  ✓ 1 第一次启动：/api/health 就绪
  …
  · 启动日志[2] [restore] 已应用备份 app-20261031-144303-174.db，原库留作 pre-restore-20261031-144304-019.db
  · 启动日志[2] [server] listening on http://localhost:60626
  · 启动日志[2] [server] database: …\task051-restore-e2e-1793428981010\data\app.db
  ✓ 13 第二次启动：/api/health 就绪
```

---

## 四、记录项 R-1 ~ R-6 逐条结论

| # | 结论 | 证据 |
|---|------|------|
| **R-1** | **已改**。`HANDOFF-002` §六的 `git diff --stat` 由「16 files, +719, −50」换成 `56b2200` 时点重跑的 **「20 files changed, 1670 insertions(+), 52 deletions(-)」**，并加注「该数字随时点变化，引用时以 `<sha>` 时点为前提」 | `HANDOFF-002` §六下方更正块；§五-6 本次重跑值 |
| **R-2** | **已改**。`TASK.md` Known Issues 第 4 条改为**条件式**，并**同时记录两侧实测**：主控位本机 `E:/AiData` 可直接写（产物落 `E:\AiData\task051-*`）；执行位沙箱内不可写（`EPERM: operation not permitted, mkdir 'E:\AiData\…'`，本轮复探仍 Access denied）⇒ 设 `AI_DATA_DIR` 即可，脚本本就优先读该变量，无需改代码 | `TASK.md` Known Issues 4；本机探针输出见 §五-7 |
| **R-3** | **已改**。同批改为条件式：执行位沙箱内 pnpm workspace 命令需 `--config.verify-deps-before-run=false`，主控位本机不加也能跑通。**文档 §4.1/§4.2 因此刻意不写该参数**（写死会让可正常运行的机器以为必须额外配置） | `TASK.md` Known Issues 3；`docs/operations/backup-restore.md` §4.1/§4.2 |
| **R-4** | **已改**。去掉 catch 内 `writeLog` 前的 `void` 运算符，并在该处加两行注释说明「`writeLog` 同步返回 void，`void` 会误导读者以为它是未 await 的异步调用」。**未动** `runBackup()` 里既有的 `void writeLog('info', …)`（TASK-015/df06dbe 时代遗留、不在本轮改动面）——这会造成一处风格不一致，如实登记为后续清理项，不顺手扩范围 | `server/src/services/backup.ts:81-93` |
| **R-5** | **已改**。`check('0 临时库已迁移…', true)` → `check('0 临时库已迁移且 logs 表就位…', hasLogsTable())`，把恒真断言换成**真断言**。**断言条数仍为 10**，故 `docs/operations/backup-restore.md` §4.2 的「10 通过」判据**无需变更**（派单的连带项已核对：未改计数） | 变异探针见 §五-2b |
| **R-6** | **已改**。`HANDOFF-002` §3.3 标题改为「红（暂存修复版后，检出 `2fdd2c9`（= 修复前）版本的 `restore.ts` / `index.ts`）」，并在该节末尾补一段更正：`git checkout HEAD -- …` 是**还原到 HEAD（修复版）**的步骤，实际操作是「暂存修复版 → checkout 得旧代码 → 跑红 → 从暂存还原（SHA-256 复验）」；红本身可信度不变 | `HANDOFF-002` §3.3 |

---

## 五、验收原始输出（退出码均用 `> f 2>&1; echo $?` 方式取，未用管道后的 `$?`）

> 环境：Windows + Node v22.20.0 + pnpm 12.10.1。因执行位沙箱内 pnpm 包装器会触发
> deps-status 检查，命令均加 `--config.verify-deps-before-run=false`（见 R-3）；
> 三个脚本另设 `AI_DATA_DIR=E:/NDLDSN-WORKSPACE/.i2-review-tmp/task051-round2`
> （本沙箱 `E:/AiData` 不可写，见 R-2）。全部日志已存盘于
> `E:\NDLDSN-WORKSPACE\.i2-review-tmp\task051-round2\gates\`。

### 五-1 `restore-check`（AC-6）

```text
$ pnpm --filter server --config.verify-deps-before-run=false restore-check > f01-restore-check.log 2>&1; echo $?
0
$ tail -3 f01-restore-check.log
结果：24 通过 / 0 失败
工作区（未清理，供人工复查）：E:\NDLDSN-WORKSPACE\.i2-review-tmp\task051-round2\task050-restore-check-1793428965573
```

期望 24/0，**实际 24 通过 / 0 失败，退出码 0**。

### 五-2 `retention-check`（AC-9）

```text
$ pnpm --filter server --config.verify-deps-before-run=false retention-check > f02-retention-check.log 2>&1; echo $?
0
$ tail -3 f02-retention-check.log
结果：10 通过 / 0 失败
工作区（未清理，供人工复查）：E:\NDLDSN-WORKSPACE\.i2-review-tmp\task051-round2\task051-retention-check-1793428972570
```

AC-9 要求的三项证据（取自同一次运行的完整输出）：

```text
[backup] 删除旧备份失败（app-20261031-120001-000.db）: Error: EACCES: injected
  ✓ 4 返回的 removed 不含注入失败的文件
  ✓ 5 失败文件仍存在（未被误删、不进 removed）
  ✓ 6 其余 1 个超额文件已被真实删除
  · logs error 行原文：level=error module=backup message=保留策略删除旧备份失败（app-20261031-120001-000.db）：EACCES: injected
```

- **注入失败文件名**：`app-20261031-120001-000.db`
- **removed 列表**：长度 1（`removed[0]` = 另一超额文件，断言 6 逐字核对 `!existsSync`）
- **logs error 行原文**：见上（`level=error` / `module=backup` / message 含文件名与 `EACCES: injected`）

### 五-2b R-5 的变异探针（证明新断言非空转）

把 `hasLogsTable()` 的查询表名临时改成 `'logs-probe'`：

```text
  ✗ 0 临时库已迁移且 logs 表就位（否则 writeLog 会失败并掩盖断言）
  ✓ 1 保留份数为 7（场景前提：9 份 ⇒ 超额 2 份）
  ✓ 2 已造 9 个白名单文件名
  ✓ 3~9（其余全绿）
结果：9 通过 / 1 失败
退出码 1
```

⇒ 断言 0 **单独**变红、1~9 不受影响：它确实在检查「logs 表在不在」，而不是恒真。
还原后 SHA-256 与暂存副本一致（`C2BFD5ECFCFCFEC27E34954616F0FBBA1834C61EEBBC89B8DC3179653A2AF5B0`），
复跑回到 10/0。另做一个探针（把 migrationsFolder 指向不存在的目录）确认迁移失败时
`migrate()` 直接抛错、脚本以退出码 1 终止，不会静默继续。

### 五-3 `restore-e2e` 连续两次（AC-7 / AC-8）

```text
$ pnpm --filter server --config.verify-deps-before-run=false restore-e2e > f03-e2e-run1.log 2>&1; echo $?
0
$ pnpm --filter server --config.verify-deps-before-run=false restore-e2e > f04-e2e-run2.log 2>&1; echo $?
0
```

两次均为 **21 通过 / 0 失败**；动态端口分别 **60626** 与 **39150**（不同）。
Run1 关键输出：

```text
启动级端到端验证 → E:\NDLDSN-WORKSPACE\.i2-review-tmp\task051-round2\task051-restore-e2e-1793428981010
  动态端口：60626
  ✓ 0 临时库已迁移（服务进程不自动建表）
  · 启动日志[1] [scheduler] 已注册 0 个订阅同步任务
  · 启动日志[1] [server] listening on http://localhost:60626
  · 启动日志[1] [server] database: …\data\app.db
  ✓ 1 第一次启动：/api/health 就绪
  ✓ 2 登录取得 token
  ✓ 3 创建备份成功（201 + 文件名合法）
  ✓ 4 记下备份时点的 customers 行数
  ✓ 5 新建一行客户（201）
  ✓ 6 写入已生效（行数 = 备份时点 + 1）
  ✓ 7 排程恢复返回 202
  ✓ 8 恢复标记已写入（且本脚本不删它）
  ✓ 9 第一次启动已回收（进程退出）
  ✓ 10 回收后端口已释放
  ✓ 11 回收后进程确已消失（无孤儿）
  ✓ 12 回收后标记仍在（未被本脚本清理）
  · 启动日志[2] [restore] 已应用备份 app-20261031-144303-174.db，原库留作 pre-restore-20261031-144304-019.db
  · 启动日志[2] [server] listening on http://localhost:60626
  · 启动日志[2] [server] database: …\data\app.db
  ✓ 13 第二次启动：/api/health 就绪
  ✓ 14 服务层取证：customers 行数回到备份时点值
  ✓ 15 数据层取证：库文件 customers 行数等于备份时点值
  ✓ 16 数据层取证：备份后新增的客户已消失（恢复点之后的数据丢失）
  ✓ 17 数据层取证：标记已被启动期消费（已删除）
  ✓ 18 数据层取证：回退副本 pre-restore-* 已落备份目录
  ✓ 19 审计取证：logs module=restore 出现 applied 记录
  · logs 原文：level=warn module=restore message=已应用备份恢复：app-20261031-144303-174.db（回退副本 pre-restore-20261031-144304-019.db）
  ✓ 20 数据层取证：库文件内 restore 日志含 applied 记录
  端口 60626 已释放，两个子进程均已回收
结果：21 通过 / 0 失败
```

Run2 同样 21/0、端口 39150、末行「端口 39150 已释放，两个子进程均已回收」。

### 五-4 门禁退出码

```text
$ pnpm exec eslint server/scripts/restore-e2e-check.ts server/scripts/retention-log-check.ts \
    server/src/services/backup.ts server/src/db/restore.ts server/src/db/index.ts \
    server/scripts/restore-apply-check.ts > f05-eslint.log 2>&1; echo $?
0
$ pnpm exec prettier --check <9 个改动文件> > f06-prettier.log 2>&1; echo $?
0            （末行：All matched files use Prettier code style!）
$ pnpm exec tsc -b > f07-tsc.log 2>&1; echo $?
0
$ pnpm typecheck:server > f08-typecheck.log 2>&1; echo $?
0
$ pnpm knip > f09-knip.log 2>&1; echo $?
0            （零输出）
$ python scripts/audit-repo.py > f10-audit.log 2>&1; echo $?
0            （末行：PASS=9 FAIL=0 WARN=0）
```

### 五-5 `git status --short`（AC-10 后半）

```text
 M docs/operations/backup-restore.md
 M server/scripts/restore-e2e-check.ts
 M server/scripts/retention-log-check.ts
 M server/src/services/backup.ts
 M tasks/review/TASK-051-backup-residual-closure/TASK.md
 M tasks/review/TASK-051-backup-residual-closure/handoffs/HANDOFF-002-implementer-to-coordinator.md
?? tasks/review/TASK-051-backup-residual-closure/handoffs/2026-10-31-coordinator-review.md
?? tasks/review/TASK-051-backup-residual-closure/handoffs/HANDOFF-003-coordinator-to-implementer.md
```

全部在 File Scope 内（`docs/operations/backup-restore.md`、`server/scripts/*`、
`server/src/services/backup.ts`、`tasks/review/TASK-051-…/**`）。
后两个 `??` 是主控位的审查记录与派单，位于本任务 handoffs 目录内。

### 五-6 `git diff --stat main...HEAD`（R-1 / AC-12，时点 `e6c69b9`）

```text
 docs/operations/backup-restore.md                  |  58 +-
 server/package.json                                |   4 +-
 server/scripts/restore-apply-check.ts              |   8 +-
 server/scripts/restore-e2e-check.ts                | 443 +++++++++++++++++++++
 server/scripts/retention-log-check.ts              | 227 ++++++
 server/src/db/index.ts                             |  25 +-
 server/src/db/restore.ts                           |  41 +-
 server/src/services/backup.ts                      |  18 +-
 …/TASK-050-backup-import-and-restore/TASK.md       |  48 +-
 …（TASK-050 的 8 份 handoff，均为 0 行的纯 rename）
 …/TASK-051-backup-residual-closure/TASK.md         | 425 ++++++++++++++++++++
 …/TASK-051-…/handoffs/HANDOFF-001-…md              | 182 +++++++++
 …/TASK-051-…/handoffs/HANDOFF-002-…md              | 368 +++++++++++++++++++
 20 files changed, 1794 insertions(+), 53 deletions(-)
```

**AC-12 核对**：20 个文件里 047/048/049 三个档案**零变动**；无 `.github/workflows/**`、
`docker-compose.yml`、`Dockerfile`、`server/src/db/schema.ts`、`server/drizzle/**`。

**本轮增量（`56b2200..e6c69b9`）**：5 文件 / +166 / −19 —— 符合派单「diff 变小而不是变大」的要求。

### 五-7 `E:/AiData` 可写性探针（R-2）

```text
$ New-Item -ItemType Directory -Force -Path 'E:/AiData/.task051-probe'
New-Item: Access to the path 'E:\AiData\.task051-probe' is denied.
```

⇒ 执行位沙箱内确认不可写（与首轮一致）；主控位本机可写。Known Issues 第 4 条的条件式表述两侧都覆盖。

---

## 六、本轮自查发现的额外问题（主动登记，未擅自扩范围）

1. **我曾把 `server/scripts/restore-e2e-check.ts` 写成 CRLF 行尾**：首轮交付后用
   `[IO.File]::WriteAllLines` 做断言编号顺延，该方法在 Windows 上写 `Environment.NewLine`，
   导致 421 处 CRLF，与 `.gitattributes` 的 `* text=auto eol=lf` 相悖。
   本轮已归一回 LF（`CRLF=0` 复验），并用 `git diff --stat` 确认只余预期的 2 行差异。
   值得注意的是 `pnpm format:check` **没有**抓到它——根 `.prettierignore` 是
   「忽略除 `/src` 等少数项外的全部」，`server/scripts/**` 与 `docs/**` 根本不在 prettier
   管辖范围。这一点建议后续任务评估是否把 `server/scripts` 纳入格式门禁（本轮不做）。
2. **`runBackup()` 里的 `void writeLog('info', …)` 仍保留 `void`**（R-4 的相邻行）。
   它是 TASK-015/`df06dbe 时代的遗留、不在本轮改动面，故未顺手改；登记为后续清理项。

---

## 七、提交清单

```text
3583816 fix(TASK-051): 更正留痕溯源表述、补启动日志输出、去恒真断言与 void 噪音   ← M-2 + M-3 + R-4 + R-5
d695184 docs(TASK-051): 勾选 12 条 AC 并附证据指针，环境性表述改条件式            ← M-1 + R-2 + R-3
e6c69b9 docs(TASK-051): 更正 HANDOFF-002 的 diff 时点与红/绿措辞                 ← R-1 + R-6
```

加首轮的 5 个提交，本 PR 在撰写本节时共 **8 提交**。

> 〔2026-10-31 更正（主控位第 2 轮审查记录项 R-7）〕上句的「8」是**撰写本节时**的数字，
> 而本文件自身与紧随其后的档案提交又各加 1 个 ⇒ 主控位复审时实测为 **10 个提交**
> （`git rev-list --count main..HEAD`）。这正是 KI-11 型滞后：档案自身就在 diff 里，
> 写下的计数在被读取时已在变。**此后不再写死提交数**，一律以
> `git rev-list --count main..HEAD` 在读取时实测为准。每个提交 footer 均含 `Refs: TASK-051`
> （`bb5d424` 另含 `Refs: TASK-050`）。

---

## 八、我未做的事（边界）

未改 `.github/workflows/**`、`docker-compose.yml`、`Dockerfile`、`schema.ts`、迁移；
未改导入/恢复的 HTTP 契约、状态码、标记文件格式、`pre-restore-*` 白名单策略；
未在 `server/data/app.db` 上执行任何导入/恢复/建备份（三个脚本均自建临时库）；
未重跑 047/048/049 的回写；未改架构、签名、脚本结构（派单 §零要求）；
未改写已推送的提交历史（`91b7149` 提交信息里的过时表述因此保留，见 §二）；
**未合并、未打 tag、未自行判定 PASS**。

---

## Next Action

主控位复审：重点核对 ① M-3 选 A 的理由是否成立（§三）与 §4.1 判据是否同步；
② M-2 的两处改写与「排除 `tasks/`」判据（§二）；③ R-5 的变异探针是否足以证明非空转（§五-2b）；
④ 首轮 14 项核实表在整改后是否仍成立（AC 勾选不改变任何代码行为，`restore.ts` 签名与
6 处调用点本轮未动）。
复审通过后转 **I2 独立审查**（不携带实现上下文的新实例，记录另名 `handoffs/YYYY-MM-DD-review.md`）；
**合并需人类显式授权**。