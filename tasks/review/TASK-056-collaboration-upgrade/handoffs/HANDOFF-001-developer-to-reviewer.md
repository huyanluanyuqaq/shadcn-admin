# HANDOFF-001 — TASK-056 执行位 → 主控位

## Meta

```yaml
From: Codex（执行位 · developer）
To: 主控位（Coordinator · Reviewer）
Task: TASK-056 — 协作体系整改（P1 失真 + P2 缺口）
Date: 2026-11-02T11:10:00+08:00
Current State: REVIEW
Branch: docs/TASK-056-collaboration-upgrade
```

## Completed Work

1. **平台侧改动（先改后测，前后值都留证）**
   - 关闭 Issues：`has_issues` `true → false`（用户裁决；关闭前该通道实际不可用，见审计 F-2）。
   - 开启合并后自动删分支：`delete_branch_on_merge` `false → true`。
   - **未改动**分支保护（新增必需检查须在本 PR 合并之后进行，见 Remaining Work）。

2. **失真修正 3 处**
   - Docker 触发口径：`AGENTS.md` §14.3、`docs/git-workflow.md` §4、`docs/agent-collaboration.md` §6、
     `docs/operations/github-capability.md` §5 由「仅 tag 触发」改为「合并即构建 `sha-*`，`latest` 仅 tag 前进」，
     并把「保证来源」由「触发器」改写为 metadata 的 `enable=${{ github.ref_type == 'tag' }}` 门禁。
   - Issue 通道：文档改为事实陈述；D2 的理由回到「避免双写 / 独立 clone 后完整」。
   - `negative-assertion-review.md` 新增 C17 + 本轮教训（成对文档「一致」≠「正确」）。

3. **门禁新增**：`scripts/check-traceability.py` + `ci.yml` 的 `traceability` 作业
   （仅 `pull_request`，`fetch-depth: 0`，checkout 显式取 `head.sha`）。

4. **缺口补齐**：`collaboration-audit.md`（审计报告）、`collaboration-metrics.md`（7 项度量 + 基线）、
   `collaboration-scenarios.md`（A~G 场景与结论分级）。

5. **档案卫生**：TASK-033 / TASK-035 的 Meta 由表格改为 yaml 块（仅结构，字段值逐字保留）。

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `scripts/check-traceability.py` | 新增 | 可追溯性检查（stdlib + git，无网络） |
| `.github/workflows/ci.yml` | 修改 | 新增 `traceability` 作业（未加入必需检查） |
| `AGENTS.md` | 修改 | §9 文档索引、§14.1 检查表、§14.3 触发口径、§14.5 Issue 通道、§14.6 Issue 模板惰性说明 |
| `docs/git-workflow.md` | 修改 | §4 「合并不等于发布」段改为准确表述 |
| `docs/agent-collaboration.md` | 修改 | §3 Issue 段、§4 可追溯性说明、§6 落差表该行 |
| `docs/operations/github-capability.md` | 修改 | §1 平台事实、§3 检查清单与实测、§5 落差表该行、§8 漂移记录、新增 §9 刻意不采用清单 |
| `docs/operations/negative-assertion-review.md` | 修改 | 新增 P3/P4/C17 与判据纪律说明 |
| `docs/operations/collaboration-audit.md` | 新增 | 审计报告（11 项发现 + 复现命令 + 6 项残余限制） |
| `docs/operations/collaboration-metrics.md` | 新增 | 7 项度量口径 + 首次基线 |
| `docs/operations/collaboration-scenarios.md` | 新增 | A~G 场景验证与结论分级 |
| `tasks/done/TASK-033-stage3-platform-record/TASK.md` | 修改 | Meta 结构（表格 → yaml 块） |
| `tasks/done/TASK-035-d13-route-c/TASK.md` | 修改 | 同上 |
| `tasks/review/TASK-056-collaboration-upgrade/**` | 新增 | 本任务档案与交接记录 |

## Tests

**全部为只读/静态验证，本任务无代码变更，因此未运行 `pnpm test`；CI 会用完整流水线复核。**

| 项 | 命令 | 退出码 | 输出摘要 |
|----|------|--------|---------|
| 仓库级审计 | `python3 scripts/audit-repo.py` | 0 | `PASS=9 FAIL=0 WARN=0` |
| 框架自检 | `python3 shared/scripts/audit_framework.py` | 0 | `PASS=13 FAIL=0 WARN=0 SKIP=0` |
| 可追溯性（正向） | `python3 scripts/check-traceability.py --base origin/main` | 0 | 6 个提交均引用真实任务 |
| 可追溯性（负向 1） | 同上，临时提交引用 `TASK-999` | 1 | 指名 `f93bcc71` 引用了不存在的任务 |
| 可追溯性（负向 2） | 同上，临时提交无 `Refs` | 1 | 指名 `9801af63` 缺 `Refs: TASK-NNN` |
| YAML 合法性 | `python3 -c "yaml.safe_load(ci.yml)"` | 0 | `jobs: install-lint-build / audit / traceability` |
| 状态一致性 | 全 55 份档案 `^Status:` 与目录比对 | 0 | `mismatch: 0` |

原始输出（2026-11-02 11:10 实跑）：

```text
### audit-repo.py
PASS=9 FAIL=0 WARN=0

### audit_framework.py
PASS=13  FAIL=0  WARN=0  SKIP=0

### 平台实测
{"delete_branch_on_merge":true,"has_issues":false,"has_projects":true}

### 必需检查实测
{"approvals":0,"contexts":["audit","install-lint-build"],"enforce_admins":true}

### docker.yml 触发
52:    branches: ["main"]
54:    tags: ["v*"]

### traceability 正向
[traceability] 基线 origin/main，待检 6 个提交，已知任务 54 个。
[traceability] PASS —— 6 个提交均引用了真实存在的任务。

### M6 度量（ci.yml 近 30 次）
{"failure":4,"success":26}

### M4 度量（远端分支数）
2

### 负向用例 1（TASK-999）
exit=1
  - f93bcc71 引用了不存在的任务 TASK-999（tasks/*/ 下无对应目录）

### 负向用例 2（无 Refs）
exit=1
  - 9801af63 未在提交信息中引用任务（缺 `Refs: TASK-NNN`）
```

## Known Issues

1. **`traceability` 当前不是门禁**：作业已进 `ci.yml`，但 `required_status_checks.contexts`
   仍为 `["audit","install-lint-build"]`。必须**先合并本 PR，再加入必需检查**；顺序颠倒会让所有 PR 永久待处理。
2. **D13-C 回写欠账仍无判据**（审计 F-4b）：TASK-051 的欠账曾滚过三轮。
   建议后续加「`tasks/review/` 中 `Status=REVIEW` 存续超过 1 个任务即告警」的检查，本任务未实现。
3. **`rebase-merge` 改写 SHA，审查记录引用会失效**（场景 F）：合并后本任务审查记录里的
   提交 SHA 将不可达，需按 TASK-055 的做法补映射表，或在模板中固化该要求。
4. **A3 依赖 PyYAML**：本机已安装 6.0.3 并实跑通过，但新环境默认仍会 SKIP。
5. **历史 83 个提交缺 `Refs`**：刻意不追溯（追溯等于改写已推送历史，属受保护操作）。

## Remaining Work

1. 主控位审查本 PR（**必须换会话/新实例**，I2）。
2. 合并后：把 `traceability` 加入必需检查，并把 `AGENTS.md` §14.1 该行改为「是」、
   能力记录 §3 更新实测 `contexts`。
3. 由**下一个任务**按 D13-C 回填本任务 `Merge Record` 九要素。

## Assumptions

- 用户裁决「关闭 Issues」被理解为**关闭该功能**，而非「关闭已有 Issue」——仓库历史 Issue 数为 0，无数据影响。
- `delete_branch_on_merge=true` 只影响合并后自动删源分支，不影响受保护分支本身（`allow_deletions=false` 仍生效）。
- 新增作业命名 `traceability` 与既有小写风格（`audit`）一致，便于在必需检查列表中共存。

## Risks

| 风险 | 影响 | 缓解 |
|------|------|------|
| 合并后忘记把 `traceability` 设为必需 | 制度声称有门禁、实际没有（又制造一处失真） | `AGENTS.md` §14.1 与能力记录 §3 均标「尚未设为必需」；本 Handoff 的 Remaining Work 列为第 2 项 |
| 过早设为必需 | 所有 PR 永久待处理，且 `enforce_admins=true` 无绕过 | 已在三处文档写明顺序；本次**未**改分支保护 |
| 新检查在 PR 上假红 | 开发者被迫绕过 | 已处理 `refs/pull/N/merge` 的坑（checkout `head.sha`），并在正/负向用例上实测 |
| 关闭 Issues 与既有上游模板并存造成误读 | 后人以为 Issue 可用 | `AGENTS.md` §14.6 明确「模板已惰性」 |

**回滚方案：** 全部为文档与一个只读脚本；`git revert` 单个提交即可。
平台侧回滚：`gh api -X PATCH repos/huyanluanyuqaq/shadcn-admin -F has_issues=true -F delete_branch_on_merge=false`。

## Next Action

主控位在**新会话**中读本 Handoff + `TASK.md`，然后：
`gh pr view <本 PR 号> --json files` 后**逐文件读实际差异**，重点核对四处 Docker 表述是否与
`docker.yml` 第 52/54 行一致、§14.1 是否**没有**把 `traceability` 写成已生效门禁。

## References

- 审计报告：`docs/operations/collaboration-audit.md`
- 场景验证：`docs/operations/collaboration-scenarios.md`
- 平台能力：`docs/operations/github-capability.md` §1 / §3 / §8 / §9
- 任务档案：`tasks/review/TASK-056-collaboration-upgrade/TASK.md`
