# HANDOFF-001 — TASK-012 飞书渠道（developer → next）

## 结论

TASK-012 完成。飞书通知渠道全链路落地：shared 契约 → 后端服务（token 缓存 /
交互卡片 / 派发 / 测试连接）→ 路由 → 前端配置页 → 冒烟第 17 段 + 前端单测。
分支已 ff 合并 main 并删除；推送待人类批准。

## 接手必读（按序）

1. `tasks/done/TASK-012-feishu-channel/TASK.md` — 唯一事实来源（含验证记录与已知问题）
2. `docs/architecture/overview.md` §12.6 — 飞书渠道设计决策表
3. `server/src/services/feishu.ts` — service 实现（与 `telegram.ts` 对照阅读）
4. `shared/src/schema/notifications.ts` Feishu 段 — 渠道契约

## 关键决策速查

- **架构同构 TASK-011**：settings KV 单配置（前缀 `feishu.`）/ 四重检查 /
  10s 超时 / 失败仅记日志 / mock 冒烟模式全部复用
- **token 缓存**：模块级单例，7200s 有效期、临期 5min 刷新、失败不落缓存、
  99991668 清缓存重试一次；**测试连接前强制清缓存**（防表单错误凭证假成功）
- **FEISHU_API_BASE 默认值含 `/open-apis`**：service 路径不带前缀（与
  TELEGRAM_API_BASE 语义不同，自建中转/mock 时注意）
- **消息格式**：interactive 卡片，`header.template` 按 severity 着色
  （success→green / error→red / warning→orange / info→blue），lark_md 正文
- **无绑定长轮询、无事件订阅/回调**：与 Telegram 收窄决策一致

## 遗留与下一步候选

- 接收对象手动填写（无群选择器）— 若要做需 im:chat 权限 + 群列表 API
- token 缓存模块级单例 — 水平扩容时需共享缓存（当前单实例无影响）
- 若后续接**更多飞书能力**（如事件订阅 inbound），应先读 §12.6 的边界说明，
  任何入站集成都属于「交互命令面」，需单独立项评估

## 验证状态

- 冒烟：接线 105/105、未接线 88/88
- 单测：vitest 148/148（飞书表单 11 例）
- 门禁：typecheck:server / lint / format:check / tsc -b / vite build 全绿
