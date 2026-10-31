# 2026-10-31 主控位第 2 轮审查（复审）— TASK-051

> **性质声明：** 本记录仍是**主控位复审**（审查实例 = 派单实例），按 `.agents/protocols/handoff.md`
> §3.2 的两级命名分区，**不构成** I2 独立审查。I2 须由不携带实现上下文的新实例执行，
> 记录另名 `handoffs/YYYY-MM-DD-review.md`。

---

## Meta

```yaml
Task: TASK-051 — 备份残留收口
审查对象: PR #26 / head a17a6ab / 分支 feat/TASK-051-backup-residual-closure
基线: main 2fdd2c9（TASK-050 已合并，v1.0.6 已发）
上一轮: handoffs/2026-10-31-coordinator-review.md（CHANGES_REQUESTED，0 阻断 + 3 必须修 + 6 记录项）
审查人: 主控位 Coordinator（本会话）
日期: 2026-10-31
结论: 整改 PASS（0 必须修 + 0 阻断）；但合并被 1 项外部 CI 故障阻断（非本 PR 引入），
      另有 2 项记录项不阻断；合并前置见 §四
```

**一句话结论**：M-1 / M-2 / M-3 与 R-1~R-6 **全部闭环**，且三处关键声明我都用**自己构造的探针**
复现过（R-5 的变异、M-2 的 blob 溯源、M-3 的启动日志）。**但 `install-lint-build` 在 CI 上是红的**——
原因是 GitHub 的 `ubuntu-latest` 已滚动到 `ubuntu-26.04`，而仓库钉的 Playwright 1.59.1 不支持该系统，
**与本 PR 的改动无关**，却足以卡住合并。

---

## 一、独立复跑（不采信交接自述）

| 项 | 命令 | 结果 |
|---|---|---|
| `restore-check` | `cd server && pnpm restore-check` | **24 通过 / 0 失败，退出码 0** |
| `retention-check` | `cd server && pnpm retention-check` | **10 通过 / 0 失败，退出码 0** |
| `restore-e2e` ×2 | `cd server && pnpm restore-e2e`（连续两次） | **21 / 0 两次，退出码 0**，端口 **9175 / 33365**（不同）；两次均打印 `启动日志[1]`/`启动日志[2]` 与「端口 … 已释放，两个子进程均已回收」 |
| eslint（6 文件） | `pnpm exec eslint …` | 退出码 **0** |
| `tsc -b` | `pnpm exec tsc -b` | 退出码 **0** |
| `typecheck:server` | `pnpm typecheck:server` | 退出码 **0** |
| knip | `pnpm knip` | 退出码 **0**，零输出 |
| 框架审计 | `python scripts/audit-repo.py` | 退出码 **0**，`PASS=9 FAIL=0 WARN=0` |
| 断言条数复算 | `grep -cE "^\s*check\("` | `restore-e2e-check.ts` = **21**、`retention-log-check.ts` = **10** —— 与文档 §4.1/§4.2 判据逐字一致 |

退出码一律用 `cmd > f 2>&1; echo $?` 取，未用管道后的 `$?`（首轮 R 项教训）。

## 二、我用自己构造的探针复现的三件事

### 2.1 R-5 的变异探针（证明新断言不是空转）

不采信交接里的 9/1 输出，我自己注入缺陷：把 `hasLogsTable()` 的
`name = 'logs'` 改成 `name = 'logs-probe'`，然后跑 `pnpm retention-check`：

```text
  ✗ 0 临时库已迁移且 logs 表就位（否则 writeLog 会失败并掩盖断言）
结果：9 通过 / 1 失败
probe_exit=1
```

**只有断言 0 变红、1~9 不受影响** ⇒ 它确实在查 `logs` 表是否存在，不是 `check(..., true)` 恒真。
还原后 `git diff` 为空，`sha256 = c2bfd5ecfcfcfec27e34954616f0fbba1834c61eebbc89b8dc3179653a2af5b0`
——与 `HANDOFF-004` §五-2b 自述的 `C2BFD5EC…5B0` **逐字相同**，复跑回到 10/0。

### 2.2 M-2 的事实溯源（不采信 `git show`）

```text
$ git diff --shortstat 2fdd2c9 56b2200
 20 files changed, 1670 insertions(+), 52 deletions(-)       ← 与 R-1 更正值逐字相同
$ git log -1 --format="%B" 91b7149 | grep -n "TASK-015"
3:applyRetention() 的 catch 分支（写 error 级 logs）自 TASK-015 起就在位，但复现它
```

⇒ ① R-1 的更正数字**实测成立**（首轮的 `16 files / +719 / −50` 确为档案提交前的时点）；
② 执行位主动登记的「`91b7149` 提交信息残留旧表述、因禁 force-push 不改历史」**属实**——
我独立确认该提交信息里确有这句话，且它只在提交历史中，不在任何工作区文件里。

改后表述我也核了：`retention-log-check.ts:8-16` 与 `docs/operations/backup-restore.md` §4.2
都已写成「由 **TASK-050 的 PR #25**（提交 `df06dbe`）新增——当时补了日志但未补测试」，
并附三条可复现的溯源命令。判据排除 `tasks/` 后**零命中**（`tasks/` 内 14 处命中全是本次审查/派单的引文，属允许范围）。

### 2.3 M-3 的启动日志（不是「改措辞」，是真看得见）

我自己跑的两次 e2e 日志里，第二次启动那段直接打出服务端自言自语：

```text
  · 启动日志[2] [restore] 已应用备份 app-20261031-160452-666.db，原库留作 pre-restore-20261031-160453-620.db
```

这比脚本自己的断言更接近事实源——「启动期真的做了恢复」现在在输出里可肉眼确认。
`docs/operations/backup-restore.md` §4.1 的判据也已补上「输出须含 `启动日志[1]`/`启动日志[2]`
两组片段，且两次的端口与 `logs` 文件名不同」，**AC-7 措辞未改**（原本的要求现在成立了），
符合派单「不许两边都不动」的约束。

## 三、逐项闭环核对

| 项 | 判定 | 我核到的依据 |
|---|---|---|
| **M-1** 12 条 AC 全勾 | ✅ | `[x]`=12 / `[ ]`=0；每条都有 `>` 引注写「命令 + 期望 + 实际」；AC-4/AC-5/AC-12 我逐条复算成立（`process.env.BACKUP_DIR` 在 `restore.ts` 零命中；6 处调用点实参顺序为 `(dbPath, backupDir)` / `(marker.filename, backupDir)` / 4 处 `(DB_PATH, BACKUP_DIR)`；diff 无 workflows/compose/schema/迁移/047-049） |
| **M-2** 溯源更正 | ✅ | 见 §2.2；2 处正文已改，判据零命中，已推送提交信息里的残留如实登记且**未**改写历史 |
| **M-3** AC-7 与实现择一 | ✅ | 选方案 A（改实现）；`printStartupLog()` 在 `waitForHealth` 拿到 200 后打印最近 3 行，`LOG_DRAIN_MS=300` 处理管道延迟；文档判据同步；我实跑见到两组片段 |
| **R-1** diff 数字 | ✅ | `56b2200` 时点实测 `20 files / +1670 / −52`，与更正块逐字相同 |
| **R-2** `E:/AiData` 不可写 | ✅ | 改为**条件式**并同时记录两侧实测（执行位沙箱不可写 / 主控位可写）；我复跑确实落在 `E:\AiData\task051-*` |
| **R-3** pnpm 参数 | ✅ | 同改条件式，并刻意**不**把 `--config.verify-deps-before-run=false` 写进文档（避免让正常机器以为必须配）；我本机不加参数全部跑通 |
| **R-4** `void writeLog` 噪音 | ✅ | catch 内已去 `void` 并加注理由；`grep "void writeLog"` 只剩 `runBackup()` 的 1 处（TASK-015 遗留），如实登记为后续清理项、未顺手扩范围 |
| **R-5** 恒真断言 | ✅ | 见 §2.1；断言条数仍 10，故文档「10 通过」判据无需变更（派单的连带项已核） |
| **R-6** 红/绿措辞 | ✅ | `HANDOFF-002` §3.3 已改为「暂存修复版 → 检出旧版 → 跑红 → 从暂存还原（SHA-256 复验）」并加更正段 |

**首轮 14 项核实是否被本轮改动影响**：`restore.ts` / `db/index.ts` 的签名与 6 处调用点本轮**零改动**
（`git diff 56b2200..HEAD -- server/src/db/` 为空），整改只动了脚本打印、断言与文档 ⇒ 首轮结论仍成立。

## 四、新发现（本轮）

### E-1（阻断合并，**非本 PR 引入**）CI `install-lint-build` 因 runner 镜像滚动而红

```text
run 41178010478（head a17a6ab）  install-lint-build  fail  37s   audit  pass  9s
run 41169151883（head d695184）  install-lint-build  fail        （同上）
$ pnpm test:browser:install → playwright install chromium --with-deps
  Image: ubuntu-26.04
  BEWARE: your OS is not officially supported by Playwright; installing dependencies for ubuntu26.04-x64 as a fallback.
  Error: ERROR: Playwright does not support chromium on ubuntu26.04-x64
```

- **归因**：`ci.yml:18` 用 `runs-on: ubuntu-latest`，今天 GitHub 把 `ubuntu-latest` 滚到了
  `ubuntu-26.04`；仓库钉的 `playwright@1.59.1`（最新 1.64.1）不支持该系统 ⇒ `--with-deps` 直接失败。
  **main 上一次 CI（run `41156271179`，01:37）是 success**，两次失败分别在 04:34 / 06:47 ⇒
  是**环境侧在 01:37~04:34 之间变化**，不是 TASK-051 的代码。
- **影响**：`install-lint-build` 是必需检查 ⇒ 当前 head **不可合并**。`audit` 仍 pass。
- **修复路径都要越出本任务 File Scope，且其中一条撞 HD-2**：
  1. `ci.yml` 把 `runs-on` 钉成 `ubuntu-24.04`（最小改动、最稳）；
  2. 或把 `playwright` 升到 ≥1.64（要改根 `package.json`+锁文件，并全量复验前端套件）。
  两条都涉及 `.github/workflows/**` 或根依赖 ⇒ **推送需要 `workflow` scope，而当前活动账号没有**
  （HD-2 已裁决：推送被拒须停工上报，**禁网页绕过**）⇒ **必须由人类决定，我不动手**。

### R-7（记录项）`HANDOFF-004` §七 的提交数滞后

写「加首轮的 5 个提交，本 PR 共 **8 提交**」，实测 **10**（`git rev-list --count 2fdd2c9..HEAD`）。
原因是它写于 `e6c69b9`（第 8 个），其后 `546cd22`（自身）与 `a17a6ab` 又推进了两个 head ——
**KI-11 型自指滞后**，属机制性代价。I2 与后续引用**须以合并时点 head 的实测为准**，不要抄这个数字。

### R-8（记录项）`Current State` 条目时序倒置

顺序为 起草 → 领取 → 交付 → **整改** → **主控位审查**，而审查实际发生在整改**之前**。
虽每条形如「第 1 轮」「完成第 1 轮整改」，读者可推断，但时间线视觉上倒挂。
建议 I2 之后由执行位把审查条目上移到「交付」与「整改」之间（纯档案改动，不阻断）。

## 五、合并前置（按顺序，缺一不可）

1. **CI 转绿**：由人类决定 §四 E-1 的修复路径并授权相应改动；在此之前 `mergeable: MERGEABLE`
   只表示无冲突，**不表示可合并**。
2. **把本轮审查记录入库**：`handoffs/2026-10-31-coordinator-review.md` 与
   `handoffs/HANDOFF-003-coordinator-to-implementer.md` 目前仍是 `??`（未跟踪），
   本轮新记录同样会以 `??` 出现 ⇒ 按 KI-11 的既定处置**同批提交、不新开 Handoff 文件**。
3. **I2 独立审查**（不携带实现上下文的新实例，记录另名 `handoffs/YYYY-MM-DD-review.md`）。
4. **人类显式授权合并** → `gh pr merge 26 --rebase --delete-branch`。

## 六、我未做的事（如实标注，避免被当作已验证）

- **未在 Linux 上跑过** `restore-e2e` / `retention-check` / `restore-check`（本机 Windows）；
  进程回收的跨平台等价性仍属 Known Issues 第 1 条，未被我独立证实。
- **未核对 DockerHub Tags API 的 digest**（`sha256:edd1338b…`）——需外部 registry 查询，本轮未做；
  AC-1 的其余字面量（`merged_at`、`merge_commit_sha`、三个 run id 与 conclusion）我已用 `gh api` 复核成立：
  `41156271179` / `41156271209` / `41158945149` 均为 `2fdd2c9`、`push`、`success`。
- **未复跑**冒烟第 18/19 段与前端 335 例（本任务零前端改动；冒烟依赖隔离库与带 mock 的服务端）。
- **未验证** `retention-check` 在 `keep=7` 之外的取值下的行为（场景固定 keep=7，属脚本设计）。

## 七、结论与后续

- 对**执行位**：本轮整改 **PASS**，无须再派整改单；`R-7`/`R-8` 与 E-1 的修复一并由**下一个动作**承载。
- 对**流程**：技术债三项（目录注入 / 启动级 e2e / 保留策略留痕）都已从「声称」变成「可复现」，
  这是 TASK-051 的核心价值，已达到。
- **当前状态**：`Status: REVIEW`、留在 `tasks/review/`（D13-C 机制）；**未合并、未打 tag**。
  本任务合并后由下一个任务以 **D13-C 第十三实例**回填 Merge Record。
