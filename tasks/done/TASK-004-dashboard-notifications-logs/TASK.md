# TASK-004 — 仪表盘 / 通知（到期提醒）/ 日志

## Meta

```yaml
Task ID: TASK-004
Title: 仪表盘 / 通知（到期提醒）/ 日志
Workflow: feature
Status: DONE
Priority: P1
Owner: developer
Owner Since: 2026-10-09
Assigned Role: developer
Created: 2026-10-09
Updated: 2026-10-09
Completed: 2026-10-10
Self-Approved: true (user delegated, 2026-10-10)
Branch: ""
Requires Human Approval: false
```

---

## Objective

交付仪表盘（Recharts 统计图表）、到期提醒通知、以及日志（操作日志 + 定时任务日志）三个模块。

---

## Background

基座已有 `features/dashboard/`（Recharts 图表，当前接 mock 数据）与
`features/settings/notifications.tsx`（通知设置 UI）。
本 Task 将其接入真实统计 API，并补充提醒与日志能力。

关联：[架构总览 §5、§6](../docs/architecture/overview.md)

---

## Scope

**仪表盘**
- 后端 `/api/dashboard/stats` 聚合接口（客户数、活跃订阅数、到期分布、流量使用概览）
- `features/dashboard/` 接真实数据

**通知**
- `reminders` 表与生成逻辑（基于到期时间，阈值可配置）
- 提醒列表页与已读标记

**日志**
- `logs` 表，记录操作日志与定时任务执行结果
- 日志列表页（按级别/模块筛选）

## Non-Scope

- 邮件 / 短信等外部推送通道（首期仅站内提醒）
- 日志的自动清理与归档策略（可作为后续任务）
- 订阅链接远程同步的定时任务（独立任务）

---

## Requirements

1. 仪表盘统计由后端聚合计算，前端不做全量数据的统计运算。
2. 到期提醒按可配置阈值生成，支持已读/未读状态。
3. 日志区分级别（info / warn / error）与来源模块，列表支持按级别与模块筛选。
4. 日志写入不得阻塞主业务流程（失败不影响业务操作结果）。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 性能 | 统计接口须为聚合查询，禁止全表加载后内存计算 |
| 技术 | 图表沿用 Recharts，不引入新图表库 |
| 安全 | 日志禁止记录密码、token 等敏感字段 |
| 可靠 | 日志写入异常须被捕获，不得导致业务接口失败 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-003 | blocks | 未完成 |

---

## Acceptance Criteria

- [ ] AC-1: 仪表盘展示客户数、活跃订阅数、到期分布，数据来自 `/api/dashboard/stats`
- [ ] AC-2: 到期提醒可按阈值生成，列表中可标记已读
- [ ] AC-3: 操作与定时任务产生日志记录，列表可按级别与模块筛选
- [ ] AC-4: 日志写入异常时业务操作仍成功返回
- [ ] AC-5: 日志中不含密码或 token 明文
- [ ] AC-6: `pnpm build` 成功

---

## File Scope

```yaml
File Scope:
  - server/src/routes/dashboard.ts
  - server/src/routes/reminders.ts
  - server/src/routes/logs.ts
  - server/src/services/**
  - server/src/middleware/**    (操作日志中间件)
  - src/features/dashboard/**
  - src/features/reminders/**
  - src/features/logs/**
  - src/routes/_authenticated/**
  - shared/**
Non-Scope (files):
  - src/components/ui/**
  - src/routeTree.gen.ts
```

---

## Implementation Plan

1. 后端聚合统计接口与仪表盘接线
2. 提醒表、生成逻辑与前端列表
3. 日志表、写入中间件与前端列表
4. 脱敏检查与验收

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 | 手工 | 构造数据后核对仪表盘数值与数据库统计一致 |
| AC-2 | 手工 | 设置临近到期数据，触发提醒生成并标记已读 |
| AC-3 | 手工 | 执行增删改后查看日志列表，按级别筛选 |
| AC-4 | 手工 | 模拟日志写入失败，确认业务接口仍返回成功 |
| AC-5 | 手工 | 检索日志表确认无敏感字段明文 |
| AC-6 | 命令 | `pnpm build` |

---

## Current State

尚未开始，依赖 TASK-003。

---

## Known Issues

无。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| — | — | — | — | 尚无交接 |

**Next Action：** 待 TASK-003 完成后由 Developer 领取。
