# HANDOFF-001 — 主控位 → 执行位

> TASK-039 首次交接：任务定义完成，派遣执行位实施。

---

## Meta

```yaml
From: 主控位 Coordinator（本会话）
To: 执行位 Implementer
Task: TASK-039 — 接入 Workspace 模板仓库双 Agent 协作框架
Date: 2026-10-15T23:40:00Z
Current State: ACTIVE
Previous Handoff: 无（首个交接）
```

---

## Completed Work

- 完成迁移前 Inspect（只读，符合 `project-adoption.md` §4）：
  - 模板仓库 `projects/_workspace-template/` 结构完整（`.agents/`、`templates/`、`shared/`、`AGENTS.md`、`README.md`、`.gitignore`），本地 Git 干净；
  - 模板与 Workspace 根资产 `diff -r` 一致（仅模板多 `shared/scripts/create_from_template.py`）；
  - 本仓库**无** `.agents/`、`templates/`；`shared/` 为 pnpm 包 `@repo/shared`（与模板 `shared/` 同名不同义）；
  - 全库检索 `.agents/` 相关表述，定位 6 处待防腐修正位置（AGENTS.md §4/§9/§10/§12/§14.2、README.md、docs/agent-collaboration.md、docs/operations/github-capability.md、docs/operations/agent-constraints.md、docs/operations/negative-assertion-review.md C9/C4）。
- 确认接入方式：`project-adoption.md`（只加不改）；`create_from_template.py` 不适用（为从零建项目设计）。
- 确认编号：TASK-039（038 已由模板仓库任务占用）。
- 确认 D13-C 承载：本地 `main`（`da98560`）领先 `origin/main`（`7fa8da8`）两个提交（`6d8c731` + `da98560`，TASK-037 归档回写），按 `github.md` §2 豁免随本分支推送。
- 分支 `chore/TASK-039-adopt-workspace-framework` 已从本地 `main` 派生；任务档案已登记于 `tasks/active/TASK-039-adopt-workspace-framework/`。

## Changed Files

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `tasks/active/TASK-039-adopt-workspace-framework/TASK.md` | 新增 | 任务定义（唯一事实来源） |
| `tasks/active/TASK-039-adopt-workspace-framework/handoffs/HANDOFF-001-coordinator-to-implementer.md` | 新增 | 本交接记录 |

## Tests

```yaml
命令: 无（纯登记，无代码变更）
结果: 不适用
覆盖: 不适用
未覆盖: 不适用
```

## Known Issues

- 无（登记阶段）。

## Remaining Work

- Implementation Plan 步骤 2–9：复制框架资产 → 验证 → 文档防腐 → 门禁扩展 → 本地全量验证 → 提交/PR → 两轮独立审查 → 合并收尾。

## Assumptions

- 用户指令「将项目整体框架改造成模板仓库双 agent 协作框架」= 将模板仓库的框架资产整体接入本仓库（逐字快照 + 项目侧适配），而非把本仓库改成 Workspace 根（工作空间根不做 git init 的裁定仍然有效）。
- `shared/` 框架资产采用**合并**进既有 pnpm 包目录的方案（理由见 TASK.md Notes：保住 `shared/scripts/...` 路径引用，使框架自检 A2 可通过）。

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `shared/` 合并后 pnpm 包行为变化 | 构建/测试失败 | 复制后立即 `pnpm build:shared` 冒烟；只追加子目录，不动既有文件 |
| 框架自检 A7 在项目根扫到既有文件的疑似凭据 | CI/本地审计 FAIL | 实施时实跑定位；若为既有内容，评估后处置并如实登记，不修改框架脚本 |
| 分支携带 TASK-037 回写两提交 | PR diff 混入非本任务内容 | D13-C 明文豁免（范围仅 `tasks/**`）；PR 描述中显式披露 |

## Next Action

执行位按 Implementation Plan 步骤 2 实施：从 `projects/_workspace-template/` 复制 `.agents/` 与 `templates/`，
合并 `shared/{scripts,tools,knowledge}` + `shared/README.md`，随后立即执行 `diff -r` 验证与 `pnpm build:shared` 冒烟。

## References

- 任务定义：`tasks/active/TASK-039-adopt-workspace-framework/TASK.md`
- 接入协议：`.agents/protocols/project-adoption.md`（模板仓库内，复制后本仓库亦有）
- 模板仓库：`projects/_workspace-template/`（TASK-038 交付）
- 用户指令（2026-10-15）：进入项目 shadcn，将项目整体框架改造成 project 目录下模板仓库双 agent 协作框架
