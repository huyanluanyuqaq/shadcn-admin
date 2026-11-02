# 协作体系审计报告（2026-11-02）

> **本文件是事实记录，不是规则。** 它记录一次**时点性**审计的范围、方法与结论。
> 与 `AGENTS.md`、`.agents/**`、`docs/agent-collaboration.md` 的规则冲突时，**规则以那些文件为准**；
> 但本文件中标注「实测」的事实若与文档自述冲突，**以本文件的复现命令输出为准**，并应据此修正文档。
>
> **执行载体：** TASK-056。**审计时点：** 2026-11-02 10:50–11:00（UTC+8）。
> **基线提交：** `2ca5d50`（`main`）。**时点后发生的变化**均在文中显式标注，不与审计时点混淆。

---

## 1. 为什么要做这次审计

用户于 2026-11-02 要求「审查并升级多 Agent + GitHub 协作机制」，并给出一套 13 阶段的目标方案。
该方案假定项目内可能只有雏形文档。**实际情况相反**：本仓库自 TASK-031 起已建成三层协作框架，
承载 55 个任务、平台门禁经实测生效。因此本次审计的首要任务是**判定「哪些已成立、哪些是伪缺陷」**，
避免以「补齐文档完整性」为名重建一套并行制度。

**审计的核心命题只有一个：文档所述的协作制度，与其实际执行、与代码/平台的真实状态，是否一致。**

---

## 2. 审计范围与方法

### 2.1 覆盖对象

| 类别 | 对象 |
|------|------|
| 入口与项目规则 | `AGENTS.md`（457 行）、`README.md`、`docs/operations/agent-constraints.md` |
| 协作流程 | `docs/agent-collaboration.md`、`docs/git-workflow.md` |
| 框架规范（随仓库版本化） | `.agents/roles/**`（8 角色）、`.agents/protocols/**`（11 份）、`.agents/rules/**`、`.agents/workflows/**` |
| 模板 | `templates/task|handoff|adr|github|project/**` |
| 平台配置 | `.github/workflows/{ci,docker,stale}.yml`、`PULL_REQUEST_TEMPLATE.md`、`ISSUE_TEMPLATE/**`、`dependabot.yml` |
| 门禁脚本 | `scripts/audit-repo.py`（F1–F9）、`shared/scripts/audit_framework.py`（A1–A13） |
| 任务台账 | `tasks/{backlog,active,review,done}/**`（55 个任务目录） |
| 决策记录 | `docs/decisions/ADR-001~005` |
| 平台事实 | 分支保护、必需检查、仓库开关、远端分支、PR 与运行记录（`gh api` 实测） |

### 2.2 方法

三条互相独立的判据链，**任何结论至少要有其中两条支持**：

1. **文本对照** —— 同一事实在不同文档中的表述是否一致；
2. **实现对照** —— 文档所述是否与工作流文件/脚本/配置的真实行为一致；
3. **平台实测** —— 涉及平台的断言，用 `gh api` / `gh run list` 重新取值，不引用文档自述。

**一条在本次审计中反复生效的判据纪律：** 判据脚本必须写成文件再执行。
Bash heredoc 会吞掉正则反斜杠（`\S` / `\d`），本次因此产生过一次假结论
（误报「55 份档案全部无 `Status:`」，实测为 2 份）。**凡结论异常整齐，先怀疑判据。**

---

## 3. 现状架构

### 3.1 三层载体（本体系的核心设计）

```
层 1 文件层（唯一事实来源，随仓库版本化，离线可用）
    tasks/<state>/<task-id>/TASK.md      状态 / 范围 / 验收标准 / 已知问题
    tasks/<state>/<task-id>/handoffs/**  交接、审查、整改记录（含命令原始输出）
    docs/**                              架构、规范、运维、决策
    AGENTS.md                            项目规则入口
        │ 单向投影（文件 → 平台）
        ▼
层 2 平台层（协作与门禁，需权限，不承载不可再生信息）
    工作分支 / 提交 / 交付请求 / Actions / 默认分支
        │ 人类授权
        ▼
层 3 授权层（不可自动化，受保护）
    高风险操作批准、发布授权、规则与权限变更批准
```

四条层间规则：平台不是状态源；PR 不产生新信息；层 1 缺失即阻断 PR；Actions 与 Agent 均不得自行批准层 3。

### 3.2 协作位与角色

- **两个协作位**：主控位（Coordinator，协调 + 验收责任）与执行位（Implementer，实施 + 自证）。
- **8 个角色**：Product / Architect / Researcher / Reviewer（归主控位）；Developer / Tester / Security / DevOps（归执行位）。
- 角色与协作位均**不绑定任何 Agent 产品、模型或供应商**；一个实例可跨任务更换协作位，但同一任务内不得同时占两位（I1），且实现者不得批准自己的交付（I2，受保护）。

### 3.3 任务状态机与物理布局

逻辑状态 10 个（BACKLOG / READY / ACTIVE / DESIGN / BLOCKED / CHANGES_REQUESTED / TEST_FAILED / REQUIREMENT_CHANGED / REVIEW / DONE），
物理目录仅 4 个（`backlog/ → active/ → review/ → done/`）。目录表达粗粒度阶段，`TASK.md` 的 `Status` 表达细粒度状态。

### 3.4 端到端流程

10 阶段：执行前检查 → 需求登记 → 方案与分配 → 认领与再检查 → 分支隔离 → 实施与提交 → 交付请求 → 机器验证 → 主控审查 → 合并与归档。
分支命名 `<type>/TASK-<NNN>-<slug>`；合并策略 **rebase-merge**；合并后回写 `Merge Record`。

**D13-C（回写路径裁决）：** 合并后回写**并入下一个任务的交付请求**，不单独开「回写专用 PR」，
以保证 §4（禁直推默认分支）与 §6（合并后回写）之间的无限回归终止于深度 1。

### 3.5 门禁现状（2026-11-02 实测）

`gh api repos/huyanluanyuqaq/shadcn-admin/branches/main/protection` 返回 200，关键字段：

| 字段 | 实测值 |
|------|--------|
| `required_status_checks.contexts` | `["audit", "install-lint-build"]` |
| `required_status_checks.strict` | `false` |
| `required_pull_request_reviews.required_approving_review_count` | `0` |
| `enforce_admins.enabled` | `true` |
| `allow_force_pushes` / `allow_deletions` | `false` / `false` |
| `required_linear_history` / `required_conversation_resolution` | `false` / `false` |

### 3.6 门禁脚本现状

- `scripts/audit-repo.py`（F1–F9）：**PASS=9 FAIL=0 WARN=0**。覆盖 PR 模板字段、工作流 `on`/`permissions`、占位符、明文密钥、框架文档存在与引用、必需检查名一致、框架资产在位、`Merge Record` 章节与位置、任务编号唯一性。
- `shared/scripts/audit_framework.py`（A1–A13）：审计时点 **PASS=12 FAIL=0 SKIP=1**。A3（YAML 可解析）因本机缺 PyYAML 跳过。
  **补测（TASK-056 执行期间）：** 安装 PyYAML 6.0.3 后实跑 → **PASS=13 FAIL=0 SKIP=0**，A3 通过，与 CI 结论一致。

---

## 4. 已有设计的优点（明确保留，不重建）

| # | 设计 | 保留理由 |
|---|------|---------|
| 1 | **层 1 文件为唯一事实来源，平台仅为投影** | 独立 clone 后状态仍完整；不产生双写与对账成本；平台记录不承载不可再生信息 |
| 2 | **角色与 Agent/模型/供应商解耦** | 换实例、换模型不改变制度；直接满足「可复制到其他项目」的要求 |
| 3 | **双协作位 + I2（实现者≠批准者）** | 在单平台身份下仍能通过换会话达成视角独立，且限制作了**如实披露**而非假装平台强制 |
| 4 | **平台能力记录 + 落差披露表** | 「制度 ≠ 平台强制」被逐行量化，是本体系最难得的诚实性设计 |
| 5 | **rebase-merge + D13-C 回写深度 1** | 在「禁直推」与「合并后回写」的死结上给出了可终止的解法 |
| 6 | **Handoff 强制落盘 + 审查记录命名分区** | Agent 中断可恢复；审查独立性的两级定义（框架基线 / AC 加严）避免了概念混用 |
| 7 | **两套审计脚本进 CI** | 文档一致性由机器守护，而非依赖记忆；F8/F9 的门禁背后有明确的豁免白名单与理由 |
| 8 | **变更安全分级（change-safety）** | 高风险操作（部署、迁移、历史改写）统一走人类授权，不散落在各处 |

> **判断：** 上述 8 项均属「已建成且优于通行做法」，任何重建都会净损失。**本次整改不触碰它们。**

---

## 5. 发现的问题

> 等级定义：**P0** 严重（安全/数据/门禁失效）；**P1** 重要（制度失真、规则不可执行）；**P2** 一般（可验证性缺口）；**P3** 优化建议。
> 「证据」列均为本次实测；「处置」列指明由本任务（TASK-056）修正，还是仅登记。

| 编号 | 等级 | 问题 | 证据（实测） | 处置 |
|------|------|------|--------------|------|
| **F-1** | **P1** | **Docker 触发口径自相矛盾**：4 份文档称「`docker.yml` 仅由版本 tag 触发 / 普通合并不会发布镜像」，与工作流实现相反 | `docker.yml` 的 `on.push` 同时含 `branches: ["main"]` 与 `tags: ["v*"]`；运行记录 `41376188853`（event=`push`, branch=`main`, 作业 `Build and Push Docker Image`, success）。唯一正确表述在 `docs/operations/docker-release.md` §1 | **本任务修正 4 处**（`AGENTS.md` §14.3、`docs/git-workflow.md` §4、`docs/agent-collaboration.md` §6、`github-capability.md` §5） |
| **F-2** | **P1** | **Issue 通道名义启用、实际不可用**：`has_issues=true`，但界面无法新建 Issue，历史 0 条 | `.github/ISSUE_TEMPLATE/config.yml` 设 `blank_issues_enabled: false`，唯 `contact_links` 指向 `satnaing/shadcn-admin/discussions`（上游）；两个模板（feature/bug）均为上游 stub；`gh issue list --state all` 返回空 | **本任务关闭 Issues**（用户裁决），文档改为事实陈述 |
| **F-3** | **P1** | **审查记录断档**：TASK-042~046 五份任务无任何独立审查记录 | `ls tasks/done/TASK-04{2..6}*/handoffs \| grep -c review` = 0；TASK-047 起恢复（047:2、049:4、050:4、051:4、052:3、054:2） | **仅登记**：既成事实，不回填、不追述；后续任务的 AC 必须显式要求审查记录文件名 |
| **F-4** | **P2** | **两条核心协议均无机器校验，且均已退化**：<br>4a. commit footer `Refs: TASK-NNN` 规则为「必须」，实测合规 240/323（74.3%），最近 5 个提交 4 个缺失<br>4b. D13-C「回写至多延后一个任务」无判据，TASK-051 的欠账**已连续滚过三轮** | 4a：`git log` 全量统计（脚本见 §8）；缺例：`b9f9879`/`20d5d4c`/`8ba2c09`/`53e756c`<br>4b：TASK-055 的 `Background` 自述「TASK-051 的欠账已滚过三轮」 | **本任务新增 `traceability` 检查**（只对 `origin/main..HEAD` 生效，不追溯历史）；4b 登记为残余限制 |
| **F-5** | **P2** | 分支清理无自动化：制度要求「合并后删除工作分支」，平台开关为关闭 | `delete_branch_on_merge` 审计时 = `false`（远端当前仅 1 个分支，实际卫生良好） | **本任务开启平台开关并实测** |
| **F-6** | **P2** | 无效率度量定义：Lead Time / Cycle Time / Review Time / 返工率 / CI 失败率 / 阻塞时长均无口径 | 全仓检索无定义；任务档案已含 `Created`/`Updated`/`Merge Record` 时间戳，具备离线计算条件 | **本任务新增 `collaboration-metrics.md`**（仅定义 + 采集命令） |
| **F-7** | **P2** | 无体系级场景验证留档：既有验证都是「单任务 AC 核对」，从未做过跨角色、跨中断的演练 | 全仓无场景验证记录 | **本任务新增 `collaboration-scenarios.md`**（A~G + 逐条判据 + 本次结论） |
| **F-8** | **P3** | 档案 Meta 语法漂移：2 份历史档案用表格而非 yaml 块，无可解析的 `Status:` 行，F8/F9 不覆盖 Meta 结构 | `python3` 解析 55 份：2 份返回 `NONE`（`TASK-033-stage3-platform-record`、`TASK-035-d13-route-c`） | **本任务仅修语法**（不改任何事实） |
| **F-9** | **P3** | 入口文件偏大：`AGENTS.md` 457 行 / 23.5KB，技术栈与命令类内容约占六成，与「入口指向而非承载」有张力 | `wc -l AGENTS.md` = 457 | **不处置**，单独立项（缩减 §3/§5–§8 会同时触及所有引用锚点，回归面大于收益） |
| **F-10** | **P3** | 未采纳项的评估理由无集中记录：CODEOWNERS 仅有一句说明；Merge Queue、Required Conversation Resolution、`strict` 的选择理由散落 | `AGENTS.md` §14.5 仅一句「不设 CODEOWNERS」；能力记录 §2 有两项偏离说明，但无 Merge Queue | **本任务在能力记录补「刻意不采用清单」** |
| **F-11** | **P3** | 审计脚本存在结构性盲区：F2 只校验工作流「是否声明 `on` / `permissions`」，A5 只校验模板触发与权限，**均不校验触发语义**，因此 F-1 这类失真长期未被拦截 | `audit-repo.py` F2 实现（第 205–226 行） | **登记**：修复需引入 YAML 解析，与本任务「不新增依赖」冲突；改为用「负向断言复核清单」+ 本报告的人工判据兜底 |

### 5.1 关于 F-1 的根因（本报告最重要的一条教训）

`docs/agent-collaboration.md` §6 与 `docs/operations/github-capability.md` §5 是**两份必须逐行一致的落差表**，
制度里专门写了「修改其一必须同步修改另一处」。本次审计发现：**这两处确实一致 —— 一致地错。**

> **结论：一致性机制保证的是「文本彼此相同」，不是「文本与事实相同」。**
> 任何「两处必须同步」的约束，都不能替代「至少一处必须与实现对照」。
> 后续修改此类成对文档时，判据必须是**实现文件**，不能是另一份文档。

### 5.2 风险等级判定说明

本仓库无 P0：数据与门禁层面未被削弱 —— 禁止直推（`GH006` 实测）、红灯不可合并（HTTP 405 实测）、
`enforce_admins=true` 均有效。F-1/F-2/F-3 之所以定为 P1，是因为它们**直接损伤制度的可信度**：
一旦「文档说的」与「实际做的」可以长期并存，后续所有基于文档的判断都会失效。

---

## 6. 新旧机制对比

| # | 原有做法 | 存在问题 | 改进方式 | 改进收益 |
|---|---------|---------|---------|---------|
| 1 | 4 份文档称 `docker.yml` 为 tag-only | 与实现相反；「合并/发布解耦」的**保证来源判断错误**（真正拦截 `latest` 的是 metadata `enable` 门禁，不是触发器） | 4 处改为「合并即构建 `sha-*`，`latest` 仅 tag 前进」；保证来源改写为 `enable=${{ github.ref_type == 'tag' }}` | 制度重新可用于判断「合并是否会对外发布」；`docker-release.md` 与其余文档不再对立 |
| 2 | Issues 开启但模板指向上游、无法建单 | 文档称「Issues 已启用，可作只读索引」，实际不可用；是典型的「名义有、实际无」 | 关闭 Issues；能力记录 §1 与 §8 记录实测；`agent-collaboration.md` 的 Issue 段落改为事实陈述 | 消除一个长期误导点；D2 的理由回到「避免双写」，不再依赖「Issues 不可用」这一已被证伪的前提 |
| 3 | `Refs: TASK-NNN` 仅靠约定 | 合规率 74%，近 5 提交 4 缺 | 新增 `scripts/check-traceability.py` + CI 作业（仅 PR，只查 `origin/main..HEAD`） | 「每份交付可追溯」由自觉变为可执行判据；且不追溯历史，不制造大规模返工 |
| 4 | 合并后删分支靠人工 | 平台开关关闭，制度无法自证执行 | 开启 `delete_branch_on_merge` 并实测 | 删除动作从「记得做」变为「不可能忘」 |
| 5 | 无度量口径 | 无法回答「协作是否在变慢」 | 7 项指标定义 + `gh` 采集命令；明确不建数据平台 | 瓶颈可被定位；零额外依赖 |
| 6 | 无场景演练 | 「体系可用」从未被跨角色验证 | A~G 七场景 + 逐条判据 + 结论分级（已验证 / 纸面满足） | 「可用」从断言变为可复核结论；并暴露真正未演练的部分 |
| 7 | 档案 Meta 结构不统一 | 2/55 无法被脚本解析，属静默腐坏 | 统一为 yaml 块 | 未来对 Meta 的机器校验成为可能 |
| 8 | 未采纳项理由分散 | 后人无法判断「是没做，还是决定不做」 | 能力记录补「刻意不采用清单」 | 防止把「决策」误读为「欠账」，也防止后人反复提议 |

---

## 7. 目标架构（本次整改后）

**不变的（占绝大多数）：** 三层载体、双协作位、8 角色、10 状态机、10 阶段流程、rebase-merge、D13-C、Handoff 协议、权限模型、双审计脚本。

**变化的（仅 4 处）：**

1. **制度文本与实现对齐**：`docker.yml` 触发口径、Issue 通道状态；
2. **新增一条可执行判据**：`traceability`（PR 内提交必须可追溯至已存在的任务）；
3. **新增两份事实类文档**：度量口径、场景验证；
4. **平台开关补齐**：关闭 Issues、自动删分支。

**新增文档一律落在 `docs/operations/`，不新建 `docs/collaboration/` 目录。** 理由：仓库已存在
`docs/agent-collaboration.md`、`docs/git-workflow.md`、`.agents/protocols/**` 三处协作规范，
再建平行目录会产生第 4 个维护点，与「单一事实来源」直接冲突。

---

## 8. 复现命令（附录）

```bash
# 平台事实
gh api repos/huyanluanyuqaq/shadcn-admin \
  --jq '{has_issues,delete_branch_on_merge,has_projects,default_branch}'
gh api repos/huyanluanyuqaq/shadcn-admin/branches/main/protection

# Docker 触发（文档断言 vs 实现）
grep -n "branches:\|tags:" .github/workflows/docker.yml
gh run list --workflow=docker.yml --limit 5

# 门禁脚本
python3 scripts/audit-repo.py
python3 shared/scripts/audit_framework.py

# 任务状态与目录一致性（需写成文件执行，勿用 heredoc 传正则）
python3 - <<'PY'
import re, pathlib
for d in ['backlog','active','review','done']:
    for p in pathlib.Path('tasks', d).glob('TASK-0*/TASK.md'):
        t = p.read_text(encoding='utf-8')
        m = re.search(r'^Status:[ \t]*([A-Z_]+)', t, re.M)
        if not m: print('NO STATUS:', p)
PY

# commit footer 合规率
git log --format='%H%x1f%s%x1f%b%x1e' | python3 -c "
import sys,re
recs=[r for r in sys.stdin.read().split('\x1e') if r.strip()]
n=len(recs); ok=sum(1 for r in recs if re.search(r'Refs:\s*TASK-\d+', r))
print(f'{ok}/{n} 合规')"
```

---

## 9. 残余限制（不因本报告而消失）

| # | 限制 | 性质 |
|---|------|------|
| R1 | **I2（实现者 ≠ 批准者）无平台强制**：单一平台身份 + 必需批准数 0，平台不提供第二人批准 | 已如实披露；靠换会话 + `Known Issues` 披露 |
| R2 | **合并策略 rebase-merge 无平台强制**：`required_linear_history=false`，平台不阻止 merge commit | 刻意保留（避免锁死 merge commit 的合法场景） |
| R3 | **F-11 的脚本盲区未修**：审计仍不校验工作流触发语义 | 需引入 YAML 解析或另建检查，已登记 |
| R4 | **F-4b（D13-C 回写欠账）无判据**：仍可出现「回写滚过三轮」 | 需一条「`tasks/review/` 中 `Status=REVIEW` 存续超过 1 个任务即告警」的检查，未在本任务实现 |
| R5 | **TASK-042~046 审查断档**：历史既成事实 | 不回填、不追述 |
| R6 | `audit_framework.py` 的 A3 需要 PyYAML，无该依赖的环境会 SKIP | 已在 TASK-056 补测（安装 PyYAML 6.0.3 后 A3 PASS）；但**新环境默认仍会 SKIP**，判据须显式声明是否跑过 A3 |
