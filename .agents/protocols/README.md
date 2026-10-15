# Protocols — 协作协议

协议定义 Agent 之间**如何协作**的规则，比普通规则更接近机制层。

## 协议清单

| 协议 | 文件 | 作用 |
|------|------|------|
| 规则优先级 | `rule-precedence.md` | 定义规则继承与冲突裁决（双轴模型） |
| 任务生命周期 | `task-lifecycle.md` | 定义 Task 结构、状态机与生命周期操作 |
| 交接协议 | `handoff.md` | 定义 Agent 间持久化交接的格式与时机 |
| 多 Agent 协作 | `collaboration.md` | 定义并行协作的冲突解决（轻量机制） |
| 权限模型 | `permissions.md` | 定义角色权限矩阵与权限原则 |
| 角色分配 | `role-assignment.md` | 定义角色与 Agent 的关系（**角色是帽子，不是进程**） |
| 变更安全 | `change-safety.md` | 定义高风险操作的强制流程（**受保护**） |
| 项目接入 | `project-adoption.md` | 把既有项目接入 Workspace（只加不改） |
| 双 Agent 模型 | `dual-agent-model.md` | 定义主控位 / 执行位两个**协作位**及其职责与证据 |
| GitHub 协作 | `github-collaboration.md` | 定义以 GitHub 为载体的端到端 10 阶段流程 |
| 平台能力矩阵 | `github-capability-matrix.md` | 区分「文档要求 / 平台强制 / 自动化能做到」 |

## 受保护协议

以下协议属于**受保护规则**，任何层级不得削弱：

- `change-safety.md` —— 高风险操作流程
- `rule-precedence.md` —— 其中关于"受保护规则不可削弱"的定义
- `permissions.md` —— **仅 §3 P3 职责分离**（其余部分可被项目覆盖）

## 使用顺序

Agent 通常在以下时机查阅协议：

```
分配工作时  → role-assignment.md（角色 → Agent 映射）
            → dual-agent-model.md（协作位与独立性约束）
开始任务前  → rule-precedence.md（确认规则层级）
            → permissions.md（确认权限边界）
执行任务中  → task-lifecycle.md（状态变更）
            → change-safety.md（高风险操作）
交接时      → handoff.md
并行工作时  → collaboration.md
使用 GitHub  → github-collaboration.md（流程）
            → github-capability-matrix.md（平台能强制什么）
接入既有项目 → project-adoption.md
```
