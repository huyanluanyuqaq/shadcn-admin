# TASK-058 — smoke.ts 14 项失败三簇清偿

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-058
Title: smoke.ts 14 项失败三簇清偿
Workflow: bugfix
Status: ACTIVE
Priority: P1
Owner: Codex（执行位 · developer）
Owner Since: 2026-11-02T22:05:00+08:00
Assigned Role: developer
Created: 2026-11-02T21:50:00+08:00
Updated: 2026-11-02T22:05:00+08:00
Branch: bugfix/TASK-058-smoke-failures-closure（自 docs/TASK-057-059-backlog-registration 切出，含 TASK-058 登记提交）
Requires Human Approval: false
```

## Objective

把 `server/scripts/smoke.ts` 的 **14 项既有失败**全部清零，使端到端冒烟退出码为 0；
且必须通过**定位真实缺陷或修正过期期望**来清零，不得通过删用例、放宽断言或跳过段落来「变绿」。

## Background

TASK-055（2026-11-02）首次实跑 `smoke.ts`，得 **168 通过 / 14 失败，退出码 1**，
并用 `main` 基线对照证明 14 项**先于该任务存在**（分簇计数经主控位 m-1 整改后为
「阈值 6 + 仪表盘 1 = 7 / sync 6 / 备份 1」，合计数 14 不变）。

三簇成因（TASK-055 `Known Issues` 1 的登记）：

| 簇 | 项数 | 失败断言 | 初步归因 |
|----|------|---------|---------|
| **A 流量阈值** | 6 + 1 = 7 | 客户 A/B 穿越 50%/60%/80%、回落、重置后重发；仪表盘 stats 返回 trafficThresholds | `/api/reminders/scan` 未生成提醒行（`{"notified":0,"rows":0}`） |
| **B 邮箱绑定 sync** | 6 | sync 创建/改绑/跨供应商/清理陈旧绑定/仅剩一条/按 poolId 筛选 | 被 TASK-053 的 R2 守卫（「一条订阅只能对应一个邮箱」）以 409 拒绝；**smoke 脚本期望写于该守卫之前，属脚本期望过期** |
| **C 备份恢复标记** | 1 | 19.17 恢复标记存在且 `filename` 等于请求目标 | 读到的值与请求目标不符 |

**重要限定**：以上归因是 TASK-055 的**初步判断**，未经逐簇根因验证。本任务的第一步必须是
**逐簇复现并定位根因**，不得直接按上表动手——尤其 A 簇「`/api/reminders/scan` 未生成提醒行」
可能是产品缺陷，也可能是 smoke 的前置数据构造问题，两者处置方式完全不同。

## Scope

- 逐簇复现 14 项失败，定位根因，区分「产品缺陷」与「smoke 期望过期 / 前置构造不当」。
- 按根因修产品代码**或**修 smoke 期望（后者必须在档案中说明为何期望是错的，并指向引入该期望的任务）。
- 修完后 `smoke.ts` 全绿（退出码 0），并把三簇的根因结论写入 `TASK-055` 的 `Known Issues` 1
  （**追加**，不改写历史记录）与相关业务档案。

## Non-Scope

- **不加新功能**。流量阈值通知的语义若被证明有缺陷，只修到「与既有 AC / 人类裁决一致」，
  不得借机改口径。
- **不改 `docker.yml` / `ci.yml` 的触发或作业**。
- **不动 `server/data/app.db` 真实库**（只读核查除外；smoke 必须用 `VACUUM INTO` 隔离快照）。
- **不给 `smoke.ts` 加「跳过失败段落」的开关**。

## Requirements

1. 三簇各自的根因必须写成可复现的结论：现象 → 定位命令 → 归因（产品 / 脚本 / 环境）→ 依据。
2. 若归因为**产品缺陷**：修产品代码，并补对应的单元/脚本断言，使缺陷被回归守住
   （**该断言必须先在未修复代码上失败**——TASK-055 M-1 的教训：不具区分力的用例只是装饰）。
3. 若归因为**smoke 期望过期**：改期望，并在档案中写明「期望写于 TASK-XXX 之前，
   此后 R2 守卫 / 语义已变更」，附变更出处。**不得**删除用例来消除失败。
4. A 簇若证明 `/api/reminders/scan` 确有缺陷，须核对 `TASK-013` 的 AC 与
   `docs/technical/api-contract.md` 的语义表，判定是「实现回归」还是「文档与实现从未一致」。
5. 修完后全量门禁退出码全 0：sync-check、bundle-check、vitest、`tsc -b`、eslint、prettier、knip、
   `audit-repo.py`、`build:shared` / `typecheck:server`，以及 **`smoke.ts` 本身**。

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 不引新依赖；smoke 必须用隔离快照库（`VACUUM INTO`），**绝不写真实库** |
| 兼容 | 不改公开 API 契约；若必须改，先更新 `api-contract.md` 并说明 |
| 安全 | 真实库任何写操作都超权 |
| 流程 | 每提交一个关注点；footer 含 `Refs: TASK-058` |

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-055（smoke 首次实跑 + 隔离配方 + 分簇登记） | blocks | 已完成 |
| `main` 上 `traceability` 已是必需检查 | 环境 | 已完成（本任务自己的提交须自带 `Refs`） |

## Acceptance Criteria

- [ ] AC-1: A 簇 7 项的根因定位完成并写入档案，含复现命令与归因依据。
- [ ] AC-2: B 簇 6 项的根因定位完成；若为脚本期望过期，已改期望并注明变更出处（TASK-053 R2）。
- [ ] AC-3: C 簇 1 项（19.17）的根因定位完成并修完。
- [ ] AC-4: `smoke.ts` 实跑 **168+ 通过 / 0 失败，退出码 0**；输出贴入档案。
- [ ] AC-5: 若修了产品缺陷，新增的回归断言已通过「未修复代码上必须失败」的反向验证，
      两次运行原始输出贴入档案。
- [ ] AC-6: 未删任何既有 smoke 用例；用例总数不低于基线（**182** = 168 + 14），
      断言数不低于基线。
- [ ] AC-7: 真实库 `server/data/app.db` 四表行数与 mtime 在任务前后一致（只读核查留证）。
- [ ] AC-8: 全量门禁退出码全 0（见 Requirements 5）。

## File Scope

```yaml
File Scope:
  - server/scripts/smoke.ts
  - server/src/**            # 仅当归因为产品缺陷时
  - server/drizzle/**        # 仅当需迁移时（需额外说明）
  - docs/technical/api-contract.md
  - tasks/backlog/TASK-058-*/**  → tasks/active/… → tasks/review/…
Non-Scope (files):
  - .github/**
  - .agents/**
  - templates/**
  - scripts/audit-repo.py
  - shared/scripts/**
  - src/**
```

## Implementation Plan

1. 切分支；按 TASK-055 的隔离配方（`VACUUM INTO` + `RESTORE_AUTO_EXIT=false` + `SMOKE_DB_DIR`）起服务。
2. **先复现**：跑一次 smoke，确认 14 项失败清单与 TASK-055 记录逐条一致（若不一致，先说明差异）。
3. **逐簇定位**：A → B → C，每簇写「现象 / 定位命令 / 归因 / 依据」四元组。
4. 按归因修：产品缺陷修代码 + 补区分力断言；期望过期改期望 + 注明出处。
5. 对每个产品缺陷修复做**反向验证**（未修复代码上断言必须失败）。
6. 全量门禁 + smoke 全绿；核对真实库未变。
7. 提交、推分支、开 PR、交主控位审查。

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| 复现一致性 | 实跑 | TASK-055 的隔离配方；比对 14 项清单 |
| AC-1~3 | 根因定位 | 逐簇的定位命令与输出 |
| AC-4 | 实跑 | `cd server && SMOKE_BASE_URL=… SMOKE_DB_DIR=… ./node_modules/.bin/tsx scripts/smoke.ts > /tmp/x.log 2>&1; echo exit=$?` |
| AC-5 | 反向验证 | 暂存回改动前版本重跑，断言必须失败；再恢复重跑必须通过 |
| AC-6 | 文本 | `grep -c` 用例/断言数对比基线 |
| AC-7 | 只读核查 | `better-sqlite3` `{readonly:true}` 查四表行数 + mtime |
| AC-8 | 门禁 | 九条命令逐一记录退出码 |

## Current State

**ACTIVE（2026-11-02 22:05 执行位领取）。** 分支 `bugfix/TASK-058-smoke-failures-closure`。
下一步：按 TASK-055 的隔离快照配方复现 14 项失败，逐簇定位根因。

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| — | — | 尚未开始 |

## Known Issues

1. **14 项的初步归因未经根因验证**（TASK-055 只做了「先于本任务存在」的基线对照，未定位根因）。
   本任务若发现归因错误，须在档案中如实更正，**不得**为维持原登记而硬套。
2. **A 簇可能牵涉 TASK-013 的 AC 与 `api-contract.md` 的一致性**。若证明「文档与实现从未一致」，
   属跨任务历史问题，需在档案中登记并评估是否另立任务。
3. **C 簇（19.17）与 TASK-050 的备份恢复功能直接相关**，改动前须读该任务的验收记录。

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| — | — | — | — | 尚未开始 |

**最新 Handoff：** 无
**Next Action：** 执行位领取后先复现并逐簇定位根因，**不要**按 Background 的初步归因直接动手。

## Merge Record

> **本节不随「Pass/收尾」填写。** 按 D13-C 选项 C（`.agents/rules/github.md` §2 / §6、
> `AGENTS.md` §14.2），本表由**下一个任务**在回收本任务归档时回填；
> 在此之前任务保持 `Status = REVIEW`、留在 `tasks/review/`（机制，非遗漏）。
> **禁止在本任务内自我回写**（那会造成档案与提交历史不一致）。
> 回填时九要素必须填实测值（可被 `gh api` / Tags API 复现），不得沿用档案自述；
> 无合并前独立审查档时，「审查记录」行须如实写「无（A3 断档）」，**不得补写、不得伪造**。

| 要素 | 值 |
|------|-----|
| PR | 待回填 |
| 合并策略 | rebase-merge（`AGENTS.md` §14.2 默认） |
| 提交数 | 待回填 |
| merged_at | 待回填 |
| merge_commit_sha | 待回填 |
| 合并后 CI run | 待回填 |
| 合并后 Docker run | 待回填 |
| 镜像 tag | 待回填 |
| 审查记录 | 待回填 |

## Task Rules

- [增强] **禁止**用删用例、放宽断言、跳过段落、或给 smoke 加「忽略失败」开关的方式变绿
  （`.agents/rules/github.md` §5 受保护条款）。
- [补充] 每个产品缺陷修复都必须配一条**先在未修复代码上失败**的回归断言（TASK-055 M-1 教训）。
- [补充] smoke 一律用隔离快照库；真实库只读。

## Notes

- 基线：TASK-055 于 2026-11-02 实测 168 通过 / 14 失败 / 退出码 1；分簇 6+1 / 6 / 1。
- 隔离配方见 `tasks/done/TASK-055-archive-backfill-and-email-binding-residuals/TASK.md`
  「V 组实测记录」小节。
