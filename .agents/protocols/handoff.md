# Protocol: Handoff

> Agent 之间的交接必须通过**持久化文件**，不得只靠聊天。

---

## 1. 为什么需要 Handoff

Agent 会退出、重启、更换模型、更换工具。聊天上下文会丢失。

**若交接只存在于聊天中，协作状态就丢失了。**

因此：每一次角色/阶段交接，都必须写一个 Handoff 文件。

---

## 2. 位置

Handoff 存放在**任务目录内**：

```
projects/<name>/tasks/<state-dir>/<task-id>/handoffs/
└── HANDOFF-<seq>-<from-role>-to-<to-role>.md
```

示例：

```
handoffs/HANDOFF-001-product-to-architect.md
handoffs/HANDOFF-002-architect-to-developer.md
handoffs/HANDOFF-003-developer-to-reviewer.md
handoffs/HANDOFF-004-reviewer-to-developer.md   （FAIL 回退）
handoffs/HANDOFF-005-developer-to-reviewer.md
handoffs/HANDOFF-006-reviewer-to-done.md        （PASS）
```

### 为什么放在 Task 内？（方案对比）

| 方案 | 优势 | 劣势 |
|------|------|------|
| `.agents/state/handoffs/`（工作区级） | 跨项目交接集中可见 | 与 Task 上下文分离；目录随任务增多而膨胀；Task 归档后交接记录残留成孤儿 |
| **`tasks/<task>/handoffs/`（Task 内）** | Task 自包含；可整体移动/归档；Git 友好；无孤儿 | 无（跨项目交接极少，可另存 `state/`） |

**选择：Task 内。** 跨项目级别的交接（罕见）可单独放入 `.agents/state/`。

---

## 3. 命名规则

```
HANDOFF-<seq>-<from>-to-<to>.md
```

- `<seq>`：三位序号，从 `001` 开始，单调递增，不重复。
- `<from>` / `<to>`：角色名小写（`product` / `architect` / `developer` / `tester` / `reviewer` / `devops` / `researcher` / `security`）。

---

## 4. 必填字段

模板见 `templates/handoff/HANDOFF.md`。字段清单：

| 字段 | 说明 |
|------|------|
| **From** | 交出方（Agent 标识 + Role） |
| **To** | 接收方（Role） |
| **Task** | Task ID 与标题 |
| **Date** | 交接时间（ISO 8601） |
| **Current State** | 交接时的 Task 状态 |
| **Completed Work** | 已完成的工作（具体，非概括） |
| **Changed Files** | 变更文件清单（路径 + 变更类型） |
| **Tests** | 测试情况（命令 + 结果） |
| **Known Issues** | 已知问题（无则写"无"） |
| **Remaining Work** | 剩余工作 |
| **Assumptions** | 所做的假设 |
| **Risks** | 风险与缓解 |
| **Next Action** | 接收方的**第一个具体动作** |

---

## 5. 编写要求

### 必须

- **具体**：写"修改了 `src/auth/login.py` 第 42-58 行，提取了 token 校验函数"，
  而不是"改了一些认证代码"。
- **可执行**：`Next Action` 必须是接收方能**立刻开始**的动作。
- **诚实**：已知问题、未覆盖范围、假设必须如实写。
- **自包含**：接收方不需要读聊天记录就能理解。

### 禁止

- ❌ 空泛描述（"完成了相关工作"）
- ❌ 遗漏 Known Issues（无问题就明确写"无"）
- ❌ 隐含依赖聊天上下文（"如之前讨论的…"）
- ❌ `Next Action` 写成"继续"（必须具体）
- ❌ 交接时状态与 TASK.md 不一致

---

## 6. 交接时机

**必须**写 Handoff 的时机：

1. 阶段推进（如 Design → Implementation）
2. 阶段回退（如 Review FAIL → Developer）
3. 状态变更（如 ACTIVE → BLOCKED）
4. 角色切换
5. Agent 即将退出（即使任务未完成）

---

## 7. 交接检查清单

交出方：

- [ ] Handoff 文件已写入 `handoffs/`，序号正确
- [ ] `TASK.md` 的 Status / Assigned Role / Changed Files 已同步更新
- [ ] `Next Action` 具体可执行
- [ ] 文件已提交（若使用 Git）

接收方：

- [ ] 已读最新 Handoff
- [ ] 已读 `TASK.md`
- [ ] 已确认 `Next Action`
- [ ] 已确认自己具备该 Role 的权限（见 `permissions.md`）
- [ ] 若信息不足 → 写一个回退 Handoff，而不是猜测

---

## 8. 与聊天交接的关系

聊天**可以**用于讨论与澄清，但：

> **任何"正式的、需要被后续 Agent 依赖的"信息，必须落入 Handoff 文件。**

判定标准：如果这个信息丢失会导致后续 Agent 无法继续工作 → 它必须进文件。
