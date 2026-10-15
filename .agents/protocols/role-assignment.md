# Protocol: Role Assignment

> 定义"角色"与"Agent"的关系，以及在**可用 Agent 数量少于角色数量**时的分配规则。
> **核心：角色是帽子，不是进程。**

---

## 1. 问题

框架定义了 8 个 Role（见 `.agents/roles/README.md`），但现实中可用的 Agent 往往只有 1–3 个。
若把 Role 理解为"需要独立的 Agent 进程"，框架立刻不可用。

因此必须先澄清一个概念区分：

| 概念 | 是什么 | 数量 |
|------|--------|------|
| **Role** | 一套职责边界 + 权限边界 + 完成标准 | 框架固定 8 个 |
| **Agent** | 一个能读文件、执行动作的实体（模型 + 工具 + 会话） | 由你实际拥有几个决定 |

**Role 在实现上只是两样东西：**

1. 一份要读的文件 —— `.agents/roles/<role>.md`
2. 一行权限矩阵 —— `.agents/protocols/permissions.md` §2

所以"戴上帽子" = 加载上下文 + 声明角色 + 遵守对应权限。
**它不是启动一个新进程，也不是必须换一个模型。**

---

## 2. 两条不变量

无论你有 1 个还是 10 个 Agent，以下两条永远成立。

### I1 — 同一时刻，一个 Agent 只戴一顶帽子

不允许"一边实现一边批准自己"。若同一 Agent 需要扮演第二个 Role，
必须**显式切换**（写 Handoff，见 §5.2）。

### I2 — 实现者 ≠ 批准者

| 分离对 | 出处 |
|--------|------|
| 实现者 ≠ 批准者 | `permissions.md` §3 P3 |
| 修复者 ≠ 验证者（关键路径） | `permissions.md` §3 P3 |
| 部署者 ≠ 安全审批者 | `permissions.md` §3 P3 |

**这是框架里唯一无法通过"兼任"绕开的约束。**

> **为什么重要：** 审查的全部价值来自**独立性**。同一视角写完再批准自己，
> 审查就退化成自我确认。
>
> **实证（2026-09-17，business-manager 移植）：** 同一 Agent 连续两轮自查，
> 均漏掉了同一处缺陷（文档中的否定性断言在变更后失效）。
> 换视角逐条核对后才被发现。两轮"审查"的独立性是假的。

---

## 3. 角色家族

8 个 Role 按**介入时机**分成三个家族。
**同一家族内的角色天然可以顺次由同一个 Agent 扮演** —— 它们在同一阶段工作、共享同一份上下文。

| 家族 | 角色 | 介入时机 | 产物落点 |
|------|------|---------|---------|
| **设计族** | Product · Architect · Researcher | 动手之前 | `docs/requirements/`、`docs/architecture/` |
| **实现族** | Developer · DevOps | 动手之中 | `src/`、`tests/`、`scripts/` |
| **验证族** | Tester · Reviewer · Security | 动手之后 | 测试报告、Review 结论 |

**关键约束：验证族必须与实现族由不同的 Agent 扮演**（I2）。
设计族可与任一方合并。

---

## 4. 分配方案

### 4.1 最小可行配置（2 个 Agent）

| Agent | 家族 | 承担角色 |
|-------|------|---------|
| Agent-A | 设计 + 实现族 | Product · Architect · Researcher · Developer · DevOps |
| Agent-B | 验证族 | Tester · Reviewer · Security |

**2 个 Agent 是框架的下限。** 低于此值无法满足 I2（见 §4.3）。

### 4.2 推荐配置（3 个 Agent）

| Agent | 家族 | 承担角色 | 定位 |
|-------|------|---------|------|
| Agent-1 | 设计 + 实现族 | Product · Architect · Researcher · Developer · DevOps | 主力 |
| Agent-2 | 验证族 | Tester · Reviewer · Security | 独立审查，**不写业务代码** |
| Agent-3 | 机动 | 第二 Developer / 任一族替补 | 并行或顶替 |

**推荐长期把 Agent-2 设为"只审查、不实现"。** 它的全部价值在于视角独立；
一旦它下场写代码，就同时失去了审查那部分代码的资格（I2），
此时必须改由 Agent-3 审查该部分。

### 4.3 单 Agent 降级方案（1 个 Agent）

只有 1 个 Agent 时，I1 可以满足（全部串行），但 I2 **无法在同一会话内满足**。

**唯一补救：换一个全新会话扮演 Reviewer。**

- 新会话**不得**携带写代码时的上下文（新开对话，不续历史）。
- 新会话仍须先读 `TASK.md` + 最新 Handoff，再读代码。
- 若确实无法开新会话 → 该 Task **不得标记为 `DONE`**，
  且必须在 `TASK.md` 的 `Known Issues` 中显式记录
  「审查为自我审查，未经独立验证」。

> **原则：审查独立性靠"视角独立"，不是"进程独立"。**
> 换会话、换模型、换提示词都能达成；同会话自我确认则不能。

### 4.4 项目级覆盖

具体项目可在其 `AGENTS.md` 中声明自己的分配，
按 `rule-precedence.md` §6 显式标注：

```markdown
## Agent 分配

- [覆盖] `role-assignment.md` §4.2
- Agent-1 → Architect / Developer
- Agent-2 → Reviewer / Tester
- Agent-3 → Researcher / DevOps
```

**但 I1 / I2 不可被覆盖。** 它们来自 `permissions.md` §3 P3（职责分离），
**已列入 `rule-precedence.md` §2 的受保护规则表**，任何层级不得削弱。

---

## 5. 帽子如何切换

### 5.1 戴上

1. 读 `AGENTS.md`（Workspace 入口）→ 按 §4 顺序加载
2. 读 `projects/<name>/AGENTS.md`
3. 读 `tasks/<state>/<task-id>/TASK.md`
   （取 `Status` / `Owner` / `Assigned Role` / `File Scope` / Acceptance Criteria）
4. 读 `handoffs/` 中**序号最大**的文件
5. **声明角色**：把 `Assigned Role: <role>` 写入 `TASK.md`
6. 读 `.agents/roles/<role>.md`，并对照 `permissions.md` §2 确认权限边界

### 5.2 摘下（换帽子）

**每一次 Role 变更都必须写 Handoff 文件 —— 即使前后是同一个 Agent。**

- 文件：`handoffs/HANDOFF-<seq>-<from>-to-<to>.md`（命名见 `handoff.md` §3）
- 12 个必填字段见 `handoff.md` §4
- 同步更新 `TASK.md` 的 `Status` / `Assigned Role` / `Changed Files`
- 状态跨越目录边界时，**同时**移动 Task 目录（`task-lifecycle.md` §5）

**为什么同一 Agent 换帽子也要写？**

- 第二顶帽子可能在**另一个会话**里戴上，此时上下文已经丢失
- Handoff 是唯一能跨会话传递的信息载体（`handoff.md` §8）
- "清空上一顶帽子的立场"这件事，只有写下来才能被验证

---

## 6. 并行度

**并行度受耦合度限制，不受 Agent 数量限制。**（`collaboration.md` §7）

| 并行度 | 适用 |
|--------|------|
| 1 | 强耦合任务、同一模块大改 —— **默认，协调成本最低** |
| 2 | File Scope 不重叠的独立特性 |
| 3 | 仅在 File Scope 完全隔离时 |

**不要为了"用满 N 个 Agent"而并行。** 协调成本随并行度非线性增长。

并行时必须遵守的机制（`collaboration.md` §2）：

```
Task Ownership（Owner 字段）· File Scope 不重叠 · 每 Task 一分支 · Status 可见
```

> **注意：** 并行会把多个 Agent 同时变成"实现者"。
> 此时 I2 要求**至少留一个 Agent 不写代码**用于审查。
> 若全部下场实现，必须引入第 N+1 个 Agent，或使用 §4.3 的换会话方案。

---

## 7. 明确不做什么

为避免过度设计，本协议**刻意不引入**：

- ❌ 为每个 Role 启动独立进程 / 独立模型
- ❌ 角色调度器 / 编排器
- ❌ 强制"每个角色必须由不同 Agent 扮演"（仅 I2 的分离对强制）
- ❌ 把角色数量当作并行度上限

**理由：** Role 是**协作契约**，不是**资源单位**。
把它当资源单位会导致"为了 8 个角色去凑 8 个 Agent"，
与 `collaboration.md` §9「避免过度设计」的原则相悖。

---

## 8. 速查

```
本次任务需要哪些 Role？
   ↓
I2 检查：是否存在"实现者 = 批准者"？
   ├─ 是 → 必须换 Agent（或换会话，§4.3）
   └─ 否 ↓
其余 Role 按家族就近合并给同一个 Agent（§3）
   ↓
每次 Role 变更 → 写 Handoff（§5.2）
   ↓
并行？→ 先确认还有 Agent 没下场写代码（§6）
```

---

*相关：`roles/README.md`（角色职责）· `permissions.md`（角色权限）·
`collaboration.md`（并行冲突）· `handoff.md`（交接格式）·
`task-lifecycle.md`（状态机）*
