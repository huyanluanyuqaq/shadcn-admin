# HANDOFF-001 — 主控位 Coordinator → 执行位 Implementer

---

## Meta

```yaml
From: 主控位 Coordinator
To: 执行位 Implementer
Task: TASK-044 — D13-C 第十/十一实例归档回写 + 修 README 快照失真 + 清理派单启动语
Date: 2026-10-17
Current State: ACTIVE
Previous Handoff: 无（首个交接）
```

---

## Completed Work

> 主控位已完成的部分（你**不需要**重做，但你**需要**复核其结论）。

- [x] **四项遗留的实测确认**（详见 `TASK.md` 的 B1–B4）：
      B1 TASK-043 `Merge Record` 仍待回填；**B2 TASK-045 档案根本没有 `Merge Record` 节**
      且未标注自己需回写；B3 `projects/README.md:117-118` 失真；B4 `STARTUP-PROMPT.md` 误入库。
- [x] **★ 识别出两笔回写形态不同**（本任务最易错处）：
      - **TASK-043**：`Merge Record` **已存在**，九要素待填 ⇒ **填表**；
      - **TASK-045**：`Merge Record` **不存在** ⇒ **从零新建整节** + 补「第十二实例」标注。
- [x] 预取了两笔 PR 的元数据（PR #16 → `3eebdae` / `09:13:03Z`；PR #18 → `a0e7d3f` / `12:24:35Z`）
      **仅供你开工时对照起点，仍须由你实查复核**。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `tasks/active/TASK-044-archive-writeback-and-cleanup/TASK.md` | 新增 | 任务档案 |
| `tasks/active/TASK-044-archive-writeback-and-cleanup/handoffs/HANDOFF-001-coordinator-to-implementer.md` | 新增 | 本文件 |

> 主控位**未改动任何被本任务管辖的文件**。

---

## Tests

```yaml
命令: 未运行（设计阶段产物，零代码变更）
结果: 不适用
覆盖: 不适用
未覆盖: 全部验证留待你按 AC-1 ~ AC-11 实施
```

---

## Known Issues

- **跨仓 AC-6（需你注意）**：`projects/README.md` 位于 **Workspace 仓库**
  （`E:/NDLDSN-WORKSPACE`），而 shadcn-admin 是独立 Git 仓库 ⇒ **一个 PR 承载不了两处改动**；
  且 Workspace **不是 Git 仓库**。⇒ 按 `TASK.md`「跨仓修改的处置方式」执行：
  修改文件 → 尝试提交 → **不可用则如实上报，不得自行 `git init`**。
- **★ AC-6 有时点陷阱**：README 快照须按**本任务归档后**的终态写
  （`review` 0 / `done` 43），**不是**执行过程中的中间态。否则写完即失真。

---

## Remaining Work

按 `TASK.md` 的 Implementation Plan 执行，全部 AC 均未开始：

- **Phase 1**：基线 → 建分支 → 回写 **TASK-043**（填表）→ 归档。
- **Phase 2**：回写 **TASK-045**（**新建整节** + 跨仓说明 + 补第十二实例标注 +
  删 `STARTUP-PROMPT.md`）→ 归档。
- **Phase 3**：Workspace 侧 README → AC-9 验证 → 本任务档案收尾 → 开 PR → **停下**。

---

## Assumptions

> 以下是主控位做出的假设。**若某条不成立，立即停下上报，不要自行调整范围。**

1. **`main` 仍为 `a0e7d3f`**。开工时先 `git fetch` + 复核；若已推进，
   **不要**因此改变 SHA 映射方法（仍用 `%t` tree 匹配）。
2. **TASK-045 仍无 `Merge Record` 节**。若执行位已补上，
   **如实报告**并改为「核对与补全」，**不要**重复新建造成重复节。
3. **TASK-043 的 `Merge Record` 仍是九行待填**。若已被他人回填，
   **如实报告**，不要覆盖。
4. **`STARTUP-PROMPT.md` 无外部引用**。你仍须**自己 grep 验证**（R10）——
   若发现引用，**先报告再处置**，不得强删。

---

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **把两笔回写当成同一件事做**（对045「填表」实为「新建」） | TASK-045 档案出现缺失或重复节 | R6 + 档案「关键差异」表；开工前先 `grep -n "^## "` 两个档案 |
| **假设 post 侧 = 当前 main** | SHA 映射全错 | 用 `%t` tree 匹配 + `merge-base --is-ancestor`；main 还会继续推进 |
| **误把 `mergeable=UNKNOWN` 当未合并** | 错误上报 | R3 明确：以 `state/mergedAt/mergeCommit` 为准 |
| **README 写中间态** | 写完即失真 | AC-6 明确要求按归档后终态撰写 |
| **为「补全规范」而改 `handoff.md`** | 越界，且 TASK-045 刚落地 | Non-Scope 明列；只读不动 |
| **强删 `STARTUP-PROMPT.md` 造成断链** | 档案引用失效 | R10：先 grep 确认无引用 |
| **夹带产品代码改动** | 审查成本激增 | File Scope + AC-8 用 `git diff --name-only` 自证 |
| **跑无关的 `pnpm test` / 冒烟** | 浪费时间且引入噪声 | AC-9 只要求两个审计脚本；Notes 第 4 条已说明理由 |

---

## Next Action

**接收方（执行位）的第一个具体动作，按序执行：**

1. 读完 `tasks/active/TASK-044-archive-writeback-and-cleanup/TASK.md`，
   重点是「**关键差异：两笔回写的形态不同**」与「跨仓修改的处置方式」两节。

2. 执行 **AC-1 前置基线**，把原始输出记下：

   ```bash
   cd E:/NDLDSN-WORKSPACE/projects/shadcn-admin
   git fetch origin
   git rev-parse main origin/main      # 期望 a0e7d3f（两处）
   git status --short                 # 期望为空
   gh pr view 16 --json state --jq .state   # 期望 MERGED
   gh pr view 18 --json state --jq .state   # 期望 MERGED
   ```

3. **先做结构侦查**（这决定你走「填表」还是「新建」）：

   ```bash
   grep -n "^## " tasks/review/TASK-043-archive-writeback-and-smoke-x4/TASK.md | grep -i merge
   grep -n "^## " tasks/review/TASK-045-review-record-naming/TASK.md | grep -i merge
   ```

   预期：第一条**有**输出（043 有该节），第二条**无**输出（045 没有该节 ⇒ 须新建）。

4. 若基线一致 ⇒ `git switch main && git pull --ff-only`，然后
   `git switch -c chore/TASK-044-archive-writeback-and-cleanup`，进入 Phase 1。

> **不得跳过第 3 步。** 两笔回写形态不同，跳过结构侦查极易对 TASK-045 做错操作。

---

## References

- 任务档案：`tasks/active/TASK-044-archive-writeback-and-cleanup/TASK.md`（唯一事实来源）
- 待回写：`tasks/review/TASK-043-archive-writeback-and-smoke-x4/TASK.md`（**填表**）
- 待回写：`tasks/review/TASK-045-review-record-naming/TASK.md`（**新建整节**）
- 体例参考：`tasks/done/TASK-042-ci-server-typecheck-and-release-gate/TASK.md`（`Merge Record` 范例）
- 待删：`tasks/**/STARTUP-PROMPT.md`
- 待改：`E:/NDLDSN-WORKSPACE/projects/README.md` 第 117-118 行（**Workspace 侧**）
- 模板仓库：`E:/NDLDSN-WORKSPACE/projects/_workspace-template`（**无远端**，提交 `aa38119`）
- 规范：`AGENTS.md` §13（DoD，含否定性断言核对）、§14.2（rebase-merge）、
  `.agents/protocols/handoff.md` **§3.2（TASK-045 刚落地，本次只读）**