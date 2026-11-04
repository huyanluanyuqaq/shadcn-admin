# TASK-060 — 遗留收口：D13-C 三份回写 + smoke 入 CI + 模板仓远端备份

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。

---

## Meta

```yaml
Task ID: TASK-060
Title: 遗留收口（D13-C 三份回写 + smoke 入 CI + 模板仓远端备份）
Workflow: maintenance
Status: ACTIVE
Priority: P1
Owner: "执行位"
Owner Since: "2026-11-04T00:04:41+08:00"
Assigned Role: developer
Created: 2026-11-03T15:20:00+08:00
Updated: 2026-11-04T00:16:14+08:00
Branch: "chore/TASK-060-legacy-closure"
Requires Human Approval: true
```

## Objective

收口 2026-11-02～03 一批协作体系整改后的三项遗留：按 D13-C 回写 `tasks/review/` 下三份任务的
Merge Record 并归档；把 `smoke.ts` 端到端冒烟从「仅本地门禁」升级为 CI 作业；
为模板仓库配置远端并推送，使 F10 门禁的参照物本身有备份。

## Background

2026-11-02～03 完成 TASK-058（smoke 三簇清偿）/ TASK-057（门禁实证）/ TASK-059（模板漂移修复）三项整改，
PR #33 / #37 / #38 / #39 已全部合并入 `main`（`190ea66`）。收尾时实测 `backlog/` 与 `active/` 均为空，
`tasks/review/` 剩三份、`tasks/done/` 56 份。三项遗留：

1. **D13-C 回写欠账（三份）** —— TASK-057 / 058 / 059 均已合并，但 `Merge Record` 九要素仍为
   「待回填」。`backlog/` 已空、无「下一个任务」承接，而三者**均未自行回写**（这是对的：
   TASK-055 的欠账曾因「每轮只做自己的事」滚过三轮）。按 D13-C 选项 C，需由一个新任务承接。
2. **`smoke.ts` 不在 CI** —— 它是 `Requirements`/`AC` 清单上的本地门禁，平台侧无从证明它跑过。
   TASK-058 档案已如实标注「不把 CI 绿当成冒烟已过」，但这意味冒烟证据只存在于本地运行输出中。
3. **模板仓库无远端** —— `projects/_workspace-template` 的 `git remote -v` 为空，
   提交 `8f56589`（补 Merge Record 章节 + SHA 映射表强制要求）只存在于本地。
   TASK-059 新增的 F10 门禁专门防「快照与模板仓库漂移」，而**参照物本身没有备份**——
   一旦本地丢失，`templates/` 与 `.agents/` 将同时失去唯一权威来源。

另：Workspace 根 `projects/README.md` 的任务快照已于 2026-11-03 由主控位直接更正
（done 56 / review 3 / active 0，任务链补至 TASK-059），**不在本任务范围**。

## Scope

| 组 | 内容 | 是否需要平台动作 |
|----|------|------------------|
| **W（回写）** | 按 D13-C 回填 TASK-057 / 058 / 059 三份的 Merge Record 九要素 + `Status → DONE` + `git mv` 至 `tasks/done/` | 否 |
| **S（冒烟入 CI）** | `ci.yml` 新增 `smoke` 作业（仅 `pull_request`），用隔离快照库跑 `smoke.ts` | 否 |
| **R（远端备份）** | 给 `projects/_workspace-template` 配远端并推送 | **是，需人类授权** |

## Non-Scope

- **不把 `smoke` 设为必需检查**。与 TASK-056 的 `traceability` 同纪律：作业必须先存在于 `main`
  并确认它稳定上报，再由主控位决定是否入必需检查。顺序颠倒会让所有 PR 永久 pending，
  而 `enforce_admins=true` 无绕过通道。
- **不改 `docker.yml` 的触发条件**。
- **不回填本任务自己的 Merge Record**（D13-C：由再下一个任务回填）。
- **不动 `templates/` 与 `.agents/` 的内容**（框架快照只读，`AGENTS.md` §10；F10 已常驻把守）。
- **不修 smoke.ts 的产品缺陷**——TASK-058 已把 14 项失败全部清偿（185/0），本任务只负责让它进 CI。
- **不改 Workspace 根 `projects/README.md`**（主控位已于 2026-11-03 直接更正）。

## Requirements

### W 组

1. 三份的九要素全部按 `gh api` / DockerHub Tags API **实测**，每格附复现命令；
   **不得**沿用档案自述或本任务的 Background 叙述。
2. 「审查记录」行须指向各自的 `handoffs/` 审查记录文件，并如实反映审查轮数与结论
   （TASK-057 为五轮：FAIL×3 → PASS（有条件）→ PASS；TASK-058 为一轮 PASS；
   TASK-059 为两轮 PASS）。**无独立实例审查的须如实写明，不得补写、不得伪造。**
3. 因 rebase-merge 改写了 SHA，每份须附「审查时 SHA → main 上 SHA」映射表，
   判据用 `git show --format= <SHA> | git patch-id --stable`，并验证旧 SHA 在 `main` 上不可达。
   **判据方法的适用条件以 `templates/task/TASK.md` 的「SHA 映射表」章节为准**
   （基点半移 → patch-id；基点未变 → tree 亦可，但仍以 patch-id 为权威）。
4. 每回填一份跑一次 `python scripts/audit-repo.py`，确认 F8（章节位置）/ F9（编号唯一性）仍 PASS。
5. 三份回写后 `tasks/review/` 应为空，`tasks/done/` 应为 59 个。

### S 组

6. `smoke` 作业**仅对 `pull_request` 生效**（`if: github.event_name == 'pull_request'`），
   `fetch-depth` 与检出策略按 `traceability` 作业的先例处理。
7. 必须用**隔离快照库**：`VACUUM INTO` 从真实库快照 → 起服务（`DATABASE_URL` 指向快照）→
   跑 `smoke.ts`。**绝不写 `server/data/app.db`。**
8. `SMOKE_DB_DIR` 必须等于快照 `.db` 文件**所在目录本身**（TASK-058 C 簇根因：
   恢复标记写在数据库同目录，另设数据目录会让 19.17 找不到标记）。
9. 作业失败时必须打印 `smoke.ts` 的原始输出（通过/失败数与退出码），不得只报「失败」。
10. **不得**为了让作业变绿而删用例、放宽断言、跳过段落，或给 `smoke.ts` 加忽略开关
    （`.agents/rules/github.md` §5 受保护条款）。

### R 组

11. 平台侧改动**前**先记录原始值（`git remote -v` 输出），改动后记录实测值，两者都进 Handoff
    （TASK-056 F-1 的教训：前值不可得时必须如实写「未取证」，不得填空）。
12. 推送后验证：远端可见 `8f56589`，且 F10 在 `shadcn-admin` 中仍 `PASS`（快照与远端模板仓一致）。

## Constraints

| 类型 | 内容 |
|------|------|
| 技术 | 脚本仅用 Python 标准库 + git；CI 不新增第三方依赖、不新增 secret |
| 兼容 | 不改任何运行时行为；`smoke` 作业不得影响现有三个作业的结论 |
| 安全 | 不写凭据；模板仓远端若需认证，凭据由人类配置，不落库 |
| 流程 | 每提交一个关注点；footer 含 `Refs: TASK-060`；R 组前须取得人类授权 |

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| `main` = `190ea66`（三份任务已合并） | blocks | 已完成 |
| TASK-059 的 F10 门禁 | 环境 | 已生效（`audit-repo.py` PASS=10） |
| 人类授权配置模板仓远端 | external | **待授权** |

## Acceptance Criteria

- [x] AC-1: TASK-057 / 058 / 059 三份的 Merge Record 九要素全部填实测值、每格附复现命令。
      **证据**：三份归档的 `Merge Record` 均为「实测值 + 复现命令」三列表；TASK-059 覆盖 PR #38 与 #39 两次合并。
- [x] AC-2: 三份的「审查记录」行如实指向审查文件并反映轮数结论；TASK-057 须写明
      「五轮：FAIL×3 → PASS（有条件）→ PASS」。
      **证据**：057 五轮、058 一轮、059 两轮均已落表；同一会话的复审未写成新的独立实例审查。
- [x] AC-3: 三份各附 SHA 映射表，patch-id 判据全部自跑 SAME，旧 SHA 全部不可达；
      全表自检输出留证（贴入提交信息或档案）。
      **证据**：057 = 5/5、058 = 13/13（含审查头别名）、059 = 4/4，均 SAME / 旧不可达 PASS / 新在 main PASS；
      完整原始输出见 W 组提交信息。
- [x] AC-4: 三份 `Status: DONE` 且位于 `tasks/done/`；`tasks/review/` 为空；
      `tasks/done/` 共 **59** 个；每移动一份跑一次 `audit-repo.py`，三次均 `PASS=10 FAIL=0`。
      **证据**：2026-11-04 逐份移动后三次均为 `PASS=10 FAIL=0 WARN=0`、退出码 0；
      `review_entries=[]`、`done_task_dirs=59`。
- [ ] AC-5: `ci.yml` 含 `smoke` 作业，`if: github.event_name == 'pull_request'`；
      本地用隔离快照库实跑 **185 通过 / 0 失败、退出码 0**，输出贴入档案。
- [ ] AC-6: `smoke` 作业在 PR 上至少一次端到端跑通（`gh pr checks` 见 `smoke` 且结论为 pass），
      原始输出可查；**未**加入 `required_status_checks.contexts`。
- [ ] AC-7: `audit-repo.py` → `PASS=10 FAIL=0 WARN=0`（F6 作业名一致性仍 PASS，含新作业名）；
      `prettier --check .`、`audit_framework.py`、vitest、`tsc -b`、eslint、knip、
      sync/bundle check 全 exit 0。
- [ ] AC-8: 真实库 `server/data/app.db` 四表行数与 mtime 在任务前后一致（只读核查留证）。
- [ ] AC-9: 模板仓配好远端并推送，`8f56589` 在远端可见；F10 在 `shadcn-admin` 仍 PASS。
- [ ] AC-10: R 组的平台改动**前后原始值都进 Handoff**。

## File Scope

```yaml
File Scope:
  - .github/workflows/ci.yml
  - tasks/review/TASK-057-gate-evidence-closure/**        → tasks/done/…
  - tasks/review/TASK-058-smoke-failures-closure/**       → tasks/done/…
  - tasks/review/TASK-059-template-drift-and-sha-mapping/** → tasks/done/…
  - tasks/backlog/TASK-060-*/**   → tasks/active/… → tasks/review/…
  # 模板仓库（projects/_workspace-template）：仅配 remote 与推送，不改内容
Non-Scope (files):
  - templates/**                # 框架快照只读（F10 把守）
  - .agents/**
  - scripts/audit-repo.py       # 不改判据与豁免清单
  - .github/workflows/docker.yml
  - server/src/**, shared/src/**, src/**
  - server/data/**
  - E:/NDLDSN-WORKSPACE/projects/README.md   # 主控位已直接更正
```

## Implementation Plan

1. 从 `main`（`190ea66`）切分支；`git status` 确认干净。
2. **先做 W 组**（纯档案，风险最低）：逐份实测九要素 → 填表 → 附 SHA 映射表（自跑 patch-id）→
   `Status: DONE` → `git mv` → 每份跑一次 `audit-repo.py`。
3. **再做 S 组**：写 `smoke` 作业 → 本地隔离快照库实跑 → 推分支在 PR 上端到端验证一次。
4. **最后做 R 组**：向人类申请授权 → 记录前值 → 配 remote → 推送 → 验证 F10 仍 PASS。
5. 全量门禁 → 提交（建议 3 个：W / S / R 各一）→ 推分支 → 开 PR → 交主控位审查。

## Verification Plan

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| AC-1/2 | 文本 + 平台实测 | `gh api …/pulls/<N> --jq '{merged,merged_at,merge_commit_sha,commits}'` 等逐格复现 |
| AC-3 | git 实测 | `git show --format= <SHA> \| git patch-id --stable` 逐对；`git merge-base --is-ancestor <旧> main` 须非 0 |
| AC-4 | 文本 + 脚本 | `ls tasks/done \| wc -l` = 59；`ls tasks/review` 空；`python scripts/audit-repo.py` |
| AC-5/6 | 实跑 + 平台 | 隔离配方跑 smoke；`gh pr checks <N>` 见 `smoke` 项 |
| AC-7 | 门禁 | 九条命令逐一记录退出码 |
| AC-8 | 只读核查 | `better-sqlite3` `{readonly:true}` 查四表行数 + mtime |
| AC-9/10 | 平台 + git | `git -C <模板仓> remote -v`；`git -C <模板仓> ls-remote`；F10 复跑 |

## Current State

**ACTIVE（2026-11-04 W 组完成，进入 S 组）。** 三份 D13-C 回写与归档已完成，
三次移动后审计均 `PASS=10 FAIL=0 WARN=0`；`tasks/review/` 已空、`tasks/done/` 为 59 个任务目录。
下一步仅为 `ci.yml` 增加 PR 隔离冒烟并实跑验证；R 组仍未执行，须在 W/S 完成后单独申请人类授权。

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `tasks/active/TASK-060-legacy-closure/TASK.md` | `git mv` + 修改 | 领取任务；登记 W 组实测与验收证据 |
| `tasks/done/TASK-057-gate-evidence-closure/**` | `git mv` + 修改 | 重测九要素、五轮审查与 5 组 SHA 映射；DONE 归档 |
| `tasks/done/TASK-058-smoke-failures-closure/**` | `git mv` + 修改 | 重测九要素、一轮审查与 13 组 SHA 映射（含审查头别名）；DONE 归档 |
| `tasks/done/TASK-059-template-drift-and-sha-mapping/**` | `git mv` + 修改 + 收纳既有审查记录 | 重测 PR #38/#39 九要素、两轮审查与 4 组 SHA 映射；DONE 归档 |

## Known Issues

1. **`smoke` 作业首次进 CI 可能暴露环境差异**（TASK-058 已知教训：Vitest 4 的 `dist/**` 默认不收、
   `SMOKE_DB_DIR` 口径等）。若作业在 CI 上红而本地绿，先按「本地与 CI 环境漂移」定位，
   **不得**靠放宽断言变绿。
2. **R 组依赖人类授权**：模板仓配远端属平台/基础设施动作（`change-safety.md` 高风险清单）。
   执行位做到 R 组须停下来申请，不得擅自执行。
3. **三份回写后本任务的 Merge Record 仍待再下一个任务回填** —— D13-C 机制，非遗漏。

## Handoff

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| — | — | — | — | 尚未开始 |

**最新 Handoff：** 无
**Next Action：** 执行位领取后先做 W 组，再做 S 组；R 组须先取得人类授权。

## Merge Record

> **本节不随「Pass/收尾」填写。** 按 D13-C 选项 C（`.agents/rules/github.md` §2 / §6、
> `AGENTS.md` §14.2），本表由**下一个任务**在回收本任务归档时回填；
> 在此之前任务保持 `Status = REVIEW`、留在 `tasks/review/`（机制，非遗漏）。
> **禁止在本任务内自我回写**（那会造成档案与提交历史不一致）。
> 回填时九要素必须填实测值（可被 `gh api` / Tags API 复现），不得沿用档案自述；
> 无合并前独立审查档时，「审查记录」行须如实写「无（A3 断档）」，**不得补写、不得伪造**。

| 要素 | 值 |
|------|-----|
| PR | 待回填 |
| 合并策略 | rebase-merge（`AGENTS.md` §14.2 默认） |
| 提交数 | 待回填 |
| merged_at | 待回填 |
| merge_commit_sha | 待回填 |
| 合并后 CI run | 待回填 |
| 合并后 Docker run | 待回填 |
| 镜像 tag | 待回填 |
| 审查记录 | 待回填 |

## Task Rules

- [增强] **W 组是「承接他人回写」，不是「自己做自己的」**：三份档案的 Merge Record 必须由本任务
  （作为 D13-C 的「下一个任务」）回填；本任务**自己**的 Merge Record 则必须留空。
  这个区分是 TASK-055 欠账滚三轮的教训所在。
- [补充] R 组平台侧改动前先记录原始值，改动后记录实测值，两者都进 Handoff（TASK-056 F-1 教训）。
- [补充] S 组的 `smoke` 作业**不得**加入必需检查；入必需检查由主控位在作业稳定上报后另行决定。
- [补充] 冒烟一律用隔离快照库；真实库只读。

## Notes

- 三项遗留的来源：2026-11-02～03 主控位对 PR #33 / #37 / #38 / #39 的审查结论与合并后核查。
- 隔离快照库配方见 `tasks/done/TASK-058-smoke-failures-closure/TASK.md`「V 组实测记录」
  （**注意**：`SMOKE_DB_DIR` 必须是快照 `.db` 所在目录本身，不是另设的数据目录）。
- `templates/task/TASK.md` 的「SHA 映射表」章节写明了两种判据方法各自的适用条件，W 组须据此执行。
