# Workflow: Refactor

> 改善内部结构，**不改变外部可观察行为**。

---

## 阶段序列

```
Analyze → Plan → Refactor → Test → Review
```

---

## 核心前提

> **重构不改变外部行为。** 若需要改变行为，那不是重构，应拆成 `feature` 或 `bugfix` 任务。

必须存在**行为基线**（现有测试 / 特征测试 / 契约测试）作为重构的安全网。
若基线不存在，**先补测试**再重构。

---

## 阶段定义

### 1. Analyze

| 项 | 内容 |
|----|------|
| 负责 Role | Architect / Developer |
| 输入 | 现有代码 |
| 产出 | 现状分析：坏味道、耦合点、风险区域 |
| 完成条件 | 明确"要改什么"和"为什么改" |
| Handoff | → Architect |

### 2. Plan

| 项 | 内容 |
|----|------|
| 负责 Role | Architect |
| 输入 | 分析结果 |
| 产出 | 重构计划（分步骤、可小步提交）、行为基线确认 |
| 完成条件 | 每一步都可独立验证；存在行为基线 |
| Handoff | → Developer |

> **大规模重构属于高风险操作**，需按 `.agents/protocols/change-safety.md` 处理：
> 说明 → 备份 → 批准 → 执行 → 验证。

### 3. Refactor

| 项 | 内容 |
|----|------|
| 负责 Role | Developer |
| 输入 | 重构计划 |
| 产出 | 重构后的代码（行为不变） |
| 完成条件 | 小步提交；每步行为基线通过 |
| Handoff | → Tester |

### 4. Test

| 项 | 内容 |
|----|------|
| 负责 Role | Tester |
| 输入 | 重构结果 |
| 产出 | 行为一致性验证报告 |
| 完成条件 | 全部行为基线通过；无行为漂移 |
| Handoff | → Reviewer |

### 5. Review

| 项 | 内容 |
|----|------|
| 负责 Role | Reviewer |
| 输入 | 重构 + 验证结果 |
| 产出 | PASS / FAIL |
| 完成条件 | 结构确有改善；行为确实未变；无顺带功能变更 |
| Handoff | PASS → Done |

---

## 状态转换

```
READY → ACTIVE → REVIEW → DONE
REVIEW → CHANGES_REQUESTED → ACTIVE
ACTIVE → TEST_FAILED → ACTIVE      （行为漂移）
```

## 异常与回退

| 情形 | 处理 |
|------|------|
| 无行为基线 | 先补测试（作为前置 Task） |
| 出现行为漂移 | 状态 → `TEST_FAILED`，回 Developer |
| 发现必须改行为 | 拆分新 Task，走 `feature` / `bugfix` |
| 范围失控 | 状态 → `BLOCKED`，回 Architect 重划范围 |

## 示例 TASK.md 字段

```yaml
Workflow: refactor
Assigned Role: Developer
Status: ACTIVE
Behavior Baseline: tests/contract/ 全部通过
```
