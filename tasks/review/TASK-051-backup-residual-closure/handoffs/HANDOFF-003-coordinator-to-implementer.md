# HANDOFF-003 — 主控位 Coordinator → 执行位 Implementer（整改）

> **前置必读**：`handoffs/2026-10-31-coordinator-review.md`（本轮审查记录，含每项的复现命令与实测值）。
> 该记录里我贴的每条命令与输出都可直接复跑——**不要采信本文件的转述**，以记录中的原始命令为准。

---

## Meta

```yaml
Task: TASK-051 — 备份残留收口
轮次: 第 1 轮整改（首轮审查判定 CHANGES_REQUESTED）
审查结论: 0 阻断 + 3 必须修 + 6 记录项
基线: 分支 feat/TASK-051-backup-residual-closure，当前 head 56b2200
要求: 逐条闭环并留证；完成后推送、停下等复审
禁止: 合并 / 打 tag / 自我判定 PASS / 夹带 File Scope 外的改动
```

---

## 零、先说清楚：技术实现不用重做

我独立跑通了三个脚本，结果是 **24/0**（restore-check）、**10/0**（retention-check）、
**21/0 × 2 次**（restore-e2e，端口 57860 / 34580 不同，两次都打印「端口已释放，两个子进程均已回收」）。
`process.env.BACKUP_DIR` 在 `db/restore.ts` 零命中，6 处调用点的实参顺序逐点核对无误，
`env.ts:36` 的顶层 `loadDotEnv()` 也确认了 WP-1 的修复**实质有效**（不是把双来源换个位置）。

**所以：不要因为要整改就去改架构、改签名、改脚本结构。** 本轮只处理档案层与三处小问题。

---

## 一、必须修（按顺序做，每项一个提交）

### M-1 勾选 `TASK.md` 的 12 条 AC，每条附证据指针

现状 `[x]` = 0 条、`[ ]` = 12 条，而 `Current State` 已宣告交付完成。这是自相矛盾的。

**要求**：

- 逐条 `- [ ]` → `- [x]`；
- **每条下面加一行 `>` 引注**，写「命令 + 期望值 + 实际值」或「档案/交接行号」。
  可直接复用我审查记录 §一 的核实表（14 行，覆盖 AC-1~AC-12），但要**自己跑一遍**
  再写实际值——我给你的是我的实测，不是你的交付证据。
- 特别地，**AC-7 的勾选必须等 M-3 处理完**再定：先按 M-3 的结论改 AC 措辞或补输出，
  然后按新的判据勾选。不许在 M-3 未定时先勾 AC-7。

### M-2 更正「自 TASK-015 起就在位」这一事实错误（2 处）

位置：`server/scripts/retention-log-check.ts:8`、`docs/operations/backup-restore.md:181`。

实测证据（复跑即可）：

```bash
git log -S "保留策略删除旧备份失败" --oneline -- server/src/services/backup.ts
# → df06dbe refactor(backup): 抽离备份文件名规则到零依赖模块   (2026-10-31 09:37:54 +0800)

git cat-file -p $(git rev-parse 00345ff:server/src/services/backup.ts) | grep -n "console.error"
# → 82: console.error(…删除旧备份失败…)     ← TASK-015 引入时**只有** console.error

git cat-file -p $(git rev-parse dbb3698:server/src/services/backup.ts) | grep -n "writeLog"
# → 5:import { writeLog } / 111: void writeLog('info', …)   ← catch 内**没有** writeLog

git merge-base --is-ancestor df06dbe 2fdd2c9 && echo YES
# → YES   （df06dbe 属 PR #25）
```

**正确表述**：该 `writeLog` 由 **TASK-050 的 PR #25**（提交 `df06dbe`，首轮审查 `ba8537e`
之后的整改期）新增，当时补了日志但**未补测试**；TASK-051 补的是测试与可注入点。

改完后请自查（**判据必须排除 `tasks/`**，否则会命中本派单与审查记录自身——那种「判据自污染」
会让命令永远非零）：

```bash
grep -rn "自 TASK-015 起" --include=*.md --include=*.ts . | grep -v node_modules | grep -v "^./tasks/"
# → 必须为空（唯一允许的残留是 tasks/ 下的历史审查与派单引文）
```

> 提醒：你在交接 §四「红（证明断言非空转）」里正是**临时删掉这段 `writeLog`** 造的红。
> 一边说它「自 TASK-015 起就在位」、一边把它当本次目标移除，读者会认为其中之一是假的。
> 两处叙事要统一到同一事实上。

### M-3 AC-7 的「输出含两次启动的日志片段」与实现不符——**必须择一处理**

现状：`ServerHandle.log` 只在 health 失败时作 `detail` 打印（`:283` / `:349`），
成功路径下输出只有两行「✓ 第 N 次启动：/api/health 就绪」，**没有子进程 stdout 片段**。

二选一，并在交接里写明**为什么选这一条**：

- **方案 A（推荐，改实现）**：`waitForHealth` 成功后打印 `log.slice(-3)`，带前缀区分
  第几次启动，例如 `· 启动日志[1]：Restore pending detected …`。这样「两次启动」在输出里可肉眼确认，
  AC-7 保持原措辞即可。
- **方案 B（改 AC 措辞）**：把 AC-7 改为「输出含两次启动的就绪断言 + 各自端口 + 两次的
  `logs` 文件名不同」，并补一句为何不需要 stdout 片段。

**不许**只勾 AC 而不动任一边。若选 B，**AC 的措辞改动要连 `Verification Plan` / `Requirements`
里引用处一起改**，别留下第二份口径。

---

## 二、记录项（与上面的提交合批或单独一个 `docs` 提交，逐条给结论）

| # | 位置 | 要做什么 |
|---|------|---------|
| R-1 | `HANDOFF-002` §六 | `git diff --stat main...HEAD` 写的是「16 files, +719, −50」，实测 **20 文件 / +1670 / −52**。重跑替换，或标注该输出取自档案提交之前的时点（KI-11） |
| R-2 | `TASK.md` Known Issues 第 4 条 | 「`E:/AiData` 不可写」未复现（我直接跑通两个脚本，产物落在 `E:\AiData\task051-*`，`touch` 探针通过）。改为条件式：「当前可写；受限环境设 `AI_DATA_DIR`」 |
| R-3 | `TASK.md` Known Issues 第 3 条 | 称 pnpm 命令「均已带 `--config.verify-deps-before-run=false`」，但文档 §4.1/§4.2 与我实跑的命令都不带且成功。与 R-2 同批改成条件式 |
| R-4 | `server/src/services/backup.ts:74` | `void writeLog(...)` 的 `void` 是噪音（`writeLog` 同步返回 `void`）。去掉；若坚持保留，在注释里写清理由 |
| R-5 | `retention-log-check.ts:129` | `check('0 …', true)` 恒真。改为 `check(…, hasLogsTable())`，或降级成 `console.log` 阶段标记（它不是断言，别混进 10 项计数里——若改计数，文档 §4.2 的「10 通过」判据要同步） |
| R-6 | `HANDOFF-002` §3.3 | 标题「红（修复前代码，`git checkout HEAD -- restore.ts index.ts`）」语义相反——那条命令是还原到 HEAD。改为「暂存修复版后检出 `2fdd2c9` 版本」，把 `git checkout HEAD -- …` 明确标为**还原步骤** |

**R-5 的连带项**：如果它改变了断言条数，`docs/operations/backup-restore.md` §4.2 的判据
（「末行 `结果：10 通过 / 0 失败`」）必须同批更新；否则我下一轮会按旧判据卡你。

---

## 三、验收（必须留原始输出，贴进 HANDOFF-004）

按顺序跑，**每条都要贴完整输出与退出码**，退出码用 `> f 2>&1; echo $?` 取，
**不要用管道后的 `$?`**（那取的是 `tail` 的退出码——我本轮就差点被这个坑误导）：

1. `pnpm --filter server restore-check` → 期望 24/0
2. `pnpm --filter server retention-check` → 期望 10/0（若 R-5 改了计数，按新判据交并在文档同步）
3. `pnpm --filter server restore-e2e` → **连跑两次**，期望 21/0 ×2，两次端口不同
4. `pnpm exec eslint <改动文件>` / `pnpm exec prettier --check <改动文件>` / `pnpm exec tsc -b` /
   `pnpm exec knip` / `python scripts/audit-repo.py`（期望 `PASS=9 FAIL=0 WARN=0`）
5. `git status --short` 仅 File Scope 内文件
6. `git diff --stat main...HEAD`（**按 R-1 的教训，写清这是哪个时点**）

---

## 四、边界（与上一轮相同，重申）

- 不改 `.github/workflows/**`、`docker-compose.yml`、`Dockerfile`、`schema.ts`、迁移；
- 不改导入/恢复的 HTTP 契约、状态码、标记文件格式、`pre-restore-*` 白名单策略；
- 不在 `server/data/app.db` 上执行任何导入/恢复/建备份（脚本均自建临时库，保持即可）；
- 不重跑 047/048/049 的回写；
- **不合并、不打 tag、不自我判定 PASS**；
- 不把整改范围扩到「顺手重构」——本轮结束后我要看到的是 diff 变小而不是变大。

---

## 五、交付物

1. 逐条闭环的代码/文档改动（建议提交粒度：M-2 + M-3 + R-4/R-5 一批，M-1 的 AC 勾选一批，
   HANDOFF-002 的两处更正一批）；
2. `handoffs/HANDOFF-004-implementer-to-coordinator.md`：**逐条**（M-1~M-3、R-1~R-6）给
   闭环证据，含命令、期望值、实际值；M-3 要写明选了 A 还是 B 及理由；
3. 推送后**停下**，等我复审。复审通过后才转 I2 独立审查与人类授权。
