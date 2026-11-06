# TASK-065 — 为审计脚本门禁建立不随同步覆盖的外部锚点

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-065
Title: 为审计脚本门禁建立不随同步覆盖的外部锚点
Workflow: feature
Status: ACTIVE
Priority: P1
Level: L
Owner: "Developer"
Owner Since: "2026-11-06T23:09:00+08:00"
Assigned Role: developer
Created: 2026-11-06
Updated: 2026-11-06
Branch: "feat/TASK-065-gate-external-anchor"
Requires Human Approval: true
```

> **Level 判定为 L 的理由：** 需改动 CI 作业结构（`AGENTS.md` §14.1 的启用顺序约束）、
> 跨两个 Git 仓库、且涉及安全门禁的基线固化 → 符合 L 判据「跨模块」+「需独立审查」。
> **`Requires Human Approval: true`**：新增或改动 CI 门禁作业属基础设施变更，
> 且需先落地、稳定上报、再加入必需检查，全过程须人类知情。

---

## Objective

建立一个**不随 `sync-framework.py` 被覆盖**的校验锚点，使「已批准的密钥门禁基线被回退」
这一风险可被真正检出，从而闭合 TASK-064 审查（Reviewer R-2 / Security S-1）指出的残留路径。

---

## Background

TASK-064 新增了 A14「审计脚本与中央仓权威副本逐字节一致」。但两份独立审查
（`tasks/active/TASK-064-gate-fixes-and-authority-alignment/handoffs/2026-11-06-review.md`
与 `...-security-review.md`）独立复现了同一结构性缺陷：

**A14 的检查逻辑位于被同步覆盖的同一文件内。** `sync-framework.py` 的
`SYNC_SCRIPTS = ["audit-project.py"]`，复制方式为 `shutil.copy2` **全量覆盖**。
因此一旦执行同步（或中央仓被回退）：

- 新脚本连同 A14 一起被换成旧版 → **A14 不存在，无需报警**；
- 旧版中 `sk-[A-Za-z0-9]{24,}` 位于 `SECRET_PATTERNS_SUSPECT` → **A6 由 FAIL 静默降为 WARN**；
- 实测（主控位已复现）：中央仓 `origin/main`（`7c0e49b`）的脚本中 `a14`/`A14` 出现次数为 **0**；
- 最终全仓 `FAIL=0 / exit 0`，**无任何检查报警**。

且 A14 对**自身被篡改**同样不设防：从 `CHECKS` 移除 `a14_script_consistency`，或把其 FAIL
分支改为恒真，均无人报警。

TASK-064 已按人类裁决（2026-11-06）**只订正表述、不建锚点**，将该风险单独立为本任务。
在锚点落地前，Security 侧明确「不认为 R-2 的核心风险已消除」。

---

## Scope

设计并落地一个外部锚点。候选方案（由 Developer 评估后选定，或提出更优方案，但必须满足 §Constraints）：

| 方案 | 做法 | 特点 |
|---|---|---|
| **A. CI 侧独立哈希校验** | 在 `.github/workflows/` 新增一个作业，用**不来自仓库内脚本**的硬编码期望哈希（或来自受保护 Secret 的哈希）校验 `shared/scripts/audit-project.py` | 最强：校验逻辑不在被校验文件内，也不随同步覆盖 |
| **B. 受保护基线哈希文件** | 把已批准基线的 SHA-256 写入一个**不参与同步**的受保护文件，由某个不位于 `audit-project.py` 内的检查读取比对 | 中等：需确保该文件不在 `SYNC_SCRIPTS`/同步范围内 |
| **C. 双仓交叉校验** | CI 中显式 checkout 中央仓指定 ref，与项目脚本比对 | 受 CI 凭据与网络限制，且中央 ref 本身可被改，强度最低 |

**无论选哪种，都必须同时覆盖两种回退路径**：① 同步执行后两侧同时回退；② 针对校验逻辑自身的篡改。

### 方案选定（Developer，2026-11-06）

**选定：方案 A（CI 侧独立哈希校验），并做两点强化，构成「A+」。**

| 强化 | 内容 | 作用 |
|---|---|---|
| **双址登记 + 交叉校验** | 期望哈希同时登记在 `.github/workflows/gate-anchor.yml`（`EXPECTED_AUDIT_SCRIPT_SHA256`）与 `.github/gate-anchor-baseline.txt`；校验器强制两处与脚本三方一致 | 单独篡改任一处即 FAIL（探针 P5 / P6 实证） |
| **见证作业 `anchor-witness`** | 新增于 `ci.yml`（与锚点作业**不同文件**），监视锚点作业在位性、配置完好性与校验逻辑登记哈希 | 「移除锚点作业」（P4）与「校验逻辑改恒真」（P7）获得可观察的失败信号 |

**为何不选 B / C：**

- **B（受保护基线哈希文件）已作为强化项并入**（基线文件即 B 的机制）。单独使用 B 时，「读取比对的检查」若仍位于仓内普通文件，强度不高于本方案；本方案以「工作流 + 基线文件」双址取得同等级独立性，且不引入第二套维护口径外的第三个比对点。
- **C（双仓交叉校验）强度最低**（任务书自评）：中央 ref 本身可被改、CI 需凭据访问中央仓、且存在「中央已合并新版本而项目侧尚未更新」的窗口期假红。本方案以双址登记达成同目标而不引入跨仓凭据与窗口期。

**为何满足 Requirements 1 / 2：**

- **R1（校验逻辑不得位于被校验文件内）**：逻辑在 `.github/workflows/gate-anchor.yml` 与
  `shared/scripts/gate_anchor_check.py`，均不在 `shared/scripts/audit-project.py` 内。
  实证：删除 / 篡改被校验脚本后，锚点仍运行并给出预期信号（探针 P1 / P2，见 HANDOFF-002 §4）。
- **R2（锚点自身不得随同步被覆盖）**：`sync-framework.py` 只写 `.agent-framework/**`、
  `framework-version.json` 与 `shared/scripts/audit-project.py`（`SYNC_SCRIPTS = ["audit-project.py"]`，
  中央 main 实测）。锚点三文件均不在其列；`gate_anchor_check.py` 虽位于 `shared/scripts/`
  （File Scope 授权位），但**显式排除于 `SYNC_SCRIPTS` 之外，登记于此**。实证：dry-run 与
  真实同步前后锚点文件字节不变（探针 P8）。

## Non-Scope

- 不修改 A14 的现有判据（A14 保留，作为「两仓工作树不一致」的检出手段）
- 不改动 A1–A13 的任何判定
- 不动业务代码、不动 `ci.yml` 现有作业的触发条件
- 不重新设计 `sync-framework.py` 的同步范围

---

## Requirements

1. **校验逻辑不得位于被校验的文件内。** 这是本任务的核心约束——若锚点的实现仍在
   `shared/scripts/audit-project.py` 中，则与 A14 同病，不构成有效锚点。
2. **锚点自身不得随同步被覆盖。** 若方案涉及仓库内文件，该文件必须显式排除在
   `sync-framework.py` 的同步范围之外，并在档案中登记该排除。
3. 锚点必须能检出「已批准的密钥门禁基线被回退」，且**判据可机械复现**（注入缺陷 → 实跑 → 恢复 → 复跑）。
4. 按 `AGENTS.md` §14.1 的启用顺序：**先在默认分支落地作业并确认它确实上报状态，再加入必需检查**。
   顺序颠倒会使所有 PR 永久等待一个不存在的作业，而 `enforce_admins=true` 没有绕过通道。
5. 不得以「关闭检查」「放宽断言」「伪造结果」任何方式使门禁变绿（`quality.md` 二 §5、`github.md` §4 受保护）。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 只用 GitHub Actions 现有能力与标准库；不引入新的 Secret 除非人类批准 |
| 安全 | 锚点的期望哈希/基线一旦写入，其变更本身必须可追溯（提交历史 + 档案登记） |
| 兼容 | 现有 64 个任务档案、3 个 L 级档案必须全部通过；CI 现有四作业不得被破坏 |
| 流程 | 禁止直推 `main`；中央规范仓与 `shadcn-admin` 均走 PR |
| 顺序 | 若锚点在 CI 中，必须先合并落地、观察至少一次成功上报，再由主控位加入必需检查集 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-064 整改完成并复审通过 | blocks | **已完成**（2026-11-06 主控位合并；`handoffs/2026-11-06-rereview.md` Reviewer 位结论 **PASS**、`handoffs/2026-11-06-security-rereview.md` Security 位结论**通过**，均为不随身整改上下文的独立复审） |
| 中央规范仓 PR #1 合并 | blocks | **已完成**（2026-11-06 合并，merge commit `33ed636`；中央 `origin/main` 现为已批准版脚本，与项目侧逐字节一致，sha256 `7eba9268a9b29554f242c159f1345abc46d2b50384cabea5f73c8f72d9fa463f`） |
| 人类批准新增 CI 门禁作业 | external | **已批准（2026-11-06，范围=实现锚点并落地作业，即本 PR）**；**加入必需检查集未批准** —— 按硬约束列为合并后由主控位单独执行的步骤（AC-5 不由本 PR 完成） |

> 若存在未满足的 `blocks` 依赖 → 本任务不得进入 `ACTIVE`。

---

## Acceptance Criteria

- [x] AC-1: 锚点的校验逻辑**不在** `shared/scripts/audit-project.py` 内（可用「删除/篡改该脚本后锚点仍生效」实测）（实证：探针 P1 / P2 —— 删除 / 篡改脚本后锚点仍运行并给出预期信号，见 HANDOFF-002 §4）
- [x] AC-2: 锚点能检出「同步执行后两侧同时回退」—— 探针：两侧脚本同时置为中央 `origin/main`（`7c0e49b`）后，锚点报 FAIL（实证：探针 P3 —— 真实 `sync-framework.py` 回退端到端，锚点 FAIL；回退态旧脚本无 A14 且 exit 0）
- [x] AC-3: 锚点能检出「自身被篡改」—— 探针：移除锚点作业、或篡改其期望哈希，均有可观察的失败信号（实证：探针 P4 / P5 / P6 / P7；三重一致篡改的残留已登记于 Known Issues #5）
- [x] AC-4: 锚点本身不被 `sync-framework.py` 覆盖（实测：执行 dry-run 与真实同步后，锚点相关文件字节不变）（实证：探针 P8 —— dry-run 与真实同步前后锚点文件字节不变）
- [ ] AC-5: 作业已在默认分支落地并**至少一次成功上报**，且已被主控位加入 `required_status_checks`（**合并后步骤，本项留空不勾**：本 PR 完成「落地」，上报情况由合并后的 `main` push 运行实证；加入必需检查集按硬约束由主控位单独执行、须人类再次批准，且必须遵守 §14.1 的先后顺序）
- [x] AC-6: `python shared/scripts/audit-project.py` 实跑 exit 0 且 FAIL=0；`check-traceability.py` PASS（实跑：`PASS=12 FAIL=0 WARN=2 SKIP=0` / exit 0；traceability PASS）
- [x] AC-7: 层 1 档案载明：选定方案及理由、期望哈希/基线的来源与变更方式、与 A14 的职责分工（见 §Scope「方案选定」与 Known Issues）
- [x] AC-8: TASK-064 审查中指出的「Objective/C18 表述过强」已由 TASK-064 整改闭环，本任务不得再引入同类超出判据能力的断言（残留能力边界已如实登记，未引入超出判据能力的断言）

---

## File Scope

```yaml
File Scope:
  - .github/workflows/**                # 新增锚点作业（若选方案 A/C）
  - shared/scripts/**                   # 仅当锚点需要辅助脚本且该脚本被显式排除出同步范围
  - agent-framework/shared/scripts/sync-framework.py   # 仅中央仓：登记同步范围排除（若方案 B）
  - tasks/active/TASK-065-*/**          # 本任务档案自身
  - tasks/active/TASK-064-*/**          # 回写「风险已闭合」的事实（仅在 AC-1~AC-4 达成后）
Non-Scope (files):
  - shared/scripts/audit-project.py     # 本任务不改其判定（A14 保留原样）
  - .agent-framework/**                 # 只读副本，由同步机制更新
  - src/**  server/**  shared/src/**  package.json  pnpm-lock.yaml
  - framework-version.json              # 本任务不是框架版本发布
```

---

## Implementation Plan

> 由 Developer 在执行中补充与更新。

**执行状态（2026-11-06）：步骤 1–5 已完成。** 步骤 6–7 为**合并后由主控位执行**的步骤 ——
按硬约束，加入必需检查集须人类再次批准且遵守 `AGENTS.md` §14.1 的落地顺序，不由本 PR 完成
（AC-5 因此留空不勾）；「回写 TASK-064 档案登记风险已闭合」同样以锚点生效（合并 + 稳定上报）
为前提，合并前写入即超出判据能力的断言（AC-8），列为合并后步骤。

1. 领取任务（写 `Owner` / `Owner Since`、`Status` 改 `ACTIVE`、目录移入 `tasks/active/`）
2. 评估三个候选方案，在档案中记录选定理由（含为何满足 Requirements 1/2）
3. 实现锚点；确保其不在同步范围内
4. 做 AC-2 / AC-3 的回退与自篡改探针（隔离环境，仓库内零残留）
5. 推送 → 开 PR → 移交 Reviewer + Security 双审
6. 合并落地 → 观察至少一次成功上报 → 由主控位加入必需检查集（AC-5）
7. 回写 TASK-064 档案，登记「风险已闭合」及其判据

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 | 探针 | 删除或篡改 `audit-project.py` 后，锚点仍能运行并给出预期信号 |
| AC-2 | 探针 | 两侧脚本同时置为 `7c0e49b` → 锚点 FAIL |
| AC-3 | 探针 | 移除锚点作业 / 改期望哈希 → 有可观察失败 |
| AC-4 | 实跑 | `sync-framework.py --dry-run` 与真实同步前后，锚点文件 `cmp` 不变 |
| AC-5 | 平台 | `gh api .../branches/main/protection/required_status_checks` 含新作业；`gh run list` 有成功记录 |
| AC-6 | 自动 | `python shared/scripts/audit-project.py`、`python scripts/check-traceability.py --base origin/main` |
| AC-7 / AC-8 | 目视 | 层 1 档案完整、无超出判据能力的断言 |

---

## Current State

**实施完成，待双重审查（2026-11-06，Developer）。** 方案 A+ 已落地：锚点作业 `gate-anchor`（新工作流）+ 见证作业 `anchor-witness`（ci.yml）+ 校验器 `shared/scripts/gate_anchor_check.py` + 基线文件。四步实测 10 组探针 （AC-1~AC-4 全覆盖，含真实同步回退端到端与三类自篡改）全部符合预期，原始输出见 `handoffs/HANDOFF-002-developer-to-reviewer-and-security.md` §4。

**未完成（合并后步骤，不由本 PR 承担）：** ① 加入必需检查集（AC-5，须人类再次批准）；② 回写 TASK-064 档案登记「风险已闭合」（以锚点合并并稳定上报为前提）。

---

## Changed Files

> 由 Developer 维护。

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `.github/workflows/gate-anchor.yml` | 新增 | 锚点作业 `gate-anchor`：期望哈希登记 + 调用校验器（三方一致性） |
| `shared/scripts/gate_anchor_check.py` | 新增 | 锚点校验逻辑（执行体）；位于 File Scope 授权位，显式排除于 `SYNC_SCRIPTS` |
| `.github/gate-anchor-baseline.txt` | 新增 | 基线哈希 + 来源 / 变更方式登记（与工作流期望哈希交叉校验） |
| `.github/workflows/ci.yml` | 修改 | 新增 `anchor-witness` 作业（监视锚点在位性 / 配置 / 逻辑哈希）；现有四作业未动 |
| `tasks/active/TASK-065-gate-external-anchor/TASK.md` | 修改 | 领取、方案选定与理由、执行状态、AC、探针回写、Known Issues、Handoff #002 |
| `tasks/active/TASK-065-gate-external-anchor/handoffs/HANDOFF-002-developer-to-reviewer-and-security.md` | 新增 | 实施记录、四步实测原始输出与移交（双审入口） |

---

## Known Issues

1. **〔已解除，2026-11-06〕中央规范仓 PR #1 未合并前，本任务的地基不稳。** 中央 `origin/main` 仍是回退前脚本
   （`7c0e49b`），任何以「中央仓主线」为基准的锚点都会把当前修正版判为漂移。
2. **新增必需检查有自锁风险。** `AGENTS.md` §14.1 明确：作业必须先存在于默认分支并确认
   稳定上报，再加入必需检查；`enforce_admins=true` 无绕过通道。顺序颠倒会卡死所有 PR。
3. **期望哈希的维护成本。** 每批准一次 `audit-project.py` 的变更，锚点的期望值都需同步更新；
   若更新流程不顺畅，锚点会从「安全网」变成「摩擦源」。需在档案中写明更新方式。
4. **方案 C（双仓交叉校验）强度最低**：中央 ref 本身可被改，且 CI 需凭据访问中央仓。仅在 A/B 均不可行时选用，且须登记其局限。
5. **三重一致篡改没有仓内机械信号（已实证，如实登记）。** 把工作流期望哈希、基线文件与脚本
   **三处一起**改成旧版时，锚点与见证全绿（探针 P6''）。仓内无法区分「协调的多点篡改」与
   「合法的基线更新」——后者本就要求三处同改。缓解：① 该组合在 PR diff 中完整可见
   （脚本回退 + 两处哈希变更），依赖人类审查；② 合并后 `required_status_checks` 补上
   「移除即阻断」一层；③ 基线变更必须登记于本档案（Constraints：可追溯）。
   **不得声称本锚点可防协同篡改。**
6. **锚点与见证作业均未加入必需检查集（硬约束）。** 加入须人类再次批准，且必须遵守
   `AGENTS.md` §14.1「先落地并稳定上报，再加入」的顺序；顺序颠倒会使所有 PR 永久等待
   不存在的作业，而 `enforce_admins=true` 无绕过通道。AC-5 因此列为合并后步骤。
7. **`gate_anchor_check.py` 与同步目标同目录。** 它位于 `shared/scripts/`（File Scope 授权位），
   与 `audit-project.py` 同目录但不在 `SYNC_SCRIPTS` 列（显式排除，登记于 §Scope 方案选定）。
   若未来 `SYNC_SCRIPTS` 被扩展到它，锚点逻辑可被同步覆盖 —— 见证作业的登记哈希可检出该变化
   （FAIL），且扩展 `SYNC_SCRIPTS` 本身须走中央仓 PR 与审查。
8. **期望哈希的维护成本（原 KI #3 的落实）。** 每次批准 `audit-project.py` 变更，须在**同一 PR**
   更新两处登记（工作流 env + 基线文件）；校验器强制一致，漏改即 FAIL（失败方向安全）。
   变更来源与批准记录须登记于本档案。
9. **本地探针台在 OS 临时目录。** `E:\AiData\tmp` 本会话实测不可写（Access denied），
   探针台用 `C:\Users\Admin\AppData\Local\Temp\TASK-065-anchor\`（仓库外，仓库内零残留）。


---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | coordinator | developer | 2026-11-06 | 派单：为审计脚本门禁建立不随同步覆盖的外部锚点 |
| 002 | developer | reviewer + security（双重审查） | 2026-11-06 | 实施完成：A+ 方案落地，四步实测 10 组探针全部符合预期；移交给不携带实现上下文的双重审查，记录见 `handoffs/HANDOFF-002-developer-to-reviewer-and-security.md` |

**Next Action：** 等待依赖解除。依赖满足后，Developer 领取任务（写 `Owner` / `Owner Since`、
`Status` 改 `ACTIVE`、目录移入 `tasks/active/`），从最新 `main` 派生分支，按 Implementation Plan 实施。

---

## Merge Record

> 本节由合并前按 `github.md` §5 实测填入（同一 PR 内自填，不延后、不回溯补写）。
> 合并后才存在的字段在合并时点不可得，按既定先例显式标注「合并后实测回填」。

| 要素 | 值 |
|------|-----|
| PR | [#55](https://github.com/huyanluanyuqaq/shadcn-admin/pull/55)，分支 `feat/TASK-065-gate-external-anchor`；`state=OPEN`；提交数不预写死，合并前以 `git rev-list --count origin/main..HEAD` 实测为准（开 PR 时为 3 提交） |
| 合并策略 | rebase-merge（`AGENTS.md` §14.2 默认） |
| 提交数 | 合并前以 `git rev-list --count origin/main..HEAD` 实测填入（不预写死；开 PR 时为 3） |
| merged_at | 合并后实测回填 |
| merge_commit_sha | 合并后实测回填（全 40 位） |
| 合并后 CI run | 合并后实测回填 |
| 合并后 Docker run | 合并后实测回填 |
| 镜像 tag | 合并后实测回填（`sha-<短SHA>`） |
| 审查记录 | **移交时点：无。** Reviewer 位与 Security 位双重审查待出具；合并前按实测填入 `handoffs/YYYY-MM-DD-review.md` / `YYYY-MM-DD-security-review.md`，无则如实写「无」，不补写 |

**PR 侧 CI 实证（2026-11-06，`gh pr checks 55` 实测）：** 六作业全 pass ——
`install-lint-build` 1m32s / `audit` 6s / `traceability` 5s / `smoke` 21s /
**`gate-anchor` 4s** / **`anchor-witness` 6s**（Continuous Integration run `42243671611`；
`gate-anchor` 由 Gate Anchor 工作流 run `42243671660` 上报）。即锚点与见证作业**已随本 PR
落地并在 PR 侧成功上报**；按 `AGENTS.md` §14.1，加入必需检查集仍为合并后由主控位单独执行
的步骤（须人类再次批准），本段不构成「已入必需检查」的陈述。

---

## Task Rules

- [增强] 本任务改动**安全相关门禁的基础设施**。按 `AGENTS.md` §10，除 Reviewer 位独立审查外
  **还须经 Security 角色审查**；且 `Requires Human Approval: true`，新增 CI 门禁作业须人类批准。
- [补充] 锚点的校验逻辑不得位于被校验文件内（Requirements 1）；违反即视为未完成。
- [补充] 不得以任何方式使检查变绿（关闭检查、放宽断言、伪造结果）。

---

## Notes

- 派单背景：TASK-064 的 A14 被两份独立审查证实为**自引用检查**——检查逻辑在被同步覆盖的
  同一文件内，无法检出「同步回退」与「自身篡改」。人类 2026-11-06 裁决：TASK-064 只订正
  表述，外部锚点单独立本任务。
- 本任务与 TASK-064 的关系：TASK-064 负责「把话说准」，本任务负责「把风险真正堵上」。
  两者都完成后，才能在档案中写「R-2 已闭合」。
