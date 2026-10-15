# 双 Agent GitHub 协作框架 — 阶段 A 设计方案（草案 v1）

> **文档性质：待评审草案，尚未生效。**
> 本文件是「基于 GitHub 的通用双 Agent 协作框架」任务的**阶段 A 交付物**。
> 它**不是规则**，不被任何 Agent 自动加载，也不改变现有 `.agents/rules/*`、`projects/*/AGENTS.md` 的效力。
> 只有在 §17「需要用户决策的事项」获得批准后，才由阶段 B 按 §16 的清单落地为正式规则与模板。
>
> 生成日期：2026-10-14 · 调研方式：只读（未修改任何现有规则、代码或 GitHub 远程配置）
>
> **裁决进展（2026-10-14）：全部阻塞项已裁决。**
> D1（不引入第二账号）· **D1b（保留 PR：甲）** · D2（`TASK.md` 为准）· D3（门禁按 D1b 修订为"必需 PR + 必需检查"）· D7（仅 `shadcn-admin` 先行）· D8（tag-only 发布）· D11（上游 PR 模板替换）
> —— 均已裁决；D4/D5/D6/D9/D10 默认采纳。**D12 已于 2026-10-15 授权并执行完毕；D13 已于 2026-10-15 裁决为选项 C**（见 §17.3）。明细见 §17.1。
>
> **D1b 裁决经过（同日）：** 先裁为"乙（不使用 PR）"，后经 §9.4.7 核实——**单账号本就允许"创建 PR 并自行合并"**，
> GitHub 仅禁止"自我批准"。故"甲"**不需要**第二个账号；原选"乙"的理由（"单账号用不了 PR"）不成立。
> **最终裁决：甲**（保留 PR 作差异与 CI 载体，`Require approvals = 0`）。裁决影响见 §9.4.6。
>
> **核心结论：** 双 Agent 的审查机制**回归文件层**（`TASK.md` + `handoffs/`），
> **不使用 Issue 参与审查、不启用平台审批、不引入第二个 GitHub 账号**；
> 但**保留 Pull Request**作为代码差异与 CI 门禁的载体 —— 这是唯一能让 CI **真正拦截**的结构。
> **落地形态 = 现有实践（§2.5）+ 引入 PR 门禁（§7.4）+ 规则/模板/审计（阶段 1）。**

---

## 0. 结论摘要（先读这一节）

本次调研得出 **1 个硬阻断、3 个必须由用户裁决的架构取舍、11 类缺陷**。

| # | 结论 | 证据位置 |
|---|------|---------|
| ★1 | **GitHub Issue 载体当前不可用。** `shadcn-admin` 仓库 `has_issues=false`（Issues 关闭）；`business-manager` 为私有仓库，现有 `gh` 凭据无任何访问权。以 Issue 为起点的流程**今天无法启动**。→ **已由 D2 化解：Issue 不参与审查与状态，本框架改为以 `TASK.md` 为事实来源** | §2.4 E2/E3 |
| ★2 | **当前可写身份的凭据与 `gh` CLI 身份是两个人。** Git 推送走 SSH = `huyanluanyuqaq`（仓库所有者，有 admin）；`gh` CLI 登录身份 = `ndldsn`（对 `shadcn-admin` 仅 `pull`，对 `business-manager` 404）。**因为 D1b=甲 需要创建 PR，`gh` 的可写权限成为硬前置——这是甲方案唯一的新增依赖。** | §2.4 E1/E4 / §7.4.4 |
| ★3 | **"禁止直接推 main" 是文本文档，不是平台约束。** 两个仓库均**无分支保护、无 ruleset、无必需检查**；实际历史是「本地 fast-forward 合并后直接 push main」。文档禁止与平台能力之间存在实质落差。→ 缓解措施见 §7.4 与阶段 3 | §2.4 E5 / §2.5 |
| ★4 | **合并即发布。** `shadcn-admin` 的 `docker.yml` 在 push main 时构建并推送多架构镜像到 Docker Hub。→ **已由 D8 化解：改为 tag-only 触发** | §2.4 E6 / §9.2 |
| ★5 | **`.agents/` 框架本身不受版本控制。** 工作空间根目录不是 Git 仓库，规则无历史、无评审、无回滚。与框架自身 P1「文件即状态」及目标框架「长期决策存入版本控制」的要求相悖。 | §2.1 / §3.1 P-05 |
| ★6 | **任务状态的唯一事实来源定为仓库内文件（`TASK.md`）。** 与任务书默认口径（"Issue 维护任务整体状态"）**不同**，已获用户确认。理由与利弊见 §5.2 决策 D2 | §5.2 / §17.1 |
| ★7 | **甲方案不需要修改 `ci.yml`。** 现有 `ci.yml` 已具备 `pull_request: branches: [main]` 触发，PR 一旦建立，检查即在 **PR head** 上运行——这正是"合并前完成检查"所需的时序。**§7.3 那条"必须增加工作分支 push 触发"只对乙成立。** | §7.4.2 / §7.3 |

---

## 1. 调研范围与方法

| 项 | 说明 |
|----|------|
| 调研对象 | 工作空间 `E:\NDLDSN-WORKSPACE`（工作空间级）、`projects/shadcn-admin`、`projects/business-manager` |
| 方法 | 文件系统遍历、规则文件通读、`git` 元数据检查、GitHub REST/GraphQL 实测（`gh api`）、SSH 身份实测 |
| 只读保证 | 未创建/修改/删除任何既有规则、代码、配置；未改动 GitHub 远程设置；未推送、未合并、未创建分支 |
| 本次新增文件 | 仅本提案文件本身（`.agents/proposals/`，新建目录） |
| 未做的事 | 未执行任何 `gh` 写操作；未读取仓库 Secrets（无权限）；未访问生产环境 |

**方法论声明：** 本方案严格区分三类事实——
① **文档要求**（规则文件怎么写的）；② **平台权限**（账号实际能做什么，实测）；③ **自动化能力**（机器可验证什么，实测）。
三者**不得混为一谈**。下文所有平台类断言均附实测命令。

---

## 2. 现状调研报告

### 2.1 工作空间拓扑

```
E:\NDLDSN-WORKSPACE\                 ← 不是 Git 仓库（无 .git）
├── AGENTS.md                        ← 工作空间级 Agent 入口协议（11 KB）
├── README.md                        ← 人类可读框架说明（10.7 KB）
├── .gitignore                       ← 仅忽略工作空间层临时产物
├── .agents/                         ← Agent 工作规范（31 个文件）
│   ├── roles/        (9)            8 角色定义 + README
│   ├── workflows/    (6)            feature/bugfix/refactor/research/release + README
│   ├── rules/        (5)            coding/git/testing/security/documentation
│   ├── protocols/    (9)            rule-precedence/change-safety/permissions/handoff/
│   │                                task-lifecycle/collaboration/role-assignment/
│   │                                project-adoption + README
│   ├── state/        (1)            仅 README，实际为空（符合设计预期）
│   └── proposals/    (1)            ← 本次新增（本文件）
├── .claude/                         ← 空目录
├── .workbuddy/                      ← 工作空间本地数据（含一份 shadcn-admin 备份）
├── .workbuddy-ai/backup-TASK-000/   ← 遗留备份副本（与 business-manager 内容重复）
├── Claw/                            ← 桌面截图脚本（与协作框架无关）
├── data/                            ← 工作空间根下的 SQLite 产物（app.db + shm + wal）
├── projects/
│   ├── README.md                    ← 项目清单（Discovery 入口）
│   ├── business-manager/            ← 独立 Git 仓库（私有）
│   └── shadcn-admin/                ← 独立 Git 仓库（公开 fork）
├── shared/
│   ├── scripts/  create_project.py · git-ref-repair.sh · README.md
│   ├── tools/    README.md（空）
│   └── knowledge/README.md（空）
└── templates/
    ├── project/  ├── task/TASK.md  ├── handoff/HANDOFF.md  └── adr/ADR.md
```

**实测：** `git rev-parse --show-toplevel` → `fatal: not a git repository`。
**推论：** 工作空间级规则（`AGENTS.md`、`.agents/**`、`templates/**`）**没有版本历史、没有评审机制、无法回滚**。

### 2.2 版本控制与仓库实况

| 仓库 | 远程 | 可见性 | 默认分支 | 当前 HEAD | 工作区状态 |
|------|------|--------|---------|-----------|-----------|
| `projects/shadcn-admin` | `git@github.com:huyanluanyuqaq/shadcn-admin.git`（SSH） | **public**（fork of `satnaing/shadcn-admin`） | `main` | `main` @ `05bf884` | **干净** |
| `projects/business-manager` | `git@github.com:huyanluanyuqaq/business-manager.git`（SSH） | **private** | `main` | `bugfix/TASK-011-customers-table-fill-remaining-width` | **有未提交内容**：未跟踪目录 `tasks/backlog/TASK-012-subscription-pool-duplicate-url/` |

`shadcn-admin` 远端分支（实测 `git ls-remote --heads origin`）：

```
refs/heads/main
refs/heads/feat/TASK-028-notification-customer-name      ← 已合并，未删除
refs/heads/feat/TASK-029-customer-row-expand-panel        ← 已合并，未删除
refs/heads/feat/TASK-030-subscription-row-expand-panel    ← 已合并，未删除
```

**发现：** 三个已合并分支残留远端，与 `.agents/rules/git.md` §5「合并后删除已合并的分支」不符。

### 2.3 现有协作框架（`.agents/`）能力盘点

**已具备（成熟、可复用，不应推翻）：**

| 能力 | 载体 | 状态 |
|------|------|------|
| 角色体系 | `.agents/roles/` 8 角色 | ✅ 完整（含"角色不绑定 Agent 产品"原则） |
| 职责分离 I1/I2 | `permissions.md` §3 P3 + `role-assignment.md` §2 | ✅ **已列为受保护规则**，不可削弱 |
| 任务单元与状态机 | `task-lifecycle.md` 10 状态 / 4 物理目录 | ✅ 已被 30 + 11 个真实任务验证 |
| 交接协议 | `handoff.md` 12 必填字段 | ✅ 完整 |
| 规则继承与冲突裁决 | `rule-precedence.md` 双轴模型 | ✅ 完整 |
| 高风险变更门禁 | `change-safety.md` 六步流程 | ✅ **已列为受保护规则** |
| 并行冲突机制 | `collaboration.md` 四层轻量机制 | ✅ 完整 |
| 项目接入 | `project-adoption.md` + `templates/project/` | ✅ 有两个真实案例 |

**明确缺失（正是本次任务要补的空白）：**

- `.agents/protocols/` 下**没有任何一个文件涉及 GitHub**——无 Issue、无 PR、无 Actions、无 CODEOWNERS、无分支保护、无平台权限模型。
- `.agents/rules/` 下**无 `github.md`**。
- `templates/` 下**无 GitHub 模板包**（无 `ISSUE_TEMPLATE/`、无 `PULL_REQUEST_TEMPLATE.md`、无 `CODEOWNERS`、无 `workflows/`）。
- 无任何脚本或工具做框架自检（链接、YAML、密钥、占位符）。

### 2.4 GitHub 平台实况（实测矩阵）

> 下列全部为**实测结果**，非推断。命令与输出见附录 §18。

| # | 项 | 实测结果 | 影响 |
|---|----|---------|------|
| **E1** | SSH 身份 | `ssh -T git@github.com` → `Hi huyanluanyuqaq!` | 推送身份 = 仓库所有者（有 admin） |
| **E2** | `gh` CLI 身份 | `gh auth status` → 账号 `ndldsn`，scopes `gist, read:org, repo, workflow`，协议 `https` | **与 E1 不同人**；且缺 `admin:repo_hook` 等管理类 scope |
| **E3** | `shadcn-admin` 仓库属性 | `has_issues=false`、`has_projects=true`、`has_wiki=false`、`private=false` | **Issues 关闭** → 任务登记载体不可用 |
| **E4** | `shadcn-admin` 当前凭据权限 | `permissions = {admin:false, maintain:false, push:false, triage:false, pull:true}` | `ndldsn` **只读**：无法建 Issue、无法推分支、无法建 PR |
| **E5** | 分支保护 | `GET /branches/main/protection` → **404 Not Found**；`GET /rulesets` → **`[]`** | `main` **完全无保护**；"禁止直接推 main"无平台强制 |
| **E6** | Actions 工作流 | `ci.yml`（push main / PR main）、`docker.yml`（push main + `v*` tag + dispatch）、`stale.yml`（定时） | 存在可用的自动化底座；**docker.yml 使合并 = 对外发布** |
| **E7** | 最近 Actions 运行 | TASK-029/030 相关 run 全绿（CI `38412560652` / Docker `38412561363`） | CI 可信，可作为必需检查候选 |
| **E8** | `business-manager` | `gh api repos/.../business-manager` → **404**；SSH `ls-remote` → **成功，仅 main** | 私有仓库，**现有 gh 凭据完全不可达** |
| **E9** | `business-manager` CI | 仅 `.github/workflows/docker.yml`（无 CI、无测试、无 lint） | 该仓库**无法设置"必需测试检查"**门禁 |
| **E10** | Issue/PR 模板 | `shadcn-admin`：2 个**上游遗留** md 模板 + `config.yml`（`blank_issues_enabled:false` + 指向 `satnaing` 上游 Discussions）；`business-manager`：**无** | 模板与"自托管二次开发"现实不符；business-manager 全缺 |
| **E11** | `CODEOWNERS` | 两个仓库均**不存在** | 无文件所有权与审查指派声明 |
| **E12** | Issue / PR 历史 | 两个仓库**均无任何 Issue、无任何 PR** | 目标流程**零先例**，属全新引入 |

### 2.5 现行协作闭环（实测，非文档描述）

以 `shadcn-admin` TASK-030 的真实提交链为证：

```
1. 主控（人类）下达需求
2. 执行 Agent 创建 tasks/backlog/TASK-030-<slug>/TASK.md + handoffs/
3. git checkout -b feat/TASK-030-<slug>
4. 实现 → 本地 pnpm lint / pnpm test / pnpm build
5. git commit  (Conventional Commits + footer `Refs: TASK-030`)
6. git push -u origin feat/TASK-030-<slug>
7. 审查（另一会话扮演 Reviewer，或以 Handoff 记录自检）
8. TASK.md Status → REVIEW → DONE，目录 mv → tasks/done/
9. git checkout main && git merge --ff-only feat/TASK-030-<slug>
10. git push origin main          ← 直接推送默认分支
11. 补 TASK.md「Merge Record」（记录 CI run id / Docker run id）
12. 归档提交单独推送
```

**与目标框架的差距：**

| 目标阶段 | 现状 | 差距性质 |
|---------|------|---------|
| 1 需求登记为 Issue | **无 Issue**（且仓库 Issues 关闭） | ❌ 载体缺失 |
| 2 方案与任务分配 | TASK.md 承担（完整） | ✅ 已具备，仅需映射 |
| 3 任务认领与执行前检查 | TASK.md `Owner` / `Owner Since` | ✅ 已具备 |
| 4 分支隔离 | `<type>/TASK-NNN-slug` 已执行 | ✅ 已具备（命名待统一，见 §4 C-04） |
| 5 实施与提交 | Conventional Commits + `Refs:` | ✅ 已具备 |
| 6 Pull Request 交付 | **无 PR**，改用 Handoff + 直接推 main | ❌ 载体缺失 |
| 7 自动化检查 | CI 已跑，但**非必需检查**（无分支保护） | ⚠️ 跑而不拦 |
| 8 主控审查代码差异 | 审查存在，但**无平台记录** | ⚠️ 证据在文件、不在平台 |
| 9 整改与复审 | Handoff 回退链存在 | ✅ 已具备 |
| 10 合并与归档 | 本地 ff-merge + 直推 main | ⚠️ 绕过平台门禁 |

**关键洞察：** 现有框架在**"文件层"已经完成了目标框架约 80% 的工作**，缺的是
① **PR 作为交付与门禁载体**（由此使 CI 在合并前生效、`main` 不可直推，见 §7.4）、
② **规则的 GitHub 章节与模板**（`.agents` 与 `templates/` 下完全空白）、
③ **框架自检能力**。
> **注（裁决后修正）：** 原判断中的"平台层载体（Issue / PR / 分支保护）"一项，
> **PR 与分支保护两者已在甲方案中引入**（D1b=甲）；仅 **Issue 不引入**（D2：不参与状态与审查）。
→ 因此本方案的正确策略是**在现有框架上做加法**，而不是另起一套并行制度。

---

## 3. 主要问题、风险与改进机会清单

### 3.1 主要问题（P）

| ID | 问题 | 证据 | 严重度 | 处置建议 |
|----|------|------|--------|---------|
| **P-01** | Issue 载体不可用：主要仓库 Issues 关闭，另一仓库私有且不可达 | E3 / E8 | 🔴 阻断 | 启用 Issues（需 admin）；或采用 §5.2 决策 D2 的「文件为准」方案 |
| **P-02** | 身份不可分离：唯一可写身份是单一 GitHub 账号 | E1 / E2 / E4 | 🔴 阻断 | §5.3 决策 D1：引入第二身份，或明确披露"制度门禁 ≠ 平台门禁" |
| **P-03** | 文档禁止与平台能力落差：`git.md` 禁止直推 main，但 main 无任何保护 | E5 / §2.5 | 🔴 高 | 建立分支保护；并在规则中显式标注"未设保护时该禁令仅靠自觉" |
| **P-04** | 合并即发布：push main 触发 Docker Hub 多架构镜像推送 | E6 | 🟠 中高 | 改为 tag 触发，或对合并加发布审批；Level 3 自动合并须排除本仓库 |
| **P-05** | `.agents/` 框架无版本控制 | §2.1 | 🟠 中高 | 决策 D9：纳入 Git（须先处理嵌套仓库，见 `projects/README.md`） |
| **P-06** | Actions 权限最小化缺失：`ci.yml` 无 `permissions:` 块 | §2.4 / ci.yml 原文 | 🟠 中 | 每个工作流显式声明 `permissions:` |
| **P-07** | 供应链与依赖安全无覆盖：无 `dependabot.yml`、无 `SECURITY.md`、CI 无依赖审计 | E10/E11 同区 | 🟡 中 | 补 `dependabot.yml` + CI 审计 job |
| **P-08** | 上游遗留资产未清理：`CONTRIBUTING.md` / `ISSUE_TEMPLATE/config.yml` 指向 `satnaing` 上游 Discussions；`netlify.toml` 亦为遗留 | E10 | 🟡 中 | 改为本仓库自述；或在 `AGENTS.md` 显式标注"上游遗留，不适用" |
| **P-09** | 已合并远端分支未删除（3 个） | §2.2 | 🟡 低 | 授权后删除；或在规则中明确"保留用于追溯"为例外并说明 |
| **P-10** | `stale.yml` 会按定时任务关闭不活跃 Issue/PR | E6 | 🟡 低（启用 Issues 后升为中） | 启用 Issues 前先评估/停用，否则协作记录会被自动关闭 |
| **P-11** | 工作空间根 `data/app.db`（含 -shm/-wal）为脱离项目的运行时产物 | §2.1 | 🟢 低（卫生） | 确认无引用后清理；若工作空间 git init，须先加入 `.gitignore` |

### 3.2 一致性缺陷（C，规则冲突/重复）

> 对应任务书第 7 项「分析现有规范之间的重复、冲突、缺失和维护成本」。

| ID | 冲突/重复 | 具体表现 | 处置建议 |
|----|----------|---------|---------|
| **C-01** | 合并策略**三处不一致** | ① `.agents/rules/git.md` §5：优先 **squash**，保留线性历史；② `business-manager/AGENTS.md` §10：用**普通 merge 保留 merge commit**；③ `shadcn-admin` 实践：**fast-forward** 合并 | 统一为一种默认 + 项目显式覆盖。**D1b=甲 后 PR 提供合并方式选择**，建议统一为 **rebase-merge**（`gh pr merge --rebase`，保持线性史，= D5） |
| **C-02** | 分支 `type` 词表不一致 | 规则：`feature`/`bugfix`/…；实践：`feat/…`、`bugfix/…`；任务书：`feat/`…`test/` | 统一词表（建议以 `<type>` 与 Conventional Commits type 对齐：`feat/fix/docs/refactor/test/chore/perf/build/ci`），并在 `git.md` 内改为引用 |
| **C-03** | 状态词表两套 | `.agents` 10 态（BACKLOG/READY/ACTIVE/DESIGN/BLOCKED/CHANGES_REQUESTED/TEST_FAILED/REQUIREMENT_CHANGED/REVIEW/DONE）vs 任务书 8 态（planned/ready/in_progress/review/rework/blocked/completed/cancelled） | **不收编两套**。保留 10 态为规范，任务书 8 态作为**别名映射**（§9.1），避免"重复维护多套状态来源" |
| **C-04** | 任务标识符口径冲突 | 规则与历史：`TASK-NNN`；任务书：`issue-编号` | 建议保留 `TASK-NNN` 为稳定主键（离线可得、跨仓库稳定、30+11 个先例），Issue 编号作为**可选的关联字段**（§5.2 D6） |
| **C-05** | 规则优先级模型**写了两份** | 根 `AGENTS.md` §3 与 `.agents/protocols/rule-precedence.md` §3 | 属 P3（单一事实来源）轻微违例。建议 `AGENTS.md` 仅保留摘要 + 指针 |
| **C-06** | 角色权限/家族**三处描述** | `roles/README.md` §使用规则、`role-assignment.md` §3–4、`permissions.md` §2–3 | 需同步维护的重复；建议以 `permissions.md` §2 为唯一矩阵，其余引用 |
| **C-07** | 完成标准（DoD）**三处描述** | `AGENTS.md` §13、`task-lifecycle.md` §4、`workflows/feature.md` §Done | 同上，建议 `AGENTS.md` §13 为唯一来源 |
| **C-08** | `business-manager` 的 `AGENTS.md` / `CLAUDE.md` 要求逐字同步 | 双文件维护；且 `CLAUDE.md` 文件名绑定具体产品 | 成本高且与"角色不绑定 Agent 产品"原则相悖；建议改为 `CLAUDE.md` → 符号链接或 5 行指针文件 |
| **C-09** | 根 `README.md` 称框架"用 Git 管理"，但根目录不是 Git 仓库 | `README.md` 第 1 节 vs 实测 | 文档与事实不符；随 D9 一并修正 |
| **C-10** | `.workbuddy-ai/backup-TASK-000/` 与 `projects/business-manager/` 内容重复 | §2.1 | 历史备份残留；确认后归档或删除（属高风险删除，须批准） |

### 3.3 改进机会（O）

| ID | 机会 | 收益 |
|----|------|------|
| O-01 | 现有 8 角色体系**已含**"职责分离 I1/I2"且已受保护 → 双 Agent 模型只需**声明映射**，零新增约束 | 落地成本极低 |
| O-02 | `TASK.md` / `HANDOFF.md` 的字段与"完整交付说明"所需字段**高度同构** → PR 描述可由 Handoff 直接渲染，无需双录（§7.2） | 消除重复维护 |
| O-03 | CI 已在 `shadcn-admin` 稳定全绿 → 可直接升级为"必需检查"，无需建设即可获得首个真实门禁 | 门禁可当天生效 |
| O-04 | `handoff.md` §4 的 12 字段**本身就是完整的交付记录** → 审查证据天然落在文件层，跨会话 / Standalone 均可读 | 一次编写、长期可查 |
| O-05 | 工作空间已有 `shared/scripts/` 先例 → 框架自检脚本有明确的落点与运行方式 | 审计可持续化 |
| O-06 | `templates/` 已有 project/task/handoff/adr 四类模板 → 新增 GitHub 模板包即可被所有未来项目复用 | 多项目复用成本低 |
| O-07 | `shadcn-admin` 是 **public** 仓库 → 第二协作者身份可零成本加入，无需付费席位 | 独立审查可达成 |

---

## 4. 设计原则与关键取舍

### 4.1 设计原则（在任务书 10 条之上，补充 4 条本项目特有原则）

| # | 原则 | 含义 |
|---|------|------|
| Pr-1 | **增量叠加，不推翻** | 现有 `.agents/` 已验证 30+ 任务，新框架只做加法；不重命名既有角色、状态、目录 |
| Pr-2 | **单一状态源** | 同一事实只在一处维护；GitHub 侧内容一律视为**投影**，不产生第二个可写源 |
| Pr-3 | **平台能力必须实测** | 任何"已启用/已保护/会拦截"的断言必须附实测命令；做不到的写"待人工验证"，不得写成已完成 |
| Pr-4 | **离线可运行** | 断网、Standalone clone、SaaS 不可用时，`TASK.md` + `handoffs/` 必须仍足以驱动协作 |

### 4.2 三个核心架构取舍（必须由用户裁决）

#### 决策 D2 — 任务状态的唯一事实来源：`TASK.md` vs GitHub Issue

| 方案 | 优势 | 劣势 |
|------|------|------|
| **A. `TASK.md` 为唯一事实来源**（推荐） | ① 离线/断网/SaaS 故障仍工作；② Standalone clone 后仍完整；③ 不依赖仓库 admin 权限，**今天即可运行**；④ 与既有 41 个任务先例一致；⑤ 无需双写 | ① 需自动化把状态投影到 Issue（Level 2）；② 非仓库成员需打开仓库才看得到任务 |
| **B. Issue 为唯一事实来源**（任务书默认） | ① 平台原生看板/筛选/指派；② 通知与 @ 提及；③ 与外部协作者门槛低 | ① **今日不可用**（E3 Issues 关闭 / E8 私有不可达）；② 断网/离线丢失可协作性；③ Standalone clone 后任务状态消失；④ 需与 `tasks/` 双写或迁移 41 个历史任务；⑤ 强制依赖仓库 admin |

**推荐 A**，并把 Issue 定义为「**TASK.md 的投影 + 人类可读索引**」：由 Actions 在 `TASK.md` 变更时同步标题/标签/状态注释。
理由：符合 Pr-4 与 Pr-1（最小改动），且不损失 B 的可见性收益。

> ⚠️ **这是对任务书 §8「原则上 Issue 维护任务整体状态」的显式偏离**，需用户确认或否决。

> **2026-10-14 裁决更新：** 用户已确认 **D2 = A（`TASK.md` 为准）**；
> 且因审查不使用 Issue（Issue 仅作 Level 2 可选的单向投影），
> 启用 Issues **不再是阶段 3 的前置操作**。

#### 决策 D3 — 平台门禁的强度：真门禁 vs 制度门禁

| 方案 | 说明 | 前提 | 代价 |
|------|------|------|------|
| **A. 真平台门禁** | `Require a pull request` + 必需检查 + 禁止绕过；GitHub **原生禁止自我批准**，从机制上保证 I2 | 需仓库 admin（**public 仓库 Free 即可**） | 每个任务多一步"建 PR → 等 CI → 合并 PR" |
| **B. 制度门禁** | 仅靠规则文件约束 Agent，平台不拦 | 无 | **"禁止直推 main" 今天即是此状态，实测已失效**（E5） |
| **C. 混合** | 必需检查用真门禁（免人工）；审批用制度门禁 + 事后审计 | 需 admin | 审批环节仍可被单身份绕过 |

**原推荐 A**（`shadcn-admin` 先行），`business-manager` 因无 CI 与私有不可达，暂用 C 并明确披露。

> **2026-10-14 裁决更新（最终）：** 见 §9.4.6 —— **D1b = 甲**：保留 PR，`Require approvals = 0`，
> 不引入第二账号。**D3 修订为「真平台门禁 = `Require a pull request` + 必需状态检查 + 禁止绕过」**，
> 即实际落在 **A**：CI 在合并前**真正拦截**，`main` 不可直推；唯一不获平台强制的仍是"实现者 ≠ 批准者"。
> 本节保留原始选项表作为决策依据记录。

#### 决策 D1 — 身份与审查独立性

| 方案 | 能否满足 I2（实现者≠批准者） | 说明 |
|------|---------------------------|------|
| **A. 双 GitHub 身份** | ✅ 平台级强制 | 第二身份（新账号或机器账号）作为协作者；配合 "Require approvals ≥ 1"，GitHub 会**拒绝自我批准** |
| **B. 单身份 + 换会话审查** | ⚠️ 仅制度级 | 沿用 `role-assignment.md` §4.3；须在 `TASK.md` Known Issues 记录"平台未强制" |
| **C. 单身份 + admin bypass** | ❌ 削弱 | 管理员绕过保护 = 门禁形同虚设，与"不得削弱受保护规则"冲突 |

**原推荐 A。** 若用户不愿引入第二身份，则必须接受 B，且本框架需**如实标注**：该场景下"独立审查"是流程约定而非平台约束。

> **2026-10-14 裁决：用户选择 B（单身份 + 换会话审查）。**
> 平台门禁仍启用（甲组合：必需 PR + 必需检查 + 禁止绕过），**唯独不含 `Require approvals`**。
> 因此本框架必须持续声明：**"实现者 ≠ 批准者"无平台强制**，靠流程约束（§9.4.5 三条补救措施）。

#### 补充决策（详见 §17）

- **D5 合并策略统一**（squash / merge commit / ff-only）
- **D6 任务标识符**：`TASK-NNN` 为主键
- **D7 落地顺序**：`shadcn-admin` 先行，`business-manager` 暂缓
- **D8 `docker.yml` 触发条件**：保留 push main / 改 tag-only
- **D9 `.agents/` 是否纳入 Git**
- **D10 Level 3 是否纳入本期**

---

## 5. 目标架构

### 5.1 三层载体模型（核心设计）

```
┌──────────────────────────────────────────────────────────────────────┐
│ 层 1 · 文件层（唯一事实来源 · 始终可用 · 随仓库版本化）                │
│   tasks/<state>/TASK-NNN-slug/TASK.md     ← 任务状态、范围、验收标准   │
│   tasks/.../handoffs/HANDOFF-*.md         ← 交接、审查、整改记录 ★核心 │
│   docs/**                                  ← 架构、规范、ADR、运维      │
│   AGENTS.md                                ← 规则入口与继承             │
│   【性质】可离线 · 可 Standalone · 断网仍完整 · 无平台依赖              │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ 审查结论回写文件层；平台仅承载差异与检查（D1b=甲）
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 层 2 · 平台层（代码交付、差异讨论与机器验证 · 需仓库写权限）           │
│   Branch  ── <type>/TASK-NNN-slug（隔离边界）                         │
│   Commits ── 变更历史 + `Refs: TASK-NNN`                              │
│   PR      ── 差异 + 审查评论 + 合并记录（**交付与门禁载体**）          │
│   Actions ── 机器验证（**在 PR head 上运行**，见 §7.4）               │
│   main    ── 合并落点（分支保护 + 必需检查强制）                       │
│   ✗ Issue   不使用（D2：Issue 不参与审查，仅 Level 2 可选投影）        │
│   【性质】在线 · 依赖权限 · 只做验证不决策 · 不承载不可再生信息        │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ 授权（人）
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 层 3 · 授权层（人类门禁 · 不可自动化 · 受保护）                       │
│   高风险操作批准（生产/迁移/密钥/权限/不可逆）                          │
│   发布授权（D8 后：打 tag 即发布，不再由合并触发）                      │
│   规则与权限定义的修改批准                                             │
└──────────────────────────────────────────────────────────────────────┘
```

**层间规则（不可违反）：**

| 规则 | 内容 |
|------|------|
| L1 自持 | 层 1 不依赖层 2 才能运转；平台不可用（断网/无权限）时协作照常进行 |
| L2 不承载独有事实 | 层 2 **只产生**"检查通过/失败""代码差异""审查评论"；**一切结论必须回写** `handoffs/`（否则跨会话丢失） |
| L2→L3 需人授权 | Actions 与 Agent **均不得**自行批准层 3 的操作 |
| L1 缺失即阻断 | 若 `TASK.md` 不存在 → 该任务**不得**创建 PR 或产生提交（防止无记录变更） |
| Issue 不参与 | D2 裁决：Issue 既不承载任务状态，也不参与审查；任何"仅存在于 Issue、未落文件"的信息，视为**不存在** |

### 5.2 目标目录结构

> **重要澄清（对任务书 §9 的修正）：** `.github/`、`CODEOWNERS`、`workflows/` 是 **GitHub 仓库级**产物。
> 本工作空间根目录**不是 Git 仓库**（`projects/*` 才是），因此任务书 §9 的 `repository/` 结构
> **应施加于每个项目仓库**，而非工作空间根。工作空间级只需要 `AGENTS.md` + `.agents/` + `templates/` + `shared/`。

**A. 工作空间级（非 Git 仓库，纯文件）**

```
E:\NDLDSN-WORKSPACE\
├── AGENTS.md                     [改] 增 §GitHub 协作入口 + 双 Agent 声明（C-05 收敛）
├── README.md                     [改] 修正"用 Git 管理"表述（C-09）
├── .agents/
│   ├── protocols/
│   │   ├── dual-agent-model.md            [新] 双 Agent 角色矩阵/认领/边界/升级/状态流转/多 Agent 扩展
│   │   ├── github-collaboration.md        [新] 分支/提交/Actions/合并/审查落文件/身份独立性披露
│   │   └── github-capability-matrix.md    [新] 文档要求 / 平台权限 / 自动化能力 三分表（含实测命令）
│   ├── rules/
│   │   └── github.md                      [新] 可判定的 GitHub 操作红线（与 git.md 互补，不重复）
│   └── proposals/                         [已建] 本草案
├── templates/
│   ├── github/                            [新] 可复用 GitHub 模板包（**已按 D1b=甲 定稿**）
│   │   ├── PULL_REQUEST_TEMPLATE.md       映射 HANDOFF 12 字段 + 执行者自检清单
│   │   ├── dependabot.yml
│   │   ├── RULESET.md                     平台门禁配置说明 + 实测状态（V2）
│   │   └── workflows/{ci-generic.yml,ci-node-pnpm.yml}
│   │   ✗ ISSUE_TEMPLATE/ · CODEOWNERS  → 不落地（理由见 §5.2 与 §7.4.1）
│   └── project/AGENTS.md                  [改] 增 GitHub 协作节 + 双 Agent 分配声明位
└── shared/scripts/
    ├── audit_framework.py                 [新] 本地可跑的框架自检（无网络）
    └── github_setup_checklist.md          [新] 需人工在网页/CLI 完成的清单（含幂等 gh 命令）
```

**B. 项目级（每个项目仓库，以 `shadcn-admin` 为首个落地目标）**

> **D1b = 甲 的裁决影响：** 恢复创建 `PULL_REQUEST_TEMPLATE.md`（PR 是甲方案的交付与门禁载体）。
> **`CODEOWNERS` 仍不落地** —— 它只用于"自动请求特定审查者"，而 `Require approvals = 0` 时无审批环节，
> 因此它在本组合中不产生任何强制力（理由与"乙不用 PR"不同，注意区分）。
> **`ISSUE_TEMPLATE/` 亦不新增**（Issue 不参与审查，启用 Issues 仍非前置条件）。

```
projects/shadcn-admin/
├── AGENTS.md                     [改] §GitHub Collaboration：Agent 分配 / 分支 / 合并策略 / 门禁声明
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md  [改] 由上游模板**替换**为本框架的交付模板（映射 HANDOFF 12 字段）
│   ├── dependabot.yml            [新] 依赖更新（P-07、O-07）
│   └── workflows/
│       ├── ci.yml                [改] 加 `permissions:`、加框架审计 job、node 版本对齐
│       │                              （**无需新增工作分支触发**——现有 `pull_request` 触发即为甲所需，见 §7.4.2）
│       ├── docker.yml            [改] 依 D8 改为 tag-only 触发
│       └── stale.yml             [评估] 见 P-10（无 Issue 时影响降低，仍建议停用或延后）
└── docs/
    ├── agent-collaboration.md    [新] 项目内协作细则（引用工作空间协议，不复制）
    └── git-workflow.md           [新] 项目内分支/提交/PR/合并细则
```

**上游遗留文件的处置（`shadcn-admin` 现有）：**

| 文件 | 处置 | 理由 |
|------|------|------|
| `.github/PULL_REQUEST_TEMPLATE.md` | **替换**为本框架模板，并在 `AGENTS.md` §13 记录"已本地化，上游同步时注意" | 上游模板字段与本框架的 HANDOFF 12 字段不对应（D11=甲） |
| `.github/ISSUE_TEMPLATE/**` | **保留不动**，在 `AGENTS.md` §13 标注"上游遗留，本流程不使用" | Issues 当前关闭（E3），模板不生效；替换无收益 |
| `.github/CONTRIBUTING.md` | 保留，但需修正指向上游 Discussions 的链接（P-08），并补充"PR 为必经环节"一句 | 避免误导 |
| `.github/FUNDING.yml`、`CODE_OF_CONDUCT.md` | 保留不动 | 上游遗留，非本框架职责 |

**刻意不创建**（避免机械照搬）：

| 不创建 | 理由 |
|--------|------|
| `docs/technical-spec.md`、`coding-standards.md`、`testing.md`、`security.md`（任务书 §9 列举） | `shadcn-admin` 已有 `docs/technical/`、`docs/architecture/`、`docs/operations/`；`coding-standards`/`security` 已由 `.agents/rules/` 提供（P3 禁止复制） |
| `.github/CODEOWNERS` | **D1b=甲 + `approvals = 0`：无审批环节，CODEOWNERS 不产生强制力**（它只自动请求审查者，不阻止合并） |
| `.github/ISSUE_TEMPLATE/task.yml` 等新增模板 | Issue 不参与审查；启用 Issues 非前置（D2） |
| `Projects` 看板 | 可选，Level 2 再评估；`has_projects=true` 但当前无使用需求 |

### 5.3 规则继承与冲突处理（扩展 `rule-precedence.md`，不新建模型）

```
① 受保护规则（不变）：
   security.md · git.md §6 · testing.md §6 · permissions.md §3 P3 · change-safety.md
                          │
                          ▼ 以下按具体性递增
② [新] 工作空间 GitHub 通用规则： .agents/rules/github.md
                                .agents/protocols/{dual-agent-model,github-collaboration}.md
③ [新] 项目 GitHub 规则：       projects/<name>/AGENTS.md §GitHub Collaboration
④     Task 规则：               TASK.md §Task Rules
⑤     GitHub 平台配置（不是"规则"，是强制手段；D1b=甲 后的实际清单）：
        分支保护/Rulesets：✅ Require a pull request before merging
                          ✅ Require status checks to pass（选定 ci.yml 的 job 名）
                          ✅ Do not allow bypassing the above settings
                          ✅ 禁止 force push · 禁止删除分支 ·（可选）强制线性历史
                          ⛔ Require approvals 固定为 0 · ⛔ 不使用 CODEOWNERS
⑥     当前任务上下文
```

**新增的判定条款：**

| 场景 | 裁决 |
|------|------|
| 项目想放宽必需检查（例如"跳过测试"） | ❌ 涉及 `testing.md` §6 → 受保护，拒绝 |
| 项目想用 ff-only 合并替代默认策略 | ✅ 非受保护 → 项目层显式声明即生效 |
| 项目想允许 admin 绕过分支保护 | ❌ 属"减少对风险的保护"→ 削弱，拒绝 |
| 规则与平台配置冲突 | 以**更严格**者为准；并在 `github-capability-matrix.md` 记录差异 |
| 无法判定 | 停止，写清冲突双方原文与出处，请求人类裁决 |

---

## 6. 双 Agent 角色与职责矩阵

### 6.1 角色映射（关键设计）

现有框架有 8 角色；本框架引入 **2 个协作角色**（不新增职责，只做**聚合**）：

| 协作角色 | 聚合的既有角色 | 家族 | 一句话职责 |
|---------|--------------|------|-----------|
| **主控 Agent** | Product · Architect · **Reviewer · Tester** · Security（复核） | 设计族 + **验证族** | 定义"做什么、验收标准、是否通过" |
| **执行 Agent** | **Developer** · DevOps（非生产） | 实现族 | 定义"怎么做、做出什么、证据是什么" |

> **设计依据：** `role-assignment.md` §3 规定「**验证族必须与实现族由不同的 Agent 扮演**」，
> 且 §4.1 的 2-Agent 最小配置已把验证族独立给 Agent-B。
> 本方案把**设计族与验证族**都归给主控 —— 这是 §3「设计族可与任一方合并」允许的变体，
> 但需在项目 `AGENTS.md` 中**显式声明覆盖**（格式见 `role-assignment.md` §4.4）。

**独立性铁律（不可覆盖，来自受保护规则）：**

```
主控 Agent 批准的实现  ≠  主控 Agent 自己写的实现
执行 Agent 自测通过    ≠  独立验证通过
```

- 主控若接管实现（紧急修复等），**必须**把该变更的审查权交给执行 Agent 或一个全新会话，并在 `handoffs/` 记录角色互换。
- 执行 Agent 的"跑测试/构建"是**证据生产**，不是**独立验证**；独立验证由主控复跑关键检查或核对证据完成。

### 6.2 职责矩阵（12 + 12 项，逐项给出载体与证据）

| # | 主控 Agent 职责 | 载体 | 证据形态 |
|---|----------------|------|---------|
| M1 | 理解需求、识别约束、确定验收条件 | `TASK.md` Objective/Acceptance Criteria | 可判定的 AC 条目（是/否） |
| M2 | 阅读项目规则、检查仓库状态 | 只读检查 | 检查清单记录（§8 阶段 0） |
| M3 | 判断任务类型、风险等级、依赖关系 | `TASK.md` Workflow/Priority/Dependencies | 风险等级 L0–L3 标注 |
| M4 | 创建/完善任务记录（Issue 不参与，仅可选投影） | `TASK.md`（+ 可选 Issue） | 文件路径 + 任务号 |
| M5 | 制定实施方案并拆分工作项 | `TASK.md` Implementation Plan | 步骤 + File Scope |
| M6 | 明确执行边界、禁止事项、审批条件 | `TASK.md` Constraints/Non-Scope | 显式条目 |
| M7 | 协调认领、并行工作、跨模块依赖 | `Owner` 字段 + File Scope 检查 | Owner 与时间戳 |
| M8 | 审查代码变更（**读 PR 实际 diff**）并核验 CI | `gh pr diff` + CI 结论 + `handoffs/` | 逐条 AC 核对表 + PASS/FAIL |
| M9 | 提出整改要求并**复审**整改结果 | `HANDOFF-*-reviewer-to-developer` + `HANDOFF-*-developer-to-reviewer` | 整改项 → 复核结论 |
| M10 | 决定验收状态、**合并 PR**、整理交付报告 | `TASK.md` Status/Merge Record | Status=DONE + PR 号 + run id |
| M11 | 维护架构文档、任务记录、质量规范 | `docs/**` | 变更提交 |
| M12 | 对验收过程负责（不凭声明判定成功） | 证据链 | **独立复跑/核对证据**记录 |

| # | 执行 Agent 职责 | 载体 | 证据形态 |
|---|----------------|------|---------|
| E1 | 阅读任务说明与相关规范 | 只读 | 声明已读清单 |
| E2 | 检查现有实现、Git 状态、依赖 | 只读 | `git status` / 依赖清单 |
| E3 | 验证方案可行性（发现不可行即上报） | Handoff | 可行性结论或回退请求 |
| E4 | 在授权范围内创建/使用独立分支 | Git | 分支名 + 远端存在性（`git ls-remote`） |
| E5 | 实施代码、配置、测试、文档修改 | 文件 | diff |
| E6 | 执行测试、构建、质量检查 | CI/本地 | **原始命令输出**（非"已通过"） |
| E7 | 记录实际变更与验证结果 | `TASK.md` Changed Files + Handoff | 文件表 + Tests 字段 |
| E8 | 推送分支、**创建 PR**、提交交接材料 | PR + `handoffs/` | PR 号 + Handoff 12 字段齐全（含测试原始输出） |
| E9 | 按审查意见整改 | 新提交 | 整改提交 + 重跑结果 |
| E10 | 及时报告方案缺陷/安全风险/范围变化/阻塞 | Handoff + Status | BLOCKED 记录（§10.4 五要素） |
| E11 | 不擅自扩大范围、不覆盖未提交修改 | 纪律 | File Scope 一致性检查 |
| E12 | 不绕过门禁、不隐瞒失败 | 纪律 | CI 原始日志 |

### 6.3 权限矩阵（角色视角，衔接 `permissions.md` §2）

| 动作 | 主控 Agent | 执行 Agent | 平台强制手段 |
|------|-----------|-----------|-------------|
| 改 `TASK.md` 状态字段 | ✅ | ✅（仅自己任务的进度字段） | 无（文件级约定） |
| 改 `TASK.md` Status→DONE | ✅ 独占 | ❌ | 无（约定）+ 门禁后置校验 |
| 创建/切换任务分支 | ⚠️ 仅在接管实现时 | ✅ | 无 |
| 推送任务分支 | ⚠️ 仅在接管实现时 | ✅ | 无（分支保护只约束受保护分支） |
| **创建 PR** | ⚠️ 仅接管实现时 | ✅ **独占** | 无（常规写权限） |
| 在 PR 上发表评论 | ✅ | ⚠️ 须主控确认 | 无 |
| **批准（approve）PR** | ⛔ **不使用该动作** | ⛔ 同上 | **不启用 `Require approvals`**（单账号下 `approvals=0`，见 §9.4.2） |
| **合并 PR** | ✅ **独占**（阶段 10） | ❌ | **分支保护 + 必需检查（平台强制）** |
| 直接推送 `main`（绕过 PR） | ❌ | ❌ | **`Require a pull request`（平台强制）** |
| 修改 `main`（非合并，如直接提交） | ❌ | ❌ | 同上（`Require a pull request`） |
| 改 `.github/workflows/**` | ✅ 须说明 | ⚠️ 须主控确认 | 无平台强制（`approvals=0`，不使用 CODEOWNERS） |
| 改受保护规则文件 | ❌ 需人类批准 | ❌ | 无（约定） |
| 生产部署 / 迁移 / 密钥 | ❌ | ❌ | **人类授权（层 3）** |

> **本表基于 D1b = 甲编制。** 与"乙"的差别仅在表中三行：
> **创建 PR**（执行独占）、**合并 PR**（主控独占，平台强制）、**直接推送 `main`**（平台强制禁止）。
> 「批准 PR」一格**始终为"不使用"** —— 这是单账号下 `approvals = 0` 的必然结果，与选用甲/乙无关。
> 详见 §7.4。

---

## 7. GitHub 协作工作流（端到端 10 阶段）

> **本节按 D1b = 甲（保留 PR）编制。** §7.1 审查范围与 §7.2 材料来源为**组合无关**的通用规则。
> §7.3 描述的是"乙"方案的技术前提（CI 必须在工作分支上运行），**对甲不适用**，保留作决策记录。
> §7.4 是甲方案的完整展开（含平台前置配置、命令序列与门禁对照），**为最终采纳流程**。

> **裁决影响（2026-10-14，D1b = 甲）：** 本流程**使用 Pull Request** 作为代码差异与 CI 门禁的载体，
> **Issue 不参与审查**。协作载体 = **Git 分支 + 提交 + PR + PR 上的 CI 运行 + `TASK.md` / `handoffs/`**。
> 审查的输入是**PR 的实际 diff 与 CI 结论**，产出（PASS / FAIL / 整改要求）
> **写入 `handoffs/` 并更新 `TASK.md` 的 `Status`**（**不使用 GitHub 的 `approve` 按钮**）。
>
> **两项收益与两项代价：**
> ① **收益**：CI 由"提示"变为**真门禁**（`Require a pull request` + `Require status checks`）；
> ② **收益**：`main` 不可被直接推送，"禁止直推 main"**首次获得平台强制**。
> ③ **代价**：`gh` 必须可写（当前只读，须阶段 3 重新认证）；
> ④ **代价**：每个任务增加"建 PR → 等 CI → 合并 PR"一步。
>
> **不变的代价：** "实现者 ≠ 批准者"仍**无平台强制**（单账号 + `approvals = 0`），须执行 §9.4.5 三条补救措施。

```
        ┌──────────── 层 1 文件层（事实来源）────────────┐
        │  TASK.md · handoffs/ · docs/ · AGENTS.md       │
        └───────────────────┬───────────────────────────┘
                            │ 审查结论回写；Issue 仅 Level 2 可选投影
        ┌───────────────────▼───────────────────────────┐
        │ 层 2 平台层：Branch → Commits → PR → CI → main │
        │                （PR 为差异与门禁载体）          │
        └───────────────────┬───────────────────────────┘
                            │ 授权
        ┌───────────────────▼───────────────────────────┐
        │ 层 3 授权层：用户批准（高风险 / 发布 / 规则变更）│
        └───────────────────────────────────────────────┘
```

| 阶段 | 执行者 | 输入 | 输出（载体） | 进入条件 | 退出条件 |
|------|-------|------|-------------|---------|---------|
| **0 执行前检查** | 主控 | 需求 | 检查清单 | 需求到达 | 仓库/分支/工作区状态确认；工作区**无**未提交变更；无重复 PR |
| **1 需求登记** | 主控 | 需求 | `TASK.md` | 阶段 0 通过 | 背景/目标/范围/排除范围/AC/约束/依赖/风险等级/审批要求/验证要求 齐全 |
| **2 方案与分配** | 主控 | `TASK.md` | Implementation Plan + File Scope | 查重通过 | 边界明确；依赖满足；必要时获用户确认 |
| **3 认领与再检查** | 执行 | `TASK.md` | `Owner` / `Owner Since` | 依赖已满足 | 仓库/分支/工作区/规范/可行性/授权范围 六项已检查 |
| **4 分支隔离** | 执行 | 任务 ID | `<type>/TASK-NNN-slug` | 认领成功 | 分支从最新 `main` 派生；**远端已存在**（PR 需有对象） |
| **5 实施与提交** | 执行 | 方案 | 原子提交 + `Refs: TASK-NNN` | 分支就绪 | 本地 lint/format/test/build 通过；无调试题；无密钥 |
| **6 创建 PR** | 执行 | 分支 | **PR（先 Draft，自检后转 Ready）** + `handoffs/` | 分支已推送 | PR 描述含 §7.2 全部字段；关联任务号 |
| **7 自动化检查** | Actions | PR | 检查结论 | PR 创建/更新 | **在 PR head 上**运行；全部必需检查通过（失败须定性，不得重试掩盖） |
| **8 主控审查** | 主控 | **PR 实际 diff** + CI 结论 | PASS / 待整改 / 待补充说明 | 检查通过；分支已合最新 `main` | 逐条 AC 核对；§7.1 的 10 项审查范围全覆盖；结论写入 `handoffs/` |
| **9 整改与复审** | 执行 → 主控 | 审查意见 | 新提交 + 复审结论 | 收到整改要求 | 阻断项关闭且**经复核**（非仅标记已解决）；受影响检查已重跑 |
| **10 合并与归档** | 主控 | 门禁全绿 + 授权 | PR 合并 + `TASK.md` Merge Record | **分支保护 + 必需检查满足** | PR 已合并；`TASK.md` Status=DONE 且目录移入 `done/`；Merge Record 记录 PR 号与 run id；文档已更新；遗留问题另立记录 |

### 7.1 阶段 8 审查范围（10 项，逐项给结论）

1. 需求是否满足（逐条 AC） 2. 修改范围是否合规（File Scope）
3. 实现是否正确 4. 是否破坏现有架构/接口 5. 是否引入安全或数据风险
6. 测试是否充分（证据是否真实） 7. 文档是否一致（含**否定性断言**复核，见 §13.4）
8. 是否存在未经批准的重大变更 9. CI 是否满足要求 10. 是否符合完成定义（DoD）

### 7.2 审查材料的来源（层 1 文件 → PR 描述）

> **PR 描述不产生新信息**，它是层 1 文件的**渲染**。执行 Agent 由 `handoffs/` 直接生成 PR body，
> 避免同一事实写两遍。审查结论仍**必须回写** `handoffs/`（平台评论不可作为唯一记录，见 §5.1 层间规则 L2）。

| PR 描述字段 | 数据来源（层 1） |
|-----------|-----------------|
| 关联任务 | `TASK.md` Task ID + 提交 footer `Refs: TASK-NNN` |
| 变更摘要 | `TASK.md` Objective + Changed Files |
| 实现内容与范围 | `TASK.md` Scope / Non-Scope / Implementation Plan |
| 实际测试结果 | `TASK.md` Verification Plan 的执行记录 |
| 未执行的测试及原因 | Handoff `Tests` + `Known Issues` |
| 兼容性/安全/部署影响 | Handoff `Risks` + `Constraints` |
| 回滚方案 | Handoff `Risks`（回滚段） |
| 遗留问题 | `TASK.md` Known Issues |
| 执行者自检 | Handoff 交接检查清单 |

### 7.3 （仅供参照 · 不适用）乙方案的技术前提：CI 必须在工作分支上运行

> ⛔ **本节描述的约束属于"乙"方案。D1b 最终裁决为"甲"，因此本节的修改要求不适用。**
> 保留于此，一是作为决策记录，二是为将来若退回"乙"时留档。
> **甲方案下 `ci.yml` 无需任何触发条件变更** —— 现有 `pull_request: branches: [main]`
> 已使检查在 **PR head** 上运行，时序天然满足"合并前完成检查"。见 §7.4.2 阶段 7。

在"乙"（不使用 PR）下，CI 只在代码已经落到 `main` 之后才运行 —— 检查结果再绿，也拦不住任何东西。
那时**必须**为 `ci.yml` 增加工作分支的 push 触发（例如
`push: branches: [main, 'feat/**', 'fix/**', 'docs/**', 'refactor/**', 'test/**', 'chore/**']`），
使检查在**合并之前**于工作分支上完成。

**并需在阶段 3 实测确认以下两点（不得预先写入制度）：**

| # | 待实测项 | 若成立 | 若不成立 |
|---|---------|--------|---------|
| V1 | GitHub Rulesets 的「Require status checks to pass」能否约束**直接推送**到 `main`（即提交必须先在别处跑过检查） | CI 成为**真门禁**，乙方案可保住 D3 的核心价值 | CI 退化为**提示**；D3 须修订为"平台门禁仅限禁止破坏性操作" |
| V2 | Rulesets 的 **bypass 列表为空**时，仓库所有者是否仍受约束 | 禁 force push / 禁删分支对单账号也真实生效 | 这些规则对所有者无强制力，退回纯流程约定 |

> 依据：GitHub 官方文档 *Available rules for rulesets* 对「Require status checks to pass」的描述为
> "ensure that all required CI tests are passing before collaborators can **make changes to a branch**"，
> 措辞指向"修改分支"而非仅"合并 PR"，故**存在**约束直推的机制；但其在单账号、无 PR 场景下的
> 实际行为需以实测为准。
>
> **甲方案下 V1 不适用** —— 直推 `main` 由 `Require a pull request` 直接禁止（无需依赖 V1）。
> 这也是甲相对乙的一处**确定性优势**：门禁不依赖实测结论。

### 7.4 甲方案协作详细流程（**已采纳**：D1b = 甲）

> **适用条件：D1b 已裁决为「甲」——本节为最终采纳流程。** 与 §7 的十阶段**同构**，
> 差异集中在阶段 6/7/8：载体由"远端分支"升级为"PR"，因而获得**平台强制的 CI 门禁**，且 `main` 不可直推。
> **不需要第二个 GitHub 账号**（依据见 §9.4.7）。

#### 7.4.1 平台前置配置（阶段 3 由用户完成，需仓库 admin）

| 设置项 | 值 | 作用 | 缺省值 |
|-------|----|------|--------|
| `Require a pull request before merging` | ✅ | **禁止直推 `main`** | 关 |
| ⤷ `Require approvals` | **0** | 单账号下设 ≥1 只会空转（§9.4.2） | 1 |
| `Require status checks to pass` | ✅ 精确选定 `ci.yml` 的 job 名 | **CI 不绿则不可合并** | 关 |
| ⤷ `Require branches to be up to date` | ✅（strict） | 防"先绿后冲突" | 关 |
| `Do not allow bypassing the above settings` | ✅ | **让规则对所有者本人也生效** | 关 |
| `Allow force pushes` | ❌（保持默认） | 禁止改写历史 | 关 |
| `Allow deletions` | ❌（保持默认） | 禁止删除 `main` | 关 |
| `Require linear history`（可选） | ✅ | 与 D5 的 rebase-merge 一致 | 关 |

**两条关键依赖（缺一即门禁空转）：**
1. `Require a pull request` 与 `Require status checks` **必须同时启用** ——
   只启用检查而不要求 PR，检查管不住直推（这正是 §9.4.6 中"乙"的软肋）；
2. `Do not allow bypassing` **必须勾选** —— 否则所有者默认绕过（§9.4.2）。

> ⚠️ **计划限制：** 分支保护在 **public 仓库**上 GitHub Free 即可用；
> **private 仓库需 Pro/Team/Enterprise**。故甲方案可先在 `shadcn-admin`（public）落地。

#### 7.4.2 十阶段详细流程（角色 × 动作 × 载体 × 门禁）

| # | 阶段 | 执行者 | 具体动作 | 输出载体 | 门禁 / 校验 | 退出条件 |
|---|------|-------|---------|---------|-----------|---------|
| 0 | 执行前检查 | 主控 | 确认仓库与默认分支；`git status --short` 应为空；`git fetch --prune`；查重（`git ls-remote --heads origin`、`gh pr list --state all`） | 检查清单（写入 `TASK.md`） | — | 工作区**无**未提交变更；无重复任务占用 |
| 1 | 需求登记 | 主控 | 建 `tasks/backlog/TASK-NNN-slug/TASK.md`，填齐 10 项（背景/目标/包含范围/排除范围/AC/约束/依赖/风险等级/审批要求/验证要求） | `TASK.md` | 字段完整性 | 10 项齐全；AC 可验证 |
| 2 | 方案与分配 | 主控 | 写 Implementation Plan、**File Scope**、风险等级（L1/L2/L3）；判定是否需人类授权；确认依赖满足 | `TASK.md` §Plan | 查重通过 | 边界明确；L3 项已标注待授权 |
| 3 | 认领与再检查 | 执行 | 六项检查（仓库 / 分支 / 工作区 / 规范已读 / 方案可行 / 授权范围）；写 `Owner` + `Owner Since`；Status → `ACTIVE` | `TASK.md` | — | 六项通过；不可行则回报并转 `BLOCKED` |
| 4 | 分支隔离 | 执行 | `git switch -c feat/TASK-NNN-slug main` → **立即** `git push -u origin feat/TASK-NNN-slug`；校验 `git ls-remote --heads origin` 含该分支 | 远端分支 | 分支保护只约束 `main`，不拦特性分支 | 分支自最新 `main` 派生且**远端已存在**（防本地丢失，且 PR 才有对象可建） |
| 5 | 实施与提交 | 执行 | 小步提交，每个提交 footer 带 `Refs: TASK-NNN`；本地跑 `lint` / `format:check` / `test` / `build`；**不混入无关重构** | 提交历史 + diff | 本地自检 | 本地四项通过；无调试残留；无密钥 |
| 6 | **创建 PR** | 执行 | 先建 Draft：`gh pr create --draft --base main --head <branch> --title "[TASK-NNN] <目标>" --body-file <handoff>`；补齐 `handoffs/HANDOFF-01-developer-to-reviewer.md`；自检完成后 `gh pr ready <N>` | **PR** + `handoffs/` | PR 描述字段完整性（§7.2 映射） | PR 含：关联任务 / 变更摘要 / 范围 / 实际测试结果 / 未执行的测试及原因 / 风险与兼容性 / 回滚方案 / 遗留问题 / 执行者自检 |
| 7 | 自动化检查 | Actions | `pull_request` 事件触发 `ci.yml` 在 **PR head** 上运行（**现有触发条件已足够，无需改 `ci.yml`**）；`gh pr checks <N>` 查看 | CI run | **必需检查**：`lint` / `format:check` / `test` / `build` 全绿 | 全部必需检查通过；失败须按 §10.3 定性，**不得重试掩盖根因** |
| 8 | 主控审查 | 主控 | 读**实际 diff**（`gh pr diff <N>`）而非 PR 描述；逐条 AC 核对 + §7.1 十项；结论写入 `handoffs/HANDOFF-02-reviewer-to-developer.md`；可选 `gh pr comment <N>` 留平台痕 | `handoffs/` + `TASK.md` Status | ⚠️ **不使用 `approve` 按钮**（`approvals=0`，且单账号本就无法自我批准） | 给出 PASS / 需整改 / 需补充说明 之一，且可追溯到 diff 与 run id |
| 9 | 整改与复审 | 执行 → 主控 | 在同一分支追加提交并 `git push`（PR 自动更新、CI 自动重跑）；主控**复核**整改结果 | 新提交 + 复审结论 | 受影响检查重跑通过 | 阻断项关闭且**经复核**（非"已标记解决"） |
| 10 | 合并与归档 | 主控 | 前置：必需检查全绿 + 分支保护满足 + 授权满足 → `gh pr merge <N> --rebase --delete-branch`；Status → `DONE`、目录移入 `tasks/done/`；写 Merge Record（PR 号 + CI run id + 合并 commit SHA） | 合并提交 + `TASK.md` Merge Record | **分支保护 + 必需检查（平台强制）** | 已合入 `main`；PR 已关闭；文档已更新；遗留问题另立记录 |

**可执行命令序列（阶段 4 → 10）：**

```bash
git switch -c feat/TASK-NNN-slug main
git push -u origin feat/TASK-NNN-slug          # 阶段 4：先推分支，PR 才有对象

gh pr create --draft --base main --head feat/TASK-NNN-slug \
  --title "[TASK-NNN] <目标>" \
  --body-file tasks/active/TASK-NNN-slug/handoffs/HANDOFF-01-developer-to-reviewer.md
gh pr ready N                                   # 阶段 6：自检完成转正式

gh pr checks N                                  # 阶段 7：读取必需检查结论
gh pr diff N                                    # 阶段 8：审查实际差异
gh pr comment N --body "审查结论：PASS …"        # 阶段 8：可选平台留痕

git commit -am "fix: 整改项" && git push         # 阶段 9：整改（PR/CI 自动更新）

gh pr merge N --rebase --delete-branch          # 阶段 10：合并并清理分支
```

#### 7.4.3 门禁机制对照（哪条规则拦什么）

| 平台规则 | 拦截对象 | 作用点 |
|---------|---------|-------|
| `Require a pull request before merging` | 直推 `main` | `git push origin main` |
| `Require status checks to pass` | 检查未通过的合并 | PR 合并按钮 / `gh pr merge` |
| `Do not allow bypassing` | 所有者绕过以上两条 | 对本人同样生效 |
| `Allow force pushes = ❌` | `git push --force main` | 推送 |
| `Allow deletions = ❌` | 删除 `main` | 删除分支 |
| `Require conversation resolution`（可选） | 未解决的审查评论 | 合并前置 |

#### 7.4.4 甲 / 乙 对照（裁决依据；**已选甲**）

| 维度 | 甲（PR 载体） | 乙（无 PR） |
|------|-------------|-----------|
| 第二 GitHub 账号 | **不需要** | 不需要 |
| `ci.yml` 触发条件 | **无需修改**（现有 `pull_request` 即所需） | **必须**新增工作分支 `push` 触发（§7.3） |
| CI 是否构成真门禁 | ✅ **平台强制** | ⏳ 取决于实测 V1 |
| 还需实测的项 | **V2 + V4**（V1/V3 对甲不适用） | V1 + V2 + V3 |
| 差异讨论区 | ✅ PR diff 逐行评论 | ❌ 仅 Handoff 往返 |
| 平台审计留痕 | ✅ PR + 检查 + 合并记录 | ⚠️ 仅 CI run |
| 需新增的文件 | `PULL_REQUEST_TEMPLATE.md`（模板 + 落地两份） | 无 |
| 前置凭据 | **`gh` 必须可写**（当前为只读，须阶段 3 重新认证） | 仅需 SSH 推送（现成）+ 网页配置 |
| I2（实现者 ≠ 批准者）平台强制 | ❌ **仍无** | ❌ 无 |
| 与现行实践的距离 | 中等（新增 PR 环节） | 最小（§2.5 实践的同构增强） |

#### 7.4.5 一项新增收益与一项必须回避的误解

- **新增收益（单账号下）：** **在自己创建的 PR 上发表评论是允许的** ——
  即主控的审查结论**可以同时留在平台侧**（`gh pr comment`），GitHub 只拒绝 `approve`。
  这是甲相对乙的一处实际增益（乙下平台侧不存在审查痕迹）。
- **必须回避的误解：** 甲方案**不会**带来"独立审查"的平台强制。
  审查者与实现者是同一账号，平台审计记录无法区分二者。
  该代价与乙**完全相同**，仍须执行 §9.4.5 的三条补救措施
  （换会话审查 + `Known Issues` 披露 + 证据落 `handoffs/`）。

---

## 8. 状态模型与验收机制

### 8.1 状态词表（保留 10 态，8 态为别名）

> **平台侧列的性质（D1b=甲）：** 本列列出的是**可选**的平台对应物。
> 其中 **PR 状态是甲方案的真实产物**（PR 是交付与门禁载体），但**它不承载任务状态**——
> 任务状态的事实来源始终是 `TASK.md` 的 `Status` 字段与任务目录位置。
> **Issue label 一列仍为 Level 2 可选投影，默认关闭**（D2：Issue 不参与状态与审查）。

| 任务书 8 态 | 本框架规范态（`.agents` 既有） | 物理目录（事实来源） | 平台侧（甲） |
|------------|------------------------------|-------------------|----------------------|
| `planned` | `BACKLOG` | `tasks/backlog/` | 无（Issue 不参与） |
| `ready` | `READY` | `tasks/backlog/` | 无 |
| `in_progress` | `ACTIVE`（或 `DESIGN`） | `tasks/active/` | PR 存在且为 Draft |
| `review` | `REVIEW` | `tasks/review/` | PR 已 `ready` 且必需检查全绿 |
| `rework` | `CHANGES_REQUESTED`（或 `TEST_FAILED`） | `tasks/active/` | PR 有新提交，检查重跑中 |
| `blocked` | `BLOCKED` | `tasks/active/` | PR 停滞（可选加 label 说明） |
| `completed` | `DONE` | `tasks/done/` | PR 已合并 |
| `cancelled` | `CANCELLED` | `tasks/done/`（或项目自定义） | PR 已关闭 |

**状态源分工（唯一性保证）：**

| 事实 | 唯一来源 | 其他位置的角色 |
|------|---------|--------------|
| 任务整体状态 | `TASK.md` Status | Issue label = **Level 2 可选投影，默认关**；PR 状态仅反映代码交付进度 |
| 交付与审查状态 | `handoffs/HANDOFF-*` + `TASK.md` Status | PR 评论可作为补充证据，但**结论必须回写** `handoffs/` |
| 自动化检查结果 | Actions run | `TASK.md` Merge Record 记录 run id；PR checks 同步展示 |
| 进度总览 | 可选 Project | 只读汇总，非事实来源 |

### 8.2 完成定义（DoD，沿用 `AGENTS.md` §13 并新增 3 条）

既有 8 项保留，新增：

- [ ] **N1 · 交付留痕完整**：`handoffs/` 含逐条 AC 核对与 PASS/FAIL 结论；审查者身份（哪个会话/实例）已记录
- [ ] **N2 · 门禁证据可查**：PR 号 + 必需检查的 run id / 结论已写入 `TASK.md` Merge Record
- [ ] **N3 · 制度-平台差异披露**：若某项约定**未**被平台强制，已在 `Known Issues` 显式标注
      （D1b=甲 后，**必须**标注的一条是：独立审查无平台强制，仅为流程约定）

### 8.3 验收权

- 执行 Agent **可以申请验收**（写 Handoff + `TASK.md` Status → `REVIEW`）；
- **验收状态由主控 Agent 依据实际证据判定**，不得依据执行者的完成声明；
- 主控的验收结论必须可追溯到具体 run id / diff / 命令输出。

---

## 9. 权限模型与风险控制

### 9.1 三层区分（对应任务书 §6 的核心要求）

> **不得将文档中的禁止事项误认为平台已经强制限制了相应操作。**

| 层面 | 内容 | 强制力 | 本项目现状（D1b=甲 后为**目标态**） |
|------|------|--------|-----------|
| **① 文档制度** | `.agents/rules/*`、`.agents/protocols/*` | 依靠 Agent 遵守 | ✅ 完整 |
| **② 平台权限** | 账号能做什么（GitHub 权限模型） | **平台强制** | ⚠️ `main` 无保护；唯一可写身份单账号；`gh` 只读 |
| **③ 自动化门禁** | Actions 对代码/测试/合并条件的机器验证 | **机器强制** | ⚠️ 检查会跑，但**今天不拦**（无 required checks）→ **甲方案的目标是把它变成真门禁** |

**落差清单（必须如实记录，不得声称已有强制）：**

| 文档声称 | 平台实际（**今天**） | 甲方案落地后 | 结论 |
|---------|---------|------|------|
| `git.md` §6：禁止直推 `main` | `main` 无分支保护，SSH 身份有 admin | `Require a pull request` 强制 | ❌→✅ **今天无平台强制**，落地后获得强制 |
| `permissions.md`：push --force 禁止 | 未设 "Do not allow force pushes" | 可随保护规则一并启用 | ❌→✅ 同上 |
| `permissions.md`：实现者≠批准者 | GitHub 仅禁止"自我批准 PR" | **仍无强制**（单账号 + `approvals=0`） | ❌ **恒定无平台强制**；仅流程约束（须双会话审查 + `Known Issues` 披露，见 §9.4.5） |
| `permissions.md`：合并到 main 需 Review PASS | 无任何机制 | `Require status checks` 强制 **CI** 通过；但**仍无法验证"是否经过人工审查"** | ⚠️ **部分强制**：机器检查强制，人工审查仍靠流程 |
| `change-safety.md`：高风险需人类批准 | 无平台机制 | 无平台机制 | ⚠️ 制度门禁（属预期，无法平台化） |

### 9.2 风险分级与审批门禁

| 级别 | 定义 | 示例 | 审批 |
|------|------|------|------|
| **L0** | 只读 | 调研、读日志、`gh api` GET | 无 |
| **L1** | 低风险、可逆、局部 | docs/test/文案、工作分支 push、开 Draft PR | 无（`handoffs/` 内沉淀） |
| **L2** | 中风险 | 代码合入 `main`（= 合并 PR）、依赖升级、CI 配置变更、`.github/**` 变更 | **必需检查通过（平台强制）** + 主控审查（结论入 `handoffs/`）。**无平台审批、无 CODEOWNERS 强制** |
| **L3** | 高风险、不可逆或对外 | 生产部署、**镜像发布**（P-04）、DB 迁移、密钥/权限变更、force push、删除分支/数据 | **人类显式批准**（层 3） |

**特别约束（本项目特有）：**

- `shadcn-admin` 的 push-to-main **触发 Docker Hub 发布** → 「合并」在语义上跨越 L2→L3。处置见 D8。
- `business-manager` 有 4 个已知 Git 陷阱（`AGENTS.md` §13.4）→ 自动化脚本必须幂等且每步验证，禁止批量破坏性操作。
- 推送依赖 SSH 且 `C:\Users\Admin\.ssh` 受沙箱保护 → 需人类授权放行，**不得在沙箱内反复重试**。

### 9.3 身份与审查独立性（如实披露）

- 当前 `shadcn-admin` / `business-manager` 的**唯一可写身份**是 `huyanluanyuqaq`。
- `gh` CLI 使用另一身份 `ndldsn`，**无写权限**（E4/E8）→ **因 D1b=甲 需要创建 PR，`gh` 的可写权限成为硬前置**，
  阶段 3 必须重新认证；在此之前，所有 `gh pr *` 类操作**不可用**。
- 若采纳 D1=A（第二身份）：可获得**平台级**独立审查。
- 若维持单身份（**本项目裁决**）：必须在 `github-capability-matrix.md` 与本项目 `AGENTS.md` 中声明
  「**独立审查为流程约定，平台不强制**」，且单 Agent 场景适用 `role-assignment.md` §4.3（换全新会话）。

> **2026-10-14 裁决更新：** 见 §9.4.5 / §9.4.6 —— 本项目**不引入第二身份**，
> 审查结论回归文件层，`Require approvals` 固定为 0；
> 但**保留 PR**（甲），使 CI 成为真门禁、`main` 不可直推。本节其余内容作为背景与备选记录保留。

### 9.4 「双 Agent」与「双 GitHub 身份」的关系（常见误解澄清）

> **问：** 我已经有两个 Agent，一个发起 Issue、一个审查并批准 PR，这样不可以吗？
> **答：** 流程上完全可行；但**平台层是否强制**，取决于这两个 Agent 是否使用**不同的 GitHub 账号凭据**。

#### 9.4.1 两个层级的"独立审查"必须分开判定

| 层级 | 判定依据 | 两个 Agent 能否满足 |
|------|---------|-------------------|
| **流程层**独立审查 | 谁读取了代码、谁给出了独立判断 | ✅ **能**。换会话 / 换实例即可，不要求不同账号（即 `role-assignment.md` §4.1 的 2-Agent 最小配置） |
| **平台层**独立审查 | GitHub 的**账号身份**——PR 作者与批准者是否为同一 `login` | ❌ **不能**。两个 Agent 共用同一账号凭据时，平台记录到的两次操作 `login` 完全相同 |

**三条硬事实：**

1. **GitHub 按账号判定审查独立性，不按"进程 / Agent / 会话"判定。** 同一账号下的两次操作，在平台审计记录里无法区分为两个角色。
2. **GitHub 禁止自我批准 PR**（`Can not approve your own pull request`）。若 PR 作者与批准者是同一账号，批准请求会被直接拒绝。
3. **PR 作者由"推送该分支所用的账号"决定，批准由"当前登录账号"决定。** 因此只需让两个 Agent 使用**不同凭据**，平台即天然满足「实现者 ≠ 批准者」。

#### 9.4.2 由此产生的陷阱与一处必须精确的边界（2026-10-14 修订）

> ⚠️ **陷阱的成立条件比先前表述更窄：** 只有当分支保护**同时**满足
> ①「Require approvals ≥ 1」**且** ② 勾选「Do not allow bypassing the above settings」（规则同样施加于管理员）时，
> 单账号的 PR 才会**真正卡死**——既不能自我批准，又无人可批。

**但必须注意 GitHub 的默认行为（实测文档原文）：**

- "Pull request authors cannot approve their own pull requests."（自我批准被拒）
- "**Repository owners and administrators can merge a pull request even if it hasn't received an approving review.**"
- "By default, the restrictions of a branch protection rule **do not apply to people with admin permissions**."

即：**默认情况下仓库所有者本就能绕过 required approvals。** 因此单账号设 `approvals ≥ 1` 的结果不是"卡死"，
而是"**你永远是那个绕过规则的人**"——门禁空转。

两种情形都不可接受，结论不变：**单账号场景下 `Require approvals` 必须为 0。**
但风险性质不同：先前表述为"会被卡住"，实际是"**看起来有审批、实际从不生效**"。
后者更危险，因为它会被误认为已具备平台级独立审查。

#### 9.4.3 三种可行配置

| 配置 | 凭据安排 | 分支保护设置 | 独立审查强度 | 代价 |
|------|---------|-------------|-------------|------|
| **A. 双 Agent + 双账号凭据** | 主控 = 账号 A（仓库所有者）；执行 = 账号 B（协作者，write） | `Require approvals: 1` + 必需检查 | **平台强制**（执行 Agent 无批准权限） | 需第二个 GitHub 账号 + 独立密钥/令牌 |
| **B. 双 Agent + 单账号**（**本项目采纳**） | 两 Agent 共用账号 A | **`Require approvals` 必须为 0** + `Require a pull request` + 必需检查 | 流程约定；**平台强制 CI 与"不可直推"** | 零成本；须在 `github-capability-matrix.md` 如实标注"审查无平台强制" |
| **C. 单账号 + 允许管理员绕过** | 共用账号 A | approvals 1 + admin bypass | **形同虚设** | 削弱受保护规则（`rule-precedence.md` §5），不采纳 |

> **本项目采用 B。** 注意 B 并不等于"放弃 PR" —— B 与"是否使用 PR"是**两个独立维度**：
> 本项目的 B = 单账号 + **使用 PR**（甲）+ 必需检查 + 禁止绕过，`approvals` 固定为 0。

#### 9.4.4 配置 A 的角色—账号分工（**未采纳，仅作参照**）

> ⚠️ **本小节描述的是配置 A（双账号 + PR 审批），用户最终裁决为"不引入第二账号"（配置 B），
> 故本小节不适用。保留于此是为了说明"平台级独立审查"在技术上如何实现，供未来需要时参考。
> 注意：配置 B 下**仍然使用 PR**（甲组合），只是不含 `Require approvals`。**

| Agent | GitHub 账号 | 允许的操作 | **明确禁止的操作** |
|-------|------------|-----------|------------------|
| **主控** | A（仓库所有者） | 创建/维护 Issue 投影、**审查并 approve PR**、合并 PR、打 tag | 直接向 `main` 推送代码 |
| **执行** | B（collaborator，write） | 推送任务分支、创建 PR、按审查意见整改 | **approve 任何 PR**、合并 PR、修改分支保护相关配置 |

**凭据隔离要求：** 两个 Agent 必须使用**不同的 SSH key 或不同的令牌**；不得共享同一份凭据文件。
（注意：`C:\Users\Admin\.ssh` 受沙箱保护，第二个凭据需使用独立的 key 路径。）

**为何配置 A 能自动生效：** 执行 Agent 用账号 B 推送分支 → PR 作者 = B；
主控 Agent 用账号 A 批准 → 批准者 = A ≠ B，平台接受。
同时 B 即使想自我批准也会被 GitHub 拒绝——**门禁不依赖 Agent 的自律**。

#### 9.4.5 本项目裁决：审查结论回归文件层（2026-10-14）

> **用户裁决：** 「不通过 Issue，双 Agent 通过 `TASK.md` 来审查。」
> → **不引入第二个 GitHub 账号；不启用平台审批门禁（`Require approvals = 0`）。**
> → **但保留 PR 作为代码差异与 CI 门禁的载体（甲，见 §9.4.6）。**

**裁决含义：**

| 项 | 结论 |
|----|------|
| 审查动作的载体 | `tasks/<state>/TASK-NNN/TASK.md` + `handoffs/HANDOFF-*-reviewer-to-*` |
| 审查结论的表达 | `TASK.md` 的 `Status`（`REVIEW` / `CHANGES_REQUESTED` / `DONE`）+ `handoffs/` 内的 PASS/FAIL |
| 审查的输入 | **PR 的实际 diff**（`gh pr diff`）+ CI 结论 —— PR 只是差异容器，**不是审查结论的载体** |
| Issue 在审查中的角色 | **无**（Issue 不参与状态与审查，见 D2） |
| GitHub `approve` 按钮 | **不使用** → 分支保护中 `Require approvals` **必须为 0** |
| 第二 GitHub 账号 | **不需要** |
| CI 必需检查 | **保留，且因 PR 而成为真门禁**（见 §9.4.6 的甲组合） |

**必须如实披露的代价（写入 `github-capability-matrix.md` 与项目 `AGENTS.md`）：**

> ⚠️ **I2（实现者 ≠ 批准者）将失去平台强制，仅剩流程约束。**
> 平台无法区分"执行 Agent 的自我确认"与"主控 Agent 的独立审查"——两者在 GitHub 审计记录中均为同一账号的操作。
>
> **补救措施（强制）：**
> 1. 审查必须由**与实现不同的会话/实例**完成（`role-assignment.md` §4.3）；
> 2. 单一 Agent 场景下，`TASK.md` 的 `Known Issues` **必须**记录「审查为自我审查，未经独立验证」；
> 3. 审查证据必须落到 `handoffs/`（含逐条 AC 核对与命令输出），不得仅在对话或 PR 评论中给出。

#### 9.4.6 组合裁决：甲 —— 保留 Pull Request（2026-10-14）

> **用户最终裁决：甲。** 保留 PR 作为**代码差异与 CI 门禁的载体**，
> `Require a pull request` + `Require status checks` + 禁止绕过，`Require approvals = 0`。
> **不需要第二个 GitHub 账号**（依据见 §9.4.7）。
>
> 注：本项曾先裁为"乙（不使用 PR）"，后经 §9.4.7 核实——"单账号用不了 PR"的判断不成立，
> 故于同日改判为甲。两者的差异与代价见下表。

| 组合 | PR | 分支保护设置 | CI 是否真拦 | 审查记录 | 代价 |
|------|----|--------------|-----------|---------|------|
| **甲（✅ 已裁决）** | **保留**（差异与 CI 载体） | `Require a pull request` + 必需检查 + 禁止绕过，`approvals = 0` | ✅ **平台强制**，不依赖实测 | `handoffs/`（+ PR 评论作补充） | 需 `gh` 可写；每任务多一步 PR 流程 |
| 乙（曾被选，已改判） | 不使用 | 必需检查（**待实测 V1**）+ 禁 force push + 禁删分支 | ⏳ 取决于实测 V1 | `handoffs/` | 放弃 PR 的 diff 讨论区与平台审计留痕；门禁确定性低 |

**甲方案的全部后果（逐条列出，便于复核）：**

| # | 后果 | 性质 |
|---|------|------|
| 1 | 不需要第二个 GitHub 账号 | ✅ 收益 |
| 2 | **CI 成为真门禁**：`Require status checks` 使检查未通过时合并按钮/`gh pr merge` 不可用——**且不依赖 V1 实测** | ✅ 收益 |
| 3 | **`main` 不可直推**：`Require a pull request` 使"禁止直推 main"首次获得平台强制 | ✅ 收益 |
| 4 | PR 提供**逐行 diff 讨论区**与平台审计留痕（`gh pr comment` 可用，仅 `approve` 被拒） | ✅ 收益 |
| 5 | 无需启用 Issues，Issue 不参与审查 → **阶段 3 不含"启用 Issues"** | ✅ 收益 |
| 6 | **`gh` 必须可写** —— 当前凭据只读，**这是甲唯一的新增前置依赖** | ⚠️ 前置（须阶段 3 解决） |
| 7 | 每个任务增加"建 PR → 等 CI → 合并 PR"一步 | ⚠️ 代价 |
| 8 | **I2（实现者 ≠ 批准者）仍无平台强制**，仅剩流程约束 | ⚠️ 代价（须披露，与乙相同） |
| 9 | 审查结论**仍必须回写** `handoffs/`（PR 评论不可作为唯一记录） | ⚠️ 纪律要求 |
| 10 | 合并后 `gh pr merge --delete-branch` 会自动清理远端分支 | 🟢 附带好处（部分替代 D12） |

**因此对 D3 的修订：** D3 由原「真门禁（保护 + 必需检查 + **必需审批**）」修订为
「**平台门禁 = `Require a pull request` + `Require status checks` + 禁止绕过**；**审批环节为制度门禁**」。

#### 9.4.7 澄清：单账号**可以**创建 PR 并自行合并（2026-10-14）—— 甲的成立依据

> **问：** GitHub 不是可以单账号创建 PR、然后自己合并吗？
> **答：可以，而且从头到尾不需要第二个账号。** 若 §9.4.1 / §9.4.5 被读成"单账号用不了 PR"，以本节为准。
> **本节即是 D1b 改判为"甲"的依据。**

| 动作 | 单账号能否完成 | 依据 |
|------|--------------|------|
| 推送任务分支 | ✅ | 常规写权限 |
| **创建** PR | ✅ | 常规写权限 |
| **合并自己创建的 PR** | ✅ **允许**（`approvals = 0` 时；即便 `approvals ≥ 1`，作为仓库所有者默认亦可合并） | "Repository owners and administrators can merge a pull request even if it hasn't received an approving review." |
| **批准自己创建的 PR** | ❌ **被 GitHub 拒绝** | "Pull request authors cannot approve their own pull requests." |

**关键区分：** GitHub 禁止的是**自我批准（approve）**，**不是自我合并（merge）**。
§9.4.1 与 §9.4.5 中"不能自我批准"的结论**只指向 `approve` 这一个动作**，不等于"不能使用 PR"。

**由此，单账号下采纳的组合（即 §9.4.6 的"甲"）：**

```
Require a pull request before merging      ✅  禁直推 main → 代码必经 PR
Require status checks to pass              ✅  CI 不绿 → 合并按钮不可用（真拦）
Require approvals                          0   ≥1 只会变成 §9.4.2 的空转门禁
Do not allow bypassing the above settings  ✅  让规则对自己也生效，堵住默认绕过
```

| | 内容 |
|---|---|
| ✅ 得到 | CI 在**合并前**真正拦截；`main` 不可直推；PR 提供 diff 讨论区与平台审计留痕；**无需第二账号** |
| ❌ 失去 | 「实现者 ≠ 批准者」的平台强制——唯一账号无法批准自己，也无人可批（§9.4.5 已记录的代价） |

**相关文档证据（决定 V1 是否仍需要）：**

> "Required status checks must have a `successful`, `skipped`, or `neutral` status **before collaborators can make changes to a protected branch**."
> "After all required status checks pass, any commits must either be pushed to another branch and then merged **or pushed directly to the protected branch**."

措辞指向"**修改分支**"而非"合并 PR"，暗示必需检查在不要求 PR 时**也可能**拦截直推。
**但在甲方案下这一点已不重要** —— 直推 `main` 由 `Require a pull request` 直接禁止，
不需要靠 V1 来承担门禁。故 **V1 降级为"兴趣项"，不再是甲方案的成立条件**（V2 仍必须实测）。

> ✅ **D1b 最终裁决：甲（2026-10-14）。** 甲不需要第二个账号，且其门禁强度**不依赖任何未实测结论**。
> 与之相对，乙的"CI 是否真拦"取决于 V1，且放弃 PR 的差异讨论与审计留痕。

---

## 10. 异常、冲突与阻塞机制

### 10.1 文件冲突（沿用 `collaboration.md` §4，补平台层步骤）

```
1. 暂停冲突部分（停止对该文件的写入）
2. 保存双方现有修改与提交证据（分支名 + commit SHA；不可 rebase 覆盖）
3. 比较实际差异（git diff / PR Files changed）
4. 由主控指定唯一集成责任角色
5. 明确合并策略（rebase 顺序 / 手工合并 / 一方让路）
6. 解决后重新执行受影响测试
```

**禁止：** 未经检查直接覆盖另一方修改；`git push --force` 到共享分支。

### 10.2 任务重复分配

检测：`git ls-remote --heads origin | grep TASK-NNN`（分支存在性）+ `TASK.md` Owner + 开放 PR 列表。
处置：先确认原执行者**已停止写入**（工作区干净 / 已推送），再重新分配；隔离通过独立分支完成。

### 10.3 CI 失败定性（五类，必须记录实际日志）

| 类别 | 特征 | 处置 |
|------|------|------|
| 代码缺陷 | 断言失败指向被测逻辑 | 修复代码 + 补/改测试 |
| 测试缺陷 | 测试自身错误假设 | 修测试（须说明，禁止删断言） |
| 环境故障 | 依赖安装、浏览器缺失、无原生工具链 | 修 CI 环境；**不得**改判为通过 |
| 依赖故障 | 上游包不可用、lockfile 漂移 | 排查并锁定版本 |
| 外部服务 | Docker Hub / registry / 网络 | 记录并重试**一次**，超限升级人工 |

**禁止：** 通过无限重试、删除测试、伪造结果、绕过保护规则使 CI 变绿。

### 10.4 长时间阻塞（五要素，写入 `TASK.md` 的 `Current State` 与 `Known Issues`）

原因 · 已完成工作 · 影响与风险 · 需要的决策或权限 · 恢复条件 · 下一步责任角色。

> 不使用 Issue 注释作为阻塞载体；阻塞信息一律落在 `TASK.md`（若有 Issue 投影则由 Level 2 自动化同步）。
> 若该阻塞已存在对应 PR，可另在 PR 上留一条评论作可见性补充，但**结论仍以 `TASK.md` 为准**。

### 10.5 方案争议

基于需求 / 项目规范 / 实际证据 / 风险 / 维护成本 提出；主控在授权范围内裁决；
涉及**重大架构取舍、需求变化、不可逆操作、权限边界** → 交用户决策。

---

## 11. 配套文件设计（逐个文件：职责 + 内容规划 + 是否新建）

| 文件 | 状态 | 职责 | 内容要点 |
|------|------|------|---------|
| `AGENTS.md`（工作空间） | 改 | 入口协议 | 仅增：GitHub 协作入口指针、双 Agent 声明；**删**重复的优先级模型正文（C-05） |
| `.agents/protocols/dual-agent-model.md` | 新 | 双 Agent 制度的唯一来源 | 角色映射（§6.1）、12+12 职责矩阵、认领与交接、文件所有权、并行边界、冲突、审查与整改、升级、状态流转、**多 Agent 扩展原则**（见 §11.1） |
| `.agents/protocols/github-collaboration.md` | 新 | GitHub 协作的唯一来源 | 三层载体模型、10 阶段流水线、Issue/PR/分支/CI 规则、合并与归档、身份独立性披露 |
| `.agents/protocols/github-capability-matrix.md` | 新 | 事实台账 | 「文档要求 / 平台权限 / 自动化能力」三分表 + 实测命令 + **待人工验证清单** |
| `.agents/rules/github.md` | 新 | 可判定的操作红线 | 禁止类（直推 main、force push、绕过检查、伪造证据、提交密钥）、必需类（分支命名、`Refs:` footer、PR 必填字段、`permissions:` 声明）。**不重复 `git.md` §6**，改为引用 |
| `templates/github/ISSUE_TEMPLATE/*.yml` | **不落地**（Level 2 可选） | 任务登记表单 | Issue 不参与状态与审查，启用 Issues 非前置（D2）。若未来需要，再按 `TASK.md` 字段生成 |
| `templates/github/PULL_REQUEST_TEMPLATE.md` | **新（落地）** | PR 描述模板 | 映射 HANDOFF 12 字段（§7.2）+ 执行者自检清单；D1b=甲 的核心载体之一 |
| `templates/github/CODEOWNERS` | **不落地** | — | `approvals = 0` 时无审批环节，CODEOWNERS 只自动请求审查者、不阻止合并 → 不产生强制力 |
| `templates/github/RULESET.md` | **新** | 平台门禁配置说明 | 逐条列出分支保护/Rulesets 规则与实测状态（V2）；**明确标注哪些需人工在网页端设置** |
| `templates/github/dependabot.yml` | 新 | 依赖更新 | 按生态配置；与锁文件策略一致 |
| `templates/github/workflows/ci-node-pnpm.yml` | 新 | Node/pnpm 通用 CI | 含 `permissions: contents: read`、`build:shared` 前置（既有教训）、lint/format/test/build |
| `templates/github/workflows/ci-generic.yml` | 新 | 语言无关骨架 | 仅占位 + 注释，避免假设构建工具 |
| `templates/project/AGENTS.md` | 改 | 项目模板 | 增 §GitHub Collaboration（Agent 分配声明位、分支/合并策略、门禁清单） |
| `shared/scripts/audit_framework.py` | 新 | 框架自检 | 见 §13.1 |
| `shared/scripts/github_setup_checklist.md` | 新 | 人工配置清单 | 网页/CLI/API 各自能做什么；幂等 `gh` 命令；**不声称已执行** |
| `projects/shadcn-admin/.github/*` | 改 | 首个落地 | `PULL_REQUEST_TEMPLATE.md`（替换上游）/ `ci.yml` / `docker.yml` / 新增 `dependabot.yml` —— 见 §5.2 B |
| `projects/shadcn-admin/docs/agent-collaboration.md` | 新 | 项目内细则 | 引用工作空间协议，不复制 |
| `projects/shadcn-admin/docs/git-workflow.md` | 新 | 项目内 Git 细则 | 分支/提交/PR/合并/回滚/线性历史/保护规则要求 |
| `projects/shadcn-admin/AGENTS.md` | 改 | 项目入口 | 增 §GitHub Collaboration |
| `projects/business-manager/**` | **暂缓** | — | 前置条件见 §14.4 |

### 11.1 多 Agent 扩展原则（当前双 Agent，未来可扩）

| 扩展点 | 双 Agent 模型 | 扩展到 N 个 Agent |
|--------|--------------|------------------|
| 角色 | 主控 / 执行 | 主控（唯一）+ 多个执行（各自 File Scope） |
| 审查 | 主控审查 | 主控 + 独立审查者（仍不可自我批准） |
| 并行 | 默认串行（`collaboration.md` §7） | File Scope 完全隔离才并行；并行度受耦合度限制 |
| 分支 | 1 任务 1 分支 | 不变；子任务各自分支，由集成责任角色合入任务分支 |
| 状态 | `TASK.md` 单 Owner | Owner 唯一；子任务用 `Parent: TASK-NNN` 字段 |
| 平台 | 1 任务 1 PR | 1 PR 或 stacked PR；（Issue 可选，不参与状态与审查） |

**保持不变量：** ① 任务状态单源；② 实现者≠批准者；③ 一任务一 Owner。

---

## 12. 自动化实施路线

### 12.1 真实能力矩阵（实测基线，**不得凭空设计**）

| 能力 | 现状 | 需要的条件 | 可行性 |
|------|------|-----------|-------|
| Git（分支/提交/推送） | ✅ SSH 身份可用 | — | **今天可用** |
| Actions 运行 | ✅ 3 个 workflow 已全绿 | — | **今天可用** |
| Actions 在 `pull_request` 上运行 | ✅ `ci.yml` 已含该触发 | — | **今天可用**（甲所需） |
| **`gh` CLI 创建 PR / 合并 PR** | ❌ | 以 `huyanluanyuqaq` 重新认证（当前 `ndldsn` 只读） | **需用户操作（甲的关键前置）** |
| 分支保护 / required checks | ❌ | 仓库 admin（网页操作或具备 admin 的令牌） | 需用户操作 |
| Actions 写 Issue/评论/标签 | ❓ 未验证 | `issues: write` + **Issues 已启用**（仅 Level 2 需要） | 启用后即得（非本期前置） |
| 第二审查身份 | ❌ | 添加协作者（public 仓库免费） | **不需要**（D1=B） |
| Secrets 存在性核查 | ❌ | admin | 需人工确认 |
| PR → 本地 Agent 自动触发 | ❌ **无技术路径** | 需 GitHub App / Webhook + 可达的 Agent 运行时 | **需先建设** |
| 受控自动合并 | ❌ | 严格条件 + 门禁 + 发布解耦（P-04） | Level 3，本期不纳入 |

> **结论：** 甲方案下 **Level 1 需用户先完成 2 项前置操作**（重新认证 `gh` 使其可写、配置分支保护/必需检查）；
> **不需要启用 Issues、不需要第二账号**。Level 2 才需要 Issues（可选）；
> Level 3 存在真实技术缺口，须先建设运行时。

### 12.2 Level 1 — 手动协作（**本期目标**）

```
主控读需求 → 建 TASK.md → 执行认领 → 建分支 → 实施 → 本地自检 →
推送分支 → 建 Draft PR → Actions 在 PR 上跑 CI → 自检后转 Ready →
主控读 PR diff + CI 结论审查 → 结论写入 handoffs/（PASS / 待整改）→
整改（同分支追加提交，PR/CI 自动更新）→ 复审 →
合并 PR（--rebase --delete-branch）→ 归档 → 回写 TASK.md Merge Record
```

> **甲方案 = 现行实践 + PR 环节 + 平台门禁。** 与 §2.5 的现行实践相比，本流程新增的是：
> ① 以 PR 作为合并前的强制环节（由此获得 CI 真门禁与"不可直推 main"）；
> ② 审查结论强制落到 `handoffs/` 的固定字段；③ 规则、模板与本地审计脚本（阶段 1）。
> **代价是 `gh` 必须可写（阶段 3 前置），且每个任务多一步 PR 流程；落地风险仍低。**

### 12.3 Level 2 — 半自动（**Level 1 稳定后**）

| 能力 | 实现手段 | 前置 |
|------|---------|------|
| 框架审计自动化 | 把 `audit_framework.py` 接入 CI（§13.1） | 无（**推荐首个落地**） |
| 提交信息规范校验 | 检查 footer 是否含 `Refs: TASK-NNN` | 无 |
| 分支命名校验 | 校验 `<type>/TASK-NNN-slug` 格式 | 无 |
| PR ↔ 任务关联校验 | 检查 PR body 是否含 `Refs: TASK-NNN`；缺则打标并评论 | 无（甲下**恢复启用**） |
| PR 描述字段完整性 | 检查是否含测试结果 / 未执行项 / 回滚方案 | 无 |
| 阻塞任务提醒 | 定时扫描 `Status: BLOCKED` 并汇总输出 | 无 |
| `TASK.md` → Issue 投影 | Action 监听 `tasks/**/TASK.md` 变更，同步标题/标签 | **需先启用 Issues**（本阶段才需要，且为可选项） |
| Issue 完整性校验 | `actions/github-script` 检查必填字段 | 同上 |
| 任务报告 | 合并后自动生成小结评论 | 同上 |

**明确不做：** 自动化**不得**替代用户审批，不得自动合并，不得自动关闭 Issue（须先处置 `stale.yml`，P-10）。
**甲下的变化：** 「PR ↔ 任务关联校验」「PR 描述字段完整性」两项**恢复为候选**（甲使用 PR）；Issue 相关三项仍为可选项。

### 12.4 Level 3 — 自动调度与受控执行（**本期不纳入**）

前置（全部满足才启动评估）：Level 1/2 稳定运行 ≥ 一个完整任务周期；存在可达的 Agent 触发通道（App/Webhook/自托管 runner）；发布与合并解耦（D8）；高风险操作仍有独立授权门禁。

**永久排除项：** 生产部署、破坏性操作、敏感权限变更、密钥变更、**镜像发布**（P-04）——这些**任何时候都保留人类授权门禁**。

---

## 13. 框架自身的验证与审计

### 13.1 本地可跑（`shared/scripts/audit_framework.py`，无网络、无写操作）

| # | 检查项 | 方法 | 通过标准 |
|---|-------|------|---------|
| A1 | 文档内部链接有效 | 解析 md 相对链接并校验目标存在 | 无死链 |
| A2 | 文件路径与目录说明一致 | 比对 `AGENTS.md`/`README.md` 声明的路径 vs 实际 | 无声明但缺失 / 无存在但未声明 |
| A3 | YAML 可解析 | `yaml.safe_load` 全部 `.yml/.yaml` | 全部通过 |
| A4 | **模板包内容与 D1b 裁决一致** | 检查 `templates/github/` **含** `PULL_REQUEST_TEMPLATE.md`，**不含** CODEOWNERS / Issue 模板（D1b=甲） | 与裁决一致 |
| A5 | Workflow 触发与权限 | 每个 workflow 有 `on:`、声明 `permissions:`；`ci.yml` 含 `pull_request` 触发（甲所需） | 全部符合 |
| A6 | 占位符残留 | 扫描 `{{` / `TODO-PLACEHOLDER` | 无残留 |
| A7 | 明文密钥 | 正则扫描（`ghp_`/`gho_`/`AKIA`/`sk-`/`JWT_SECRET=` 等） | 无命中 |
| A8 | **Ruleset 说明与实际一致性** | 比对 `templates/github/RULESET.md` 声明的规则名与 GitHub 官方规则名 | 全部可对应（不做远程验证） |
| A9 | 状态词表一致性 | 全文扫描状态名，比对白名单 | 无越界命名 |
| A10 | 规则引用完整性 | 扫描 `.agents/**` 被引用路径是否存在 | 无悬空引用 |
| A11 | CI 检查名与必需检查声明一致 | 静态比对 `ci.yml` 的 job 名 vs 文档中声明的"必需检查"名 | 一一对应（否则必需检查配置会指向不存在的检查） |
| A12 | **审查制度可执行性** | 检查 `.agents` 是否声明了"审查结论必须落 `handoffs/`"与 I2 的无平台强制披露（甲下的强制条款） | 两条均已声明 |
| A13 | **PR 模板字段完整性** | 检查 `templates/github/PULL_REQUEST_TEMPLATE.md` 是否覆盖 §7.2 的 9 个字段 | 全部覆盖 |

### 13.2 必须列为"待人工验证"（**不得虚构成功**）

| 项 | 为何不能本地/自动验证 | 记录位置 |
|----|---------------------|---------|
| `gh` 是否已具备写权限（能创建 PR） | 需实际 `gh pr create` 验证；当前凭据只读 | `github-capability-matrix.md` |
| 分支保护/Ruleset 是否已创建、内容是否符合设计 | 需仓库 admin；当前凭据对 `shadcn-admin` 仅 `pull` | 同上 |
| **V2：bypass 列表为空时所有者是否受限** | 需实际配置后实测（不能凭文档断言） | 同上 |
| **必需检查是否真正阻止合并** | 需一次"故意不通过"的实测（阶段 4 可完成） | 同上 |
| （兴趣项）V1：必需检查能否拦住直推 `main` | 甲下已由 `Require a pull request` 承担，**不再是成立条件** | 同上 |
| （兴趣项）V3：工作分支 push 是否触发 CI | 甲下不需要；仅当未来改判为乙才需要 | 同上 |
| ~~Issues 是否已启用~~ | **不是前置**（仅 Level 2 可选需要） | — |
| ~~协作者/团队权限~~ | **D1=B 不引入第二账号，不适用** | — |
| Secrets 是否存在且有效（`DOCKERHUB_*`） | 需 admin，且不得读取值 | 同上 |
| 能否用当前 token 推送 workflow 文件 | 需实际推送验证（`workflow` scope 已具备，但仍需实测） | 同上 |
| `docker.yml` 改为 tag-only 后发布是否如预期 | 需一次受控发布 | 同上 |

### 13.3 框架自验证（Dry Run）

在第一阶段落地后，**用一个真实的 docs-only 小变更完整跑一遍新流程**（`TASK.md` → 分支 → PR → CI → 审查 → 合并），
把该任务的 `TASK.md` + PR 号 + run id 作为**制度有效性的验收证据**。这比任何"设计看起来合理"的论证都可靠。

### 13.4 特别审计项：否定性断言复核

`AGENTS.md` §13 已记录过一类对检索与通读**隐形**的缺陷：
描述"未做 / 不存在 / 待办"的文字在变更完成后**不会自动失效**。
本框架落地时必须对以下否定性断言逐条复核：

- [ ] `business-manager/AGENTS.md` §6「本项目当前没有任何自动化测试」
- [ ] `business-manager/AGENTS.md` §5「本项目当前未配置 Prettier / ESLint」
- [ ] `business-manager/AGENTS.md` §13.3「已知技术债」三条
- [ ] `projects/README.md`「`tasks/backlog/`、`tasks/active/`、`tasks/review/` 均为空」（**已过时**：`shadcn-admin/tasks/done/` 已到 TASK-030，`business-manager` 有未跟踪 TASK-012）
- [ ] `projects/README.md`「当前 Workspace 本身不是 Git 仓库」（若 D9 采纳则失效）
- [ ] `shadcn-admin/AGENTS.md` §13.2「纯前端，无持久层」（**已过时**：TASK-001 起已有 Hono + SQLite 后端）

> ⚠️ **实测发现 2 处已过时的否定性断言**（见上表后两条），属本次审计的附带产出。

---

## 14. 兼容性与迁移风险

| 风险 | 说明 | 缓解 |
|------|------|------|
| R1 破坏既有流程 | 41 个已完成任务以 `tasks/` + ff-merge 为惯例 | 只做加法；历史任务**不迁移**；保留 `TASK.md` 为 SSoT。**甲新增 PR 环节**，但十阶段与现状同构，风险可控 |
| R2 状态分叉 | 平台侧与 `TASK.md` 各自可写 | D1b/D2：**平台不承载任务状态**；PR 状态只反映代码交付进度；Issue 投影（Level 2 可选）严格单向，失败不阻断文件流程 |
| R3 `business-manager` 特殊环境 | 私有、不可达、无测试、4 个 Git 陷阱、SSH 沙箱保护 | **暂缓落地**（§14.4），先出前置条件清单 |
| R4 合并策略切换风险 | 习惯 ff-only，改 squash 会改变历史形态 | 按项目显式声明。甲下建议统一 **rebase-merge**（D5，`gh pr merge --rebase`），保持 `shadcn-admin` 现有线性史 |
| R5 平台配置需 admin | 当前 `gh` 身份只读，**且甲要求可写** | 所有平台配置列入人工清单；规则中标注"**未实测/未启用**"，不得写成已完成 |
| R6 门禁过严阻塞交付 | 必需检查过多会拖慢小改动 | 仅把**稳定且必要**的检查设为必需；先跑一周观察再收紧 |
| R7 `stale.yml` 误关记录 | 定时自动关闭 Issue/PR | **甲下影响回升**：PR 已在使用，`stale.yml` 可能自动关闭沉寂的 PR → **启用前必须先处置**（升级为阶段 3 前置） |
| R8 合并触发对外发布 | P-04 | **已由 D8 化解**：`docker.yml` 改 tag-only，合并不再触发发布 |
| R9 上游 fork 漂移 | `shadcn-admin` 是 fork，替换上游 `PULL_REQUEST_TEMPLATE.md` 会增加同步成本 | D11=替换并记录；上游同步走 `upstream` remote，冲突时按上游结构合并 |
| R10 规则重复未收敛 | C-05/C-06/C-07 | 阶段 B 收敛为单一来源 + 引用；一次只动一处 |
| R11 **CI 门禁失效** | 若 `Require a pull request` / `Require status checks` 未同时启用，或未勾选"不允许绕过" | 阶段 3 验收强制核对四项配置齐全；结论写入能力矩阵 |
| R12 **`gh` 不可写导致流程中断** | 甲强依赖可写凭据；若阶段 3 未完成，**无法合并任何更改** | 列为阶段 3 的首要前置；在能力矩阵标注；过渡期可临时由用户在网页端合并（**须记录**） |

### 14.4 `business-manager` 暂缓的前置条件

- [ ] 至少建立类型检查 + 构建的 CI 门禁（当前仅 docker.yml）
- [ ] 处置 4 个 Git 陷阱的脚本化规避（`git-ref-repair.sh` 已验证可用）
- [ ] 决定 `gh` 身份能否访问私有仓库（需授权或换令牌）——**甲下此项为硬前置**（创建 PR 必需）
- [ ] 清理 TASK-011 未合并分支与 TASK-012 未提交目录
- [ ] 明确 `CLAUDE.md` 同步策略（C-08）

> **甲方案对本项目的额外要求：** 该仓库需同时具备 workspace 规则 + 分支 + CI + **可写的 `gh` 凭据**；
> 「gh 身份可达」由"加分项"升级为**硬前置**。此外私有仓库的分支保护可能需 Pro/Team 计划（见 §7.4.1 计划限制）。

---

## 15. 分阶段实施计划与验收标准

> **仅在用户批准后执行。** 每阶段独立可验证、可回退。

### 阶段 1 · 规则与模板（纯文件，零平台依赖）

| 项 | 内容 |
|----|------|
| 动作 | 新建 `.agents/protocols/{dual-agent-model,github-collaboration,github-capability-matrix}.md`；新建 `.agents/rules/github.md`；新建 `templates/github/`（`PULL_REQUEST_TEMPLATE.md`、`dependabot.yml`、`RULESET.md`、`workflows/ci-node-pnpm.yml`、`workflows/ci-generic.yml` —— **不含 CODEOWNERS / Issue 模板**）；改 `templates/project/AGENTS.md`；改根 `AGENTS.md`（仅指针，收敛 C-05） |
| 可回退 | 全部为新增文件；删除即回退。`AGENTS.md` 变更单提交可回退（但根目录非仓库 → 需人工备份，见 D9） |
| 验收 | A1–A13 全部通过；无 `{{` 残留；状态词表无越界；`.agents` 引用无悬空；**模板包含 PR 模板、不含 CODEOWNERS/Issue 模板** |
| **状态** | ✅ **已完成**（2026-10-14）：`audit_framework.py` **PASS=13**。回退点 `.workbuddy-ai/backup-stage1-20261014-140926.tar.gz`（工作空间根非 Git，只能手工解包）。**一处偏离**：原计划的 `templates/github/RULESET.md` 最终更名为 `GITHUB-CAPABILITY.md`（配置步骤与实测记录分离，见 `github-capability-matrix.md` §8） |

### 阶段 2 · 首个项目落地（`shadcn-admin`）

| 项 | 内容 |
|----|------|
| 动作 | **替换 `.github/PULL_REQUEST_TEMPLATE.md`（由上游模板改为本框架模板，映射 HANDOFF 12 字段）**；改 `ci.yml`（加 `permissions:` + 框架审计 job + node 版本对齐——**无需改触发条件**）；改 `docker.yml` 为 tag-only（D8）；新建 `.github/dependabot.yml`；改 `AGENTS.md`（+§GitHub Collaboration）；新建 `docs/{agent-collaboration,git-workflow}.md`；修正 `CONTRIBUTING.md` 的上游链接（P-08） |
| **不新增** | `.github/CODEOWNERS`（`approvals=0` 下无强制力）、新增 Issue 模板（Issue 不参与状态与审查） |
| 可回退 | 单任务分支 + PR；未合并前 `main` 不变 |
| 验收 | CI 全绿（含新审计 job）；**PR 上 CI 如期触发并通过**；PR 模板在 GitHub 渲染正常（需人工在网页确认一次）；A1–A13 通过 |
| **状态** | ✅ **已完成并合并**（2026-10-14，载体 = TASK-031，档案见 `projects/shadcn-admin/tasks/done/TASK-031-github-framework-adoption/`）：PR [#1](https://github.com/huyanluanyuqaq/shadcn-admin/pull/1) 经 **rebase-merge** 合入 `main`（`05bf884` → `da93f4b`）；四次 CI 全绿（三次 `pull_request` + 一次合并后 `push`）；**独立审查**（`dual-agent-model.md` §5.1 的换实例手段）+ **3 轮复审 PASS**；合并后实测 **`docker.yml` 未触发**（D8 解耦成立）。<br>**合并后回写**按 §4 走**独立交付请求** [PR #2](https://github.com/huyanluanyuqaq/shadcn-admin/pull/2)（`chore/TASK-031-archive-record`），亦经 **rebase-merge** 合入（`da93f4b` → **`e3231e7`**，2026-10-14T11:11:13Z）；该 PR **6 轮独立复审（10 项阻断项）+ 7 次 CI** 后 PASS；合并后 `main` push CI（run `38554805756`）两作业 ✅，**`docker.yml` 仍未触发**（D8 **第二次独立复现**）；归档生效（TASK-031 现于 `tasks/done/`；`tasks/review/` 仅剩 `.gitkeep`）。<br>**三项如实披露：** ① 验收项「**PR 模板在 GitHub 网页渲染正常**」**仍未人工确认** —— PR #1 / #2 的描述均由 API 写入，未经过模板；需在阶段 3 由用户在网页打开一次新建 PR 页面确认；② 阶段 2 暴露框架内部张力 **D13**，且已在本次回写中**实际触发**（其深层形态「无限回归」与实测数据见 §17.3）；③ **PR #2 自身的合并标识无文件载体**，临时由 `handoffs/2026-10-14-review.md` §11.5 的「终端豁免声明」覆盖，**制度化待 D13 裁决** |

### 阶段 3 · 平台配置（**需用户操作，Agent 不代做**）

| 项 | 内容 |
|----|------|
| 动作（用户） | ① **`gh` 以 `huyanluanyuqaq` 重新认证，使其具备写权限**（当前只读；**甲下这是创建 PR 的硬前置**，缺失则无法合并任何更改）；② 配置分支保护：`Require a pull request before merging` + `Require status checks to pass`（选定 `ci.yml` 的 job 名）+ `Do not allow bypassing the above settings` + 禁 force push + 禁删分支 + （可选）强制线性历史；③ `Require approvals` **保持 0**；④ 实测 **V2**（bypass 列表为空时所有者是否受限）与"必需检查是否真正阻止合并"；⑤ **处置 `stale.yml`**（否则可能自动关闭沉寂的 PR，R7） |
| **不需要** | ~~启用 Issues~~（D2：Issue 不参与状态与审查，仅 Level 2 可选）<br>~~`Require approvals`~~（单账号下必须为 0）<br>~~添加第二协作者~~（D1=B 不引入第二账号） |
| 验收 | `gh api repos/.../branches/main/protection` 返回 200 且四项配置齐全；**能成功创建并合并一个测试 PR**；**V2 与"检查是否阻止合并"的实测结论写入 `github-capability-matrix.md`** |
| **状态** | 🟢 **已收口 —— 第一件（分支保护）已完成并实测有效**（2026-10-14；2026-10-15 由 TASK-033 收口）：<br>・① `gh` 重新认证为仓库所有者**已完成**（实测 `permissions` 为 `admin/push/pull/maintain/triage` 全 `true`）；<br>・② **分支保护已启用**（经典版；`rulesets` 仍为空）：`Require a pull request`（父项）+ 必需检查 **`install-lint-build` / `audit`** + `approvals = 0` + `Do not allow bypassing`（`enforce_admins = true`）+ 禁 force push + 禁删分支 + `strict = false`；`GET /branches/main/protection` 已由 **404 → 200**。<br>&nbsp;&nbsp;**⚠️ 实测踩到的 UI 陷阱**：`Require approvals` 下拉**只有 1–6，没有 `0`** —— 「0 次审批」的唯一 UI 表达是**不勾该子项**（勾 ≥1 会让单账号仓库**所有 PR 永久合不进去**）。判据：`required_pull_request_reviews` 返回 `null` = PR 要求未开；返回带 `url` 的对象（哪怕 `count = 0`）= 已开。<br>・**V1 / V2 / V4 实测全部通过**（原始输出见 checklist §六）：<br>&nbsp;&nbsp;**V2**（bypass 列表为空时所有者是否受限）—— 以**所有者身份**（SSH `huyanluanyuqaq`）直推 `main` → GitHub `GH006 Protected branch update failed … Changes must be made through a pull request / 2 of 2 required status checks are expected` / `protected branch hook declined` **拒绝** ⇒ **"不允许绕过"对仓库所有者真实生效**（非门禁空转）；<br>&nbsp;&nbsp;**V1**（兴趣项）同一操作顺带验证成立；<br>&nbsp;&nbsp;**V4**（必需检查是否真正阻止合并）—— 探针 PR [#3](https://github.com/huyanluanyuqaq/shadcn-admin/pull/3) 故意令 `install-lint-build` 失败 → `mergeable_state: blocked`，`PUT /pulls/3/merge` 返回 **HTTP 405 `Required status check "install-lint-build" is failing.`**，`main` 未发生变动（仍 `e3231e7`）；探针 PR 已关闭、分支已删。<br>**⑤ `stale.yml` 已处置**（去 `schedule` + 禁用 PR 侧 + 收窄权限）；「**PR 模板网页渲染**」已由用户目视确认；**V5**（检查全绿后所有者能否正常合并自己的 PR）**已取得阳性对照**（TASK-033 的 PR [#4](https://github.com/huyanluanyuqaq/shadcn-admin/pull/4)：绿灯时 `merged: true`）⇒ **阶段 2 遗留的唯一验收项就此闭环**。<br>**原「验收项尚未完成」现已完成**：`github-capability.md` §1–§8 由 TASK-033 的交付请求（PR [#4](https://github.com/huyanluanyuqaq/shadcn-admin/pull/4)）落地，其归档回写为 PR [#5](https://github.com/huyanluanyuqaq/shadcn-admin/pull/5) ⇒ **阶段 3 的「平台门禁」部分据此收口**。<br>**★ D13 同日裁决为 C**（2026-10-15，见 §17.3）；**D12 已授权并执行**（远端仅剩 `main` —— **时点快照：2026-10-15 D12 执行时**；此后每个新任务的交付分支会**暂时增加**、经交付请求合并并删分支后**恢复**，非永久断言，引用前以 `git ls-remote --heads origin` 重测）。 |

### 阶段 4 · Dry Run 验证制度

| 项 | 内容 |
|----|------|
| 动作 | 选 1 个 docs-only 真实任务，完整走 §7（= §7.4）的 10 阶段流程 |
| 验收 | **存在 PR 号与 PR 上的 CI run**；`handoffs/` 含逐条 AC 核对与 PASS/FAIL；`TASK.md` Merge Record 含 PR 号与 run id；**执行者自测与主控独立验证在 `handoffs/` 中可区分**；**"直推 `main` 被拒绝"有一次实测记录** |
| **状态** | ✅ **实质已完成**（补记日期 2026-10-15）—— 五项验收标准已由 **PR #4–#8 五次真实交付**逐项实证：① **存在 PR 号与 PR 上的 CI run** —— [#4](https://github.com/huyanluanyuqaq/shadcn-admin/pull/4)（TASK-033 阶段 3 平台记录）、[#5](https://github.com/huyanluanyuqaq/shadcn-admin/pull/5)（TASK-033 归档回写）、[#6](https://github.com/huyanluanyuqaq/shadcn-admin/pull/6)（TASK-035 D13 路线 C）、[#7](https://github.com/huyanluanyuqaq/shadcn-admin/pull/7)（TASK-034 V 编号统一）、[#8](https://github.com/huyanluanyuqaq/shadcn-admin/pull/8)（TASK-032 否定性断言复核）均经 rebase-merge 合入 `main`，每次合并前后 CI run 均在 GitHub 留痕（如 PR #8 合并后 push run [`38687252674`](https://github.com/huyanluanyuqaq/shadcn-admin/actions/runs/38687252674)：`audit` 5s / `install-lint-build` 1m22s 双绿）；② **`handoffs/` 含逐条 AC 核对与 PASS/FAIL** —— 上述任务的 `handoffs/2026-10-15-review.md` 均含逐条 AC 核对表与 PASS/FAIL 结论；③ **`TASK.md` Merge Record 含 PR 号与 run id** —— TASK-033 / 034 / 035 已回填（TASK-032 的回填由 TASK-036 按 D13-C 承载，见 `rules/github.md` §6）；④ **执行者自测与主控独立验证可区分** —— 审查均为**换实例双会话**（`dual-agent-model.md` §5.1），审查记录以被审提交 SHA 钉住，与执行者自测记录同存于 `handoffs/` 但可区分；⑤ **"直推 `main` 被拒绝"实测记录** —— V2（bypass 列表为空时所有者是否受限）以所有者身份直推 `main` 被 GH006 拒绝，原始输出见 `projects/shadcn-admin/docs/operations/github-capability.md` §4。<br>**滞后说明：** 本行原缺失属**文档滞后** —— 制度早已被真实交付验证，但设计稿未留状态行；按 TASK-032 建立的滞后断言复核机制（`projects/shadcn-admin/docs/operations/negative-assertion-review.md`）于 2026-10-15 补记。 |

### 阶段 5 · Level 2 自动化（可选，Level 1 稳定后）

| 项 | 内容 |
|----|------|
| 动作 | **框架审计自动化**（`audit_framework.py` 接入 CI）、提交 footer 与分支命名的格式校验、PR ↔ 任务关联校验、阻塞任务提醒、（可选）Issue 投影 |
| 前置 | 若需 Issue 相关能力，需先启用 Issues —— **本阶段才需要，非阶段 3 前置** |
| 验收 | 各项在真实任务上触发过一次并有日志；**未替代任何用户审批** |

### 阶段 6 · `business-manager` 评估（可选）

前置条件（§14.4）全部满足后再启动；不满足则保持现状并在能力矩阵中标注。

---

## 16. 文件修改计划汇总

| 范围 | 新增 | 修改 | 删除 |
|------|------|------|------|
| 工作空间 | 3 协议 + 1 规则 + github 模板包（5：PR 模板、dependabot、RULESET.md、2 个 workflow 模板）+ 2 脚本 + 本提案 | `AGENTS.md`、`README.md`、`templates/project/AGENTS.md` | 无 |
| `shadcn-admin` | `.github/dependabot.yml` + 2 个 `docs/**` | **`PULL_REQUEST_TEMPLATE.md`（替换上游）**、`ci.yml`、`docker.yml`、`AGENTS.md`、`CONTRIBUTING.md` | 无（`stale.yml` **已于 2026-10-15 处置**：去 `schedule` + 禁用 PR 侧 + 收窄权限） |
| `business-manager` | 无（暂缓） | 无 | 无 |

**全程不做的事：**
- ❌ 不重命名既有角色、状态、目录、脚本
- ❌ 不迁移 41 个历史任务
- ❌ 不修改受保护规则文件（`security.md` / `change-safety.md` / `git.md` §6 / `testing.md` §6 / `permissions.md` §3 P3）
- ❌ 不替用户执行 GitHub 写操作（改分支保护、加协作者、重新认证 `gh`、合并 PR、推 `main`）
- ❌ 不新增 `CODEOWNERS` / Issue 模板（D1b=甲 下二者无作用）
- ❌ 不在未授权情况下删除分支、备份目录、`data/`、`.workbuddy-ai/backup-TASK-000/`

---

## 17. 需要用户决策的事项

> **裁决状态：全部阻塞项均已裁决（D1b 最终为甲；D13 为选项 C）。**
> **D12**（删除远端分支）已于 **2026-10-15 授权并执行完毕**；
> **D13**（合并后回写路径 + 回归终止）已于 **2026-10-15 裁决为选项 C**。裁决明细见 §17.1，D13 见 §17.3。
>
> ✅ **D13 已不再是张力**：它于 **选项 A 时期实际触发 3 次**（2026-10-14 TASK-031 的 PR #2；
> 2026-10-15 TASK-033 的 PR #4 / PR #5，见 §17.3「实测」）；**D13-C 裁决后已 3 次**
> （PR #7 承载 TASK-035、PR #8 承载 TASK-034、PR #9 承载 TASK-032；TASK-036 的回写由
> TASK-037 的交付请求承载 = **第 4 个 C 实例**）。
> **时点：2026-10-15（TASK-037 建档案时）。此后每个任务的交付请求可能 +1** ——
> 非永久断言，引用前以 `gh pr list --state all --json number,title` 与
> `gh api repos/huyanluanyuqaq/shadcn-admin/pulls/<n>` 重测。
> 现由裁决 **C（回写并入下一个任务的交付请求）** 终结 —— **无限回归终止于深度 1**。

| ID | 决策 | 选项 | 推荐 | 影响 |
|----|------|------|------|------|
| **D1** | 双 Agent 与 GitHub 账号的对应关系 | **✅ 已裁决：不引入第二账号（配置 B）**；审查结论落文件层（`TASK.md` + `handoffs/`），不启用平台审批 | A | 见 §9.4.3 / §9.4.5；`Require approvals` 固定 0。代价：I2 失去平台强制，仅剩流程约束（须双会话审查 + Known Issues 披露） |
| **D1b** | 是否保留 PR 作交付与 CI 载体 | **✅ 已裁决：甲（保留 PR）**——§9.4.7 证明"甲"不需要第二账号 | 甲 | 见 §9.4.6；恢复 PR 模板；**`gh` 可写成为硬前置**；CI 门禁**不依赖实测 V1** |
| **D2** | 任务状态唯一事实来源 | **✅ 已裁决：A** `TASK.md` 为准；Issue 投影降级为 Level 2 可选 | A | 决定离线可用性与双写成本（偏离任务书默认） |
| **D3** | 门禁强度 | **✅ 已裁决（已按 D1b=甲 修订）**：**真门禁** = `Require a pull request` + 必需检查 + 禁止绕过；**审批环节为制度门禁** | — | "禁止直推 main"**首次获得平台强制**；唯一不获强制的仍是"实现者 ≠ 批准者" |
| **D4** | 必需检查清单 | 建议：lint + format:check + test + build（对齐现有 ci.yml） | 采纳 | 过多会拖慢交付 |
| **D5** | 合并策略统一 | squash / merge commit / rebase-merge | **rebase-merge**（`gh pr merge --rebase`，保持线性） | 历史形态与 `C-01` 收敛 |
| **D6** | 任务标识符 | A 保留 `TASK-NNN`（PR 关联字段）/ B 改用 PR 编号 | **A** | 决定分支名与提交 footer 格式 |
| **D7** | 落地范围顺序 | A 仅 `shadcn-admin` / B 两个项目同时 | **A** | 降低风险，先验证再复制 |
| **D8** | `docker.yml` 触发 | A 保留 push-to-main / B 改 tag-only / C 合并加发布审批 | **B**（解耦合并与发布） | 决定自动合并是否可行（P-04） |
| **D9** | `.agents/` 纳入 Git | A 纳入（工作空间 git init，需处理嵌套仓库）/ B 保持现状 | **A（但列为独立任务）** | 决定规则可追溯性；须先按 `projects/README.md` 处理嵌套 |
| **D10** | Level 3 是否纳入本期 | A 不纳入 / B 纳入 | **A** | Level 3 存在真实技术缺口 |
| **D11** | 上游遗留资产 | **✅ 已裁决（按 D1b=甲 修订）：`PULL_REQUEST_TEMPLATE.md` 替换为本框架模板；其余上游资产保留不动并标注** | — | 上游模板字段与 HANDOFF 不对应，必须本地化（R9） |
| **D12** | 已合并远端分支与历史遗留 | A 删除 / B 保留追溯 / C 保留但加注释 | **✅ A —— 2026-10-15 已授权并执行**（删除 **7** 条：`feat/TASK-028/029/030` + `chore/TASK-031-*` ×2 + `chore/TASK-033-*` ×2；远端现仅剩 `main`）<br>**时点限定（2026-10-15 补，TASK-036）：**「远端现仅剩 `main`」是 **2026-10-15 D12 执行时**的快照；此后每个新任务的交付分支会**暂时增加**、经交付请求合并并删分支后**恢复** —— 非永久断言，引用前以 `git ls-remote --heads origin` 重测 | 与 `git.md` §5 一致性。注：甲下 `gh pr merge --delete-branch` 会自动清理后续分支 |
| **D13** | **合并后的回写路径**（§4 禁止直推默认分支 ⟷ §6 要求「合并后必须回写」）；**含「回归在哪终止」** | A 记录分支 + 交付请求 / ~~B 为「归档回写」开直推豁免~~（**已失效**：与 D3 冲突）/ **✅ C 回写并入下一任务的交付请求** / D 承认终端豁免（**在 C 下不再需要**） | **✅ C（2026-10-15 裁决）** | 决定**所有任务**的归档方式，见 §17.3。**已实际触发 3 次**（TASK-031 的 PR #2；TASK-033 的 PR #4 / PR #5）；**C 裁决后已 3 次**（PR #7 承载 TASK-035、PR #8 承载 TASK-034、PR #9 承载 TASK-032），TASK-036 的回写由 TASK-037 的交付请求承载 = **第 4 个 C 实例**（**时点：2026-10-15；此后每个任务的交付请求可能 +1**，非永久断言，引用前以 `gh pr list --state all --json number,title` 与 `gh api repos/huyanluanyuqaq/shadcn-admin/pulls/<n>` 重测）。**C 的代价**：最近完成的任务在下一个任务出现前**保持 `Status = REVIEW`**（`TASK.md` 须诚实标注）。**回归终止于深度 1** —— 永不产生「回写专用请求」 |

---

### 17.1 裁决记录（截至 2026-10-14 12:56）

| ID | 裁决结果 | 状态 |
|----|---------|------|
| **D1** | **不引入第二个 GitHub 账号（配置 B）**；审查结论落文件层（`TASK.md` + `handoffs/`），不使用 GitHub `approve` | ✅ 已裁决（含义与代价见 §9.4.5） |
| **D1b** | **甲：保留 PR 作交付与 CI 载体**；`Require a pull request` + 必需检查 + 禁止绕过，`approvals = 0` | ✅ **已裁决（2026-10-14 最终）**——曾先裁为乙，经 §9.4.7 核实后改判 |
| **D2** | **A. `TASK.md` 为唯一事实来源**；Issue 不参与状态与审查（投影降级为 Level 2 可选） | ✅ 已裁决（明确接受对任务书 §8 默认口径的偏离） |
| **D3** | **真门禁**：`Require a pull request` + 必需检查 + 禁止绕过；审批为制度门禁 | ✅ 已裁决（按 D1b=甲 修订） |
| **D7** | **A. 仅 `shadcn-admin` 先行**，`business-manager` 暂缓 | ✅ 已裁决（前置条件见 §14.4） |
| **D8** | **B. `docker.yml` 改为 tag-only 触发** | ✅ 已裁决，解耦「合并」与「对外发布镜像」 |
| **D11** | **PR 模板替换为本框架模板**；其余上游资产保留不动并标注 | ✅ 已裁决（按 D1b=甲 修订） |
| D4 / D5 / D6 / D10 | 采用 §17 推荐值 | 🟡 默认采纳（如无异议按推荐执行） |
| D9 | `.agents/` 纳入 Git，列为独立后续任务（需先处理嵌套仓库） | 🟡 默认采纳 |
| **D12** | 删除已合并远端分支 | ✅ **已裁决并执行（2026-10-15）**：授权删除 **7** 条已并入 `main` 的分支。**执行前逐条核验**（3 条 `feat/TASK-02x` 为 `main` 祖先；4 条 `chore/TASK-03x-*` 有已合并 PR 且 head SHA 与分支 tip 一致）⇒ 无内容丢失风险。远端现仅剩 `main`<br>**时点限定（2026-10-15 补，TASK-036）：** 「远端现仅剩 `main`」为 **2026-10-15 D12 执行时**快照；此后每个新任务的交付分支会**暂时增加**、合并并删分支后**恢复** —— 非永久断言，引用前以 `git ls-remote --heads origin` 重测 |
| **D13** | 合并后的回写路径 **+ 回归在哪终止** | ✅ **已裁决（2026-10-15，用户选定「乙」= 选项 C）**：回写**并入下一个任务的交付请求**；**回归终止于深度 1** —— 永不产生「回写专用请求」，故选项 D（终端豁免）在 C 下**不再需要**。已落入 `rules/github.md` §2/§6 与 `protocols/github-collaboration.md` §9；本任务（TASK-035）为其落地载体。详见 §17.3 |

**待实测项（不属决策，属验证）：**

| # | 待实测 | 归属阶段 | 若不成立的影响 |
|---|--------|---------|--------------|
| V2 | 分支保护的 bypass 列表为空时，仓库所有者是否仍受约束 | 阶段 3 | 禁 force push / 禁删分支对所有者无强制力（**甲下仍必须实测**） |
| V4 | 必需检查是否真正阻止"检查未通过的 PR"被合并（阴性对照） | 阶段 3/4 | `Require status checks` 名存实亡（**甲下仍必须实测**） |
| V5 | 必需检查**全绿**时，所有者（批准数 = 0）能否正常合并**自己的 PR**（阳性对照，与 V4 成对） | 阶段 3/4 | 门禁**误伤**合规交付（单账号仓库误配批准数 ≥ 1 会永久卡死合并） |
| V1 | （兴趣项）必需检查能否拦住**直推** `main` | 阶段 3 | **甲下不影响**：直推由 `Require a pull request` 直接禁止 |
| V3 | （兴趣项）`ci.yml` 增加工作分支 push 触发后，检查是否如期运行 | 不适用 | **甲下不需要**：`pull_request` 触发已足够 |

> **V5 编号裁决（TASK-034，2026-10-15）：** 本表原**只定义到 V4**，而 §15 阶段 3 的状态记录却引用了
> 「V5（检查全绿后所有者能否正常合并自己的 PR）」—— 同期 `github-capability-matrix.md` §8 与
> `templates/github/GITHUB-CAPABILITY.md` 却把 V5 定义为「直接推送默认分支是否确实被拒绝」，
> 构成**跨文件的一号两义**。**裁决：V5 = 「绿灯可合并」阳性对照义**（与 V4 成对）——
> 「直推被拒」的信息已由 V1（检查角度）与 V2（所有者角度）承载、且证据必然与 V2 重复，弃用该义。
> 权威定义见 `github-capability-matrix.md` §8。**实测状态（2026-10-15）：V1–V5 全部成立**
> （逐项证据见 shadcn-admin `docs/operations/github-capability.md` §4）。
>
> **V3 措辞注（TASK-037，2026-10-15，防漂移登记）：** 本表 V3 行「（兴趣项）`ci.yml` 增加工作分支
> push 触发后，检查是否如期运行」为**阶段 2 的 push 触发提案**语境；权威定义见
> `github-capability-matrix.md` §8（「检查是否在**合并之前**于工作分支上运行」）——
> 两者侧重略异（触发 vs 时机），TASK-034 独立审查判「同义、无冲突」。本行结论
> 「**甲下不需要**：`pull_request` 触发已足够」**维持不变**。

### 17.2 D1b 裁决方法（决策树 + 成本对称性）— **已裁决为甲，本节存档**

> ✅ **最终裁决：甲（2026-10-14）。** 本节保留决策过程与依据，供未来复核。
> 结论：**Q1 = 是（CI 必须成为硬门禁）、Q2 = 是（愿意为审计留痕增加 PR 步骤）**，故取 **甲**。
> 下文原写的"建议丙"是裁决前的分析，**已被用户的实际选择覆盖**：
> 用户更看重"每次变更都有一份可回看、可追溯的差异记录"，且已接受"`gh` 需可写"这一前置条件。

> **本决策的低成本与可逆性：** 三个选项在平台配置上只差**一个复选框**，可先落地最低档再按需升级。

**三个选项是"递增包含"关系，不是并列的：**

```
乙 = 禁止 force push + 禁止删除分支                        → CI 仅供提示
丙 = 乙 + Require status checks to pass                    → CI 可能成为门禁（待 V1）
甲 = 丙 + Require a pull request before merging + PR 模板   → CI 确定成为门禁 + diff 审计
```

**⇒ 切换成本：乙 ⇄ 丙 = 勾一个复选框；丙 → 甲 = 再勾一个复选框 + 加一个模板文件。**
**⇒ 因此可以"先落地最低档、按需升级"，不存在沉没成本。**

**裁决只需回答两个问题：**

| # | 问题 | 答"否" | 答"是" |
|---|------|-------|-------|
| **Q1** | CI 是否**必须**成为硬门禁（不绿就不能进 `main`）？ | → **乙** | 继续 Q2 |
| **Q2** | 是否愿意为每个任务增加"建 PR → 等 CI → 合并 PR"的步骤，以换取逐行差异讨论与平台审计留痕？ | → **丙** | → **甲** |

**建议：Q1 答"是"、Q2 答"否"，即先落地「丙」。** 依据三条：

1. **丙是甲的严格子集** —— 升级成本 = 1 个复选框 + 1 个模板文件，**无返工**；
2. **丙避开了甲唯一的新增依赖**（`gh` 必须可写）。当前凭据只读，而 `Require a pull request` 一旦启用，
   没有可写凭据就**无法合并任何更改**；丙则今日即可运行；
3. **甲的核心价值是"平台侧审计留痕"**，其收益随协作人数增长。当前为单一所有者，收益有限，
   而每任务成本固定增加。

> 但若更看重"每次变更都有一份可回看、可追溯的差异记录"，**甲是唯一能提供它的选项**，
> 且其代价仅是一个额外步骤。

**待实测项与选项的对应关系（决定实际门禁强度）：**

| 选项 | V1（必需检查能否拦直推） | V2（bypass 是否约束所有者） | V3（工作分支 CI 触发） |
|------|----------------------|------------------------|--------------------|
| 乙 | 不适用（未启用必需检查） | **适用** | **适用**（否则 CI 不在合并前跑） |
| 丙 | **适用（关键）** | **适用** | **适用（关键）** |
| 甲 | 不适用（由 `Require a pull request` 承担） | **适用** | **不适用**（现有 `pull_request` 触发已足够） |

**一个必须提前知道的锁定风险（甲乙丙共有，由必需检查引入）：**

> 一旦启用 `Require status checks` 并勾选 `Do not allow bypassing`，
> 若某次提交**破坏了 `ci.yml` 自身**（例如 YAML 非法导致检查永不上报），
> 则"合并被阻"与"直推被阻"会同时成立 → **无法用常规手段修复 `main`**。
> **唯一逃生通道：以所有者身份在网页端修改或停用该规则。**
>
> ⇒ 因此 `Do not allow bypassing` 应被理解为**承诺机制**——让"绕过"成为一个需要刻意操作、
> 因而可见且可追溯的动作——而**不是**"物理不可越"的保证。
> 这一条必须写入 `github-capability-matrix.md`。

**不随选项改变的三条结论：**

- 三者**都不需要**第二个 GitHub 账号；
- 三者**都无法**提供"实现者 ≠ 批准者"的平台强制（代价恒定，见 §9.4.5）；
- 三者都需以仓库所有者身份在网页端完成配置，**Agent 不代做**。

**裁决后需连带更新的位置（✅ 已全部更新）：**
§6.3 权限矩阵 · §7 十阶段表 · §7.4 详细流程 · §8.1 状态源分工 · §12 自动化分级 · §13 审计项 A4/A5/A8/A12/A13 · §16 文件清单 · §17.1 记录表 · `github-capability-matrix.md`（待建）。

---

### 17.3 D13：合并后的回写路径 —— **✅ 已裁决（2026-10-15 · 选项 C）**

> ### ✅ 裁决结果（2026-10-15，用户选定「乙」）
>
> **路线 = 选项 C：合并后的回写并入「下一个任务」的交付请求**，**不单独开「回写专用」交付请求**。
>
> **回归终止 = 深度 1。** 由于永不产生「回写专用请求」，§4（禁直推）与 §6（要求回写）
> 的无限回归**在此终止**：任何任务的 `Merge Record` **至多延后一个任务**补记。
> ⇒ 原 **选项 D（终端豁免）在 C 下不再需要**（没有任何「回写请求自身的合并标识」需要豁免）。
>
> **代价（已接受，须如实记录）：** 在下一个任务出现之前，**最近完成的任务保持 `Status = REVIEW`、
> 留在 `tasks/review/`** —— 即 `protocols/github-collaboration.md` §9 的「状态与目录一致」检查
> **在该窗口内不成立**。这属**已裁决的代价**，不是缺陷；该任务的 `TASK.md` **必须诚实标注**
> 「归档回写待下一个任务补记」。
>
> **落地位置：** `rules/github.md` **§2**（「一分支一任务」的**有界豁免**：该分支同时承载上一任务的归档回写）
> 与 **§6**（回写路径 + 回归终止）；`protocols/github-collaboration.md` **§9** 与阶段 10 的完成判据。
> **落地载体：** TASK-035。
>
> **为何不选 A：** A 的成本经实测**高于草拟预估** —— 不止「多一次 PR 与 CI」，而是
> **多一整套串行审查**（TASK-031 实测 6 轮复审 / 7 次 CI / 10 项阻断项；TASK-033 的归档 PR 亦需 1 轮）。
> 若每任务都走，**每任务审查成本约翻倍**。
>
> **为何不选 B：** 分支保护启用后**已实质失效** —— 经典分支保护无按路径豁免；开豁免只能关闭
> `enforce_admins`，那会使**所有**规则对管理者失效 = **直接违反 D3（真门禁）**（见下）。

---

**问题的来源：** 不是设计推演，而是**实施时撞上的真实冲突**。

| 条款 | 要求 |
|------|------|
| `rules/github.md` **§4** | 「所有对默认分支的改动必须通过交付请求合并，**禁止直接推送默认分支**」（该条同时列入 §7 **禁止操作**表） |
| `rules/github.md` **§6** | 「合并后**必须**回写任务文件：状态、合并标识、检查运行标识、遗留问题」 |

**冲突点：** §6 要求的回写**只能发生在合并之后**，因此无法通过「合并前就写进分支」来规避；
而 §4 又禁止带着这次回写直推 `main`。**两条不可能同时靠「直推」满足。**

**更深一层 —— 无限回归**（2026-10-14 实施交付请求 #2 时发现）：

§6 要求回写的内容**包括「合并标识」**。而当**回写本身**也是一次交付请求时，
「该交付请求**自身**的合并标识」同样需要回写 —— 于是需要**再一次**交付请求，
其自身的合并标识又需要回写 …… **回归不收敛**。

**这一形态只在「回写走交付请求」时才出现。** 历史上靠「合并后直推 `main`」时，
最后一次回写**不需要**自己的合并标识（它不是一个被合并的交付请求），故不回归。
⇒ **无限回归是 §4 ∧ §6 组合的属性，而非 §6 单条的问题**（交付请求 #2 的第 6 轮独立复审确认该推论成立且表述准确）。

**因此 D13 不止要选「回写走哪条路」，还必须同时决定：回归在哪一层终止。**

**历史做法（TASK-001~030）：** 实际上是**合并后直推 `main`** 完成回写。
证据：`gh pr list --state all` 显示本仓库在 TASK-031 之前**没有任何 PR**，
故那些「归档 + Merge Record」提交只可能落在 `main` 上。**该做法在新规则下已不再合规。**

**TASK-031 采用的临时做法（选项 A）：**

- 合并后另开短生命周期分支 `chore/TASK-031-archive-record`，以**独立交付请求**完成回写与归档。
- **选择理由：** 冲突时优先不违反**显式禁止项**（§4 属禁止操作表），
  而 §2「一个任务一个分支」属结构约定。
- **代价（须如实记入）：** ① 需要一条「记录分支」，其服务的仍是同一任务，与 §2 形成第二处张力；
  ② 每个任务会多一次交付请求与 CI 周期。

**实测（2026-10-14T11:11:13Z —— 选项 A 已实际执行一次）：**

| 环节 | 实测结果 |
|------|---------|
| 回写交付请求 [PR #2](https://github.com/huyanluanyuqaq/shadcn-admin/pull/2) 合并 | `merged_at` = `2026-10-14T11:11:13Z`；**rebase-merge**；`merge_commit_sha` = **`e3231e7`**（与合并后 `main` HEAD **一致**） |
| 该 PR 的审查成本 | **6 轮独立复审**（第 1~4 轮各拦下阻断项、第 5~6 轮 **PASS**），**共 10 项阻断项**；提交 **7** 个；CI 运行 **7** 次（全部 `pull_request`，全部绿）<br>※ 其中**最后一次**的运行标识按 §11.5 终端豁免**未回写文件**，故 `handoffs/…review.md` §11.2 只收录 **6** 条 |
| 合并后 `main` CI（`push`） | run `38554805756`：`install-lint-build` ✅ ／ `audit` ✅ |
| 合并后 `docker.yml` | **未触发** —— D8 解耦**第二次独立复现**（对照：合并前的 `05bf884` / `492e159` 均带 `Build and Push Docker Image` 运行） |
| 归档结果 | `main` 上 TASK-031 已在 `tasks/done/`；`tasks/review/` 仅剩 `.gitkeep` |
| 回写 PR 自身的审查留痕 | 由该 PR 内的 `handoffs/2026-10-14-review.md` **§11** 补记（此前在文件层**零留痕**，违反 §5 与 DoD N1 —— 属该 PR 首轮阻断项 B1 同类） |
| **回写 PR 自身的合并标识** | **无文件载体** —— 临时由 §11.5 的「**终端豁免声明**」覆盖；**其制度化仍待本项裁决** |

**实测（第 2、3 次触发 —— 2026-10-15，TASK-033）：**

| 环节 | 实测结果 |
|------|---------|
| 第 2 次：**主体交付请求** [PR #4](https://github.com/huyanluanyuqaq/shadcn-admin/pull/4) 合并 | `merged_at` = `2026-10-14T16:50:01Z`（UTC；本地为 10-15）；**rebase-merge**；`merge_commit_sha` = `0ea1916`（**与合并后 `main` HEAD 一致**）；5 提交 / 9 文件 / +685−82；CI `38601191105`（`pull_request`）与 `38601429795`（合并后 `main`）全绿 |
| 第 2 次 · `docker.yml` | **未触发** —— **第三次独立复现** |
| 第 3 次：**归档回写** [PR #5](https://github.com/huyanluanyuqaq/shadcn-admin/pull/5) 合并 | `merged_at` = `2026-10-14T17:07:09Z`；**rebase-merge**；`merge_commit_sha` = `94c5880`；CI `38603915159` 全绿；**1 轮独立审查**（结论「可合并」，无阻断项，4 项观察） |
| 第 3 次 · `docker.yml` | **未触发** —— **第四次独立复现** |
| 第 3 次 · 回写 PR 自身的合并标识 | 仍以**终端豁免声明**处置（`handoffs/2026-10-15-archive-review.md` §5）—— **本次裁决 C 之后，此类「回写专用请求」不再产生** |

> **代价的实测修正：** 选项 A 的实际成本高于草拟时的估计 ——
> 不止「多一次 PR 与 CI」，而是**多一整套串行审查**（本任务实测：**6 轮复审、7 次 CI、10 项阻断项**）。
> 因为回写 PR 同样受 §5/§9 的审查要求约束，而其内容是文档，需逐处核对一致性。
> 若每个任务都按此走，**每任务的审查成本约翻倍**，这是 D13 裁决必须计入的量。

**当时的候选选项（存档 —— 2026-10-15 已裁决为 C）：**

| 选项 | 内容 | 代价 |
|------|------|------|
| **A** | 记录分支 + 交付请求（TASK-031 做法） | 每任务多一次 PR **与一整套串行审查**（实测：5 轮复审 / 7 次 CI，见上表）；与 §2 张力 |
| **B** | 为「归档回写」开一条**直推豁免**（仅限 `tasks/**` 且不触代码） | ~~引入一个需要被守住边界的例外~~ → **2026-10-14 实测后此选项已实质失效**：经典分支保护**无按路径豁免**能力；开豁免只能靠**关闭 `enforce_admins`**，而那会使**所有**规则对管理员失效 = **直接违反 D3（真门禁）**。详见下表后的说明 |
| **C** | 回写并入**下一个任务**的交付请求 | 任务状态在此期间与目录不一致（TASK.md 必须诚实标注） |
| **D** | 承认**终端豁免**：**最后一个**交付请求的合并标识只存在于平台（不回写文件） | 文件层与平台层**永不闭合**；追溯该标识须查平台；但**回归在此终止**（唯一能终止回归的选项） |

> **★ 2026-10-14 新事实（分支保护启用并实测后）：选项 B 已实质失效。**
> ① 经典分支保护**不支持按路径豁免**；要为 `tasks/**` 开直推豁免，只能**关闭 `enforce_admins`** ——
> 而那会让**所有**规则对管理员失效，**直接违反 D3（真门禁）** ⇒ **B 与 D3 不可兼得**
> （除非改用 rulesets 的 bypass 机制：本次未采用，且 bypass 只能按人/角色、**不能按路径**）。
> ② 直推 `main` 已被平台以 `GH006 … Changes must be made through a pull request` **拒绝**（已实测），
> 故 §6 要求的「合并后回写」**在技术上只剩「走交付请求」一条路**。
> ⇒ **D13 的选择空间收敛为「A 或 C」**（B 与 D3 不可兼得；D 是终止规则、非路线）。
> **2026-10-15 已裁决为 C**（回归终止于深度 1），见本节开头的「**裁决结果**」。
>
> **D 与 A/B/C 不是同一维度的选项：** A/B/C 决定「回写走哪条路」，D 决定「**回归在哪终止**」。
> 任何 A/B/C 都必须附带一个终止规则（否则无限回归）。D 即最小终止规则；
> 备选终止规则还有「用 tag/release 承载终端标识」。
> ~~**建议的裁决形式是「A + D」的组合**，但这需要用户明确授权 D，因为 D 意味着**接受文件层与平台层的永久落差**~~
> —— **⚠️ 此为「裁决前」的分析。2026-10-15 的裁决已作废该建议：** 用户选定 **C**，
> 而 **C 自带终止规则（深度 1）** ⇒ **D 在 C 下不再需要**，也**不产生**「文件层与平台层的永久落差」。
> （原文保留，以便追溯「**建议 vs 裁决**」的偏差。）

> **无论选哪个，都需同时决定：** 分支保护启用后，若回写必须走交付请求，
> 则该交付请求**没有对应的任务分支**，是否需要 `TASK.md` 之外的任务记录？
> 以及 **V4 实测**（必需检查是否真的阻止合并）应在此之前还是之后做 —— 它会改变 A 选项成本。
>
> **本次实测对上述两个问题的补充：** ① 该交付请求**已实际使用了一条无对应任务分支的记录分支**
> （`chore/TASK-031-archive-record`），且**未新增** `TASK.md` 之外的任务记录 —— 其留痕放在被回写任务的
> `handoffs/` 内（§11）；② 本任务**未启用分支保护**，故「回写 PR 无任务分支」这一形态**尚未经受门禁检验**，
> V4 仍待阶段 3 实测。

---

## 18. 附录：实测证据清单

> 以下命令均已实际执行，输出为原文摘要。**未执行任何写操作。**
>
> **执行时点：阶段 1 设计期（2026-10-13 ~ 2026-10-14 上午）。**
> ⚠️ 其中第 **2、3、4、6、7** 条涉及**可变事实**，**已因阶段 2 与阶段 3 的实施而漂移** ——
> **当前值见 §18.1**。引用本节任何数值前须先读 §18.1，否则会得出与仓库现实不符的结论。

```bash
# 1. 工作空间根非 Git 仓库
$ git rev-parse --show-toplevel
fatal: not a git repository (or any of the parent directories): .git

# 2. Git 身份（SSH）与 gh 身份（Token）不是同一账号
$ ssh -T git@github.com
Hi huyanluanyuqaq! You've successfully authenticated, but GitHub does not provide shell access.
$ gh auth status
github.com
  ✓ Logged in to github.com account ndldsn (keyring)
  - Git operations protocol: https
  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'

# 3. shadcn-admin 仓库属性：Issues 关闭
$ gh api repos/huyanluanyuqaq/shadcn-admin \
  --jq '{has_issues,has_projects,has_wiki,private,permissions}'
{"has_issues":false,"has_projects":true,"has_wiki":false,"private":false,
 "permissions":{"admin":false,"maintain":false,"pull":true,"push":false,"triage":false}}

# 4. 无分支保护、无 ruleset
$ gh api repos/huyanluanyuqaq/shadcn-admin/branches/main/protection
{"message":"Not Found",...,"status":"404"}
$ gh api repos/huyanluanyuqaq/shadcn-admin/rulesets
[]

# 5. business-manager 对当前 gh 凭据不可达（私有）
$ gh api repos/huyanluanyuqaq/business-manager
{"message":"Not Found",...,"status":"404"}
$ git ls-remote --heads git@github.com:huyanluanyuqaq/business-manager.git
29774f7...  refs/heads/main

# 6. 已合并分支残留远端
$ git ls-remote --heads origin     # 于 projects/shadcn-admin
... refs/heads/feat/TASK-028-notification-customer-name
... refs/heads/feat/TASK-029-customer-row-expand-panel
... refs/heads/feat/TASK-030-subscription-row-expand-panel

# 7. CI 运行全绿（可作为必需检查候选）
$ gh run list -R huyanluanyuqaq/shadcn-admin --limit 5
completed success  Continuous Integration           main push  38412560652  2m3s
completed success  Build and Push Docker Image      main push  38412561363  40s
```

### 18.1 复测：已漂移项（2026-10-14，阶段 2 收口后）

> **复测动机：** §18 第 2、3 条涉及**可变事实**（凭据身份、仓库设置），而阶段 2 期间这两类事实
> **都实际发生了变化**。按「能力记录类事实**引用前必须重测**」的教训
> （见 `templates/github/GITHUB-CAPABILITY.md` §8、`projects/shadcn-admin/docs/operations/github-capability.md` §8），
> 此处补记复测结果。**本节为当前权威值**；§18 对应条目应视为**历史时点记录**。

| 条目 | §18 阶段 1 记录值 | **2026-10-14 复测值** | 结论 |
|------|-----------------|---------------------|------|
| 2 · `gh` 身份 | `ndldsn`（只读） | **`huyanluanyuqaq`**（`Active account: true`；`ndldsn` **仍登录但非活动**） | **已漂移**（阶段 2 内变更） |
| 2 · `gh` token scopes | `gist, read:org, repo, workflow` | **`gist, read:org, repo`**（**缺 `workflow`**） | **已漂移** —— 重新认证时未勾 `workflow`；影响：无法 `gh workflow run` / 重跑作业 |
| 2 · git 协议 | `https` | **`ssh`** | **已漂移** |
| 3 · `has_issues` | `false` | **`true`** | **已漂移**。同批 `has_projects`(`true`) / `has_wiki`(`false`) **未变** ⇒ 属**设置被改动**，非当初读错 |
| 3 · `permissions` | 全 `false`（仅 `pull:true`） | **`admin` / `maintain` / `push` / `triage` / `pull` 全 `true`** | **已漂移** |
| 3 · `private` | `false` | `false` | 未变 |
| 4 · `branches/main/protection` | 404 | **200 —— 已配置经典分支保护**（阶段 3，2026-10-14；逐字段见能力记录 §2） | **已漂移（由阶段 3 施加，属有意改动）** |
| 4 · `rulesets` | `[]` | **仍 `[]`** | 未变 |
| 6 · 远端分支 | 3 个历史 `feat/TASK-02x` | **1 个（仅 `main`）** —— 2026-10-15 经授权清理了 **7** 条已并入 `main` 的分支（**时点快照：2026-10-15 D12 执行时**；此后每个新任务的交付分支会暂时增加、合并并删分支后恢复 —— 非永久断言，引用前以 `git ls-remote --heads origin` 重测） | **先增后清**：TASK-031 / TASK-033 各增两条，**D12** 于 2026-10-15 执行清理（执行前逐条核验） |
| 7 · `main` CI | 含 `Build and Push Docker Image` | **不含该运行**（`docker.yml` 已改 tag-only，即 D8） | **已漂移**（属预期内的行为变更） |

> **与本次 D13 实测的交叉印证：** 第 7 条的漂移正是 §17.3「实测」表中
> 「`docker.yml` 未触发」的对照依据 —— 合并前的 `05bf884` / `492e159` **仍带**该运行，
> 合并后的 `da93f4b` / `e3231e7` / `0ea1916` / `94c5880` / `b31792e` / `2be342e` / `f212b7c` / `6ee2777` **不带**，构成解耦的**八次独立复现**（**时点：2026-10-15；此后每次合并可能 +1**，非永久断言，引用前以 `gh api repos/huyanluanyuqaq/shadcn-admin/actions/runs` 查该 head 是否只有 CI 运行）。
>
> **已处置：** 第 3 条的 `has_issues` 漂移曾使 4 处「Issues 已关闭」成为**假陈述**，
> 已在 `projects/shadcn-admin` 内改正，并建立漂移记录区（capability §8）+ 回灌模板。
> 第 2 条的 `workflow` scope 缺失已登记为待办（capability §7）。
