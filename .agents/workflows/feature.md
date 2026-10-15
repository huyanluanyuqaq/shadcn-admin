# Workflow: Feature

> 新增功能的标准流程。这是框架的**核心工作流**。

---

## 阶段序列

```
Requirement → Design → Implementation → Test → Review → Done
```

---

## 参与角色与交接

```
Product / 人类
     │ 需求
     ▼
Architect                    ── Design 阶段
     │ Handoff: 设计文档 + 任务拆分
     ▼
Developer                    ── Implementation 阶段
     │ Handoff: 变更 + 测试 + 自检结果
     ▼
Tester                       ── Test 阶段
     │ Handoff: 测试报告
     ▼
Reviewer                     ── Review 阶段
     │
     ├─ PASS  → Done
     └─ FAIL  → CHANGES_REQUESTED → 回 Developer
```

---

## 阶段定义

### 1. Requirement

| 项 | 内容 |
|----|------|
| 负责 Role | Product（或人类直接提供） |
| 输入 | 需求描述 |
| 产出 | `docs/requirements/` 更新 + Acceptance Criteria |
| 完成条件 | 需求无重大歧义；验收标准可判定 |
| Handoff | → Architect |

### 2. Design

| 项 | 内容 |
|----|------|
| 负责 Role | Architect |
| 输入 | 需求文档 |
| 产出 | 设计文档（`docs/architecture/`）、接口契约、任务拆分、必要时 ADR |
| 完成条件 | 设计可执行；接口明确；风险已列出 |
| Handoff | → Developer |

### 3. Implementation

| 项 | 内容 |
|----|------|
| 负责 Role | Developer |
| 输入 | 设计文档 + TASK.md |
| 产出 | 代码 + 测试 + 技术文档更新 |
| 完成条件 | 构建通过、测试通过、静态检查通过 |
| Handoff | → Tester |

### 4. Test

| 项 | 内容 |
|----|------|
| 负责 Role | Tester |
| 输入 | 实现 + Acceptance Criteria |
| 产出 | 测试报告 |
| 完成条件 | 用例覆盖正常/边界/异常；结果如实记录 |
| Handoff | → Reviewer（或 → Developer，若失败） |

### 5. Review

| 项 | 内容 |
|----|------|
| 负责 Role | Reviewer（涉及安全时叠加 Security） |
| 输入 | 全部交付物 |
| 产出 | PASS / FAIL 结论 |
| 完成条件 | 逐条核验 Acceptance Criteria；安全已检查 |
| Handoff | PASS → 下一环节；FAIL → Developer |

### 6. Done

| 项 | 内容 |
|----|------|
| 负责 Role | — |
| 动作 | Task 目录移入 `tasks/done/`，Status 设为 `DONE` |
| 完成条件 | 满足 `AGENTS.md` §13 的 Definition of Done |

---

## 状态转换

```
READY → ACTIVE → REVIEW → DONE                  （正常路径）
REVIEW → CHANGES_REQUESTED → ACTIVE             （Review 未通过）
ACTIVE → TEST_FAILED → ACTIVE                   （测试失败）
ACTIVE → BLOCKED → ACTIVE                       （受阻后解除）
ACTIVE → REQUIREMENT_CHANGED → DESIGN           （需求变更，回 Architect）
ACTIVE → DESIGN                                 （Developer 发现设计不可行）
```

## 异常与回退

| 情形 | 处理 |
|------|------|
| Developer 发现设计不可行 | Handoff → Architect，状态 → `DESIGN` |
| 测试失败 | 状态 → `TEST_FAILED`，Handoff → Developer |
| Review FAIL | 状态 → `CHANGES_REQUESTED`，Handoff → Developer |
| 需求中途变更 | 状态 → `REQUIREMENT_CHANGED`，回 Architect 重新设计 |
| 发现安全问题 | Security 介入；必要时状态 → `BLOCKED` |

## 示例 TASK.md 字段

```yaml
Workflow: feature
Assigned Role: Developer
Status: ACTIVE
```
