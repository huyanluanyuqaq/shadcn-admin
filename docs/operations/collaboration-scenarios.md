# 协作场景验证清单（collaboration-scenarios）

> **目的：** 把「这套协作体系可用」从**断言**变成**可复核结论**。
> 单任务的 AC 核对只能证明「这个任务做对了」，不能证明「换一个场景制度还成立」。
>
> **用法：** 每个场景列出**判据**（可指认文件或可执行命令）与**结论等级**。
> 结论等级只有三档，**不允许写「基本满足」这类中间态**：
>
> | 等级 | 含义 |
> |------|------|
> | **已验证** | 有真实任务实例走过该路径，且判据可在仓库内复核 |
> | **纸面满足** | 制度有明确条款与承载文件，但从未有实例走过 |
> | **缺口** | 制度或工具不支持该场景，需另立任务 |
>
> 本清单由 TASK-056 建立。**每次结论变更须注明日期与依据任务号**，不得静默改写。

---

## 场景 A — 普通功能开发全链路

**路径：** 主控位登记 → 执行位开发 → 交付请求 → 审查 → CI → 合并。

| 项 | 内容 |
|----|------|
| 判据 | ① `tasks/**/TASK.md` 的 Status 与目录一致；② 存在 PR 且关联任务号；③ 必需检查在 PR 上运行且为绿；④ `handoffs/` 有审查结论文件；⑤ `Merge Record` 含九要素实测值 |
| 承载文件 | `docs/agent-collaboration.md` §3；`.agents/protocols/github-collaboration.md`；`templates/github/PULL_REQUEST_TEMPLATE.md` |

**实例复核：**

```bash
gh pr view 27 --json number,state,mergedAt,files --jq '{number,state,mergedAt,files:(.files|length)}'
gh api repos/huyanluanyuqaq/shadcn-admin/pulls/27/reviews --jq 'length'
```

**本次结论：已验证（进程层面），但暴露一处口径落差。**
TASK-054 走完了全链路（PR #27，9 个提交，rebase-merge 落地，合并后 CI `41376188754` + Docker `41376188853` 均 success）。
**但 `pulls/27/reviews` 返回 `0`** —— 审查结论全部落在 `handoffs/**`，平台上没有任何 review 记录。
⇒ 后果：M3/M5 两个度量在本仓库**平台侧不可计算**，只能从 `handoffs/` 反推。此落差已写入
`collaboration-metrics.md` §2 的 M3/M5 口径注。

---

## 场景 B — 两个 Developer 并行开发不同模块

**路径：** 两个执行位各持独立分支，File Scope 互斥，互不等待。

| 项 | 内容 |
|----|------|
| 判据 | ① 两份 `TASK.md` 的 `File Scope` 交集为空；② 两条远端分支并存；③ 两个 PR 均可在对方未合并时通过 CI；④ `Owner` 字段互不重叠 |
| 承载文件 | `.agents/protocols/collaboration.md` §2（四层轻量机制）、§7（并行度建议）；`docs/agent-collaboration.md` §7 |

**本次结论：纸面满足（未演练）。**
制度具备全部要件（Task Ownership / File Scope / 分支隔离 / Status），但本仓库至今**所有任务都是串行**：
任一时刻 `tasks/active/` 只有 1 个任务。因此「并行度 2」从未被真实检验，
包括「两个 PR 同时等待必需检查」「后合并者需 rebase」这两个必然出现的摩擦点。

> **不得据此宣称体系支持并行** —— 只能说「制度允许，未经演练」。

---

## 场景 C — 两个任务修改同一公共文件

**路径：** File Scope 重叠 → 串行化或有依赖关系的拆分。

| 项 | 内容 |
|----|------|
| 判据 | ① 重叠被显式登记（`Dependencies` 或 `Non-Scope`）；② 后一任务在**前一任务的分支或已合并的 main** 上作业；③ 有记录说明为何不并行 |
| 承载文件 | `.agents/protocols/collaboration.md` §3（冲突处理矩阵）、§5（Shared Files） |

**实例复核：**

```bash
grep -n "server/src/routes/resources.ts" tasks/done/TASK-053-*/TASK.md tasks/done/TASK-054-*/TASK.md
```

**本次结论：已验证（串行化路径），并行协调路径未验证。**
TASK-053 与 TASK-054 的 File Scope 均含 `server/src/routes/resources.ts`（邮箱绑定路由）。
实际处置是**串行**：054 在 053 的未提交改动之上作业，而非并行后合并。
⇒ 制度中「重叠则串行化」这一支被验证；「重叠但需并行」的另一支从未发生，
其风险（同文件双改、语义冲突）**仍属未知**。

---

## 场景 D — Agent 中途退出

**路径：** 执行位完成部分工作后停止，另一实例据 Issue/分支/PR/Handoff 接手。

| 项 | 内容 |
|----|------|
| 判据 | ① 该任务 `handoffs/` 存在**多份**交接记录；② 最新 Handoff 的 `Next Action` 具体可执行；③ `TASK.md` 的 `Current State` 与 `Changed Files` 反映实际进度；④ 分支已推送（非仅本地） |
| 承载文件 | `.agents/protocols/handoff.md`（必填字段、交接时机、检查清单） |

**实例复核：**

```bash
ls tasks/done/TASK-051-backup-residual-closure/handoffs | wc -l   # 实测 10
git ls-remote --heads origin
```

**本次结论：已验证。**
TASK-051 留下 10 份交接/审查记录，跨多轮整改与一次环境性失败（CI 镜像滚动），
任务在不依赖聊天上下文的情况下被推进到合并。这是本体系最扎实的一环。

---

## 场景 E — 审查失败后整改重提

**路径：** Reviewer 出 `REQUEST_CHANGES` → Developer 定位、修改、重提 → 复审。

| 项 | 内容 |
|----|------|
| 判据 | ① 审查记录明确列出**阻断项编号**；② 整改提交逐条响应编号；③ 复审记录明确写「已闭合」并给出复核方式；④ 阻断项关闭**经复核**，而非仅标记已解决 |
| 承载文件 | `docs/agent-collaboration.md` §3 阶段 8–9；`.agents/protocols/handoff.md` §3.2（审查记录命名） |

**实例复核：**

```bash
grep -nE "FAIL|PASS（有条件）" tasks/done/TASK-053-*/handoffs/2026-11-02-review.md
```

**本次结论：已验证。**
`2026-11-02-review.md` 第 157 行给出 `FAIL（CHANGES_REQUESTED）` + 阻断项 R1/R2，
第 381 行给出 `PASS（有条件）` 并指明 R1 已闭合、8 项门禁 `exit=0`。
⇒ 「FAIL → 整改 → 复审 PASS」在同一份审查记录内形成闭环，可复核。

---

## 场景 F — 主分支前进后同步开发分支

**路径：** 其他 PR 合并 → 当前分支需 rebase/merge `main` → 重跑检查。

| 项 | 内容 |
|----|------|
| 判据 | ① 分支能干净 rebase 到最新 `main`；② rebase 后必需检查重跑并转绿；③ **rebase 改写的 SHA 在文档中的引用被同步更正** |
| 承载文件 | `docs/git-workflow.md` §1/§4；`.agents/rules/git.md` §6（禁改写已推送历史 —— 与 rebase 的张力需按 `change-safety.md` 处理） |

**本次结论：流程可用，但存在一处**未被制度覆盖**的副作用 —— SHA 引用失效。**
`rebase-merge` 会改写**全部** SHA：TASK-051~054 的审查记录中引用的 `767c149`/`8caab4f`/`be7c2f2`/`074e557`/`51b7c04`/`bee2610`/`07e5217`
在当前仓库中**已不存在**。TASK-055 因此在三份档案中各补了一张「审查时 SHA → main 上 SHA」映射表。

> **缺口：** 制度只要求「合并后回写 Merge Record」，未要求「合并导致 SHA 失效时补映射表」。
> 现状是靠执行位自觉。**建议另立任务**把「SHA 映射表」写入 `templates/task/TASK.md` 的 Merge Record 段。

---

## 场景 G — 高风险任务（数据库迁移 / 破坏性操作）

**路径：** 额外审批 + 额外验证 + 人类显式授权后才合并。

| 项 | 内容 |
|----|------|
| 判据 | ① `TASK.md` 的 `Requires Human Approval: true`；② 审查记录出现「等人类显式授权」的中间态；③ 存在回滚方案；④ 破坏性操作有可复现的验证用例（而非人工点击） |
| 承载文件 | `.agents/protocols/change-safety.md`；`.agents/protocols/permissions.md` §8；`docs/operations/backup-restore.md` |

**实例复核：**

```bash
grep -n "人类\|授权" tasks/done/TASK-050-backup-import-and-restore/TASK.md | head
```

**本次结论：已验证。**
TASK-050（备份导入/恢复，含覆盖现库的破坏性路径）在档案中留下完整的中间态：
`CHANGES_REQUESTED` → 主控位复审 PASS → I2 独立审查 PASS → **等人类显式授权** → 人类授权后由主控位执行合并。
且回滚判据被写成常驻用例（`restore-check` E 段），而非依赖人工确认 —— 这是高风险场景的正确形态。

---

## 汇总

| 场景 | 结论等级 | 依据 | 待办 |
|------|---------|------|------|
| A 普通功能全链路 | 已验证（进程）/ 平台 review 为空 | PR #27、`pulls/27/reviews=0` | 度量口径已注明从 `handoffs/` 反推 |
| B 双人并行 | **纸面满足（未演练）** | `tasks/active/` 至今恒为 1 | 首次并行时按本清单判据复核 |
| C 同文件双改 | 已验证（串行支）/ 并行支未验证 | TASK-053/054 共用 `resources.ts` | 无 |
| D Agent 中途退出 | 已验证 | TASK-051 的 10 份交接 | 无 |
| E 审查失败整改 | 已验证 | TASK-053 review FAIL→PASS | 无 |
| F 主分支前进 | 流程可用 / **SHA 引用失效属缺口** | rebase-merge 后 7 个 SHA 不可达 | 建议把 SHA 映射写进 TASK 模板 |
| G 高风险任务 | 已验证 | TASK-050 的授权链 | 无 |

**结论：** 7 个场景中 **5 个已验证**、1 个纸面满足、1 个部分验证并暴露缺口。
**「体系支持多 Agent 并行」目前仍是未经验证的假设**，不得作为既成事实引用。
