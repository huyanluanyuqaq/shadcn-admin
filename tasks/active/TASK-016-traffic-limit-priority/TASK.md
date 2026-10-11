# TASK-016 — 客户表单流量上限自动填充优先级（套餐 → 订阅信息 → 手动）

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-016
Title: 客户表单流量上限自动填充优先级（套餐 → 订阅信息 → 手动）
Workflow: feature
Status: REVIEW
Priority: P2
Owner: workbuddy
Owner Since: 2026-10-11
Assigned Role: developer
Created: 2026-10-11
Updated: 2026-10-11
Branch: feat/TASK-016-traffic-limit-priority
Requires Human Approval: false
```

---

## Objective

用户原话：「新增订阅面板中的流量上限值默认从订阅信息中获取，当订阅链接被使用则按照所匹配的套餐月流量为高优先级，最高优先级为手动设置的流量上限」。

落到客户表单（即「订阅面板」，含「订阅信息」「订阅链接」两部分）的**月流量（GB）**字段：
自动填充来源按三级优先级解析——

1. **最高：手动设置**——用户已手填的值永不覆盖（含手动流量上限字段在生效计算中的既有最高优先级，`effectiveTrafficTotal` 语义不变）；
2. **高：套餐月流量**——订阅链接被使用（链接已填写且匹配到订阅管理记录 / 已点「使用」/ 已「拉取订阅更新」）时，所匹配套餐的月流量优先于订阅信息流量；
3. **默认：订阅信息流量**——匹配订阅上报的 `trafficTotal` 或「拉取订阅更新」预览返回值。

---

## Background

- 现状：月流量仅在「选了套餐且字段为空」时从 `plans.trafficLimit` 自动填充
  （`customers-action-dialog.tsx` 现有 effect），订阅链接上报的流量只进第三部分
  「订阅流量上限（GB）」（同步到订阅管理），不回填客户月流量。
- 「拉取订阅更新」预览（`subscriptionPreviewSchema`）已返回 `trafficTotal`，
  但前端只取了 `expireAt`，流量值被丢弃。
- 生效上限计算（`shared/src/schema/traffic.ts` 的 `effectiveTrafficTotal`：
  `trafficManualCap ?? trafficTotal`）不变——本 Task 只改表单**自动填充来源**，
  不改后端、不改 API 契约、不改数据库。

---

## Scope

- 前端 `src/features/customers/data/schema.ts`：新增纯函数 `resolveAutoTrafficGb`
  （套餐月流量 > 订阅信息流量；0/null/undefined 一律视为无来源）。
- 前端 `src/features/customers/components/customers-action-dialog.tsx`：
  - 订阅信息流量来源：匹配订阅（`urlMatch` / 编辑模式 `matchedSub`）的 `trafficTotal`
    + 「拉取订阅更新」预览值（链接变化即作废，避免旧链接流量残留）；
  - 月流量自动填充 effect 改走优先级链（不覆盖已填值）；
  - 「拉取订阅更新」把预览流量纳入自动填充来源；
  - 月流量字段补优先级提示文案。
- 测试：`schema.test.ts` 补 `resolveAutoTrafficGb` 单测。
- 文档：架构 overview 新增 §12.9（优先级链口径）；TASK.md / Handoff。

## Non-Scope

- **不改后端与 API 契约**：`effectiveTrafficTotal`（`trafficManualCap ?? trafficTotal`）、
  阈值扫描、仪表盘口径均不变。
- **不改订阅对话框**（订阅管理的「流量上限(GB)」字段）——那是订阅自身属性，
  与本优先级链无关。
- **不做「自动填充后仍可被套餐切换覆盖」**：与既有行为一致，字段一旦有值
  （自动或手动）即不再被后续 effect 覆盖，用户可手动清空。
- **不动供应商（订阅池）相关任何命名**（术语约定见工作区记忆）。

---

## Requirements

1. 新增 `resolveAutoTrafficGb(planTrafficLimit, subscriptionTraffic)`：返回 GB 字符串，
   '' 表示无来源；套餐月流量优先于订阅信息流量；0 与空值等同视为无来源；
   GB 换算与现有口径一致（`Number((bytes / GB).toFixed(2))`）。
2. 月流量自动填充按「手动填写 > 套餐月流量（订阅链接被使用时高优先级）> 订阅信息流量」
   解析；**已填值永不覆盖**。
3. 订阅信息流量随以下事件更新：匹配订阅出现/变化（含编辑模式打开对话框、
   订阅列表异步到位）、「使用」按钮应用订阅、「拉取订阅更新」预览返回；
   链接被修改后预览值作废。
4. UI：月流量字段提示文案说明自动填充优先级；手动流量上限字段维持
   「设置后优先级最高」表述。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 不引入新依赖；不改 shared / server / DB 迁移 |
| 兼容 | `customerFormSchema` 字段与 `toCustomerInput` 行为不变 |
| 安全 | 无敏感信息处理 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-013（流量阈值，`effectiveTrafficTotal` 口径） | 背景参考 | 已完成（在 main） |

---

## Acceptance Criteria

- [x] AC-1: `resolveAutoTrafficGb` 单测覆盖：双空 / 仅套餐 / 仅订阅信息 / 双有（套餐胜）/
      0 值 / GB 小数换算，全部通过。（schema.test.ts 新增 6 组，39/39 通过）
- [x] AC-2: 编辑模式打开有匹配订阅的客户：月流量为空且无套餐 → 自动填充订阅信息流量；
      有套餐 → 填充套餐月流量（订阅链接被使用，套餐高优先级）；月流量已有值 → 不动。
      （`subscriptionTraffic` 派生 + effect 守卫走查通过；纯函数单测覆盖两来源优先级）
- [x] AC-3: 新建/编辑模式点「拉取订阅更新」：预览流量进入自动填充来源
      （`setUrlPreview({ url, traffic })`）；修改链接后旧预览流量不再残留
      （按链接键控派生，链接不匹配即失效）。
- [x] AC-4: `pnpm test`（182/182，16 文件）/ `pnpm build`（tsc -b + vite build，
      需先 rm -rf dist）/ `pnpm lint` / `pnpm format:check` 全绿。
- [x] AC-5: 架构文档 §5 新增优先级说明表； Changed Files 如实填写（见下）。

---

## File Scope

```yaml
File Scope:
  - src/features/customers/data/schema.ts          # resolveAutoTrafficGb
  - src/features/customers/data/schema.test.ts     # 单测
  - src/features/customers/components/customers-action-dialog.tsx  # 接线与文案
  - docs/architecture/overview.md                  # §12.9
  - tasks/active/TASK-016-traffic-limit-priority/** # 任务文件
Non-Scope (files):
  - shared/**                                      # 无共享契约变更
  - server/**                                      # 无后端变更
  - src/features/subscriptions/**                  # 订阅对话框不动
```

---

## Implementation Plan

1. `schema.ts` 新增 `resolveAutoTrafficGb` 纯函数（含文档注释说明优先级）。
2. `schema.test.ts` 补 6 组单测。
3. `customers-action-dialog.tsx`：
   - 上移匹配订阅相关派生（`subscriptionItems` / `matchedSub` / `subscriptionUrl` watch /
     `urlMatch`），新增 `previewTraffic` state（链接变化作废）与 `subscriptionTraffic` 派生值；
   - 月流量自动填充 effect 改调 `resolveAutoTrafficGb`；
   - `handleFetchPreview` 记录预览流量；
   - 月流量字段补提示文案。
4. 验证：test / build / lint / format:check。
5. 文档与提交归档。

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 | 自动化 | `pnpm vitest run src/features/customers/data/schema.test.ts --browser.headless` |
| AC-2/3 | 代码走查 + 单测 | effect 链走查；匹配/预览两条来源均有单测或既有测试覆盖 |
| AC-4 | 自动化 | `pnpm test && pnpm build && pnpm lint && pnpm format:check` |
| AC-5 | 人工 | 文档 diff 核对 |

---

## Current State

> 2026-10-11：实现与验证完成，Status=REVIEW，等待人类审查。
> 分支 `feat/TASK-016-traffic-limit-priority`（4 个提交），未合并 main、未推送。
> 遗留：人类审查 + 3000 实例人工复核三个场景（见 HANDOFF-001 Next Action）。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| src/features/customers/data/schema.ts | 修改 | 新增 `resolveAutoTrafficGb` 纯函数（套餐月流量 > 订阅信息流量） |
| src/features/customers/components/customers-action-dialog.tsx | 修改 | 上移订阅匹配派生；`urlPreview` 键控预览流量；月流量自动填充改三级优先级链；提示文案；移除未用的 `GB` 导入 |
| src/features/customers/data/schema.test.ts | 修改 | `resolveAutoTrafficGb` 6 组单测 |
| docs/architecture/overview.md | 修改 | §5 新增「客户表单流量上限自动填充优先级（TASK-016）」说明表 |
| tasks/active/TASK-016-traffic-limit-priority/TASK.md | 新增 | 任务定义 |
| tasks/active/TASK-016-traffic-limit-priority/handoffs/HANDOFF-001-developer-to-human.md | 新增 | 交接记录 |

---

## Known Issues

无。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | developer | human(review) | 2026-10-11 | 实现+验证完毕（test/build/lint/format 全绿），待审查合并 |

**最新 Handoff：** `handoffs/HANDOFF-001-developer-to-human.md`
**Next Action：** 人类审查 diff（重点 `subscriptionTraffic` 派生与自动填充 effect），
通过后合并 main；3000 实例人工复核三场景（编辑匹配客户 / 拉取订阅更新 / 使用）。

---

## Task Rules

- [补充] 术语：「订阅面板」指客户表单（含「订阅信息」「订阅链接」两部分）；
  「订阅信息流量」指订阅链接上报/预览得到的 `trafficTotal`，与第三部分
  「订阅流量上限（GB）」（同步到订阅管理的字段）是两个字段，不得混淆。

---

## Notes

- 既有 `subscriptionFieldsFrom`（匹配订阅 → 第三部分字段）保持不变；
  订阅信息流量只参与**第二部分月流量**的自动填充，不写回第三部分字段。
- 「拉取订阅更新」预览不修改「订阅流量上限（GB）」——该字段的同步语义
  （保存时写入订阅管理）不变，避免预览值污染订阅自身属性。
