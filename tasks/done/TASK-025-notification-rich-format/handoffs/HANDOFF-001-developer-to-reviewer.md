# HANDOFF-001 — TASK-025 通知富格式排版

| 字段 | 值 |
|------|----|
| From | developer |
| To | reviewer |
| Task | TASK-025 Telegram / 飞书通知富格式排版 |
| 日期 | 2026-10-13 |

## Current State

Status=DONE。实现、测试、文档全部完成，三件套 + 前端测试 + 隔离冒烟全绿。
待 Reviewer 复核后随合并推送 main（沿用 TASK-023/024 的「docs(task) 归档 +
feat 提交」节奏）。

## Completed Work

1. **新增 `server/src/services/notification-format.ts`**：纯函数富格式排版，
   Telegram 与飞书共用。结构对齐用户参照样例：对象行（`订阅: xxx`）→
   状态摘要行（`✅订阅【xxx】同步完成，耗时 x 秒`）→ `📊 用量信息` 四行
   （⬆️/⬇️/📦/⏳）。字节用 shared `formatTrafficBytes`，时间本地时区
   `YYYY-MM-DD HH:mm:ss`，耗时 <10s 一位小数。关键字段缺失 / data 为空 →
   回落 `payload.message`。
2. **两渠道接入**：`formatTelegramMessage` = EVENT_HEADERS 标题头（emoji +
   HTML 加粗，保持原分事件标题）+ 转义后的富格式正文；`formatFeishuCard`
   正文由 `payload.message` 改为富格式（lark_md），header/note 不变。
   feishu.ts 本地 formatTime 删除，改引用共享模块（去重）。
3. **触发点 data 充实**：subscription-sync（单条 name/upload/download/
   trafficTotal/expireAt/elapsedMs；批量 batch:true + total/succeeded/
   changed/elapsedMs + 用量汇总与最早到期 + 失败明细带订阅名）；
   reminder-scan（name、used/total）；traffic-threshold（name）。
4. **测试**：`notification-format.test.ts` 18 例（全事件分支 + 降级路径，
   时间断言用本地构造 Date，时区无关）；smoke.ts 新增 17.9——重开两渠道
   mock 与 mock 上游，创建订阅 → 真实同步 → 断言 Telegram 正文七要素与
   飞书卡片（header green + lark_md + 同口径正文）。
5. **文档**：架构 overview §12.5/§12.6 消息格式行更新，新增 §12.6.1
   （结构图、字段约定表、降级与转义口径、节点统计不纳入的说明）。

## Changed Files

见 TASK.md「Changed Files」（9 个文件：2 新增 + 6 修改 + 1 文档）。

## Tests

- `pnpm vitest run --browser.headless server/src/services/notification-format.test.ts` → 18/18
- 隔离冒烟（VACUUM 快照 → migrate → PORT=3002 + 双 mock 基址）→ **148 通过 / 0 失败**
- `pnpm typecheck:server` / `pnpm lint` / `pnpm format:check` → 全绿
- `pnpm test`（前端全量，含新单测）→ 19 文件 / 232 例全绿

## Known Issues

- **节点统计缺失**：本项目只拉 `subscription-userinfo` 头，不解析节点列表，
  参照样例中的「总节点/新增/更新/已存在/删除失效」五项**未实现**（数据不存在），
  以「耗时 + 用量信息」替代。若未来要节点统计，需先有节点解析与落库，属独立任务。
- 批量成功通知的用量汇总是「全部成功订阅求和」，与「信息更新条数」口径不同
  （汇总含未变化订阅）——已在文档 §12.6.1 字段约定中注明。
- 老载荷（无 name 的 sync_succeeded data）会回落一句话文案；仅在「先升级
  代码、后触发通知」的窗口期可能出现，无需处理。

## Assumptions

- 富格式只做外部渠道（Telegram/飞书）；in_app 与 webhook 文案保持原状
  （用户原话只提 telegram 和飞书）。
- 批量事件判别用 `data.batch === true` 显式标记，而非字段推断。

## Risks

- webhook 消费者若模板引用 `{{json .}}`，单条同步 data 的 `total` 已更名
  `trafficTotal`（语义更准确，但属字段重命名）——webhook 默认模板只用
  title/message/time，不受影响。

## Next Action

Reviewer 按 AC-1~AC-6 复核（重点：notification-format.ts 的分支完备性与
smoke.ts 17.9 断言强度）；PASS 后按 git.md 提交合并：
`feat(server): Telegram/飞书通知富格式排版（Refs: TASK-025）`，
并将 tasks/active/TASK-025-* 移入 tasks/done/（本 Handoff 随迁）。
