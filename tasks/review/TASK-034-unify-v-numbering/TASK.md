# TASK-034 — 统一「验证项」编号口径（V1–V5）

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-034
Title: 统一「验证项」编号口径（V1–V5）
Workflow: refactor
Status: REVIEW
Priority: P2
Owner: 主控位（本会话）
Owner Since: 2026-10-15
Assigned Role: architect（裁决）+ developer（落实）；审查由新实例 Reviewer 承担
Created: 2026-10-15T00:00:00Z
Updated: 2026-10-15T01:00:00Z
Branch: docs/TASK-034-unify-v-numbering
Requires Human Approval: false
```

---

## Objective

框架中「**V1–V5**」这一组**验证项编号**在多个文件里**承载了两个互相矛盾的定义**（详见 `Background`）。
本任务**核实**每个编号在各文件中的实际语义，**裁决**唯一口径，并把全部出现处**统一**到该口径上。

> **注意口径：** 本任务**不预设**哪一侧是「正确」的 —— 两侧都可能是原意。
> 裁决须基于「哪一侧能同时容纳既有实测结论、且不丢信息」，并**显式记录理由**。

---

## Background

- 来源：**TASK-033 归档回写时**发现（`tasks/done/TASK-033-stage3-platform-record/TASK.md` 的 `Known Issues` 10）。
  其**归档审查的 O1 / O3**（`tasks/done/TASK-033-stage3-platform-record/handoffs/2026-10-15-archive-review.md`）
  进一步澄清了两点口径，本任务据此采用：
  - ① 此前审查**并非未曾触及**编号体系 —— TASK-033 的 `2026-10-15-review.md` **O5** 曾把
    「设计方案仅 V1–V4、能力记录有 V1–V5」判为「**扩展而非冲突** → 无需处置」。
    故准确表述是「**审查者判为无冲突而漏判**」，**不是**「未捕获」。
  - ② 需**区分层次**：**同一文件内**的冲突（本表内 `github-capability.md` 的两行）与
    **跨文件**的全局不一致（本表全部行）。**后者**才是「每处单独看都自洽、单文件审查必然漏掉」的那一类。
- **冲突事实（2026-10-15 实测清点）：** 同一编号「V5」在**两个不同命题**间被混用：

  | 文件 / 位置 | V5 的定义 |
  | ----------- | --------- |
  | `shared/scripts/github_setup_checklist.md` §185–189 | **「检查运行通过后合并」→ 合并成功** |
  | `.agents/proposals/dual-agent-github-collaboration-design-v1-draft.md` §15 阶段 3（`:1281`） | **「检查全绿后所有者能否正常合并自己的 PR」** |
  | `docs/operations/github-capability.md` **§7 第 3 项**（`:213`） | **「必需检查全绿时，所有者能否正常合并自己的 PR」** |
  | `.agents/protocols/github-capability-matrix.md` **（V 表）`:160`** | **「直接推送默认分支是否确实被拒绝」** |
  | `templates/github/GITHUB-CAPABILITY.md` `:75` | **「直接推送默认分支是否确实被拒绝」** |
  | `docs/operations/github-capability.md` **§4 表 `:104`** | **「直接推送默认分支是否确实被拒绝」**（且实测证据与 **V2 行完全相同**） |
  | `docs/operations/github-capability.md` **`:149`**（首次真实交付实测表） | 把 V5 与 V4 **并列**写作「合并**被门禁拦截**（V4 / V5）」—— **第 3 种、松散用法**（与 §4 的 direct-push 义不符）。**由 TASK-033 归档审查的 O3 补充** |

- **连带问题：**
  1. 能力记录 §4 的 **V5 行与 V2 行实质重复**（同一 `GH006` 输出同时充当两行的证据，见该节「V2 / V5 的原始输出」）。
  2. 设计稿 §17.1 的「待验证项」表（`:1370–1373`）**只定义到 V4**，**没有 V5** —— 而 §15 又引用了 V5。
  3. `github_setup_checklist.md` 的 V5 期望值含「**且分支被自动删除**」，但「自动删除头分支」是**独立平台设置**
     （本项目**未启用**，且删除远端分支**未获授权**）⇒ 该期望值的**成立条件**需要澄清。
- 相关规范：`.agents/rules/github.md`、`.agents/protocols/github-capability-matrix.md`、
  `templates/github/GITHUB-CAPABILITY.md`、`shared/scripts/audit_framework.py`（A8 检查能力矩阵的强制力边界）。

---

## Scope

- **清点**框架内所有出现「V1–V5」的位置（工作空间 `.agents/**`、`templates/**`、`shared/**`，
  以及各项目 `docs/**` 中的引用），逐处记录其**实际语义**。
- **裁决**唯一编号口径：明确「V1–V5 各问什么」，并说明**为什么**这样裁决（含为何另一侧被弃用）。
- 把全部出现处**统一**到裁决后的口径；如裁决需要，可**重新编号**或**引入 V6**（须显式说明）。
- 收敛能力记录 §4 的 **V2 / V5 重复**（或明确二者不可合并的理由，如 §125 现有 note 的思路）。
- 澄清 `github_setup_checklist.md` 中 V5「分支被自动删除」的**成立条件**。

## Non-Scope

- **不改任何平台设置**（不改分支保护、不启用「自动删除头分支」）。
- **不重做任何实测** —— 本任务只统一**编号与表述**；既有实测结论（V1/V2/V3/V4 + 绿灯可合并）**一律沿用**。
- 不改业务代码与项目 `src/**` / `server/**`。

---

## Requirements

1. 给出 V 编号出现处的**完整清单**（文件 + 行号 + 原文语义）。
2. 给出**裁决**：每号一义、各号互不重复，并附理由。
3. 全部出现处按裁决**统一**（含 `templates/` 与 `.agents/` 这些**跨项目**资产）。
4. 能力记录 §4 的 V2 / V5 **重复**得到处置（合并或给出不可合并的可复核理由）。
5. `shared/scripts/audit_framework.py` 的 **A8** 仍需 PASS；如统一后需要，**同步更新**检查器
   （注意：**曾因检查器精度产生假 FAIL —— 应修扫描范围而非内容**）。
6. 若统一导致 `templates/` 变化，须确认 TASK-031 引入的「模板覆盖 10 类字段」（A13）仍成立。

---

## Acceptance Criteria

- [x] AC-1: 存在 V 编号出现处的完整清单，每处附实际语义。
- [x] AC-2: 裁决明确，且理由可复核（说明另一侧为何被弃用）。
- [x] AC-3: 全部出现处已统一；`grep -rn "V[1-5]"` 的每一处都与裁决一致（无例外）。
- [x] AC-4: `python shared/scripts/audit_framework.py` → `PASS=13 FAIL=0`；
      `python scripts/audit-repo.py`（在 shadcn-admin）→ `PASS=6 FAIL=0`。
- [x] AC-5: 本任务的 `File Scope` 之外无改动。

---

## File Scope

```yaml
File Scope:
  - .agents/proposals/dual-agent-github-collaboration-design-v1-draft.md
  - .agents/protocols/github-capability-matrix.md
  - templates/github/GITHUB-CAPABILITY.md
  - shared/scripts/github_setup_checklist.md
  - shared/scripts/audit_framework.py
  - docs/operations/github-capability.md          # 仅 shadcn-admin
  - docs/agent-collaboration.md                   # 仅 shadcn-admin（§6 落差表内的 V 引用）
  - tasks/backlog/TASK-034-unify-v-numbering/**
  # D13-C：本任务交付请求须一并补记 TASK-035 的归档回写（含目录迁移）
  - tasks/review/TASK-035-d13-route-c/**          # Status→DONE + 移 done/ + 回写 Merge Record
  - tasks/done/TASK-035-d13-route-c/**            # 迁移目标
Non-Scope (files):
  - src/**
  - server/**
  - shared/src/**
  - .github/**
```

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
| ------ | ---- | ----------- |
| AC-1 | 人工 + 机器 | `grep -rn "V[1-5]" .agents templates shared projects/shadcn-admin/docs` 逐条登记 |
| AC-2 | 人工复核 | 裁决表逐号比对理由 |
| AC-3 | 机器 | 统一后重跑同一 `grep`，逐处确认无残留旧义 |
| AC-4 | 机器 | 两审计脚本退出码为 0 |
| AC-5 | 机器 | `git diff --name-only <base>...HEAD` 与 `File Scope` 逐项比对 |

---

## Current State

> 2026-10-15 已实施完毕并提交审查：清点 → 裁决（V5 = 「绿灯可合并」阳性对照义）→ 成批统一
> → 双审计 PASS → TASK-035 归档回写（D13-C）→ 交付请求。实施记录见 `handoffs/2026-10-15-implementation.md`。
> 本任务自身亦演示 D13-C：**合并后的归档回写（Status → DONE + 移 `tasks/done/` + `Merge Record`）
> 待下一个任务补记**。

## Merge Record

**（按 D13-C，本项在下一个任务出现之前保持空白；届时由该任务的交付请求补记。）**

---

## Known Issues

- 冲突**既存在于同一文件内**（`github-capability.md` 的 §4 ⟷ §7 / `:149`），**又跨文件**
  （`.agents/**` 是**跨项目**资产，且 `templates/**`、`shared/**` 各自有一份），
  故统一必须**成批**做，否则会留下第三个口径。→ **已按裁决成批统一**（本任务交付）。
- 「V5」在工作空间**记忆文件**与**历史任务档案**中同样出现 —— 历史档案**不改**（历史记录当时准确）。
  **登记（裁决后口径声明）：** `tasks/done/**`、`handoffs/**`、`.workbuddy/memory/**` 及各 PR 描述中的
  「V5」**按其书写时点的口径理解**：2026-10-15 裁决前书写的「直推被拒」义仍指向同一实测事实
  （GH006 拒绝），该事实**本身从未失效**，只是不再占用 V5 编号（由 V1 / V2 承载）。
- 设计稿 §17.1 缺 V5、§15 却引用 V5 —— **已补齐**：§17.1 新增 V5 行 + 裁决注，与 §15 的引用就此收敛。
- **设计稿的早期论证章节（§9.4、§11 等）中的 V1–V4 语义与 §17.1 一致，属历史论证过程，未改动** ——
  它们不构成冲突（TASK-033 已核「V1/V2/V4 逐条一致」；V3 两处措辞为同义转写）。
- **裁决后的次生修正（超出清点表的连带发现，已显式披露）：** 能力记录 `:234`（2026-10-14 完成段）
  原写「⑥ V1/V2/V4/V5 实测全部成立」，但 V5 阳性对照实为 **2026-10-15** 取得 —— 属时间口径错位，
  已改为「⑥ V1/V2/V4 …（V5 属 2026-10-15，见 ⑨）」。这是统一编号时**顺带消除的失真**，非范围扩张。
- **★ 本请求期间仓库 Actions 曾被停用（2026-10-14T17:47:40Z 之后 → 2026-10-15 用户手动恢复）：**
  PR #7 的 push / `pull_request` 事件**到达了 GitHub**（事件日志有记录、第三方 App 在头提交上建了
  check suite），但 `github-actions` app **零响应**——无 check suite、无 run。实证：手动调度返回
  **HTTP 422 "Actions has been disabled for this repository."**；账户与其他仓库（`Rules`）同时段
  运行正常。用户于 2026-10-15 手动恢复后，以空提交 `e40ab0b` 重新投递，run **`38663011372` 双绿**
  （`install-lint-build` 54s / `audit` 6s），PR #7 恢复 `mergeable_state: clean`。
  ⇒ **分支上 `f701e1b`、`e40ab0b` 两个空提交均为 CI 重投递用途，无文件改动**（前者为停用期间
  的无效尝试，后者为恢复后的有效重投递）；本条即为它们的留痕。

---

## Notes

这组编号的麻烦在于：**每处单独看都自洽**，所以任何单文件审查都发现不了它 ——
TASK-033 的三轮独立审查就是例证。它是「**跨文件一致性**」类的缺陷，
与 TASK-032 的「否定性断言」同类：**没有单一权威来源，且会随文件各自演进而漂移**。
