# HANDOFF-003 — 主控位 → 执行位（AC-9 归档指派）

---

## Meta

```yaml
From: 主控位 Coordinator
To: 执行位 Implementer（devops）
Task: TASK-042 — CI 增加后端编译门禁 + Docker `:latest` 加 tag 门禁，并受控发布 v1.0.1
Date: 2026-10-17
Current State: REVIEW
Previous Handoff: HANDOFF-002-implementer-to-coordinator.md
```

---

## Completed Work

> 主控位本轮指派 AC-9 归档回写。执行位前序工作（P1–P5）已由主控位审查 PASS，
> PR #14 已 rebase-merge 入 main（`72d8f28..b62e981`），发布 `v1.0.1` 已成功。
> 本交接仅触发 AC-9 档案收尾，**纯文档工作，零行为变更**。

---

## Assigned Scope（AC-9）

1. **回填 `TASK.md`**：
   - AC-1～AC-8 全部勾选为 `[x]`，每条后补「证据：」行（证据数据见本文件下方）。
   - 新增 `## Merge Record` 节：PR #14、rebase-merge、合并后 main = `b62e981`；合并前门禁；合并后 CI；发布实证。
   - `File Scope` 路径修正：`tasks/backlog/...` → `tasks/**/TASK-042-*/**`。
   - `Current State` 更新为 `REVIEW`（已全部完成，移交 `review/` 待归档回写）。
   - `Known Issues` 追加 KI-4、KI-5。
   - `Handoff` 索引表补 002/003/004 三行，更新「最新 Handoff」与「Next Action」。

2. **补三个 Handoff 文件**（按模板字段）：
   - `HANDOFF-002-implementer-to-coordinator.md`（**补录**，覆盖 P1–P3 实施，含主控位审查结论 PASS + 3 MINOR）。
   - `HANDOFF-003-coordinator-to-implementer.md`（本文件）。
   - `HANDOFF-004-implementer-to-coordinator.md`（AC-9 完成报告）。

3. **目录迁移**：`tasks/active/TASK-042-*/` → `tasks/review/TASK-042-*/`；`Status` 改为 `REVIEW`。

4. **提交与交付**：Conventional Commits，footer `Refs: TASK-042`；推送 `docs/TASK-042-archive` 分支；开 PR（按 `.github/PULL_REQUEST_TEMPLATE.md` 填全字段）；本地运行 `python scripts/audit-repo.py` 并保存原始输出。

---

## File Scope 限制

本 PR **只改 `tasks/` 下的任务档案**，不碰以下文件与目录：

```
禁止改动:
  .github/workflows/ci.yml
  .github/workflows/docker.yml
  .github/PULL_REQUEST_TEMPLATE.md
  src/**  server/**  shared/**
  package.json  pnpm-lock.yaml  pnpm-workspace.yaml  tsconfig*.json
  AGENTS.md  docs/**  .agents/**  templates/**
  Dockerfile  docker-compose.yml  .dockerignore
```

允许改动：

```
  tasks/**/TASK-042-ci-server-typecheck-and-release-gate/**
    ├── TASK.md
    ├── handoffs/
    │   ├── HANDOFF-002-implementer-to-coordinator.md  (补录)
    │   ├── HANDOFF-003-coordinator-to-implementer.md  (本文件)
    │   └── HANDOFF-004-implementer-to-coordinator.md  (待执行位完成后填)
    └── artifacts/  (保留既有文件，本次不改)
```

---

## 禁止事项

- **不得自行合并 PR**（执行位 ≠ 批准者）。
- **不得改写审查结论**：MINOR-1/2/3 如实记录，不得改为「无问题」。
- **不得修改任何 `.github/workflows/` 文件**。
- **不得重新推算证据数据**，照抄以下「实证数据供参考」节。

---

## 实证数据供参考（照抄，不改数字）

### AC-1
`pnpm typecheck:server` 于 HEAD=`72d8f28`（=origin/main）退出码 0；`.github/` 未修改；未触发 R6。
原始输出：`artifacts/ac1-typecheck-server.txt`

### AC-2
`ci.yml` 的 `install-lint-build` 作业内第 7 步 "Typecheck server" → success；
run `39004353067`、`39005264346`、`39005551732` 三次均见该步骤 success；
作业名集合仍为 `['install-lint-build','audit']`。

### AC-3
`scripts/audit-repo.py` 本地 `PASS=7 FAIL=0 WARN=0`（主控位独立复跑一致）。
原始输出：`artifacts/ac3-audit-p2.txt`

### AC-4
`docker.yml:84` 为 `type=raw,value=latest,enable=${{ github.ref_type == 'tag' }}`；
`type=sha` 与 `type=semver` 两行未动；文件头已同步说明。

### AC-5
PR #14 rebase-merge，main `72d8f28..b62e981`，提交 `ffad602` / `29f8dbe` / `9534983` / `b62e981`；
PR 上两必需检查 SUCCESS（`statusCheckRollup`）；
合并后 main push run `39005551732` 两作业 success。

### AC-6
run `39006433376`（workflow_dispatch / main，success）—— metadata 只产出 `sha-b62e981`，不含 `latest`、不含版本号；
DockerHub `latest` digest 仍为 `sha256:19e2d1ea9464da1d2da8316b885393e03330282df3dbb678b1840672979abe2d`、
`last_updated` 仍 `2026-10-13T14:21:23Z`，与运行前完全一致。

### AC-7
annotated tag `v1.0.1` → `31b670a`（= `b62e981`），已推送；
run `39007059836`（push / v1.0.1）success。

### AC-8
`v1.0.1` 与 `latest` digest 完全相同：
`sha256:13bbf2d989dfe4428d46d8be23c985e8a6104851e924149e05faf7a6c101eed3`；
三者（`latest` / `v1.0.1` / `sha-b62e981`）`updated` 均为 `2026-10-17T05:40:11~16Z`。

---

## Next Action

**执行位第一个动作：**

1. 确认本任务目录当前位于 `tasks/active/TASK-042-ci-server-typecheck-and-release-gate/`。
2. 从 `origin/main` 派生分支 `docs/TASK-042-archive`。
3. 按本文件「Assigned Scope」与「File Scope 限制」逐项执行 AC-9 归档回写。
4. 完成后交付 `HANDOFF-004-implementer-to-coordinator.md`。
