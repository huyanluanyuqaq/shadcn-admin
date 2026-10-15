# Workflow: Bugfix

> 修复缺陷。核心是**先复现、再定位、后修复**。

---

## 阶段序列

```
Reproduce → Diagnose → Fix → Regression Test → Review → Done
```

---

## 阶段定义

### 1. Reproduce

| 项 | 内容 |
|----|------|
| 负责 Role | Developer / Tester |
| 输入 | 缺陷报告 |
| 产出 | 最小重现步骤 + 复现结果 |
| 完成条件 | 能稳定复现，或有明确证据说明为何偶发 |
| Handoff | → Developer |

> **未复现不得进入 Fix。** 若无法复现，必须记录已尝试的手段并回退要求补充信息。

### 2. Diagnose

| 项 | 内容 |
|----|------|
| 负责 Role | Developer（复杂时 Researcher 协助） |
| 输入 | 重现步骤 |
| 产出 | 根因分析（Root Cause） |
| 完成条件 | 根因明确，或列出候选根因与验证方式 |
| Handoff | → Developer（继续修复） |

> **禁止"碰巧改好"。** 必须能解释为什么这个改动消除了根因。

### 3. Fix

| 项 | 内容 |
|----|------|
| 负责 Role | Developer |
| 输入 | 根因 |
| 产出 | 修复代码 + 针对性测试 |
| 完成条件 | 缺陷不再复现；最小改动 |
| Handoff | → Tester |

### 4. Regression Test

| 项 | 内容 |
|----|------|
| 负责 Role | Tester |
| 输入 | 修复 |
| 产出 | 回归测试报告 |
| 完成条件 | 缺陷已修复；相关功能未回归 |
| Handoff | → Reviewer |

### 5. Review

| 项 | 内容 |
|----|------|
| 负责 Role | Reviewer |
| 输入 | 修复 + 回归结果 |
| 产出 | PASS / FAIL |
| 完成条件 | 修复正确、无副作用、根因已消除 |
| Handoff | PASS → Done；FAIL → Developer |

---

## 状态转换

```
READY → ACTIVE → REVIEW → DONE
REVIEW → CHANGES_REQUESTED → ACTIVE
ACTIVE → BLOCKED → ACTIVE          （无法复现时可能阻塞）
```

## 异常与回退

| 情形 | 处理 |
|------|------|
| 无法复现 | 状态 → `BLOCKED`，回退要求补充信息 |
| 根因指向设计缺陷 | 转为 `feature` 流程或回 Architect |
| 修复引入新问题 | 状态 → `TEST_FAILED`，回 Developer |
| 缺陷涉及安全 | Security 介入 |

## 缺陷报告最小字段

```
标题 / 现象 / 期望 / 最小重现步骤 / 环境 / 严重程度 / 影响范围
```

## 示例 TASK.md 字段

```yaml
Workflow: bugfix
Assigned Role: Developer
Status: ACTIVE
```
