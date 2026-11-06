# TASK-064 — 修正审计脚本门禁缺陷并对齐权威副本

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-064
Title: 修正审计脚本门禁缺陷并对齐权威副本
Workflow: bugfix
Status: CHANGES_REQUESTED
Priority: P0
Level: L
Owner: "Developer"
Owner Since: "2026-11-05T22:34:00+08:00"
Assigned Role: developer
Created: 2026-11-05
Updated: 2026-11-06
Branch: "fix/TASK-064-gate-fixes-and-authority-alignment"
Requires Human Approval: false
```

> **Level 判定为 L 的理由：** 改动跨 `shared/scripts/`（多处门禁判定）、`docs/`（两份文档）、
> `tasks/**`（对照记录回写）三个区域，且涉及**安全相关门禁的严重度判定**；
> 同时必须修正**另一个 Git 仓库**（中央规范仓）的权威副本。符合 L 判据「跨模块」+「需独立审查」。

---

## Objective

修正 Reviewer 位对 PR #45 / TASK-062 独立审查（结论 FAIL）提出的 R-1~R-4、R-5、R-6、R-8 各项缺陷，
使审计脚本的门禁强度与档案自述一致。

> ⚠️ **本条已被 2026-11-06 的审查结果修正。** 原表述含「并消除『权威副本可被同步回退已修正门禁』
> 的风险」——该目标**未达成，且在本机制下不可由本任务达成**：A14 的检查逻辑位于被同步覆盖的
> 同一文件内，属自引用检查的固有边界（详见 §整改清单 C-2）。要真正闭合需**不随同步被覆盖的
> 外部锚点**，已另立 **TASK-065**，不由本任务承担。

---

## Background

PR #45（TASK-062）补回了 A10–A13 并恢复 A6/A9，但 Reviewer 位于 2026-11-05 出具独立审查
（`tasks/done/TASK-062-restore-audit-gates/handoffs/2026-11-05-review.md`，结论 **FAIL**），
实测发现三项 MAJOR 与多项未登记收窄。人类已于 2026-11-05 对各项处置作出裁决（见 §Scope 的
「已裁决」标注）。**本任务的输入即该审查记录。**

关键事实（主控位已复现）：

- **R-2 是当前最危险的一项**：中央仓 `agent-framework` 的 `shared/scripts/audit-project.py`
  （HEAD `7c0e49b`，本地=远端、工作树干净）与 `shadcn-admin` 的 `main` 副本有 2 处实质差异 ——
  ① 中央仓把 `sk-[A-Za-z0-9]{24,}` 放在 `SECRET_PATTERNS_SUSPECT`（WARN），`main` 已在
  `SECRET_PATTERNS_HARD`（FAIL）；② 中央仓有行尾归一化，`main` 没有。
  而 `sync-framework.py` 的 `SYNC_SCRIPTS = ["audit-project.py"]`，复制方向是
  中央仓 → 项目（`shutil.copy2(s, dst_scripts / s.name)`）。
  **即：任何人跑一次同步，已修正的密钥门禁会被静默改回 WARN，且没有任何检查会发现。**
  TASK-062 的 Requirements 5 写的「同步范围加入审计脚本，否则门禁自身会漂移」防的正是这个，
  但只做了一半：纳入了同步范围，却没给脚本自身加一致性门禁。
- **R-1**：TASK-062 的 Requirements 2 要求「A10 的行尾差异不算内容差异」，
  但 `main` 的 A10 是裸 `read_bytes()` 比较，无归一化；该实现只存在于中央仓副本。
  当前不假红仅因两侧恰好全为 LF，属环境巧合而非门禁保证。
- **R-3**：PR #45 正文标为「✅ 对等」的 F2 / F3 / F9 经实测并不对等，另有 F1 / F5 / F6
  的严重度或覆盖面收窄未登记 → TASK-062 的 AC-1「无未说明的丢失」不成立。

---

## Scope

### A 组 —— 明确缺陷（主控位直接纳入，无需另行批准）

| 项 | 内容 |
|---|---|
| **R-1** | 在 `shadcn-admin` 的 A10 中实现行尾归一化：CRLF/LF 差异**不**判 FAIL，实质内容差异仍判 FAIL |
| **R-2** | ① 对齐中央仓与 `shadcn-admin` 的 `audit-project.py`（以**已修正**的版本为准，即 `sk-` 在 HARD + 行尾归一化）；② 新增一致性判据，使「审计脚本自身漂移」可被检出 |
| **R-4** | 把 F1–F10 逐条对照记录回写到 `tasks/**` 层 1（现在只存在于 PR #45 正文，违反 `.agent-framework/github.md` §3「不得只在 PR 里写信息而不回写任务文件」） |

### B 组 —— 人类已裁决（2026-11-05）

| 项 | 裁决 | 具体做法 |
|---|---|---|
| **决定 1 / R-3** | 挑着恢复 + 登记其余 | **恢复**：F3/A7 占位符回到 **FAIL**；F2/A8 扫描范围补 `.yaml`；F9/A5 补 Meta `Task ID` 校验。**登记**：F1（缺模板降 WARN）、F5（4 个项目文档的出检）、F6/A11 无表降级、F8 的位置/模板校验失去对象 —— 在层 1 对照记录中如实记为「已知收窄」 |
| **决定 2 / R-5** | 只改分不出来的两条 | A11 无声明表时 **FAIL**；A9 模板缺失时 **FAIL**。A13 无 L 级档案时保持 SKIP（那是「真的没有」而非「被删」） |
| **决定 3 / R-6** | 统一口径 | 三处字段清单（`.agent-framework/github.md` §3 的 8 行 / `docs/agent-collaboration.md` §5 的 9 行 / A9 硬编码的 10 项）统一为同一套切分；**注意 `.agent-framework/` 是中央仓只读副本，其改动必须在中央仓进行再同步** |
| **决定 4 / R-8** | 修 | `docs/operations/negative-assertion-review.md` 的 C9 / C12 / C18 三条判据改指向现行检查（A10 / A8 / A5），不再引用已删除的 `scripts/audit-repo.py` 与已删除的 `.agents/` / `templates/` |
| **决定 5** | 不 reopen TASK-062 | TASK-062 保持 `Status: DONE`；其 AC-1 表述订正放入本任务 |

---

## Non-Scope

- **不改任何受保护规则原文**（`quality.md` §三、`git.md` §6、`quality.md` §二 §5、
  `permissions.md` P3 / `collaboration.md` I2、`change-safety.md`、`github.md` §6）
- 不动业务代码（`src/`、`server/`、`shared/src/`）、不动 `ci.yml` 的作业结构
- 不动 `framework-version.json` 的版本号（本任务不是框架版本发布）
- 不新增/删除检查作业名（`AGENTS.md` §14.1 的启用顺序约束：作业必须先存在于默认分支并稳定上报，再加入必需检查）
- 不提交任何与本任务无关的未跟踪文件

---

## Requirements

1. 所有改动的**前后行为必须用注入缺陷实测**：每个修改过的检查，都要先构造一个能触发它的缺陷、
   实跑确认状态与退出码符合预期、恢复、复跑确认回到基线。判据须写入层 1 档案。
2. **不得为了让检查变绿而放松断言**（`.agent-framework/quality.md` 二 §5、`github.md` §4 受保护）。
3. R-2 的一致性判据必须能检出「脚本自身漂移」；若该判据在 CI 单仓 checkout 下必然降级，
   须在档案中如实说明其适用条件，不得声称 CI 已强制。
4. A10 的行尾归一化**只豁免行尾差异**，不得顺带豁免实质内容差异。
5. 跨仓改动（中央规范仓）必须在档案中单独登记提交号，并说明与 `shadcn-admin` 侧的先后关系。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 只用标准库（`audit-project.py` 现为纯标准库实现，保持） |
| 安全 | 门禁强度**只增不减**；任何严重度变化必须登记理由 |
| 兼容 | 现有 63 个任务档案必须全部通过改后门禁（主控位已实测 63/63 有 Meta `Task ID`） |
| 流程 | 禁止直推 `main`；两仓均走 PR；`sync-framework.py` 不自动合并 |
| 顺序 | `.agent-framework/` 的改动必须**先在中央仓落地并推送**，再同步到项目，不得在项目内手改只读副本 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-062 审查记录入库 | blocks | **待办** —— 该记录当前是工作树内未跟踪文件，须随本任务或前置 PR 入库 |
| 中央规范仓 `agent-framework` 可写权限 | external | 可用（`push=true`） |

---

## Acceptance Criteria

- [x] AC-1: A10 实现行尾归一化 —— 探针：纯 CRLF/LF 差异**不**判 FAIL；1 字节实质差异仍判 FAIL + exit 1
- [x] AC-2: 中央仓与 `shadcn-admin` 的 `audit-project.py` 逐字节一致；且新增判据能在脚本漂移时报 FAIL（探针实测）
- [x] AC-3: A7 占位符残留严重度恢复为 FAIL；扫描范围维持或扩大（不得缩小）
- [x] AC-4: A8 扫描范围包含 `.yaml` —— 探针：新增无 `on`/`permissions` 的 `.yaml` 工作流 → FAIL
- [x] AC-5: A5 增加 Meta `Task ID` 校验 —— 探针：Meta 缺 `Task ID` 或不可解析 → FAIL；现有档案全过（**C-6 订正**：原「63 档案」混用了档案数与编号数 —— A4 按 `TASK.md` 档案计数、A5 按可解析编号计数，两者不是同一个数；整改时点实测 65 个档案 / 64 个编号，以 `find tasks -name TASK.md | wc -l` 对照 A4 / A5 输出，64 个编号所属档案全部含可解析 Meta `Task ID`，A5 无 FAIL）
- [x] AC-6: A11 无声明表时 FAIL、A9 模板缺失时 FAIL（探针实测）；A13 无 L 级档案时仍为 SKIP
- [x] AC-7: 三处 PR 描述字段口径统一为同一套切分，且 A9 的 10 项与模板实际字段仍一致
- [x] AC-8: `negative-assertion-review.md` C9 / C12 / C18 判据改指向现行检查，不再引用已删除的脚本与目录
- [x] AC-9: F1–F10 逐条对照记录回写至 `tasks/**` 层 1，含「已恢复」与「已登记为已知收窄」两类标注
- [x] AC-10: TASK-062 的 AC-1 表述订正为与实际相符（不再声称「无未说明的丢失」）
- [x] AC-11: `python shared/scripts/audit-project.py` 实跑 exit 0 且 FAIL=0；`check-traceability.py` PASS
- [x] AC-12: 每个修改过的检查均有「注入缺陷 → 实跑 → 恢复 → 复跑」四步实测记录，且已回写层 1

---

## 整改清单（Changes Requested，2026-11-06）

> 来源：Reviewer 位独立审查（结论 **FAIL**，`handoffs/2026-11-06-review.md`）与
> Security 角色审查（结论**不通过**，`handoffs/2026-11-06-security-review.md`）。
> 两份记录已入库（见 Changed Files）。**整改后须由不携带整改上下文的新实例复审。**

### C 组 —— 订正表述（不扩大范围，不动门禁逻辑）

- [x] C-1（对应 Reviewer R-1）：`.agent-framework/github.md` §3 与 `docs/agent-collaboration.md` §5
  新增的「与 `.github/PULL_REQUEST_TEMPLATE.md` 的章节是**同一套 10 项切分**」与事实不符
  （模板为 **8 个 `##` 章节**；A9 的 10 项靠裸子串匹配命中：5 个章节标题 + 3 个章节内粗体标签
  + 2 个标题子串，PASS **不能证明**章节一致）。须订正为如实表述；同步订正 HANDOFF-002 §2.2
  与提交说明中的同一复述。
- [x] C-2（对应 Reviewer R-2 / Security S-1）：把 `Objective`（本文件，已由主控位先行订正）、
  HANDOFF-002 §2.1、`negative-assertion-review.md` C18 中「可检出/可消除**同步回退**」
  改为「可检出**两仓工作树字节不一致**」；在 Known Issues 补记两个盲区：
  ① **自覆盖**：`sync-framework.py` 为 `shutil.copy2` 全量覆盖，检查逻辑就在被覆盖的文件内，
  回退后 A14 随旧脚本一并消失、A6 由 FAIL 静默降为 WARN，全仓 FAIL=0 / exit 0；
  ② **自篡改**：从 `CHECKS` 移除 a14、或把其 FAIL 分支改为恒真，均无人报警。
- [x] C-3（对应 Security S-2 / Reviewer R-3）：Merge Record 补记「顺序颠倒时 **A10 与 A14 均** FAIL」
  （原只记 A10），并如实标注本地 A10/A14 的 PASS 依赖「中央仓工作树 checkout 在 feature 分支」
  这一非持久条件。
- [x] C-4（对应 Reviewer R-4）：Merge Record 的 PR 侧 CI run 更新为 **`42051018636`**
  （PR 头 `f9aeeba` 对应值）；原登记的 `42049299643` / `42050504614` 对应更早的 head，保留为历史记录但须注明。
- [x] C-5（对应 Reviewer R-8）：C18 判据补写「A14 在中央不可达时为 WARN」的适用条件（C9 已写，C18 未写）。
- [x] C-6（对应 Reviewer R-9）：AC-5「现有 63 档案全过」订正口径 —— 实测 `find tasks -name TASK.md | wc -l`
  = **64**（A4 报 64 个档案、A5 报 63 个**编号**），须区分档案数与编号数。

### D 组 —— 补测试覆盖（不动门禁逻辑）

- [x] D-1（对应 Reviewer R-5）：补 A14 的探针分支，至少覆盖 WARN（中央不可达）、纯 CRLF 行尾差异、
  以及「从 `CHECKS` 移除 a14」与「FAIL 分支改恒真」两个自篡改情形；每条附**具体可复现命令**，
  探针台须以 PR 头文件构造（而非 `origin/main` 沙箱）。

### 明确不做

- **不引入外部锚点** —— 已另立 **TASK-065**，不由本任务承担（人类 2026-11-06 裁决）。
- 不改任何门禁的严重度、扫描面或判据（C/D 两组均为文档与测试订正）。
- 不回溯修改 TASK-061 / TASK-062 的历史档案（R-6 的 A6 判据自踩、R-7 的模板 Issues 失真
  均另立任务处理）。

### 合并前置（整改+复审通过后，由主控位执行）

1. **先合并中央规范仓 PR #1**（当前 `OPEN`，head `fix/TASK-064-audit-script-authority` @ `9f11a9d`）；
2. 再合并本 PR。顺序颠倒会使 `main` 上 A10 与 A14 同时 FAIL，叠加 `enforce_admins=true` 即成自锁。

---

## File Scope

```yaml
File Scope:
  - shared/scripts/audit-project.py              # shadcn-admin
  - shared/scripts/sync-framework.py             # 仅中央仓 agent-framework
  - docs/operations/negative-assertion-review.md # shadcn-admin
  - docs/agent-collaboration.md                  # shadcn-admin（决定 3 统一口径）
  - tasks/done/TASK-062-restore-audit-gates/**   # 订正 AC-1 表述 + 回写对照记录
  - tasks/backlog/TASK-064-*/**                  # 本任务档案自身
  - ../agent-framework/shared/scripts/audit-project.py   # 仅中央仓（R-2 对齐）
  - ../agent-framework/.agents/github.md                 # 仅中央仓（决定 3，如涉及）
Non-Scope (files):
  - .agent-framework/**          # 中央仓只读副本，由同步机制更新，项目内不手改
  - .github/workflows/**         # 不改作业结构
  - framework-version.json       # 本任务不是版本发布
  - src/**  server/**  shared/src/**  package.json  pnpm-lock.yaml
  - tasks/**（除上述两项外）
```

---

## Implementation Plan

> 由 Developer 在执行中补充与更新。**执行状态（2026-11-05）：步骤 1–8 已完成，步骤 9 进行中。**
> 建议顺序（可调整，但 R-2 的对齐必须先于一致性判据）：

1. 从最新 `main` 派生分支；领取任务（写 `Owner` / `Owner Since`、`Status` 改 `ACTIVE`、目录移入 `tasks/active/` ✅
2. 先在中央仓落地：把行尾归一化 + `sk-` 在 HARD 的版本作为权威版推送（R-2 ① ✅
3. 在 `shadcn-admin` 实现 A10 归一化（R-1）与脚本一致性判据（R-2 ② ✅
4. 实现 A7/A8/A5/A11/A9 的严重度与范围修正（决定 1、决定 2 ✅
5. 统一三处字段口径（决定 3）—— 注意 `.agent-framework/github.md` 需经中央 ✅
6. 订正 `negative-assertion-review.md` 三条判据（决定 4 ✅
7. 回写 F1–F10 对照记录至层 1（R-4）并订正 TASK-062 的 AC-1（决定 5 ✅
8. 对每个改动的检查做「注入缺陷 → 实跑 → 恢复 → 复跑」四步实测，结果回写层  ✅
9. 自检后开 PR，移交 Reviewer（L 级需独立审查 ✅

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 | 探针 | 构造纯 CRLF 差异 → A10 应 PASS；构造 1 字节实质差异 → A10 应 FAIL + exit 1 |
| AC-2 | 探针 + `cmp` | `cmp` 两仓脚本 → IDENTICAL；改动项目侧脚本 1 字节 → 新判据应 FAIL |
| AC-3 / AC-4 / AC-5 / AC-6 | 探针 | 逐项注入缺陷，记录目标检查状态与退出码 |
| AC-7 | 对照 | A9 的 10 项 vs 模板实际章节 vs 另两处清单 |
| AC-8 | 复跑 | 按订正后的命令实跑，确认不再引用不存在路径 |
| AC-9 / AC-10 / AC-12 | 目视 | 层 1 档案含完整对照记录与四步实测输出 |
| AC-11 | 自动 | `python shared/scripts/audit-project.py`、`python scripts/check-traceability.py --base origin/main` |

---

## Current State

**状态：`CHANGES_REQUESTED`（2026-11-06，主控位依审查结论设置）。**

双重审查已出具，**均为不通过**：

| 审查位 | 结论 | 记录 |
|---|---|---|
| Reviewer 位（独立，不携带实现上下文） | **FAIL**（R-1 / R-2 两项 MAJOR 阻断） | `handoffs/2026-11-06-review.md` |
| Security 位（`AGENTS.md` §10 增强条） | **不通过**（S-1 MAJOR 阻断 / S-2 合并前置） | `handoffs/2026-11-06-security-review.md` |

两份记录**独立收敛到同一结构性缺陷**（主控位已复现）：**A14 是自引用检查** ——
其检查逻辑位于被 `sync-framework.py` 全量覆盖的同一文件内，故无法检出「同步回退」与「自身被篡改」。
实测佐证：中央仓 `origin/main`（`7c0e49b`）的脚本中 `a14`/`A14` 出现 **0** 次。

人类 2026-11-06 裁决：**TASK-064 只订正表述，外部锚点单独立 TASK-065。**
Objective 中「消除同步回退风险」一句已由主控位先行订正（见该节备注）。

**C-1~C-6 与 D-1 已由 Developer 实施完成（2026-11-06）** —— 均为文档与测试订正，
未动任何门禁的严重度、扫描面或判据；A14 四情形探针（含两个自篡改情形）实测记录见
`handoffs/HANDOFF-003-developer-remediation-to-reviewer.md`。整改后须由**不携带整改上下文的新实例复审**。

**派单产物入库情况（历史留痕）：** 主控位的派单提交 `15383f7`（分支 `docs/TASK-064-dispatch`）
在领取时点尚未合入 `main`，Developer 以 `cherry-pick` 重放为 `95262a9`（内容逐字不变）使其随本任务入库。
主控位已于 2026-11-05 关闭 PR #52（内容已被本 PR 完整包含，两线并存会冲突），并已在关闭评论中留证。

---

## Changed Files

> 由 Developer 维护。

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `shared/scripts/audit-project.py` | 修改 | A10 行尾归一化；新增 A14；A5/A7/A8/A9/A11 严重度与范围修正；A6/A13 未改 |
| `.agent-framework/github.md` | 修改（同步） | 由中央仓 `4bdca16` 按 `shutil.copy2` 语义复制，`cmp` IDENTICAL |
| `docs/agent-collaboration.md` | 修改 | §5 字段映射表 9 → 10 行（决定 3） |
| `docs/operations/negative-assertion-review.md` | 修改 | C9 → A10；C12 → A11；C18 → A10 + A14（决定 4） |
| `tasks/done/TASK-062-restore-audit-gates/TASK.md` | 修改 | AC-1 表述订正 + Known Issues 补第 4 条（决定 5） |
| `tasks/done/TASK-062-restore-audit-gates/handoffs/2026-11-05-f1-f10-comparison.md` | 新增 | F1–F10 逐条对照记录（R-4） |
| `tasks/active/TASK-064-gate-fixes-and-authority-alignment/TASK.md` | 修改 | 本档案 |
| `tasks/active/TASK-064-gate-fixes-and-authority-alignment/handoffs/HANDOFF-002-developer-to-reviewer-and-security.md` | 新增 | 实施记录与移交（含四步实测输出） |
| `../agent-framework/shared/scripts/audit-project.py` | 修改（中央仓） | 权威副本落地，提交 `48e892d` |
| `../agent-framework/.agents/github.md` | 修改（中央仓） | §3 字段清单 10 项，提交 `4bdca16` |
| `.agent-framework/github.md` | 修改（整改轮同步） | §3 失真表述订正；由中央仓 `9f11a9d` 按 `shutil.copy2` 语义复制，`cmp` IDENTICAL（C-1） |
| `docs/agent-collaboration.md` | 修改（整改轮） | §5「同一套 10 项切分」改如实表述：模板 8 个 `##` 章节、A9 裸子串匹配、PASS 不证明章节一致（C-1） |
| `docs/operations/negative-assertion-review.md` | 修改（整改轮） | C18 改「两仓工作树字节不一致」+ 能力边界（C-2）；补 A14 中央不可达时为 WARN 的适用条件（C-5） |
| `tasks/active/TASK-064-gate-fixes-and-authority-alignment/handoffs/HANDOFF-002-developer-to-reviewer-and-security.md` | 修改（整改轮） | §2.1 A14 能力边界、§2.2 同切分复述订正、§8 合并顺序遗漏补记（C-1 / C-2 / C-3） |
| `tasks/active/TASK-064-gate-fixes-and-authority-alignment/handoffs/HANDOFF-003-developer-remediation-to-reviewer.md` | 新增（整改轮） | 整改记录 + A14 四情形探针（WARN / 纯 CRLF / 移出 CHECKS / FAIL 恒真），附可复现命令（D-1） |
| `tasks/active/TASK-064-gate-fixes-and-authority-alignment/TASK.md` | 修改（整改轮） | Known Issues #12/#13、Merge Record（C-3 / C-4）、AC-5 口径（C-6）、整改勾选、Changed Files |
| `../agent-framework/.agents/github.md` | 修改（中央仓，整改轮） | §3 失真表述订正，提交 `9f11a9d`，推送至中央仓 PR #1 分支 |

---

## Known Issues

1. **一致性判据在 CI 内必然降级（已实测，非推测）。** CI 单仓 checkout 时中央仓不可达，
   任何「项目 ↔ 中央仓」比对都只能 WARN。PR #53 侧 run `42049299643` 的 `audit` 作业实测输出：
   `[WARN] A2 无法定位中央规范版本文件…`、`[WARN] A10 中央规范仓不可达…`、
   `[WARN] A14 中央规范仓不可达；无法校验审计脚本自身一致性（Standalone 限制）`，
   汇总 `PASS=9 FAIL=0 WARN=5 SKIP=0` / exit 0（A10 / A2 此前已实测如此，run `41988096514`）。
   **不得声称 CI 已强制**；适用条件须在档案写明，是否补 CI 侧校验需人类另议。
2. **决定 3 涉及中央仓规范文件。** `.agent-framework/` 是只读副本，改它等于改中央仓，
   已走「中央仓先落并推送 → 同步」的顺序（`48e892d` / `4bdca16` 先推送，再 `shutil.copy2` 到项目侧，
   `cmp` IDENTICAL）。`sync-framework.py` 本体拒绝非 `main` 分支（实测 exit 1），
   故同步步骤按其同一 copy 语义在交付分支上手工执行。
3. **决定 1 的「登记」类项会降低门禁强度的可读性。** F1 / F5 / F6 / F8 的收窄被如实登记后，
   档案里会明确存在「已知比旧规则松」的检查。这是人类裁决的结果，但后续审查可能会反复提及。
   （注：按决定 2，F1 的「缺模板降 WARN」与 F6 的「无表降级」已改为 FAIL，实际登记项为
   F5、F8 及 F3/F6/F9 的覆盖面部分，逐条见 `2026-11-05-f1-f10-comparison.md` §2。）
4. **`ci.yml` 两处注释漂移**（`ci.yml:80` 写「A1~A9」实际 A1–A14；`ci.yml:103` 写
   traceability「尚未成为门禁」实际 2026-11-02 已入列）已登记于 TASK-062 / TASK-061，
   本任务 Non-Scope 禁改 `.github/`，**不修**。
5. **中央仓 `templates/project/.agent-framework/github.md` 与 `.agents/github.md` 存在既有漂移**
   （本次改动前即缺 TASK-062 新增的一行；本次又扩大差距）。不在本任务 File Scope 内，**未改**；
   新项目由 `create_project.py` 从该模板创建，会拿到旧口径副本。建议另立任务。
6. **`shared/scripts/README.md` 仍描述已删除的 `audit_framework.py`，且未提及 `audit-project.py`。**
   既有漂移，不在 File Scope 内，**未改**。
7. **`docs/operations/collaboration-audit.md` / `known-pitfalls.md` 仍引用 `scripts/audit-repo.py`。**
   属历史审计/事件记录，按「不回溯修改历史档案」原则**未改**；与本次订正的
   `negative-assertion-review.md`（现行判据清单）性质不同。
8. **A6 有 2 处 WARN**（`server/scripts/smoke.ts:803` 测试固件密码字面量；
   `tasks/done/TASK-061-adopt-agent-framework/handoffs/2026-11-05-review.md:84` 审查记录引用该固件）。
   均为 suspect 级，非真实凭据；是否为测试固件增加豁免需人类决定（承 TASK-062 Known Issues #1）。
9. **派单产物由本分支携带。** 主控位派单提交 `15383f7`（分支 `docs/TASK-064-dispatch`）在领取时点
   尚未合入 `main`，本分支以 `cherry-pick` 重放为 `95262a9`。**请主控位勿再单独合并该派单分支**，
   否则同一内容会两次进入 `main`（内容相同，合并可自动解决，但历史会出现重复提交）。
10. **决定 4 的检查映射按断言语义确定，未按任务正文的字面「A10 / A8 / A5」。**
    C9（规范副本一致）→ A10；C12（必需检查表一致）→ A11；C18（副本与脚本自身一致）→ A10 + A14。
    A8 校验 `on:`/`permissions:`、A5 校验任务编号，与这三条断言不是同一件事。该偏差已在
    `handoffs/HANDOFF-002-developer-to-reviewer-and-security.md` §7 显式登记，请审查位复核。
11. **探针台未使用 `E:\AiData\tmp\<task-id>\`。** 该路径在本会话不可写（沙箱只读，实测
    Access denied），改用 OS 临时目录 `C:\Users\Admin\AppData\Local\Temp\TASK-064-probe\sandbox\`，
    其中 `shadcn-admin/` 为 `origin/main` 的 git worktree、`agent-framework/` 为中央仓镜像。
    **仓库内零探针残留**（每个探针恢复后 `git status --porcelain` 均为空）。
12. **A14 不能检出「同步把两侧一并回退」—— 自覆盖盲区（2026-11-06 / C-2 补记，Reviewer R-2 / Security S-1）。**
    `sync-framework.py` 是 `shutil.copy2` 全量覆盖，而 A14 的检查逻辑就在被覆盖的同一文件内：
    一旦同步执行（或中央仓被回退）且两侧同为旧版脚本，A14 随旧脚本一并消失、A6 由 FAIL 静默降为 WARN，
    全仓 FAIL=0 / exit 0，无任何检查报警。实测佐证：中央仓 `origin/main`（`7c0e49b`）的脚本中
    `a14` / `A14` 出现 0 次。这是**自引用检查的固有边界，不是编码错误**；闭合需不随同步被覆盖的
    外部锚点，已另立 **TASK-065**，不由本任务承担。
13. **A14 不能检出「针对自身的篡改」—— 自篡改盲区（2026-11-06 / C-2 补记）。**
    把 `a14_script_consistency` 从 `CHECKS` 中移除、或把其 FAIL 分支改为恒真，均无人报警
    （探针实测见 `handoffs/HANDOFF-003-developer-remediation-to-reviewer.md` §D-1 情形 ③ / ④）。
    同属自引用检查的固有边界；在外部锚点（TASK-065）落地前，缓解只能靠独立审查与人工复核。

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | coordinator | developer | 2026-11-05 | 派单：按 TASK-062 独立审查（FAIL）修正门禁缺陷并对齐权威副本 |
| 002 | developer | reviewer + security | 2026-11-05 | 实施完成并自检通过；四步实测 10 探针全部符合预期。移交双重审查，记录见 `handoffs/HANDOFF-002-developer-to-reviewer-and-security.md` |
| 003 | reviewer + security | coordinator | 2026-11-06 | 双重审查均**不通过**：Reviewer FAIL（R-1/R-2 MAJOR）、Security 不通过（S-1 MAJOR / S-2 合并前置）。记录见 `handoffs/2026-11-06-review.md`、`handoffs/2026-11-06-security-review.md` |
| 004 | coordinator | developer | 2026-11-06 | 依审查结论设 `CHANGES_REQUESTED` 并定义 §整改清单（C-1~C-6 / D-1）；Objective 先行订正；外部锚点另立 TASK-065 |
| 005 | developer | reviewer（不携带整改上下文的新实例） | 2026-11-06 | 完成 C-1~C-6 与 D-1 七项整改（文档与测试订正，门禁逻辑未动）；A14 四情形探针实测；移交复审，记录见 `handoffs/HANDOFF-003-developer-remediation-to-reviewer.md` |

**Next Action：** **移交不携带整改上下文的新实例复审** C-1~C-6 与 D-1 的整改结果（复审入口见
`handoffs/HANDOFF-003-developer-remediation-to-reviewer.md` §9）。Developer 不自行批准本交付物
（I2 / `github.md` §6 受保护）。

**合并前置（复审通过后由主控位执行）：** 先合并中央规范仓 PR #1，再合并本 PR；
顺序颠倒会使 `main` 上 A10 与 A14 同时 FAIL，叠加 `enforce_admins=true` 即成自锁。

---

## Merge Record

> 本节由合并前按 `github.md` §5 实测填入（同一 PR 内自填，不延后、不回溯补写）。
> 合并后才存在的字段（`merged_at` / `merge_commit_sha` / 合并后 runs / 镜像 tag）在合并时点不可得，
> 按 TASK-063 已确立的先例显式标注「合并后实测回填」，不预先写死猜测值。
>
> **跨仓登记（Requirements 5）：** 中央规范仓 `huyanluanyuqaq/agent-framework` 分支
> `fix/TASK-064-audit-script-authority`，PR [#1](https://github.com/huyanluanyuqaq/agent-framework/pull/1)，
> 提交 `48e892d63f5f66162bb3ee9d78335698699157d1`（脚本）+
> `4bdca167faf16a09ea609a413cb9d8c664ef6bd3`（`.agents/github.md`）。
> **先后关系：中央仓先落地并已推送，之后**才按 `sync-framework.py` 的同一 `shutil.copy2` 语义
> 复制到项目侧（`cmp` IDENTICAL）。整改轮（C-1）新增中央仓提交 `9f11a9d`（`.agents/github.md` §3
> 失真表述订正），同样先落中央、后同步项目。**合并顺序要求：先合并中央仓 PR #1，再合并本 PR**；
> 若顺序颠倒，**A10 与 A14 均**会如实报 FAIL（这是正确行为，不是缺陷；2026-11-06 / C-3 补记：
> 原记录只写 A10）。**本地 PASS 的非持久条件（C-3）：** 本地 A10 / A14 的 PASS 依赖「中央仓工作树
> checkout 在 feature 分支 `fix/TASK-064-audit-script-authority`」—— 中央仓 `origin/main`
> （`7c0e49b`）仍为回退前脚本，该条件要到中央仓 PR #1 合并后才转为持久。

| 要素 | 值 |
|------|-----|
| PR | [#53](https://github.com/huyanluanyuqaq/shadcn-admin/pull/53)，分支 `fix/TASK-064-gate-fixes-and-authority-alignment`；`state=OPEN`；提交数不预写死，合并前以 `git rev-list --count origin/main..HEAD` 实测为准（建单时为 7 提交 / 9 文件 / +1088 −19） |
| 合并策略 | rebase-merge（`AGENTS.md` §14.2 默认） |
| 提交数 | 合并前以 `git rev-list --count origin/main..HEAD` 实测填入（**不预写死**：本档案曾因自引用式计数漂移连续订正三次 7 → 9 → 10，故改为复核口径） |
| merged_at | 合并后实测回填 |
| merge_commit_sha | 合并后实测回填（全 40 位） |
| 合并后 CI run | 合并后实测回填 |
| PR 侧 CI run | 已实测**四次**四作业全 pass：`42049299643`、`42050504614`、`42051018636`（均对应更早的 head，保留为历史记录）与 **`42189119169`（当前 PR 头 `dae4f84` 对应值，2026-11-06 实测：`install-lint-build` 58s / `audit` 6s / `traceability` 6s / `smoke` 19s，四作业全 pass）**（Continuous Integration / `event=pull_request`；作业 `install-lint-build` / `audit` / `traceability` / `smoke`）。每次推送都会重跑，合并前以 `gh pr checks 53` 复核 |
| 合并后 Docker run | 合并后实测回填 |
| 镜像 tag | 合并后实测回填（`sha-<短SHA>`） |
| 审查记录 | 2026-11-06 已出具并入库：`handoffs/2026-11-06-review.md`（Reviewer 位，结论 **FAIL**：R-1 / R-2 两项 MAJOR 阻断）、`handoffs/2026-11-06-security-review.md`（Security 位，结论**不通过**：S-1 MAJOR / S-2 合并前置）。主控位据此设 `CHANGES_REQUESTED` 并定义整改清单 C-1~C-6 / D-1；Developer 已完成整改（见 `handoffs/HANDOFF-003-developer-remediation-to-reviewer.md`）。**复审记录待新实例出具**，合并前按实测补记，无则如实写「无」，不补写 |

---

## Task Rules

- [增强] 本任务改动**安全相关门禁**（密钥检测、占位符、工作流声明、任务编号）。
  按 `AGENTS.md` §10「涉及认证、密钥、数据库迁移的变更必须经 Security 角色审查后方可合入」，
  除 Reviewer 位独立审查外，**还须经 Security 角色审查**。
- [补充] 每个修改过的检查必须留下「注入缺陷 → 实跑 → 恢复 → 复跑」四步实测记录（AC-12）。
- [补充] 跨仓改动须分别登记两仓的提交号与先后关系（Requirements 5）。

---

## Notes

- 派单背景：TASK-062 合并后，Reviewer 位独立审查（追加保障，因 TASK-062 为 Level M 本不强制）
  结论 FAIL，发现 R-1~R-8。人类 2026-11-05 对各项处置作出裁决，本任务即该裁决的执行载体。
- 审查记录当前未入库（工作树内未跟踪），是本任务的前置依赖。
