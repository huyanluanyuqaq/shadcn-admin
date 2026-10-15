# Roles — 角色系统

角色定义 Agent 在协作中的**职责边界、输入输出、权限与完成标准**。

## 角色清单

| Role | 文件 | 核心职责 | 关键限制 |
|------|------|---------|---------|
| Architect | `architect.md` | 需求 → 技术设计 | 不写业务代码 |
| Developer | `developer.md` | 按设计实现 | 不擅自改设计 |
| Reviewer | `reviewer.md` | 独立审查，给 PASS/FAIL | 不批准自己的实现 |
| Tester | `tester.md` | 验证行为符合验收标准 | 不修产品代码 |
| DevOps | `devops.md` | 构建 / 部署 / 运维 | 生产部署需人类批准 |
| Researcher | `researcher.md` | 产出事实与证据 | 不产出未证实结论 |
| Product | `product.md` | 澄清需求与验收标准 | 不做技术设计 |
| Security | `security.md` | 安全审查 | 不修代码；可否决削弱安全的变更 |

## 使用规则

1. **每个 Agent 在开始工作时必须声明当前 Role。**
2. 一个 Agent 在**同一时刻只扮演一个 Role**。
3. **职责分离**：实现者不得批准自己的实现（Developer ≠ Reviewer）。
4. Role 权限的通用模型见 `.agents/protocols/permissions.md`。
5. 若任务需要多个 Role，通过 Handoff 依次切换，并在 Handoff 中记录 Role 变更。
6. **Role 与 Agent 不是一对一关系** —— 一个 Agent 可依次扮演多个 Role。
   分配规则（角色家族、2 Agent 最小配置、1 Agent 降级方案）见
   `.agents/protocols/role-assignment.md`。

## 为什么是这 8 个角色？

- 需求侧：**Product**（澄清）+ **Researcher**（调研）
- 设计侧：**Architect**
- 实现侧：**Developer**
- 验证侧：**Tester**（行为）+ **Reviewer**（质量）+ **Security**（安全）
- 交付侧：**DevOps**

Frontend / Backend / Database / Release 等属于**项目级或任务级专精**，
不纳入 Workspace 通用角色，避免角色膨胀。
