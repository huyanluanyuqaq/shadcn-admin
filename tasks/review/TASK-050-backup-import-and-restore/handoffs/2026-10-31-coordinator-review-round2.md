# TASK-050 主控位复审记录（第二轮）— 整改闭环复核

```yaml
Task: TASK-050 — 备份导入与备份恢复
Round: 2（复审 HANDOFF-004 的 7 项整改）
Reviewer: 主控位 Coordinator（携带首轮审查上下文）
Date: 2026-10-31
Base Reviewed: HEAD 0d275d1（PR #25，base main）
Verdict: PASS —— 2 阻断 + 1 必须修 全部闭环且经独立复现；另记 4 项记录项（已由主控位就地修正 3 项）+ 1 项新代码观察（L-3，不阻断）
```

---

## 一、结论

首轮判定的 **2 个阻断 + 1 个必须修** 已全部闭环，且**不是靠自述取证**：

- B-1 的红灯由我在**未修代码**上独立复现（`git checkout ba8537e -- server/src/db/restore.ts` 后跑脚本 → `E2 exists:false`、`E3 after:null`，`app.db` 真的消失）；
- 绿灯独立复跑 → **24 通过 / 0 失败**；
- M-1 的条件反转已在代码与单测双向锁死，我在 HEAD 上复跑该文件 **9/9 通过**。

**判 PASS。** 剩余问题全部落在「档案记述与实际不符」层面，其中 3 项我已作为记录方就地更正（R-2 自我披露），1 项为不可对齐的取证留痕（N-4），另发现 1 项代码层观察（L-3）已登记 Known Issues 第 13 条、不阻断本任务。

---

## 二、逐项复核（HANDOFF-003 的 7 项）

| 项 | 判据 | 我的核对方式 | 结果 |
|----|------|-------------|------|
| **B-1** 回滚删现库 | 删除判据须绑定「原库是否已改名」 | 读 `restore.ts:145-181`；`liveRenamed` 仅在 `renameSync` 成功后置 true，catch 内两处删除/回移均以 `liveRenamed &&` 为前提；**并在旧代码上独立复现红灯** | ✅ 闭环 |
| **B-2** 回退副本路径 | 落 `<备份目录>` 且与三处文档一致 | 读 `restore.ts:130-135`（`resolveBackupDir` + `mkdirSync`）；实跑现场 `data/backups/pre-restore-*.db` 确实生成、`data/` 下无副本；runbook §3.4 与 §5 的基准同为 `backups/` | ✅ 闭环 |
| **M-1** 提示条件反转 | `=== false` 且单测锁死 | 读 `backups-table.tsx:216`；单测 `true` 分支 `not.toContain(HINT)`、`false` 分支 `toContain(HINT)`，并含 `unmount()` 防止两棵树并存污染断言 | ✅ 闭环 |
| **M-2** 取消待恢复任务 | runbook 一行 | `backup-restore.md` §3.1 有该段，且准确说明「标记只在启动时读取，运行中不理会」——与 `applyPendingRestore` 仅在模块加载期调用的实现一致 | ✅ 闭环 |
| **M-3** 损坏标记静默 | 至少留痕 | 两条不可解析分支（JSON 失败 / filename 非法）均已 `console.error` 且**保留文件**；语义未改（仍返回 null） | ✅ 闭环 |
| **L-1** 导入同名覆盖 | 存在性检查 | `routes/backups.ts` 在 `writeFile(.part)` 之前 `existsSync(finalPath)` → 409 + `error` 审计；位置正确（早于任何写盘） | ✅ 闭环 |
| **L-2** 目录约束分隔符 | `dir + sep` | 已改；执行位如实声明「无可观测行为变化」，未包装成已验证 | ✅ 闭环 |

---

## 三、独立复现（本轮新增，非引用执行位输出）

### 3.1 红灯复现（关键项）

```text
$ git checkout ba8537e -- server/src/db/restore.ts      # 旧判据 currentRenamed
$ cd server && pnpm exec tsx scripts/restore-apply-check.ts
  ✓ E1 现库不可 checkpoint 时返回 failed
  ✗ E2 现库文件仍存在（未被删除） → {"exists":false}
  ✗ E3 现库字节内容逐字未变（sha256 与写入前相同） → {"before":"f302957…20382","after":null}
  ✓ E4 保留标记（失败不清标记，供人工诊断/重试）
结果：21 通过 / 3 失败
```

第三项失败是 B5（旧代码把副本落在 `data/`，与 B2 整改后的断言口径不符），属预期。
现场 `ls` 佐证：`task050-restore-check-1793405461898/data/` 只剩 `.restore-pending.json`、
`backups/` 与 `pre-restore-*.db`，**`app.db` 不在列表里** —— 与 `E2 exists:false` 自洽。
→ 证明该缺陷此前真实存在，且**未被本机 safe-delete 护栏掩盖**（派单预判的「两次都绿」未发生）。

### 3.2 绿灯复跑

```text
$ cd server && pnpm exec tsx scripts/restore-apply-check.ts
  ✓ B5 pre-restore-*.db 已生成于备份目录（…\data\backups）且内容为恢复前的现库
  ✓ E1/E2/E3/E4 全绿
结果：24 通过 / 0 失败
```

`sha256(4096×0x5A)` 我独立复算 = `f302957da5220938a7e3e51a8718c79b9e00dc13ab2119e8cfc978f041720382`，与 E3 断言的期望值一致。

### 3.3 其余门禁

| 项 | 我执行的结果 |
|----|-------------|
| 前端 `backups-table.test.tsx` | **9 passed (9)** |
| `python scripts/audit-repo.py` | **PASS=9 FAIL=0 WARN=0**（F8 含 25 个非豁免档案，F9 50 个编号唯一） |
| `prettier --check`（代码 + 本任务档案） | All matched files use Prettier code style |
| `git status --short` | 空（复核开始前），复现红灯后已 `git checkout HEAD -- ` 还原并复验为空 |
| PR #25 / CI | head `0d275d1`，14 提交 / 45 文件；`install-lint-build` + `audit` 双 pass（run `41147908524`） |

**未独立复跑（如实披露）**：冒烟第 19 段（176/7）与前端全量（335 用例）。
前者需自建快照库 + 带 mock 的服务端（`RESTORE_AUTO_EXIT=false`），后者耗时较长，
本轮的代码增量只在 `restore.ts` / `routes/backups.ts`（4 行存在性检查）/ 一个条件表达式，
且 CI 与目标单测均绿。**这两项以执行位留证 + CI 为准，我没有亲自复现**。

---

## 四、记录项（R / N）

### R-2（主控位自我披露，已就地修正）

我在首轮审查时更正的 Requirement 10 是**直接改在 `TASK.md` 里**的，本轮发现同一份档案的
`Changed Files` 首轮行仍写「`restoreAutoExit === true` 时的环境提示 Alert」——
与整改后的实现相反。这是 M-1 同源失真在档案里的残留，本轮由我直接更正：

- `Changed Files` 首轮行 → 改为 `=== false`，并注明「首轮此处误写为 `=== true`，由整改 M-1 更正」；
- 同表 `restore-apply-check.ts` 的「20 项断言」→「24 项（首轮 20 + 整改 E1~E4）」；
- `Known Issues` 第 12 条内的「20 项断言」→「24 项断言」；
- `Meta.Updated` 由 `2026-10-30T23:59` → `2026-10-31T08:20`（整改后未更新，属档案滞后）。

### N-4（不对齐，不修）

`HANDOFF-004` §B-2 引用的 B5 输出（`task050-restore-check-1793403760420`）**未存档**；
存档的 `E:/AiData/t050-b1-green.log` 是 B-1 修复当时的运行，B5 文案还是旧版
（无「于备份目录」）。不是伪造——两份日志均真实存在、时间戳与改动顺序自洽——
但「存档日志」与「引用输出」不是同一次运行，读者 grep 会对不上。属可接受的留痕瑕疵，
不建议改写执行位的交接正文（改写反而破坏时间线）。

### L-3（新发现，代码层，不阻断）

`db/restore.ts` 的 `resolveBackupDir()` 读 `process.env.BACKUP_DIR`，而 `services/backup.ts`
经 `config.backupDir` 推导 —— 这是首轮 P3-7「调度器双来源」同类问题的第二处。
主服务入口 `index.ts` 先 import `env.js`（内含 `.env` 加载），故**服务进程内两者等价**；
但 `db/migrate.ts` 直接 import `db/index.js`、不经 `env.js`：以 `.env` 配置 `BACKUP_DIR` 时，
该入口解析到的备份目录与服务器不同 ⇒ 待恢复标记因「备份文件不存在」失败（**fail-closed**，
不动文件、标记保留），且该入口不消费 `restoreOutcome`，**失败无任何日志**。
容器内不受影响（OS 级环境变量）。已登记 `Known Issues` 第 13 条，建议后续以
`applyPendingRestore(dbPath, backupDir)` 注入目录的方式收口（`db/index.ts` import `env.js` 不成环）。

### 已复核但不再追的（首轮已登记，本轮确认仍未变）

- 「② rename 失败」场景仍无常驻用例（Known Issues 第 10 条）。修复后删除判据即 `liveRenamed`，
  该分支**结构上**不可能删现库，我认可「不再单独造跨平台场景」的判断。
- 一处窄边界（我新增观察，并入第 10 条判断）：若 `dbPath` **本就不存在**（`liveRenamed` 恒 false）
  且 `copyFileSync` 中途失败，半成品 `app.db` 不会被清理。可达性极低（写标记需服务在跑，
  即库存在），且下次启动会因 `SQLITE_NOTADB` fail-closed，**不构成数据风险**，不要求整改。

---

## 五、下一步

1. 执行位以**单个 docs 提交**收口本轮记录改动（`TASK.md` + 本记录 + `HANDOFF-005`），推送，停下。
2. 转 **I2 独立审查**（不携带实现上下文的新实例），记录另名 `handoffs/YYYY-MM-DD-review.md`。
3. I2 通过 + **人类显式授权** → rebase-merge → 合并后按 D13-C 以**第十二实例**回写 Merge Record。
