# HANDOFF-001 — TASK-013 仪表盘流量阈值提醒（developer → reviewer）

## 结论

TASK-013 完成。流量阈值提醒（50% / 80% / 100%）全链路落地：shared 纯函数层 →
事件目录（第 6 个事件 `customer.traffic_threshold`）→ 后端穿越式扫描（单事务 +
事务外 publish）→ 调度器每日任务 → 仪表盘「流量阈值提醒」卡片。
验证全绿：冒烟 118/118、前端单测 162/162、build/typecheck/lint/format 全绿。
分支 `feature/TASK-013-traffic-threshold-alerts`，提交待人类批准。

## 接手必读（按序）

1. `tasks/done/TASK-013-traffic-threshold-alerts/TASK.md` — 唯一事实来源（含实施记录）
2. `docs/architecture/overview.md` §12.7 — 阈值提醒设计决策表
3. `shared/src/schema/traffic.ts` — 阈值常量与纯函数（前后端唯一事实来源）
4. `server/src/services/traffic-threshold.ts` — 穿越式扫描实现
5. `server/src/services/reminder-scan.ts` — 扫描 service（消除「无自动触发路径」）

## 关键决策速查

- **穿越式（crossing-based）状态机**：`customers.traffic_threshold_notified`
  恒等于「当前所在最高阈值」；仅当 highest > notified 时通知并更新；
  highest < notified 时静默重置（回落不通知，再次穿越可重新通知）。
- **每次取最高阈值**：一次跳多档（30%→85%）只发「80%」一条，不发 50%。
- **精确阈值比较**：`used * 100 >= total * t`，避免四舍五入提前触发
  （49.6% 不会触发 50%）。
- **生效上限** = `trafficManualCap ?? trafficTotal`（手动上限优先），
  null 或 <= 0 不评估。
- **与 `customer.traffic_exhausted` 并存**：100% 档穿越时两条通知同时存在
  （一次性穿越告警 vs 按天状态提醒），语义不同，刻意不互抑制（见 §12.7）。
- **扫描自动触发**：逻辑抽入 `reminder-scan.ts` service，调度器注册每日 job
  （env `REMINDER_SCAN_CRON`，默认 `0 9 * * *`）；HTTP 入口
  `POST /api/reminders/scan` 保留且响应向后兼容（`created` 仍在）。
- **shared 单测来源**：`src/features/customers/utils.ts` 的
  formatBytes / trafficUsagePercent / effectiveTrafficTotal 改为从 shared
  再导出，既有导入点不动，禁止两套实现漂移。

## 验证记录

- 冒烟 11.5 段 12 check：客户 A（60%→发 50% / 重复不发 / 85%→发 80% /
  回落 30% 不增 / 回 60% 重发 50%）、客户 B（30% 不触发 / 跳 95% 只发 80%）、
  客户 C（手动上限 50G 优先 → 60% 触发 50%）、stats `trafficThresholds`
  断言、末尾 DELETE 清理三个演示客户。
- 端口 3000 实测：stats 返回 `trafficThresholds`，scan 返回
  `{ created, thresholds: { checked, notified, reset } }`。
- 日志实测：「已注册每日提醒扫描任务（0 9 * * *）」与
  「流量阈值扫描：N 个客户参与评估，1 个达到新阈值并已通知」。

## 遗留与下一步候选

- 阈值档位写死 50/80/100 常量——如未来要可配置，设 settings KV + 表单
  （当前刻意不做，见 Non-Scope）。
- 阈值状态列 `traffic_threshold_notified` 无手动重置入口——回落自动重置，
  手动调量场景需再次穿越才通知（刻意设计）。
- 仪表盘卡片仅展示占比 >= 50% 的客户（limit 10），超量时不展示——
  如需完整列表可增设客户页筛选项。
- knip 存量 16 条（CI 已禁用），本任务新增足迹为 0（内部类型不 export，
  组件用 shared 派生类型）。
