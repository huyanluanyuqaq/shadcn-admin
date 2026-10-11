# HANDOFF-001 — developer → next

- **日期：** 2026-10-11
- **任务：** TASK-011 Telegram 机器人（Bot 推送 + /start 自动绑定 Chat ID，参照 sublinkPro）
- **提交范围：** 分支 `feature/TASK-011-telegram-bot`（见 TASK.md Changed Files）

## 验证结果（补登时真实执行）

| 门禁 | 命令 | 结果 |
|------|------|------|
| 测试 | `pnpm test` | 137 / 137 通过（含新增 10 例 telegram 表单单测） |
| lint | `pnpm lint` | 0 错误 0 警告 |
| 格式 | `pnpm format:check` | 全部合规 |
| 类型 | `pnpm typecheck:server` / `tsc -b` | 均退出码 0 |
| 构建 | `tsc -b` + `vite build --emptyOutDir false` | 通过 |
| 冒烟（接线） | `TELEGRAM_API_BASE=http://127.0.0.1:3998` 起服务后 `pnpm --filter server smoke` | 92 / 92（含新增第 16 段 14 项） |
| 冒烟（未接线） | 默认 env 起服务后 smoke | 82 / 82，快乐路径按预期跳过 |
| 端到端 | mock Bot API 收包（绑定确认 / 登录派发 / 测试连接） | 三类消息均收到，HTML parse_mode 与分事件标题正确 |

## 假设与决策

1. **刻意收窄为「通知推送 + Chat ID 绑定」**：sublinkPro 的机器人是完整远程
   管理端（stats/monitor/subscriptions + 内联键盘 + 常驻轮询），本项目不做
   交互命令面；长轮询仅在「已启用 + 有 Token + 未绑定 Chat ID」时运行，
   绑定后自停，重启按持久化配置恢复。
2. **parse_mode 用 HTML 而非 sublinkPro 的 Markdown**：用户内容（订阅名 /
   客户名）中的 Markdown 元字符会破坏格式；HTML 只转义 `& < >`，兼容 CJK。
3. **配置存 settings KV（键前缀 `telegram.`）而非新表**：单配置形态
   （一个机器人 + 一个聊天），与 sublinkPro 同思路，无迁移成本。
4. **出网基址可配置**（`TELEGRAM_API_BASE`）：冒烟测试指向内嵌 mock，
   出口受限环境可自建中转；生产默认官方地址。
5. **Chat ID 按字符串处理**：群组 ID 为负数且可能超出 JS 安全整数范围。

## 风险

- **zod refine 后 schema 的 `.pick()` 运行期缺陷**（已修复，见 TASK.md KI#1）：
  初版 `POST /test` 路由 500，仅启动服务实际请求才能发现。后续涉及
  zodEffects 的再派生一律从基础对象重新构造。
- 冒烟快乐路径依赖「服务端指向 mock」这一外部条件，未接线时自动跳过
  （82/82），不会误报失败；但也意味着**默认跑法覆盖不到派发链路**，
  完整验证需按 TASK.md Verification Plan 显式设置 env。
- 长轮询是进程级单例：若未来出现多 worker / 多副本部署，需要分布式协调
  （当前单容器场景无此问题）。
- CI 五步未经 GitHub Actions 实跑验证（推送需人类批准，尚未执行）。

## Next Action

1. 经人类批准后推送 `main`（含本任务全部提交）。
2. 观察 GitHub Actions `Continuous Integration` 是否全绿。
3. `tasks/backlog/` 为空；如需继续，直接从 TASK-012 起。
4. 可选增强（未列入本任务）：机器人交互命令面（远程管理）、更多事件
   的消息模板定制、按事件维度细化推送开关。
