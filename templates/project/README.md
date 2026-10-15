# {{PROJECT_NAME}}

> {{PROJECT_DESCRIPTION}}

---

## 快速开始

```bash
# 1. 安装依赖
{{install command}}

# 2. 运行
{{run command}}

# 3. 测试
{{test command}}
```

---

## 项目信息

| 项 | 值 |
|----|----|
| 版本 | {{0.1.0}} |
| 状态 | {{planning}} |
| 技术栈 | {{TECH_STACK}} |
| 负责人 | {{owner}} |

---

## 文档

| 文档 | 位置 |
|------|------|
| 需求 | [`docs/requirements/`](docs/requirements/) |
| 架构 | [`docs/architecture/`](docs/architecture/) |
| 技术实现 | [`docs/technical/`](docs/technical/) |
| 架构决策 | [`docs/decisions/`](docs/decisions/) |
| 运维 | [`docs/operations/`](docs/operations/) |

---

## 目录结构

```
.
├── AGENTS.md      ← Agent 入口协议（AI 协作者必读）
├── README.md      ← 本文件（人类可读）
├── docs/          ← 文档
├── tasks/         ← 任务协作单元
├── src/           ← 源代码
├── tests/         ← 测试
└── scripts/       ← 项目脚本
```

---

## 开发

### 代码规范

{{项目代码规范说明，或指向 docs/technical/coding-conventions.md}}

### 测试

```bash
{{test command}}
```

### 构建

```bash
{{build command}}
```

---

## 协作说明

本项目使用 **Multi-Agent Workspace Framework** 进行协作。

- **AI 协作者**：请先读 [`AGENTS.md`](AGENTS.md)。
- **任务**：在 `tasks/` 下管理，每个任务是一个自包含目录。
- **交接**：通过 `tasks/<state>/<task-id>/handoffs/` 中的文件进行。

---

## 许可证

{{LICENSE}}
