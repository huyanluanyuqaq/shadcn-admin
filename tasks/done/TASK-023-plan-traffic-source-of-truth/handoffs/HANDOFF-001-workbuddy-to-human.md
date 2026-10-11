# HANDOFF-001-workbuddy-to-human

```yaml
From: workbuddy (developer)
To: human (reviewer)
Task: TASK-023-plan-traffic-source-of-truth
Date: 2026-10-12
Seq: 001
```

## Current State

Status: DONE（代码完成、验证全绿，**未合并 main、未推送**，等人类批准）。

分支 `feat/TASK-023-plan-traffic-source-of-truth`，7 个原子提交
（6151125 shared / 2671a67 server / 2fad805 smoke / a7369fa web /
f40c6dc test-web / 0e92468 docs / 919980b test-comment）。

## Completed Work

1. **月流量始终跟随套餐**：`resolveAutoTrafficGb` 收窄为单一套餐来源；
   对话框 effect 改为套餐变更/打开即覆盖（旧值等于新值时跳过，避免
   shouldDirty 抖动）；移除 TASK-016 的 `urlPreview` 状态（订阅兜底作废）。
2. **订阅流量上限只读**：字段改 `readOnly` + bg-muted，数据仅来自
   「拉取订阅更新」预览（覆盖语义，上游未返回不动）与编辑模式匹配订阅
   预填；保存时仍随订阅同步（同步引擎本就用上游值覆写，无冲突）。
3. **阈值按套餐流量**：shared 新增 `effectiveCustomerTrafficTotal`
   （手动 > 套餐 > 存量）；server `loadTrafficRows()` left join plans，
   扫描与仪表盘列表共用同一口径。

## Changed Files

见 TASK.md「Changed Files」表（8 个源文件 + 3 个测试文件）。

## Tests

- pnpm test 214/214；build / lint / format:check 全绿；knip 同基线
- 隔离冒烟 141/141（3002 实例，mock 全接线；新增客户 D 用例通过）

## Known Issues

见 TASK.md「Known Issues」（客户表格列未随套餐口径；exhausted 扫描未动；
新建先手填再选套餐会被覆盖——均为范围决策，非缺陷）。

## Remaining Work

- 人类审查 → 批准后 ff 合并 main 并推送（历史任务均走此流程）
- 合并后重启本地服务（server `node --import tsx --watch src/index.ts`；
  web `pnpm dev`），或在 5173 直接验证表单联动

## Assumptions

- 「始终跟随」= 套餐变更即覆盖；套餐未设流量时保留已存/已填值
  （与后端回落链一致，不清空用户数据）
- 阈值口径调整同时覆盖通知扫描（与仪表盘卡片同源，避免口径分裂）

## Risks

- 低。纯展示/计算口径变化，无 DB 迁移、无接口变更。
- 存量数据不受影响；下次打开客户对话框时月流量按套餐刷新。

## Next Action

等人类审查分支 diff；批准后执行合并推送并归档记录提交。
