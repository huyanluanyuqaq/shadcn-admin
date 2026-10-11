# HANDOFF-001 — developer → next

- **日期：** 2026-10-11
- **任务：** TASK-010 通知功能（事件目录 + Webhook 派发 + 站内通知，参照 sublinkPro）
- **提交范围：** 分支 `feature/TASK-010-notifications`（已合并入 `main`，见 TASK.md Changed Files）

## 验证结果（补登时真实执行）

| 门禁 | 命令 | 结果 |
|------|------|------|
| 测试 | `pnpm test` | 127 / 127 通过（含新增 9 例 schema 单测） |
| lint | `pnpm lint` | 0 错误 |
| 格式 | `pnpm format:check` | 全部合规 |
| 类型 | `pnpm exec tsc -b` / `pnpm typecheck:server` | 均退出码 0 |
| 构建 | `pnpm build` | 通过 |
| 冒烟 | `pnpm --filter server smoke` | 77 / 77（含新增第 14 段 14 项） |
| 端到端 | mock webhook 收包 + 三路触发 | 三类事件均收到，模板变量渲染正确 |

## 假设与决策

1. **站内通知复用 `reminders` 表而非新开表**：已读/未读、客户关联、时间筛选
   状态机完全重合；`type` 列区分事件 key 与旧 `expire`/`traffic`，
   `reminderTypeLabel` 做兼容映射。替代方案（新 `notifications` 表）被否，
   理由见 TASK.md Notes。
2. **SSE 实时广播未复刻**：sublinkPro 用 SSE 推送，本项目改 reminders 表 +
   30s 轮询（`useUnreadCountQuery`）。单管理员场景轮询成本可忽略。
3. **Telegram 渠道不实现**：目录 `channels` 保留扩展位；通用 Webhook 可覆盖
   Telegram Bot API 的 sendMessage URL 形态，用户自行配置即可，无代码缺口。
4. **触发点防刷屏**：`sync_succeeded` 仅在 C8 增量对比 changed 时触发；
   提醒 scan 仅在 insert 真正生成新提醒时触发（insert 改返 boolean）。

## 风险

- **`.gitignore` 修复的连带影响**：`logs` → `/logs` 后补提交了 TASK-004
  遗留的 6 个文件（`src/features/logs/`、`src/routes/_authenticated/logs/`）。
  这是对既有仓库缺陷的修复，但意味着本次 diff 包含一批「看似无关」的新文件——
  已在 TASK.md Known Issues #1 与提交信息中说明，勿误回滚。
- CI 五步未经 GitHub Actions 实跑验证（推送需人类批准，尚未执行）。
- webhook 派发为 fire-and-forget，失败仅入 logs（module=`notification`）；
  若用户反馈「没收到通知」，排查路径：logs 表筛选 notification 模块 →
  核对 webhook enabled 与 eventKeys → 用测试发送按钮隔离。

## Next Action

1. 经人类批准后推送 `main`（含本任务全部提交）。
2. 观察 GitHub Actions `Continuous Integration` 是否全绿。
3. `tasks/backlog/` 为空；如需继续，直接从 TASK-011 起。
4. 可选增强（未列入本任务）：通知的「每事件独立开关」持久化、更多内置渠道模板
   （PushDeer/Bark/钉钉/方糖的一键填充）。
