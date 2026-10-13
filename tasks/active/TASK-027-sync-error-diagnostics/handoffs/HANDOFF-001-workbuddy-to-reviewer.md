# HANDOFF-001-workbuddy-to-reviewer

```yaml
From: workbuddy (Developer + Tester)
To: Reviewer
Task: TASK-027-sync-error-diagnostics
Date: 2026-10-13
```

## Current State

Status: REVIEW。修复已提交于分支 `fix/TASK-027-sync-error-diagnostics`，待合并 main。

## Completed Work

1. 事故分析（部署实例订阅「良心」，错误 timeout → 403）：
   - 探针固化仓库真实请求形态：HTTP/1.1、HEAD 优先 + GET 回退、UA 默认
     clash.meta（可配）、accept/accept-encoding 标准头、自定义头透传、
     redirect follow。git 历史确认自初始提交起未变，**无回归**。
   - 结论：403 为上游主动拒绝，仓库不构成直接原因；仓库侧真实缺陷是
     诊断缺口（消息无 URL/方法/响应体，无法区分源站拒绝与代理拒绝）。
2. 修复（诊断增强，对齐 TASK-024 先例）：
   - 新增纯模块 `subscription-errors.ts`（无 undici 依赖，浏览器模式可测）；
   - `subscription-parser.ts` 消费之：403 等状态码错误带
     `方法 最终URL + 代理说明 + content-type + 响应体片段（截断 200）`；
     超时/网络错误带 `方法 URL（+超时值）`，原错误挂 cause；
   - 顺带消除 HEAD→GET 回退中两个完全相同分支的 if/else（行为不变）。
3. 测试：
   - 新增 `subscription-errors.test.ts` 14 例（浏览器模式）；
   - smoke.ts mock 上游新增 /403 路由 + 诊断断言（真实 undici 端到端）；
   - 全量 `pnpm test` 20 files / 246 tests 全过，exit 0；
   - prettier / eslint 通过。

## Changed Files

- `server/src/services/subscription-errors.ts`（新增）
- `server/src/services/subscription-errors.test.ts`（新增）
- `server/src/services/subscription-parser.ts`
- `server/scripts/smoke.ts`
- `tasks/active/TASK-027-*/TASK.md`

## Tests

- 定向单测 14/14；全量 246/246；prettier/eslint 通过。
- 端到端探针 8 场景：403/重定向 403/超时消息均含完整现场；
  成功路径与 TASK-024 缺头消息不回归。

## Known Issues

- 浏览器模式无法 mock 被预打包的 undici（vitest 已知限制），故流程级
  验证走 smoke（node，真实 undici），消息级验证走纯函数单测。
- 「良心」上游根因需部署环境确认（见 TASK.md 交付说明）。

## Remaining Work

- Reviewer 审查 → 合并 main → CI 转绿 → 归档 done/。

## Assumptions

- 不调整 10s 超时与 HEAD 优先策略（属策略调优，非本缺陷）。
- 错误消息含完整 URL（可能带 token）——与 TASK-024 已确立的先例一致。

## Risks

- 低。消息文本变化无消费方解析；last_error / 通知 / API 错误字段均原样展示。
- 403 响应体读取仅限 GET 且截断 200 字符，内存与流量影响可忽略。

## Next Action

Reviewer 审查；通过后合入 main 并确认 CI 转绿。
