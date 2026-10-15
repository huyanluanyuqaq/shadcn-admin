# .agents — Agent 工作规范

本目录定义**所有项目共享**的 Agent 工作规范。**与技术栈无关。**

## 目录

| 子目录 | 内容 | 文件数 |
|--------|------|-------|
| `roles/` | 角色定义（8 个角色） | 8 + README |
| `workflows/` | 工作流定义（5 个工作流） | 5 + README |
| `rules/` | 通用规则（6 类） | 6 |
| `protocols/` | 协作协议（11 个） | 11 + README |
| `state/` | 跨项目全局状态（保持最小） | README |
| `proposals/` | 待评审的设计草案（非生效规范） | — |

## 结构

```
.agents/
├── README.md              ← 本文件
├── roles/
│   ├── README.md
│   ├── architect.md
│   ├── developer.md
│   ├── reviewer.md
│   ├── tester.md
│   ├── devops.md
│   ├── researcher.md
│   ├── product.md
│   └── security.md
├── workflows/
│   ├── README.md
│   ├── feature.md
│   ├── bugfix.md
│   ├── refactor.md
│   ├── research.md
│   └── release.md
├── rules/
│   ├── coding.md
│   ├── git.md
│   ├── github.md          ← 平台协作规则（PR / 检查 / 合并）
│   ├── testing.md
│   ├── security.md        ⚠️ 受保护
│   └── documentation.md
├── protocols/
│   ├── README.md
│   ├── rule-precedence.md
│   ├── task-lifecycle.md
│   ├── handoff.md
│   ├── collaboration.md
│   ├── permissions.md     ⚠️ §3 P3 受保护
│   ├── role-assignment.md
│   ├── change-safety.md   ⚠️ 受保护
│   ├── project-adoption.md
│   ├── dual-agent-model.md         ← 协作位（主控 / 执行）
│   ├── github-collaboration.md     ← 10 阶段流程
│   └── github-capability-matrix.md ← 平台强制力边界
└── state/
    └── README.md
```

## 设计边界

**本目录中禁止出现：**

- ❌ 具体技术栈（React / Vue / Node.js / Python / PostgreSQL / Docker / Arco Design…）
- ❌ 具体项目名称
- ❌ 具体 API / 数据模型
- ❌ 具体部署环境

**这些属于 Project 层**，应写在 `projects/<name>/AGENTS.md` 中。

## 修改本目录的规则

| 文件类型 | 修改要求 |
|----------|---------|
| `rules/security.md` | 需 Security 角色 + 人类批准 |
| `protocols/change-safety.md` | 需人类批准 |
| `protocols/rule-precedence.md` | 需人类批准 |
| 其他 | 可直接修改，但须保持单一事实来源 |
