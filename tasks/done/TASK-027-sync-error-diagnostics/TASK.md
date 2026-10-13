# TASK-027 — 订阅同步错误诊断增强（HTTP 状态码 / 超时带上下文）

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-027
Title: 订阅同步错误诊断增强（HTTP 状态码 / 超时带上下文）
Workflow: bugfix
Status: DONE
Priority: P1
Owner: workbuddy
Owner Since: 2026-10-13
Assigned Role: developer
Created: 2026-10-13
Updated: 2026-10-13
Branch: fix/TASK-027-sync-error-diagnostics
Requires Human Approval: false
```

---

## Objective

订阅同步失败时，错误消息能自解释到可定位程度：HTTP 状态码错误携带
最终 URL / 方法 / content-type / 响应体片段 / 代理说明；超时错误携带
URL / 方法 / 超时值。对齐 TASK-024 为「缺头」错误建立的诊断标准。

---

## Background

用户报告已部署实例中订阅「良心」同步失败，错误先从
`The operation was aborted due to timeout`（10s AbortSignal.timeout）
变为 `上游返回 HTTP 403`。基于仓库代码的实证分析（探针 + git 历史）：

- 请求形态自初始提交起未变：HTTP/1.1、HEAD 优先 + GET 回退、
  UA 默认 clash.meta（可配）、`accept: */*`、`accept-encoding: gzip, deflate`、
  自定义头透传、redirect follow——**标准请求，无仓库侧畸形**。
- 403 是上游（或其 WAF / 代理）的主动拒绝，仓库代码不构成直接原因。
  典型上游原因：IP 封禁（此前的超时/重试模式可能触发）、UA 过滤、
  TLS 指纹（JA3）过滤、订阅 token 失效、代理拒绝。
- **仓库侧真实缺陷是诊断缺口**：`上游返回 HTTP 403` 不含 URL/方法/代理/
  响应体，用户无法区分上述原因；TASK-024 只为「缺头」错误加了诊断。
  超时消息同样只有一句裸文本。

## Scope

- `server/src/services/subscription-parser.ts`：
  - HTTP 状态码错误：附 `方法 最终URL`、`经代理 <url>`（配了代理时）、
    content-type、响应体片段（GET，折叠空白，截断 200 字符）。
  - 超时错误（AbortSignal.timeout）：附 `方法 URL`、超时值、代理说明，
    原错误挂 cause。
  - 其他网络错误：附方法与 URL 上下文（原错误挂 cause）。
  - 顺带消除 HEAD→GET 回退中两个分支完全相同的 if/else（行为不变）。
- 新增 `server/src/services/subscription-parser.test.ts`（vi.mock undici，
  浏览器模式可跑）。

## Non-Scope

- 不改「缺头」错误消息格式（TASK-024 已定型）。
- 不改超时时长、HEAD 优先策略、dispatcher 缓存逻辑。
- 不做每订阅超时配置（属 feature，后续另立）。

## Acceptance Criteria

- [x] 403 场景错误消息包含：状态码、方法、URL、content-type、响应体片段。
- [x] 配代理时错误消息含 `经代理 <proxyUrl>`（可区分代理拒绝与源站拒绝）。
- [x] 超时场景错误消息包含超时值与 URL，且 cause 为原始 TimeoutError。
- [x] HEAD→GET 回退行为不变（HEAD 403 + GET 200 仍成功）。
- [x] `pnpm test` 全绿；`pnpm lint` / `pnpm format:check` 通过。

## Changed Files

- `server/src/services/subscription-parser.ts`（消费纯构建器；消除回退中
  两个完全相同分支的 if/else，行为不变）
- `server/src/services/subscription-errors.ts`（新增，纯函数、无 undici 依赖）
- `server/src/services/subscription-errors.test.ts`（新增，14 例）
- `server/scripts/smoke.ts`（mock 上游新增 /403 路由 + 诊断断言）
- `tasks/active/TASK-027-*/TASK.md`

## Tests / Verification

- 单测：`subscription-errors.test.ts` 14/14（状态码/超时/网络错误消息要素、
  bodySnippet 截断、proxyNote）。
- 端到端探针（真实 undici + 本地 HTTP 服务器，8 场景）：403 消息含
  `GET <url> + content-type + 响应体`；重定向后 403 显示**最终 URL**；
  超时消息 `请求超时（1000ms，HEAD <url>）`；HEAD 命中/回退/自定义头
  透传均不回归；TASK-024 缺头消息格式不变。
- 全量：`pnpm test` 20 files / 246 tests 全过，exit 0。
- smoke /403 用例随冒烟脚本交付（需起服务实例后运行）。

## Known Issues

- 「良心」订阅的上游侧根因（IP 封禁 / token 失效 / UA 或指纹过滤 / 代理
  拒绝）需在部署环境确认：部署新代码后重试同步，按新错误消息中的
  响应体与 URL 判定；或直接用交付说明中的 curl 命令对比。

## 结论：上游原因还是仓库问题

**403 是上游（或其 WAF / 代理）的主动拒绝，仓库代码不构成直接原因。**
依据：请求形态自初始提交起未变（HEAD 优先 + GET 回退、UA 默认
clash.meta 可配、accept/accept-encoding 标准头、自定义头透传、
redirect follow），探针证实全部为标准请求；git 历史确认无回归。
仓库侧的真实缺陷是诊断缺口（本 Task 已修复）。

## Merge Record

- 修复提交 `d874e63`（fix(server)），任务档案 `ca27121`（docs(task)），
  均经 fast-forward 合入 main 并推送。
- CI 验证：run 38332716262 **success**。
- Docker 构建（38332716267）随推送执行。
