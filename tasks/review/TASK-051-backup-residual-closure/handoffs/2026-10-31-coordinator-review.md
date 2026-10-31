# 2026-10-31 主控位审查记录 — TASK-051

> **性质声明：** 本记录是**主控位复审**（审查实例即派单实例），按 `.agents/protocols/handoff.md`
> §3.2 的两级命名分区，**不构成** I2 独立审查。I2 须由**不携带实现上下文的新实例**执行，
> 记录另名 `handoffs/YYYY-MM-DD-review.md`。本文件与派单实例同源，故只作主控位把关，
> 整改通过后仍须走 I2 + 人类授权。

---

## Meta

```yaml
Task: TASK-051 — 备份残留收口
审查对象: PR #26 / head 56b2200 / 分支 feat/TASK-051-backup-residual-closure
基线: main 2fdd2c9（TASK-050 已合并，v1.0.6 已发）
档案: tasks/review/TASK-051-backup-residual-closure/TASK.md
审查人: 主控位 Coordinator（本会话）
日期: 2026-10-31
结论: CHANGES_REQUESTED（0 阻断 + 3 必须修 + 6 记录项；技术实现与证据质量高）
```

**一句话结论**：技术交付**可合并级**——三个验证脚本我都独立跑通了（24/0、10/0、21/0 ×2），
WP-1 的目录注入在 `.env` 场景下**确实生效**（不是把双来源换个位置），WP-3 的红证据是变异测试而非空转。
拦下的三项全在**档案与文档层**：AC 一条未勾、一处可复现的历史事实错误、一条 AC 与实现的偏差。

---

## 一、已独立核实的事项（方法 → 结果）

| # | 待核事项 | 核实方法 | 结果 |
|---|---------|---------|------|
| 1 | 改动范围未越界（AC-12） | `git diff --stat 2fdd2c9..HEAD`；`git rev-list --count` | ✅ 20 文件 / +1670 / −52 / 5 提交；无 `.github/workflows/**`、`docker-compose.yml`、`schema.ts`、迁移文件 |
| 2 | TASK-050 已归档（AC-2） | `ls -d tasks/review/TASK-050*`、`find tasks/done/TASK-050-*` | ✅ `review/` 下无残留；`done/` 下 9 个文件齐全（TASK.md + 8 份 handoff） |
| 3 | Merge Record 九要素为实测值（AC-1） | `gh api repos/:owner/:repo/pulls/25 --jq …`；`git cat-file -t c571798f`；`git rev-parse v1.0.6^{commit}` | ✅ `merged=true`、`merged_at 2026-10-31T01:37:54Z`、`merge_commit_sha 2fdd2c93…`、`additions 4249`、`changed_files 48`、`deletions 143` 逐项相符；tag object `c571798f` 类型 `tag` 且解引用 = `2fdd2c93…`（与档案正文一致） |
| 4 | Next Action 终态且不写死数字（AC-3） | 读 `done/TASK-050/TASK.md:596` | ✅ 「无（终态）」；`4d936e1`/`8ef856e` 仅出现在审查叙述与 Merge Record 的事实陈述中，非 Next Action |
| 5 | 目录注入已彻底（AC-4） | `grep -rn "process.env.BACKUP_DIR" server/src server/scripts` | ✅ `db/restore.ts` **零命中**（唯一提及在 `db/index.ts:38` 的注释里，说明「原先直读」，非读取）；`config.backupDir` 在 `db/index.ts:6/35/43/44` 命中 |
| 6 | 调用点参数顺序（AC-5） | `grep -rn "applyPendingRestore\|resolveBackupFile\|resolveBackupDir" server/src server/scripts` 逐点读实参 | ✅ 6 处：`db/index.ts:57` `(dbPath, backupDir)`、`restore.ts:121` `(marker.filename, backupDir)`、`restore-apply-check.ts:183/207/285/322` `(DB_PATH, BACKUP_DIR)` —— 两参同为 `string` 但**逐点核对实参名后顺序均正确**；`resolveBackupDir` 已整体删除（零残留） |
| 7 | WP-1 修复**实质有效**（不是把双来源挪位） | 读 `server/src/env.ts` | ✅ `env.ts:36` **顶层调用** `loadDotEnv()`（自作极简加载器，无 dotenv 依赖）⇒ `db/index.ts` 新增 `import '../env.js'` 后，`db:migrate` 入口在模块加载期即已把 `.env` 注入 `process.env`，`config.backupDir` 因此可读到 `.env` 的 `BACKUP_DIR`。**这是修复成立的关键前提，我单独验证过** |
| 8 | 恢复单元级无回归（AC-6） | `pnpm --filter server restore-check` | ✅ **24 通过 / 0 失败**，含 E1~E4 回滚护栏（TASK-050 的 B-1 缺陷保护仍在生效） |
| 9 | 保留策略留痕可证（AC-9） | `pnpm --filter server retention-check` | ✅ **10 通过 / 0 失败**；输出含注入失败文件名 `app-20261031-120001-000.db`、`removed` 逐项断言、`logs` error 行原文 `level=error module=backup message=保留策略删除旧备份失败（…）：EACCES: injected`（三项 AC-9 要求的证据齐备） |
| 10 | 启动级 e2e 真实性（AC-7/AC-8） | `pnpm --filter server restore-e2e` 连跑两次 | ✅ 两次均 **21 通过 / 0 失败**；动态端口生效（57860 / 34580 不同）；两次均打印「端口已释放，两个子进程均已回收」；`.restore-pending.json` 确由**第二次启动**消费（脚本全程未删标记）；`logs` 原文 `已应用备份恢复：app-…db（回退副本 pre-restore-…db）` |
| 11 | 门禁全绿（AC-10） | 逐个取**真实退出码**（`> file 2>&1; echo $?`，不用管道后的 `$?`） | ✅ eslint `0`、`tsc -b` `0`、knip `0`（零输出）、`prettier --check` 全 matched、`audit-repo.py` **PASS=9 FAIL=0 WARN=0**（F8 现 26 档、F9 现 51 编号） |
| 12 | 文档三条命令与判据（AC-11） | 读 `docs/operations/backup-restore.md` §1/§3.1/§4.1/§4.2/§6 | ✅ 目录口径行、`applyPendingRestore(dbPath, backupDir)` 的注入说明、`restore-e2e`（判据 21/0）与 `retention-check`（判据 10/0）均已落地；§6 第 223 行正确写明「`db:migrate` 也经 `env.ts` 解析 `.env`」；**项数与我实测一致** |
| 13 | 未伪造审查记录、未自我回写 | 读 TASK-051 的 Merge Record 段 | ✅ 保留占位并写「由下一个任务回填、禁止自我回写」，与 D13-C 选项 C 一致 |
| 14 | 真实库未被触碰 | 读 `retention-log-check.ts` / `restore-e2e-check.ts` 的 env 构造 | ✅ 两者均自建临时库 + 临时备份目录，且以 `await import()` 推迟项目模块求值（注释说明了为何不能用静态 import）；`restore-e2e` 的两次启动子进程全部回收 |

---

## 二、必须修（3 项）

### M-1 `TASK.md` 的 12 条 AC **一条都未勾选**

```
$ sed -n '/## Acceptance Criteria/,/## File Scope/p' TASK.md | grep -c '\[x\]'
0
$ … | grep -c '\[ \]'
12
```

而 `Current State` 明确写「执行位交付，`Status: REVIEW`…门禁全绿…红/绿实测各一组」。
两者矛盾：**交付声明已下、验收状态未表达**。框架的交付完整性核对项要求「AC 复选框与交付状态一致」，
这一项不触发 CI，只能人工看，因此必须由执行位补齐。

**要求**：逐条勾选，且**每条后面附一行证据指针**（命令 + 期望值 + 实际值，或档案行号）。
不许整段一次性 `- [x]` 而无证据——上一轮 TASK-050 的做法（每条 `>` 引注）是可接受的样板。

### M-2 「保留策略失败写日志的分支**自 TASK-015 起就在位**」是可复现的事实错误

出现 2 处：

- `server/scripts/retention-log-check.ts:8`
- `docs/operations/backup-restore.md:181`

实测引入点：

```text
$ git log -S "保留策略删除旧备份失败" --oneline -- server/src/services/backup.ts
df06dbe refactor(backup): 抽离备份文件名规则到零依赖模块   (2026-10-31 09:37:54 +0800)

$ git cat-file -p $(git rev-parse 00345ff:server/src/services/backup.ts) | grep -n "console.error"
82:      console.error(`[backup] 删除旧备份失败（${file.filename}）:`, err)   ← 只有 console.error，无 writeLog

$ git cat-file -p $(git rev-parse dbb3698:server/src/services/backup.ts) | grep -n "writeLog"
5:import { writeLog } from './logger.js'
111:    void writeLog('info', …)                                            ← catch 内仍无 writeLog

$ git merge-base --is-ancestor df06dbe 2fdd2c9 && echo YES
YES                                                                    ← df06dbe 属 PR #25 的提交
```

即：**TASK-015 引入时与 TASK-050 合并前都没有**，该 `writeLog` 由 TASK-050 PR #25 内的
`df06dbe`（首轮审查 `ba8537e` 之后的整改期）新增，TASK-050 的保留策略失败日志也是那一轮补的。
正确表述应为「自 TASK-050 起就在位（该分支当时补了日志但未补测试）」。

**为什么必须改**：这不是文案洁癖。`自 TASK-015 起` 会让接手者认定「这是长期遗留、行为稳定」，
而事实是**上一轮任务刚落的新代码且从未被测过**——两者的风险判断完全不同。
更刺眼的是：同一份交接的 §四「红（证明断言非空转）」正是**临时删掉这段 `writeLog`** 造出来的红，
说明执行位清楚它是本次目标的一部分，与「自 TASK-015 起就在位」自相矛盾。

### M-3 AC-7 的「输出含**两次启动**的日志片段」实际未满足

`restore-e2e-check.ts` 的 `ServerHandle.log` 只在 **health 探测失败时**作为 `detail` 打印
（`:283` / `:349` 的 `check(..., first.log.slice(-5))`）。成功路径下，两次启动在输出中只留下：

```text
✓ 1 第一次启动：/api/health 就绪
✓ 13 第二次启动：/api/health 就绪
```

**没有子进程 stdout 的片段**。我两次实跑的输出均如此（全文已核）。

两种收法，任选其一但必须择一：
1. **改实现**：每次 `waitForHealth` 成功后打印 `log.slice(-3)`（带缩进前缀区分第几次启动），
   使「两次启动确实发生了」在输出里可肉眼确认；
2. **改 AC 措辞**（若认为片段非必要）：把 AC-7 改为「输出含两次启动的就绪断言 + 各自端口」，
   并说明为何不需要 stdout 片段。

**不许两边都不动**——现状是 AC 写了、实现没做、也没人说明，属「验收项与实际不符」的典型形态。

---

## 三、记录项（不阻断，整改时一并处理）

| # | 位置 | 问题 | 建议 |
|---|------|------|------|
| R-1 | `HANDOFF-002` §六 | 门禁表下方的 `git diff --stat main...HEAD` 写「16 files, +719, −50」，**实测 20 文件 / +1670 / −52**。原因是该输出取自档案提交之前的时点（KI-11 型鸡生蛋），但被当作门禁证据引用 | 重跑该命令并替换，或加一句「此输出取自 `<sha>` 时点，档案提交后为 20 文件」 |
| R-2 | `TASK.md` Known Issues 第 4 条 | 「`E:/AiData` 在本沙箱不可写」**未复现**：我直接 `pnpm retention-check` / `restore-e2e` 均成功，产物落在 `E:\AiData\task051-*` 三个目录，`touch E:/AiData/.write-probe` 亦通过 | 改为「当前可写；若在受限环境请设 `AI_DATA_DIR`」。现在的写法会让后来者以为必须额外配置才能跑 |
| R-3 | `TASK.md` Known Issues 第 3 条 | 称「交接与验证记录中的 pnpm 命令均已带 `--config.verify-deps-before-run=false`」，但文档 §4.1/§4.2 与我实际执行的命令**都不带该参数却都成功** | 与 R-2 同批更正为条件式表述 |
| R-4 | `services/backup.ts:74` | `void writeLog(...)`：`writeLog` 是**同步**函数（`logger.ts:15` 返回 `void`，内部 `.run()` 同步），`void` 运算符在此纯属噪音，并暗示「异步未 await」 | 去掉 `void`，或改注释说明为何保留（若为统一风格） |
| R-5 | `retention-log-check.ts:129` | `check('0 临时库已迁移…', true)` 是**恒真断言**：迁移失败时它照样绿，靠 8/9 间接兜底 | 改为 `check(…, hasLogsTable())`，或降级为 `console.log` 阶段标记（后者更诚实：它不是断言） |
| R-6 | `HANDOFF-002` §3.3 | 标题写「红（修复前代码，`git checkout HEAD -- restore.ts index.ts`）」——该命令是**还原到 HEAD**，与「切到修复前」语义相反；红本身可信（输出显示 `customers=3`、标记未消费），纯属措辞歧义 | 改为「红（暂存修复版后检出 `2fdd2c9` 版本）」，并保留还原用的 `git checkout HEAD -- …` 作为复验步骤 |

---

## 四、值得肯定（写进记录，供 I2 与后续任务参照）

1. **Known Issues 第 5 条主动自曝了 WP-1 的副作用**：`db/index.ts import env.js` 后 `db:migrate`
   也开始从 `.env` 读 `DATABASE_URL`，目标库可能从 `server/data/app.db` 变为 `.env` 指定库。
   这一点**我在审查中独立想到并去查了**，发现执行位已先一步登记，且给出了容器内不受影响的理由
   （`docker-compose.yml` 以 OS env 传，优先级高于 `.env`，而 `loadDotEnv` 有
   `if (process.env[key] === undefined)` 的保护）。这是本轮质量最高的自曝项。
2. **WP-1 的红/绿直击缺陷本质**：红状态下 `pnpm db:migrate` **退出码 0、零报错**、
   库未替换、标记未消费、无 `pre-restore-*` —— 这正是 TASK-050 Known Issues 第 13 条描述的
   「fail-closed 且无日志」，即「跑了 migrate，恢复没发生还没人知道」。用「退出码 0」作为红的特征
   比用「报错」更能证明修复前的静默性。
3. **WP-3 用的是变异测试而非空转**：临时移除 `writeLog` 整块 → 断言 8/9 变红（8/2）→ 还原后
   转绿，并核对还原文件 SHA-256 与暂存副本一致。这比「直接跑绿」有说服力得多。
4. **两处偏差都上报且理由可查**：偏差 1（`resolveBackupFile` 去 `dbPath` 形参）给了 eslint
   `no-unused-vars: args:'all'` 的硬理由，且该函数为模块内私有、全仓仅 1 个调用点（我已验证）；
   偏差 2（`node --import tsx` 取代 pnpm 包装器）理由具体。
5. **e2e 的隔离设计正确**：用顶层 `await import()` 把项目模块求值推迟到 env 就绪之后，
   并在注释里写清了「静态 import 会先于顶层语句求值」的原因——这个坑不写清，后来者改回静态
   import 就会连到 `server/data/app.db`。

---

## 五、我未做的事（如实标注，避免被当作已验证）

- **未在 Linux 上验证 e2e 的进程回收**。本机只有 Windows；`child.kill` /
  `process.kill(pid, 'SIGKILL')` 跨平台等价属推断，与执行位 Known Issues 第 1 条的自我声明一致。
- **未独立复现 WP-1 的 `.env` 场景红/绿**（需临时造 `.env` + 迁移 + 计数，成本较高）。
  我改为静态验证其成立前提（`env.ts:36` 顶层 `loadDotEnv()`），并用 `db/index.ts` 的
  `config.backupDir` 推导链确认注入路径完整；该红的可信度由 `HANDOFF-002 §3.3` 的原始输出支撑，
  但我**没有亲自跑**——若 I2 认为必要，应要求其独立复现。
- **未跑前端测试套件**：本任务零前端改动，`git diff --stat` 可证。
- **未跑冒烟第 18/19 段**：需要隔离库 + 起服务端，本轮无改动涉及冒烟路径（`routes/backups.ts`
  本次未改）。
- **未验证镜像/发布**：本任务不打 tag。

---

## 六、结论与后续

- 结论 **CHANGES_REQUESTED**：0 阻断、3 必须修（M-1~M-3）、6 记录项（R-1~R-6）。
- 整改派单：`handoffs/HANDOFF-003-coordinator-to-implementer.md`。
- 整改闭环后 → 主控位复审 → **I2 独立审查**（新实例，记录另名 `YYYY-MM-DD-review.md`）→
  **人类显式授权** → rebase-merge。合并后本任务仍留 `tasks/review/` + `Status=REVIEW`，
  由**下一个任务**以 **D13-C 第十三实例**回填 Merge Record。
