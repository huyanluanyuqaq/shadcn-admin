# HANDOFF-001-developer-to-reviewer.md

- **From:** developer
- **To:** reviewer
- **Task:** TASK-028 — 渠道通知消息增加客户名称归属行
- **日期:** 2026-10-13

---

## Current State

实现、测试、文档全部完成，三件套 + 全量测试全绿，待 Review。

---

## Completed Work

1. `notification-format.ts`：新增 `customerLine()`，按优先级渲染归属行
   （客户名 > 邮箱 > 该订阅暂未使用）；单条同步成功/失败事件插入归属行
2. `subscription-sync.ts`：新增 `SyncRow` 类型与 `loadSyncRows()` 一次性 join 查询
   订阅 + 归属客户，避免 N+1；`syncOne` / `syncMany` 统一走该查询，publish data 带
   `customerName` / `email`
3. `notification-format.test.ts`：6 例归属行测试（三种分支 + 空值/空白降级 + 失败事件）
4. `smoke.ts`：17.9 追加归属行断言（已绑定客户显示客户名、未绑定提示暂未使用）
5. `docs/architecture/overview.md`：§12.6.1 更新为五段结构 + 归属行决策表

---

## Changed Files

| 文件 | 变更类型 |
|------|---------|
| server/src/services/notification-format.ts | 修改 |
| server/src/services/notification-format.test.ts | 修改 |
| server/src/services/subscription-sync.ts | 修改 |
| server/scripts/smoke.ts | 修改 |
| docs/architecture/overview.md | 修改 |

---

## Tests

- `pnpm vitest run --browser.headless server/src/services/notification-format.test.ts`：23/23
- `pnpm test`：251/251（20 文件）
- `pnpm --filter server typecheck`：pass
- `pnpm lint`：pass
- `pnpm format:check`：pass
- 隔离冒烟（smoke 17.9 归属行断言）：待服务端指向 mock 上游时跑（当前环境无监听 :3000 的服务）

---

## Known Issues

无。

---

## Assumptions

- 归属行只注入单条同步事件（syncOne 的 success/failure）。批量同步为汇总消息，
  面向全部订阅，无单一归属，刻意不注入
- `loadSyncRows` 保留原筛选语义：指定 ids 按 ids 取（不管开关），未指定取全部启用
- drizzle-orm 0.45 无 `filter(`，改用 `.where()` + 内存排除 in-flight

---

## Risks

- smoke 17.9 的新增断言依赖端到端环境，本次未跑通（环境无服务端），仅验证了
  静态类型与离线单测

---

## Next Action

Review 通过后：
1. 移入 `tasks/done/TASK-028-notification-customer-name/`
2. 创建分支 `feat/TASK-028-notification-customer-name`，提交并推送
3. 跑隔离冒烟验证 smoke 17.9 归属行断言