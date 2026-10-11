# 备份与恢复 Runbook（TASK-015）

## 1. 机制概览

| 项 | 值 |
|----|----|
| 备份方式 | `VACUUM INTO` 在线一致性快照（不阻塞读写；持写锁毫秒~百毫秒） |
| 备份内容 | 仅 SQLite 数据库（`app.db` 单文件即全量） |
| 默认位置 | `<数据库所在目录>/backups/`；docker 下为卷内 `/app/data/backups`（env `BACKUP_DIR` 可覆盖） |
| 自动备份 | 每日 03:00（env `BACKUP_CRON`，5 段 cron；容器时区 `TZ`） |
| 保留策略 | 默认 7 份，超出删最旧（env `BACKUP_KEEP`） |
| 文件名 | `app-YYYYMMDD-HHmmss-sss.db` |
| 审计 | 所有备份/删除操作写 `logs`（module=`backup`），管理页「系统备份」可见 |

备份任务随服务内置调度器注册（`ENABLE_SCHEDULER=false` 时连每日备份一并关闭，
此时请用外部 cron 调 `POST /api/backups` 或改用宿主机方案，见 §5）。

## 2. 日常操作（前端管理页）

登录后进入侧边栏「系统 → 系统备份」：

- **立即备份**：点击即执行一次 VACUUM INTO 并刷新列表（写入 `logs`）。
- **下载**：行内下载按钮保存 `.db` 文件到本地。
- **删除**：行内删除按钮 → 确认对话框二次确认后删除。
- 页面顶部展示保留策略（保留份数 + 每日 cron）。

API 等价操作（需 Bearer token）：

```bash
# 立即备份
curl -X POST http://localhost:3000/api/backups -H "Authorization: Bearer $TOKEN"
# 列表
curl http://localhost:3000/api/backups -H "Authorization: Bearer $TOKEN"
# 下载
curl -O http://localhost:3000/api/backups/app-20261011-030000-123.db/download \
  -H "Authorization: Bearer $TOKEN"
# 删除
curl -X DELETE http://localhost:3000/api/backups/app-20261011-030000-123.db \
  -H "Authorization: Bearer $TOKEN"
```

## 3. 恢复步骤（应用内不做一键恢复，按本流程手工执行）

> ⚠️ 恢复会用备份**覆盖当前数据库**，恢复点之后的数据将丢失。执行前先在管理页
> 做一次「立即备份」留存现状，并确认目标备份文件可信。

### 3.1 直接运行（非 docker）

```bash
# 1) 停止服务（避免恢复过程中仍有写入）
#    前台 Ctrl-C；或 pm2/systemd 停止对应进程

# 2) 备份现状（防恢复失败可回退）
cp data/app.db data/app.db.broken-$(date +%Y%m%d-%H%M%S)

# 3) 替换数据库，并删除 WAL/SHM（旧 WAL 与新主库不匹配会损坏或回滚数据！）
cp data/backups/app-20261011-030000-123.db data/app.db
rm -f data/app.db-wal data/app.db-shm

# 4) 重启服务并验证
#    访问 /api/health 确认 ok；抽查客户/订阅数量是否符合恢复点预期
```

### 3.2 docker compose

```bash
docker compose stop
cp data/app.db data/app.db.broken-$(date +%Y%m%d-%H%M%S)
cp data/backups/app-20261011-030000-123.db data/app.db
rm -f data/app.db-wal data/app.db-shm
docker compose start
```

## 4. 验证备份有效性（建议定期演练）

```bash
# 完整性检查（应输出 ok）
node -e "const D=require('better-sqlite3');const d=new D('data/backups/app-20261011-030000-123.db',{readonly:true});console.log(d.pragma('integrity_check'));d.close()"

# 抽查行数（与恢复点预期对比）
node -e "const D=require('better-sqlite3');const d=new D('data/backups/app-20261011-030000-123.db',{readonly:true});console.log('customers:',d.prepare('select count(*) c from customers').get().c);d.close()"
```

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
