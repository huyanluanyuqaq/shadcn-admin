# 2026-10-31 主控位审查记录 — TASK-050

> **性质声明：** 本记录是**主控位复审**（审查实例即派单实例），按 `.agents/protocols/handoff.md`
> §3.2 的两级命名分区，**不构成** I2 独立审查。I2 须由**不携带实现上下文的新实例**执行，
> 记录另名 `handoffs/YYYY-MM-DD-review.md`。本文件与派单实例同源，故只作主控位把关，
> 整改通过后仍须走 I2 + 人类授权。

---

## Meta

```yaml
Task: TASK-050 — 备份导入与备份恢复
审查对象: PR #25 / head ba8537e / 分支 feat/TASK-050-backup-import-and-restore
档案: tasks/review/TASK-050-backup-import-and-restore/TASK.md
审查人: 主控位 Coordinator（本会话）
日期: 2026-10-31
结论: CHANGES_REQUESTED（2 阻断 + 1 必须修 + 3 建议 + 4 记录项；文档与门禁质量高）
```

---

## 一、已独立核实的事项（方法 → 结果）

| # | 交付方声称 | 核实方法 | 结果 |
|---|-----------|---------|------|
| 1 | 循环依赖两条禁令已遵守 | 读 `db/index.ts` / `db/restore.ts` / `services/backup-inspect.ts` / `backup-naming.ts` 的 import 头 | ✅ `db/index.ts` 只 import `./restore.js`；`db/restore.ts` 只 import `backup-inspect` + `backup-naming` + `node:*` + better-sqlite3；两个新模块均零 `db` 依赖，无环 |
| 2 | 恢复在 `new Database` **之前**应用 | 读 `db/index.ts:38-40`（`applyPendingRestore` 在 `:38`，`new Database` 在 `:40`） | ✅ 顺序正确 |
| 3 | 导入校验链四层齐全 | 读 `routes/backups.ts:81-183` + `services/backup-inspect.ts` | ✅ 上限/魔数/`integrity_check`/五表四层俱在；`.part` → 校验 → `rename` 原子入列；catch 内 `unlink` 清理 |
| 4 | 白名单扩展为 `(app\|imp)` 且 `pre-restore-*` 免于保留策略 | 读 `backup-naming.ts:12,21` + `backup.ts:47,67` | ✅ 保留策略只遍历 `isBackupFilename()` 命中项，`pre-restore-*` 天然不被删 |
| 5 | 下载补 `no-store` + 审计；保留删除失败写 error 日志 | 读 `routes/backups.ts:186-200`、`backup.ts:71-82` | ✅ 三处均在位 |
| 6 | 前端上传走原生 fetch（不破坏二进制） | 读 `queries.ts:95-117` | ✅ `octet-stream` + 原生 fetch，未误用 `api.post`（后者恒设 JSON 头，`src/lib/api.ts:55`） |
| 7 | 前端单测 8 例（既有 5 例未改） | 读 diff | ✅ 既有 5 例仅 `sampleItems` 的 `policy` 补字段，断言未改；新增 3 例 |
| 8 | 冒烟 176/7，失败集与基线逐字相同 | 读 `smoke.ts` 第 19 段（22 项）+ TASK 记录的对照方法（用 `main` 原版脚本打同一服务端得 154/7） | ✅ 方法正确且比「只看分支结果」更强；19.1 前置断言 `restoreAutoExit === false` 的设计正确（否则恢复会杀掉冒烟服务端自身） |
| 9 | CI 双绿 | `gh pr checks 25` | ✅ `audit` / `install-lint-build` 均 pass（run `41104168141`，head `ba8537e`）；`41101392360` 为上一 head `6b5b418` 的绿 run，记录与事实一致 |
| 10 | D13-C 回写九要素为实测值 | `gh` 交叉核对 #22 `9429b23` / #23 `d229ce1` / #24 `dbb3698` 与 `merged_at`、提交数 | ✅ 逐项相符；TASK-047 的「审查记录」行如实写「无合并前独立审查档（A3 断档）」且说明主控位记录不构成 I2 —— **未伪造，符合 D13-C 与 HD-1 精神** |
| 11 | 失效否定性断言已清除 | 读 `overview.md` §12.8 / `backup-restore.md` §3 的改写 | ✅ 两处「不做应用内一键恢复」已改写为实际形态并保留「为何重启式」的理由；TASK-015 历史档案未改动并已显式标注（Known Issues 第 8 条），处置正确 |
| 12 | File Scope 越界已登记 | 读 TASK.md File Scope | ✅ 新增的 `backup-inspect.ts` 已补入并标注「执行位补」，符合「先更新字段并说明理由」 |
| 13 | 工作区清洁、无越界文件 | `git status --short` | ✅ 空 |

---

## 二、阻断项

### B-1（阻断，P0）恢复失败的回滚分支会删掉**唯一的现库文件**

`server/src/db/restore.ts:151-157`：

```ts
} catch (err) {
  try {
    if (existsSync(dbPath)) rmSync(dbPath, { force: true })   // ← 无条件删除
    if (currentRenamed && existsSync(preRestorePath)) renameSync(preRestorePath, dbPath)
```

`currentRenamed` 只在 ② `renameSync` **成功之后**才为 `true`。因此当失败发生在 ①（`checkpointAndClose`
抛错，例如现库损坏 / 被占用 / 磁盘错误）或 ②（`renameSync` 本身失败）时：

- `dbPath` 仍然是**原始现库**（未被改名走）；
- catch 却无条件 `rmSync(dbPath)` ⇒ **删除运维唯一的数据库文件**；
- 且 `currentRenamed === false` ⇒ 不会从 `pre-restore` 移回 ⇒ 现库永久消失。

**实测取证（探针已移出仓库，留存于 `E:/AiData/t050-probe-rollback.ts`）：**

构造现库 + 备份 + 标记，并**另持一个连接占住现库**，使 ② 的 `renameSync` 在 Windows 上失败：

```text
outcome      = {"status":"failed", ... "error":"恢复失败且回滚未完成：EBUSY: resource busy or locked,
               rename 'E:\\AiData\\t050-probe\\data\\app.db' -> '...pre-restore-...db'；
               回滚错误：[safe-delete] 操作失败: ... app.db ..."}
app.db 存在  = true
customers    = 20
```

结论：**回滚分支确实对现库 `app.db` 发起了删除动作**（该动作被本机环境的 safe-delete 护栏拦下，
文件侥幸留存）。在容器 / Linux 上 `rmSync(dbPath, { force: true })` 会正常成功 ⇒ 现库被删除，
下一次启动建空库，**全量业务数据丢失**（仅剩 `backups/` 里的历史快照可救）。

危害等级：恢复是「本来就在处理故障」的场景，此缺陷恰在故障时把「可恢复」变成「不可恢复」。
且现有 `restore-apply-check.ts` 的 D 场景走的是「备份文件不可用」，在**动任何文件之前**就返回，
**完全没有覆盖这条回滚分支** —— 缺陷无回归保护。

**修复方向（最小改动）：** 用「原库是否已被改名」而不是「`dbPath` 是否存在」来判定 `dbPath` 的身份：

```ts
let liveRenamed = false
// ② 之后：liveRenamed = true
...
} catch (err) {
  try {
    // 只有原库已改名时，app.db 才是本次尝试复制出来的半成品，才允许删除
    if (liveRenamed && existsSync(dbPath)) rmSync(dbPath, { force: true })
    if (liveRenamed && existsSync(preRestorePath)) renameSync(preRestorePath, dbPath)
  } catch (rollbackErr) { ... }
}
```

并补脚本用例 **E**：把现库写成非 SQLite 内容（`new Database` 必抛）→ 断言 `status === 'failed'`、
`app.db` **仍存在**、且**字节内容未变**。该用例在 Linux/Windows 均确定成立，可作为回归护栏。

### B-2（阻断）`pre-restore-*` 回退副本的**实际落盘位置**与三处文档不一致，文档给出的清理命令因此失效

- 代码：`restore.ts:117-119` —— `const dbDir = dirname(dbPath)`；`preRestorePath = join(dbDir, preRestoreName)`
  ⇒ 回退副本落在**数据库同目录**（`data/pre-restore-*.db`）。
- 文档三处均写 `backups/`：
  - `docs/architecture/overview.md` §12.8：「rename 现库为 `backups/pre-restore-<ts>.db`」；
  - `docs/operations/backup-restore.md` §3.1 步骤 4、§3.4：「留在 `backups/pre-restore-<ts>.db`」「`rm -f data/backups/pre-restore-*.db`」；
  - TASK-050 `Known Issues` 第 4 条：「长期使用会在 `backups/` 累积」。
- 实际后果三条，均落在运维侧：
  1. §3.4 的清理命令**删不到任何文件**（路径不存在），回退副本无界累积在 `data/` 里；
  2. §5 建议的 `rsync .../data/backups/` **不会**把回退副本同步到异地 —— 而它正是「恢复失败想回退」时唯一的救命文件；
  3. 「不出现在列表、不被保留策略删除」的理由在 `data/` 下依然成立，所以**没有任何机制会暴露它**。

`restore-apply-check.ts:208-210` 的 B5 断言用的是 `join(DB_DIR, preRestoreName)`，与代码一致、与文档不一致
⇒ 该脚本**不能**发现此不一致（它验证的是代码自身的口径）。

**修复方向：** 统一到文档口径（`backupDir()`），而不是改文档。理由：备份类制品应集中在同一目录，
且异地同步与清理命令都以此为基准。实现上 `restore.ts` 已有一份 `process.env.BACKUP_DIR` 的推导
（`resolveBackupFile`），抽一个 `resolveBackupDir(dbPath)` 复用即可（`mkdirSync` 幂等）；
同步把 B5 的断言路径改为备份目录。若选择改文档则须在整改交接中说明理由并逐处核对（含 §5 的 rsync 覆盖范围）。

---

## 三、必须修

### M-1 前端环境提示的条件与文案自相矛盾（用户可见的错误信息）

`src/features/backups/components/backups-table.tsx:216-231`：

```tsx
{data?.policy?.restoreAutoExit === true && (   // ← 条件反转
  <AlertTitle>本环境恢复后不会自动重启</AlertTitle>
  ... 当前 <code>RESTORE_AUTO_EXIT=false</code>，恢复只会写入标记文件，需在服务重启后才生效 ...
```

`restoreAutoExit === true` 的含义是「排程后会退出进程以触发重启」，即**会**自动重启；
该分支渲染的却是「不会自动重启」并声称当前值为 `false`，与 `restoreAutoExit === true` 直接冲突。

后果：生产（`true`）环境下每次进入备份页都会被误导为「需手动重启」；而真正需要提示的
`RESTORE_AUTO_EXIT=false` 环境**恰恰不显示**提示，用户点完恢复后干等。

`api-contract.md`（「供前端提示『本环境恢复后不会自动重启』」）、`.env.example`（「false：…管理页会提示需手动重启」）、
`backup-restore.md` §2（「若 `RESTORE_AUTO_EXIT=false`，另显示提示」）三处文档**都已是正确语义**，
只有代码反了 ⇒ 修复方向明确：条件改 `=== false`，文案保持。并补一条单测锁死该条件
（现有三例的 `policy.restoreAutoExit` 均为 `false`，恰好绕过此分支，故未被发现）。

**主控位自我披露 R-1：** 本任务 `TASK.md` Requirement 10 的原文写作
「`policy.restoreAutoExit === true` 时页面顶部提示『本环境恢复后不会自动重启』」—— 该措辞本身就是
自相矛盾的（把「会自动退出」当成了「不会自动重启」）。执行位按字面实现，属**规格错误**而非执行错误。
Requirement 10 已由主控位更正为 `=== false`，更正事实登记于此，不得静默改词。

---

## 四、建议（不阻断）

| 编号 | 内容 | 位置 |
|------|------|------|
| M-2 | **没有取消待恢复任务的通道**。排程（202）后若反悔、或目标文件被删，标记只能靠改文件系统清除；目标文件缺失时每次启动都会写一条 `error` 日志，形成持续噪声。最低成本：runbook §3.1 增一行「取消待恢复任务：删除 `<db 目录>/.restore-pending.json`」（§3.2 第 4 步已提到清标记，但正向的「取消」没有入口）。若要做端点（`DELETE /api/backups/restore-pending`）须另立任务，本任务不做 | `backup-restore.md` §3.1 |
| M-3 | **标记损坏被静默忽略**：`readRestoreMarker` 的 catch 返回 `null`（`restore.ts:81-84`），注释写「保留文件」，但既不写日志也不报错 ⇒ 用户点了恢复、进程重启后什么都没发生，且无任何痕迹。建议该分支 `console.error` 至少留一行，或在启动日志里提示「发现无法解析的恢复标记」 | `restore.ts:81-84` |
| L-1 | **导入同名覆盖**：`runBackup()` 有 `existsSync(target)` 保护（`backup.ts:96-98`），导入路径没有；同毫秒两次导入会由 `rename` 静默覆盖前一份。单管理员场景概率极低，补一行存在性检查即可对齐 | `routes/backups.ts:145-152` |
| L-2 | `resolveBackupFile` 的目录约束用 `full.startsWith(dir)`（`restore.ts:187`），缺少分隔符比较；白名单正则已使路径穿越不可达，故属纵深防御缺口，可与 `backup.ts:129` 的 `dir + sep` 对齐 | `restore.ts:182-189` |

---

## 五、记录项（不需改代码，仅登记事实）

| 编号 | 内容 |
|------|------|
| N-1 | **Current State 滞后一个提交**：档案写「head `6b5b418`，7 提交」，实测 PR #25 为 8 提交、head `ba8537e`（`ba8537e` 自身即「记录 PR 与 CI 全绿」的提交）。这是 KI-11 型鸡生蛋：记录动作本身产生新 head。整改后回填时请写「以**合并时点 head** 的 run 为准」，不再写死 head 与提交数 |
| N-2 | **AC-8 的「点击导入备份」实际是 `userEvent.upload` 直接作用于隐藏 input**，未验证按钮与 file input 的绑定（该绑定在浏览器里不可测）。可接受，但 AC 措辞与实现手段应一致；已在档案理解范围内，不要求改 |
| N-3 | **`restoreAutoExit` 环境矩阵未覆盖 systemd / pm2**：runbook §3.1 的表格只列 docker / `tsx watch` / 任意 `RESTORE_AUTO_EXIT=false`。`systemd`（`Restart=on-failure`）下 `exit(0)` **不会**重启 ⇒ 恢复挂起。建议补一行，避免非容器部署踩空 |
| N-4 | **`server/scripts/*.ts` 不在 typecheck 门禁内**已由执行位登记（Known Issues 第 6 条），核实属实（`server/tsconfig.json` `include: ["src"]`）；本任务未夹带修改，处理正确 |

---

## 六、结论

**CHANGES_REQUESTED。**

- 设计与架构判断（重启式恢复、双前缀白名单、导入四层校验、零依赖模块拆分）**全部正确**，
  文档改写质量与 D13-C 回写质量**高于**近期任务均值，且主动登记了 3 项「未复现 / 未覆盖」，
  未出现虚报。
- 但 B-1 是**数据销毁级**缺陷，且恰好位于「本来就在救火」的路径上，必须修复并补回归用例；
  B-2 使运维清理与异地同步对回退副本双双失效，同属必须修。
- 整改完成后：重跑 `restore-check`（含新增用例 E）→ 冒烟第 19 段 → 前端单测 → 四道静态门禁 →
  `audit-repo.py`，更新 PR 后**停下**，等 I2 独立审查与人类授权。
- 本记录按 TASK-049 体例**不迁移任务目录**（任务仍留 `tasks/review/`），`Status` 由执行位在
  整改交付时维持 `REVIEW`。
