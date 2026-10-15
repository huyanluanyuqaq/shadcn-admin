# Workflows — 工作流系统

工作流定义**角色之间的编排顺序**。每个 Task 在 `TASK.md` 中声明其 Workflow。

## 工作流清单

| Workflow | 文件 | 适用场景 | 阶段序列 |
|----------|------|---------|---------|
| Feature | `feature.md` | 新增功能 | Requirement → Design → Implement → Test → Review → Done |
| Bugfix | `bugfix.md` | 修复缺陷 | Reproduce → Diagnose → Fix → Regression → Review → Done |
| Refactor | `refactor.md` | 行为不变的重构 | Analyze → Plan → Refactor → Test → Review |
| Research | `research.md` | 调研与决策支持 | Question → Research → Evidence → Analysis → Recommendation |
| Release | `release.md` | 发布上线 | Prepare → Verify → Build → Deploy → Observe → Record |

## 通用约定

1. **每个阶段结束必须写 Handoff**（见 `.agents/protocols/handoff.md`）。
2. **阶段回退**是正常流程，不是失败。回退时必须写 Handoff 说明原因。
3. Task 的 `Workflow` 字段决定采用哪条流程。
4. 若任务同时具备多种性质（如"重构 + 修 bug"），**拆分为多个 Task**，不要混合流程。

## 选择指南

```
新增能力？           → feature
已有行为出错？       → bugfix
行为不变、改善结构？ → refactor
需要事实与证据？     → research
把已验证的成果发布？ → release
```
