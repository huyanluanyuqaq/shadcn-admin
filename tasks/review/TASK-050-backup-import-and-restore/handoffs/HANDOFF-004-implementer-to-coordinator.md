# HANDOFF-004 — 执行位 Implementer → 主控位 Coordinator（整改闭环）

---

## Meta

```yaml
From: 执行位 Implementer（Claude Code / Opus 5）
To: 主控位 Coordinator
Task: TASK-050 — 备份导入与备份恢复
Date: 2026-10-31
Current State: CHANGES_REQUESTED → 整改完成，待复审
Previous Handoff: HANDOFF-003-coordinator-to-implementer.md（整改派单）
审查记录: handoffs/2026-10-31-coordinator-review.md（2 阻断 + 1 必须修 + 3 建议 + 4 记录项）
```

**基线复核**：`git rev-parse HEAD` = `ba8537ef1d09c77ce9783e8b07dadc53622d8b7b`（与派单要求一致）。
本交接只整改 HANDOFF-003 列出的 7 项，**未**改第 19 段编号、未重排文档结构、未动
`docker-compose.yml`、未把 `server/scripts/**` 纳入 tsconfig、未新增取消端点、
未重跑 D13-C 回写、未合并、未打 tag、未自行判定 PASS。

---

## 逐条闭环（B-1 → B-2 → M-1 → M-2 → M-3 → L-1 → L-2）

### B-1（阻断）回滚分支删除现库 —— ✅ 已修 + 回归护栏 + 红/绿两步实测

**改动**：`server/src/db/restore.ts` —— 删除判据由「`dbPath` 是否存在」改为「**原库是否已被
rename 走**」（`liveRenamed`，原 `currentRenamed` 改名以更准确表达语义）：

```ts
} catch (err) {
  try {
    // 只有原库已改名时，dbPath 才是本次尝试复制出来的半成品，才允许删除
    if (liveRenamed && existsSync(dbPath)) rmSync(dbPath, { force: true })
    if (liveRenamed && existsSync(preRestorePath)) renameSync(preRestorePath, dbPath)
  } catch (rollbackErr) { ... }
}
```

**回归护栏**：`restore-apply-check.ts` 新增 **E 段（E1~E4）**。场景 = 把现库写成 4096 字节
`0x5A`（`new Database` 能打开，但 `handle.pragma('wal_checkpoint(TRUNCATE)')` 抛
`SQLITE_NOTADB` ⇒ 失败点确在 ①，与主控位实测口径一致）。

**红/绿两步原始输出**（存档 `E:/AiData/t050-b1-red.log` / `t050-b1-green.log`，未入库）：

**第一步 —— 未修的 `restore.ts` 上先补 E 段，跑出红：**

```text
$ pnpm --filter server restore-check
  ✓ D1 备份不可用时返回 failed
  ✓ D2 失败原因非空
  ✓ D3 保留标记（供下次启动重试/诊断）
  ✓ D4 两目录内容未被改动（现库与回退副本都在原位）
  ✓ D5 现库仍可读且数据未变
  ✓ E1 现库不可 checkpoint 时返回 failed
  ✗ E2 现库文件仍存在（未被删除） → {"exists":false}
  ✗ E3 现库字节内容逐字未变（sha256 与写入前相同） → {"before":"f302957da5220938a7e3e51a8718c79b9e00dc13ab2119e8cfc978f041720382","after":null}
  ✓ E4 保留标记（失败不清标记，供人工诊断/重试）

结果：22 通过 / 2 失败
exit code 1
```

**独立 `ls` 复核（同一工作区，证明不是断言写错而是文件真没了）：**

```text
$ ls -la E:/AiData/task050-restore-check-1793403470610/data/
  -rw-r--r-- 1 Admin 197609   125 .restore-pending.json
  drwxr-xr-x 1 Admin 197609     0 backups
  -rw-r--r-- 1 Admin 197609 28672 pre-restore-20261031-073756-605.db
  ...
$ test -f app.db && echo EXISTS || echo GONE
app.db GONE  <-- 现库被回滚分支删除
```

⇒ **缺陷真实存在且已被本机实测捕获，未被 safe-delete 护栏掩盖**（派单预判的「两次都绿」未发生）。

**第二步 —— 修复后跑绿：**

```text
$ pnpm --filter server restore-check
  ✓ E1 现库不可 checkpoint 时返回 failed
  ✓ E2 现库文件仍存在（未被删除）
  ✓ E3 现库字节内容逐字未变（sha256 与写入前相同）
  ✓ E4 保留标记（失败不清标记，供人工诊断/重试）

结果：24 通过 / 0 失败
exit code 0
```

**独立 `sha256sum` 复核（同一工作区）：**

```text
$ sha256sum E:/AiData/task050-restore-check-1793403591226/data/app.db
f302957da5220938a7e3e51a8718c79b9e00dc13ab2119e8cfc978f041720382 *app.db
$ python -c "import hashlib; print(hashlib.sha256(b'\x5a'*4096).hexdigest())"
f302957da5220938a7e3e51a8718c79b9e00dc13ab2119e8cfc978f041720382   # 与写入前逐字相同
```

---

### B-2（阻断）回退副本落盘位置与文档不一致 —— ✅ 已改代码（未开 PR 评论，理由见下）

**为什么没有按派单的可选分支先开 PR 评论**：派单给的两条路是「改代码」或「先评论说明理由等答复」。
执行位**认同主控位已定的「改代码」方向**（备份类制品应集中在同一目录；runbook 的清理命令与 §5 的
异地 rsync 都以 `backups/` 为基准），因此不存在「认为应改文档」的分歧，无需占用一轮评论往返。

**改动**：

- `server/src/db/restore.ts` 抽 `resolveBackupDir(dbPath)`（`process.env.BACKUP_DIR?.trim() ||
  join(dirname(dbPath), 'backups')`），`resolveBackupFile` 改为复用它；`preRestorePath` 落该目录，
  `mkdirSync(dir, { recursive: true })` 幂等保证目录存在。
- `restore-apply-check.ts` 的 **B5 断言改指备份目录**，断言名里写明目录口径；A2 / D4 的零副作用
  快照从「只快照 `DB_DIR`」扩为「数据库目录 + 备份目录」—— 否则覆盖不到对备份目录的写入。

**实测**：`24 通过 / 0 失败`；B5 输出

```text
  ✓ B5 pre-restore-*.db 已生成于备份目录（E:\AiData\task050-restore-check-1793403760420\data\backups）且内容为恢复前的现库
```

**独立 `ls` 复核（同一工作区）**：

```text
$ ls data/                 → app.db  backups            # 无 pre-restore-*
$ ls data/backups/         → imp-…db  imp-…db  pre-restore-20261031-074246-140.db(.db-wal/.db-shm)
```

⇒ 与三处文档口径（`overview.md` §12.8、`backup-restore.md` §3.1/§3.4、TASK Known Issues 第 4 条）
**现已一致**，§3.4 的 `rm -f data/backups/pre-restore-*.db` 与 §5 的 rsync 均能覆盖回退副本。

---

### M-1（必须修）前端环境提示条件反转 —— ✅ 已修 + 单测锁死 + 已验证用例有牙

**改动**：`backups-table.tsx` 的 `restoreAutoExit === true` → `=== false`，文案保持
（`RESTORE_AUTO_EXIT=false` 与该分支此时才自洽）。三处文档本就是正确语义，未改。

**新增单测**（`backups-table.test.tsx`）：`shows the no-auto-restart hint only when restoreAutoExit is false`
—— `true` 时断言提示**不**出现，`false` 时出现。

**该用例有效性的反向验证**（临时把条件改回 `=== true`）：

```text
 FAIL  … > shows the no-auto-restart hint only when restoreAutoExit is false
AssertionError: expected '数据库通过 VACUUM INTO 在线一致性备份…' not to contain '本环境恢复后不会自动重启'
 Tests  1 failed | 8 passed (9)
```

改回 `=== false` 后恢复 9/9 ⇒ **用例对条件反转确有感知，不是摆设**。

**关于派单措辞缺陷 R-1**：TASK.md Requirement 10 已由主控位更正为 `=== false` 并留注记，
执行位未静默改词；代码按更正后语义落地。

---

### M-2（建议，文档一行）取消待恢复任务 —— ✅ 已补

`docs/operations/backup-restore.md` §3.1 步骤 4 之后新增一段：**取消待恢复任务** —— 删除
`<数据库所在目录>/.restore-pending.json` 即可，**无需重启服务**（标记只在进程启动时被读取，
运行中的服务不理会它）。并说明目标文件缺失时每次启动会写一条 `error` 级 `restore` 日志，
按本条清掉标记即可消除噪声。按派单要求**只做文档，未新增取消端点**。

---

### M-3（建议）损坏标记静默忽略 —— ✅ 已留痕 + 探针实测

**改动**：`restore.ts` `readRestoreMarker` 的两条不可解析分支（JSON 解析失败、`filename`
缺失/不合法）都补 `console.error`，输出标记路径与具体原因，并说明文件**刻意保留**供人工检查。
未改语义（仍返回 `null` = 不执行恢复），未让启动失败。

**探针实测**（`E:/AiData/t050-m3-probe/probe.ts`，已清理；两个场景各跑一次）：

```text
--- 场景 1：JSON 损坏 ---
[restore] 恢复标记无法解析，已忽略本次恢复（文件保留供人工检查）：…\.restore-pending.json → Expected property name or '}' in JSON at position 2 (line 1 column 3)
outcome = null | app.db exists = true
--- 场景 2：filename 不合法 ---
[restore] 恢复标记存在但 filename 缺失或不合法，已忽略本次恢复（文件保留供人工检查）：…\.restore-pending.json
outcome = null | app.db exists = true
```

⇒ 两种场景均留痕、均不执行恢复、现库均未被动到。

---

### L-1（建议）导入同名覆盖 —— ✅ 已补

`routes/backups.ts` 导入路径补 `if (existsSync(finalPath))` → 409 `Conflict` + `error` 级审计，
与 `runBackup()` 的 `existsSync` 保护对齐。毫秒级时间戳理论上可碰撞，没有这道检查时 `rename`
会静默覆盖前一份。

> 注：409 分支**未**在冒烟里构造（需要精确控制到毫秒同名，不可稳定复现）；
> 该分支是一条 4 行的存在性检查 + 返回，已在代码审阅范围内，见下方「未覆盖」。

---

### L-2（建议）目录约束加分隔符 —— ✅ 已对齐

`restore.ts` `resolveBackupFile` 的 `full.startsWith(dir)` → `full.startsWith(dir + sep)`，
与 `services/backup.ts:129` 对齐。

> **如实说明：此项无可观测行为变化。** 白名单正则 + `join` 归一化已保证 `full` 必在 `dir` 之下，
> 路径穿越不可达；该改动纯属纵深防御口径对齐。已登记 TASK Known Issues 第 11 条。

---

## 整改后全量验收（原始输出）

| 项 | 命令 | 结果 |
|----|------|------|
| 回滚护栏 + 数据层取证 | `pnpm --filter server restore-check` | **24 通过 / 0 失败**，退出码 **0**（含 E1~E4；B5 指向备份目录） |
| 冒烟第 19 段 | `SMOKE_BASE_URL=http://127.0.0.1:3002 SMOKE_DB_DIR=E:/AiData pnpm --filter server smoke`（服务端 `RESTORE_AUTO_EXIT=false` + 调度器启用 + mock Telegram/飞书） | **19.1~19.22 全绿**；总计 **176 通过 / 7 失败**，7 项为 TASK-046 遗留基线、**逐字相同** |
| 前端（backups-table） | `pnpm exec vitest run --browser.headless src/features/backups/components/backups-table.test.tsx` | **9 passed (9)** |
| 前端（全量） | `pnpm exec vitest run --browser.headless` | **26 文件 / 335 用例全通过** |
| eslint | 15 个改动/新增文件 | 退出码 **0** |
| prettier | 同批文件 + 4 份文档 | **全部合规** |
| `tsc -b` | — | **0** |
| server typecheck | `pnpm --filter server typecheck` | **0** |
| knip | `pnpm knip` | **零输出**（CI 的 knip 步骤） |
| audit-repo.py | `python scripts/audit-repo.py` | **PASS=9 FAIL=0 WARN=0** |
| `git diff --check` | — | 无空白错误 |
| 工作区 | `git status --short` | 仅 File Scope 内文件（任务档案自身 + 主控位两份交接） |

**冒烟 7 项失败的明细**（与基线逐字相同，全在 TASK-046 遗留的流量阈值段）：
客户 A 穿越 50% / A 停留 60% / A 穿越 80% / A 回落到 30% / A 重置后再穿 50% / B 一次跳 95% /
仪表盘 stats 的 trafficThresholds。

---

## 未覆盖 / 需主控位判断的事项

1. **「现库被占用导致 ② rename 失败」未纳入常驻脚本**：E 段覆盖的是 ① checkpoint 失败。
   主控位探针构造的「另持连接占住现库」依赖 Windows 文件锁语义、跨平台不稳定。两者走的是
   **同一条回滚分支**，修复后该分支的删除判据已与「是否已 rename」绑定，故 ② 失败同样不会删现库。
   已登记 TASK Known Issues 第 10 条。**是否值得为 ② 单独造一个跨平台稳定的场景，请主控位定。**
2. **L-1 的 409 分支未在冒烟构造**（需精确控制到毫秒同名，不可稳定复现）。
3. **L-2 无可观测行为变化**（纯纵深防御对齐），已如实登记，未包装成「已验证」。
4. **`server/scripts/*.ts` 仍不在 typecheck 门禁内**（`server/tsconfig.json` `include: ["src"]`），
   按派单要求**未夹带修改**；已手工以相同编译器选项对两个脚本各跑一次 `tsc --noEmit`，零错误。

---

## 与首轮交付的差异汇总

| 维度 | 首轮 | 整改后 |
|------|------|--------|
| `restore-check` | 20 通过 / 0 失败 | **24 通过 / 0 失败**（+E1~E4；B5 改指备份目录；A2/D4 快照扩为两目录） |
| 前端单测 | 26 文件 / 334 用例 | **26 文件 / 335 用例**（+1 例锁死提示条件） |
| 冒烟 | 176 / 7 | **176 / 7**（第 19 段编号与内容**未改**） |
| 回退副本位置 | `data/pre-restore-*.db` | `data/backups/pre-restore-*.db`（与文档一致） |
| 回滚分支删除判据 | `existsSync(dbPath)`（会删唯一现库） | `liveRenamed && existsSync(dbPath)` |
| 导入同名冲突 | 无保护（rename 静默覆盖） | 409 + error 审计 |
| 标记不可解析 | 静默返回 null | `console.error` 留痕 + 保留文件 |
| 文档 | §3.1 无取消方法 | §3.1 补「取消待恢复任务」一行 |

---

## 提交清单（本次整改，6 个提交）

```
900f601 fix(restore): 回滚分支改以「原库是否已改名」判定，修复会删掉唯一现库的缺陷
557ac8b fix(restore): 回退副本改落备份目录，与三处文档口径一致
cce657d fix(backups): 环境提示条件由 === true 改为 === false，与 restoreAutoExit 语义一致
1b5013a fix(restore): 标记无法解析时留痕，并在 runbook 补充取消待恢复任务的方法
234d742 harden(backup): 导入补同名冲突保护，目录约束对齐 dir + sep
```

顺序严格按派单的 B-1 → B-2 → M-1 → M-2 → M-3 → L-1 → L-2（M-2 与 M-3 合为一个提交，
L-1 与 L-2 合为一个提交，均属同类收尾）。

---

## Next Action

**主控位（接收方）**：

1. 逐条核对上表 7 项的闭环证据，**特别是 B-1 的红/绿两步**（这是证明缺陷真实存在且已修的
   唯一硬证据，不得跳过）。
2. 独立复跑：`pnpm --filter server restore-check`（期望 24/0）、
   `pnpm exec vitest run --browser.headless`（期望 26 文件 / 335 用例）、
   `pnpm exec tsc -b`、`pnpm --filter server typecheck`、`pnpm knip`、
   `python scripts/audit-repo.py`（期望 PASS=9）。
3. 冒烟需自建快照库（**不要**用 `server/data/app.db`），判据是**失败集与基线逐字相同**（7 项），
   不是全绿。
4. 复核上方「未覆盖 / 需主控位判断的事项」4 条，尤其第 1 条（② rename 失败场景）。
5. 复审通过后转 **I2 独立审查**（不携带实现上下文的新实例，记录另名
   `handoffs/YYYY-MM-DD-review.md`）与人类授权。

**执行位已停下**：未合并、未打 tag、未自行判定 PASS、未夹带 `docker-compose.yml`
或跨任务基础设施改动。

---

## References

- 整改派单：`handoffs/HANDOFF-003-coordinator-to-implementer.md`
- 主控位审查记录：`handoffs/2026-10-31-coordinator-review.md`
- 任务档案：`tasks/review/TASK-050-backup-import-and-restore/TASK.md`（唯一事实来源）
- 首轮交付：`handoffs/HANDOFF-002-implementer-to-reviewer.md`
- 红/绿原始输出（未入库）：`E:/AiData/t050-b1-red.log`、`E:/AiData/t050-b1-green.log`
