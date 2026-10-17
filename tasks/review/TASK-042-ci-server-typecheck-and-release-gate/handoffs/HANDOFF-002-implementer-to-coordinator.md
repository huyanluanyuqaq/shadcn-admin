# HANDOFF-002 — 执行位 → 主控位（补录）

> **补录**（2026-10-17，覆盖 2026-10-17 04:47~05:10 的实施）
> 本文件为原 HANDOFF-002 的延迟补录，对应 P1–P3 实施阶段。

---

## Meta

```yaml
From: 执行位 Implementer（devops）
To: 主控位 Coordinator
Task: TASK-042 — CI 增加后端编译门禁 + Docker `:latest` 加 tag 门禁，并受控发布 v1.0.1
Date: 2026-10-17
Current State: REVIEW（已归档至 review/，本次补录后 Status 不变）
Previous Handoff: HANDOFF-001-coordinator-to-implementer.md
```

---

## Completed Work

> P1–P3 实施内容，按 Implementation Plan 阶段：

- **Phase 1（后端编译门禁）**：在 `ci.yml` 的 `install-lint-build` 作业内、`Build shared package` 步骤之后、`Lint the code` 之前新增 `Typecheck server` 步骤（`run: pnpm typecheck:server`）。作业名集合保持 `['install-lint-build', 'audit']` 不变。
- **Phase 2（`:latest` 发布门禁）**：`docker.yml` 的 `:latest` 行从 `type=raw,value=latest` 改为 `type=raw,value=latest,enable=${{ github.ref_type == 'tag' }}`；同步更新文件头注释块「推送后的镜像」小节。
- **本地验证**：`pnpm build:shared` + `pnpm typecheck:server` 退出码 0；`python scripts/audit-repo.py` → `PASS=7 FAIL=0 WARN=0`。
- **开立 PR #14**（分支 `chore/TASK-042-ci-server-typecheck-and-release-gate` → `main`）。
- **合并**：主控位以 `rebase-merge` 合入 main，合并后 HEAD = `b62e981`。

---

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `.github/workflows/ci.yml` | 修改 | `install-lint-build` 作业内新增 `Typecheck server` 步骤 |
| `.github/workflows/docker.yml` | 修改 | `:latest` 行加 `enable` 门禁；文件头注释同步更新 |
| `tasks/backlog/TASK-042-ci-server-typecheck-and-release-gate/**` | 新增/修改 | 任务档案 + artifacts（实证留档） |

---

## Tests

```yaml
命令: pnpm build:shared && pnpm typecheck:server
结果: 退出码 0
覆盖: 后端 typecheck 全量通过
未覆盖: CI 实际运行（需 PR 合并后在 GitHub Actions 验证）
```

```yaml
命令: python scripts/audit-repo.py
结果: PASS=7 FAIL=0 WARN=0，退出码 0
覆盖: F1–F7 全部通过
```

---

## Known Issues

> 当时已知问题（部分后续已处理）：

- **KI-1** DockerHub 遗留 `v1` 浮动 tag（旧配置产物），本任务不清理。
- **KI-2** 两套版本号序列并存（`package.json` `2.2.1` vs DockerHub `v1.0.x`），人类已裁决接受。
- **KI-3** `docker.yml` 保留 `workflow_dispatch` 出口，手动触发仍会推 `sha-*` tag。
- **KI-4（主控位已修）** `docker.yml` 文件头注释自相矛盾（称 workflow_dispatch「只产出 `<短commit-sha>` 一个 tag」），实际 tag 触发同时产 `latest` + 版本号 + `sha`。主控位以提交 `a075b16`（main 上 `b62e981`）修正。

---

## Assumptions

- A-1 `pnpm typecheck:server` 在当前 main 上能通过（已证实）。
- A-2 `enable=${{ github.ref_type == 'tag' }}` 为 metadata-action 支持的 GitHub 上下文表达式（AC-6 实证）。
- A-3 合并后 main 前进速度不会影响 tag 指向（已由 tag 操作时间点保证）。

---

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| KI-4 文件头注释矛盾 | 文档误导，下次人工触发时预期不符 | 主控位已修，本文件注明 |
| KI-3 workflow_dispatch 保留 | 手动触发仍产 sha-* tag | 已接受为已知风险，不阻塞合并 |

---

## Main Coordinator Review Conclusion

> ⚠️ 本段如实记录主控位审查结论，**不得改写为「无问题」或「直接通过」。**

**审查结论：PASS，附 3 项 MINOR**

- **MINOR-1**：缺 `HANDOFF-002`（即本文件）。主控位要求补录，执行位应在本文件完成后将其纳入交接链。
- **MINOR-2**：`docker.yml` 文件头注释自相矛盾（「只产出 sha 一个 tag」vs「可任选分支/tag」），主控位已以提交 `a075b16`（main 上 `b62e981`）修正。
- **MINOR-3**：`File Scope` 路径仍为 `tasks/backlog/...`（原路径因 READY→ACTIVE 迁目录而过期，见本次审查 MINOR-3）。待 AC-9 归档时修正为 `tasks/**/TASK-042-*/**`。

> 以上 MINOR 均不阻塞合并。MINOR-2 已由主控位修正；MINOR-1、MINOR-3 由 AC-9 补记。

---

## Next Action

**接收方（主控位）：**
1. 确认本文件内容与 P1–P3 实际实施一致。
2. MINOR-1 已因本文件存在而关闭；MINOR-2 已由主控位修；MINOR-3 由 AC-9 归档时处理。
3. 执行 `rebase-merge` 合并 PR #14。

---

## References

- PR #14：https://github.com/huyanluanyuqaq/shadcn-admin/pull/14
- `ci.yml` 作业名：`install-lint-build`、`audit`
- `docker.yml` 文件头注释修改：commit `a075b16`（main 上 `b62e981`）
