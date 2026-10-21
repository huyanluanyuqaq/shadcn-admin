# TASK-XXX — {{TASK_TITLE}}

> **本文件是 Task 的唯一事实来源。** 任何 Agent 接手此 Task 前必须先读完本文件。
> 复制本模板到 `tasks/<state>/TASK-XXX-<slug>/TASK.md` 后，替换所有 `{{...}}` 并删除本提示块。

---

## Meta

```yaml
Task ID: TASK-XXX                  # 格式：TASK-<三位序号>-<slug>，如 TASK-001-user-login
Title: {{TASK_TITLE}}
Workflow: {{feature|bugfix|refactor|research|release}}
Status: BACKLOG                    # BACKLOG|READY|ACTIVE|DESIGN|BLOCKED|CHANGES_REQUESTED|TEST_FAILED|REQUIREMENT_CHANGED|REVIEW|DONE
Priority: {{P0|P1|P2|P3}}
Owner: {{agent-identifier or ""}}
Owner Since: {{ISO-8601 or ""}}
Assigned Role: {{architect|developer|reviewer|tester|devops|researcher|product|security}}
Created: {{ISO-8601}}
Updated: {{ISO-8601}}
Branch: {{type/TASK-XXX-slug or ""}}
Requires Human Approval: {{true|false}}
```

> **状态与目录的对应关系**（变更 Status 时须同步移动目录）：
>
> | Status | 目录 |
> |--------|------|
> | `BACKLOG`, `READY` | `backlog/` |
> | `ACTIVE`, `DESIGN`, `BLOCKED`, `CHANGES_REQUESTED`, `TEST_FAILED`, `REQUIREMENT_CHANGED` | `active/` |
> | `REVIEW` | `review/` |
> | `DONE` | `done/` |

---

## Objective

> 一句话说明这个 Task 要达成什么。**必须可判定是否达成。**

{{例如：为登录接口增加失败次数限流，防止暴力破解。}}

---

## Background

> 为什么需要这个 Task？相关上下文是什么？

{{背景说明。包括触发原因、相关历史、关联文档链接。}}

---

## Scope

> 本 Task **包含**什么。

- {{包含项 1}}
- {{包含项 2}}

## Non-Scope

> 本 Task **明确不包含**什么。防止范围蔓延。

- {{不包含项 1}}
- {{不包含项 2}}

---

## Requirements

> 具体要满足的要求（功能性与非功能性）。

1. {{要求 1}}
2. {{要求 2}}

---

## Constraints

> 实施时必须遵守的限制。

| 类型 | 内容 |
|------|------|
| 技术 | {{如：不得引入新依赖}} |
| 性能 | {{如：P99 延迟 < 100ms}} |
| 兼容 | {{如：保持现有 API 契约}} |
| 安全 | {{如：不得记录明文密码}} |
| 时间 | {{如：需在 X 前完成}} |

---

## Dependencies

| 依赖 | 类型 | 状态 |
|------|------|------|
| {{TASK-YYY}} | blocks（本 Task 依赖它） | {{未完成/已完成}} |
| {{外部系统}} | external | {{可用/阻塞}} |

> 若存在未满足的 `blocks` 依赖 → 本 Task 不得进入 `ACTIVE`。

---

## Acceptance Criteria

> **可判定**的验收标准。每条必须能用"是/否"回答。

- [ ] AC-1: {{验收标准 1}}
- [ ] AC-2: {{验收标准 2}}
- [ ] AC-3: {{验收标准 3}}

---

## File Scope

> 本 Task 允许改动的路径范围。**超出范围的改动必须先更新本字段并说明理由。**

```yaml
File Scope:
  - {{path/glob/**}}
  - {{tests/path/**}}
Non-Scope (files):
  - {{path/not-to-touch/**}}
```

---

## Implementation Plan

> 实施步骤。可由 Architect 填写，Developer 在执行中更新。

1. {{步骤 1}}
2. {{步骤 2}}
3. {{步骤 3}}

---

## Verification Plan

> 如何验证本 Task 已完成。

| 验证项 | 方式 | 命令 / 步骤 |
|--------|------|------------|
| {{AC-1}} | {{测试/手工}} | {{具体命令}} |
| {{AC-2}} | {{测试/手工}} | {{具体命令}} |

---

## Current State

> 当前进展。每次状态变更时更新。

{{当前正在做什么，卡在哪里，下一步是什么。}}

---

## Changed Files

> 实际改动的文件。由 Developer 维护。

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| {{path}} | {{新增/修改/删除}} | {{说明}} |

---

## Known Issues

> 已知问题、未覆盖范围、技术债。**无则写"无"。**

{{已知问题列表，或"无"。}}

---

## Handoff

> 交接记录索引。实际 Handoff 文件在 `handoffs/` 目录内。

| # | From | To | 日期 | 摘要 |
|---|------|----|------|------|
| 001 | {{role}} | {{role}} | {{date}} | {{一句话摘要}} |

**最新 Handoff：** `handoffs/HANDOFF-001-{{from}}-to-{{to}}.md`
**Next Action：** {{接收方的第一个具体动作}}

---

## Merge Record

> **本节不随「Pass/收尾」填写。** 按 D13-C 选项 C（`.agents/rules/github.md` §2 / §6、
> `AGENTS.md` §14.2），本表由**下一个任务**在回收本任务归档时回填；
> 在此之前任务保持 `Status = REVIEW`、留在 `tasks/review/`（机制，非遗漏）。
> **禁止在本任务内自我回写**（那会造成档案与提交历史不一致）。
> 回填时九要素必须填实测值（可被 `gh api` / Tags API 复现），不得沿用档案自述；
> 无合并前独立审查档时，「审查记录」行须如实写「无（A3 断档）」，**不得补写、不得伪造**。
>
> **本节的章节位置固定：位于 `## Handoff` 之后、`## Task Rules` 之前**
> （由 `scripts/audit-repo.py` F8 门禁保证一致；历史豁免与编号白名单见该脚本的显式清单）。

| 要素 | 值 |
|------|-----|
| PR | 待回填（{{PR 号与合并执行者}}） |
| 合并策略 | rebase-merge（`AGENTS.md` §14.2 默认） |
| 提交数 | 待回填（实测 `gh api repos/:owner/:repo/pulls/<N>/commits --jq 'length'`） |
| merged_at | 待回填（实测 `gh api repos/:owner/:repo/pulls/<N>`） |
| merge_commit_sha | 待回填（全 40 位 SHA） |
| 合并后 CI run | 待回填（`actions/runs?head_sha=<SHA>` 实测 id + conclusion） |
| 合并后 Docker run | 待回填（同上；docker.yml 触发的 run id + 镜像 tag） |
| 镜像 tag | 待回填（`sha-<短SHA>`，DockerHub Tags API 实证在位） |
| 审查记录 | 待回填（指向 `handoffs/YYYY-MM-DD-review.md`；无则如实写「无（A3 断档）」，不补写） |

---

## Task Rules

> 本 Task 特有的规则覆盖（如无则删除本节）。
> 格式见 `.agents/protocols/rule-precedence.md` §6。

- [覆盖] {{覆盖哪条规则}}（原因：{{原因}}）
- [补充] {{额外要求}}
- [增强] {{更严格的要求}}

---

## Notes

> 其他需要记录的信息。

{{自由记录区。}}
