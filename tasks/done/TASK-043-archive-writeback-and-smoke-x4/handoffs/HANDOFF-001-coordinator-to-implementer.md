# HANDOFF-001 — 主控位 Coordinator → 执行位 Implementer

---

## Meta

```yaml
From: 主控位 Coordinator（本次审查会话）
To: 执行位 Implementer
Task: TASK-043 — D13-C 第八/第九实例归档回写 + 修正 projects/README.md 失效断言 + 修复冒烟脚本 X4 顺序缺陷
Date: 2026-10-17
Current State: ACTIVE
Previous Handoff: 无（首个交接）
```

---

## Completed Work

> 主控位已完成的部分（你**不需要**重做，但你**需要**复核其结论）。

- [x] **2026-10-17 全局只读审查**，实测得出 6 项遗留债（详见 `TASK.md` 的 Background B1–B7）。
      全部结论以 `git` / `gh` 实测为准，**未采信任何档案自述**。
- [x] **X4 缺陷机理逐行确认**（本轮新做的关键分析，**不是**沿用 TASK-041 的描述）：
      - `const pool` / `const plan` 在第 5 段「资源 CRUD」创建，**main 作用域**；
      - 在第 13 段被两个 `for` 循环 `DELETE`（`删除供应商` / `删除套餐`）；
      - 第 **17.9.1** 段仍以 `poolId: pool.json?.id` / `planId: plan.json?.id` 构造
        `richCustomer` 与 `richSub2` ⇒ `FOREIGN KEY constraint failed` ⇒ 连锁 4 项断言失败。
- [x] **受影响的 4 项断言逐一定位**（见 `TASK.md` 的 X4 技术分析节）。
- [x] 任务档案落盘 `tasks/active/TASK-043-archive-writeback-and-smoke-x4/TASK.md`，
      含 12 条 AC、File Scope、跨仓处置方案、实施计划与 5 条实操提醒。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `tasks/active/TASK-043-archive-writeback-and-smoke-x4/TASK.md` | 新增 | 任务档案（主控位设计产物） |
| `tasks/active/TASK-043-archive-writeback-and-smoke-x4/handoffs/HANDOFF-001-coordinator-to-implementer.md` | 新增 | 本文件 |

> 除上述两个新文件外，**主控位未改动任何被本任务管辖的文件**。
> 你将在此基础上继续实施。

---

## Tests

```yaml
命令: 未运行（本文件为设计阶段产物，零代码变更）
结果: 不适用
覆盖: 不适用
未覆盖: 全部验证留待执行位按 AC-1 ~ AC-11 实施
```

---

## Known Issues

- **跨仓 AC-5（需你注意）**：`projects/README.md` 位于 **Workspace 仓库**
  （`E:/NDLDSN-WORKSPACE`），而 shadcn-admin 是独立 Git 仓库 ⇒ **一个 PR 承载不了两处改动**。
  且 Workspace **本身不是 Git 仓库**。⇒ 请按 `TASK.md` 的「跨仓修改的处置方式」执行：
  修改文件 → 尝试在 Workspace 侧提交 → **若不可用则如实上报，不得自行 `git init`**。
- **行号漂移风险**：TASK-041 档案中的 `L1724`/`L1742`/`L2501`/`L2528` 是**当时的**行号。
  **必须以符号名定位**，不要照抄。

---

## Remaining Work

按 `TASK.md` 的 Implementation Plan 执行，全部 AC 均未开始：

- **Phase 1（先做，耗时最长）**：建分支 → 跑**修复前**冒烟基线（AC-9 对照用）→
  实施 X4 修复 → 同一环境复跑确认 4 项转通过。
- **Phase 2**：实查回写 TASK-041 / TASK-042 的 `Merge Record`（含 SHA 映射逐对验证）→
  `Status → DONE` + `git mv` 至 `tasks/done/`。
- **Phase 3**：处理 `projects/README.md` → 跑 AC-8 全部本地验证 →
  本任务自身档案收尾（`Status → REVIEW` + 迁 `review/`）→ 开 PR → 等 CI 双绿 → **停下**。

---

## Assumptions

> 以下是主控位做出的假设。**若某条不成立，请立即停下上报，不要自行调整范围。**

1. **`main` 仍为 `f2a63bc`**（本档案创建时的 HEAD）。若你开工时已变化，
   **先 `git fetch` + `gh pr view` 复核**；若 TASK-041/042 的档案已被他人改动，
   以你**亲眼读到的**文件为准，并在 handoff 中说明差异。
2. **X4 缺陷仍然存在**（B7 已实测）。若你发现它已被修复，
   **如实报告**并把 AC-6/AC-7 标记为「已由他方满足」，**不要**为了「有活干」而反向破坏它。
3. **`server/scripts/smoke.ts` 的段落结构未被重构**。若 17.9.1 段的符号名已变，
   以**注释标记 `// 17.9.1` 与断言文本**为准重新定位。
4. **你具备本地跑冒烟的环境**（Node/pnpm + better-sqlite3 原生模块可用）。
   若环境不可用，**第一件事就是上报**，不要伪造 AC-6/AC-9 的结果。

---

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **为让冒烟变绿而删/放宽 17.9 段断言** | 抹掉 TASK-025/028 的验收覆盖，构成自我欺骗 | R6 + AC-7 三点必查；审查时逐项对照修复前后的 `check(` 清单 |
| **把 `poolId`/`planId` 置空绕过外键** | 用例不再真正验证「已绑定客户的订阅」路径，绿但无效 | R6 明令禁止；AC-7 第 ③ 点 |
| **照抄 TASK-041 的历史行号** | 改错位置或改坏无关代码 | 用符号名定位（见本文件 Known Issues 第 2 条） |
| **回写时把「九要素」填成未经实查的值** | 档案失真，且违反 R1/R2 | 每项实跑命令；SHA 映射逐对验证，任一对失败即停 |
| **借归档回写夹带产品代码改动** | 范围蔓延，审查成本激增 | File Scope 已列 `Non-Scope`；AC-5 用 `git diff --stat` 查夹带 |
| **冒烟环境问题被误报为修复失败，或反之** | AC-6/AC-9 结论失真 | 必须在**同一隔离环境**下跑修复前/后两次；如实区分 X4 失败与环境失败 |
| **Workspace 侧改动无处提交** | AC-5 无法纳入版本控制 | 已给合规路径；**禁止自行 `git init`** |
| **纯文案提交触发多轮 CI** | 浪费审查预算 | 回写与 X4 修复合批提交（见 `TASK.md` Notes 第 5 条） |

---

## Next Action

**接收方（执行位）的第一个具体动作，按序执行：**

1. 读完 `tasks/active/TASK-043-archive-writeback-and-smoke-x4/TASK.md` 全文，
   重点是「X4 技术分析」与「跨仓修改的处置方式」两节。
2. 执行 **AC-1 前置基线**，把原始输出记下：

   ```bash
   cd E:/NDLDSN-WORKSPACE/projects/shadcn-admin
   git fetch origin && git rev-parse main origin/main && git status --short
   gh pr view 13 --json state,mergedAt,mergeCommit
   gh pr view 14 --json state,mergedAt,mergeCommit
   gh pr view 15 --json state,mergedAt,mergeCommit
   ```
3. 若基线与档案一致 ⇒ `git switch main && git pull --ff-only`，
   然后 `git switch -c chore/TASK-043-archive-writeback-and-smoke-x4`。
4. **接着立刻跑「修复前」的冒烟基线**（Phase 1 步 3）—— 这是 AC-9 的对照基准，
   **必须在改任何代码之前跑**，全量保存输出。

> **不得跳过第 4 步。** 没有修复前基线，AC-9「通过项增加、失败项减少」无法判定。

---

## References

- 任务档案：`tasks/active/TASK-043-archive-writeback-and-smoke-x4/TASK.md`（唯一事实来源）
- 待回写档案：`tasks/review/TASK-041-customer-expire-required/TASK.md`
  （X4 的原始登记在其 `Known Issues` 的 **X4** 条；`X3` 是「7 项失败为基线固有」的对照结论）
- 待回写档案：`tasks/review/TASK-042-ci-server-typecheck-and-release-gate/TASK.md`
- 待修脚本：`server/scripts/smoke.ts`（第 13 段删除点 / 第 17.9.1 段引用点）
- 待改文档：`E:/NDLDSN-WORKSPACE/projects/README.md`（第 107/117-118/134 行，**Workspace 侧**）
- 平台：PR #13 / #14 / #15；CI 最近 run `39011065238`（`f2a63bc`，success）
- 规范：`AGENTS.md` §13（DoD，含否定性断言核对）、§14（GitHub 协作）、§14.2（rebase-merge）
- 框架：`.agents/protocols/task-lifecycle.md`、`.agents/rules/github.md`