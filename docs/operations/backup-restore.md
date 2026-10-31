# 备份与恢复 Runbook（TASK-015；TASK-050 增加导入与应用内恢复；TASK-051 目录注入与两级验证）

## 1. 机制概览

| 项 | 值 |
|----|----|
| 备份方式 | `VACUUM INTO` 在线一致性快照（不阻塞读写；持写锁毫秒~百毫秒） |
| 备份内容 | 仅 SQLite 数据库（`app.db` 单文件即全量） |
| 默认位置 | `<数据库所在目录>/backups/`；docker 下为卷内 `/app/data/backups`（env `BACKUP_DIR` 可覆盖） |
| 目录口径 | **单一推导点 + 调用方注入**（TASK-051）：`db/index.ts` 从 `config.backupDir` 推导（已配置则 `resolve()`，否则 `<数据库所在目录>/backups`），再作为入参传给 `db/restore.ts`；`db/restore.ts` **不读**环境变量。服务进程与 `pnpm db:migrate` 入口因此解析到**同一目录** |
| 自动备份 | 每日 03:00（env `BACKUP_CRON`，5 段 cron；容器时区 `TZ`） |
| 保留策略 | 默认 7 份，超出删最旧（env `BACKUP_KEEP`）；删除失败写 `error` 级 `logs` |
| 文件名 | `app-YYYYMMDD-HHmmss-sss.db`（本机生成）/ `imp-YYYYMMDD-HHmmss-sss.db`（外部导入），白名单 `^(app\|imp)-\d{8}-\d{6}-\d{3}\.db$` |
| 导入 | `POST /api/backups/import`（八位字节流 + 四层校验）；落盘名为 `imp-` 前缀，上传方原名仅入审计 |
| 恢复 | `POST /api/backups/:filename/restore` → 202 排程，**重启后应用**；env `RESTORE_AUTO_EXIT`（默认 true）控制排程后是否自动退出进程 |
| 审计 | 备份/导入/恢复/下载/删除均写 `logs`（module=`backup`；恢复另用 module=`restore`），管理页「系统备份」可见 |

备份任务随服务内置调度器注册（`ENABLE_SCHEDULER=false` 时连每日备份一并关闭，
此时请用外部 cron 调 `POST /api/backups` 或改用宿主机方案，见 §5）。

## 2. 日常操作（前端管理页）

登录后进入侧边栏「系统 → 系统备份」：

- **立即备份**：点击即执行一次 VACUUM INTO 并刷新列表（写入 `logs`）。
- **导入备份**：顶部按钮选择 `.db` 文件上传入列（前端先挡 > 64 MiB；服务端另做
  四层校验）。文件名旁带「导入」标识的即为外部导入的备份。
- **恢复**：行内恢复按钮 → 确认对话框（明示覆盖当前数据库、服务重启、
  恢复点之后数据丢失）→ 202 后排程生效。原数据库留作 `pre-restore-*` 回退副本。
- **下载**：行内下载按钮保存 `.db` 文件到本地（响应带 `Cache-Control: no-store`）。
- **删除**：行内删除按钮 → 确认对话框二次确认后删除。
- 页面顶部展示保留策略（保留份数 + 每日 cron）；若 `RESTORE_AUTO_EXIT=false`，
  另显示「本环境恢复后不会自动重启，需手动重启服务」提示。

API 等价操作（需 Bearer token）：

```bash
# 立即备份
curl -X POST http://localhost:3000/api/backups -H "Authorization: Bearer $TOKEN"
# 列表
curl http://localhost:3000/api/backups -H "Authorization: Bearer $TOKEN"
# 导入（原始字节流；X-Backup-Filename 仅用于审计，不参与落盘命名）
curl -X POST http://localhost:3000/api/backups/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  -H "X-Backup-Filename: offsite-copy.db" \
  --data-binary @offsite-copy.db
# 下载
curl -O http://localhost:3000/api/backups/app-20261011-030000-123.db/download \
  -H "Authorization: Bearer $TOKEN"
# 恢复排程（confirm 必须与路径参数逐字相等）
curl -X POST http://localhost:3000/api/backups/app-20261011-030000-123.db/restore \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"confirm":"app-20261011-030000-123.db"}'
# 删除
curl -X DELETE http://localhost:3000/api/backups/app-20261011-030000-123.db \
  -H "Authorization: Bearer $TOKEN"
```

## 3. 恢复（应用内恢复为推荐路径，手工兜底仍保留）

> ⚠️ 恢复会用备份**覆盖当前数据库**，恢复点之后的数据将丢失。执行前确认目标备份可信。

### 3.1 应用内恢复（推荐）

管理页「系统备份」行内**恢复**按钮 → 确认对话框确认。等价 API 见 §2。

服务端行为：

1. 前置校验：文件名白名单 + 文件存在 + `integrity_check` + 五表校验。
   任一不过返回 4xx 且**不写标记**（不会留下半截恢复）。
2. 写 `<数据库所在目录>/.restore-pending.json`（`filename` / `requestedAt` / `requestedBy`），
   写 `logs`（module=`restore`，level=`warn`），返回 202。
3. 若 `RESTORE_AUTO_EXIT` 不为 `false`（默认），延迟约 1.2s 后 `process.exit(0)` ——
   先让 202 响应与日志落盘。容器 `restart: unless-stopped` 随即拉起进程。
4. **下一次启动时**、在打开数据库连接**之前**，`db/restore.ts` 的
   `applyPendingRestore(dbPath, backupDir)` 完成替换（`backupDir` 由 `db/index.ts`
   从 `config.backupDir` 推导后注入，TASK-051）：现库 `wal_checkpoint(TRUNCATE)` → rename 现库为
   `backups/pre-restore-<ts>.db` → copy 备份为 `app.db`（**保留备份原件**）→
   删 `app.db-wal` / `app.db-shm` → 删标记。结果写 `logs`（applied → `warn`，
   failed → `error`）。任一步失败则回滚已做的 rename、**保留标记**、返回 failed。

**取消待恢复任务**：排程（202）后若反悔，删除 `<数据库所在目录>/.restore-pending.json`
即可，**无需重启服务**——该标记只在进程启动时被读取，运行中的服务不会理会它。
（本任务不提供取消端点；目标文件缺失时每次启动会写一条 `error` 级 `restore` 日志，
按本条清掉标记即可消除噪声。）

**为什么是「标记 + 重启后应用」而不是热替换**：数据库连接在模块加载期建立，
drizzle 实例与 `services/logger.ts` 等全部绑定该单例，运行期 close 再 open 无法安全
替换引用。重启式还顺带保证「必须删 `-wal`/`-shm`」这条硬性要求（旧 WAL 与新主库
不匹配会损坏或回滚数据）。

**环境差异（重要）**：

| 部署形态 | 排程后是否自动应用 |
|----------|------------------|
| docker compose（`restart: unless-stopped`） | ✅ 进程退出即自启并应用 |
| 本地 `pnpm dev:server`（`tsx watch`） | ❌ `tsx watch` 不因 `exit(0)` 重启，需手动重启 |
| 任意环境设 `RESTORE_AUTO_EXIT=false` | ❌ 只写标记不退出，需手动重启（管理页会提示） |

### 3.2 手工兜底（无宿主机 shell 之外的场景，或恢复标记反复失败时）

```bash
# 1) 停止服务（避免恢复过程中仍有写入）
#    前台 Ctrl-C；或 pm2/systemd 停止对应进程；docker 用 docker compose stop

# 2) 备份现状（防恢复失败可回退）
cp data/app.db data/app.db.broken-$(date +%Y%m%d-%H%M%S)

# 3) 替换数据库，并删除 WAL/SHM（旧 WAL 与新主库不匹配会损坏或回滚数据！）
cp data/backups/app-20261011-030000-123.db data/app.db
rm -f data/app.db-wal data/app.db-shm

# 4) 若曾用过应用内恢复，先清掉残留标记，否则本次替换会在下次启动时被再次覆盖
rm -f data/.restore-pending.json

# 5) 重启服务并验证
#    访问 /api/health 确认 ok；抽查客户/订阅数量是否符合恢复点预期
```

### 3.3 导入一份异地备份

灾后从异地取回 `.db` 文件后，**不要**直接手工 cp 进 `backups/` 再手工替换 ——
走应用内导入，让四层校验先拦掉截断/异库文件：

管理页「导入备份」选择文件，或 §2 的 `curl --data-binary`。导入成功后它即以
`imp-` 前缀出现在列表中，随后按 §3.1 恢复它。

### 3.4 回退副本与清理

- 每次应用内恢复都会把当时的现库留作 `backups/pre-restore-<ts>.db`。
- 该前缀**刻意不进文件名白名单**，因此不出现在管理页列表、也不会被保留策略删除 ——
  否则「恢复失败想回退」时它恰好失效。
- 代价：长期使用会在 `backups/` 累积，需**人工清理**：
  `rm -f data/backups/pre-restore-*.db`（确认无需回退后再删）。

## 4. 验证备份有效性（建议定期演练）

```bash
# 完整性检查（应输出 ok）
node -e "const D=require('better-sqlite3');const d=new D('data/backups/app-20261011-030000-123.db',{readonly:true});console.log(d.pragma('integrity_check'));d.close()"

# 抽查行数（与恢复点预期对比）
node -e "const D=require('better-sqlite3');const d=new D('data/backups/app-20261011-030000-123.db',{readonly:true});console.log('customers:',d.prepare('select count(*) c from customers').get().c);d.close()"

# 启动期恢复逻辑的自动化验证（在临时目录自建场景，不触碰 data/）
pnpm --filter server restore-check
```

### 4.1 启动级端到端：真实服务进程 × 2（TASK-051 新增）

```bash
pnpm --filter server restore-e2e
```

`restore-check` 是**单元级**的（直接调 `applyPendingRestore`）；本脚本补上
「进程启动 → `db/index.ts` 读取标记 → 建连接 → 服务可用」这条真实链路：
**两次真实启动服务进程**（动态端口，`node --import tsx src/index.ts`），走完
「登录 → 建备份 → 记下 `customers` 行数 → 新建一行客户 → 排程恢复（202）→
kill 子进程 → 同 env 重启 → 取证」。

- **数据层取证**（直接读库文件，不只看 HTTP 202）：恢复后 `customers` 行数
  **等于备份时点值**、备份后新增的那一行消失、`.restore-pending.json` 已被
  启动期消费（删除）、`backups/pre-restore-*.db` 已生成；
- **审计取证**：`GET /api/logs?module=restore` 出现 `已应用备份恢复：…` 记录
  （脚本打印原文）。

**判据**：退出码 0，且末行 `结果：21 通过 / 0 失败`。
脚本自建临时库与临时备份目录（`AI_DATA_DIR`，默认 `E:/AiData`），**不触碰**
`server/data/app.db`；结尾打印临时目录供人工复查、**不自动删**；子进程以
`SIGTERM` → 宽限 → `SIGKILL` 回收，并断言端口已释放、进程已消失。
**本脚本未纳入 CI**（纳入需改 `.github/workflows/**`，而当前 `gh` 缺 `workflow`
scope，见 TASK-051 Known Issues 第 1 条）——请以本机手动执行为准。

### 4.2 保留策略「删除失败」留痕（TASK-051 新增）

```bash
pnpm --filter server retention-check
```

保留策略删除失败时写 `error` 级 `logs` 的分支自 TASK-015 起就在位，但复现它需要
同时满足「`unlinkSync` 失败」与「份数超出 `BACKUP_KEEP`」，冒烟脚本的保留策略断言
又依赖 `keep=7` 与同一个服务端进程，故该分支长期**未被实测**。本脚本用**注入的
unlink stub** 稳定命中 catch：造 9 份白名单备份（`keep=7` ⇒ 超额 2），令**第 1 个**
被删文件的 unlink 抛 `EACCES: injected`，其余透传真实删除。

**判据**：退出码 0，且末行 `结果：10 通过 / 0 失败`；输出中须含
① 注入失败的文件名、② `removed` 列表、③ `logs` 中新增 error 行的原文
（形如 `保留策略删除旧备份失败（app-…db）：EACCES: injected`）。
脚本同样只用临时库与临时备份目录，先对临时库跑迁移（否则 `logs` 表不存在、
`writeLog` 失败会掩盖断言）。

## 5. 异地容灾（宿主机层，应用不内置）

本地备份与数据库同盘，磁盘故障会同时丢掉两者。**强烈建议**在宿主机把备份目录
同步到另一台机器或对象存储：

```bash
# /etc/cron.d/backup-offsite（示例：每天 04:30 推送到异地主机）
30 4 * * *  root  rsync -a --delete /opt/subscription-admin/data/backups/ backup@nas:/backups/subscription-admin/

# 或用 rclone 推对象存储（任选其一）
# 30 4 * * *  root  rclone copy /opt/subscription-admin/data/backups remote:sub-admin-backups
```

同步后建议周期性（如每季度）做一次 §4 校验 + §3 恢复演练。
若使用 `BACKUP_DIR` 指向自定义路径，rsync/rclone 的源路径随之调整。

## 6. 故障排查

| 现象 | 排查 |
|------|------|
| 管理页列表为空 | 确认 `BACKUP_DIR`（默认 `<db 目录>/backups`）存在且服务账号可写；看 `logs` module=`backup` |
| 定时备份未执行 | ① `ENABLE_SCHEDULER` 不为 false；② 启动日志有「已注册每日数据库备份任务」；③ 容器 `TZ` 是否符合预期 |
| 立即备份 500 | 磁盘满（`df -h`）或备份目录权限不足；具体原因见 `logs` error 级 backup 记录 |
| 保留份数不生效 | `BACKUP_KEEP` 非正整数时回落默认 7；确认启动环境变量已生效（docker 需在 compose environment 或 .env 传递） |
| 恢复后数据异常 | 确认恢复时删除了 `app.db-wal`/`app.db-shm`；确认替换的是完整 `.db` 文件而非 0 字节残留 |
| 点了恢复但服务没重启 | `RESTORE_AUTO_EXIT=false` 时只写标记不退出（管理页有提示）；本地 `tsx watch` 也不会自启。确认后手动重启，启动日志应出现「已应用备份 …」 |
| 重启后数据没变 | 看 `logs` module=`restore`：若为 `error`，说明 `applyPendingRestore` 校验失败并**保留了标记**，原因在消息里；修掉后重启会重试 |
| 导入返回 400「缺少必需数据表」 | 上传的不是本系统的库（`integrity_check` 只证明页结构完好）。确认文件来源，或用 §4 的命令核对表名 |
| 导入返回 413 | 文件超过 64 MiB 上限；确认没有误传全盘镜像/压缩包 |
| `backups/` 里 `pre-restore-*` 越来越多 | 刻意不被保留策略清理（保回退能力），需人工删除，见 §3.4 |
| 跑了 `pnpm db:migrate` 但恢复没发生 | 自 TASK-051 起该入口也经 `env.ts` 解析 `.env`，`BACKUP_DIR` 口径与服务器一致；若仍失败，看 `logs` module=`restore` 的 `error` 行与 `.restore-pending.json` 是否仍在（标记保留 = 启动期应用失败） |
| 想确认恢复真的生效 | 跑 §4.1 的 `restore-e2e`（两次真实启动 + 数据层取证），不要只看 HTTP 202 |
| 想确认保留策略失败会留痕 | 跑 §4.2 的 `retention-check`（注入失败 + 断言 logs error 行） |
