# HANDOFF-001 — Implementer → Coordinator

> 执行位完成实现与自证后的交接。主控位须先读 `TASK.md` 再读本文件，最后读实际差异。

---

## Meta

```yaml
From: Codex（执行位 · developer）
To: 主控位（Coordinator · Reviewer）
Task: TASK-058 — smoke.ts 14 项失败三簇清偿
Date: 2026-11-02T23:55:00+08:00
Current State: REVIEW
Previous Handoff: 无（首个交接）
```

---

## Completed Work

- **复现**：按 TASK-055 隔离配方实跑一次，得 `168 通过 / 14 失败`、退出码 1，
  14 项断言名与失败详情与 TASK-055 登记**逐条一致**（无新增/消失/改名）。
- **A 簇（7 项）根因**：smoke 11.5 段客户 A/B 只填 `trafficTotal`，而
  `effectiveCustomerTrafficTotal` 自 TASK-046 起只认 `trafficManualCap ?? 套餐月流量`
  ⇒ 两客户是「不限流量」，扫描 `continue`、仪表盘不出卡片。
  用「同一客户、只改上限来源」的探针取得决定性对照：
  `{"checked":0,"notified":0}` → `{"checked":1,"notified":1}` + 1 条站内提醒。
  **归因：smoke 前置构造过期，非产品缺陷。**
- **B 簇（6 项）根因（两个，Background 只记了一个）**：
  - B-1（前 4 条）：12.9 段把 sync 打到第 5 段的主订阅，该订阅已被
    `mail<suffix>@example.com` 占用 ⇒ TASK-053 R2 守卫 409（既定语义，AC-8）。
  - B-2（后 2 条）：库里那行绑定**确实存在**（只读连接直查证实），但
    `GET /api/email-bindings` 的 `listCondition` 只显示「仅注册 / 到期回落」
    （TASK-053 AC-3/AC-5），`expire_at` 为 NULL 的订阅其绑定被过滤 ⇒ 列表空。
  - 对照组（无客户 + 已过期 48h 的订阅）证明换构造后同一流程全通。
- **C 簇（1 项）根因**：`.restore-pending.json` 被服务端写在**快照库同目录**
  （`restore.ts` 的 `restoreMarkerPath`），而配方的 `SMOKE_DB_DIR` 另设了
  一级子目录 ⇒ `existsSync` 为假。**归因：测试配方错误（环境侧），非产品缺陷。**
- **修复（全部在 `server/scripts/smoke.ts`，`server/src/**` 0 行改动）**：
  ① 客户 A/B 补 `trafficManualCap: 100G`（`trafficTotal` 保留作反证）；
  ② 12.9 段新建专用订阅 `syncSub1`（未绑邮箱 + 无客户 + 过期 48h），
     `syncSub2` 补 `expireAt`，sync 目标改指 `syncSub1`，清理段补删 `syncSub1`；
  ③ 头部注释补 `SMOKE_DB_DIR` 口径、19.17 失败详情补诊断提示（不放松断言）。
- **结果**：`smoke.ts` **185 通过 / 0 失败，退出码 0**（基线 182，净增 2 条）。
- **档案**：`TASK-058/TASK.md` 补「根因定位」四元组、V/D 组实测记录、AC 证据；
  `TASK-055/TASK.md` 的 `Known Issues` 第 1 条与「V 组实测记录」**追加**结论
  （历史记录一字未改）。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `server/scripts/smoke.ts` | 修改 | A/B/C 三簇修复 + 文档注释；`59 insertions(+), 5 deletions(-)`，无 `check(` 被删 |
| `tasks/backlog/TASK-058-smoke-failures-closure/TASK.md` | `git mv` + 修改 | 移入 `tasks/active/`；Status BACKLOG → ACTIVE → REVIEW；Owner 执行位；追加根因与实测 |
| `tasks/review/TASK-055-archive-backfill-and-email-binding-residuals/TASK.md` | 修改（仅追加） | `Known Issues` 1 + 「V 组实测记录」追加三簇根因结论 |
| `tasks/active/TASK-058-smoke-failures-closure/handoffs/HANDOFF-001-implementer-to-coordinator.md` | 新增 | 本文件 |

---

## Tests

```yaml
命令: cd server && SMOKE_BASE_URL=http://127.0.0.1:3000 SMOKE_DB_DIR=E:/AiData/task058-smoke \
        node node_modules/tsx/dist/cli.mjs scripts/smoke.ts
结果: 通过 185 / 失败 0 / 退出码 0（修复前基线：168 / 14 / 退出码 1）
覆盖: 三簇 14 项原失败断言逐条转绿；新增 2 条 sub1 创建/删除自洽检查；
      19.16~19.19 恢复排程/标记/未退出/清理全通过且标记无残留
未覆盖: ① 产品代码零改动，故无「未修复代码上必须失败」的反向验证对象
        （AC-5 已按此事实如实标注，未虚构）；
        ② 真实外网订阅同步仍按既有约定只验证失败不崩溃；
        ③ `docs/technical/known-pitfalls.md` 未更新（不在 File Scope）
```

门禁（全部退出码 0，逐条见 `TASK.md`「门禁实测记录」）：
sync-check 62/62、bundle-check 68/68、vitest 27 files / 345 tests、
`tsc -b`、eslint、prettier --check、knip、`audit-repo.py`（PASS=9）、
`build:shared` + `typecheck:server`、smoke 本身；附跑 `audit_framework.py` PASS=13。

---

## Known Issues

- **0 个产品缺陷**：三簇 14 项全部由脚本侧（前置构造 / 期望过期 / 测试配方）造成。
  Requirement 2 与 AC-5 的反向验证要求因此无适用对象，已用「分解对照运行」替代
  （HEAD 版 smoke + 修正配方 = 13 失败；本分支 smoke + 修正配方 = 0 失败）。
- **新发现的产品疑点（未修，建议另立任务）**：`customerInputSchema.trafficUsed`
  的 `.default(0)` 使「PATCH 客户不带 `trafficUsed`」把该列复位为 0。
  超出本任务 File Scope，任务登记属主控位独占动作。
- **环境限制**：`E:\AiData` 沙箱不可写（已就单一临时目录取得人类授权，之后提权执行）；
  `pnpm` 在本机不可用（门禁改用 `node <包入口>` 直调同一版本工具）。
  详见 `TASK.md` Known Issues 5/6。
- **真实库 `app.db-shm` mtime 会随只读连接前进**：已单独实验证明是 SQLite WAL
  固有行为；`app.db` 主文件、`-wal`、四表行数均未变。

---

## Remaining Work

- 无（实现与自证已完成）。剩余动作归主控位：审查、判定 PASS/FAIL、合并、
  回填 `## Merge Record`、把本任务从 `tasks/review/` 归档到 `tasks/done/`。

---

## Assumptions

- 「用例总数不低于基线 182」按**实跑执行的 check 次数**计（smoke 自报
  `185 通过 / 0 失败`），静态 `check(` 字面量为 175（12.9 的 3 条入参校验在循环里）。
- A 簇把 `trafficManualCap` 设为 100G（与原有 `trafficTotal` 同值）以保持
  60%/85%/30%/60%/95% 全部比例不变，从而使 6 条断言的期望值无需改动；
  保留 `trafficTotal` 是为继续证明「存量列不参与」。
- B 簇用「无客户 + 已过期 48h」让绑定落进邮箱管理列表的「到期回落」类，
  这是 TASK-053 归属派生下**唯一**能让 sync 产生的绑定在列表里可见的构造。
- C 簇判定为配方错误而非产品缺陷，依据是 `restore.ts` / `backups.ts` 的实现与
  `smoke.ts` 头部注释三者一致，且 TASK-050 的验收记录未要求标记可落在别处。

---

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 主控位认为 A/B 应改产品而非改脚本 | 修复方向被推翻 | 档案已附探针决定性对照与契约/AC/git 史三重依据，可逐条复核 |
| `syncSub1/sub2` 用过去 `expireAt` 影响后续段落 | 后续断言被扰动 | 实跑 185/0 全绿；两订阅在本段末尾显式删除，job 计数回到基线 |
| 门禁用 `node <包入口>` 而非 `pnpm <script>` | 与 CI 口径不完全一致 | 调用的是同一工具的同一版本；已在档案显式披露，并建议先修本机 pnpm |
| 真实库被写 | 数据损坏 | 全程 `DATABASE_URL` 指向快照；服务端日志逐次确认；D 组只读核查四表行数与 mtime |

---

## Next Action

主控位先跑 `git diff main...bugfix/TASK-058-smoke-failures-closure -- server/scripts/smoke.ts`
确认无 `check(` 被删、无断言放宽，再按 `.agents/workflows/bugfix.md` 第 5 阶段
逐条核对 AC-1~AC-8 的证据可复现性（探针命令与配方见 `TASK.md`「根因定位」§0
与「V 组实测记录」）。PASS 后由主控位合并并按 D13-C 回填 `## Merge Record`；
FAIL 则把状态改回 `CHANGES_REQUESTED` 并写明阻塞项。

---

## References

- `tasks/active/TASK-058-smoke-failures-closure/TASK.md`（本任务唯一事实来源）
- `tasks/review/TASK-055-archive-backfill-and-email-binding-residuals/TASK.md`（隔离配方与 14 项登记）
- `server/scripts/smoke.ts`（11.5 / 12.9 / 19.17 三处改动）
- `shared/src/schema/traffic.ts`、`docs/technical/api-contract.md`（A 簇口径依据）
- `server/src/routes/resources.ts`（B-1 守卫 / B-2 `listCondition`）
- `server/src/db/restore.ts`、`server/src/routes/backups.ts`（C 簇标记路径依据）
- `server/scripts/email-binding-sync-check.ts` 场景 2（B-1 的产品侧既有回归）
- `tasks/done/TASK-013-traffic-threshold-alerts/TASK.md`、`tasks/done/TASK-053-email-binding-states/TASK.md`
