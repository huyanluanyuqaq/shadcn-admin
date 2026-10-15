# tasks — 任务协作单元

本目录存放项目的所有 Task。**每个 Task 是一个自包含目录。**

## 结构

```
tasks/
├── backlog/   ← 尚未开始（BACKLOG / READY）
├── active/    ← 正在工作（ACTIVE / DESIGN / BLOCKED / CHANGES_REQUESTED / TEST_FAILED / REQUIREMENT_CHANGED）
├── review/    ← 等待/正在审查（REVIEW）
└── done/      ← 已完成（DONE）
```

## Task 目录结构

```
tasks/<state-dir>/TASK-XXX-<slug>/
├── TASK.md          ← 任务定义 + 当前状态（唯一事实来源）
└── handoffs/        ← Agent 交接记录
    ├── HANDOFF-001-<from>-to-<to>.md
    └── ...
```

## 创建 Task

```bash
mkdir -p tasks/backlog/TASK-001-my-feature/handoffs
cp <workspace>/templates/task/TASK.md tasks/backlog/TASK-001-my-feature/TASK.md
# 编辑 TASK.md，替换所有 {{...}}
```

> Standalone 模式下，若没有 Workspace 模板，可参考任意已有 Task 的 `TASK.md` 结构。

## Task ID 规范

```
TASK-<三位序号>-<短横线slug>
```

示例：`TASK-001-user-login`、`TASK-042-fix-cart-total`

## 状态与目录的对应

| 状态 | 目录 |
|------|------|
| BACKLOG, READY | `backlog/` |
| ACTIVE, DESIGN, BLOCKED, CHANGES_REQUESTED, TEST_FAILED, REQUIREMENT_CHANGED | `active/` |
| REVIEW | `review/` |
| DONE | `done/` |

> **细粒度状态记录在 `TASK.md` 的 `Status` 字段。**
> 目录只表达粗粒度阶段。变更状态时，两者都要更新。

## 规则

- 一个 Task 同一时刻只有一个 Owner。
- 接手前必须读完 `TASK.md` 与最新 Handoff。
- 每次交接必须写 Handoff 文件。
- 完成前必须满足 `AGENTS.md` 的 Definition of Done。

## 详细协议

Workspace 模式下见 `.agents/protocols/task-lifecycle.md` 与 `.agents/protocols/handoff.md`。
