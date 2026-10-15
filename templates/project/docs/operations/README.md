# operations — 运维文档

存放部署、监控、故障处理相关文档。由 **DevOps** 维护。

## 内容

| 文件 | 内容 |
|------|------|
| `deployment.md` | 部署流程与环境说明 |
| `monitoring.md` | 监控指标与告警 |
| `runbook.md` | 常见故障处理手册 |
| `releases.md` | 发布记录 |
| `agent-constraints.md` | **受保护约束摘要**（Standalone 模式必需） |

## 写作要求

- **可执行**：读者能照着文档完成操作。
- **包含回滚**：每个部署流程必须有回滚步骤。
- **无密钥**：不写具体的密码/令牌，只写获取方式。
- **记录发布**：每次发布在 `releases.md` 留记录。

## agent-constraints.md 的作用

项目被单独 clone 后（Standalone 模式），Workspace 的 `.agents/rules/security.md`
与 `.agents/protocols/change-safety.md` 不可用。
`agent-constraints.md` 保存了这些**受保护规则的要点摘要**，
确保即使脱离 Workspace，核心安全约束仍然有效。

> ⚠️ **`agent-constraints.md` 属于受保护内容，不得被项目或 Task 规则削弱。**
