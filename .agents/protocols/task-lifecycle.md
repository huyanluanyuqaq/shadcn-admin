# Protocol: Task Lifecycle

> 定义 Task 的物理结构、状态机与生命周期操作。

---

## 1. Task 的物理结构

一个 Task = 一个**自包含目录**：

```
projects/<name>/tasks/<state-dir>/<task-id>/
├── TASK.md          # 任务定义 + 当前状态（唯一事实来源）
└── handoffs/        # 该任务的 Agent 交接记录
    ├── HANDOFF-001-product-to-architect.md
    ├── HANDOFF-002-architect-to-developer.md
    └── ...
```

**为什么 Task 是目录而非单文件？**

- 支持 Task 内 Handoff（自包含，随 Task 归档）。
- 可整体在状态目录间移动（`mv` 即状态变更的物理表达）。
- Git 友好。

---

## 2. 物理状态目录（4 个）

```
tasks/backlog/   →   tasks/active/   →   tasks/review/   →   tasks/done/
```

| 目录 | 含义 |
|------|------|
| `backlog/` | 尚未开始（含 `BACKLOG` 与 `READY`） |
| `active/` | 正在工作（含所有进行中状态） |
| `review/` | 等待审查 |
| `done/` | 已完成 |

**设计取舍：** 不为每个逻辑状态建目录 —— 那会导致目录爆炸。
目录只表达**粗粒度阶段**，细粒度状态由 `TASK.md` 的 `Status` 字段承载。

---

## 3. 逻辑状态机

### 状态清单

| 状态 | 所属目录 | 含义 |
|------|---------|------|
| `BACKLOG` | backlog/ | 已记录，未就绪 |
| `READY` | backlog/ | 已就绪，可被领取 |
| `ACTIVE` | active/ | 正在实现 |
| `DESIGN` | active/ | 正在设计（Architect 阶段） |
| `BLOCKED` | active/ | 受阻，无法推进 |
| `CHANGES_REQUESTED` | active/ | Review 未通过，待修改 |
| `TEST_FAILED` | active/ | 测试失败，待修复 |
| `REQUIREMENT_CHANGED` | active/ | 需求变更，待重新设计 |
| `REVIEW` | review/ | 等待/正在审查 |
| `DONE` | done/ | 已完成 |

### 状态转换图

```
                         ┌──────────────────────────────────────┐
                         │                                      │
  BACKLOG ──→ READY ──→ ACTIVE ──→ REVIEW ──→ DONE              │
                │         ▲  │        │                         │
                │         │  │        │                         │
                │         │  │        └──→ CHANGES_REQUESTED ───┤
                │         │  │                                   │
                │         │  └──────────→ TEST_FAILED ──────────┤
                │         │                                      │
                │         └───────────← BLOCKED                 │
                │                                                │
                └──→ DESIGN ──→ ACTIVE                           │
                          ▲                                      │
                          │                                      │
              REQUIREMENT_CHANGED ←──── ACTIVE ─────────────────┘
```

（CHANGES_REQUESTED / TEST_FAILED / REQUIREMENT_CHANGED 最终都回到 ACTIVE 或 DESIGN）

### 转换表

| From | To | 触发条件 | 执行者 |
|------|----|---------|-------|
| BACKLOG | READY | 需求清晰、依赖满足 | Product / Architect |
| READY | ACTIVE | 被领取并分配 Role | 领取者 |
| READY | DESIGN | 任务需要先设计 | Architect |
| DESIGN | ACTIVE | 设计完成 | Architect |
| ACTIVE | REVIEW | 实现完成，自检通过 | Developer |
| ACTIVE | DESIGN | Developer 发现设计不可行 | Developer |
| ACTIVE | BLOCKED | 遇到无法自行解决的阻碍 | 任意 |
| ACTIVE | TEST_FAILED | 测试失败 | Tester |
| ACTIVE | REQUIREMENT_CHANGED | 需求中途变更 | Product / 人类 |
| BLOCKED | ACTIVE | 阻碍已解除 | 解除者 |
| REVIEW | DONE | Review PASS | Reviewer |
| REVIEW | CHANGES_REQUESTED | Review FAIL | Reviewer |
| CHANGES_REQUESTED | ACTIVE | 开始修改 | Developer |
| TEST_FAILED | ACTIVE | 开始修复 | Developer |
| REQUIREMENT_CHANGED | DESIGN | 重新设计 | Architect |

### 终态

- `DONE` —— 唯一正常终态。
- Task 被取消时：Status 设为 `CANCELLED`，移入 `done/`（或项目自定义的 `cancelled/`），并记录取消原因。

---

## 4. 生命周期操作

### 创建 Task

```bash
mkdir -p projects/<name>/tasks/backlog/<task-id>/handoffs
cp templates/task/TASK.md projects/<name>/tasks/backlog/<task-id>/TASK.md
```

`<task-id>` 格式：`TASK-<三位序号>-<短横线slug>`，例如 `TASK-001-user-login`。

### 变更状态

**两步，缺一不可：**

1. 更新 `TASK.md` 的 `Status` 字段。
2. 将 Task 目录移动到对应的状态目录（若跨越粗粒度阶段）。

```bash
# 例：ACTIVE → REVIEW
mv projects/<name>/tasks/active/TASK-001-user-login \
   projects/<name>/tasks/review/TASK-001-user-login
# 并编辑 TASK.md: Status: REVIEW
```

> **注意：** 仅在 `backlog/` 与 `active/` 内部切换逻辑状态时，目录不动（两者都在 `active/`），只改 Status。

### 完成 Task

1. 确认满足 `AGENTS.md` §13 的 Definition of Done。
2. `TASK.md` 的 `Status` → `DONE`。
3. 目录移入 `tasks/done/`。
4. 确保所有 Handoff 已归档在 `handoffs/` 内。

---

## 5. 状态一致性检查

Agent 在接手 Task 前应验证：

- [ ] `TASK.md` 的 `Status` 与所在目录**一致**
- [ ] `TASK.md` 的 `Assigned Role` 明确
- [ ] 最新 Handoff 的 `Next Action` 明确
- [ ] 无未处理的阻塞项

**若发现不一致** → 不要自行"修正"猜测，先记录并请求澄清。

---

## 6. 并发保护

同一 Task 同一时刻只应有一个 Owner。领取 Task 时：

1. 检查 `TASK.md` 的 `Owner` 字段是否为空或为自己。
2. 若已被他人占用 → 不要抢，选择其他 Task。
3. 领取时写入自己的标识与时间。

> 框架**不引入复杂锁机制**。依靠 `Owner` 字段 + Git 分支隔离解决竞争。
> 详见 `.agents/protocols/collaboration.md`。
