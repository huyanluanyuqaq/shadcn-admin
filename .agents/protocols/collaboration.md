# Protocol: Multi-Agent Collaboration

> 多个 Agent 并行工作时的冲突解决机制。**优先使用轻量机制，不引入复杂锁系统。**

---

## 1. 典型并行场景

```
Architect
    ├── Developer A
    ├── Developer B
    └── Reviewer
```

同时工作。可能出现的问题：

| 问题 | 表现 |
|------|------|
| 文件冲突 | 两个 Agent 改同一文件 |
| Git 冲突 | 两个分支改同一处 |
| Task 冲突 | 两个 Agent 领取同一 Task |
| 状态竞争 | 同时修改 `TASK.md` |
| 重复工作 | 两人做同一件事 |
| 合并困难 | 变更范围重叠 |

---

## 2. 四层轻量机制

**不使用锁文件、不使用数据库、不使用调度器。** 用以下四个机制解决：

### 机制 1 — Task Ownership（任务所有权）

- 一个 Task **同一时刻只有一个 Owner**。
- 领取 Task 时，在 `TASK.md` 写入 `Owner` 与时间。
- 若 `Owner` 已被占用 → **不要抢**，选择其他 Task。
- Owner 变更必须通过 Handoff 显式交接。

```yaml
Owner: agent-claude-01
Owner Since: 2026-09-17T12:00:00+08:00
```

### 机制 2 — File Scope（文件范围）

- 每个 Task 在 `TASK.md` 中声明 `File Scope`：允许改动的路径。
- **不同 Task 的 File Scope 不应重叠。**
- 若必须重叠 → 拆分为有依赖关系的串行 Task，或明确协调顺序。

```yaml
File Scope:
  - src/auth/**
  - tests/auth/**
Non-Scope:
  - src/billing/**
```

### 机制 3 — Git Branch（分支隔离）

- 每个 Task 一个分支（命名见 `.agents/rules/git.md`）。
- 分支隔离使并行工作天然互不干扰。
- 合并到 `main` 前必须：Review PASS + 测试通过。

### 机制 4 — Status（状态可见）

- `TASK.md` 的 `Status` 字段表达 Task 当前占用状态。
- 任何 Agent 通过读取 `TASK.md` 即可知道该 Task 是否可动。
- 状态与目录位置必须一致（见 `task-lifecycle.md` §5）。

---

## 3. 冲突处理矩阵

| 冲突类型 | 检测方式 | 处理 |
|----------|---------|------|
| Task 冲突 | 读取 `TASK.md` 的 `Owner` | 后到者让路，选择其他 Task |
| 文件冲突 | File Scope 重叠检查 | 拆分或串行化 |
| Git 冲突 | 合并时发现 | 理解双方意图后解决；重跑测试 |
| 状态竞争 | 提交时发现 `TASK.md` 冲突 | 保留双方信息，人工合并字段 |
| 重复工作 | 定期读 `tasks/active/` | 发现重复 → 停止一方，合并成果 |

---

## 4. Git 冲突解决

**规则：**

1. **禁止盲目选择一边**（"ours" / "theirs"）。
2. 必须理解双方改动的**意图**。
3. 解决后**必须重新运行测试**。
4. 无法判断 → 向相关 Agent 或人类请求澄清。

**预防：**

- 小步提交、频繁同步主干。
- File Scope 不重叠。
- 保持分支生命周期短。

---

## 5. Shared Files 的处理

某些文件天然被多方需要（如 `README.md`、`TASK.md`、项目 `AGENTS.md`）。

**处理原则：**

- **`TASK.md`** —— 只有 Owner 修改。他人只读。
- **项目 `AGENTS.md`** —— 通过专门的 Task 修改，不随手改。
- **`README.md` / 文档** —— 尽量在各自 Task 内改不同章节；避免整篇重写。
- **锁文件 / 生成文件** —— 不手工编辑；由工具生成；必要时在合并时重新生成。

---

## 6. 依赖关系

Task 之间可有依赖：

```
TASK-001 (Architect 设计)
     │ blocks
     ▼
TASK-002 (Developer 实现)
     │ blocks
     ▼
TASK-003 (Reviewer 审查)
```

- 在 `TASK.md` 的 `Dependencies` 字段声明。
- **被阻塞的 Task 不得开始。**
- 阻塞解除后，状态从 `BLOCKED` → `ACTIVE`。

---

## 7. 并行度建议

| 并行度 | 适用 |
|--------|------|
| 1 | 强耦合任务、同一模块的大改 |
| 2–3 | 相对独立的特性 |
| > 3 | 仅在 File Scope 完全隔离时 |

**原则：** 并行度受**耦合度**限制，不受 Agent 数量限制。
宁少勿多 —— 协调成本随并行度非线性增长。

---

## 8. 每日同步（可选）

对于长期并行协作，可维护一个轻量的同步记录：

```
.agents/state/active-tasks.md
```

内容：当前 `active/` 中的所有 Task、Owner、状态、File Scope。
**这不是必须的** —— 直接读各项目的 `tasks/active/` 亦可。

---

## 9. 明确不做什么

为避免过度设计，框架**刻意不引入**：

- ❌ 锁文件 / 分布式锁
- ❌ 中央调度器 / Orchestrator
- ❌ 数据库 / 消息队列
- ❌ 心跳 / 租约机制
- ❌ 自动冲突合并

**理由：** 基于文件 + Git 分支 + Owner 字段的组合，已足以处理绝大多数冲突，
且完全透明、可调试、无额外依赖。若未来确实出现无法解决的竞争，再考虑增强。
