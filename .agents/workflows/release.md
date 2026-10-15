# Workflow: Release

> 把已验证的成果发布。**部署是高风险操作，受额外约束。**

---

## 阶段序列

```
Prepare → Verify → Build → Deploy → Observe → Record
```

---

## 核心约束

> 发布涉及生产环境，属于**高风险操作**。
> 生产部署必须遵循 `.agents/protocols/change-safety.md`：说明 → 备份 → 批准 → 执行 → 验证。

---

## 阶段定义

### 1. Prepare

| 项 | 内容 |
|----|------|
| 负责 Role | DevOps |
| 输入 | 已 PASS 的变更集 |
| 产出 | 发布计划（版本、范围、时间、回滚方案） |
| 完成条件 | 回滚方案已定义；发布范围明确 |
| Handoff | → DevOps |

### 2. Verify

| 项 | 内容 |
|----|------|
| 负责 Role | Tester / Reviewer |
| 输入 | 变更集 |
| 产出 | 发布前验证结论 |
| 完成条件 | 全部测试通过；Review 已 PASS；无未缓解的 BLOCKER |
| Handoff | → DevOps |

### 3. Build

| 项 | 内容 |
|----|------|
| 负责 Role | DevOps |
| 输入 | 已验证的代码 |
| 产出 | 可复现的构建产物 |
| 完成条件 | 构建可复现；无硬编码密钥 |
| Handoff | → DevOps |

### 4. Deploy

| 项 | 内容 |
|----|------|
| 负责 Role | DevOps |
| 输入 | 构建产物 |
| 产出 | 部署结果 |
| 完成条件 | 开发/测试环境自动部署；**生产环境需人类批准** |
| Handoff | → DevOps |

### 5. Observe

| 项 | 内容 |
|----|------|
| 负责 Role | DevOps |
| 输入 | 部署结果 |
| 产出 | 观测数据（日志 / 指标 / 告警） |
| 完成条件 | 关键指标正常；无异常告警 |
| Handoff | → DevOps |

### 6. Record

| 项 | 内容 |
|----|------|
| 负责 Role | DevOps |
| 输入 | 观测结果 |
| 产出 | 发布记录（`docs/operations/`） |
| 完成条件 | 版本、时间、变更摘要、结果、回滚方式已记录 |
| Handoff | → Done |

---

## 状态转换

```
READY → ACTIVE → REVIEW → DONE
ACTIVE → BLOCKED → ACTIVE           （验证未通过）
ACTIVE → TEST_FAILED → ACTIVE       （构建/测试失败）
```

## 异常与回退

| 情形 | 处理 |
|------|------|
| 验证未通过 | 状态 → `BLOCKED`，回 Developer |
| 生产部署后指标异常 | 立即执行回滚方案；记录事件 |
| 无回滚方案 | **不得部署**，回到 Prepare |
| 需要人类批准但未获批 | 状态 → `BLOCKED`，等待 |

## 发布记录最小字段

```
版本 / 时间 / 变更摘要 / 环境 / 执行人(Agent+Role) / 结果 / 回滚方式 / 异常
```

## 示例 TASK.md 字段

```yaml
Workflow: release
Assigned Role: DevOps
Status: ACTIVE
Requires Human Approval: true
```
