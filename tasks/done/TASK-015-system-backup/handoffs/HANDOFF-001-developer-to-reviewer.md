# HANDOFF-001 — TASK-015 系统备份（developer → reviewer）

## 结论

TASK-015 完成。SQLite 在线备份全链路落地：shared 契约 → `services/backup.ts`
（VACUUM INTO 在线一致性快照 + 保留策略 + 文件名白名单双保险）→ 四端点 REST
（鉴权之后）→ 调度器每日 job（03:00）→ 前端「系统备份」管理页。
验证全绿：冒烟 **125/125**（新增第 18 段 7 项检查）、前端单测 **181/181**、
build / server typecheck / lint / format:check 全绿。
分支 `feat/TASK-015-system-backup`，提交待人类批准。

## 接手必读（按序）

1. `tasks/done/TASK-015-system-backup/TASK.md` — 唯一事实来源（含实施记录）
2. `docs/architecture/overview.md` §12.8 — 备份设计决策表
3. `docs/operations/backup-restore.md` — 备份/恢复 runbook（含异地 rsync 建议）
4. `server/src/services/backup.ts` — 备份 service（白名单/保留/路径解析）
5. `server/src/routes/backups.ts` — 四端点

## 关键决策速查

- **VACUUM INTO 而非裸拷贝**：WAL 模式下裸拷贝 app.db 会丢未归档写入
  （ADR-001 / TASK-005 早有文字结论，本任务首次落地为自动化）。
  持写锁但毫秒~百毫秒级，不阻塞读。
- **文件名白名单 + resolve 双保险**：`^app-\d{8}-\d{6}-\d{3}\.db$`（毫秒级防
  同秒碰撞）+ resolve 后必须严格位于备份目录内；冒烟实测
  `..%2F..%2Fapp.db` 与 `not-a-backup.db` 均被拒。
- **保留排序带文件名兜底**：mtime 精度不足（部分文件系统粗粒度）时按文件名
  时间戳 localeCompare 兜底，防误删。
- **备份位置**：默认 `<数据库所在目录>/backups`（docker 即卷内
  `/app/data/backups`，随 `./data` 持久化）；`BACKUP_DIR` 可覆盖但
  .env.example 已警告「指向卷外需自行持久化」。
- **下载走原生 fetch + blob**：api 客户端只解析 JSON，拿不到附件；
  临时 `<a download>` 触发保存（`downloadBackup` in queries.ts）。
- **TASK-014 模式复用**：刷新按钮（isFetching 旋转 + 禁用）、错误态重试动画，
  与全系统其他列表页一致。

## 验证记录

- 冒烟第 18 段 7 项：立即备份 201（文件名正则 + size>0）/ 列表含新文件 + policy /
  下载附件（content-type + content-disposition）/ 路径穿越与白名单外拒绝 /
  不存在删除 404 / 保留策略（默认 keep=7 连做 8 次，恰剩 7、首删末留）/
  段末清理（只删本段创建文件）。隔离实例（PORT=3002，真实库 VACUUM INTO
  快照 + TELEGRAM/FEISHU 指向内嵌 mock）实测 125/125，隔离 backups 目录
  段后为空。
- 用户 3000 实例（tsx watch 已热加载工作树）实测：
  `GET /api/backups` 200 + `policy { keep: 7, cron: "0 3 * * *" }`，
  5173 前端「系统 → 系统备份」页可达。
- 3002 启动日志确认「已注册每日数据库备份任务（0 3 * * *）」（AC-4）。
- 前端单测 backups-table 5 例：渲染 / 立即备份 / 刷新 / 下载 / 删除确认流
  （ConfirmDialog portal，行内按钮用 aria-label「删除备份」区分）。

## 遗留与下一步候选

- **异地容疫靠宿主机**：runbook §5 给出 rsync/rclone 示例；应用内不做远程存储
  （用户明确选仅本地）。
- **恢复为一键工艺**：应用内刻意不做还原按钮（高危），runbook §3 给出
  「停服务 → 替换 app.db → 删 WAL/SHM → 重启」手工步骤。
- `BACKUP_DIR` 未在 docker-compose 透传（保持默认卷内路径最稳）；
  如运维要自定义卷，需同时改 compose volumes。
- 备份失败仅记 logs（module=backup）+ HTTP 500，无告警通道——
  可评估接入通知事件目录（第 6 个事件 `backup.failed`）。
