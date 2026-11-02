# TASK-056 — 协作体系整改：3 处失真修正 + 3 处缺口补齐

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-056
Title: 协作体系整改（P1 失真 + P2 缺口）
Workflow: maintenance
Status: REVIEW
Priority: P1
Owner: Codex（执行位 · developer）
Owner Since: 2026-11-02T11:05:00+08:00
Assigned Role: developer
Created: 2026-11-02T11:05:00+08:00
Updated: 2026-11-02T11:15:00+08:00
Branch: docs/TASK-056-collaboration-upgrade
Requires Human Approval: true
```

---

## Objective

在不重建现有框架的前提下，修正协作制度中**已实测证伪的 3 处失真**、补齐**3 处可验证缺口**，
使「制度描述」与「代码事实」「平台事实」重新一致，并让「每份交付可追溯」由自觉变为门禁。

---

## Background

用户于 2026-11-02 要求「审查并升级多 Agent + GitHub 协作机制」。第一阶段审计（同日完成，
结论落盘于 `docs/operations/collaboration-audit.md`）确认：现有体系已承载 55 个任务、
平台门禁实测生效，13 个目标阶段中约 8 个已实质满足，**不应重建**。真正的缺陷集中在
「文档与实现不一致」与「规则无门禁」两类。

审计期实测到的关键事实（复现命令见审计报告 §2）：

- `docker.yml` 实为 `push: branches:[main]` 触发（run `41376188853` 实证），
  而 4 份文档称「仅由版本 tag 触发、普通合并不会发布镜像」；
- `has_issues=true`，但 `.github/ISSUE_TEMPLATE/` 是上游 stub、`blank_issues_enabled:false`，
  界面无法新建 Issue，历史 0 条；
- commit footer `Refs: TASK-NNN` 规则虽为「必须」，实测合规率 **240/323**，
  且最近 5 个提交中 4 个缺失 —— 无门禁的规则已自然退化。

**用户裁决（2026-11-02）：** ① 关闭 Issues；② 新增 traceability 检查并设为必需；
③ 范围取「P1 失真 + P2 缺口全做」；④ 与 TASK-055 隔离，不得污染其工作树。

---

## Scope

| 组 | 内容 | 产物 |
|----|------|------|
| **A（审计留痕）** | 审计报告入库：现状、10 项发现（P1×3 / P2×4 / P3×3）、保留项、新旧对比、验证与限制 | `docs/operations/collaboration-audit.md` |
| **B（失真修正）** | Docker 触发口径 4 处；Issue 通道状态；落差表「保证来源」重写 | `AGENTS.md`、`docs/git-workflow.md`、`docs/agent-collaboration.md`、`docs/operations/github-capability.md`、`docs/operations/negative-assertion-review.md` |
| **C（门禁补齐）** | 新增可追溯性检查脚本 + CI 作业（仅 `pull_request`） | `scripts/check-traceability.py`、`.github/workflows/ci.yml` |
| **D（度量与演练）** | 效率度量定义（7 项，附可实跑采集命令）+ A~G 场景验证清单与本次结论 | `docs/operations/collaboration-metrics.md`、`docs/operations/collaboration-scenarios.md` |
| **E（卫生项）** | 平台侧关闭 Issues 与开启自动删分支并实测；TASK-033/035 的 Meta 语法修正 | 平台设置、2 份历史档案 |

## Non-Scope

- **不改 `src/`、`server/`、`shared/` 任何代码**。本任务零代码变更（脚本除外，且脚本不入业务路径）。
- **不迁移到 Issue 驱动**。保留 D2（`TASK.md` 为唯一事实来源），关闭 Issues 是消除失真而非改变载体。
- **不启用 CODEOWNERS / Merge Queue / 会话解决**。理由写入能力记录，不制造「看起来更严」的假门禁。
- **不给 `AGENTS.md` 瘦身**。该文件 457 行属独立问题（审计 F-9），单独立项，本任务不动结构。
- **不回填 TASK-042~046 的审查断档**。既成事实只登记，不追述、不伪造。
- **不在本任务内把 `traceability` 设为必需检查**。作业必须先存在于 `main`，否则所有 PR 永久待处理 —— 见 Implementation Plan 第 6 步。

---

## Requirements

1. 4 份文档中关于 `docker.yml` 触发条件的表述必须与工作流文件逐字对得上；不得出现「仅由 tag 触发」。
2. 关闭 Issues 后，所有「Issues 已启用 / 至多作为只读索引」的表述必须改为事实陈述，且不得再引用「Issues 不可用」作为 D2 的理由（D2 理由为「避免双写 + 独立 clone 后状态完整」）。
3. 可追溯性检查必须：只查 `origin/main..HEAD`（不追溯历史 83 个缺 `Refs` 的提交）、校验 `Refs: TASK-NNN` 存在性、校验被引用的 Task ID 在 `tasks/**` 真实存在、失败时打印违规提交与原因。
4. 检查脚本必须能被反向验证（故意构造缺 `Refs` 的提交，确认变红），不得只验证「通过」路径。
5. 度量文档只定义指标与采集命令，不引入任何外部平台或依赖。
6. 场景文档的每条判据都必须是可复核命令或可指认文件，不得写「应建立健全机制」这类不可判定语。
7. 平台侧改动必须实测并把实测值写入能力记录；**不得把计划写成已配置**。

---

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 脚本仅用 Python 标准库 + git；CI 不新增第三方依赖，不新增 secret |
| 兼容 | 不改任何运行时行为；`docker.yml` 一行不动 |
| 安全 | 不写入任何凭据；不以 `--no-verify` 提交 |
| 流程 | 每提交一个关注点；每提交 footer 含 `Refs: TASK-056`（本任务自己必须先满足它要立的规矩） |
| 环境 | 在 `E:/AiData/worktrees/shadcn-admin-TASK-056` 内作业，**不得**改动 `projects/shadcn-admin` 工作树 |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| TASK-055 | 并行（文件不重叠：它为 `server/**` + `tasks/{active,done}/**`，本任务为 `docs/**` + `AGENTS.md` + `.github/**` + `scripts/**`） | 已交付（PR #28 待合并） |
| 平台管理员权限 | external（关闭 Issues、改必需检查、开自动删分支） | 可用（账号 `admin:true` 实测） |

---

## Acceptance Criteria

- [x] AC-1: `grep -rn "仅由版本 tag\|tag-only" AGENTS.md docs/` —— 4 处原位已无该断言；剩余命中仅两处「历史沿革」说明（`AGENTS.md` §14.3）与审计报告/负向清单的**引用性**提及。`docker.yml` 的 `branches: ["main"]`（第 52 行）与 `tags: ["v*"]`（第 54 行）与文档表述逐条对应。
- [x] AC-2: `gh api ... --jq .has_issues` → `false`；`docs/operations/github-capability.md` §1 记录该实测值与日期（2026-11-02）。
- [x] AC-3: `python3 scripts/check-traceability.py --base origin/main` → `PASS —— 6 个提交均引用了真实存在的任务`，退出码 0。
- [x] AC-4: 反向验证两例均变红：① 引用 `TASK-999` → 退出码 1 并指名提交 `f93bcc71`；② 无 `Refs` footer → 退出码 1 并指名提交 `9801af63`。两例的临时提交均已用 `git reset --soft HEAD~1` 移除，`git log -1` 回到 `b3b21b5`，工作区 clean。
- [x] AC-5: `ci.yml` 的 `traceability` 作业存在，`if: github.event_name == 'pull_request'`；`audit-repo.py` F6 → `3 个必需检查名与工作流作业名一致`（PASS）。
- [x] AC-6: `AGENTS.md` §14.1 该行标「**否（TASK-056 已落地作业，尚未设为必需）**」并写明启用顺序；能力记录 §3 实测 `contexts` 仍为 `["audit","install-lint-build"]`，明确「当前不是门禁」。
- [x] AC-7: `collaboration-metrics.md` 含 7 项指标定义与采集命令；本轮实跑 M6 与 M4 的采集命令（`gh run list --workflow=ci.yml`、`git ls-remote --heads origin`），原始输出见 Handoff §4。
- [x] AC-8: `collaboration-scenarios.md` 覆盖 A~G，每场景含判据/承载文件/结论；结论分级为 5 已验证、1 纸面满足（并行）、1 部分验证（主分支前进，暴露 SHA 失效缺口）。
- [x] AC-9: `audit-repo.py` → `PASS=9 FAIL=0 WARN=0`；`audit_framework.py` → `PASS=13 FAIL=0 SKIP=0`（安装 PyYAML 6.0.3 后 A3 实跑）。
- [x] AC-10: `gh api .../branches/main/protection` → `approvals=0`、`enforce_admins=true`；`delete_branch_on_merge` 实测 `true` 并已记录于能力记录 §1/§8。
- [x] AC-11: 两份档案的 Meta 已改为 yaml 块，`^Status:` 可解析（全 55 份状态/目录一致性检查 `mismatch: 0`）；`git diff` 显示仅 Meta 段与就地说明变化，字段值逐字保留。

---

## File Scope

```yaml
File Scope:
  - AGENTS.md
  - docs/**
  - scripts/check-traceability.py
  - .github/workflows/ci.yml
  - tasks/active/TASK-056-*/** 
  - tasks/done/TASK-033-stage3-platform-record/TASK.md
  - tasks/done/TASK-035-d13-route-c/TASK.md
Non-Scope (files):
  - src/**
  - server/**
  - shared/**
  - .github/workflows/docker.yml
  - package.json
  - pnpm-lock.yaml
```

---

## Implementation Plan

1. 建 worktree（`E:/AiData/worktrees/shadcn-admin-TASK-056`，自 `origin/main` 派生），登记本任务。
2. 平台侧改动并实测：关闭 Issues、开启 `delete_branch_on_merge`；记录原始返回值。
3. 写审计报告 `collaboration-audit.md`（含 10 项发现的证据与复现命令）。
4. 修 4 处 Docker 触发口径 + 落差表「保证来源」；同步 `negative-assertion-review.md` 登记该断言。
5. 新增 `scripts/check-traceability.py` 与 CI 作业；正反两向验证。
6. 写度量与场景两份文档；实跑至少一条度量命令。
7. 修 TASK-033/035 Meta 语法（仅结构）。
8. 跑两套审计脚本，逐条对 AC，推分支、开交付请求。
9. **合并后**（非本任务交付内容）：由主控位把 `traceability` 加入必需检查，再回写本文档与本任务 Merge Record。

---

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1 | 文本实测 | `grep -rn "仅由版本 tag\|tag-only" AGENTS.md docs/ ；再读 docker.yml 的 on 段` |
| AC-2 / AC-10 | 平台实测 | `gh api repos/huyanluanyuqaq/shadcn-admin --jq '{has_issues,delete_branch_on_merge}'` |
| AC-3 / AC-4 | 正反两向 | `python3 scripts/check-traceability.py --base origin/main`；临时 `git commit --allow-empty -m "test"` 后复跑并观察退出码 |
| AC-5 | 静态审计 | `python3 scripts/audit-repo.py`（F6 校验作业名一致） |
| AC-7 | 命令实跑 | 文档中每条命令至少执行一次，粘原始输出到 Handoff |
| AC-9 | 双审计 | `python3 scripts/audit-repo.py`；`python3 shared/scripts/audit_framework.py` |
| AC-11 | 解析实测 | `python3 -c "re.search(r'^Status:', ...)"` 对两份档案 |

---

## Current State

**REVIEW（2026-11-02 11:15）。** 执行位已完成全部 11 条 AC 并自测通过；
交付请求 **PR #29** 已创建，三项检查全绿（`install-lint-build` 1m43s / `audit` 7s / `traceability` 5s，
run `41381763804`）。其中 `traceability` 在 CI 上实跑输出「待检 8 个提交 …… PASS」——
这是本作业的端到端自证（含 `refs/pull/N/merge` 的 checkout 修正）。

主控位审查通过后合并；**合并后**由主控位把 `traceability` 加入必需检查（顺序不可颠倒，见 Known Issues 1）。

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `scripts/check-traceability.py` | 新增 | 可追溯性检查（stdlib + git，无网络、无凭据） |
| `.github/workflows/ci.yml` | 修改 | 新增 `traceability` 作业（仅 `pull_request`，`fetch-depth: 0`，检出 `head.sha`） |
| `AGENTS.md` | 修改 | §9 文档索引；§14.1 检查表（标注 traceability 未设为必需）；§14.3 触发口径；§14.5 Issue 通道与不采用清单；§14.6 模板惰性说明 |
| `docs/git-workflow.md` | 修改 | §4「合并不等于发布」改为准确表述（合并产镜像、不推 latest） |
| `docs/agent-collaboration.md` | 修改 | §3 Issue 段改事实陈述；§4 增可追溯性说明；§6 落差表该行 |
| `docs/operations/github-capability.md` | 修改 | §1 平台事实；§3 检查清单 + 实测；§5 落差表该行；§8 漂移记录；新增 §9 刻意不采用清单 |
| `docs/operations/negative-assertion-review.md` | 修改 | 新增 P3/P4/C17 与「成对文档一致 ≠ 正确」的判据纪律 |
| `docs/operations/collaboration-audit.md` | 新增 | 审计报告：11 项发现、新旧对比、复现命令、6 项残余限制 |
| `docs/operations/collaboration-metrics.md` | 新增 | 7 项度量口径 + 首次基线（M6 失败率 13.3%） |
| `docs/operations/collaboration-scenarios.md` | 新增 | A~G 场景验证与结论分级 |
| `tasks/done/TASK-033-stage3-platform-record/TASK.md` | 修改 | Meta 结构（表格 → yaml 块），字段值逐字保留 |
| `tasks/done/TASK-035-d13-route-c/TASK.md` | 修改 | 同上 |
| `tasks/review/TASK-056-collaboration-upgrade/TASK.md` | 新增 | 本档案（自 `active/` 移入） |
| `tasks/review/TASK-056-collaboration-upgrade/handoffs/HANDOFF-001-developer-to-reviewer.md` | 新增 | 交付交接（含原始输出） |

## Known Issues

1. **`traceability` 当前不是门禁**：作业已进 `ci.yml`，但 `contexts` 仍为 `["audit","install-lint-build"]`。
   必须**先合并本 PR，再加入必需检查**；顺序颠倒会让所有 PR 永久待处理，而 `enforce_admins=true` 无绕过通道。
2. **D13-C 回写欠账仍无判据**（审计 F-4b）：TASK-051 的欠账曾滚过三轮。
   建议后续新增「`tasks/review/` 中 `Status=REVIEW` 存续超过 1 个任务即告警」的检查，本任务未实现。
3. **`rebase-merge` 改写 SHA**：合并后本任务审查记录中的提交 SHA 将不可达，需补「审查时 SHA → main 上 SHA」映射表（TASK-055 已有先例）。
4. **`audit_framework.py` 的 A3 依赖 PyYAML**：本机已装 6.0.3 并实跑通过（`PASS=13 SKIP=0`），但新环境默认仍 SKIP，不要据「A3 通过」推断无需装依赖。
5. **历史 83 个提交缺 `Refs`**：刻意不追溯——追溯等于改写已推送历史，属受保护操作。

---

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | developer（执行位） | reviewer（主控位） | 2026-11-02 | 11 条 AC 全部自测通过并附原始输出；平台侧改动前后值留证；未改分支保护 |

**最新 Handoff：** `handoffs/HANDOFF-001-developer-to-reviewer.md`
**Next Action：** 主控位在**新会话**中逐文件读实际差异，重点核对四处 Docker 表述与 `docker.yml` 第 52/54 行一致、且 §14.1 **没有**把 `traceability` 写成已生效门禁。

---

## Merge Record

| 要素 | 值 |
|------|-----|
| PR | 待回填（PR 号与合并执行者） |
| 合并策略 | rebase-merge（`AGENTS.md` §14.2 默认） |
| 提交数 | 待回填（实测 `gh api repos/:owner/:repo/pulls/<N>/commits --jq 'length'`） |
| merged_at | 待回填（实测 `gh api repos/:owner/:repo/pulls/<N>`） |
| merge_commit_sha | 待回填（全 40 位 SHA） |
| 合并后 CI run | 待回填（`actions/runs?head_sha=<SHA>` 实测 id + conclusion） |
| 合并后 Docker run | 待回填（同上；docker.yml 触发的 run id + 镜像 tag） |
| 镜像 tag | 待回填（`sha-<短SHA>`，DockerHub Tags API 实证在位） |
| 审查记录 | 待回填（指向 `handoffs/YYYY-MM-DD-review.md`；无则如实写「无（A3 断档）」） |

---

## Task Rules

- [增强] 本任务的每个提交都必须自带 `Refs: TASK-056` —— 它同时是 `traceability` 门禁的自测样本。
- [补充] 平台侧改动前先记录改动前的原始值，改动后记录实测值，两者都进 Handoff（便于逆转与复核）。
