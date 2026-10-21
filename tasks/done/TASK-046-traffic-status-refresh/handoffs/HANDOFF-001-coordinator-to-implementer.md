# HANDOFF-001 — 主控位 Coordinator → 执行位 Implementer

---

## Meta

```yaml
From: 主控位 Coordinator
To: 执行位 Implementer
Task: TASK-046 — 修复换订阅后仪表盘流量状态不刷新（缓存失效 + 生效上限分母）
Date: 2026-10-20
Current State: ACTIVE
Previous Handoff: 无（首个交接）
```

---

## Completed Work

> 主控位已完成的部分（你**不需要**重做，但你**需要**复核其结论）。

- [x] **逐层实测定位数据来源**：仪表盘 → `useDashboardStatsQuery`（`['dashboard','stats']`）
      → `GET /dashboard/stats` → `listTrafficThresholdStatuses()`（**每次实时查库**）。
- [x] **根因 A 定位**：保存后只失效 `customerKeys.root`（`['customers']`），
      **`dashboardKeys.stats` 从未被 invalidate**；叠加 `staleTime: 5 分钟`。
- [x] **根因 B 定位（决定性证据）**：`customers.traffic_total` **全仓无任何写入方**
      （`set({...trafficTotal...})` 在 `server/src/` **零命中**）⇒ 只读历史存量列；
      客户表单无该字段；订阅额度写在 `subscriptions` 表 ⇒ 换订阅后**分母不变**。
- [x] **排除 4 个假设**（后端陈旧 / 扫描快照 / 时序颠倒 / 列表接口旧字段）。
- [x] **查证官方做法**（TanStack Query 官方文档）：`invalidateQueries` **按前缀匹配**，
      推荐 **key factory** 层级（`all → lists → list`），`all` 用于批量失效。
- [x] **人类确认现象为①**（仪表盘卡片仍 100%），历史提醒清理**不在本任务范围**。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `tasks/active/TASK-046-traffic-status-refresh/TASK.md` | 新增 | 任务档案 |
| `tasks/active/TASK-046-traffic-status-refresh/handoffs/HANDOFF-001-coordinator-to-implementer.md` | 新增 | 本文件 |

---

## Tests

```yaml
命令: 未运行（设计阶段产物，零代码变更）
结果: 不适用
覆盖: 不适用
未覆盖: 全部验证留待你按 AC-1 ~ AC-10 实施
```

---

## Known Issues

- **★ KI-1：R2 的实现路径待定** —— 存量 `customers.traffic_total` 是否存在
  「与订阅无关的独立语义」**尚未实测**。**你必须先跑 Phase 1 第 3 步的 SQL** 再选路径：
  - **路径甲（写库镜像）**：订阅同步后把 `subscriptions.traffic_total` 镜像到 `customers`。
    ⚠️ 副作用：**改变存量列含义**（历史值被订阅值覆盖）。
  - **路径乙（读取期口径）**：不动库，改 `effectiveCustomerTrafficTotal` 的调用侧，
    使第三顺位读「当前订阅额度」。⚠️ 副作用：要统一**三处**调用点（见 R4）。
  ⇒ 两条路径副作用不同，**不许凭直觉选**，须在 handoff 中报告依据。
- **KI-2** 仪表盘上**没有**「流量已用尽」字样，那张卡片显示的是**百分比 + 阈值徽标**。
  本任务修的是**该卡片的百分比**。
- **KI-3** `reminders` 表的「流量已用尽」提醒**永久留存**（无删除端点）。
  **不在本任务范围**，如需处理另立任务。

---

## Remaining Work

按 `TASK.md` 的 Implementation Plan 执行，全部 AC 均未开始：

- **Phase 1**：基线 → **实测存量数据（SQL）** → `pnpm build:shared`
- **Phase 2**：R1 缓存失效（统一失效函数 + 在用量同步成功后调用）
- **Phase 3**：R2 上限来源 + R4 口径一致
- **Phase 4**：R3 反向验收测试 → 全量验证 → 开 PR → **停下**

---

## Assumptions

> 以下是主控位做出的假设。**若某条不成立，立即停下上报。**

1. **`main` 仍为 `604017d`**。若已推进，`git fetch` 后复核即可，**不要**因此改变做法。
2. **无待合并 PR**。若出现（有人抢先提交），**停下报告**。
3. **浏览器 vitest 环境可用**（本项目既有测试在跑）。
4. **数据库可只读访问**（Phase 1 的 SQL 需要）——
   若本机无 DB 快照，**用项目既有的 `VACUUM INTO` 快照流程**或改用只读分析，**不要**改生产数据。

---

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **只修一个根因** | 用户刷新后仍见 100%，或 5 分钟内仍见旧值 | Task Rules 明列「两个根因都要修」；AC-2 与 AC-4 分别验收 |
| **用全量 `invalidateQueries()`** | 连带触发所有查询重拉，性能与体验劣化 | AC-3 明列；R1 要求精确失效 |
| **失效时机放错位置** | refetch 拿到的还是旧用量 | R1 要求在**用量同步成功之后**；AC-2 明确 |
| **R2 选了不合适的路径** | 存量数据语义被破坏，或三处口径不一致 | KI-1 + Phase 1 强制先实测；AC-6 逐处核对 |
| **把「用尽」判定一起修掉** | **把 bug 藏起来** —— 用尽客户不再显示 100% | **R3 是反向验收**（AC-5），有测试断言 |
| **浏览器 vitest 假失败** | 浪费时间 | R5 已列三个已知坑（`console.log` 不转发 / 无 `queryByRole` / 文本断言恒真） |
| **既有测试因 mock 调整而红** | 误判为破坏 | AC-7 说明「mock 需按 R1 调整是**预期变更**」 |
| **改 `effectiveCustomerTrafficTotal` 的优先级顺序** | 破坏 TASK-023 设计 | Constraints 明列「不得改优先级」 |

---

## Next Action

**接收方（执行位）的第一个具体动作，按序执行：**

1. 读完 `tasks/active/TASK-046-traffic-status-refresh/TASK.md`，
   重点是 §Background（两个根因的证据链）与 R2（两条路径）。

2. 执行 **AC-1 前置基线**：

   ```bash
   cd E:/NDLDSN-WORKSPACE/projects/shadcn-admin
   git fetch origin
   git rev-parse main origin/main          # 期望两处 604017d
   git status --short                     # 期望为空
   gh api repos/huyanluanyuqaq/shadcn-admin/pulls \
     --jq '.[] | select(.state=="open") | .number'   # 期望为空
   ```

3. **★ 跑存量数据 SQL（决定 R2 路径，不可跳过）**：

   ```sql
   select count(*) from customers where traffic_total is not null;
   select count(*) from customers c
     join subscriptions s on s.customer_id = c.id
     where c.traffic_total is not null;
   select c.id, c.traffic_total, s.traffic_total
     from customers c join subscriptions s on s.customer_id = c.id
     where c.traffic_total is not null limit 20;
   ```

   把**原始输出**记进 handoff —— 它决定你走路径甲还是路径乙。

4. 确认无误 ⇒ `git switch main && git pull --ff-only`，
   然后 `git switch -c chore/TASK-046-traffic-status-refresh`，
   再跑 `pnpm build:shared`（**必须先跑**，否则 `server/` 下测试会因 `dist` 缺失爆发 Invalid hook call）。

> **不得跳过第 3 步。** R2 的两条路径副作用不同，选错会破坏存量数据语义。

---

## References

- 任务档案：`tasks/active/TASK-046-traffic-status-refresh/TASK.md`（唯一事实来源）
- 根因 A 现场：`src/features/customers/components/customers-action-dialog.tsx`（约 426-430 行）
- 根因 B 现场：`server/src/services/subscription-sync.ts`（约 157-160、301-304 行）
- 口径函数：`shared/src/schema/traffic.ts`（`effectiveCustomerTrafficTotal`）
- 仪表盘查询：`src/features/dashboard/queries.ts`
- 既有测试：`src/features/customers/components/customers-action-dialog.test.tsx`
- 官方文档：TanStack Query《Invalidations from Mutations》《Query Invalidation》
- 规范：`AGENTS.md` §13（DoD）、§14.2（rebase-merge）