# AGENTS.md — {{PROJECT_NAME}}

> 本项目级 Agent 入口协议。
> **两种工作模式：**
> - **Workspace 模式**（项目位于 Workspace 的 `projects/` 下）：本文件 + Workspace `AGENTS.md` + Task 规则共同生效。
> - **Standalone 模式**（项目被单独 clone，无 Workspace）：本文件 + Task 规则生效，见 §12。
>
> 替换所有 `{{...}}` 占位符后删除本提示块。

---

## 1. Project Identity

```yaml
Project: {{PROJECT_NAME}}
Slug: {{project-slug}}
Version: {{0.1.0}}
Status: {{planning|active|maintenance|archived}}
Owner: {{owner}}
Repository: {{git remote url or "local only"}}
Created: {{YYYY-MM-DD}}
```

---

## 2. Project Purpose

> 一句话说明本项目要解决什么问题。

{{PROJECT_DESCRIPTION}}

**目标用户：** {{目标用户}}

**核心价值：** {{核心价值}}

---

## 3. Technology Stack

> 本项目的具体技术选型。**这些内容属于项目层，不出现在 Workspace 层。**

| 类别 | 选型 |
|------|------|
| 语言 | {{如：Python 3.13}} |
| 框架 | {{如：FastAPI}} |
| 数据库 | {{如：PostgreSQL 16}} |
| 前端 | {{如：React + TypeScript}} / 无 |
| 测试框架 | {{如：pytest}} |
| 构建工具 | {{如：uv / poetry}} |
| 容器化 | {{如：Docker}} / 无 |
| CI/CD | {{如：GitHub Actions}} / 无 |

**核心依赖：**

| 依赖 | 版本 | 用途 |
|------|------|------|
| {{dependency}} | {{version}} | {{purpose}} |

---

## 4. Project Structure

```
{{project-slug}}/
├── AGENTS.md          ← 本文件
├── README.md
├── docs/
│   ├── requirements/  ← 需求
│   ├── architecture/  ← 架构
│   ├── technical/     ← 技术实现
│   ├── decisions/     ← ADR
│   └── operations/    ← 部署与运维
├── tasks/
│   ├── backlog/
│   ├── active/
│   ├── review/
│   └── done/
├── src/               ← 源代码
├── tests/             ← 测试
└── scripts/           ← 项目脚本
```

**关键目录说明：**

| 目录 | 用途 |
|------|------|
| `src/` | {{源代码组织方式，如"按功能分包"}} |
| `tests/` | {{测试组织方式，如"与 src 镜像"}} |
| `scripts/` | {{项目专用脚本}} |

---

## 5. Development Commands

```bash
# 安装依赖
{{install command, e.g. uv sync}}

# 本地运行
{{run command, e.g. uv run uvicorn app.main:app --reload}}

# 代码格式化
{{format command, e.g. ruff format .}}

# 静态检查
{{lint command, e.g. ruff check .}}

# 类型检查（如适用）
{{typecheck command, e.g. mypy src/}}
```

---

## 6. Testing Commands

```bash
# 运行全部测试
{{test command, e.g. uv run pytest}}

# 运行单个测试文件
{{e.g. uv run pytest tests/test_auth.py}}

# 运行单个测试
{{e.g. uv run pytest tests/test_auth.py::test_login_rejects_expired}}

# 覆盖率
{{e.g. uv run pytest --cov=src}}
```

**测试要求：** {{如：新功能必须附带测试；覆盖率不低于 X%}}

---

## 7. Build Commands

```bash
# 构建产物
{{build command, e.g. uv build}}

# 构建容器镜像（如适用）
{{e.g. docker build -t {{project-slug}}:latest .}}
```

---

## 8. Deployment Commands

```bash
# 部署到开发环境
{{dev deploy command}}

# 部署到生产环境（需人类批准，见 change-safety）
{{prod deploy command}}
```

**部署约束：** {{如：生产部署需人类批准；必须可回滚}}

---

## 9. Documentation Locations

| 文档类型 | 位置 |
|----------|------|
| 需求文档 | `docs/requirements/` |
| 架构文档 | `docs/architecture/` |
| 技术文档 | `docs/technical/` |
| 架构决策记录 | `docs/decisions/` |
| 运维文档 | `docs/operations/` |
| 任务 | `tasks/` |

**写文档前请先读：** `.agents/rules/documentation.md`（Workspace 模式）或本文件 §11（Standalone 模式）。

---

## 10. Project-specific Rules

> 本节声明本项目对 Workspace 通用规则的**补充、覆盖、增强**。
> 格式见 `.agents/protocols/rule-precedence.md` §6。
> **不得削弱受保护规则（security / change-safety / git 禁止操作 / testing 禁止事项 / permissions §3 P3 职责分离）。**

```markdown
- [补充] {{本项目特有的约定，如：所有 API 错误返回 RFC 7807 格式}}
- [覆盖] {{覆盖哪条 Workspace 规则}}（原因：{{原因}}）
- [增强] {{更严格的要求，如：所有变更需安全扫描}}
```

**示例：**

```markdown
- [补充] 所有数据库访问必须通过 Repository 层，不得在 Service 层直接使用 ORM。
- [补充] 公共 API 变更必须同步更新 `docs/architecture/api.md`。
- [覆盖] Workspace `coding.md` §4：本项目允许在测试代码中使用魔法值。
- [增强] 所有涉及认证的变更必须经 Security 角色审查。
```

---

## 11. Rule Composition（规则组合）

本项目工作时，规则的组合方式：

```
Workspace 规则（通用默认）
        │ 可被本项目覆盖（非受保护部分）
        ▼
Project 规则（本文件 §10）
        │ 可被 Task 覆盖
        ▼
Task 规则（TASK.md 的 Task Rules 节）
        │
        ▼
受保护规则始终生效，不可被以上任何一层削弱
```

**Workspace 模式：** Workspace 规则 + 本文件 + Task 规则 + 受保护规则。

**Standalone 模式：** 本文件 + Task 规则 + 受保护规则的**内嵌副本**（见 §12）。

---

## 12. Standalone Mode（独立运行）

本项目被单独 `git clone` 后，**没有 Workspace**。此时：

**仍然有效：**

- 本文件（项目规则）
- `tasks/` 中的 Task 与 Handoff
- `docs/` 中的全部文档

**缺失：**

- `.agents/roles/`、`.agents/workflows/`、`.agents/rules/`、`.agents/protocols/`

**应对方式：**

1. **核心约束已内嵌**：`docs/operations/agent-constraints.md` 保存了受保护规则的要点摘要。
   即使在 Standalone 模式下，也必须遵守这些约束。
2. **完整规范获取**：若需要完整的 Role / Workflow / Protocol 定义，可：
   - 重新 clone 原 Workspace，把本项目放回 `projects/` 下；
   - 或从原 Workspace 复制 `.agents/` 到项目根目录。

**Standalone 下的最小工作流：**

```
读本文件 → 读 TASK.md → 按 §3 技术栈与 §5-§8 命令工作
        → 遵守 §10 项目规则 + §12 内嵌约束
        → 写 Handoff 到 task 的 handoffs/
```

---

## 13. Project Agent Notes

> 项目特有的 Agent 行为说明。

{{如：本项目的敏感区域、易错点、必须遵守的额外约定。}}

---

## 14. GitHub Collaboration

> **启用条件：** 本项目使用 GitHub 作为协作载体。不使用时，删除本节并在 §10 中注明。
>
> 规则依据：`.agents/rules/github.md`、`.agents/protocols/github-collaboration.md`、
> `.agents/protocols/github-capability-matrix.md`。
> **Standalone 模式下**本节仍然有效（能力记录随仓库一起分发）。

### 14.1 协作位分配

```yaml
# 两个协作位必须由不同实例承担（I2：实现者 ≠ 批准者）
# 定义见 .agents/protocols/dual-agent-model.md
Coordinator: {{承担主控位的实例或角色}}
Implementer: {{承担执行位的实例或角色}}
```

**若两个协作位共用同一平台身份**，必须在 §14.4 显式披露。

### 14.2 分支与合并

| 项 | 值 |
|----|----|
| 默认分支 | `{{main}}` |
| 分支命名 | 见 `.agents/rules/git.md` §1 |
| 合并策略 | `{{rebase-merge}}`（覆盖默认需注明理由） |
| 合并后删除工作分支 | {{是}} |

### 14.3 必需检查

| 检查名 | 类别 | 来源工作流 |
|--------|------|-----------|
| `{{verify}}` | 静态检查 / 格式检查 / 测试 / 构建 | `.github/workflows/{{ci.yml}}` |
| {{}} | {{}} | {{}} |

> **检查名必须与工作流中的作业名完全一致**，否则必需检查会一直处于「待处理」状态。
> 只把**稳定且必要**的检查设为必需。

### 14.4 平台能力与披露

**能力记录：** `docs/operations/github-capability.md`

在记录中逐项写明（并与此处保持一致）：

- [ ] 默认分支保护是否已启用；仓库计划等级是否支持（私有仓库可能无法启用）
- [ ] 必需检查是否在**合并之前**运行
- [ ] 「直接推送默认分支」是否实测被拒绝
- [ ] 是否存在**平台强制**的独立审查

> ⚠️ **若两个协作位共用同一平台身份，必须在此写明：**
> **「独立审查为流程约定，平台不强制。」**
>
> ⚠️ **未实测的机制一律标注「未实测」，不得默认成立。**

### 14.5 禁止事项

- ❌ 直接推送默认分支
- ❌ 由实现者批准自己提交的交付物
- ❌ 把未实测或未执行的平台配置描述为已生效
- ❌ 通过删除测试、放宽断言或绕过保护规则使检查变绿
- ❌ 未经人类批准执行高风险操作（`.agents/protocols/change-safety.md`）

---

*本文件是项目级 Agent 入口。修改前请确认不削弱受保护规则。*
