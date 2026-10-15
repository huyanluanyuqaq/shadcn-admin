# Workflow: Research

> 产出**事实、证据、分析**。不产出未经证实的结论。

---

## 阶段序列

```
Question → Research → Evidence → Analysis → Recommendation
```

---

## 核心原则

> Researcher 输出的是**分析**，不是**主张**。
> 每一个结论都必须能追溯到证据；每一个推断都必须被标注为推断。

---

## 阶段定义

### 1. Question

| 项 | 内容 |
|----|------|
| 负责 Role | Researcher / Product |
| 输入 | 模糊问题 |
| 产出 | 可回答的子问题清单 |
| 完成条件 | 每个子问题都有明确的"回答形式" |
| Handoff | → Researcher |

> 不可回答的问题（如"哪个更好？"）必须转化为可回答形式（如"在 X 约束下，A 与 B 在 Y 指标上的对比"）。

### 2. Research

| 项 | 内容 |
|----|------|
| 负责 Role | Researcher |
| 输入 | 子问题 |
| 产出 | 原始证据（来源 + 时间 + 可信度） |
| 完成条件 | 证据足以支撑分析；来源已记录 |
| Handoff | → Researcher（继续分析） |

### 3. Evidence

| 项 | 内容 |
|----|------|
| 负责 Role | Researcher |
| 输入 | 原始证据 |
| 产出 | 证据清单（分类：事实 / 推断 / 假设 / 未知） |
| 完成条件 | 每条结论都有来源或明确标注为推断 |
| Handoff | → Researcher（继续分析） |

### 4. Analysis

| 项 | 内容 |
|----|------|
| 负责 Role | Researcher |
| 输入 | 证据清单 |
| 产出 | 分析：方案对比、取舍、不确定性 |
| 完成条件 | 列出反例与不确定性；提供多方案对比 |
| Handoff | → 决策方 |

### 5. Recommendation

| 项 | 内容 |
|----|------|
| 负责 Role | Researcher（或 Architect 决策） |
| 输入 | 分析 |
| 产出 | 建议（附置信度与适用条件） |
| 完成条件 | 建议明确可执行；不确定性已标注 |
| Handoff | → Architect / Product / 人类 |

---

## 状态转换

```
READY → ACTIVE → REVIEW → DONE
ACTIVE → BLOCKED → ACTIVE           （证据不可得）
ACTIVE → REQUIREMENT_CHANGED → DESIGN   （问题本身需重构）
```

## 异常与回退

| 情形 | 处理 |
|------|------|
| 问题不可回答 | 回 Question 阶段重新拆解 |
| 证据不足 | 状态 → `BLOCKED`，说明缺失项 |
| 证据互相矛盾 | 在 Analysis 中如实呈现冲突，不强行统一 |
| 需要实测才能回答 | 产出"需要原型验证"的建议，另开 Task |

## 证据可信度分级

| 级别 | 含义 |
|------|------|
| A | 一手实测 / 官方文档 / 权威规范 |
| B | 二手可靠来源 / 多源交叉印证 |
| C | 单一来源 / 时效存疑 |
| D | 推测 / 无来源 —— 必须标注为推断 |

## 示例 TASK.md 字段

```yaml
Workflow: research
Assigned Role: Researcher
Status: ACTIVE
```
