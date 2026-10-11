# TASK-023 — 月流量始终跟随套餐 + 阈值按套餐流量 + 订阅流量上限改为实际流量

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-023
Title: 月流量始终跟随套餐 + 阈值按套餐流量 + 订阅流量上限改为实际流量
Workflow: feature
Status: DONE
Priority: P2
Owner: workbuddy
Owner Since: 2026-10-12
Assigned Role: developer
Created: 2026-10-12
Updated: 2026-10-12
Branch: feat/TASK-023-plan-traffic-source-of-truth
Requires Human Approval: false
```

---

## Objective

用户需求（2026-10-12，三处联动）：

1. **第二部分「月流量」始终跟随套餐对应流量**——不再回落到订阅信息流量，
   套餐变更即覆盖（TASK-016 的「仅空值填 + 订阅兜底」语义作废）；
2. **仪表盘流量阈值按客户对应套餐月流量计算**，设置了手动流量上限时
   手动上限为最高优先级；
3. **第三部分「订阅流量上限」改为订阅链接实际流量**——数据用
   「拉取订阅更新」获取到的订阅信息填充（字段只读，不再手填）。

---

## Background

- TASK-016 建立的三级优先级（手动 > 套餐 > 订阅信息流量）中，「月流量」
  的自动填充是**仅空值填**且订阅信息流量可兜底；用户现要求「始终跟随
   套餐」，即套餐是唯一自动来源且套餐变更必须覆盖旧值。
- 阈值评估（TASK-013）当前口径 `trafficManualCap ?? trafficTotal` 读的是
  customers 存量 `traffic_total`——套餐改流量后存量值不跟进，阈值按陈旧
  值计算；改为 join plans 取 `traffic_limit`。
- 第三部分「订阅流量上限」当前是手填字段（保存时同步到订阅管理），与
  「订阅链接实际流量」的语义不符；同步引擎每次同步本就用上游
  `usage.total` 覆写 `subscriptions.traffic_total`，手填值会被覆盖，
  保留手填无意义。

---

## Scope

- `src/features/customers/data/schema.ts`：`resolveAutoTrafficGb` 简化为
  单一套餐来源（签名收窄为一个参数）
- `src/features/customers/components/customers-action-dialog.tsx`：
  月流量 effect 改「始终跟随」；移除 `urlPreview` 状态；
  「订阅流量上限」字段改只读 + 新提示文案
- `shared/src/schema/traffic.ts`：新增 `effectiveCustomerTrafficTotal`
  （手动上限 > 套餐月流量 > 存量月流量），补单测
- `server/src/services/traffic-threshold.ts`：扫描与仪表盘列表两处查询
  left join plans，生效上限改新链
- `server/scripts/smoke.ts`：补「套餐流量与存量不一致时按套餐计」用例
- `docs/architecture/overview.md`：§5 优先级表、§12.7 生效上限行同步更新

**不在范围**：客户表格「流量使用」列（仍读存量 traffic_total，Customer
API 不返回套餐流量）、订阅管理页表单（自有 trafficTotal 字段不动）、
数据库迁移（无 schema 变更）。

---

## Acceptance Criteria

- [x] 新建/编辑客户：选中有月流量的套餐 → 月流量即显示套餐值；切换套餐 → 跟随新套餐值
- [x] 未选套餐或套餐未设月流量 → 月流量保留已存/已填值，可手填
- [x] 「订阅流量上限」只读；「拉取订阅更新」成功后按上游流量填充（覆盖语义，上游未返回则不动）
- [x] 仪表盘阈值与通知扫描：生效上限 = 手动上限 ?? 套餐月流量 ?? 存量月流量
- [x] pnpm test / lint / format:check / build 全绿；隔离冒烟通过

---

## Changed Files

| 文件 | 改动 |
|------|------|
| `src/features/customers/data/schema.ts` | `resolveAutoTrafficGb` 收窄为单一套餐来源 |
| `src/features/customers/components/customers-action-dialog.tsx` | 月流量 effect 改「始终跟随」；移除 `urlPreview` 状态；「订阅流量上限」只读 + 新提示 |
| `shared/src/schema/traffic.ts` | 新增 `effectiveCustomerTrafficTotal`（手动 > 套餐 > 存量） |
| `server/src/services/traffic-threshold.ts` | 新增 `loadTrafficRows()`（left join plans），扫描与仪表盘列表共用；生效上限改新链 |
| `server/scripts/smoke.ts` | 补阈值客户 D（套餐 1G vs 存量 100G，按套餐计） |
| `docs/architecture/overview.md` | §5 优先级表、§12.7 生效上限、§10.7 镜像注释同步 |
| 测试 | `shared/src/schema/traffic.test.ts`、`src/features/customers/data/schema.test.ts`、`src/features/customers/components/customers-action-dialog.test.tsx` |

## 验证记录（2026-10-12）

- `pnpm test`：**214/214**（18 文件；对话框测试 11→15，新增月流量跟随 4 例 + 只读字段 2 例）
- `pnpm build`（前置 `rm -rf dist`）/ `pnpm lint` / `pnpm format:check`：全绿
- `pnpm knip`：与干净 main 同基线（22 个既有未用项，非回归）
- 隔离冒烟（3002 实例 + mock Telegram/飞书/订阅上游）：**141 通过 / 0 失败**，
  含新增「客户 D 按套餐月流量计算（90%）：触发 80% 阈值」与仪表盘 D 项断言
- `pnpm build:shared` + `pnpm typecheck:server`：通过

## Known Issues

- 客户表格「流量使用」列仍按存量 `traffic_total` 显示（Customer API 不返回套餐
  月流量，未在本次范围）——极端情况下（套餐改流量后未再打开客户表单）行内
  百分比与仪表盘阈值卡片可能不一致；下次打开客户对话框即同步。
- 新建时先手填月流量再选套餐，手填值会被套餐值覆盖（「始终跟随」的预期语义）；
  需要真正不同的上限请用「手动流量上限」字段（全局最高优先级）。
- `customer.traffic_exhausted`（用尽提醒）仍读存量 `traffic_total`，未随套餐口径
  调整（本次仅阈值 50/80/100 评估，属既有范围决策）。

---

## Handoff 记录

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 1 | workbuddy | human | 2026-10-12 | 实现+验证+归档完成，待人类批准合并推送 main |
| 2 | human | workbuddy | 2026-10-12 | 批准合并（「提交并推送」）→ 已 ff 合并 main 并推送 origin，分支已删 |

---

## 合并前检查单

- [x] `pnpm test` 全绿（214/214，合并前复跑确认）
- [x] `pnpm lint` / `pnpm format:check` 通过
- [x] `tsc -b` / `vite build` 通过（前置 `rm -rf dist`）
- [x] 隔离冒烟 141/141（3002 实例 + mock 三通道，未污染 3000 真实数据）
- [x] 任务文档归档至 `tasks/done/`
- [x] **人类批准后**：ff 合并 main + 推送 origin + 删分支（2026-10-12 完成）

---

## Task Rules

- 遵循 P5 最小改动：不动客户表格列、不动订阅管理页、无 DB 迁移
- shared 改动后需 `pnpm build:shared`（后端消费 dist）
