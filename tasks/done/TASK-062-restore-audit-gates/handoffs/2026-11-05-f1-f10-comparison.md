# 2026-11-05 F1–F10 逐条对照记录 — 旧 `audit-repo.py` vs 新 `audit-project.py`

> **本文件关闭 R-4（MEDIUM）：** 旧 F1–F10 与新 A1–A13 的逐条对照记录此前**只存在于 PR #45 正文**，
> 违反 `.agent-framework/github.md` §3「不得只在 PR 里写信息而不回写任务文件」与
> `AGENTS.md` §14.5「层 1 为唯一事实来源」。本文件是该对照记录的层 1 归档版，
> 并记录 TASK-064（2026-11-05 人类裁决）之后的实际状态。
>
> **本文件不是审查记录、不构成批准。** 它是事实登记：旧脚本做了什么、新脚本做了什么、
> 哪些按裁决恢复、哪些如实登记为已知收窄。

---

## 0. 判据来源与复现基线

| 项 | 值 |
|---|---|
| 旧脚本（F1–F10） | `git cat-file -p 3566496f6f3f210b7b79154fa5a24bde74c20685:scripts/audit-repo.py`（= `926d353^`，PR #43 删除前），564 行 |
| 新脚本基线 | `origin/main` @ `1f931ce` 的 `shared/scripts/audit-project.py`（A1–A13，482 行） |
| 新脚本现状 | `fix/TASK-064-gate-fixes-and-authority-alignment` @ `079c16b` 起的 A1–A14（551 行） |
| 中央权威副本 | `huyanluanyuqaq/agent-framework` @ `48e892d`（脚本）/ `4bdca16`（`.agents/github.md`） |
| 旧脚本实跑基线 | 沙箱内 `python scripts/audit-repo.py`（对本仓库树）：F1–F10 中 F2 / F3 报 FAIL（见 §3 对照组） |
| 新脚本实跑基线 | `python shared/scripts/audit-project.py`：`PASS=12 FAIL=0 WARN=2 SKIP=0`，exit 0 |

**「已恢复」= 按人类 2026-11-05 裁决把严重度或覆盖面改回旧规则；「已登记为已知收窄」= 裁决要求保留现状、
在本文件如实登记，不得在别处表述为「对等」。**

---

## 1. F1–F10 逐条对照（TASK-064 后状态）

| F | 旧能力（判据） | PR #45 时登记 | TASK-064 后实际 | 处置 | 判定 |
|---|----------------|---------------|------------------|------|------|
| **F1** | PR 模板 10 字段；**缺模板 = FAIL** | 收窄 10→5，本 PR 恢复 10 | A9 恢复 10 字段；**缺模板 = FAIL**（原 WARN） | **已恢复**（决定 2） | 对等 |
| **F2** | 工作流 `on` + `permissions`；glob `*.y*ml`（含 `.yaml`）；目录缺失 = FAIL | 「✅ 对等」 | A8 glob `*.y*ml`（原 `*.yml`，`.yaml` 盲区已补） | **已恢复**（决定 1） | 对等 |
| **F3** | 占位符残留 = **FAIL**；扫 5 框架文档 + 全部工作流 + 脚本自身；剥离 GitHub 表达式与 `{{version}}`；命中任意 `{{` 或 `TODO-PLACEHOLDER` | 「✅ 对等」 | A7 = **FAIL**（原 WARN）；扫描范围仍为 `.agent-framework/*.md` + 根 `AGENTS.md`（8 文件）；正则仍为 `\{\{[A-Za-z0-9_]+\}\}`（不含空格/连字符），不剥离 GitHub 表达式 | 严重度**已恢复**；覆盖面**已登记为已知收窄** | 部分恢复 |
| **F4** | 明文密钥 hard = FAIL / suspect = WARN，6 条 hard 模式 | 收窄为一级，本 PR 恢复两级 | A6 在 `main` 上 hard 6 条（与 F4 同集）+ suspect 1 条，扫描范围为全仓（宽于 F4 的 8 文件） | 无需处置 | 对等（且更宽） |
| **F5** | 5 个框架文档存在、被 AGENTS.md 按**相对路径**引用、链接有效 | 「❌ 丢失 → 新增 A12」 | A12 只检 `AGENTS.md` + `.agent-framework/*.md`（8 篇）；`docs/agent-collaboration.md`、`docs/git-workflow.md`、`docs/operations/github-capability.md`、`.github/PULL_REQUEST_TEMPLATE.md` 4 个项目文档**整体出检**；「被引用」判据弱化为裸文件名子串 | **已登记为已知收窄**（决定 1） | 已知收窄 |
| **F6** | 声明的必需检查名与作业名一致；**无声明表 = FAIL**；作业名正则锚行尾 | 「❌ 丢失 → 新增 A11」 | A11 **无声明表 = FAIL**（原 WARN）；作业名正则仍不锚行尾（`^  ([A-Za-z0-9_-]+):`） | 严重度**已恢复**（决定 2）；正则宽松**已登记为已知收窄** | 部分恢复 |
| **F7** | 11 项旧框架资产（`.agents/` 四目录 / `templates/` 四模板 / `audit_framework.py`）在位 | 「✅ 等价改造」 | A1 检 7 篇 + `framework-version.json`（FAIL）；A3 以 WARN 看护遗留目录 | 无需处置（v2.0.0 重定目标） | 对等 |
| **F8** | TASK-026+ 档案须含 `## Merge Record`，校验**章节位置**、模板自身在检、无档案 = FAIL | 「❌ 丢失 → 新增 A13」 | A13 只强检 `Level: L`（TASK-064 时 3 个），不校验位置、不校验模板；**无 L 级档案 = SKIP + exit 0** | **已登记为已知收窄**（决定 1 + TASK-062 Requirements 4 / AC-5 明确授权「只强检 L 级」；决定 2 明确 A13 保持 SKIP） | 已知收窄 |
| **F9** | 档案 Meta 的 `Task ID: TASK-XXX` 必须可解析，否则 FAIL；无档案 FAIL；HD-1 白名单按**精确标签集** | 「✅ 对等」 | A5 补 Meta `Task ID` 可解析性校验（原只解析目录名）；豁免仍按编号而非标签集；**无档案 = SKIP** | Meta 校验**已恢复**（决定 1）；豁免口径与无档案路径**已登记为已知收窄** | 部分恢复 |
| **F10** | `templates/` + `.agents/` 与模板仓库逐字一致；模板仓不可达 = WARN | 「❌ 丢失 → 新增 A10」 | A10 比 `.agent-framework/` ↔ 中央 `.agents/`（`templates/` 已随 v2.0.0 删除，合理）；**新增 A14** 比 `shared/scripts/audit-project.py` ↔ 中央权威副本；两检查中央不可达时均 WARN | R-1 / R-2 已在 TASK-064 修复 | 对等（且新增脚本自身看护） |

**汇总：** 10 项中 **对等 4**（F2 / F4 / F7 / F10）、**部分恢复 3**（F3 / F6 / F9）、
**已知收窄 3**（F5 / F8 及 F3/F6/F9 的覆盖面部分）。

> **与 TASK-062 AC-1 原表述的关系：** 原表述「无未说明的丢失」在 PR #45 时点**不成立**
> （F2 / F3 / F9 标「✅ 对等」而实测不对等；F1 / F5 / F6 的收窄未登记）。
> 该表述已按决定 5 在 `TASK-062-restore-audit-gates/TASK.md` 中订正，TASK-062 本身不 reopen。

---

## 2. 「已登记为已知收窄」清单（后续审查可能反复提及，勿读作欠账）

| # | 收窄内容 | 为什么保留现状 | 复审入口 |
|---|---|---|---|
| N1 | A12 不检 `docs/agent-collaboration.md` / `docs/git-workflow.md` / `docs/operations/github-capability.md` / `.github/PULL_REQUEST_TEMPLATE.md` 的存在性与链接有效性 | 人类裁决「登记」而非恢复（决定 1）；恢复需把 4 个项目文档纳入在检范围，属门禁目标重定义 | 本表 |
| N2 | A12「文档缺失」分支近乎死码（`docs` 由 `.agent-framework` glob 生成，删一篇即从列表消失），「被引用」用裸文件名而非相对路径 | 同上 | 本表 |
| N3 | A7 不扫工作流与脚本自身；正则不含空格/连字符；不剥离 `${{ ... }}` 与 `{{version}}` | 决定 1 只要求恢复严重度；扩大扫描面会命中 `ci.yml` 的 `${{ }}` 表达式，需先做表达式剥离 | 本表 |
| N4 | A11 作业名正则不锚行尾，比 F6 宽松 | 决定 2 只要求把「无声明表」改回 FAIL | 本表 |
| N5 | A13 只强检 `Level: L`，不校验章节位置、不校验模板自身；无 L 级档案时 SKIP | TASK-062 Requirements 4 / AC-5 明确授权；决定 2 明确「真的没有」不判 FAIL | 本表 |
| N6 | A5 豁免按编号而非精确标签集；无档案时 SKIP | 决定 1 只要求补 Meta 校验；无档案路径与 A13 同理 | 本表 |
| N7 | `workflow_job_names` 只认 `^jobs:$` 后缩进两行的作业名，不解析 YAML | 脚本约束「只用标准库、不做 YAML 解析」（承旧 F2 设计） | 本表 |

---

## 3. 四步实测记录（注入缺陷 → 实跑 → 恢复 → 复跑）

**执行环境：** `E:\AiData\tmp` 在本会话不可写（沙箱只读），探针台改用 OS 临时目录
`C:\Users\Admin\AppData\Local\Temp\TASK-064-probe\sandbox\`，其中
`shadcn-admin/` 是 `origin/main` @ `1f931ce` 的 git worktree（LF 检出），
`agent-framework/` 是中央仓 `.agents/` + `shared/scripts/` + `framework-version.json` 的镜像。
**仓库内零探针残留**（每个探针恢复后 `git status --porcelain` 均为空）。

**基线（新脚本，A1–A14）：** `PASS=12 FAIL=0 WARN=2 SKIP=0`，exit 0。
**基线（旧脚本，A1–A13）：** `PASS=11 FAIL=0 WARN=2 SKIP=0`，exit 0。

| # | 探针 | 注入的缺陷 | 旧脚本实跑 | 新脚本实跑 | 恢复后复跑 |
|---|---|---|---|---|---|
| 1 | A10-1 | 项目侧 `.agent-framework/git.md` 全量转 CRLF（**纯行尾差异**） | `[FAIL] A10 规范与中央仓有 1 处差异` / **exit 1** | `[PASS] A10` / exit 0 | `[PASS] A10` / exit 0 |
| 2 | A10-2 | 同一文件第 101 字节取反（**1 字节实质差异**） | `[FAIL] A10 … 1 处差异` / exit 1 | `[FAIL] A10 … 1 处差异（行尾已归一化）` / **exit 1** | `[PASS] A10` / exit 0 |
| 3 | A14-1 | 项目侧 `shared/scripts/audit-project.py` 第 201 字节取反 | **无 A14 检查**，exit 0（漂移无人看护） | `[FAIL] A14 审计脚本与中央仓权威副本不一致（同步会覆盖门禁自身）` / **exit 1** | `[PASS] A14 逐字节一致` / exit 0 |
| 4 | A7-1 | `.agent-framework/collaboration.md` 追加 `{{PROBE_TOKEN}}` | `[WARN] A7 1 处占位符残留` / **exit 0** | `[FAIL] A7 1 处占位符残留` / **exit 1** | `[PASS] A7 无占位符残留（检查 8 个文件）` / exit 0 |
| 5 | A8-1 | 新增 `.github/workflows/probe-no-on.yaml`（无 `on:` / `permissions:`） | `[PASS] A8 3 个工作流均已声明 on 与 permissions` / **exit 0**（`.yaml` 盲区） | `[FAIL] A8 2 处不合格（共 4 个工作流）` / **exit 1** | `[PASS] A8 3 个工作流…` / exit 0 |
| 6 | A5-1 | 移除 `tasks/done/TASK-063-writeback-closure/TASK.md` Meta 的 `Task ID:` 行 | `[WARN] A5 编号唯一（62 个）…` / **exit 0** | `[FAIL] A5 1 个档案的 Meta Task ID 不可解析` / **exit 1** | `[WARN] A5 编号唯一…` / exit 0 |
| 7 | A11-1 | 删除 `AGENTS.md` §14.1 必需检查声明表 | `[WARN] A11 AGENTS.md 未声明必需检查表` / **exit 0** | `[FAIL] A11 AGENTS.md 未声明必需检查表` / **exit 1** | `[PASS] A11 3 个必需检查名…` / exit 0 |
| 8 | A9-1 | 删除 `.github/PULL_REQUEST_TEMPLATE.md` | `[WARN] A9 缺少 PR 模板` / **exit 0** | `[FAIL] A9 缺少 PR 模板` / **exit 1** | `[PASS] A9 PR 模板覆盖必需字段` / exit 0 |
| 9 | A13-1 | 临时移走全部 `Level: L` 档案（TASK-061 / TASK-063） | — （A13 逻辑未改） | `[SKIP] A13 无 L 级档案在检（跳过 61 个非 L 级档案）` / **exit 0** | `[PASS] A13 2 个 L 级档案均含 Merge Record` / exit 0 |
| 10 | CMP-1 | `cmp` 项目副本 vs 中央权威副本 | — | `cmp` exit 0，**IDENTICAL** | — |

**扫描范围对照（AC-3「维持或扩大」）：** A7 旧/新均为 **8 个文件**（`.agent-framework/*.md` 7 + 根 `AGENTS.md`）；
A8 旧为 3 个工作流（`*.yml`），新为 3 个（`*.y*ml`，注入 `.yaml` 后在检 4 个）。

**现有档案全过（AC-5）：** 分支上 64 个 `TASK.md` 全部含可解析的 Meta `Task ID`，
A5 实跑 `[WARN] 编号唯一（63 个）；断档 1 处、已登记豁免 1 组`，无 FAIL。

---

## 4. 跨仓登记（Requirements 5）

| 仓 | 分支 | 提交 | 内容 |
|---|---|---|---|
| `huyanluanyuqaq/agent-framework`（中央规范仓） | `fix/TASK-064-audit-script-authority` | `48e892d63f5f66162bb3ee9d78335698699157d1` | `shared/scripts/audit-project.py`：A14 + A10 行尾归一化 + `sk-` 回 HARD + A5/A7/A8/A9/A11 修正 |
| 同上 | 同上 | `4bdca167faf16a09ea609a413cb9d8c664ef6bd3` | `.agents/github.md` §3：字段清单统一为 10 项切分 |
| `huyanluanyuqaq/shadcn-admin` | `fix/TASK-064-gate-fixes-and-authority-alignment` | `079c16b` 起 | 项目侧落地：脚本 + `.agent-framework/github.md`（由中央同步）+ 文档订正 + 本文件 |

**先后关系：** 中央仓先落地并**已推送**（`48e892d` / `4bdca16`，2026-11-05），
**之后**才按 `sync-framework.py` 的同一 `shutil.copy2` 语义把 `.agents/github.md` 与
`shared/scripts/audit-project.py` 复制到项目侧，`cmp` 逐字节一致。
`sync-framework.py` 本体在非 `main` 分支上会被拒（实测 exit 1：
`[FAIL] 当前分支 fix/TASK-064-gate-fixes-and-authority-alignment != main`），
故在交付分支上按其 copy 语义手工执行同一操作；`framework-version.json` **不在**本次同步范围
（本任务不是框架版本发布）。

---

## 5. 残留事项（移交审查位）

1. **A10 / A14 在 CI 单仓 checkout 内必然降级为 WARN**（中央仓不可达）。适用条件已在本文件与
   TASK-064 档案写明；是否补 CI 侧校验需人类另议。**不得声称 CI 已强制。**
2. **中央仓 `templates/project/.agent-framework/github.md` 与 `.agents/github.md` 已存在既有漂移**
   （本次改动前即缺 TASK-062 新增的「模板：项目侧用 …」一行；本次又扩大差距）。
   该文件不在 TASK-064 File Scope 内，**未改**；新项目由 `create_project.py` 从该模板创建，
   会拿到旧口径副本。建议另立任务处理。
3. **`shared/scripts/README.md` 仍描述已删除的 `audit_framework.py`**，且未提及 `audit-project.py`。
   同为既有漂移、不在本任务 File Scope 内，**未改**。
4. **`docs/operations/collaboration-audit.md` / `known-pitfalls.md` 仍引用 `scripts/audit-repo.py`**
   —— 属历史审计记录与事件记录，按「不回溯修改历史档案」原则**未改**；与本次订正的
   `negative-assertion-review.md`（现行判据清单）性质不同。
